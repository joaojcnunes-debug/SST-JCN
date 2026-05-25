"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Loader2,
  Lock,
  Plus,
  RectangleHorizontal,
  Save,
  Trash2,
  Variable,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RichTextEditor from "@/components/drps/RichTextEditor";
import CapaEditor from "@/components/drps/CapaEditor";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CaixaTexto } from "@/lib/drps/types";
import {
  useAepTextoPadrao,
  useAepCriarCapitulo,
  useAepSalvarCapitulo,
  useAepExcluirCapitulo,
  useAepSeedCapitulosFixos,
} from "@/lib/hooks/useAep";
import type { AepTextoPadraoCapitulo } from "@/lib/supabase/types";
import { VARIAVEIS_AEP } from "@/lib/textos-padrao/variaveis-aep";
import { cn } from "@/lib/utils";

// ─── Template inicial AEP ─────────────────────────────────────────────────────

const TEMPLATE_INICIAL: { titulo: string; conteudo: string; ordem_global: number }[] = [
  {
    titulo: "1 – Apresentação",
    conteudo:
      "<p>A presente Análise Ergonômica Preliminar (AEP) foi elaborada com o objetivo de identificar e avaliar os fatores de risco ergonômico presentes nos postos de trabalho da empresa <strong>{{empresa_nome}}</strong>, sediada em {{endereco_empresa}}.</p>" +
      "<p>A AEP constitui a primeira etapa do programa de gerenciamento de riscos ergonômicos, em conformidade com a NR-17 (Ergonomia) e NR-01 (GRO/PGR).</p>",
    ordem_global: 500,
  },
  {
    titulo: "2 – Objetivo",
    conteudo:
      "<p>Este documento tem por objetivo realizar uma triagem ergonômica nos setores da empresa, identificando postos de trabalho que apresentam fatores de risco físicos, cognitivos e organizacionais.</p>" +
      "<p>Com base nos resultados obtidos, serão indicados os setores que necessitam de Análise Ergonômica do Trabalho (AET) completa, conforme os critérios estabelecidos pela NR-17.</p>",
    ordem_global: 600,
  },
  {
    titulo: "3 – Metodologia",
    conteudo:
      "<p>A metodologia adotada compreende as seguintes etapas:</p>" +
      "<ul>" +
      "<li>Visita técnica às instalações da empresa;</li>" +
      "<li>Observação sistemática das atividades laborais;</li>" +
      "<li>Aplicação de checklist ergonômico estruturado nas categorias física, cognitiva e organizacional;</li>" +
      "<li>Identificação e classificação dos riscos ergonômicos por nível de criticidade (Trivial, De Atenção, Moderado, Alto, Crítico);</li>" +
      "<li>Emissão de parecer técnico e recomendações por setor.</li>" +
      "</ul>",
    ordem_global: 700,
  },
  {
    titulo: "4 – Base Legal",
    conteudo:
      "<p><strong>NR-17 – Ergonomia (Portaria MTE nº 3.214/78, atualizada pela Portaria MTE nº 876/2021):</strong> estabelece parâmetros para a adaptação das condições de trabalho às características psicofisiológicas dos trabalhadores.</p>" +
      "<p><strong>NR-01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais:</strong> exige o Programa de Gerenciamento de Riscos (PGR), que inclui o reconhecimento e avaliação de riscos ergonômicos.</p>",
    ordem_global: 800,
  },
];

// ─── Descrição dos capítulos fixos ────────────────────────────────────────────

const SLUG_DESCRICAO: Record<string, string> = {
  aep_triagem:       "Tabela de identificação e checklist ergonômico por setor — gerado automaticamente.",
  aep_matriz_riscos: "Matriz de riscos ergonômicos por setor — gerada automaticamente.",
  aep_escalonamento: "Indicadores de necessidade de AET completa — gerados automaticamente quando há riscos Alto/Crítico.",
  aep_consideracoes: "Campo de texto livre para considerações finais + assinatura técnica.",
  aep_assinatura:    "Rodapé de assinatura do responsável técnico — gerado automaticamente.",
};

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AepTextoPadraoPage() {
  const { data: capitulos = [], isLoading } = useAepTextoPadrao();
  const criar   = useAepCriarCapitulo();
  const salvar  = useAepSalvarCapitulo();
  const excluir = useAepExcluirCapitulo();
  const seedFixos = useAepSeedCapitulosFixos();

  const [confirmExcluir, setConfirmExcluir] = useState<AepTextoPadraoCapitulo | null>(null);
  const [mostrarVars, setMostrarVars] = useState(false);

  const capitulosOrdenados = [...capitulos].sort(
    (a, b) => (a.ordem_global ?? a.ordem * 10) - (b.ordem_global ?? b.ordem * 10)
  );

  function novoCapitulo() {
    const maxGlobal = capitulos.reduce((m, c) => Math.max(m, c.ordem_global ?? c.ordem * 10), 0);
    criar.mutate({
      titulo: `Capítulo ${capitulos.filter((c) => c.tipo !== "fixo").length + 1}`,
      conteudo: "",
      ordem: capitulos.length,
      tipo: "editavel",
      ordem_global: maxGlobal + 100,
      mostrar: true,
    });
  }

  function seedTemplate() {
    const titulosExistentes = new Set(capitulos.map((c) => c.titulo.trim().toLowerCase()));
    const novas = TEMPLATE_INICIAL.filter(
      (tpl) => !titulosExistentes.has(tpl.titulo.trim().toLowerCase())
    );
    if (novas.length === 0) {
      toast("Todos os capítulos padrão já estão cadastrados.", { icon: "ℹ️" });
      return;
    }
    for (const tpl of novas) {
      criar.mutate({
        titulo: tpl.titulo,
        conteudo: tpl.conteudo,
        ordem: capitulos.length,
        tipo: "editavel",
        ordem_global: tpl.ordem_global,
        mostrar: true,
      });
    }
    toast.success(`${novas.length} seção(ões) adicionada(s).`);
  }

  function mover(cap: AepTextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulosOrdenados.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulosOrdenados.length) return;
    const outro = capitulosOrdenados[novoIdx];
    const ordemA = cap.ordem_global   ?? cap.ordem   * 10;
    const ordemB = outro.ordem_global ?? outro.ordem * 10;
    salvar.mutate({ id_capitulo: cap.id_capitulo,   ordem_global: ordemB });
    salvar.mutate({ id_capitulo: outro.id_capitulo, ordem_global: ordemA });
  }

  function toggleMostrar(cap: AepTextoPadraoCapitulo) {
    salvar.mutate({ id_capitulo: cap.id_capitulo, mostrar: !cap.mostrar });
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Texto Padrão — AEP</h1>
          <p className="max-w-2xl text-sm text-gray-600">
            Capítulos introdutórios do laudo de Análise Ergonômica Preliminar. Capítulos{" "}
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">SISTEMA</span>{" "}
            são gerados automaticamente; capítulos{" "}
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">EDITÁVEL</span>{" "}
            contêm texto livre com variáveis como{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">{"{{empresa_nome}}"}</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMostrarVars((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Variable className="size-4" />
            {mostrarVars ? "Ocultar variáveis" : "Variáveis disponíveis"}
          </button>
          <button
            type="button"
            onClick={() => seedFixos.mutate()}
            disabled={seedFixos.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            title="Adiciona as seções automáticas do sistema (triagem, riscos, escalonamento, assinatura)"
          >
            {seedFixos.isPending ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
            Seções do sistema
          </button>
          {!isLoading && (
            <button
              type="button"
              onClick={seedTemplate}
              disabled={criar.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              title="Adiciona os capítulos introdutórios padrão AEP que ainda não existem"
            >
              <BookOpen className="size-4" />
              {capitulos.filter((c) => c.tipo !== "fixo").length === 0
                ? "Carregar modelo inicial"
                : "Adicionar capítulos padrão"}
            </button>
          )}
          <button
            type="button"
            onClick={novoCapitulo}
            disabled={criar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="size-4" /> Novo Capítulo
          </button>
        </div>
      </div>

      {/* Painel de variáveis */}
      {mostrarVars && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Variáveis disponíveis — AEP
          </p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {VARIAVEIS_AEP.map((v) => (
              <div
                key={v.chave}
                className="flex items-center justify-between gap-2 rounded border border-emerald-100 bg-white px-2 py-1"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-[11px] text-emerald-700">{`{{${v.chave}}}`}</code>
                  <p className="text-[10px] text-gray-600">{v.rotulo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`{{${v.chave}}}`);
                    toast.success(`{{${v.chave}}} copiado`);
                  }}
                  className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
                >
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={4} />
        </div>
      ) : capitulos.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          Nenhum capítulo cadastrado ainda. Clique em{" "}
          <strong>Seções do sistema</strong> para adicionar as seções automáticas e em{" "}
          <strong>Carregar modelo inicial</strong> para as seções introdutórias padrão AEP.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            {capitulos.length} capítulo{capitulos.length !== 1 ? "s" : ""} no total ·{" "}
            {capitulos.filter((c) => c.tipo === "fixo").length} do sistema ·{" "}
            {capitulos.filter((c) => c.tipo !== "fixo").length} editáveis
          </p>
          {capitulosOrdenados.map((cap, idx) => {
            if (cap.tipo === "fixo") {
              return (
                <FixoCard
                  key={cap.id_capitulo}
                  capitulo={cap}
                  indice={idx}
                  total={capitulosOrdenados.length}
                  salvando={salvar.isPending}
                  onMover={(dir) => mover(cap, dir)}
                  onToggleMostrar={() => toggleMostrar(cap)}
                  onSalvar={(patch) => salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })}
                />
              );
            }
            return (
              <CapituloCard
                key={cap.id_capitulo}
                capitulo={cap}
                indice={idx}
                total={capitulosOrdenados.length}
                salvando={salvar.isPending}
                onSalvar={(patch) => salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })}
                onMover={(dir) => mover(cap, dir)}
                onExcluir={() => setConfirmExcluir(cap)}
                onToggleMostrar={() => toggleMostrar(cap)}
              />
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir capítulo?"
        description={
          confirmExcluir
            ? `O capítulo "${confirmExcluir.titulo}" será removido permanentemente.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!confirmExcluir) return;
          excluir.mutate(confirmExcluir.id_capitulo, {
            onSuccess: () => setConfirmExcluir(null),
          });
        }}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}

// ─── Card SISTEMA (fixo) ──────────────────────────────────────────────────────

function FixoCard({
  capitulo,
  indice,
  total,
  salvando,
  onMover,
  onToggleMostrar,
}: {
  capitulo: AepTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  onMover: (dir: "up" | "down") => void;
  onToggleMostrar: () => void;
  onSalvar: (patch: Partial<Omit<AepTextoPadraoCapitulo, "id_capitulo" | "created_at" | "updated_at">>) => void;
}) {
  const descricao = capitulo.slug_fixo ? SLUG_DESCRICAO[capitulo.slug_fixo] : null;

  return (
    <div className={cn(
      "rounded-xl border bg-blue-50/60 p-3 shadow-sm",
      capitulo.mostrar ? "border-blue-200" : "border-gray-200 opacity-60"
    )}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onMover("up")}
            disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover("down")}
            disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Lock className="size-2.5" /> Sistema
        </span>

        <p className="flex-1 text-sm font-semibold text-gray-800">{capitulo.titulo}</p>

        <button
          type="button"
          onClick={onToggleMostrar}
          disabled={salvando}
          title={capitulo.mostrar ? "Ocultar no laudo" : "Mostrar no laudo"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
            capitulo.mostrar
              ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          {capitulo.mostrar ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {capitulo.mostrar ? "Visível" : "Oculto"}
        </button>
      </div>

      {descricao && (
        <p className="mt-1.5 pl-16 text-[11px] italic text-blue-700/80">{descricao}</p>
      )}
    </div>
  );
}

// ─── Card EDITÁVEL ────────────────────────────────────────────────────────────

function CapituloCard({
  capitulo,
  indice,
  total,
  salvando,
  onSalvar,
  onMover,
  onExcluir,
  onToggleMostrar,
}: {
  capitulo: AepTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  onSalvar: (patch: Partial<Omit<AepTextoPadraoCapitulo, "id_capitulo" | "created_at" | "updated_at">>) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
  onToggleMostrar: () => void;
}) {
  const [titulo,   setTitulo]   = useState(capitulo.titulo);
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [caixas,   setCaixas]   = useState<CaixaTexto[]>(capitulo.caixas_texto ?? []);
  const [dirty,    setDirty]    = useState(false);
  const [enviandoBg, setEnviandoBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitulo(capitulo.titulo);
    setConteudo(capitulo.conteudo ?? "");
    setCaixas(capitulo.caixas_texto ?? []);
    setDirty(false);
  }, [capitulo.id_capitulo, capitulo.titulo, capitulo.conteudo, capitulo.caixas_texto]);

  async function enviarBg(file: File) {
    if (enviandoBg) return;
    setEnviandoBg(true);
    const loadingId = toast.loading("Enviando imagem de fundo...");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext  = file.name.split(".").pop() ?? "png";
      const path = `aep-texto-padrao/bg-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("URL pública não retornada");
      onSalvar({ bg_imagem_url: pub.publicUrl });
      toast.success("Imagem de fundo definida", { id: loadingId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload", { id: loadingId });
    } finally {
      setEnviandoBg(false);
    }
  }

  const orientacao = capitulo.orientacao ?? "retrato";

  return (
    <div className={cn(
      "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
      !capitulo.mostrar && "opacity-60"
    )}>
      {/* Linha do título */}
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button type="button" onClick={() => onMover("up")} disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
            <ChevronUp className="size-4" />
          </button>
          <button type="button" onClick={() => onMover("down")} disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
            <ChevronDown className="size-4" />
          </button>
        </div>

        <span className="inline-flex shrink-0 items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 mt-2">
          Editável
        </span>

        <input
          type="text"
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setDirty(true); }}
          placeholder="Título do capítulo"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <button
          type="button"
          onClick={onToggleMostrar}
          disabled={salvando}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
            capitulo.mostrar
              ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          {capitulo.mostrar ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!titulo.trim()) { toast.error("O título não pode estar vazio"); return; }
            onSalvar({ titulo: titulo.trim(), conteudo: conteudo.trim() || null, caixas_texto: caixas });
            setDirty(false);
          }}
          disabled={!dirty || salvando || !titulo.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>

        <button
          type="button"
          onClick={onExcluir}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Orientação + imagem de fundo */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Orientação:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => orientacao !== "retrato" && onSalvar({ orientacao: "retrato" })}
              disabled={salvando}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                orientacao === "retrato" ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <FileText className="size-3.5" /> Retrato
            </button>
            <button
              type="button"
              onClick={() => orientacao !== "paisagem" && onSalvar({ orientacao: "paisagem" })}
              disabled={salvando}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                orientacao === "paisagem" ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <RectangleHorizontal className="size-3.5" /> Paisagem
            </button>
          </div>
        </div>

        {/* Imagem de fundo */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Capa:</span>
          {capitulo.bg_imagem_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capitulo.bg_imagem_url} alt="Fundo" className="h-8 w-14 rounded border border-gray-300 object-cover" />
              <button
                type="button"
                onClick={() => onSalvar({ bg_imagem_url: null })}
                disabled={salvando}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X className="size-3.5" /> Remover
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => bgInputRef.current?.click()}
              disabled={enviandoBg || salvando}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {enviandoBg ? <Loader2 className="size-3.5 animate-spin" /> : <AlignLeft className="size-3.5" />}
              Enviar imagem de capa
            </button>
          )}
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviarBg(f);
              if (bgInputRef.current) bgInputRef.current.value = "";
            }}
          />
        </div>
      </div>

      {/* Editor */}
      {capitulo.bg_imagem_url ? (
        <CapaEditor
          bgImagemUrl={capitulo.bg_imagem_url}
          caixas={caixas}
          onChange={(novas) => { setCaixas(novas); setDirty(true); }}
        />
      ) : (
        <RichTextEditor
          value={conteudo}
          onChange={(html) => { setConteudo(html); setDirty(true); }}
          placeholder="Conteúdo do capítulo... use {{empresa_nome}}, {{responsavel_tecnico}} etc."
          uploadPathPrefix="aep-textos"
        />
      )}
    </div>
  );
}
