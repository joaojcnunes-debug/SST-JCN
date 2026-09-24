-- V181 — separa os registros que traziam DOIS técnicos num campo só
--
-- ─── O que se mediu ────────────────────────────────────────────────────────
--
-- Em 15 inspeções dois técnicos se dividiram a visita e alguém escreveu os
-- dois nomes no mesmo campo de texto: "Nathan Ferreira e Elaine Maia",
-- "Nathalia Correa e Elaine Maia", e as mesmas duplas na ordem invertida.
--
-- O efeito é que NENHUM dos dois é contado direito: o dashboard credita só
-- quem abriu a inspeção no sistema, e o relatório imprime a frase inteira em
-- cima de uma única linha de assinatura.
--
-- A tabela `responsaveis` SEMPRE aceitou vários por inspeção (2 inspeções da
-- base já têm 2 linhas) — a multiplicidade sai de graça, o que faltava era
-- separar o que estava grudado.
--
-- ─── O que muda, e o que não muda ──────────────────────────────────────────
--
-- MUDA: a tabela "Responsáveis" do relatório dessas 15 inspeções passa a
--       mostrar duas linhas em vez de uma frase. E o dashboard passa a contar
--       a inspeção para os dois técnicos.
-- NÃO MUDA: a grafia. Cada nome é gravado exatamente como foi digitado
--       ("Elaine Maia" continua "Elaine Maia"); quem traduz para o nome do
--       cadastro é o código, na hora de contar — decisão do Sanmyo em 25/08.
--
-- ⚠️ A folha de ASSINATURAS imprime só o primeiro responsável (`slice(0,1)`,
--    decisão dele em 25/08: "só o primeiro mesmo"). Então nessas 15 o segundo
--    técnico deixa de aparecer na assinatura, onde hoje aparece dentro da
--    frase. Foi decidido sabendo disso.
--
-- Reversível: `scripts/sql/v181_responsaveis_separa_duplas_rollback.sql`.

-- 1) Rede de segurança: o estado exato de antes, guardado.
CREATE TABLE IF NOT EXISTS backup_v181_responsaveis_duplas AS
SELECT * FROM responsaveis WHERE tecnico_responsavel ~ ' e ';

-- 2) O SEGUNDO técnico ganha a sua própria linha.
--
--    `recepcionado_por` e `cargo` ficam nulos de propósito: houve UMA recepção
--    na portaria, não duas. Repetir o nome do recepcionista faria o relatório
--    parecer que o cliente recebeu a equipe duas vezes.
--
--    O id é derivado do id de origem (md5 determinístico, não `random()`), para
--    que o rollback saiba exatamente quais linhas ele mesmo criou.
INSERT INTO responsaveis (
  id_responsavel, id_inspecao, id_empresa,
  tecnico_responsavel, recepcionado_por, cargo, data_hora
)
SELECT
  'RSP-' || upper(substring(md5(r.id_responsavel || '#v181') from 1 for 8)),
  r.id_inspecao,
  r.id_empresa,
  trim(split_part(r.tecnico_responsavel, ' e ', 2)),
  NULL,
  NULL,
  r.data_hora
FROM responsaveis r
WHERE r.tecnico_responsavel ~ ' e '
  AND trim(split_part(r.tecnico_responsavel, ' e ', 2)) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM responsaveis x
    WHERE x.id_responsavel =
      'RSP-' || upper(substring(md5(r.id_responsavel || '#v181') from 1 for 8))
  );

-- 3) A linha original fica só com o PRIMEIRO técnico — que é quem já assinava.
UPDATE responsaveis
SET tecnico_responsavel = trim(split_part(tecnico_responsavel, ' e ', 1))
WHERE tecnico_responsavel ~ ' e ';
