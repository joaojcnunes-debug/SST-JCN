-- v187 ROLLBACK — desfaz "vinculo multiplo por tarefa" (GESTAO-KANBAN-01-F1.2).
--
-- ⚠️  NAO E UMA MIGRATION — por isso mora em scripts/sql/, fora de supabase/migrations/.
--     O migrate.ps1 ignora arquivos com "rollback" no nome; nunca roda no deploy.
--     Executar SO manualmente, a mao, se a v187 precisar ser revertida.
--
-- PERDA DE DADOS controlada: descarta a tabela gestao_tarefa_vinculados inteira (os vinculos
-- responsavel/seguidor e o backfill). NAO ha perda de `responsavel`: o espelho e de direcao
-- unica (vinculo -> responsavel) e nunca apaga o texto sem uma mudanca de vinculo; ao dropar
-- a tabela/trigger, gestao_tarefas.responsavel permanece com o ultimo valor espelhado.
--
-- ORDEM CORRETA:
--   1. Reverter o CODIGO primeiro (git revert + deploy) — o front novo le/escreve esta tabela;
--      dropa-la com o front novo no ar quebraria o modal e o "Minhas tarefas".
--   2. So entao rodar este script.

begin;

drop trigger if exists trg_gestao_vinculo_espelho on public.gestao_tarefa_vinculados;
drop function if exists public.gestao_vinculo_espelho_trg();
drop table if exists public.gestao_tarefa_vinculados;

-- Remove o registro da migration na MESMA transacao (o apply insere esta linha a mao).
delete from public.schema_migrations where version = 'v187_gestao_tarefa_vinculados';

commit;
