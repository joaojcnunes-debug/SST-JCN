-- ROLLBACK da v204 — tira a coluna de vínculo de `responsaveis`.
--
-- ⚠️ LEIA ANTES DE RODAR: isto APAGA os vínculos gravados. Se a intenção é só
-- desfazer uma execução do script de preenchimento, NÃO use este arquivo — use
-- o `vinculo-desfazer-<carimbo>.sql` que o próprio script escreveu, que anula
-- apenas as linhas daquela execução e preserva o que foi arrumado à mão.
--
-- Este arquivo é para o caso de a v204 inteira ter sido um erro.
--
-- Nada mais depende da coluna: `tecnico_responsavel` continua sendo a fonte do
-- que sai no documento do cliente, e o dashboard sabe viver sem o vínculo (é o
-- que ele faz desde 25/08, deduzindo por `lib/dashboard/tecnicos.ts`).

begin;

alter table public.responsaveis
  drop constraint if exists responsaveis_id_usuario_fkey;

drop index if exists public.responsaveis_id_usuario_idx;

alter table public.responsaveis
  drop column if exists id_usuario;

commit;

-- Depois disto, recarregue o schema do PostgREST — senão ele segue servindo a
-- coluna que não existe mais e o painel recebe 400:
--   NOTIFY pgrst, 'reload schema';
