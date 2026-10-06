-- Rollback da v276. ⚠️ Apaga todos os itens da biblioteca (inclusive os
-- incluídos e aprovados depois). Exporte antes se precisar guardar.
drop table if exists public.psi_biblioteca_itens;
