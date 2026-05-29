"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Eye,
  EyeOff,
  ImageIcon,
  X,
  Loader2,
  Variable,
  FileText,
  RectangleHorizontal,
  FilePlus2,
  AlignLeft,
  Search,
  Lock,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RichTextEditor from "@/components/drps/RichTextEditor";
import CapaEditor from "@/components/drps/CapaEditor";
import PosicaoPdfStepper from "@/components/textos-padrao/PosicaoPdfStepper";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CaixaTexto } from "@/lib/drps/types";
import {
  useTextosPadrao,
  useCriarCapituloTexto,
  useSalvarCapituloTexto,
  useExcluirCapituloTexto,
  useSeedCapitulosFixos,
} from "@/lib/hooks/useTextosPadrao";
import {
  type ModuloTextoPadrao,
  type OrientacaoPagina,
  type PosicaoPdf,
  type QuebraPagina,
  type TextoPadraoCapitulo,
  MODULO_CONFIGS,
} from "@/lib/textos-padrao/types";
import { VARIAVEIS_POR_MODULO } from "@/lib/textos-padrao/variaveis";
import { cn } from "@/lib/utils";

interface Props {
  modulo: ModuloTextoPadrao;
}

/**
 * Editor genérico de Texto Padrão. Replica a UI da página do Psicossocial,
 * mas trabalha com a tabela `textos_padrao` e recebe qual módulo via prop.
 *
 * Cada quadro (SST, Conformidade, Análise de Químicos) tem sua página fina
 * que apenas renderiza este componente passando o módulo correto.
 */
export default function TextoPadraoEditor({ modulo }: Props) {
  const config = MODULO_CONFIGS[modulo];
  const variaveis = VARIAVEIS_POR_MODULO[modulo];
  const { data: capitulos = [], isLoading } = useTextosPadrao(modulo);
  const criar = useCriarCapituloTexto(modulo);
  const salvar = useSalvarCapituloTexto(modulo);
  const excluir = useExcluirCapituloTexto(modulo);
  const seedFixos = useSeedCapitulosFixos(modulo);

  const [confirmExcluir, setConfirmExcluir] =
    useState<TextoPadraoCapitulo | null>(null);
  const [mostrarVars, setMostrarVars] = useState(false);
  const [busca, setBusca] = useState("");

  const capitulosFixos    = capitulos.filter((c) => c.tipo === "fixo");
  const capitulosEditaveis = capitulos.filter((c) => c.tipo !== "fixo");

  function novoCapitulo() {
    const ordem = capitulos.length;
    criar.mutate({
      titulo: `Capítulo ${ordem + 1}`,
      conteudo: "",
      ordem,
    });
  }

  function seedTemplate() {
    const tpl = TEMPLATES_POR_MODULO[modulo];
    let ordem = capitulosEditaveis.length;
    for (const t of tpl) {
      criar.mutate({ titulo: t.titulo, conteudo: t.conteudo, ordem });
      ordem++;
    }
  }

  async function mover(cap: TextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulos.length) return;
    const outro = capitulos[novoIdx];
    await salvar.mutateAsync({ id_capitulo: cap.id_capitulo, ordem: outro.ordem });
    await salvar.mutateAsync({ id_capitulo: outro.id_capitulo, ordem: cap.ordem });
  }

  // Contagem apenas de capítulos editáveis por posição para o Stepper
  const contagensPorPosicao = capitulosEditaveis.reduce<
    Partial<Record<PosicaoPdf, number>>
  >((acc, c) => {
    const p = (c.posicao_pdf ?? "inicio") as PosicaoPdf;
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  const capitulosFiltrados = busca.trim()
    ? capitulosEditaveis.filter((c) =>
        c.titulo.toLowerCase().includes(busca.trim().toLowerCase())
      )
    : capitulosEditaveis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {config.titulo}
          </h1>
          <p className="max-w-2xl text-sm text-gray-600">{config.descricao}</p>
          <p className="mt-1 text-xs italic text-teal-700">{config.destino}</p>
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
            title="Adiciona as seções geradas automaticamente pelo sistema"
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

      {/* Painel de variáveis disponíveis */}
      {mostrarVars && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-700">
            Variáveis disponíveis neste módulo
          </p>
          <p className="mb-2 text-xs text-gray-600">
            Insira no texto do capítulo as marcações abaixo. Elas serão
            substituídas pelos valores reais ao gerar o PDF.
          </p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {variaveis.map((v) => (
              <div
                key={v.chave}
                className="flex items-center justify-between gap-2 rounded border border-sky-100 bg-white px-2 py-1"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-[11px] text-sky-700">{`{{${v.chave}}}`}</code>
                  <p className="text-[10px] text-gray-600">{v.rotulo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`{{${v.chave}}}`);
                    toast.success(`{{${v.chave}}} copiado`);
                  }}
                  className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-200"
                  title="Copiar"
                >
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busca por título */}
      {capitulos.length >= 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar capítulo por título..."
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

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
        <div className="space-y-3">
          {/* Capítulos SISTEMA */}
          {capitulosFixos.length > 0 && (
            <>
              <p className="text-xs text-gray-500">
                {capitulosFixos.length} seção{capitulosFixos.length !== 1 ? "ões" : ""} do sistema ·{" "}
                {capitulosEditaveis.length} capítulo{capitulosEditaveis.length !== 1 ? "s" : ""} editáveis
                {capitulosEditaveis.filter((c) => !c.ativo).length > 0 && (
                  <> · {capitulosEditaveis.filter((c) => !c.ativo).length} oculto{capitulosEditaveis.filter((c) => !c.ativo).length !== 1 ? "s" : ""}</>
                )}
              </p>
              {capitulosFixos.map((cap, idx) => {
                const descricao = config.fixos.find((f) => f.slug_fixo === cap.slug_fixo)?.descricao ?? "";
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
            </>
          )}

          {/* Capítulos EDITÁVEIS */}
          {capitulosEditaveis.length > 0 && (
            <>
              {capitulosFixos.length === 0 && (
                <p className="text-xs text-gray-500">
                  {capitulosEditaveis.length} capítulo{capitulosEditaveis.length !== 1 ? "s" : ""}
                  {capitulosEditaveis.filter((c) => !c.ativo).length > 0 && (
                    <> · {capitulosEditaveis.filter((c) => !c.ativo).length} oculto{capitulosEditaveis.filter((c) => !c.ativo).length !== 1 ? "s" : ""}</>
                  )}
                </p>
              )}
              {capitulosFiltrados.length === 0 && busca ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                  Nenhum capítulo encontrado para <strong>&ldquo;{busca}&rdquo;</strong>.
                </div>
              ) : (
                <>
                  {busca && (
                    <p className="text-xs text-gray-500">
                      {capitulosFiltrados.length} de {capitulosEditaveis.length} capítulo{capitulosEditaveis.length !== 1 ? "s" : ""}
                    </p>
                  )}
                  {capitulosFiltrados.map((cap) => (
                    <CapituloCard
                      key={cap.id_capitulo}
                      capitulo={cap}
                      indice={capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo)}
                      total={capitulos.length}
                      salvando={salvar.isPending}
                      storagePrefix={`textos-padrao/${modulo}`}
                      contagensPorPosicao={contagensPorPosicao}
                      onSalvar={(patch) =>
                        salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })
                      }
                      onMover={(dir) => mover(cap, dir)}
                      onExcluir={() => setConfirmExcluir(cap)}
                      onToggleMostrar={() =>
                        salvar.mutate({ id_capitulo: cap.id_capitulo, ativo: !cap.ativo })
                      }
                    />
                  ))}
                </>
              )}
            </>
          )}
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

// ============================================================
// FixoCard — capítulo gerado automaticamente pelo sistema
// ============================================================

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
  capitulo: TextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  descricao: string;
  onMover: (dir: "up" | "down") => void;
  onToggleMostrar: () => void;
  onSalvar: (patch: { orientacao?: OrientacaoPagina }) => void;
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

        {/* Orientação */}
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

        {/* Toggle visibilidade */}
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

// ============================================================
// CapituloCard — copiado do DRPS, com `storagePrefix` configurável
// ============================================================

function CapituloCard({
  capitulo,
  indice,
  total,
  salvando,
  storagePrefix,
  contagensPorPosicao,
  onSalvar,
  onMover,
  onExcluir,
  onToggleMostrar,
}: {
  capitulo: TextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  storagePrefix: string;
  contagensPorPosicao: Partial<Record<PosicaoPdf, number>>;
  onSalvar: (patch: {
    titulo?: string;
    conteudo?: string | null;
    bg_imagem_url?: string | null;
    caixas_texto?: CaixaTexto[] | null;
    orientacao?: OrientacaoPagina;
    quebra_pagina?: QuebraPagina;
    posicao_pdf?: PosicaoPdf;
    ativo?: boolean;
  }) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
  onToggleMostrar: () => void;
}) {
  const [titulo, setTitulo] = useState(capitulo.titulo);
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [caixas, setCaixas] = useState<CaixaTexto[]>(
    capitulo.caixas_texto ?? []
  );
  const [dirty, setDirty] = useState(false);
  const [enviandoBg, setEnviandoBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitulo(capitulo.titulo);
    setConteudo(capitulo.conteudo ?? "");
    setCaixas(capitulo.caixas_texto ?? []);
    setDirty(false);
  }, [
    capitulo.id_capitulo,
    capitulo.titulo,
    capitulo.conteudo,
    capitulo.caixas_texto,
  ]);

  async function enviarBg(file: File) {
    if (enviandoBg) return;
    setEnviandoBg(true);
    const loadingId = toast.loading("Enviando imagem de fundo...");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${storagePrefix}/bg-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("URL pública não retornada");
      onSalvar({ bg_imagem_url: pub.publicUrl });
      toast.success("Imagem de fundo definida", { id: loadingId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      toast.error(msg, { id: loadingId });
    } finally {
      setEnviandoBg(false);
    }
  }

  function removerBg() {
    onSalvar({ bg_imagem_url: null });
  }

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4 shadow-sm", !capitulo.ativo && "opacity-60")}>
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onMover("up")}
            disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            title="Mover para cima"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover("down")}
            disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <span className="inline-flex shrink-0 items-center rounded bg-verde-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-verde-primary mt-2">
          Editável
        </span>
        <input
          type="text"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setDirty(true);
          }}
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
          onClick={() =>
            onSalvar({
              titulo: titulo.trim(),
              conteudo: conteudo.trim() || null,
              caixas_texto: caixas,
            })
          }
          disabled={!dirty || salvando || !titulo.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
        <button
          type="button"
          onClick={onExcluir}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-alert"
          title="Excluir"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {/* Orientação da página + Quebra de página */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Orientação:
          </span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() =>
                capitulo.orientacao !== "retrato" &&
                onSalvar({ orientacao: "retrato" })
              }
              disabled={salvando}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors ${
                capitulo.orientacao === "retrato"
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              } disabled:opacity-50`}
            >
              <FileText className="size-3.5" /> Retrato
            </button>
            <button
              type="button"
              onClick={() =>
                capitulo.orientacao !== "paisagem" &&
                onSalvar({ orientacao: "paisagem" })
              }
              disabled={salvando}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors ${
                capitulo.orientacao === "paisagem"
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              } disabled:opacity-50`}
            >
              <RectangleHorizontal className="size-3.5" /> Paisagem
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Início:
          </span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() =>
                capitulo.quebra_pagina !== "nova" &&
                onSalvar({ quebra_pagina: "nova" })
              }
              disabled={salvando || !!capitulo.bg_imagem_url}
              title={
                capitulo.bg_imagem_url
                  ? "Capítulo com capa sempre é nova página"
                  : "Inicia em uma nova página"
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors ${
                capitulo.quebra_pagina === "nova" || capitulo.bg_imagem_url
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              } disabled:opacity-50`}
            >
              <FilePlus2 className="size-3.5" /> Nova página
            </button>
            <button
              type="button"
              onClick={() =>
                capitulo.quebra_pagina !== "continua" &&
                onSalvar({ quebra_pagina: "continua" })
              }
              disabled={salvando || !!capitulo.bg_imagem_url || indice === 0}
              title={
                capitulo.bg_imagem_url
                  ? "Capítulo com capa sempre é nova página"
                  : indice === 0
                  ? "O primeiro capítulo precisa começar em nova página"
                  : "Continua na página do capítulo anterior"
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors ${
                capitulo.quebra_pagina === "continua" && !capitulo.bg_imagem_url
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              } disabled:opacity-50`}
            >
              <AlignLeft className="size-3.5" /> Continuação
            </button>
          </div>
        </div>

        <span className="text-[10px] italic text-gray-500">
          {capitulo.bg_imagem_url
            ? "Capa: página inteira"
            : capitulo.quebra_pagina === "continua"
            ? "Continua na mesma folha do capítulo anterior."
            : capitulo.orientacao === "paisagem"
            ? "A4 horizontal em folha nova."
            : "A4 vertical em folha nova (ABNT)."}
        </span>

        {/* V53: Posição no PDF — Stepper visual */}
        <div className="w-full">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
            📍 Posição no Relatório
          </p>
          <PosicaoPdfStepper
            valor={(capitulo.posicao_pdf ?? "inicio") as PosicaoPdf}
            onChange={(p) =>
              onSalvar({ posicao_pdf: p as PosicaoPdf })
            }
            contagens={contagensPorPosicao}
            disabled={salvando}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Imagem de fundo (capa):
        </span>
        {capitulo.bg_imagem_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capitulo.bg_imagem_url}
              alt="Fundo"
              className="h-10 w-16 rounded border border-gray-300 object-cover"
            />
            <span className="text-[10px] text-gray-600">
              Este capítulo sai como página inteira no PDF.
            </span>
            <button
              type="button"
              onClick={removerBg}
              disabled={salvando}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-alert disabled:opacity-50"
            >
              <X className="size-3.5" /> Remover
            </button>
          </>
        ) : (
          <span className="text-[11px] italic text-gray-500">
            Sem imagem (capítulo em fluxo normal).
          </span>
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
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            disabled={enviandoBg || salvando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-2 py-1 text-xs font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
          >
            {enviandoBg ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            Enviar imagem
          </button>
        )}
      </div>

      {capitulo.bg_imagem_url ? (
        <CapaEditor
          bgImagemUrl={capitulo.bg_imagem_url}
          caixas={caixas}
          onChange={(novas) => {
            setCaixas(novas);
            setDirty(true);
          }}
        />
      ) : (
        <RichTextEditor
          value={conteudo}
          onChange={(html) => {
            setConteudo(html);
            setDirty(true);
          }}
          placeholder="Conteúdo do capítulo... use {{empresa_nome}}, {{cnpj}} etc. pra inserir variáveis."
        />
      )}
    </div>
  );
}

// ============================================================
// Templates iniciais por módulo (botão "Carregar modelo inicial")
// ============================================================

const TEMPLATES_POR_MODULO: Record<
  ModuloTextoPadrao,
  Array<{ titulo: string; conteudo: string }>
> = {
  sst: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Este relatório de Inspeção de Segurança e Saúde do Trabalho foi elaborado conforme a <strong>NR-01</strong> (Disposições Gerais e Gerenciamento de Riscos Ocupacionais), para a empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}).</p>',
    },
    {
      titulo: "2. Metodologia",
      conteudo:
        '<p style="text-align: justify">Inspeção realizada in loco em {{data_inspecao}}, com observação direta dos postos de trabalho, entrevistas com trabalhadores e análise documental dos programas de segurança vigentes.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Recomenda-se o cumprimento dos prazos do plano de ação, monitoramento periódico dos riscos identificados e revisão anual do PGR conforme NR-1.</p>',
    },
  ],
  conformidade: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">O presente Relatório de Conformidade tem por objetivo verificar o atendimento da empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}) aos requisitos da <strong>{{nr_codigo}} — {{nr_titulo}}</strong>, no setor {{setor}}, em {{data_inspecao}}.</p>',
    },
    {
      titulo: "2. Fundamentação Legal",
      conteudo:
        '<p style="text-align: justify">A auditoria foi conduzida com base na redação vigente da {{nr_codigo}}, publicada pela Subsecretaria de Inspeção do Trabalho do Ministério do Trabalho e Emprego.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Os itens marcados como CONFORMES atendem aos requisitos da norma; itens NÃO APLICÁVEIS foram avaliados quanto à pertinência ao setor auditado. Recomenda-se manutenção das condições verificadas e reavaliação periódica.</p>',
    },
  ],
  nao_conformidade: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Este Relatório de Não Conformidade ({{titulo}}) registra as não conformidades observadas durante a auditoria realizada na empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}), no setor {{setor}}, em {{data_inspecao}}. Cada item descreve a evidência encontrada, a norma violada, criticidade e ação corretiva proposta.</p>',
    },
    {
      titulo: "2. Metodologia",
      conteudo:
        '<p style="text-align: justify">A inspeção foi conduzida por meio de observação direta dos postos de trabalho, entrevistas com os trabalhadores e análise documental dos programas de segurança vigentes. As não conformidades foram classificadas em três níveis — ALTA, MÉDIA e BAIXA — segundo risco à integridade do trabalhador e prazo para regularização.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Recomenda-se que a empresa cumpra os prazos estabelecidos para cada não conformidade. As NCs de criticidade <strong>ALTA</strong> demandam ação imediata, sob pena de paralisação da atividade ou imposição de medidas legais. Reavaliação prevista após o tratamento das pendências.</p>',
    },
  ],
  analise_quimicos: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Análise de Agente Químico realizada com base nas informações da Ficha de Informações de Segurança de Produto Químico (FISPQ/FDS) do produto <strong>{{titulo}}</strong>, para a empresa <strong>{{empresa_nome}}</strong>.</p>',
    },
    {
      titulo: "2. Base Normativa",
      conteudo:
        '<p style="text-align: justify">Avaliação conduzida conforme NR-15 (Atividades e Operações Insalubres), NR-16 (Atividades e Operações Perigosas), ACGIH TLV/BEI, IARC Monographs e Decreto 3.048/99 Anexo IV.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">O parecer é informativo e não substitui avaliação ambiental quantitativa. Recomenda-se medição de exposição quando indicado e revisão sempre que houver alteração na composição do produto ou nas condições de uso.</p>',
    },
  ],
  apreciacao_maquinas: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Este laudo de Apreciação NR-12 foi elaborado para a máquina <strong>{{maquina_nome}}</strong>, localizada no setor {{setor}} da empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}), em {{data_apreciacao}}. A avaliação seguiu o checklist regulatório da NR-12 com {{total_itens}} itens, sendo {{total_nao_conforme}} classificados como Não Conformes.</p>',
    },
    {
      titulo: "2. Fundamentação Legal",
      conteudo:
        '<p style="text-align: justify">A apreciação foi conduzida com base na <strong>NR-12 — Segurança no Trabalho em Máquinas e Equipamentos</strong> (Portaria SIT 197/2010 com atualizações posteriores), complementada por <strong>ISO 12100</strong> (princípios gerais de projeto para segurança), <strong>ISO 13849</strong> (segurança em sistemas de comando) e <strong>NBR NM 272</strong> (distâncias de segurança para proteção dos membros superiores e inferiores).</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">O presente parecer não substitui a análise de risco específica exigida pelo item 12.131 da NR-12 nem dispensa a capacitação obrigatória dos operadores. Recomenda-se reavaliação periódica e sempre que houver modificação significativa na máquina ou no processo. Risco residual final apurado: <strong>{{risco_residual}}</strong>.</p>',
    },
  ],
};
