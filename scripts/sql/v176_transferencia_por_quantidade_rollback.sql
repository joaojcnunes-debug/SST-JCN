-- ROLLBACK da v176 — remove a transferência por quantidade.
--
-- ⚠️ LEIA ANTES DE RODAR.
--   Este rollback derruba as colunas `id_catalogo` e `quantidade` de
--   `transferencias`. Se já existir QUALQUER transferência por quantidade
--   gravada, ela vira uma linha sem item nenhum — e a mercadoria que estiver
--   em trânsito (saída lançada, entrada ainda não) fica perdida no extrato,
--   sem nada que explique para onde ia.
--
--   Por isso este script SE RECUSA a rodar se houver transferência por
--   quantidade registrada. Para desfazer mesmo assim, resolva as pendentes
--   antes (aceitar ou recusar) e depois apague as linhas à mão, ciente de que
--   o histórico delas se perde.
--
-- As funções voltam ao estado da v175.
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v176_..._rollback.sql

do $$
declare v_qtd bigint; v_transito bigint;
begin
  select count(*) into v_qtd from public.transferencias where id_catalogo is not null;
  if v_qtd > 0 then
    select count(*) into v_transito from public.transferencias
     where id_catalogo is not null and status = 'pendente';
    raise exception
      'rollback da v176 RECUSADO: existem % transferencia(s) por quantidade (% em transito). Resolva as pendentes antes.',
      v_qtd, v_transito;
  end if;
end $$;

drop function if exists public.equipamento_transferir_estoque(text,text,text,numeric,text,text,text);
drop function if exists public.equipamento_estornar_transferencia(text);

-- transferencia_aceitar volta ao estado da v175 (sem o ramo da quantidade).
create or replace function public.transferencia_aceitar(
  p_id text, p_assinatura_png text, p_pdf_sha256 text default null::text,
  p_user_agent text default null::text, p_ip text default null::text,
  p_consentimento boolean default false
)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare t public.transferencias; me text := lower(auth.jwt() ->> 'email'); v_nome text;
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode aceitar esta transferência';
  end if;
  if lower(coalesce(t.responsavel_email,'')) = me then
    raise exception 'Quem registrou a transferência não pode aceitá-la — o recebimento deve ser confirmado por outra pessoa';
  end if;
  if coalesce(btrim(p_assinatura_png),'') = '' then
    raise exception 'Assinatura obrigatória para aceitar a transferência';
  end if;
  if t.para_id_unidade is null then
    raise exception 'Transferência sem unidade de destino definida — não pode ser aceita';
  end if;
  select nome into v_nome from public.usuarios where lower(email) = me limit 1;

  update public.inventario_maquinas
     set id_unidade = t.para_id_unidade,
         unidade = (select nome from public.unidades where id_unidade = t.para_id_unidade),
         localizacao = coalesce(t.para_localizacao, localizacao),
         responsavel_setor = coalesce(t.para_responsavel, responsavel_setor),
         updated_at = now()
   where id_maquina = t.id_maquina;

  update public.equipamentos e
     set id_unidade = t.para_id_unidade,
         localizacao = coalesce(t.para_localizacao, e.localizacao),
         responsavel = coalesce(t.para_responsavel, e.responsavel),
         updated_at = now()
   where (t.id_equipamento is not null and e.id_equipamento = t.id_equipamento)
      or (t.id_maquina is not null and e.id_inventario_origem = t.id_maquina);

  update public.transferencias
     set status = 'aceita', aceita_por_email = me, aceita_em = now(),
         assinante_nome = coalesce(v_nome, t.para_usuario_nome),
         assinatura_png = p_assinatura_png, pdf_sha256 = p_pdf_sha256,
         user_agent = p_user_agent, assinatura_ip = p_ip,
         consentimento_em = case when p_consentimento then now() else null end,
         assinado_em = now(), em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
end $function$;

-- Recusar e cancelar voltam a NÃO estornar (não há mais o que estornar).
create or replace function public.transferencia_recusar(p_id text, p_motivo text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare t public.transferencias; me text := lower(auth.jwt() ->> 'email');
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode recusar esta transferência';
  end if;
  update public.transferencias
     set status = 'recusada', recusada_por_email = me, recusada_em = now(),
         recusada_motivo = p_motivo, em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
end $function$;

create or replace function public.transferencia_cancelar(p_id text, p_motivo text default null::text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare me text := lower(auth.jwt() ->> 'email');
begin
  if not public.caller_pode_transferir() then
    raise exception 'Sem permissão de transferência';
  end if;
  update public.transferencias
     set status = 'cancelada', cancelada_por_email = me, cancelada_em = now(),
         cancelada_motivo = p_motivo, em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id and status = 'pendente';
  if not found then raise exception 'Transferência já finalizada — não é mais possível cancelar'; end if;
end $function$;

alter table public.transferencias drop constraint if exists transferencias_um_modelo_ou_outro;
drop index if exists public.idx_transferencias_catalogo;
alter table public.transferencias drop column if exists quantidade;
alter table public.transferencias drop column if exists id_catalogo;

do $$
begin
  raise notice 'v176 desfeita: transferencia volta a ser so individualizada';
end $$;
