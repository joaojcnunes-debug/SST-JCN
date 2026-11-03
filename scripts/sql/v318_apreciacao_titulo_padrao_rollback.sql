-- Rollback da v318: devolve o título nulo aos 5 laudos que existiam em 03/11/2026.
UPDATE public.apreciacoes_maquinas SET titulo = NULL
 WHERE titulo = 'Apreciação de Máquinas NR-12'
   AND id_apreciacao IN ('APR-9251C1C5', 'APR-1D7A3268', 'APR-FAE4EC3A', 'APR-AB43EA86', 'APR-3CC4FFE1');
