-- ROLLBACK da v294 (JCN). Os vínculos já criados (origem 'meu-quadro') ficam; para tirá-los:
--   delete from public.gestao_tarefa_vinculados where origem = 'meu-quadro';
drop trigger if exists trg_gestao_meu_quadro_dono on public.gestao_tarefas;
drop function if exists public.gestao_meu_quadro_dono_trg();
