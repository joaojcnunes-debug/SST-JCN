"use client";

import { useEffect, useState, use } from "react";
import {
  Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, X, Camera, Sparkles, Brain,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  useAetRelatorio,
  useSalvarAet,
  setorVazio,
  useAetOwasConfig,
  useAetOwasSelects,
  useAetChecklistPerguntas,
  useAetPerfisOwas,
  SLUG_TO_DEFAULT_IMAGE,
  SLUG_TO_OWAS_FIELD,
  CHECKLIST_PERGUNTAS_PADRAO,
  useAet13FatoresConfig,
  useAet13FatoresPerguntas,
  useAet13FatoresSemaforo,
  useAetLaudoQpsMeta,
  useAetSalvarQpsMeta,
  useAetLaudoFatoresPsi,
  useAetSalvarFatorPsi,
  useAetQpsRespostas,
  useAetSalvarRespostasFator,
  zonaFromMedia,
  nivelPgrFromZona,
  SEMAFORO_DEFAULT,
} from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type {
  AetSetor,
  AetRisco,
  AetCargo,
  AetChecklist,
  AetOwas,
  AetOwasCategoria,
  RespostaChecklist,
  TipoRiscoAET,
  ClassificacaoRiscoAET,
  Aet13FatorPergunta,
  AetLaudoQpsMeta,
  AetLaudoQpsResposta,
  ZonaPsi,
} from "@/lib/supabase/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS_RISCO: TipoRiscoAET[] = ["Acidentes", "Ergonômico", "Físico", "Químico", "Biológico"];
const CLASSIFICACOES: ClassificacaoRiscoAET[] = ["Trivial", "De Atenção", "Moderado", "Alto", "Crítico"];
const CLASS_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

const SLUGS_PADRAO = new Set([
  "levantamento_acima_limite", "trabalho_predominante", "pausas_descanso",
  "uso_cadeira", "cadeira_adequada", "monitor", "organizacao_trabalho",
  "exigencia_levantamento", "ritmo_por_demanda", "pausas_formais", "rodizios_sistematizados",
]);

const FORMAS_COLETA = [
  "Presencial — papel",
  "Presencial — tablet/digital",
  "Híbrido (parte presencial, parte digital)",
];

const ESCALA = [1, 2, 3, 4, 5] as const;
const ESCALA_LABEL: Record<number, string> = {
  1: "Nunca", 2: "Raramente", 3: "Às vezes", 4: "Frequentemente", 5: "Sempre",
};

const ZONA_LABEL: Record<ZonaPsi, string> = {
  verde: "Verde — Satisfatório",
  amarela: "Amarela — Atenção",
  laranja: "Laranja — Elevado",
  vermelha: "Vermelha — Crítico",
};

const ZONA_CLASS: Record<ZonaPsi, string> = {
  verde: "bg-green-100 text-green-800 border-green-300",
  amarela: "bg-yellow-100 text-yellow-800 border-yellow-300",
  laranja: "bg-orange-100 text-orange-800 border-orange-300",
  vermelha: "bg-red-100 text-red-800 border-red-300",
};

const ZONA_DOT: Record<ZonaPsi, string> = {
  verde: "bg-green-500",
  amarela: "bg-yellow-400",
  laranja: "bg-orange-500",
  vermelha: "bg-red-600",
};

const ZONA_BORDER_L: Record<ZonaPsi, string> = {
  verde: "#22c55e",
  amarela: "#eab308",
  laranja: "#f97316",
  vermelha: "#ef4444",
};

// ─── PSI Helpers ──────────────────────────────────────────────────────────────

function rKey(idSetor: string, codigoFator: string, ordem: number) {
  return `${idSetor}|${codigoFator}|${ordem}`;
}

function perguntaCriticaAuto(
  perguntas: Aet13FatorPergunta[],
  localRespostas: Record<string, number>,
  idSetor: string,
  codigoFator: string
): string | null {
  const pFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
  let worstScore = Infinity;
  let worstTexto: string | null = null;
  for (const p of pFator) {
    const r = localRespostas[rKey(idSetor, codigoFator, p.ordem)];
    if (r == null) continue;
    const score = p.logica === "direta" ? 6 - r : r;
    if (score < worstScore) { worstScore = score; worstTexto = p.texto; }
  }
  return worstTexto;
}

function calcularMediaFator(
  perguntas: Aet13FatorPergunta[],
  localRespostas: Record<string, number>,
  idSetor: string,
  codigoFator: string
): number | null {
  const pFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
  if (pFator.length === 0) return null;
  const scores: number[] = [];
  for (const p of pFator) {
    const r = localRespostas[rKey(idSetor, codigoFator, p.ordem)];
    if (r == null) continue;
    scores.push(p.logica === "direta" ? 6 - r : r);
  }
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetSetoresPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();

  // OWAS / Checklist config
  const { data: owasConfig = [] } = useAetOwasConfig();
  const { data: perfisOwas = [] } = useAetPerfisOwas();
  const { data: owasSelects = [] } = useAetOwasSelects();
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();

  // PSI config + dados do laudo
  const { data: fatores = [] } = useAet13FatoresConfig();
  const { data: perguntas = [] } = useAet13FatoresPerguntas();
  const { data: semaforo = SEMAFORO_DEFAULT } = useAet13FatoresSemaforo();
  const { data: qpsMeta } = useAetLaudoQpsMeta(idRelatorio);
  const { data: fatoresPsi = [] } = useAetLaudoFatoresPsi(idRelatorio);
  const { data: respostasDB = [] } = useAetQpsRespostas(idRelatorio);
  const salvarMeta = useAetSalvarQpsMeta();
  const salvarFatorPsi = useAetSalvarFatorPsi();
  const salvarRespostas = useAetSalvarRespostasFator();

  // ─── State ────────────────────────────────────────────────────────────────

  const [setores, setSetores] = useState<AetSetor[]>([]);
  // Setor accordion: Set de IDs abertos
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [gerandoIA, setGerandoIA] = useState<string | null>(null);

  // PSI: fator cards — chave `${setorId}:${codigoFator}`
  const [abertosFactores, setAbertosFactores] = useState<Record<string, boolean>>({});
  // QPS meta form visível
  const [metaAberta, setMetaAberta] = useState(false);

  const [localRespostas, setLocalRespostas] = useState<Record<string, number>>({});
  // Keyed por codigoFator — limitação do schema (sem id_setor na tabela)
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [perguntasCriticas, setPerguntasCriticas] = useState<Record<string, string>>({});
  const [zonasManuais, setZonasManuais] = useState<Record<string, ZonaPsi | null>>({});
  const [salvandoFatorPsiKey, setSalvandoFatorPsiKey] = useState<string | null>(null);
  const [gerandoObsIA, setGerandoObsIA] = useState<string | null>(null);
  const [consideracoes, setConsideracoes] = useState("");

  const [meta, setMeta] = useState<Omit<AetLaudoQpsMeta, "updated_at">>({
    id_relatorio: idRelatorio,
    n_respondentes: null,
    total_elegivel: null,
    periodo_inicio: null,
    periodo_fim: null,
    modo_aplicacao: null,
    tecnico_aplicador: null,
    observacao_geral: null,
  });

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (rel) {
      setSetores(rel.setores ?? []);
      if (rel.setores?.length) setAbertos(new Set([rel.setores[0].id]));
      setConsideracoes(rel.consideracoes_finais ?? "");
    }
  }, [rel]);

  useEffect(() => {
    if (qpsMeta) {
      setMeta({
        id_relatorio: idRelatorio,
        n_respondentes: qpsMeta.n_respondentes,
        total_elegivel: qpsMeta.total_elegivel,
        periodo_inicio: qpsMeta.periodo_inicio,
        periodo_fim: qpsMeta.periodo_fim,
        modo_aplicacao: qpsMeta.modo_aplicacao,
        tecnico_aplicador: qpsMeta.tecnico_aplicador,
        observacao_geral: qpsMeta.observacao_geral,
      });
    }
  }, [qpsMeta, idRelatorio]);

  useEffect(() => {
    if (respostasDB.length === 0) return;
    setLocalRespostas((prev) => {
      const next = { ...prev };
      for (const r of respostasDB) {
        next[rKey(r.id_setor, r.codigo_fator, r.pergunta_ordem)] = r.resposta;
      }
      return next;
    });
  }, [respostasDB]);

  // Auto-fill pergunta crítica para setores abertos
  useEffect(() => {
    if (perguntas.length === 0 || abertos.size === 0) return;
    setPerguntasCriticas((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const setorId of Array.from(abertos)) {
        for (const fator of fatores) {
          if (fator.codigo === "F13") continue;
          if (prev[fator.codigo]) continue;
          const auto = perguntaCriticaAuto(perguntas, localRespostas, setorId, fator.codigo);
          if (auto) { next[fator.codigo] = auto; changed = true; }
        }
      }
      return changed ? next : prev;
    });
  }, [localRespostas, abertos, fatores, perguntas]);

  useEffect(() => {
    const obs: Record<string, string> = {};
    const pc: Record<string, string> = {};
    const zm: Record<string, ZonaPsi | null> = {};
    for (const fp of fatoresPsi) {
      obs[fp.codigo_fator] = fp.observacao ?? "";
      pc[fp.codigo_fator] = fp.pergunta_critica ?? "";
      if (fp.codigo_fator === "F13") zm[fp.codigo_fator] = fp.zona ?? null;
    }
    setObservacoes(obs);
    setPerguntasCriticas(pc);
    setZonasManuais(zm);
  }, [fatoresPsi]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const selectOpts = (slug: string): string[] =>
    owasSelects.find((s) => s.slug === slug)?.opcoes ?? [];

  const pergunta = (slug: string) =>
    checklistPerguntas.find((p) => p.slug === slug)?.label ??
    CHECKLIST_PERGUNTAS_PADRAO.find((p) => p.slug === slug)?.label ?? "";

  const perguntasCustomDaSecao = (secao: string) =>
    checklistPerguntas.filter(
      (p) => p.secao === secao && !SLUGS_PADRAO.has(p.slug) && p.tipo === "tristate"
    );

  const adesaoPct =
    meta.n_respondentes && meta.total_elegivel && meta.total_elegivel > 0
      ? Math.round((meta.n_respondentes / meta.total_elegivel) * 100)
      : null;

  // ─── Mutators — Setores ───────────────────────────────────────────────────

  function toggle(id: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addSetor() {
    const novo = setorVazio();
    setSetores((s) => [...s, novo]);
    setAbertos((prev) => new Set([...prev, novo.id]));
  }

  function removeSetor(id: string) {
    setSetores((s) => s.filter((x) => x.id !== id));
  }

  function updateSetor(id: string, patch: Partial<AetSetor>) {
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addRisco(setorId: string) {
    const risco: AetRisco = {
      id: crypto.randomUUID(),
      tipo: "Acidentes",
      risco: "",
      intensidade_concentracao: "N/A",
      tecnica_metodologia: "Qualitativa",
      epi_ca: "N/A",
      epi_eficaz: "N/A",
      classificacao_risco: "Moderado",
    };
    updateSetor(setorId, {
      riscos: [...(setores.find((s) => s.id === setorId)?.riscos ?? []), risco],
    });
  }

  function removeRisco(setorId: string, riscoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { riscos: setor.riscos.filter((r) => r.id !== riscoId) });
  }

  function updateRisco(setorId: string, riscoId: string, patch: Partial<AetRisco>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, {
      riscos: setor.riscos.map((r) => (r.id === riscoId ? { ...r, ...patch } : r)),
    });
  }

  function toggleOwas(setorId: string, field: keyof AetOwas, value: number) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const current = setor.owas[field] as number[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateSetor(setorId, { owas: { ...setor.owas, [field]: next } as AetOwas });
  }

  function updateChecklist(setorId: string, patch: Partial<AetChecklist>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { checklist: { ...setor.checklist, ...patch } });
  }

  function updateRespostaExtra(setorId: string, slug: string, value: RespostaChecklist) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { respostas_extras: { ...(setor.respostas_extras ?? {}), [slug]: value } });
  }

  function aplicarPerfil(setorId: string, perfilId: string) {
    const perfil = perfisOwas.find((p) => p.id === perfilId);
    if (!perfil) return;
    updateSetor(setorId, {
      owas: {
        posturas_costas: perfil.posturas_costas,
        posturas_bracos: perfil.posturas_bracos,
        posturas_pernas: perfil.posturas_pernas,
        esforco: perfil.esforco,
      },
    });
  }

  async function addFoto(setorId: string, file: File) {
    if (uploadingFoto) return;
    setUploadingFoto(setorId);
    const loadId = toast.loading("Enviando foto...");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `aet-setores/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("URL pública não retornada");
      const setor = setores.find((s) => s.id === setorId);
      if (!setor) return;
      updateSetor(setorId, { fotos: [...(setor.fotos ?? []), pub.publicUrl] });
      toast.success("Foto adicionada", { id: loadId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload", { id: loadId });
    } finally {
      setUploadingFoto(null);
    }
  }

  function removeFoto(setorId: string, url: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { fotos: (setor.fotos ?? []).filter((f) => f !== url) });
  }

  async function gerarTextoIA(
    setorId: string,
    campo: "parecer_tecnico" | "recomendacoes" | "demais_condicoes"
  ) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const key = `${setorId}:${campo}`;
    setGerandoIA(key);
    try {
      const sb = createSupabaseBrowserClient();
      const empresa = rel?.empresas as { nome_empresa?: string } | null;
      const { data, error } = await sb.functions.invoke("gerar-analise-setor-aet-ia", {
        body: {
          campo,
          empresa_nome: empresa?.nome_empresa ?? null,
          setor_nome: setor.nome_setor || "Setor",
          cargos: setor.cargos.map((c) => c.nome).filter(Boolean),
          descricao_atividade: setor.descricao_atividade ?? null,
          maquinas_equipamentos: setor.maquinas_equipamentos ?? null,
          riscos: setor.riscos.map((r) => ({
            tipo: r.tipo,
            risco: r.risco,
            classificacao: r.classificacao_risco,
            intensidade: r.intensidade_concentracao ?? null,
          })),
          checklist: setor.checklist as unknown as Record<string, string>,
          textoAtual: (setor[campo] as string) || null,
        },
      });
      if (error) {
        let msg = (error as { message?: string })?.message ?? "Erro desconhecido";
        try {
          const ctx = (error as { context?: Response })?.context;
          if (ctx) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch { /* ignora */ }
        toast.error(`IA: ${msg}`);
        return;
      }
      const texto: string = data?.data?.texto ?? data?.texto ?? "";
      if (!texto) { toast.error("IA não retornou texto"); return; }
      updateSetor(setorId, { [campo]: texto });
    } catch (err) {
      toast.error(`IA: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGerandoIA(null);
    }
  }

  function handleSave() {
    salvar.mutate(
      { id: idRelatorio, patch: { setores } },
      {
        onSuccess: () => toast.success("Salvo com sucesso"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  function handleSalvarConsideracoes() {
    salvar.mutate(
      { id: idRelatorio, patch: { consideracoes_finais: consideracoes } },
      {
        onSuccess: () => toast.success("Considerações salvas"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  // ─── Mutators — PSI ───────────────────────────────────────────────────────

  function toggleAbertosFactores(setorId: string, codigoFator: string) {
    const key = `${setorId}:${codigoFator}`;
    setAbertosFactores((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSalvarMeta() {
    try {
      await salvarMeta.mutateAsync(meta);
    } catch {
      // handled in hook
    }
  }

  function handleResposta(setorId: string, codigoFator: string, perguntaOrdem: number, value: number) {
    setLocalRespostas((prev) => ({
      ...prev,
      [rKey(setorId, codigoFator, perguntaOrdem)]: value,
    }));
  }

  async function handleSalvarFator(setorId: string, codigoFator: string) {
    const isF13 = codigoFator === "F13";
    const perguntasFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
    const rows: AetLaudoQpsResposta[] = perguntasFator
      .map((p) => {
        const resposta = localRespostas[rKey(setorId, codigoFator, p.ordem)];
        if (resposta == null) return null;
        return {
          id_relatorio: idRelatorio,
          id_setor: setorId,
          codigo_fator: codigoFator,
          pergunta_ordem: p.ordem,
          resposta,
        };
      })
      .filter((r): r is AetLaudoQpsResposta => r !== null);

    const mediaCalc = isF13
      ? null
      : calcularMediaFator(perguntas, localRespostas, setorId, codigoFator);
    const zona = isF13 ? (zonasManuais[codigoFator] ?? null) : zonaFromMedia(mediaCalc);

    const fatorKey = `${setorId}:${codigoFator}`;
    setSalvandoFatorPsiKey(fatorKey);
    try {
      await Promise.all([
        rows.length > 0 ? salvarRespostas.mutateAsync(rows) : Promise.resolve(),
        salvarFatorPsi.mutateAsync({
          id_relatorio: idRelatorio,
          codigo_fator: codigoFator,
          avaliado: true,
          media: mediaCalc,
          pct_zona_risco: null,
          pergunta_critica: perguntasCriticas[codigoFator] || null,
          observacao: observacoes[codigoFator] || null,
          zona,
        }),
      ]);
      toast.success(`Fator ${codigoFator} salvo`);
    } catch {
      // handled in hooks
    } finally {
      setSalvandoFatorPsiKey(null);
    }
  }

  async function gerarObsIA(setorId: string, codigoFator: string) {
    const fatorObj = fatores.find((f) => f.codigo === codigoFator);
    if (!fatorObj) return;
    const setorObj = setores.find((s) => s.id === setorId);
    const mediaCalc = calcularMediaFator(perguntas, localRespostas, setorId, codigoFator);
    const zona = zonaFromMedia(mediaCalc);
    const fatorKey = `${setorId}:${codigoFator}`;
    setGerandoObsIA(fatorKey);
    try {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.functions.invoke("gerar-observacao-psi-ia", {
        body: {
          empresa: rel?.empresas && "nome_empresa" in (rel.empresas as object)
            ? { nome: (rel.empresas as { nome_empresa: string }).nome_empresa }
            : null,
          setor: { nome: setorObj?.nome_setor ?? "Setor" },
          fator: { codigo: codigoFator, nome: fatorObj.nome, descricao: fatorObj.descricao },
          media: mediaCalc,
          zona,
          nivel_pgr: nivelPgrFromZona(zona),
          pergunta_critica: perguntasCriticas[codigoFator] || null,
          textoAtual: observacoes[codigoFator] || null,
        },
      });
      if (error) throw error;
      const obs = data?.data?.observacao ?? data?.observacao ?? "";
      if (obs) setObservacoes((prev) => ({ ...prev, [codigoFator]: obs }));
      else toast.error("IA não retornou texto");
    } catch {
      toast.error("Erro ao gerar com IA");
    } finally {
      setGerandoObsIA(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Setores / Riscos</h1>
          <p className="text-xs text-gray-500">Seções 9 e 13 — agentes ambientais, OWAS, checklist, recomendações e 13 Fatores PSI por setor</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={addSetor}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="size-4" /> Setor
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={salvar.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Dados da Aplicação QPS (colapsável) ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMetaAberta((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="flex items-center gap-2">
            <Brain className="size-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">Dados da Aplicação QPS</span>
          </span>
          {metaAberta
            ? <ChevronUp className="size-4 text-gray-400" />
            : <ChevronDown className="size-4 text-gray-400" />}
        </button>

        {metaAberta && (
          <div className="border-t border-gray-100 px-5 pb-6 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">N.º de Respondentes</label>
                <input
                  type="number" min={0}
                  value={meta.n_respondentes ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, n_respondentes: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                  placeholder="ex: 42"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Total Elegível</label>
                <input
                  type="number" min={0}
                  value={meta.total_elegivel ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, total_elegivel: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                  placeholder="ex: 50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">% Adesão</label>
                <div className={cn(
                  "flex h-[38px] items-center rounded-md border px-3 text-sm font-semibold",
                  adesaoPct !== null
                    ? adesaoPct >= 70 ? "border-green-300 bg-green-50 text-green-700" : "border-yellow-300 bg-yellow-50 text-yellow-700"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                )}>
                  {adesaoPct !== null ? `${adesaoPct}%` : "—"}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Período — Início</label>
                <input
                  type="date"
                  value={meta.periodo_inicio ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, periodo_inicio: e.target.value || null }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Período — Fim</label>
                <input
                  type="date"
                  value={meta.periodo_fim ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, periodo_fim: e.target.value || null }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Forma de Coleta</label>
                <select
                  value={meta.modo_aplicacao ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, modo_aplicacao: e.target.value || null }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                >
                  <option value="">Selecione…</option>
                  {FORMAS_COLETA.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-xs font-medium text-gray-600">Técnico Aplicador</label>
                <input
                  type="text"
                  value={meta.tecnico_aplicador ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, tecnico_aplicador: e.target.value || null }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                  placeholder="Nome do técnico que conduziu a aplicação"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">Observação Geral</label>
              <textarea
                rows={2}
                value={meta.observacao_geral ?? ""}
                onChange={(e) => setMeta((m) => ({ ...m, observacao_geral: e.target.value || null }))}
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                placeholder="Contexto da aplicação, observações relevantes…"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSalvarMeta}
                disabled={salvarMeta.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {salvarMeta.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar Dados QPS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Setores ── */}
      {setores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          Nenhum setor adicionado. {canEdit && "Clique em \"+ Setor\" para começar."}
        </div>
      ) : (
        setores.map((setor, idx) => (
          <div key={setor.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <button
              type="button"
              onClick={() => toggle(setor.id)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="font-semibold text-gray-900">
                Setor {idx + 1}: {setor.nome_setor || <span className="italic text-gray-400">Sem nome</span>}
                {setor.cargos.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    — {setor.cargos.map((c) => c.nome).filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeSetor(setor.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeSetor(setor.id); } }}
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </span>
                )}
                {abertos.has(setor.id) ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
              </div>
            </button>

            {abertos.has(setor.id) && (
              <div className="border-t border-gray-100 px-5 pb-6 pt-4 space-y-6">

                {/* ── Dados do setor ── */}
                <div className="space-y-3">
                  <TextInput label="Nome do Setor" value={setor.nome_setor} disabled={!canEdit} onChange={(v) => updateSetor(setor.id, { nome_setor: v })} />
                  <CargoList cargos={setor.cargos} disabled={!canEdit} onChange={(v) => updateSetor(setor.id, { cargos: v })} />
                  <TagInput label="Máquinas e Equipamentos" value={setor.maquinas_equipamentos} disabled={!canEdit} onChange={(v) => updateSetor(setor.id, { maquinas_equipamentos: v })} />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Descrição Geral da Atividade</label>
                    <textarea
                      value={setor.descricao_atividade}
                      disabled={!canEdit}
                      rows={2}
                      onChange={(e) => updateSetor(setor.id, { descricao_atividade: e.target.value })}
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
                    />
                  </div>
                </div>

                {/* ── Riscos (Seção 9) ── */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Agentes / Riscos (Seção 9)</h3>
                    {canEdit && (
                      <button type="button" onClick={() => addRisco(setor.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        <Plus className="size-3" /> Risco
                      </button>
                    )}
                  </div>
                  {setor.riscos.length === 0 ? (
                    <p className="text-xs italic text-gray-400">Nenhum risco cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Tipo</th>
                            <th className="px-3 py-2 text-left font-medium">Risco</th>
                            <th className="px-3 py-2 text-left font-medium">Intensidade</th>
                            <th className="px-3 py-2 text-left font-medium">Técnica</th>
                            <th className="px-3 py-2 text-left font-medium">EPI CA</th>
                            <th className="px-3 py-2 text-left font-medium">EPI Eficaz</th>
                            <th className="px-3 py-2 text-center font-medium">Classificação</th>
                            {canEdit && <th className="px-3 py-2" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {setor.riscos.map((risco) => (
                            <tr key={risco.id}>
                              <td className="px-3 py-1.5">
                                <select value={risco.tipo} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { tipo: e.target.value as TipoRiscoAET })}
                                  className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs disabled:bg-gray-50">
                                  {TIPOS_RISCO.map((t) => <option key={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.risco} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { risco: e.target.value })}
                                  className="w-36 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.intensidade_concentracao} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { intensidade_concentracao: e.target.value })}
                                  className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.tecnica_metodologia} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { tecnica_metodologia: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.epi_ca} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { epi_ca: e.target.value })}
                                  className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.epi_eficaz} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { epi_eficaz: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <select value={risco.classificacao_risco} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { classificacao_risco: e.target.value as ClassificacaoRiscoAET })}
                                  className={cn("rounded border px-1.5 py-1 text-xs font-medium", CLASS_COLOR[risco.classificacao_risco])}>
                                  {CLASSIFICACOES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                              </td>
                              {canEdit && (
                                <td className="px-3 py-1.5">
                                  <button type="button" onClick={() => removeRisco(setor.id, risco.id)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Fotos do Setor ── */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Fotos do Setor (máx. 6)</h3>
                    {canEdit && (setor.fotos ?? []).length < 6 && (
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50",
                          uploadingFoto === setor.id && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {uploadingFoto === setor.id ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                        Adicionar Foto
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingFoto === setor.id}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFoto(setor.id, f); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                  {(setor.fotos ?? []).length === 0 ? (
                    <p className="text-xs italic text-gray-400">Nenhuma foto adicionada.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(setor.fotos ?? []).slice(0, 6).map((url, fIdx) => (
                        <div key={fIdx} className="group relative aspect-video overflow-hidden rounded-md border border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Foto ${fIdx + 1}`} className="h-full w-full object-cover" />
                          {canEdit && (
                            <button type="button" onClick={() => removeFoto(setor.id, url)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                              <X className="size-3" />
                            </button>
                          )}
                          <span className="absolute bottom-1 left-1 rounded bg-black/40 px-1 text-[10px] text-white">{fIdx + 1}/6</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── OWAS ── */}
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">OWAS — Análise de Posturas (Seção 13)</h3>
                  {canEdit && perfisOwas.length > 0 && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Aplicar perfil OWAS:</span>
                      <select defaultValue=""
                        onChange={(e) => { if (e.target.value) aplicarPerfil(setor.id, e.target.value); e.target.value = ""; }}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-verde-primary focus:outline-none">
                        <option value="" disabled>Selecionar perfil...</option>
                        {perfisOwas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                      <span className="text-[10px] text-gray-400">Preenche os campos abaixo</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {owasConfig.map((cat) => {
                      const field = SLUG_TO_OWAS_FIELD[cat.slug];
                      if (!field) return null;
                      return (
                        <OwasGroup key={cat.id} categoria={cat} selected={(setor.owas[field] ?? []) as number[]} disabled={!canEdit} onToggle={(v) => toggleOwas(setor.id, field, v)} />
                      );
                    })}
                  </div>
                </div>

                {/* ── Checklist ── */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Postura / Organização do Trabalho</h3>
                    <div className="flex gap-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider pr-1">
                      <span className="w-7 text-center">Sim</span>
                      <span className="w-7 text-center">Não</span>
                      <span className="w-7 text-center">N/A</span>
                    </div>
                  </div>
                  <TriStateRow label={pergunta("levantamento_acima_limite")} value={setor.checklist.levantamento_acima_limite} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { levantamento_acima_limite: v })} />
                  <div className="flex items-start gap-3">
                    <span className="flex-1 text-xs text-gray-700">{owasSelects.find((s) => s.slug === "trabalho_predominante")?.label ?? "O trabalho executado durante aos chamados decorrentes do dia-dia, são realizados preponderantemente de qual forma?"}</span>
                    <select value={setor.checklist.trabalho_predominante} disabled={!canEdit}
                      onChange={(e) => updateChecklist(setor.id, { trabalho_predominante: e.target.value as AetChecklist["trabalho_predominante"] })}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50">
                      {selectOpts("trabalho_predominante").map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <TriStateRow label={pergunta("pausas_descanso")} value={setor.checklist.pausas_descanso} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_descanso: v })} />
                  <TriStateRow label={pergunta("uso_cadeira")} value={setor.checklist.uso_cadeira} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { uso_cadeira: v })} />
                  <TriStateRow label={pergunta("cadeira_adequada")} value={setor.checklist.cadeira_adequada} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { cadeira_adequada: v })} />
                  <TriStateRow label={pergunta("monitor")} value={setor.checklist.monitor} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { monitor: v })} />
                  {perguntasCustomDaSecao("Postura").map((p) => (
                    <TriStateRow key={p.slug} label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                  ))}
                  <div className="mt-1 border-t border-gray-200 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Exigência de Tempo</p>
                    <TriStateRow label={pergunta("exigencia_levantamento")} value={setor.checklist.exigencia_levantamento} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { exigencia_levantamento: v })} />
                    {perguntasCustomDaSecao("Exigência de Tempo").map((p) => (
                      <TriStateRow key={p.slug} label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ritmo de Trabalho</p>
                    <TriStateRow label={pergunta("ritmo_por_demanda")} value={setor.checklist.ritmo_por_demanda} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { ritmo_por_demanda: v })} />
                    {perguntasCustomDaSecao("Ritmo de Trabalho").map((p) => (
                      <TriStateRow key={p.slug} label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Adoção de Rodízios — Ergonômico</p>
                    <TriStateRow label={pergunta("pausas_formais")} value={setor.checklist.pausas_formais} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_formais: v })} />
                    <div className="mt-2">
                      <TriStateRow label={pergunta("rodizios_sistematizados")} value={setor.checklist.rodizios_sistematizados} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { rodizios_sistematizados: v })} />
                    </div>
                    {perguntasCustomDaSecao("Adoção de Rodízios - Ergonômico").map((p) => (
                      <div key={p.slug} className="mt-2">
                        <TriStateRow label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Organização do Trabalho</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {checklistPerguntas.find((p) => p.slug === "organizacao_trabalho")?.label ??
                        "As normas de produção contemplando equipamentos, modo operatório, aspectos de segurança e qualidade deverão estar descritos nas instruções internas de trabalho, elaboradas pela empresa."}
                    </p>
                  </div>
                </div>

                {/* ── Parecer, Recomendações, Demais Condições ── */}
                <div className="space-y-4">
                  {(
                    [
                      { campo: "parecer_tecnico", label: "Parecer Técnico", placeholder: "Descreva o parecer técnico para este setor..." },
                      { campo: "recomendacoes", label: "Recomendações", placeholder: "Liste as recomendações para este setor..." },
                      { campo: "demais_condicoes", label: "Demais Condições Avaliadas", placeholder: "Descreva demais condições avaliadas..." },
                    ] as const
                  ).map(({ campo, label, placeholder }) => {
                    const key = `${setor.id}:${campo}`;
                    const gerando = gerandoIA === key;
                    return (
                      <div key={campo}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
                          {canEdit && (
                            <button type="button" onClick={() => gerarTextoIA(setor.id, campo)} disabled={!!gerandoIA}
                              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:cursor-not-allowed disabled:opacity-50">
                              {gerando ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                              {gerando ? "Gerando…" : "Gerar com IA"}
                            </button>
                          )}
                        </div>
                        <RichTextEditor value={setor[campo] as string} onChange={(html) => updateSetor(setor.id, { [campo]: html })} onBlur={() => {}} readOnly={!canEdit} uploadPathPrefix="aet-analise" placeholder={placeholder} />
                      </div>
                    );
                  })}
                </div>

                {/* ── 13 Fatores PSI ── */}
                {fatores.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 border-t border-gray-200 pt-4">
                      <Brain className="size-4 text-gray-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">13 Fatores Psicossociais (QPS)</h3>
                    </div>

                    <div className="space-y-2">
                      {fatores.map((fator) => {
                        const isF13 = fator.codigo === "F13";
                        const perguntasFator = perguntas.filter((p) => p.codigo_fator === fator.codigo);
                        const mediaCalc = isF13
                          ? null
                          : calcularMediaFator(perguntas, localRespostas, setor.id, fator.codigo);
                        const zonaCalc = isF13
                          ? (zonasManuais[fator.codigo] ?? null)
                          : zonaFromMedia(mediaCalc);
                        const prazoSem = semaforo.find((s) => s.id === zonaCalc);
                        const respondidas = perguntasFator.filter(
                          (p) => localRespostas[rKey(setor.id, fator.codigo, p.ordem)] != null
                        ).length;
                        const fatorKey = `${setor.id}:${fator.codigo}`;
                        const aberto = abertosFactores[fatorKey] ?? false;

                        return (
                          <div
                            key={fator.codigo}
                            className="overflow-hidden rounded-xl border bg-white shadow-sm"
                            style={zonaCalc ? { borderLeftWidth: 4, borderLeftColor: ZONA_BORDER_L[zonaCalc] } : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => toggleAbertosFactores(setor.id, fator.codigo)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left"
                            >
                              <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: "#006B54" }}>
                                {fator.codigo}
                              </span>
                              <span className="flex-1 text-sm font-semibold text-gray-900">{fator.nome}</span>
                              {!isF13 && (
                                <span className={cn("shrink-0 text-xs tabular-nums", respondidas === perguntasFator.length && perguntasFator.length > 0 ? "text-green-600 font-semibold" : "text-gray-400")}>
                                  {respondidas}/{perguntasFator.length}
                                </span>
                              )}
                              {!isF13 && mediaCalc !== null && (
                                <span className="shrink-0 font-mono text-sm font-bold text-gray-800">{mediaCalc.toFixed(2)}</span>
                              )}
                              {zonaCalc && (
                                <span className={cn("hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", ZONA_CLASS[zonaCalc])}>
                                  <span className={cn("size-1.5 rounded-full", ZONA_DOT[zonaCalc])} />
                                  {ZONA_LABEL[zonaCalc].split(" — ")[1]}
                                </span>
                              )}
                              {aberto ? <ChevronUp className="size-4 shrink-0 text-gray-400" /> : <ChevronDown className="size-4 shrink-0 text-gray-400" />}
                            </button>

                            {aberto && (
                              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-5">
                                <p className="text-xs text-gray-500 leading-relaxed">{fator.descricao}</p>

                                {isF13 ? (
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Classificação (baseada no PGR)</label>
                                    <select
                                      value={zonasManuais[fator.codigo] ?? ""}
                                      onChange={(e) => setZonasManuais((prev) => ({ ...prev, [fator.codigo]: (e.target.value as ZonaPsi) || null }))}
                                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                                    >
                                      <option value="">Selecione a zona…</option>
                                      {(["verde", "amarela", "laranja", "vermelha"] as ZonaPsi[]).map((z) => (
                                        <option key={z} value={z}>{ZONA_LABEL[z]}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Perguntas — clique para selecionar e salve ao final</p>
                                    {perguntasFator.map((p, i) => {
                                      const respostaAtual = localRespostas[rKey(setor.id, fator.codigo, p.ordem)] ?? null;
                                      return (
                                        <div key={p.id} className={cn("rounded-lg border p-3 transition-colors", respostaAtual !== null ? "border-gray-200 bg-gray-50" : "border-dashed border-gray-200 bg-white")}>
                                          <div className="mb-3 flex gap-2">
                                            <span className="shrink-0 font-mono text-[10px] text-gray-400 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                                            <p className="flex-1 text-xs leading-relaxed text-gray-700">{p.texto}</p>
                                            <span className={cn("shrink-0 self-start rounded px-1.5 py-0.5 text-[10px] font-medium", p.logica === "direta" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                                              {p.logica === "direta" ? "↑ D" : "↓ I"}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-5 gap-1.5">
                                            {ESCALA.map((v) => (
                                              <button key={v} type="button"
                                                onClick={() => handleResposta(setor.id, fator.codigo, p.ordem, v)}
                                                className={cn("flex flex-col items-center justify-center gap-0.5 rounded-lg border py-2 px-1 text-center transition-all",
                                                  respostaAtual === v ? "border-[#006B54] bg-[#006B54] text-white shadow-sm" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700")}>
                                                <span className={cn("text-[10px] font-bold tabular-nums", respostaAtual === v ? "text-white/70" : "text-gray-400")}>{v}</span>
                                                <span className="text-[10px] font-medium leading-tight">{ESCALA_LABEL[v]}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {!isF13 && mediaCalc !== null && (
                                  <div className={cn("flex items-center gap-4 rounded-lg border p-4", zonaCalc ? ZONA_CLASS[zonaCalc] : "border-gray-200 bg-gray-50 text-gray-700")}>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-0.5">Média calculada</p>
                                      <p className="text-2xl font-bold tabular-nums">{mediaCalc.toFixed(2)}</p>
                                    </div>
                                    {zonaCalc && (
                                      <div className="flex-1 border-l border-current/20 pl-4">
                                        <p className="text-sm font-bold">{ZONA_LABEL[zonaCalc]}</p>
                                        <p className="text-xs opacity-70">{nivelPgrFromZona(zonaCalc)} · Prazo: {prazoSem?.prazo_texto ?? "—"}</p>
                                      </div>
                                    )}
                                    <div className="text-xs opacity-60 text-right">
                                      <p className="font-semibold">{respondidas}/{perguntasFator.length}</p>
                                      <p>respondidas</p>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-3 border-t border-gray-100 pt-4">
                                  {!isF13 && (
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-gray-600">Pergunta Crítica</label>
                                      <textarea rows={2} value={perguntasCriticas[fator.codigo] ?? ""}
                                        onChange={(e) => setPerguntasCriticas((prev) => ({ ...prev, [fator.codigo]: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none resize-y"
                                        placeholder="Pergunta com pior score neste fator…" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <label className="text-xs font-medium text-gray-600">Observação / Análise</label>
                                      {!isF13 && (
                                        <button type="button" onClick={() => gerarObsIA(setor.id, fator.codigo)} disabled={gerandoObsIA === fatorKey}
                                          className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:cursor-not-allowed disabled:opacity-50">
                                          {gerandoObsIA === fatorKey ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                                          {gerandoObsIA === fatorKey ? "Gerando…" : "Gerar com IA"}
                                        </button>
                                      )}
                                    </div>
                                    <textarea rows={3} value={observacoes[fator.codigo] ?? ""}
                                      onChange={(e) => setObservacoes((prev) => ({ ...prev, [fator.codigo]: e.target.value }))}
                                      className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                                      placeholder="Análise, contexto e achados relevantes…" />
                                  </div>
                                  <div className="flex justify-end">
                                    <button type="button" onClick={() => handleSalvarFator(setor.id, fator.codigo)} disabled={salvandoFatorPsiKey === fatorKey}
                                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                      style={{ background: "#006B54" }}>
                                      {salvandoFatorPsiKey === fatorKey ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                      Salvar {fator.codigo}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Resumo do setor */}
                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <div className="border-b border-gray-100 px-4 py-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Resumo PSI — {setor.nome_setor || `Setor ${idx + 1}`}
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                              <th className="px-4 py-2">Cód.</th>
                              <th className="px-4 py-2">Fator</th>
                              <th className="px-4 py-2 text-center">Resp.</th>
                              <th className="px-4 py-2 text-center">Média</th>
                              <th className="px-4 py-2">Zona</th>
                              <th className="px-4 py-2">Nível PGR</th>
                              <th className="px-4 py-2">Prazo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {fatores.map((fator) => {
                              const isF13 = fator.codigo === "F13";
                              const perguntasFator = perguntas.filter((p) => p.codigo_fator === fator.codigo);
                              const mediaCalc = isF13 ? null : calcularMediaFator(perguntas, localRespostas, setor.id, fator.codigo);
                              const zonaCalc = isF13 ? (zonasManuais[fator.codigo] ?? null) : zonaFromMedia(mediaCalc);
                              const prazoSem = semaforo.find((s) => s.id === zonaCalc);
                              const respondidas = perguntasFator.filter((p) => localRespostas[rKey(setor.id, fator.codigo, p.ordem)] != null).length;
                              return (
                                <tr key={fator.codigo} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2">
                                    <span className="rounded px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: "#006B54" }}>{fator.codigo}</span>
                                  </td>
                                  <td className="px-4 py-2 font-medium text-gray-900 text-xs">{fator.nome}</td>
                                  <td className="px-4 py-2 text-center text-gray-600 tabular-nums text-xs">{isF13 ? "—" : `${respondidas}/${perguntasFator.length}`}</td>
                                  <td className="px-4 py-2 text-center font-mono font-bold text-gray-800 text-xs">{isF13 ? "—" : mediaCalc !== null ? mediaCalc.toFixed(2) : "—"}</td>
                                  <td className="px-4 py-2">
                                    {zonaCalc ? (
                                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold", ZONA_CLASS[zonaCalc])}>
                                        <span className={cn("size-1.5 rounded-full", ZONA_DOT[zonaCalc])} />
                                        {ZONA_LABEL[zonaCalc].split(" — ")[0]}
                                      </span>
                                    ) : <span className="text-gray-400 text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-2 text-gray-700 text-xs">{nivelPgrFromZona(zonaCalc)}</td>
                                  <td className="px-4 py-2 text-gray-600 text-xs">{prazoSem?.prazo_texto ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        ))
      )}

      {/* ── Considerações Finais (sempre o último) ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Considerações Finais</h3>
          <span className="text-xs text-gray-400">Seção 20 — Laudo AET</span>
        </div>
        <div className="px-5 pb-5 pt-4">
          {canEdit ? (
            <div className="space-y-3">
              <RichTextEditor
                value={consideracoes}
                onChange={setConsideracoes}
                placeholder="Insira as considerações finais do laudo..."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSalvarConsideracoes}
                  disabled={salvar.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
                >
                  {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar Considerações
                </button>
              </div>
            </div>
          ) : (
            consideracoes ? (
              <div
                className="prose prose-xs max-w-none text-xs leading-relaxed text-gray-700 [&_a]:text-gray-700 [&_a]:no-underline [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: consideracoes }}
              />
            ) : (
              <p className="text-xs italic text-gray-400">Sem considerações finais registradas.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OwasGroup ────────────────────────────────────────────────────────────────

function OwasGroup({
  categoria, selected, disabled, onToggle,
}: {
  categoria: AetOwasCategoria;
  selected: number[];
  disabled: boolean;
  onToggle: (v: number) => void;
}) {
  const imageSrc = categoria.imagem_url ?? SLUG_TO_DEFAULT_IMAGE[categoria.slug];
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">{categoria.titulo}</h4>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          {categoria.opcoes.map((opt) => (
            <label key={opt.value} className={cn("flex items-center gap-2 text-xs text-gray-700", disabled && "cursor-not-allowed opacity-60")}>
              <input type="checkbox" checked={selected.includes(opt.value)} disabled={disabled} onChange={() => onToggle(opt.value)}
                className="size-3.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary" />
              {opt.label}
            </label>
          ))}
        </div>
        {imageSrc && (
          <div className="w-36 shrink-0 self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt={`Referência OWAS: ${categoria.titulo}`} className="h-auto w-full rounded border border-gray-200" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TriStateRow ──────────────────────────────────────────────────────────────

function TriStateRow({
  label, value, disabled, onChange,
}: {
  label: string;
  value: RespostaChecklist;
  disabled: boolean;
  onChange: (v: RespostaChecklist) => void;
}) {
  const opts: { v: RespostaChecklist; label: string }[] = [
    { v: "sim", label: "Sim" },
    { v: "nao", label: "Não" },
    { v: "nao_aplica", label: "N/A" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs text-gray-700">{label}</span>
      <div className="flex shrink-0 gap-1">
        {opts.map(({ v, label: lbl }) => (
          <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)}
            className={cn("w-7 rounded py-0.5 text-[11px] font-semibold transition-colors",
              value === v ? "bg-gray-800 text-white ring-1 ring-gray-700" : "bg-white text-gray-400 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-700",
              disabled && "cursor-not-allowed opacity-60")}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TextInput ────────────────────────────────────────────────────────────────

function TextInput({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50" />
    </div>
  );
}

// ─── CargoList ────────────────────────────────────────────────────────────────

function CargoList({ cargos, disabled, onChange }: { cargos: AetCargo[]; disabled: boolean; onChange: (cargos: AetCargo[]) => void }) {
  function addCargo() { onChange([...cargos, { nome: "", descricao: "" }]); }
  function removeCargo(idx: number) { onChange(cargos.filter((_, i) => i !== idx)); }
  function updateCargo(idx: number, patch: Partial<AetCargo>) { onChange(cargos.map((c, i) => (i === idx ? { ...c, ...patch } : c))); }

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">Cargo(s)</label>
        {!disabled && (
          <button type="button" onClick={addCargo}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="size-3" /> Cargo
          </button>
        )}
      </div>
      {cargos.length === 0 ? (
        <p className="text-xs italic text-gray-400">{disabled ? "Nenhum cargo cadastrado." : "Clique em \"+ Cargo\" para adicionar."}</p>
      ) : (
        <div className="space-y-2">
          {cargos.map((cargo, idx) => (
            <div key={idx} className="rounded-md border border-gray-200 bg-gray-50/70 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input type="text" value={cargo.nome} disabled={disabled} onChange={(e) => updateCargo(idx, { nome: e.target.value })}
                  placeholder="Nome do cargo"
                  className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium focus:border-verde-primary focus:outline-none disabled:bg-white" />
                {!disabled && (
                  <button type="button" onClick={() => removeCargo(idx)} className="text-red-400 hover:text-red-600"><X className="size-4" /></button>
                )}
              </div>
              <textarea value={cargo.descricao} disabled={disabled} rows={2} onChange={(e) => updateCargo(idx, { descricao: e.target.value })}
                placeholder="Descrição da atividade deste cargo..."
                className="w-full resize-none rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-verde-primary focus:outline-none disabled:bg-white" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  const items = value ? value.split("\n").filter((s) => s.trim().length > 0) : [];
  const [input, setInput] = useState("");

  function addItem(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed].join("\n"));
    setInput("");
  }

  function removeItem(idx: number) { onChange(items.filter((_, i) => i !== idx).join("\n")); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addItem(input); }
    else if (e.key === "Backspace" && !input && items.length > 0) { removeItem(items.length - 1); }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className={cn("flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-verde-primary focus-within:ring-2 focus-within:ring-verde-primary/20", disabled && "bg-gray-50")}>
        {items.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs font-medium text-verde-primary">
            {item}
            {!disabled && (
              <button type="button" onClick={() => removeItem(idx)} className="text-verde-primary/50 hover:text-verde-primary"><X className="size-3" /></button>
            )}
          </span>
        ))}
        {!disabled && (
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            onBlur={() => { if (input.trim()) addItem(input); }}
            className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder={items.length === 0 ? "Digite e pressione Enter..." : "+"} />
        )}
      </div>
    </div>
  );
}
