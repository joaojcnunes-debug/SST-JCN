-- V179 — Textos padrão do módulo "Plano de Ação"
--
-- O Plano de Ação 5W2H (tabela `acoes_5w2h`) ganhou PDF próprio, gerado a
-- partir da tela /acoes por empresa. Como os demais laudos, ele é montado
-- com capítulos editáveis vindos de `textos_padrao` — daí o novo valor no
-- discriminador `modulo`.
--
-- Só amplia o CHECK: nenhuma linha existente muda de significado, e o módulo
-- nasce sem capítulos (o template desenha capa/identificação/tabela/assinatura
-- por conta própria quando não há nada cadastrado).

ALTER TABLE textos_padrao
  DROP CONSTRAINT IF EXISTS textos_padrao_modulo_check;

ALTER TABLE textos_padrao
  ADD CONSTRAINT textos_padrao_modulo_check
  CHECK (modulo IN (
    'sst', 'conformidade', 'nao_conformidade',
    'analise_quimicos', 'apreciacao_maquinas',
    'aep', 'aet', 'psicossocial', 'plano_acao'
  ));
