-- ============================================================
-- v143 — Lixeira: o autor pode apagar o snapshot que ficou órfão
-- ============================================================
-- Companheira do fix no `excluirComLixeira` (lib/hooks/useLixeira.ts).
--
-- O problema: o snapshot vai para `registros_excluidos` ANTES do DELETE. Se o
-- DELETE falhar (foi o caso das FKs sem cascata da v142), o snapshot fica para
-- trás — a Lixeira lista como "excluído" um registro que está vivo, e
-- "Restaurar" dá erro de chave duplicada. Em 2026-07-29 sobraram 7 assim.
--
-- Inverter a ordem (apagar primeiro, gravar o snapshot depois) resolveria o
-- fantasma, mas trocaria um defeito cosmético por risco de perder dado: se o
-- snapshot falhasse, o registro já estaria apagado sem cópia de recuperação.
-- Então o front passa a COMPENSAR: se o DELETE falhar, apaga o snapshot que
-- acabou de gravar. Só que `registros_excluidos` não tinha NENHUMA policy de
-- DELETE — a compensação não daria erro, simplesmente não apagaria nada.
--
-- Esta policy é o mínimo para a compensação funcionar, e nada além disso:
--   - só o AUTOR do snapshot (e-mail do JWT igual ao `excluido_por`);
--   - só nos 5 minutos seguintes (janela da própria tentativa que falhou);
--   - nunca um snapshot já restaurado.
-- Ninguém ganha o poder de esvaziar a Lixeira, nem de apagar snapshot alheio,
-- nem de apagar o snapshot antigo de uma exclusão que deu certo.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "autor apaga snapshot orfao" ON public.registros_excluidos;

CREATE POLICY "autor apaga snapshot orfao" ON public.registros_excluidos
  FOR DELETE TO authenticated
  USING (
    restaurado = false
    AND excluido_por IS NOT NULL
    AND (auth.jwt() ->> 'email') IS NOT NULL
    AND lower(excluido_por) = lower(auth.jwt() ->> 'email')
    AND excluido_em > now() - interval '5 minutes'
  );

-- Trava de sanidade: a policy tem de existir e ser de DELETE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'public.registros_excluidos'::regclass
       AND polname = 'autor apaga snapshot orfao'
       AND polcmd = 'd'
  ) THEN
    RAISE EXCEPTION 'v143: policy de DELETE nao ficou criada em registros_excluidos';
  END IF;
END $$;

COMMIT;
