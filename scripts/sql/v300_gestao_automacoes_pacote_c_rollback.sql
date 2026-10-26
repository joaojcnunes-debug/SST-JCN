-- ROLLBACK da v300 (Gestão, automações Pacote C — rodízio e botão manual). Rodar DEPOIS de voltar o código.
-- Reaplique antes gestao_automacao_executar e gestao_automacao_completa da v299
-- (supabase/historico/v299_gestao_automacoes_pacote_b.sql, blocos 2 e 3): sem elas o motor ainda
-- despacha para a função de rodízio apagada abaixo.

update public.gestao_automacoes set ativo = false
 where gatilho = 'manual' or acoes @> '[{"tipo":"atribuir_rodizio"}]'::jsonb;

drop function if exists public.gestao_automacao_executar_manual(uuid, text[]);
drop function if exists public.gestao_automacao_acao_rodizio(public.gestao_automacoes, jsonb, public.gestao_tarefas);
drop function if exists public.gestao_automacao_escolher(uuid, jsonb);
drop table if exists public.gestao_automacao_estado;

notify pgrst, 'reload schema';
