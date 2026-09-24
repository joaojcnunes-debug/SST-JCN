-- v225: Questionários Psicossociais ganham as 4 tabelas de GESTÃO do DRPS
-- (decisão do Sanmyo em 17/09/2026: "o relatório vai sair igual ao do DRPS").
--
-- O laudo do DRPS imprime o que estas telas gravam — Plano de Ação 5W2H, Plano
-- Anual de Medidas de Controle, Monitoramento do Desempenho e Revisão e Melhoria
-- Contínua. O QPS não tinha nenhuma. Este arquivo cria as 4 tabelas espelhando
-- as do DRPS (`drps_plano_acao_5w2h`, `drps_plano_medidas`, `drps_monitoramento`,
-- `drps_revisao`), com duas diferenças de desenho, de propósito:
--
--   • a chave do "tópico" é `id_categoria` (uuid de qps_categorias), não
--     `topico_idx` — no QPS as categorias variam por tipo de questionário;
--   • não há coluna `id_empresa`: o RLS passa pela aplicação-pai, como já fazem
--     `qps_probabilidades`, `qps_respondentes` e `qps_planos_acao` (v76).
--
-- Só CREATE TABLE (nada existente muda). Sem dado a migrar. `qps_planos_acao`
-- (plano simples, 0 linhas em produção em 17/09) fica como está — o DROP é
-- decisão à parte. Gatilho de auditoria ligado pelo `auditoria_ativar` (v212:
-- tabela nova não ganha gatilho sozinha). O PostgREST precisa recarregar o
-- schema (NOTIFY no fim).
--
-- ROLLBACK: scripts/sql/v225_qps_gestao_igual_drps.rollback.sql
BEGIN;

-- ── 1) Plano de Ação 5W2H ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qps_plano_acao_5w2h (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_aplicacao  uuid NOT NULL REFERENCES public.qps_aplicacoes(id_aplicacao) ON DELETE CASCADE,
  ordem         integer NOT NULL DEFAULT 0,
  acao          text,          -- O quê
  justificativa text,          -- Por quê
  onde          text,          -- Onde (setores separados por vírgula, como no DRPS)
  prazo         text,          -- Quando (meses separados por vírgula, como no DRPS)
  responsavel   text,          -- Quem
  como          text,          -- Como (catálogo + extras, por vírgula)
  quanto_custa  text,          -- Quanto custa
  status        text NOT NULL DEFAULT 'PENDENTE'
                CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_qps_plano_acao_5w2h_aplicacao
  ON public.qps_plano_acao_5w2h (id_aplicacao, ordem);
COMMENT ON TABLE public.qps_plano_acao_5w2h IS
  'v225 — Plano de Ação 5W2H da aplicação do questionário (espelho de drps_plano_acao_5w2h).';

-- ── 2) Plano Anual de Medidas de Controle ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qps_plano_medidas (
  id_aplicacao  uuid NOT NULL REFERENCES public.qps_aplicacoes(id_aplicacao) ON DELETE CASCADE,
  ano           smallint NOT NULL,
  plano         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "<programa>": { meses: bool[12], responsavel } }
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_aplicacao, ano)
);
COMMENT ON TABLE public.qps_plano_medidas IS
  'v225 — calendário anual dos programas de medidas de controle (espelho de drps_plano_medidas).';

-- ── 3) Monitoramento do Desempenho (setor × categoria) ──────────────────────
CREATE TABLE IF NOT EXISTS public.qps_monitoramento (
  id_aplicacao      uuid NOT NULL REFERENCES public.qps_aplicacoes(id_aplicacao) ON DELETE CASCADE,
  setor             text NOT NULL,
  id_categoria      uuid NOT NULL REFERENCES public.qps_categorias(id_categoria) ON DELETE CASCADE,
  data_intervencao  date,
  responsavel       text,
  status            text NOT NULL DEFAULT 'Pendente'
                    CHECK (status IN ('Pendente', 'Em Andamento', 'Concluido', 'Cancelado')),
  proxima_avaliacao date,
  observacoes       text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_aplicacao, setor, id_categoria)
);
CREATE INDEX IF NOT EXISTS idx_qps_monitoramento_categoria
  ON public.qps_monitoramento (id_categoria);
COMMENT ON TABLE public.qps_monitoramento IS
  'v225 — acompanhamento por setor × categoria (espelho de drps_monitoramento; topico_idx → id_categoria).';

-- ── 4) Revisão e Melhoria Contínua ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qps_revisao (
  id_aplicacao  uuid PRIMARY KEY REFERENCES public.qps_aplicacoes(id_aplicacao) ON DELETE CASCADE,
  checklist     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "<id da ação obrigatória>": bool }
  equipe        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "<id do papel>": bool }
  anotacoes     text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.qps_revisao IS
  'v225 — checklist de revisão e equipe multidisciplinar (espelho de drps_revisao).';

-- ── 5) RLS — herança da aplicação-pai, igual às outras filhas do QPS ────────
-- Uma policy de SELECT para quem vê a empresa e uma de escrita para quem edita.
-- Grants explícitos (os default privileges cobrem, mas sem eles o PostgREST
-- devolve 401 mesmo com a policy certa — v148).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['qps_plano_acao_5w2h', 'qps_plano_medidas', 'qps_monitoramento', 'qps_revisao'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_sel_uni', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.qps_aplicacoes par
         WHERE par.id_aplicacao = %I.id_aplicacao
           AND caller_pode_ver_empresa(par.id_empresa)))
    $p$, t || '_sel_uni', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_rw_uni', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (caller_pode_editar() AND EXISTS (
        SELECT 1 FROM public.qps_aplicacoes par
         WHERE par.id_aplicacao = %I.id_aplicacao
           AND caller_pode_ver_empresa(par.id_empresa)))
      WITH CHECK (caller_pode_editar() AND EXISTS (
        SELECT 1 FROM public.qps_aplicacoes par
         WHERE par.id_aplicacao = %I.id_aplicacao
           AND caller_pode_ver_empresa(par.id_empresa)))
    $p$, t || '_rw_uni', t, t, t);

    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);

    -- v212: toda movimentação vai para auditoria_eventos (módulo por prefixo qps_).
    PERFORM public.auditoria_ativar(t);
  END LOOP;
END $$;


COMMIT;

NOTIFY pgrst, 'reload schema';
