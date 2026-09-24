-- v238 — retirada de item POR QUANTIDADE grava o(s) número(s) de série informado(s)
-- Origem: definição real de produção em 21/09/2026 (pg_get_functiondef),
-- alterado SÓ o ramo "consumível/genérico" (item por quantidade).

begin;

CREATE OR REPLACE FUNCTION public.equipamento_registrar_entrega(p_id_unidade text, p_id_colaborador text, p_data_entrega date, p_responsavel text, p_observacao text, p_itens jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id     text := gen_random_uuid()::text;
  v_item   jsonb;
  v_agg    record;
  v_saldo  numeric;
  v_id_cat text;
  v_id_eq  text;
  v_qty    numeric;
  v_serial text;
  v_indiv  boolean;
  v_i      int;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para registrar entrega.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if not exists (select 1 from colaboradores_chabra
                  where id_colaborador = p_id_colaborador and id_unidade = p_id_unidade and ativo) then
    raise exception 'Colaborador não pertence a esta base (ou está inativo).';
  end if;
  if coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Informe ao menos um item.'; end if;

  -- (a) itens de estoque: valida saldo de TODOS antes de qualquer escrita
  for v_agg in
    select e->>'id_catalogo' as id_catalogo,
           sum(coalesce(nullif(e->>'quantidade', '')::numeric, 1)) as req
      from jsonb_array_elements(p_itens) e
     where nullif(e->>'id_catalogo', '') is not null
     group by e->>'id_catalogo'
  loop
    if v_agg.req <= 0 then raise exception 'Quantidade inválida.'; end if;
    v_saldo := coalesce((
      select sum(case when tipo = 'saida' then -quantidade else quantidade end)
        from equipamentos_movimentacoes
       where id_catalogo = v_agg.id_catalogo and id_unidade = p_id_unidade), 0);
    if v_saldo < v_agg.req then
      raise exception 'Saldo insuficiente para "%": disponível %, solicitado %.',
        coalesce((select nome from equipamentos_catalogo where id_catalogo = v_agg.id_catalogo), v_agg.id_catalogo),
        v_saldo, v_agg.req;
    end if;
  end loop;

  -- (b) ativos já existentes: precisam existir, estar na base e estar LIVRES
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_eq := nullif(v_item->>'id_equipamento', '');
    if v_id_eq is null then continue; end if;
    if not exists (select 1 from equipamentos where id_equipamento = v_id_eq and id_unidade = p_id_unidade) then
      raise exception 'Equipamento % não existe nesta base.', v_id_eq;
    end if;
    if exists (select 1 from equipamentos where id_equipamento = v_id_eq and id_colaborador is not null) then
      raise exception 'Equipamento "%" já está com outra pessoa. Registre a devolução antes de entregar de novo.',
        coalesce((select nome from equipamentos where id_equipamento = v_id_eq), v_id_eq);
    end if;
  end loop;

  insert into equipamentos_entregas
    (id_entrega, id_unidade, id_colaborador, data_entrega, responsavel_entrega, observacao,
     total_itens, status, criado_por)
  values
    (v_id, p_id_unidade, p_id_colaborador, coalesce(p_data_entrega, current_date), p_responsavel, p_observacao,
     coalesce(jsonb_array_length(p_itens), 0), 'registrada', v_email);

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_cat := nullif(v_item->>'id_catalogo', '');
    v_id_eq  := nullif(v_item->>'id_equipamento', '');

    -- ── (b) ativo existente: só vincula, sem tocar no saldo ──
    if v_id_eq is not null then
      update equipamentos
         set id_colaborador = p_id_colaborador, entregue_em = now(), updated_at = now()
       where id_equipamento = v_id_eq;

      insert into equipamentos_entregas_itens
        (id_item, id_entrega, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade)
      select gen_random_uuid()::text, v_id, p_id_unidade, e.id_catalogo, e.id_equipamento,
             e.nome, e.numero_serie, e.numero_patrimonio, 1
        from equipamentos e where e.id_equipamento = v_id_eq;
      continue;
    end if;

    -- ── (a) saída de estoque ──
    if v_id_cat is null then continue; end if;
    v_qty := coalesce(nullif(v_item->>'quantidade', '')::numeric, 1);
    if v_qty <= 0 then continue; end if;

    select controla_individual into v_indiv from equipamentos_catalogo where id_catalogo = v_id_cat;

    insert into equipamentos_movimentacoes
      (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
    values
      (gen_random_uuid()::text, v_id_cat, p_id_unidade, 'saida', v_qty, 'entrega', v_id,
       'Entrega ao colaborador', p_responsavel, v_email);

    if coalesce(v_indiv, true) then
      -- Cada unidade vira um ativo: é o "#A31 → João" do briefing.
      -- `seriais` é opcional e posicional; sem ele o ativo nasce sem série.
      for v_i in 1 .. v_qty::int loop
        v_serial := nullif(btrim(coalesce(v_item->'seriais'->>(v_i - 1), '')), '');
        v_id_eq  := gen_random_uuid()::text;

        insert into equipamentos
          (id_equipamento, id_unidade, id_catalogo, nome, tipo, fabricante, modelo,
           numero_serie, status, id_colaborador, entregue_em, criado_por)
        select v_id_eq, p_id_unidade, c.id_catalogo, c.nome, c.tipo, c.fabricante, c.modelo,
               v_serial, 'OPERANTE', p_id_colaborador, now(), v_email
          from equipamentos_catalogo c where c.id_catalogo = v_id_cat;

        insert into equipamentos_entregas_itens
          (id_item, id_entrega, id_unidade, id_catalogo, id_equipamento,
           nome_equipamento, numero_serie, numero_patrimonio, quantidade)
        select gen_random_uuid()::text, v_id, p_id_unidade, v_id_cat, v_id_eq,
               c.nome, v_serial, null, 1
          from equipamentos_catalogo c where c.id_catalogo = v_id_cat;
      end loop;
    else
      -- Consumível/genérico: só o registro da quantidade entregue.
      -- v238 (21/09/2026): periférico também pode ter série (headset, webcam).
      -- Se a tela mandar `seriais`, elas vão para `numero_serie` desta linha,
      -- separadas por vírgula — é o que o termo imprime. Sem série, fica null
      -- como antes.
      v_serial := nullif(btrim(coalesce((
        select string_agg(btrim(x), ', ')
          from jsonb_array_elements_text(coalesce(v_item->'seriais', '[]'::jsonb)) x
         where btrim(x) <> ''), '')), '');
      insert into equipamentos_entregas_itens
        (id_item, id_entrega, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade)
      select gen_random_uuid()::text, v_id, p_id_unidade, v_id_cat, null,
             c.nome, v_serial, null, v_qty
        from equipamentos_catalogo c where c.id_catalogo = v_id_cat;
    end if;
  end loop;

  return v_id;
end $function$;

insert into public.schema_migrations (version)
values ('v238_entrega_estoque_numero_serie')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
