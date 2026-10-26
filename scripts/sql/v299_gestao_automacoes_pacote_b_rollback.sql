-- ROLLBACK da v299 (Gestão, automações Pacote B — tempo e cobrança). Rodar DEPOIS de voltar o código.
-- Tira o relógio (job e função), as esperas e os gatilhos de tempo. Volta a completude e o gatilho
-- de tarefa da v298 (reaplicar os blocos 2, 6 e 8 de supabase/historico/v298_gestao_automacoes_pacote_a.sql:
-- gestao_automacao_completa/_completa_trg, gestao_automacao_aplicar(…, ctx) e gestao_automacao_trg).

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'gestao-automacao-relogio') then
    perform cron.unschedule('gestao-automacao-relogio');
  end if;
end $$;

-- regras com gatilho de tempo ficam desligadas (o motor da v298 não as conhece)
update public.gestao_automacoes set ativo = false
 where gatilho in ('agendado', 'tarefa_parada', 'data_inicio_chega', 'dependencia_liberada');

drop function if exists public.gestao_automacao_relogio();
drop function if exists public.gestao_agenda_devida(jsonb, timestamp);
drop function if exists public.gestao_automacao_criar_tarefa(public.gestao_automacoes, jsonb, jsonb);
drop function if exists public.gestao_tarefa_ultima_atividade(public.gestao_tarefas);
-- gestao_automacao_executar é usada pela aplicar da v299: reaplique a aplicar da v298 ANTES deste drop.
drop function if exists public.gestao_automacao_executar(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb, text, text);
drop function if exists public.gestao_automacao_regra_completa(text, jsonb, jsonb);
drop function if exists public.gestao_modelo_tarefa_valido(jsonb);
drop function if exists public.gestao_agenda_valida(jsonb);
drop table if exists public.gestao_automacao_esperas;
drop index if exists public.gestao_automacao_log_chave_idx;
-- a coluna gestao_automacao_log.chave fica (inofensiva).

notify pgrst, 'reload schema';
