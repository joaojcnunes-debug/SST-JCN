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
  FilePlus2,
  ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  RectangleHorizontal,
  Save,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RichTextEditor from "@/components/drps/RichTextEditor";
import CapaEditor from "@/components/drps/CapaEditor";
import PosicaoPdfStepper from "@/components/textos-padrao/PosicaoPdfStepper";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CaixaTexto } from "@/lib/drps/types";
import { DRPS_FIXOS } from "@/lib/drps/types";
import {
  useDrpsTextoPadrao,
  useDrpsCriarCapitulo,
  useDrpsSalvarCapitulo,
  useDrpsExcluirCapitulo,
  useDrpsSeedCapitulosFixos,
} from "@/lib/hooks/useDrps";
import type {
  DrpsPosicaoPdf,
  DrpsTextoPadraoCapitulo,
} from "@/lib/drps/types";
import { cn } from "@/lib/utils";

const TEMPLATE_INICIAL: { titulo: string; conteudo: string }[] = [
  {
    titulo: "1. Introdução",
    conteudo:
      "<p style=\"text-align: justify\">Este relatório apresenta o " +
      "<strong>Diagnóstico de Riscos Psicossociais (DRPS)</strong> conduzido " +
      "em conformidade com a NR-1 (Disposições Gerais e Gerenciamento de " +
      "Riscos Ocupacionais) e a NR-17 (Ergonomia).</p>",
  },
  {
    titulo: "2. Objetivo",
    conteudo:
      "<p style=\"text-align: justify\">Identificar, avaliar e classificar " +
      "os riscos psicossociais presentes no ambiente de trabalho, " +
      "subsidiando o plano de ação preventivo e interventivo.</p>",
  },
  {
    titulo: "3. Metodologia",
    conteudo:
      "<p style=\"text-align: justify\">Aplicação de questionário " +
      "estruturado (50 perguntas, 13 tópicos) aos trabalhadores; tabulação " +
      "e cálculo da média de gravidade por tópico; definição da " +
      "probabilidade pelo psicólogo responsável; cruzamento Gravidade × " +
      "Probabilidade na matriz 3×3 de risco.</p>",
  },
  {
    titulo: "4. Considerações Finais",
    conteudo:
      "<p style=\"text-align: justify\">Recomenda-se monitoramento " +
      "periódico, revisão anual do DRPS e implementação das medidas de " +
      "controle conforme matriz de risco.</p>",
  },
];

export default function TextoPadraoPage() {
  const { data: capitulos = [], isLoading } = useDrpsTextoPadrao();
  const criar      = useDrpsCriarCapitulo();
  const salvar     = useDrpsSalvarCapitulo();
  const excluir    = useDrpsExcluirCapitulo();
  const seedFixos  = useDrpsSeedCapitulosFixos();

  const [confirmExcluir, setConfirmExcluir] = useState<DrpsTextoPadraoCapitulo | null>(null);
  const [seededRef, setSeededRef] = useState(false);

  useEffect(() => {
    if (!isLoading && !seededRef && capitulos.filter((c) => c.tipo === "fixo").length === 0) {
      setSeededRef(true);
      seedFixos.mutate();
    }
  }, [isLoading, capitulos, seededRef, seedFixos]);

  const capitulosFixos     = capitulos.filter((c) => c.tipo === "fixo");
  const capitulosEditaveis = capitulos.filter((c) => c.tipo !== "fixo");

  function novoCapitulo() {
    criar.mutate({
      titulo: `Capítulo ${capitulosEditaveis.length + 1}`,
      conteudo: "",
      ordem: capitulos.length,
    });
  }

  function seedTemplate() {
    let ordem = capitulos.length;
    for (const tpl of TEMPLATE_INICIAL) {
      criar.mutate({ titulo: tpl.titulo, conteudo: tpl.conteudo, ordem });
      ordem++;
    }
  }

  function mover(cap: DrpsTextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulos.length) return;
    const outro = capitulos[novoIdx];
    salvar.mutate({ id_capitulo: cap.id_capitulo,   ordem: outro.ordem });
    salvar.mutate({ id_capitulo: outro.id_capitulo, ordem: cap.ordem });
  }

  const contagensPorPosicao = capitulosEditaveis.reduce<Partial<Record<DrpsPosicaoPdf, number>>>(
    (acc, c) => {
      const p = (c.posicao_pdf ?? "inicio") as DrpsPosicaoPdf;
      acc[p] = (acc[p] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Texto Padrão — DRPS</h1>
          <p className="max-w-2xl text-sm text-gray-600">
            Capítulos do relatório de Diagnóstico de Riscos Psicossociais. Capítulos{" "}
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">SISTEMA</span>{" "}
            são gerados automaticamente; capítulos{" "}
            <span className="rounded bg-verde-light px-1.5 py-0.5 text-[11px] font-bold text-verde-primary">EDITÁVEL</span>{" "}
            contêm texto livre.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => seedFixos.mutate()}
            disabled={seedFixos.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            title="Adiciona as seções automáticas do sistema"
          >
            {seedFixos.isPending ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
            Seções do sistema
          </button>
          {capitulosEditaveis.length === 0 && !isLoading && (
            <button
              type="button"
              onClick={seedTemplate}
              disabled={criar.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-verde-primary bg-white px-3 py-2 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
            >
              <BookOpen className="size-4" /> Carregar modelo inicial
            </button>
          )}
          <button
            type="button"
            onClick={novoCapitulo}
            disabled={criar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
          >
            <Plus className="size-4" /> Novo Capítulo
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={3} />
        </div>
      ) : capitulos.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          Nenhum capítulo cadastrado ainda. Clique em{" "}
          <strong>Seções do sistema</strong> para adicionar as seções automáticas e em{" "}
          <strong>Carregar modelo inicial</strong> para as seções introdutórias.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            {capitulosFixos.length} seção{capitulosFixos.length !== 1 ? "ões" : ""} do sistema ·{" "}
            {capitulosEditaveis.length} capítulo{capitulosEditaveis.length !== 1 ? "s" : ""} editáveis
            {capitulosEditaveis.filter((c) => !c.ativo).length > 0 && (
              <> · {capitulosEditaveis.filter((c) => !c.ativo).length} oculto{capitulosEditaveis.filter((c) => !c.ativo).length !== 1 ? "s" : ""}</>
            )}
          </p>

          {/* Seções SISTEMA */}
          {capitulosFixos.map((cap, idx) => {
            const descricao = DRPS_FIXOS.find((f) => f.slug_fixo === cap.slug_fixo)?.descricao ?? "";
            return (
              <FixoCard
                key={cap.id_capitulo}
                capitulo={cap}
                indice={idx}
                total={capitulosFixos.length}
                salvando={salvar.isPending}
                descricao={descricao}
                onMover={(dir) => mover(cap, dir)}
                onToggleMostrar={() => salvar.mutate({ id_capitulo: cap.id_capitulo, ativo: !cap.ativo })}
                onSalvar={(patch) => salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })}
              />
            );
          })}

          {/* Capítulos EDITÁVEIS */}
          {capitulosEditaveis.map((cap, i) => (
            <CapituloCard
              key={cap.id_capitulo}
              capitulo={cap}
              indice={i}
              total={capitulosEditaveis.length}
              salvando={salvar.isPending}
              contagensPorPosicao={contagensPorPosicao}
              onSalvar={(patch) => salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })}
              onMover={(dir) => mover(cap, dir)}
              onExcluir={() => setConfirmExcluir(cap)}
              onToggleMostrar={() => salvar.mutate({ id_capitulo: cap.id_capitulo, ativo: !cap.ativo })}
            />
          ))}
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

// ─── FixoCard ─────────────────────────────────────────────────────────────────

function FixoCard({
  capitulo,
  indice,
  total,
  salvando,
  descricao,
  onMover,
  onToggleMostrar,
  onSalvar,
}: {
  capitulo: DrpsTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  descricao: string;
  onMover: (dir: "up" | "down") => void;
  onToggleMostrar: () => void;
  onSalvar: (patch: { orientacao?: string }) => void;
}) {
  const orientacao = capitulo.orientacao ?? "retrato";

  return (
    <div className={cn(
      "rounded-xl border bg-blue-50/60 p-3 shadow-sm",
      capitulo.ativo ? "border-blue-200" : "border-gray-200 opacity-60"
    )}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button type="button" onClick={() => onMover("up")} disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-700 disabled:opacity-30">
            <ChevronUp className="size-4" />
          </button>
          <button type="button" onClick={() => onMover("down")} disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-700 disabled:opacity-30">
            <ChevronDown className="size-4" />
          </button>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Lock className="size-2.5" /> Sistema
        </span>

        <p className="flex-1 text-sm font-semibold text-gray-800">{capitulo.titulo}</p>

        <div className="inline-flex overflow-hidden rounded-md border border-blue-200 bg-white shrink-0">
          <button type="button"
            onClick={() => orientacao !== "retrato" && onSalvar({ orientacao: "retrato" })}
            disabled={salvando}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
              orientacao === "retrato" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-blue-50"
            )}
          >
            <FileText className="size-3" /> Retrato
          </button>
          <button type="button"
            onClick={() => orientacao !== "paisagem" && onSalvar({ orientacao: "paisagem" })}
            disabled={salvando}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
              orientacao === "paisagem" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-blue-50"
            )}
          >
            <RectangleHorizontal className="size-3" /> Paisagem
          </button>
        </div>

        <button type="button" onClick={onToggleMostrar} disabled={salvando}
          title={capitulo.ativo ? "Ocultar no laudo" : "Mostrar no laudo"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
            capitulo.ativo
              ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          {capitulo.ativo ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {capitulo.ativo ? "Visível" : "Oculto"}
        </button>
      </div>

      {descricao && (
        <p className="mt-1.5 pl-16 text-[11px] italic text-blue-700/80">
          {descricao}
          {orientacao === "paisagem" && (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 not-italic">
              A4 horizontal
            </span>
          )}
        </p>
      )}
    </div>
  );
}

// ─── CapituloCard ─────────────────────────────────────────────────────────────

function CapituloCard({
  capitulo,
  indice,
  total,
  salvando,
  contagensPorPosicao,
  onSalvar,
  onMover,
  onExcluir,
  onToggleMostrar,
}: {
  capitulo: DrpsTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  contagensPorPosicao: Partial<Record<DrpsPosicaoPdf, number>>;
  onSalvar: (patch: {
    titulo?: string;
    conteudo?: string | null;
    bg_imagem_url?: string | null;
    caixas_texto?: CaixaTexto[] | null;
    posicao_pdf?: DrpsPosicaoPdf;
    orientacao?: string | null;
    quebra_pagina?: string | null;
  }) => void;
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
      const ext = file.name.split(".").pop() ?? "png";
      const path = `drps-texto-padrao/bg-${crypto.randomUUID()}.${ext}`;
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

  const orientacao   = capitulo.orientacao   ?? "retrato";
  const quebraPagina = capitulo.quebra_pagina ?? "nova";

  return (
    <div className={cn(
      "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
      !capitulo.ativo && "opacity-60"
    )}>
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

        <span className="inline-flex shrink-0 items-center rounded bg-verde-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-verde-primary mt-2">
          Editável
        </span>

        <input
          type="text"
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setDirty(true); }}
          placeholder="Título do capítulo"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        />

        <button
          type="button"
          onClick={onToggleMostrar}
          disabled={salvando}
          title={capitulo.ativo ? "Ocultar no laudo" : "Mostrar no laudo"}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
            capitulo.ativo
              ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          {capitulo.ativo ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!titulo.trim()) { toast.error("O título não pode estar vazio"); return; }
            onSalvar({ titulo: titulo.trim(), conteudo: conteudo.trim() || null, caixas_texto: caixas });
            setDirty(false);
          }}
          disabled={!dirty || salvando || !titulo.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
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

      {/* Configurações */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Orientação:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button type="button"
              onClick={() => orientacao !== "retrato" && onSalvar({ orientacao: "retrato" })}
              disabled={salvando}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                orientacao === "retrato" ? "bg-verde-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50")}
            >
              <FileText className="size-3.5" /> Retrato
            </button>
            <button type="button"
              onClick={() => orientacao !== "paisagem" && onSalvar({ orientacao: "paisagem" })}
              disabled={salvando}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                orientacao === "paisagem" ? "bg-verde-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50")}
            >
              <RectangleHorizontal className="size-3.5" /> Paisagem
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Início:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button type="button"
              onClick={() => quebraPagina !== "nova" && onSalvar({ quebra_pagina: "nova" })}
              disabled={salvando || !!capitulo.bg_imagem_url}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                quebraPagina === "nova" || capitulo.bg_imagem_url ? "bg-verde-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50")}
            >
              <FilePlus2 className="size-3.5" /> Nova página
            </button>
            <button type="button"
              onClick={() => quebraPagina !== "continua" && onSalvar({ quebra_pagina: "continua" })}
              disabled={salvando || !!capitulo.bg_imagem_url || indice === 0}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                quebraPagina === "continua" && !capitulo.bg_imagem_url ? "bg-verde-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50")}
            >
              <AlignLeft className="size-3.5" /> Continuação
            </button>
          </div>
        </div>

        <span className="text-[10px] italic text-gray-500">
          {capitulo.bg_imagem_url
            ? "Capa: página inteira"
            : quebraPagina === "continua"
            ? "Continua na mesma folha do capítulo anterior."
            : orientacao === "paisagem"
            ? "A4 horizontal em folha nova."
            : "A4 vertical em folha nova (ABNT)."}
        </span>

        <div className="w-full">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
            📍 Posição no Relatório
          </p>
          <PosicaoPdfStepper
            valor={(capitulo.posicao_pdf ?? "inicio") as DrpsPosicaoPdf}
            onChange={(p) => onSalvar({ posicao_pdf: p as DrpsPosicaoPdf })}
            contagens={contagensPorPosicao}
            disabled={salvando}
          />
        </div>
      </div>

      {/* Imagem de capa */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Imagem de fundo (capa):
        </span>
        {capitulo.bg_imagem_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capitulo.bg_imagem_url} alt="Fundo" className="h-10 w-16 rounded border border-gray-300 object-cover" />
            <span className="text-[10px] text-gray-600">Este capítulo sai como página inteira no PDF.</span>
            <button type="button" onClick={() => onSalvar({ bg_imagem_url: null })} disabled={salvando}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <X className="size-3.5" /> Remover
            </button>
          </>
        ) : (
          <span className="text-[11px] italic text-gray-500">Sem imagem (capítulo em fluxo normal).</span>
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
        {!capitulo.bg_imagem_url && (
          <button type="button" onClick={() => bgInputRef.current?.click()} disabled={enviandoBg || salvando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-2 py-1 text-xs font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50">
            {enviandoBg ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            Enviar imagem
          </button>
        )}
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
          placeholder="Conteúdo do capítulo..."
        />
      )}
    </div>
  );
}
