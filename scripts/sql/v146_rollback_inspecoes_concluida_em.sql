-- Rollback da v146 (JCN) — remove inspecoes.concluida_em.
-- ATENÇÃO: descarta as datas de conclusão já carimbadas. O backfill original era
-- aproximado (updated_at), mas as conclusões feitas APÓS a v146 são exatas e
-- não têm como ser reconstruídas depois de removida a coluna.

alter table public.inspecoes
  drop column if exists concluida_em;
