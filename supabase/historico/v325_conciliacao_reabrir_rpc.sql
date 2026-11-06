-- v325 — A liberação para o Comercial passa a ser etapa da Conciliação (06/11/2026, 0.3.238).
--
-- Com tudo na mesma tela, depois de liberado fica só leitura. Reabrir a conciliação precisa então
-- reabrir o atendimento junto, senão ninguém consegue Iniciar para refazer os pareceres. Por isso a
-- reabertura vira uma função, numa operação só, e a escrita direta na tabela sai.
-- comercial_concluir passa a recusar conciliação que não está fechada.
--
-- Rollback: scripts/sql/v325_conciliacao_reabrir_rpc_rollback.sql
begin;

create or replace function public.comercial_reabrir_conciliacao(p_id_empresa text, p_id_fechamento text, p_motivo text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_ultimo text;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  select * into q from public.comercial_quem();
  if not public.caller_pode_ver_empresa(p_id_empresa) then
    raise exception 'Sem acesso a esta empresa' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Escreva o motivo da reabertura' using errcode = '22023';
  end if;
  select f.id_fechamento into v_ultimo from public.psico_conciliacao_fechamentos f
   where f.id_empresa = p_id_empresa order by f.fechado_em desc limit 1;
  if v_ultimo is distinct from p_id_fechamento then
    raise exception 'Só a última conciliação fechada pode ser reaberta' using errcode = 'P0001';
  end if;

  insert into public.psico_conciliacao_reaberturas (id_reabertura, id_fechamento, id_empresa, motivo, reaberto_por)
  values ('PCR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), p_id_fechamento, p_id_empresa, v_motivo, lower(q.r_email));

  -- Liberada: volta a andamento, para dar para Iniciar e refazer.
  update public.comercial_atendimentos
     set status = 'EM_ANDAMENTO', concluido_em = null, concluido_por = null
   where id_empresa = p_id_empresa and status = 'CONCLUIDO';
  if found then
    insert into public.comercial_atendimento_eventos (id_empresa, tipo, motivo, por)
    values (p_id_empresa, 'REABERTO', 'Conciliação reaberta: ' || v_motivo, q.r_nome);
  end if;
end $$;
revoke execute on function public.comercial_reabrir_conciliacao(text, text, text) from public, anon;
grant execute on function public.comercial_reabrir_conciliacao(text, text, text) to authenticated;

drop policy if exists psico_conciliacao_reaberturas_ins on public.psico_conciliacao_reaberturas;
revoke insert on public.psico_conciliacao_reaberturas from authenticated;

create or replace function public.comercial_concluir(p_id_empresa text, p_parecer text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_parecer text := nullif(btrim(p_parecer), '');
begin
  v_nome := public.comercial_exige_sessao(p_id_empresa);
  if not public.comercial_conciliacao_fechada(p_id_empresa) then
    raise exception 'Feche a conciliação antes de liberar' using errcode = 'P0001';
  end if;
  if v_parecer is null then
    raise exception 'Escreva o parecer antes de liberar' using errcode = '22023';
  end if;
  update public.comercial_atendimentos
     set status = 'CONCLUIDO', parecer = v_parecer, concluido_em = now(), concluido_por = v_nome
   where id_empresa = p_id_empresa;
  update public.comercial_sessoes set fim = now(), motivo_fim = 'CONCLUIDO'
   where id_empresa = p_id_empresa and fim is null;
  insert into public.comercial_atendimento_eventos (id_empresa, tipo, parecer, por)
    values (p_id_empresa, 'CONCLUIDO', v_parecer, v_nome);
end $$;

notify pgrst, 'reload schema';

commit;
