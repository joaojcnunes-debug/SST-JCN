-- v279 (JCN) — devolução de item POR QUANTIDADE grava o(s) número(s) de série
-- Replicado do Painel SST (v266, commit 14bbe6e6, v0.3.675), sem a trava de banco
-- do painel. Par da v238 (entrega).
--
-- ORIGEM
--   Periférico com série (headset, mouse) devolvido "por quantidade" ficava com a
--   série vazia na devolução, embora a entrega (v238) já gravasse a série.
--
-- O QUE FAZ
--   Corpo = definição VIVA do JCN em 22/10/2026 (pg_get_functiondef). Muda SÓ o
--   ramo genérico: se a tela mandar `seriais` no item, elas vão para
--   `numero_serie` da linha, separadas por vírgula (mesmo desenho da v238).
--
-- REAPLICAR: idempotente (create or replace).
-- ROLLBACK:  scripts/sql/v279_devolucao_estoque_numero_serie_rollback.sql

begin;

CREATE OR REPLACE FUNCTION public.equipamento_registrar_devolucao(p_id_unidade text, p_id_colaborador text, p_id_entrega text, p_data_devolucao date, p_recebido_por text, p_observacao text, p_itens jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id     text := gen_random_uuid()::text;
  v_item   jsonb;
  v_id_eq  text;
  v_id_cat text;
  v_qty    numeric;
  v_estado text;
  v_obs    text;
  v_novo   text;
  v_serial text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissao para registrar devolucao.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Modulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Informe ao menos um item.'; end if;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_eq := nullif(v_item->>'id_equipamento', '');
    if v_id_eq is not null then
      if not exists (select 1 from equipamentos
                      where id_equipamento = v_id_eq and id_colaborador = p_id_colaborador) then
        raise exception 'O equipamento "%" nao esta com este colaborador.',
          coalesce((select nome from equipamentos where id_equipamento = v_id_eq), v_id_eq);
      end if;
    elsif nullif(v_item->>'id_catalogo', '') is null then
      raise exception 'Item sem equipamento nem produto do catalogo.';
    end if;
    if coalesce(v_item->>'estado_retorno', 'integro') <> 'integro'
       and coalesce(btrim(v_item->>'observacao_estado'), '') = '' then
      raise exception 'Descreva a avaria do item devolvido em estado "%".', v_item->>'estado_retorno';
    end if;
  end loop;
  insert into equipamentos_devolucoes
    (id_devolucao, id_unidade, id_colaborador, id_entrega, data_devolucao,
     recebido_por, observacao, total_itens, criado_por)
  values
    (v_id, p_id_unidade, p_id_colaborador, nullif(btrim(p_id_entrega), ''),
     coalesce(p_data_devolucao, current_date), p_recebido_por, p_observacao,
     coalesce(jsonb_array_length(p_itens), 0), v_email);
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_eq  := nullif(v_item->>'id_equipamento', '');
    v_id_cat := nullif(v_item->>'id_catalogo', '');
    v_qty    := coalesce(nullif(v_item->>'quantidade', '')::numeric, 1);
    v_estado := coalesce(nullif(v_item->>'estado_retorno', ''), 'integro');
    v_obs    := nullif(btrim(v_item->>'observacao_estado'), '');
    v_novo   := nullif(btrim(v_item->>'novo_status'), '');
    if v_id_eq is not null then
      insert into equipamentos_devolucoes_itens
        (id_item, id_devolucao, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade, estado_retorno, observacao_estado)
      select gen_random_uuid()::text, v_id, p_id_unidade, e.id_catalogo, e.id_equipamento,
             e.nome, e.numero_serie, e.numero_patrimonio, 1, v_estado, v_obs
        from equipamentos e where e.id_equipamento = v_id_eq;
      update equipamentos
         set id_colaborador = null, entregue_em = null, updated_at = now()
       where id_equipamento = v_id_eq;
      update equipamentos_entregas_itens
         set devolvido_em = now()
       where id_equipamento = v_id_eq and devolvido_em is null;
      if v_novo is not null then
        perform public.equipamento_mudar_status(
          v_id_eq, v_novo,
          coalesce(v_obs, 'Avaria constatada na devolucao'),
          'DEVOLUCAO_AVARIA', null);
      end if;
    else
      -- v279: periférico com série devolvia com série vazia. Se a tela mandar
      -- `seriais`, elas vão para `numero_serie` desta linha, separadas por vírgula.
      v_serial := nullif(btrim(coalesce((
        select string_agg(btrim(x), ', ')
          from jsonb_array_elements_text(coalesce(v_item->'seriais', '[]'::jsonb)) x
         where btrim(x) <> ''), '')), '');
      insert into equipamentos_devolucoes_itens
        (id_item, id_devolucao, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade, estado_retorno, observacao_estado)
      select gen_random_uuid()::text, v_id, p_id_unidade, c.id_catalogo, null,
             c.nome, v_serial, null, v_qty, v_estado, v_obs
        from equipamentos_catalogo c where c.id_catalogo = v_id_cat;
      if v_estado <> 'inservivel' then
        insert into equipamentos_movimentacoes
          (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
        values
          (gen_random_uuid()::text, v_id_cat, p_id_unidade, 'entrada', v_qty, 'devolucao', v_id,
           'Devolucao de colaborador' || coalesce(' — ' || v_obs, ''), p_recebido_por, v_email);
      end if;
    end if;
  end loop;
  return v_id;
end $function$;

commit;
