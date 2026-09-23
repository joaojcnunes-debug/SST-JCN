-- ============================================================
-- v147 (JCN) — Lixeira: o autor pode desfazer o snapshot órfão
-- ============================================================
-- Reflete as v143 + v144 do painel-sst em UMA migration. Lá foram duas porque
-- a v143 (só o DELETE) não bastou e a v144 veio depois com a metade que
-- faltava; aqui já entram juntas, que é o estado que funciona.
--
-- Companheira do fix no `excluirComLixeira` (lib/hooks/useLixeira.ts).
--
-- O problema: o snapshot vai para `registros_excluidos` ANTES do DELETE. Se o
-- DELETE falhar (foi o caso das FKs sem cascata, corrigidas na v143 do JCN), o
-- snapshot fica para trás — a Lixeira lista como "excluído" um registro que
-- está vivo, e "Restaurar" dá erro de chave duplicada.
--
-- Inverter a ordem (apagar primeiro, gravar o snapshot depois) resolveria o
-- fantasma, mas trocaria um defeito cosmético por risco de perder dado: se o
-- snapshot falhasse, o registro já estaria apagado sem cópia de recuperação.
-- Então o front passa a COMPENSAR: se o DELETE falhar, apaga o snapshot que
-- acabou de gravar.
--
-- Para a compensação funcionar são precisas DUAS policies:
--   - DELETE: `registros_excluidos` não tinha nenhuma, então a compensação não
--     daria erro — simplesmente não apagaria nada;
--   - SELECT: `DELETE ... WHERE id = ?` precisa LER a linha para achá-la, e aí
--     valem as policies de SELECT. A única existente é `admin read
--     registros_excluidos`, então para quem não é Admin a linha "não existe" e
--     o DELETE volta 0, calado. Era esse o segundo tranco no painel.
--
-- As duas são o mínimo, e espelhadas uma na outra:
--   - só o AUTOR do snapshot (e-mail do JWT igual ao `excluido_por`);
--   - só nos 5 minutos seguintes (janela da própria tentativa que falhou);
--   - nunca um snapshot já restaurado.
-- Ninguém ganha o poder de esvaziar a Lixeira, nem de apagar ou ler snapshot
-- alheio, nem de mexer no snapshot antigo de uma exclusão que deu certo. A tela
-- da Lixeira segue só para Admin (`useRequireAdmin()` em app/(admin)/layout.tsx),
-- então nada muda de visível.
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

DROP POLICY IF EXISTS "autor le snapshot recente" ON public.registros_excluidos;

CREATE POLICY "autor le snapshot recente" ON public.registros_excluidos
  FOR SELECT TO authenticated
  USING (
    restaurado = false
    AND excluido_por IS NOT NULL
    AND (auth.jwt() ->> 'email') IS NOT NULL
    AND lower(excluido_por) = lower(auth.jwt() ->> 'email')
    AND excluido_em > now() - interval '5 minutes'
  );

-- Trava de sanidade: as duas metades (ler + apagar) têm de existir, senão a
-- compensação volta a falhar calada.
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n
    FROM pg_policy
   WHERE polrelid = 'public.registros_excluidos'::regclass
     AND polname IN ('autor le snapshot recente', 'autor apaga snapshot orfao')
     AND polcmd IN ('r', 'd');

  IF n <> 2 THEN
    RAISE EXCEPTION 'v147: esperava as 2 policies do autor (ler + apagar), achei %', n;
  END IF;
END $$;

COMMIT;
