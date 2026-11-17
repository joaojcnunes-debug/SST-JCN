-- v360 — Gestão: a sincronização do Runrun não desfaz os responsáveis da janela da subtarefa (17/11/2026, 0.3.296).
--
-- POR QUÊ: com "a janela vale" (0.3.296/v359), quem manda nos responsáveis de uma subtarefa que já tem janela é a
-- janela. Mas a sincronização do Runrun regrava gestao_subtarefas.responsavel_email (o 1º alocado do Runrun), e o
-- gatilho gestao_subtarefa_sync_filha_trg, ao ver o responsável da linha mudar, APAGA os responsáveis da janela e põe
-- só esse — a próxima sincronização desfaria o que foi ajustado na janela.
--
-- O QUE FAZ: gatilho BEFORE UPDATE OF responsavel_email: numa linha do Runrun (id SRR-) que já tem janela, a mudança
-- do responsável da linha que não vem da própria janela (gestao.sync_sub <> 'on', que o gatilho da janela liga) é
-- ignorada — o valor antigo fica. O resto da linha (título, feito, alocados, etapa…) segue sincronizando normalmente.
-- Linha da Gestão (SUB-) e linha do Runrun sem janela: nada muda.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v360_gestao_subtarefa_runrun_janela_vale_rollback.sql
begin;

create or replace function public.gestao_subtarefa_resp_janela_vale_trg() returns trigger
  language plpgsql security definer set search_path = public as $fn$
begin
  if old.id like 'SRR-%' and old.id_tarefa_filha is not null
     and new.responsavel_email is distinct from old.responsavel_email
     and coalesce(current_setting('gestao.sync_sub', true), '') <> 'on' then
    new.responsavel_email := old.responsavel_email;
  end if;
  return new;
end $fn$;
revoke all on function public.gestao_subtarefa_resp_janela_vale_trg() from public, anon, authenticated;

drop trigger if exists gestao_subtarefa_resp_janela_vale on public.gestao_subtarefas;
create trigger gestao_subtarefa_resp_janela_vale
  before update of responsavel_email on public.gestao_subtarefas
  for each row execute function public.gestao_subtarefa_resp_janela_vale_trg();

notify pgrst, 'reload schema';

commit;
