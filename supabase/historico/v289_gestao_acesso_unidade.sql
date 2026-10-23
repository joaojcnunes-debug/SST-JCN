-- v289 (JCN) — Gestão: acesso por UNIDADE (além do setor/quadro)
-- Replicado do Painel SST (v294, v0.3.760), sem a trava de banco do painel, sem owner chabra_admin
-- e sem schema_migrations.
-- Diferença: gestao_unidades nasce de TODAS as unidades do JCN (o painel semeava as 6 da
-- Chabra) e um gatilho em unidades inclui as novas.
--
-- O QUE FAZ: gestao_unidades; id_unidade em gestao_quadros/gestao_tarefas (gatilho preenche);
-- gestao_membros.unidades (null/vazio = sem restrição, ninguém perde acesso); gestao_ve_tarefa:
-- o ramo 'nível total' passa a exigir a unidade da tarefa entre as do membro; RPC
-- gestao_definir_unidades (gestor, com log).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v289_*_rollback.sql

ALTER TYPE public.gestao_acao ADD VALUE IF NOT EXISTS 'alterou_unidades';

-- ── 1) Unidades da Gestão ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gestao_unidades (
  id_unidade text PRIMARY KEY REFERENCES public.unidades(id_unidade),
  nome       text NOT NULL,
  apelidos   text[] NOT NULL DEFAULT '{}',   -- normalizados (minúsculo, sem acento, sem hífen)
  ordem      int NOT NULL DEFAULT 0
);

ALTER TABLE public.gestao_unidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gestao_unidades FROM anon, authenticated, public;
GRANT SELECT ON public.gestao_unidades TO authenticated;
GRANT ALL ON public.gestao_unidades TO service_role;
DROP POLICY IF EXISTS gestao_unidades_sel ON public.gestao_unidades;
CREATE POLICY gestao_unidades_sel ON public.gestao_unidades FOR SELECT TO authenticated
  USING (public.gestao_papel_de(public.gestao_email()) IS NOT NULL);

-- Normaliza um texto de etiqueta/nome: minúsculo, sem acento, hífen/_ → espaço, espaços colapsados.
CREATE OR REPLACE FUNCTION public.gestao_norm_unidade(p text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(trim(regexp_replace(translate(lower(coalesce(p,'')),
    'áàâãäéèêëíìîïóòôõöúùûüç-_', 'aaaaaeeeeiiiiooooouuuuc  '), '\s+', ' ', 'g')), '');
$$;

-- JCN: as unidades da Gestão são as unidades cadastradas (o painel semeava as 6 da Chabra pelo
-- sgg_base_sgg). Apelido = nome normalizado, para reconhecer a etiqueta da região.
INSERT INTO public.gestao_unidades (id_unidade, nome, apelidos, ordem)
SELECT u.id_unidade, u.nome, ARRAY[public.gestao_norm_unidade(u.nome)],
       row_number() OVER (ORDER BY u.nome)::int
  FROM public.unidades u
 WHERE public.gestao_norm_unidade(u.nome) IS NOT NULL
ON CONFLICT (id_unidade) DO NOTHING;

-- JCN: unidade nova no cadastro entra na Gestão sozinha (no painel as 6 são fixas).
CREATE OR REPLACE FUNCTION public.gestao_unidade_nova_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.gestao_norm_unidade(new.nome) IS NOT NULL THEN
    INSERT INTO public.gestao_unidades (id_unidade, nome, apelidos, ordem)
    VALUES (new.id_unidade, new.nome, ARRAY[public.gestao_norm_unidade(new.nome)],
            coalesce((SELECT max(ordem) FROM public.gestao_unidades), 0) + 1)
    ON CONFLICT (id_unidade) DO NOTHING;
  END IF;
  RETURN null;
END $$;
REVOKE ALL ON FUNCTION public.gestao_unidade_nova_trg() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_gestao_unidade_nova ON public.unidades;
CREATE TRIGGER trg_gestao_unidade_nova AFTER INSERT ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.gestao_unidade_nova_trg();

-- Unidade pelas etiquetas: só quando UMA unidade bate (duas regiões diferentes → null).
CREATE OR REPLACE FUNCTION public.gestao_unidade_de_etiquetas(p_etiquetas text[]) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(DISTINCT gu.id_unidade) = 1 THEN min(gu.id_unidade) END
    FROM unnest(coalesce(p_etiquetas, '{}')) e
    JOIN public.gestao_unidades gu ON public.gestao_norm_unidade(e) = ANY (gu.apelidos);
$$;

-- ── 2) Colunas ──────────────────────────────────────────────────────────────────
ALTER TABLE public.gestao_quadros ADD COLUMN IF NOT EXISTS id_unidade text REFERENCES public.gestao_unidades(id_unidade);
ALTER TABLE public.gestao_tarefas ADD COLUMN IF NOT EXISTS id_unidade text REFERENCES public.gestao_unidades(id_unidade);
ALTER TABLE public.gestao_membros ADD COLUMN IF NOT EXISTS unidades text[];
CREATE INDEX IF NOT EXISTS idx_gestao_tarefas_unidade ON public.gestao_tarefas (id_unidade);

COMMENT ON COLUMN public.gestao_quadros.id_unidade IS 'v294: quadro de unidade (Teresópolis…). null = quadro de setor.';
COMMENT ON COLUMN public.gestao_tarefas.id_unidade IS 'v294: unidade da tarefa (trigger). null = empresa toda (visível a quem tem o setor).';
COMMENT ON COLUMN public.gestao_membros.unidades IS 'v294: unidades que o membro vê. null/vazio = sem restrição.';

-- Quadros de unidade: pelo nome (não pessoais). "Friburgo" → Nova Friburgo, "Campos" → Campos.
UPDATE public.gestao_quadros q SET id_unidade = gu.id_unidade
  FROM public.gestao_unidades gu
 WHERE q.dono_email IS NULL AND q.id_unidade IS NULL
   AND public.gestao_norm_unidade(q.nome) = ANY (gu.apelidos);

-- ── 3) Trigger: unidade da tarefa ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_tarefa_unidade_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q text; v_u text[];
BEGIN
  SELECT id_unidade INTO v_q FROM public.gestao_quadros WHERE id_quadro = new.id_quadro;
  -- Mudou para um quadro de unidade → passa a ser daquela unidade.
  IF tg_op = 'UPDATE' AND new.id_quadro IS DISTINCT FROM old.id_quadro AND v_q IS NOT NULL THEN
    new.id_unidade := v_q;
  END IF;
  IF new.id_unidade IS NULL THEN
    new.id_unidade := coalesce(v_q, public.gestao_unidade_de_etiquetas(new.etiquetas));
  END IF;
  -- Criada no painel por quem só tem UMA unidade → é daquela unidade.
  IF new.id_unidade IS NULL AND tg_op = 'INSERT' AND new.created_by IS NOT NULL THEN
    SELECT m.unidades INTO v_u FROM public.gestao_membros m
     WHERE lower(m.usuario_email) = lower(new.created_by) AND m.ativo;
    IF cardinality(v_u) = 1 THEN new.id_unidade := v_u[1]; END IF;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_gestao_tarefa_unidade ON public.gestao_tarefas;
CREATE TRIGGER trg_gestao_tarefa_unidade BEFORE INSERT OR UPDATE ON public.gestao_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.gestao_tarefa_unidade_trg();

-- ── 4) Backfill (sem Google/histórico/auditoria/automação) ──────────────────────
ALTER TABLE public.gestao_tarefas DISABLE TRIGGER gestao_google_tarefas_trg;
ALTER TABLE public.gestao_tarefas DISABLE TRIGGER gestao_tarefa_historico_trg;
ALTER TABLE public.gestao_tarefas DISABLE TRIGGER trg_auditoria;
ALTER TABLE public.gestao_tarefas DISABLE TRIGGER trg_gestao_automacao_upd;

UPDATE public.gestao_tarefas t
   SET id_unidade = coalesce(q.id_unidade, public.gestao_unidade_de_etiquetas(t.etiquetas))
  FROM public.gestao_quadros q
 WHERE q.id_quadro = t.id_quadro AND t.id_unidade IS NULL
   AND coalesce(q.id_unidade, public.gestao_unidade_de_etiquetas(t.etiquetas)) IS NOT NULL;

ALTER TABLE public.gestao_tarefas ENABLE TRIGGER gestao_google_tarefas_trg;
ALTER TABLE public.gestao_tarefas ENABLE TRIGGER gestao_tarefa_historico_trg;
ALTER TABLE public.gestao_tarefas ENABLE TRIGGER trg_auditoria;
ALTER TABLE public.gestao_tarefas ENABLE TRIGGER trg_gestao_automacao_upd;

-- ── 5) Visibilidade ─────────────────────────────────────────────────────────────
-- true = a unidade da tarefa não impede o e-mail de vê-la.
CREATE OR REPLACE FUNCTION public.gestao_unidade_ok(p_email text, p_id_tarefa text) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u text[]; v_t text;
BEGIN
  SELECT m.unidades INTO v_u FROM public.gestao_membros m
   WHERE lower(m.usuario_email) = lower(p_email) AND m.ativo;
  IF coalesce(cardinality(v_u), 0) = 0 THEN RETURN true; END IF;   -- sem restrição
  SELECT t.id_unidade INTO v_t FROM public.gestao_tarefas t WHERE t.id_tarefa = p_id_tarefa;
  RETURN v_t IS NULL OR v_t = ANY (v_u);                           -- sem unidade = empresa toda
END $$;
REVOKE EXECUTE ON FUNCTION public.gestao_unidade_ok(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gestao_unidade_ok(text, text) TO authenticated, service_role;

-- Igual à v235, só o ramo 4 ganha "and gestao_unidade_ok".
CREATE OR REPLACE FUNCTION public.gestao_ve_tarefa(p_id_tarefa text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  -- 1) sem e-mail no JWT -> nao ve
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;

  -- 2) gestor global (owner/admin; perfil=Admin vira owner) ve TODAS
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;

  -- 3) nao-membro (papel nulo) nao ve
  if v_papel is null then
    return false;
  end if;

  -- 4) gestor DO quadro/espaco da tarefa: nivel herdado 'full' (>=4). Membro de quadro
  --    ABERTO resolve 'edit' (3) e NAO passa aqui — e exatamente o ponto do flip.
  --    v294: e a unidade da tarefa precisa estar entre as do membro (sem unidades = todas).
  if public.gestao_nivel_ord(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     ) >= 4
     and public.gestao_unidade_ok(v_email, p_id_tarefa) then
    return true;
  end if;

  -- 4b) v235: supervisor de equipe ve as tarefas do MEU QUADRO dos membros que supervisiona
  --     (restrito a quadros com dono_email; NAO generaliza "edit ve tudo").
  if exists (
       select 1 from public.gestao_tarefas t
       join public.gestao_quadros q on q.id_quadro = t.id_quadro
       where t.id_tarefa = p_id_tarefa
         and q.dono_email is not null
         and coalesce(public.gestao_supervisiona(v_email, q.dono_email), false)
     ) then
    return true;
  end if;

  -- 5) grant explicito NAO-restritivo na PROPRIA tarefa (view/comment/edit/full)
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 6) vinculado (responsavel ou seguidor) a tarefa
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 7) criador da tarefa (created_by = e-mail do caller)
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;

  -- 7.5) responsavel de alguma subtarefa desta tarefa (alocar subtarefa -> ve a tarefa-mae)
  if exists (
       select 1 from public.gestao_subtarefas s
       where s.id_tarefa = p_id_tarefa
         and lower(s.responsavel_email) = v_email
     ) then
    return true;
  end if;

  -- 8) senao, nao ve
  return false;
end
$function$;

-- ── 6) RPC: gravar as unidades do membro (gestor) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_definir_unidades(p_alvo text, p_unidades text[], p_motivo text)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ator text := public.gestao_email(); v_log uuid; v_novas text[]; v_ant text[];
BEGIN
  IF length(trim(coalesce(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'motivo obrigatório (mínimo 5 caracteres)'; END IF;
  IF NOT coalesce(public.gestao_eh_gestor(v_ator), false) THEN RAISE EXCEPTION 'apenas Owner/Admin definem unidades'; END IF;
  -- Só ids válidos, sem repetição, na ordem da tabela. Vazio → null (sem restrição).
  SELECT array_agg(gu.id_unidade ORDER BY gu.ordem) INTO v_novas
    FROM public.gestao_unidades gu WHERE gu.id_unidade = ANY (coalesce(p_unidades, '{}'));
  SELECT unidades INTO v_ant FROM public.gestao_membros WHERE lower(usuario_email) = lower(p_alvo);
  IF NOT FOUND THEN RAISE EXCEPTION 'usuário não é membro da Gestão'; END IF;
  UPDATE public.gestao_membros SET unidades = v_novas WHERE lower(usuario_email) = lower(p_alvo);
  INSERT INTO public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
    VALUES (v_ator, p_alvo, 'alterou_unidades',
            p_motivo || ' [' || coalesce(array_to_string(v_ant, ','), 'todas') || ' → ' || coalesce(array_to_string(v_novas, ','), 'todas') || ']')
    RETURNING id INTO v_log;
  RETURN v_log;
END $$;
REVOKE EXECUTE ON FUNCTION public.gestao_definir_unidades(text, text[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gestao_definir_unidades(text, text[], text) TO authenticated;

VALUES ('v294_gestao_acesso_unidade')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
