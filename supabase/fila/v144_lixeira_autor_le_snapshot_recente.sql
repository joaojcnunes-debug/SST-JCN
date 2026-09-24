-- ============================================================
-- v144 — Lixeira: a compensação da v143 precisava de leitura
-- ============================================================
-- A v143 criou a policy de DELETE para o autor desfazer o snapshot órfão, mas
-- ela não bastava: medido no banco em 2026-07-30, o autor recebia "DELETE 0",
-- sem erro nenhum.
--
-- Por quê: `DELETE ... WHERE id = ?` precisa LER a linha para achá-la, e aí as
-- policies de SELECT também se aplicam. A única que existia é
-- `admin read registros_excluidos` (`caller_eh_admin()`), então para quem não é
-- Admin a linha simplesmente não existe — o DELETE não acha nada e volta 0.
-- Foi exatamente o caso das duas usuárias que abriram o chamado.
--
-- Esta policy é o espelho exato da de DELETE da v143: mesmo autor, mesma janela
-- de 5 minutos, nunca snapshot restaurado. Não abre nada novo — o usuário lê o
-- snapshot do registro que ele mesmo acabou de tentar excluir, que já estava na
-- mão dele no navegador. A tela da Lixeira continua só para Admin
-- (`useRequireAdmin()` em app/(admin)/layout.tsx), então nada muda de visível.
--
-- Testado no banco real antes de virar arquivo: sem a policy, DELETE 0; com
-- ela, DELETE 1 (transação desfeita nos dois casos).
-- ============================================================

BEGIN;

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
    RAISE EXCEPTION 'v144: esperava as 2 policies do autor (ler + apagar), achei %', n;
  END IF;
END $$;

COMMIT;
