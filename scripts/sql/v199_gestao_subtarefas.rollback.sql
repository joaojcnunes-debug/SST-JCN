-- v199 ROLLBACK — desfaz "subtarefa vira tabela gestao_subtarefas" (GESTAO-UX-01-UXB-F21 / F2.1).
--
-- ⚠️  NAO E UMA MIGRATION — por isso mora aqui, fora de supabase/migrations/, e o nome
--     contem "rollback" (migrate.ps1 pula arquivos com "rollback" no nome). Nunca roda no
--     deploy. So executar manualmente, a mao, no psql/SQL Editor, se a v199 precisar voltar.
--
-- SEM PERDA DO MODELO ANTIGO: a coluna jsonb gestao_tarefas.subtarefas NUNCA foi dropada
--     pela v199 — ela seguiu sendo mantida como espelho pelo trigger. Ao remover o trigger
--     e a tabela, o jsonb permanece com o ultimo estado espelhado, e o front revertido
--     (git revert do commit da F2.1) volta a ler/gravar o jsonb direto. Volta instantanea.
--
--     O que se perde: as colunas etapa/tipo (so existiam na tabela; a UX-B ainda nao as
--     usava) e a identidade/ordem por linha. O texto+feito de cada subtarefa continua no
--     jsonb espelhado, entao nenhuma subtarefa some da tela.

begin;

-- (1) Trigger-espelho + sua funcao.
drop trigger if exists gestao_subtarefa_espelho_trg on public.gestao_subtarefas;
drop function if exists public.gestao_subtarefa_espelho_trg();

-- (2) A tabela (leva junto policies e indices).
drop table if exists public.gestao_subtarefas;

-- (3) Remove a marca da migration (padrao v196 — o apply insere, o rollback remove).
delete from public.schema_migrations where version = 'v199_gestao_subtarefas';

commit;
