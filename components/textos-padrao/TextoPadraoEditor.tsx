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
  History,
  RotateCcw,
  Star,
} from "lucide-react";
import { useIsAdmin } from "@/lib/hooks/useUsuario";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StorageImg from "@/components/ui/StorageImg";
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
  useHistoricoCapitulo,
  useRestaurarVersao,
} from "@/lib/hooks/useTextosPadrao";
import {
  type ModuloTextoPadrao,
  type OrientacaoPagina,
  type PosicaoPdf,
  type QuebraPagina,
  type TextoPadraoCapitulo,
  type TextoPadraoVersao,
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
  const isAdmin = useIsAdmin();
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
  // Módulos com ordenação unificada (ex: AEP): o laudo é uma lista única de
  // blocos (editáveis + seções do sistema) na ordem de `ordem`.
  const unificado = !!config.ordenacaoUnificada;

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

  // Reordena DENTRO do grupo lógico: editáveis entre si por posição (é o
  // `ordem` dentro da posição que define a ordem no PDF), e fixos entre si.
  // Os fixos não são impressos como texto (são o corpo do laudo), então
  // reordená-los é só visual.
  async function mover(cap: TextoPadraoCapitulo, direcao: "up" | "down") {
    const grupo = capitulos
      .filter((c) =>
        unificado
          ? true // lista única: reordena entre TODOS os blocos
          : cap.tipo === "fixo"
          ? c.tipo === "fixo"
          : c.tipo !== "fixo" &&
            (c.posicao_pdf ?? "inicio") === (cap.posicao_pdf ?? "inicio")
      )
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const idx = grupo.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= grupo.length) return;

    // Reordena a lista e RE-SEQUENCIA as ordens (passo 10). Robusto a ordens
    // duplicadas/colididas (que antes faziam a troca simples não surtir efeito).
    const novaLista = [...grupo];
    const [item] = novaLista.splice(idx, 1);
    novaLista.splice(novoIdx, 0, item);
    await Promise.all(
      novaLista
        .map((c, i) => ({ c, novaOrdem: i * 10 }))
        .filter(({ c, novaOrdem }) => (c.ordem ?? 0) !== novaOrdem)
        .map(({ c, novaOrdem }) => salvar.mutateAsync({ id_capitulo: c.id_capitulo, ordem: novaOrdem })),
    );
  }

  // Editáveis agrupados por posição no laudo (reflete a ordem real do PDF):
  // tudo que não for "fim" entra antes do corpo do laudo; "fim" vai depois.
  const aplicaBusca = (lista: TextoPadraoCapitulo[]) =>
    busca.trim()
      ? lista.filter((c) =>
          c.titulo.toLowerCase().includes(busca.trim().toLowerCase())
        )
      : lista;
  const editavelInicio = aplicaBusca(
    capitulosEditaveis.filter((c) => (c.posicao_pdf ?? "inicio") !== "fim")
  );
  const editavelFim = aplicaBusca(
    capitulosEditaveis.filter((c) => (c.posicao_pdf ?? "inicio") === "fim")
  );

  function renderCardEditavel(cap: TextoPadraoCapitulo, idx: number, total: number) {
    return (
      <CapituloCard
        key={cap.id_capitulo}
        capitulo={cap}
        modulo={modulo}
        isAdmin={isAdmin}
        indice={idx}
        total={total}
        salvando={salvar.isPending}
        storagePrefix={`textos-padrao/${modulo}`}
        contagensPorPosicao={contagensPorPosicao}
        posicoesMod={config.posicoesDisponiveis}
        ocultarPosicao={unificado}
        onSalvar={(patch) =>
          salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })
        }
        onMover={(dir) => mover(cap, dir)}
        onExcluir={() => setConfirmExcluir(cap)}
        onToggleMostrar={() =>
          salvar.mutate({ id_capitulo: cap.id_capitulo, ativo: !cap.ativo })
        }
      />
    );
  }

  // Contagem apenas de capítulos editáveis por posição para o Stepper
  const contagensPorPosicao = capitulosEditaveis.reduce<
    Partial<Record<PosicaoPdf, number>>
  >((acc, c) => {
    const p = (c.posicao_pdf ?? "inicio") as PosicaoPdf;
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

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
          {/* Resumo */}
          <p className="text-xs text-gray-500">
            {capitulosFixos.length > 0 && (
              <>{capitulosFixos.length} seção{capitulosFixos.length !== 1 ? "ões" : ""} do sistema · </>
            )}
            {capitulosEditaveis.length} capítulo{capitulosEditaveis.length !== 1 ? "s" : ""} editáveis
            {capitulosEditaveis.filter((c) => !c.ativo).length > 0 && (
              <> · {capitulosEditaveis.filter((c) => !c.ativo).length} oculto{capitulosEditaveis.filter((c) => !c.ativo).length !== 1 ? "s" : ""}</>
            )}
          </p>

          {/* Modo UNIFICADO (ex: AEP): lista única reordenável — arraste
              qualquer bloco (texto editável ou seção do sistema) em qualquer
              ordem; é exatamente a ordem do laudo. Capa e assinatura ficam
              fixas nas pontas (não aparecem aqui). */}
          {unificado ? (
            <>
              <div className="rounded-md bg-verde-light/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-verde-primary">
                Ordem do laudo — arraste/reordene livremente (capa e assinatura são fixas)
              </div>
              {aplicaBusca(
                [...capitulos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
              ).map((cap, idx, arr) =>
                cap.tipo === "fixo" ? (
                  <FixoCard
                    key={cap.id_capitulo}
                    capitulo={cap}
                    indice={idx}
                    total={arr.length}
                    salvando={salvar.isPending}
                    descricao={
                      config.fixos.find((f) => f.slug_fixo === cap.slug_fixo)?.descricao ?? ""
                    }
                    onMover={(dir) => mover(cap, dir)}
                    onToggleMostrar={() =>
                      salvar.mutate({ id_capitulo: cap.id_capitulo, ativo: !cap.ativo })
                    }
                    onSalvar={(patch) =>
                      salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })
                    }
                  />
                ) : (
                  renderCardEditavel(cap, idx, arr.length)
                )
              )}
            </>
          ) : (
          <>
          {/* 1) Editáveis posicionados no INÍCIO (antes do corpo do laudo) */}
          {editavelInicio.length > 0 && (
            <>
              <div className="rounded-md bg-verde-light/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-verde-primary">
                Texto editável — início (sai antes do laudo)
              </div>
              {editavelInicio.map((cap, idx) =>
                renderCardEditavel(cap, idx, editavelInicio.length)
              )}
            </>
          )}

          {/* 2) Corpo do laudo — seções geradas pelo sistema (posição fixa) */}
          {capitulosFixos.length > 0 && (
            <>
              <div className="rounded-md bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Corpo do laudo — seções do sistema (posição fixa, entre início e fim)
              </div>
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

          {/* 3) Editáveis posicionados no FIM (depois do corpo do laudo) */}
          {editavelFim.length > 0 && (
            <>
              <div className="rounded-md bg-verde-light/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-verde-primary">
                Texto editável — fim (sai depois do laudo)
              </div>
              {editavelFim.map((cap, idx) =>
                renderCardEditavel(cap, idx, editavelFim.length)
              )}
            </>
          )}

          {busca && editavelInicio.length === 0 && editavelFim.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              Nenhum capítulo editável encontrado para <strong>&ldquo;{busca}&rdquo;</strong>.
            </div>
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
          excluir.mutate(confirmExcluir, {
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
  onSalvar: (patch: { orientacao?: OrientacaoPagina; quebra_pagina?: QuebraPagina }) => void;
}) {
  const orientacao = capitulo.orientacao ?? "retrato";
  const quebra = capitulo.quebra_pagina ?? "nova";

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

        {/* Início: Nova página / Continuação */}
        <div className="inline-flex overflow-hidden rounded-md border border-blue-200 bg-white shrink-0">
          <button type="button"
            onClick={() => quebra !== "nova" && onSalvar({ quebra_pagina: "nova" })}
            disabled={salvando}
            title="Inicia em uma nova página"
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
              quebra === "nova" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-blue-50"
            )}
          >
            <FilePlus2 className="size-3" /> Nova página
          </button>
          <button type="button"
            onClick={() => quebra !== "continua" && onSalvar({ quebra_pagina: "continua" })}
            disabled={salvando || indice === 0}
            title={indice === 0 ? "O primeiro capítulo começa em nova página" : "Continua na página do capítulo anterior"}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
              quebra === "continua" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-blue-50"
            )}
          >
            <AlignLeft className="size-3" /> Continuação
          </button>
        </div>

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
  modulo,
  isAdmin,
  indice,
  total,
  salvando,
  storagePrefix,
  contagensPorPosicao,
  posicoesMod,
  ocultarPosicao,
  onSalvar,
  onMover,
  onExcluir,
  onToggleMostrar,
}: {
  capitulo: TextoPadraoCapitulo;
  modulo: ModuloTextoPadrao;
  isAdmin: boolean;
  indice: number;
  total: number;
  salvando: boolean;
  storagePrefix: string;
  contagensPorPosicao: Partial<Record<PosicaoPdf, number>>;
  posicoesMod: PosicaoPdf[];
  /** Em ordenação unificada (ex: AEP), a posição é dada pela ordem na lista,
   *  então o seletor de posição é ocultado. */
  ocultarPosicao?: boolean;
  onSalvar: (patch: {
    titulo?: string;
    conteudo?: string | null;
    bg_imagem_url?: string | null;
    caixas_texto?: CaixaTexto[] | null;
    orientacao?: OrientacaoPagina;
    quebra_pagina?: QuebraPagina;
    posicao_pdf?: PosicaoPdf;
    ativo?: boolean;
    bloqueado?: boolean;
    obrigatorio?: boolean;
  }) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
  onToggleMostrar: () => void;
}) {
  // E5: texto travado — só admin edita. Obrigatório não pode ser ocultado.
  const travado = capitulo.bloqueado && !isAdmin;
  const [titulo, setTitulo] = useState(capitulo.titulo);
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [caixas, setCaixas] = useState<CaixaTexto[]>(
    capitulo.caixas_texto ?? []
  );
  const [dirty, setDirty] = useState(false);
  const [enviandoBg, setEnviandoBg] = useState(false);
  const [histAberto, setHistAberto] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const migrated = useRef(false);

  useEffect(() => {
    setTitulo(capitulo.titulo);
    setConteudo(capitulo.conteudo ?? "");
    setCaixas(capitulo.caixas_texto ?? []);
    setDirty(false);
    migrated.current = false;
  }, [
    capitulo.id_capitulo,
    capitulo.titulo,
    capitulo.conteudo,
    capitulo.caixas_texto,
  ]);

  useEffect(() => {
    if (ocultarPosicao || migrated.current) return;
    const pos = (capitulo.posicao_pdf ?? "inicio") as PosicaoPdf;
    if (posicoesMod.length > 0 && !posicoesMod.includes(pos)) {
      migrated.current = true;
      onSalvar({ posicao_pdf: posicoesMod[0] });
    }
  }, [capitulo.posicao_pdf, posicoesMod, onSalvar, ocultarPosicao]);

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
        {capitulo.bloqueado && (
          <span className="mt-2 inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700" title="Texto travado — só admin edita">
            <Lock className="size-2.5" /> Travado
          </span>
        )}
        {capitulo.obrigatorio && (
          <span className="mt-2 inline-flex shrink-0 items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700" title="Obrigatório — não pode ser ocultado">
            Obrigatório
          </span>
        )}
        <input
          type="text"
          value={titulo}
          readOnly={travado}
          onChange={(e) => {
            setTitulo(e.target.value);
            setDirty(true);
          }}
          placeholder="Título do capítulo"
          className={cn(
            "flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30",
            travado && "bg-gray-50 text-gray-500",
          )}
        />
        {/* Admin: travar / marcar obrigatório */}
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => onSalvar({ bloqueado: !capitulo.bloqueado })}
              disabled={salvando}
              title={capitulo.bloqueado ? "Destravar (permitir edição por todos)" : "Travar (só admin edita)"}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-2 transition-colors disabled:opacity-50",
                capitulo.bloqueado
                  ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-gray-300 bg-white text-gray-400 hover:bg-gray-50",
              )}
            >
              <Lock className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSalvar({ obrigatorio: !capitulo.obrigatorio })}
              disabled={salvando}
              title={capitulo.obrigatorio ? "Tornar opcional" : "Tornar obrigatório (não pode ocultar)"}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-2 transition-colors disabled:opacity-50",
                capitulo.obrigatorio
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-gray-300 bg-white text-gray-400 hover:bg-gray-50",
              )}
            >
              <Star className={cn("size-3.5", capitulo.obrigatorio && "fill-blue-500 text-blue-500")} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onToggleMostrar}
          disabled={salvando || capitulo.obrigatorio}
          title={capitulo.obrigatorio ? "Obrigatório — não pode ocultar" : capitulo.ativo ? "Ocultar no laudo" : "Mostrar no laudo"}
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
          disabled={!dirty || salvando || !titulo.trim() || travado}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setHistAberto(true)}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-sky-50 hover:text-sky-700"
          title="Histórico de versões"
        >
          <History className="size-4" />
        </button>
        {!travado && (
          <button
            type="button"
            onClick={onExcluir}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-alert"
            title="Excluir"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {histAberto && (
        <HistoricoVersoesModal
          capitulo={capitulo}
          modulo={modulo}
          onFechar={() => setHistAberto(false)}
        />
      )}
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

        {/* V53: Posição no PDF — Stepper visual (oculto na ordenação unificada) */}
        {!ocultarPosicao && (
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
              posicoes={posicoesMod}
            />
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Imagem de fundo (capa):
        </span>
        {capitulo.bg_imagem_url ? (
          <>
            <StorageImg
              stored={capitulo.bg_imagem_url}
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
          readOnly={travado}
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
// HistoricoVersoesModal — histórico de versões de um capítulo (Fase 2)
// ============================================================

function resumoVersao(v: TextoPadraoVersao): string {
  if (v.bg_imagem_url) return "[Capa / imagem de fundo]";
  const texto = (v.conteudo ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!texto) return "(sem conteúdo)";
  return texto.length > 180 ? texto.slice(0, 180) + "…" : texto;
}

function HistoricoVersoesModal({
  capitulo,
  modulo,
  onFechar,
}: {
  capitulo: TextoPadraoCapitulo;
  modulo: ModuloTextoPadrao;
  onFechar: () => void;
}) {
  const { data: versoes = [], isLoading } = useHistoricoCapitulo(capitulo.id_capitulo);
  const restaurar = useRestaurarVersao(modulo);
  const [confirmar, setConfirmar] = useState<TextoPadraoVersao | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-sky-700" />
            <h3 className="text-sm font-semibold text-gray-900">
              Histórico — {capitulo.titulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <LoadingSkeleton rows={3} />
          ) : versoes.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Nenhuma versão registrada ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {versoes.map((v, idx) => (
                <li
                  key={v.id_versao}
                  className="rounded-lg border border-gray-200 bg-gray-50/60 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                        v{v.versao}
                      </span>
                      {idx === 0 && (
                        <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                          Atual
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500">
                        {new Date(v.editado_em).toLocaleString("pt-BR")}
                        {v.editado_por ? ` · ${v.editado_por}` : ""}
                      </span>
                    </div>
                    {idx !== 0 && (
                      <button
                        type="button"
                        onClick={() => setConfirmar(v)}
                        disabled={restaurar.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                      >
                        <RotateCcw className="size-3" /> Restaurar
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{resumoVersao(v)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmar}
        title={`Restaurar versão ${confirmar?.versao ?? ""}?`}
        description="O conteúdo atual do capítulo será substituído por esta versão. A versão atual permanece no histórico (a restauração gera uma nova versão)."
        loading={restaurar.isPending}
        onConfirm={() => {
          if (!confirmar) return;
          restaurar.mutate(confirmar, {
            onSuccess: () => {
              setConfirmar(null);
              onFechar();
            },
          });
        }}
        onCancel={() => setConfirmar(null)}
      />
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
  aep: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Esta Análise Ergonômica Preliminar foi elaborada para a empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}), com o objetivo de identificar os principais riscos ergonômicos presentes nos postos de trabalho avaliados, em conformidade com a <strong>NR-17 — Ergonomia</strong>.</p>',
    },
    {
      titulo: "2. Metodologia",
      conteudo:
        '<p style="text-align: justify">A avaliação foi realizada por meio de inspeção visual, entrevistas com trabalhadores e análise das condições de trabalho, abrangendo aspectos físicos, cognitivos e organizacionais conforme a metodologia de triagem ergonômica. A AEP não substitui a Análise Ergonômica do Trabalho completa (AET), sendo recomendada quando houver indicadores que justifiquem aprofundamento.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Recomenda-se a implementação das medidas corretivas identificadas neste relatório, com prioridade para os setores de maior risco ergonômico. Para os setores em que foi indicada necessidade de AET completa, sugere-se a contratação de estudo aprofundado conforme NR-17.</p>',
    },
  ],
  aet: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Este Laudo de Análise Ergonômica do Trabalho foi elaborado para a empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}), atendendo às exigências da <strong>NR-17 — Ergonomia</strong> e da <strong>NR-01</strong> (GRO/PGR). O estudo abrange os postos de trabalho, condições ambientais e organização do trabalho dos setores avaliados.</p>',
    },
    {
      titulo: "2. Metodologia",
      conteudo:
        '<p style="text-align: justify">A avaliação ergonômica foi conduzida por meio de: inspeção visual dos postos de trabalho; análise postural pelo método OWAS; aplicação do QPS Nordic para fatores psicossociais; medições ambientais (iluminação, ruído, temperatura); e entrevistas com trabalhadores e gestores. As ferramentas utilizadas seguem padrões ABNT, ISO 9241 e literatura ergonômica especializada.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">As medidas recomendadas neste laudo visam adequar as condições de trabalho às capacidades e limitações dos trabalhadores, reduzindo a exposição a fatores de risco ergonômico. Recomenda-se revisão periódica deste estudo, especialmente quando houver alterações significativas nos postos de trabalho, nos processos produtivos ou no quadro de trabalhadores.</p>',
    },
  ],
  psicossocial: [
    {
      titulo: "1. Introdução",
      conteudo:
        '<p style="text-align: justify">Este Diagnóstico de Riscos Psicossociais foi elaborado para a empresa <strong>{{empresa_nome}}</strong> (CNPJ {{cnpj}}), em conformidade com a <strong>NR-01</strong> (GRO/PGR) e com as diretrizes da Organização Mundial da Saúde para gestão de riscos psicossociais no trabalho.</p>',
    },
    {
      titulo: "2. Metodologia",
      conteudo:
        '<p style="text-align: justify">O diagnóstico foi conduzido por meio da aplicação do questionário <strong>QPS Nordic</strong> (Questionário Psicossocial Nórdico), instrumento validado para avaliação de fatores psicossociais no ambiente de trabalho. A coleta ocorreu entre {{data_carimbo_inicio}} e {{data_carimbo_fim}}, com análise estatística dos resultados por setor e função.</p>',
    },
    {
      titulo: "3. Considerações Finais",
      conteudo:
        '<p style="text-align: justify">Os resultados deste diagnóstico devem ser utilizados como subsídio para a elaboração do Plano de Ação de Controle dos Riscos Psicossociais, com priorização das medidas de acordo com a gravidade e probabilidade identificadas. Recomenda-se nova avaliação em prazo não superior a 12 meses.</p>',
    },
  ],
};
