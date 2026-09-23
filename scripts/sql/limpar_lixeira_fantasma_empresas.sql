-- Limpeza pontual: snapshots FANTASMA na lixeira de empresas.
-- NAO e migration (nao muda schema, e um conserto de dado). Rodar a mao.
--
-- De onde vem o fantasma: `excluirComLixeira` (lib/hooks/useLixeira.ts) grava o
-- snapshot em registros_excluidos ANTES de rodar o DELETE. Quando o DELETE
-- falha (era o caso das FKs sem cascata, corrigidas na v143 do JCN), o snapshot
-- fica para tras: a Lixeira lista como "excluida" uma empresa que esta viva, e
-- clicar em "Restaurar" da erro de chave duplicada.
--
-- No painel-sst eram 7 linhas em 2026-07-30, todas da mesma empresa. No JCN,
-- em 2026-09-23, nao havia nenhuma — este script fica versionado como
-- ferramenta, para o dia em que aparecer.
--
-- Apaga SO snapshot hard-delete cujo registro AINDA EXISTE em `empresas` — ou
-- seja, snapshot que nao protege nada. Soft delete fica de fora de proposito:
-- ali a linha existir e o comportamento correto.

BEGIN;

\echo == Antes: fantasmas encontrados ==
SELECT r.registro_id, r.rotulo, r.excluido_por, r.excluido_em
  FROM public.registros_excluidos r
 WHERE r.tabela = 'empresas'
   AND r.tipo_exclusao = 'hard'
   AND r.restaurado = false
   AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = r.registro_id)
 ORDER BY r.excluido_em;

-- Trava: se o WHERE pegar muito mais do que o esperado, aborta sem apagar.
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n
    FROM public.registros_excluidos r
   WHERE r.tabela = 'empresas'
     AND r.tipo_exclusao = 'hard'
     AND r.restaurado = false
     AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = r.registro_id);

  IF n > 20 THEN
    RAISE EXCEPTION 'limpeza abortada: % fantasmas e muito mais que os 7 medidos — revise antes', n;
  END IF;
  RAISE NOTICE 'apagando % snapshot(s) fantasma', n;
END $$;

DELETE FROM public.registros_excluidos r
 WHERE r.tabela = 'empresas'
   AND r.tipo_exclusao = 'hard'
   AND r.restaurado = false
   AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = r.registro_id);

\echo == Depois: deve dar 0 ==
SELECT count(*) AS fantasmas_restantes
  FROM public.registros_excluidos r
 WHERE r.tabela = 'empresas'
   AND r.tipo_exclusao = 'hard'
   AND r.restaurado = false
   AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = r.registro_id);

\echo == Lixeira de empresas que sobrou (snapshots legitimos, empresa ja apagada) ==
SELECT count(*) AS snapshots_validos_de_empresas
  FROM public.registros_excluidos
 WHERE tabela = 'empresas' AND tipo_exclusao = 'hard' AND restaurado = false;

COMMIT;
