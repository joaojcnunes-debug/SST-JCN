-- v280 (JCN) — SEC-EQP-01: fecha transferência e estoque do módulo Equipamentos
-- Replicado do Painel SST (v269, commit 96bb93c2, 05/10/2026), sem a trava de banco
-- do painel e sem schema_migrations (o JCN não usa).
--
-- MEDIDO NO JCN EM 22/10/2026 (antes de aplicar)
--   • anon e PUBLIC executavam as 13 RPCs do módulo (ACL padrão: =X, anon=X).
--   • transferencias: policy `transferencias_rw` FOR ALL (só caller_pode_editar +
--     caller_pode_transferir, sem olhar base nem status) e grant de INSERT/UPDATE/
--     DELETE para anon e authenticated.
--   • equipamentos_movimentacoes: policy `equipamentos_movimentacoes_ins` deixava
--     gravar a razão do estoque direto, sem passar pelas RPCs.
--   • aceitar/recusar com JWT sem e-mail: `<> me` com me NULL não levantava.
--   • O código só grava em `transferencias` pelo INSERT individual
--     (useCriarTransferenciaEquipamento) e só lê `equipamentos_movimentacoes`.
--
-- O QUE FAZ
--   1) Revoke de PUBLIC e anon nas 13 RPCs; authenticated mantém 12; o estorno fica
--      sem grant (recusar/cancelar o chamam como definer, dono postgres).
--      Diferença do painel: a epi_assinar_entrega do JCN tem outra assinatura (12 args).
--   2) aceitar/recusar: corpo VIVO do JCN + guarda de e-mail como 1ª instrução.
--   3) transferencias: sai `transferencias_rw`; fica só INSERT direto, pendente,
--      individual, do equipamento que está na base de origem; grant só nas 31 colunas
--      do row do hook.
--   4) equipamentos_movimentacoes: sai a policy de INSERT; razão só por RPC.
--
-- NÃO TOCA: caller_*, service_role, transferencias_sel, equipamentos_movimentacoes_sel.
-- REAPLICAR: idempotente.
-- ROLLBACK:  scripts/sql/v280_sec_eqp_01_fecha_transferencia_estoque_rollback.sql

begin;
set local lock_timeout = '5s';

-- ── 1) ACL das 13 funções ───────────────────────────────────────────────────
revoke execute on function public.epi_assinar_entrega(text,text,text,text,text,text,text,text,text,boolean,boolean,integer) from public, anon;
revoke execute on function public.transferencia_abrir(text) from public, anon;
revoke execute on function public.transferencia_aceitar(text,text,text,text,text,boolean) from public, anon;
revoke execute on function public.transferencia_recusar(text,text) from public, anon;
revoke execute on function public.transferencia_cancelar(text,text) from public, anon;
revoke execute on function public.equipamento_lancar_entrada(text,text,numeric,text,text,text) from public, anon;
revoke execute on function public.equipamento_ajustar_saldo(text,text,numeric,text) from public, anon;
revoke execute on function public.equipamento_importar_nfe(text,text,text,text,text,date,numeric,text,jsonb) from public, anon;
revoke execute on function public.equipamento_registrar_entrega(text,text,date,text,text,jsonb) from public, anon;
revoke execute on function public.equipamento_mudar_status(text,text,text,text,text) from public, anon;
revoke execute on function public.equipamento_registrar_devolucao(text,text,text,date,text,text,jsonb) from public, anon;
revoke execute on function public.equipamento_transferir_estoque(text,text,text,numeric,text,text,text) from public, anon;
revoke execute on function public.equipamento_estornar_transferencia(text) from public, anon, authenticated;

grant execute on function public.epi_assinar_entrega(text,text,text,text,text,text,text,text,text,boolean,boolean,integer) to authenticated;
grant execute on function public.transferencia_abrir(text) to authenticated;
grant execute on function public.transferencia_aceitar(text,text,text,text,text,boolean) to authenticated;
grant execute on function public.transferencia_recusar(text,text) to authenticated;
grant execute on function public.transferencia_cancelar(text,text) to authenticated;
grant execute on function public.equipamento_lancar_entrada(text,text,numeric,text,text,text) to authenticated;
grant execute on function public.equipamento_ajustar_saldo(text,text,numeric,text) to authenticated;
grant execute on function public.equipamento_importar_nfe(text,text,text,text,text,date,numeric,text,jsonb) to authenticated;
grant execute on function public.equipamento_registrar_entrega(text,text,date,text,text,jsonb) to authenticated;
grant execute on function public.equipamento_mudar_status(text,text,text,text,text) to authenticated;
grant execute on function public.equipamento_registrar_devolucao(text,text,text,date,text,text,jsonb) to authenticated;
grant execute on function public.equipamento_transferir_estoque(text,text,text,numeric,text,text,text) to authenticated;
-- equipamento_estornar_transferencia(text): sem grant.

-- ── 2) aceitar / recusar: corpo VIVO do JCN + guarda de e-mail ──────────────
CREATE OR REPLACE FUNCTION public.transferencia_aceitar(p_id text, p_assinatura_png text, p_pdf_sha256 text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_consentimento boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.transferencias;
  me text := lower(auth.jwt() ->> 'email');
  v_nome text;
begin
  if coalesce(me,'') = '' then
    raise exception 'Sessao sem e-mail: nao e possivel aceitar a transferencia';
  end if;
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferencia ja finalizada por outra pessoa'; end if;
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'So o destinatario selecionado (ou um admin) pode aceitar esta transferencia';
  end if;
  if lower(coalesce(t.responsavel_email,'')) = me then
    raise exception 'Quem registrou a transferencia nao pode aceita-la — o recebimento deve ser confirmado por outra pessoa';
  end if;
  if coalesce(btrim(p_assinatura_png),'') = '' then
    raise exception 'Assinatura obrigatoria para aceitar a transferencia';
  end if;
  if t.para_id_unidade is null then
    raise exception 'Transferencia sem unidade de destino definida — nao pode ser aceita';
  end if;
  select nome into v_nome from public.usuarios where lower(email) = me limit 1;
  if t.id_catalogo is not null then
    insert into public.equipamentos_movimentacoes (
      id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, criado_por
    ) values (
      t.id_catalogo, t.para_id_unidade, 'entrada', t.quantidade, 'transferencia',
      t.id_transferencia, coalesce(t.motivo, 'transferencia entre bases'), me
    );
  else
    update public.inventario_maquinas
       set id_unidade        = t.para_id_unidade,
           unidade           = (select nome from public.unidades where id_unidade = t.para_id_unidade),
           localizacao       = coalesce(t.para_localizacao, localizacao),
           responsavel_setor = coalesce(t.para_responsavel, responsavel_setor),
           updated_at        = now()
     where id_maquina = t.id_maquina;
    update public.equipamentos e
       set id_unidade  = t.para_id_unidade,
           localizacao = coalesce(t.para_localizacao, e.localizacao),
           responsavel = coalesce(t.para_responsavel, e.responsavel),
           updated_at  = now()
     where (t.id_equipamento is not null and e.id_equipamento = t.id_equipamento)
        or (t.id_maquina    is not null and e.id_inventario_origem = t.id_maquina);
  end if;
  update public.transferencias
     set status = 'aceita',
         aceita_por_email = me, aceita_em = now(),
         assinante_nome = coalesce(v_nome, t.para_usuario_nome),
         assinatura_png = p_assinatura_png,
         pdf_sha256     = p_pdf_sha256,
         user_agent     = p_user_agent,
         assinatura_ip  = p_ip,
         consentimento_em = case when p_consentimento then now() else null end,
         assinado_em    = now(),
         em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.transferencia_recusar(p_id text, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.transferencias; me text := lower(auth.jwt() ->> 'email');
begin
  if coalesce(me,'') = '' then
    raise exception 'Sessao sem e-mail: nao e possivel recusar a transferencia';
  end if;
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferencia ja finalizada por outra pessoa'; end if;
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'So o destinatario selecionado (ou um admin) pode recusar esta transferencia';
  end if;
  update public.transferencias
     set status = 'recusada', recusada_por_email = me, recusada_em = now(),
         recusada_motivo = p_motivo, em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
  perform public.equipamento_estornar_transferencia(p_id);
end $function$;

revoke execute on function public.transferencia_aceitar(text,text,text,text,text,boolean) from public, anon;
revoke execute on function public.transferencia_recusar(text,text) from public, anon;
grant execute on function public.transferencia_aceitar(text,text,text,text,text,boolean) to authenticated;
grant execute on function public.transferencia_recusar(text,text) to authenticated;

-- ── 3) transferencias: só INSERT direto, pendente, individual, da própria base ─
drop policy if exists transferencias_rw on public.transferencias;
drop policy if exists transferencias_ins on public.transferencias;
create policy transferencias_ins on public.transferencias
  for insert to authenticated
  with check (
    public.caller_pode_editar()
    and public.caller_pode_transferir()
    and status = 'pendente'
    and lower(responsavel_email) = lower(auth.jwt() ->> 'email')
    and (public.caller_eh_admin() or de_id_unidade = any(public.caller_unidades()))
    and id_catalogo is null
    and quantidade is null
    and id_equipamento is not null
    and para_id_unidade is distinct from de_id_unidade
    and exists (
      select 1 from public.equipamentos e
       where e.id_equipamento = transferencias.id_equipamento
         and e.id_unidade = transferencias.de_id_unidade
         and transferencias.id_maquina is not distinct from e.id_inventario_origem
    )
  );

revoke insert, update, delete on public.transferencias from authenticated, anon, public;
grant insert (
  id_transferencia, id_equipamento, id_maquina, status,
  de_id_unidade, de_unidade, de_localizacao, de_responsavel,
  para_id_unidade, para_unidade, para_localizacao, para_responsavel,
  para_usuario_email, para_usuario_nome, transportado_por, motivo, observacoes,
  maquina_nome, maquina_tipo, maquina_categoria, maquina_codigo_interno, maquina_tag,
  maquina_marca, maquina_modelo, maquina_numero_serie, maquina_numero_patrimonio,
  maquina_foto_url, responsavel_nome, responsavel_email, data_hora, created_at
) on public.transferencias to authenticated;

-- ── 4) equipamentos_movimentacoes: razão só por RPC ─────────────────────────
drop policy if exists equipamentos_movimentacoes_ins on public.equipamentos_movimentacoes;
revoke insert, update, delete on public.equipamentos_movimentacoes from authenticated, anon, public;

commit;
