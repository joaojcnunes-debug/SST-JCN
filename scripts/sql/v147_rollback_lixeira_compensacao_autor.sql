-- Rollback da v147 (JCN) — tira as 2 policies do autor.
-- Depois disto a compensação do `excluirComLixeira` volta a falhar calada
-- (DELETE 0 sem erro), e snapshots fantasma podem voltar a aparecer quando um
-- DELETE falhar. Nenhum dado é perdido.

DROP POLICY IF EXISTS "autor apaga snapshot orfao" ON public.registros_excluidos;
DROP POLICY IF EXISTS "autor le snapshot recente" ON public.registros_excluidos;
