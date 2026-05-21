"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RectangleHorizontal,
  Save,
  Search,
  Trash2,
  Variable,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import RichTextEditor from "@/components/drps/RichTextEditor";
import CapaEditor from "@/components/drps/CapaEditor";
import PosicaoPdfStepper, { type PosicaoPdfValor } from "@/components/textos-padrao/PosicaoPdfStepper";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CaixaTexto } from "@/lib/drps/types";
import {
  useAetTextoPadrao,
  useAetCriarCapitulo,
  useAetSalvarCapitulo,
  useAetExcluirCapitulo,
} from "@/lib/hooks/useAet";
import type { AetTextoPadraoCapitulo } from "@/lib/supabase/types";
import { VARIAVEIS_AET } from "@/lib/textos-padrao/variaveis-aet";

// ─── Template inicial NR-17 ───────────────────────────────────────────────────

const TEMPLATE_INICIAL: { titulo: string; conteudo: string; posicao_pdf: PosicaoPdfValor }[] = [
  {
    titulo: "1 – Caracterização da Empresa",
    conteudo: "<p>Razão Social: <strong>{{empresa_nome}}</strong> — CNPJ: {{cnpj}}</p><p>Endereço: {{endereco_empresa}}</p>",
    posicao_pdf: "inicio",
  },
  {
    titulo: "2 – Introdução Geral",
    conteudo:
      "<p>A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.</p>" +
      "<p>A mesma pode ser ainda caracterizada como a ocupação de pessoas qualificadas em grupos de pesquisa e formação que atuam em equipes de projeto e consultoria para responder às demandas acerca da atividade de trabalho na sociedade mediante metodologias de análises e projeto de bases científicas e devidamente inseridas num universo normativo e contratual.</p>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "3 – Objetivo",
    conteudo:
      "<p>Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.</p>" +
      "<p><strong>BASE LEGAL:</strong> Portaria 3.214/78 do Ministério do Trabalho – NR-17</p>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "4 – Metodologia",
    conteudo:
      "<p>Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET, excluindo-se a metodologia por amostragem, uma vez que cada função de trabalho caracteriza um desenvolvimento laboral de forma diferenciada.</p>" +
      "<p>A AET tem por finalidade transformar as condições de trabalho e adaptar às características psicofisiológicas dos trabalhadores, buscando conciliar dois universos: saúde e produtividade.</p>" +
      "<p>A metodologia da AET utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas suas diferentes dimensões (física, cognitiva, mental e social).</p>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "5 – Levantamento, Transporte e Descarga Individual de Materiais",
    conteudo:
      "<p>Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua capacidade de força e não comprometa a sua saúde ou sua segurança.</p>" +
      "<p>Para manipulações ocasionais, não repetitivas, o limite de 25 quilos para homens e 15 quilos para mulheres é sugerido por vários autores, desde que observadas boas práticas para a manipulação.</p>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "6 – Mobiliário dos Postos de Trabalho",
    conteudo:
      "<p>A análise ergonômica do trabalho leva em consideração que:</p>" +
      "<ul><li>Sempre que possível o trabalho deve ser executado na posição sentada;</li>" +
      "<li>O mobiliário deve prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais;</li>" +
      "<li>Os comandos sejam de fácil acionamento;</li>" +
      "<li>Os assentos sejam adequados.</li></ul>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "7 – Equipamentos dos Postos de Trabalho",
    conteudo:
      "<p>A análise ergonômica do trabalho leva em consideração que o mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais, em boa condição postural e livre de reflexos.</p>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "8 – Condições Ambientais de Trabalho",
    conteudo:
      "<p>O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa de Gerenciamento de Riscos – PGR da empresa.</p>",
    posicao_pdf: "apos_sumario",
  },
  {
    titulo: "11 – Organização do Trabalho",
    conteudo:
      "<p>Na análise foram levados em consideração os seguintes aspectos:</p>" +
      "<ul><li>As normas de produção;</li><li>O modo operatório;</li><li>A exigência de tempo;</li>" +
      "<li>A determinação do conteúdo de tempo;</li><li>O ritmo de trabalho;</li>" +
      "<li>O conteúdo das tarefas;</li><li>Horário de trabalho.</li></ul>",
    posicao_pdf: "apos_setores",
  },
  {
    titulo: "12 – Ferramentas Biomecânicas Aplicadas",
    conteudo:
      "<p>Método OWAS: O Método OWAS (Ovako Working Posture Analysing System) foi desenvolvido na Finlândia por Karhu, Kansi e Kuorinka, entre 1974 e 1978, juntamente com o Instituto Finlandês de Saúde Ocupacional, objetivando gerar informações para melhorar os métodos de trabalho pela identificação de posturas corporais prejudiciais durante a realização das atividades.</p>",
    posicao_pdf: "apos_setores",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetTextoPadraoPage() {
  const { data: capitulos = [], isLoading } = useAetTextoPadrao();
  const criar = useAetCriarCapitulo();
  const salvar = useAetSalvarCapitulo();
  const excluir = useAetExcluirCapitulo();

  const [confirmExcluir, setConfirmExcluir] = useState<AetTextoPadraoCapitulo | null>(null);
  const [mostrarVars, setMostrarVars] = useState(false);
  const [busca, setBusca] = useState("");

  const contagensPorPosicao = capitulos.reduce<Partial<Record<PosicaoPdfValor, number>>>(
    (acc, c) => {
      const p = (c.posicao_pdf ?? "inicio") as PosicaoPdfValor;
      acc[p] = (acc[p] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const capitulosFiltrados = busca.trim()
    ? capitulos.filter((c) => c.titulo.toLowerCase().includes(busca.trim().toLowerCase()))
    : capitulos;

  function novoCapitulo() {
    criar.mutate({
      titulo: `Capítulo ${capitulos.length + 1}`,
      conteudo: "",
      ordem: capitulos.length,
      posicao_pdf: "inicio",
    });
  }

  function seedTemplate() {
    let ordem = capitulos.length;
    for (const tpl of TEMPLATE_INICIAL) {
      criar.mutate({ titulo: tpl.titulo, conteudo: tpl.conteudo, ordem, posicao_pdf: tpl.posicao_pdf });
      ordem++;
    }
  }

  function mover(cap: AetTextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulos.length) return;
    const outro = capitulos[novoIdx];
    salvar.mutate({ id_capitulo: cap.id_capitulo, ordem: outro.ordem });
    salvar.mutate({ id_capitulo: outro.id_capitulo, ordem: cap.ordem });
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Texto Padrão — AET</h1>
          <p className="max-w-2xl text-sm text-gray-600">
            Capítulos reutilizáveis para o laudo de Análise Ergonômica do Trabalho (NR-17).
            Use variáveis como <code className="rounded bg-gray-100 px-1 text-xs">{"{{empresa_nome}}"}</code> para
            preenchimento automático na geração do PDF.
          </p>
          <p className="mt-1 text-xs italic text-teal-700">Aparecem no laudo AET conforme a posição configurada.</p>
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
          {capitulos.length === 0 && !isLoading && (
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

      {/* Painel de variáveis */}
      {mostrarVars && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-700">
            Variáveis disponíveis — AET
          </p>
          <p className="mb-2 text-xs text-gray-600">
            Insira no conteúdo do capítulo as marcações abaixo. Elas serão substituídas pelos
            valores reais do relatório ao gerar o PDF.
          </p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {VARIAVEIS_AET.map((v) => (
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

      {/* Busca */}
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

      {/* Lista de capítulos */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={3} />
        </div>
      ) : capitulos.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          Nenhum capítulo cadastrado ainda. Clique em{" "}
          <strong>Carregar modelo inicial</strong> para popular com as seções padrão da NR-17
          ou em <strong>Novo Capítulo</strong> para começar do zero.
        </div>
      ) : capitulosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Nenhum capítulo encontrado para <strong>&ldquo;{busca}&rdquo;</strong>.
        </div>
      ) : (
        <div className="space-y-3">
          {busca && (
            <p className="text-xs text-gray-500">
              {capitulosFiltrados.length} de {capitulos.length} capítulo{capitulos.length !== 1 ? "s" : ""}
            </p>
          )}
          {capitulosFiltrados.map((cap, i) => (
            <CapituloCard
              key={cap.id_capitulo}
              capitulo={cap}
              indice={capitulos.findIndex((c) => c.id_capitulo === cap.id_capitulo)}
              total={capitulos.length}
              salvando={salvar.isPending}
              contagensPorPosicao={contagensPorPosicao}
              onSalvar={(patch) => salvar.mutate({ id_capitulo: cap.id_capitulo, ...patch })}
              onMover={(dir) => mover(cap, dir)}
              onExcluir={() => setConfirmExcluir(cap)}
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
}: {
  capitulo: AetTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  contagensPorPosicao: Partial<Record<PosicaoPdfValor, number>>;
  onSalvar: (patch: Partial<Omit<AetTextoPadraoCapitulo, "id_capitulo" | "created_at" | "updated_at">>) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
}) {
  const [titulo, setTitulo] = useState(capitulo.titulo);
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [caixas, setCaixas] = useState<CaixaTexto[]>(capitulo.caixas_texto ?? []);
  const [dirty, setDirty] = useState(false);
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
      const path = `aet-texto-padrao/bg-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined });
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

  const orientacao = capitulo.orientacao ?? "retrato";
  const quebraPagina = capitulo.quebra_pagina ?? "nova";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Linha do título */}
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col gap-0.5">
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

        <input
          type="text"
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setDirty(true); }}
          placeholder="Título do capítulo"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        />

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
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-alert"
          title="Excluir capítulo"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Configurações: orientação, quebra_pagina, posição, imagem */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        {/* Orientação */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Orientação:
          </span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => orientacao !== "retrato" && onSalvar({ orientacao: "retrato" })}
              disabled={salvando}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                orientacao === "retrato"
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FileText className="size-3.5" /> Retrato
            </button>
            <button
              type="button"
              onClick={() => orientacao !== "paisagem" && onSalvar({ orientacao: "paisagem" })}
              disabled={salvando}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                orientacao === "paisagem"
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <RectangleHorizontal className="size-3.5" /> Paisagem
            </button>
          </div>
        </div>

        {/* Início da página */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Início:
          </span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => quebraPagina !== "nova" && onSalvar({ quebra_pagina: "nova" })}
              disabled={salvando || !!capitulo.bg_imagem_url}
              title={capitulo.bg_imagem_url ? "Capa sempre é nova página" : "Inicia em nova página"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                quebraPagina === "nova" || capitulo.bg_imagem_url
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FilePlus2 className="size-3.5" /> Nova página
            </button>
            <button
              type="button"
              onClick={() => quebraPagina !== "continua" && onSalvar({ quebra_pagina: "continua" })}
              disabled={salvando || !!capitulo.bg_imagem_url || indice === 0}
              title={
                capitulo.bg_imagem_url
                  ? "Capa sempre é nova página"
                  : indice === 0
                  ? "O primeiro capítulo precisa começar em nova página"
                  : "Continua na página do capítulo anterior"
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                quebraPagina === "continua" && !capitulo.bg_imagem_url
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
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

        {/* Posição no PDF */}
        <div className="w-full">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
            📍 Posição no Relatório
          </p>
          <PosicaoPdfStepper
            valor={(capitulo.posicao_pdf ?? "inicio") as PosicaoPdfValor}
            onChange={(p) => onSalvar({ posicao_pdf: p })}
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
            <img
              src={capitulo.bg_imagem_url}
              alt="Fundo"
              className="h-10 w-16 rounded border border-gray-300 object-cover"
            />
            <span className="text-[10px] text-gray-600">Este capítulo sai como página inteira no PDF.</span>
            <button
              type="button"
              onClick={() => onSalvar({ bg_imagem_url: null })}
              disabled={salvando}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-alert disabled:opacity-50"
            >
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
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            disabled={enviandoBg || salvando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-2 py-1 text-xs font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
          >
            {enviandoBg ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            Enviar imagem
          </button>
        )}
      </div>

      {/* Editor de conteúdo */}
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
          uploadPathPrefix="aet-textos"
        />
      )}
    </div>
  );
}
