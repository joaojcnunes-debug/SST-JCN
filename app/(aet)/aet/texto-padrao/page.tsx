"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  RectangleHorizontal,
  Save,
  Search,
  Sparkles,
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
  useAetSeedCapitulosFixos,
} from "@/lib/hooks/useAet";
import type { AetTextoPadraoCapitulo } from "@/lib/supabase/types";
import { VARIAVEIS_AET } from "@/lib/textos-padrao/variaveis-aet";
import { cn } from "@/lib/utils";

// ─── Template inicial NR-17 ───────────────────────────────────────────────────

const TEMPLATE_INICIAL: { titulo: string; conteudo: string; posicao_pdf: PosicaoPdfValor; ordem_global: number }[] = [
  {
    titulo: "1 – Caracterização da Empresa",
    conteudo: "<p>Razão Social: <strong>{{empresa_nome}}</strong> — CNPJ: {{cnpj}}</p><p>Endereço: {{endereco_empresa}}</p>",
    posicao_pdf: "inicio",
    ordem_global: 0,
  },
  {
    titulo: "2 – Introdução Geral",
    conteudo:
      "<p>A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.</p>" +
      "<p>A mesma pode ser ainda caracterizada como a ocupação de pessoas qualificadas em grupos de pesquisa e formação que atuam em equipes de projeto e consultoria para responder às demandas acerca da atividade de trabalho na sociedade mediante metodologias de análises e projeto de bases científicas e devidamente inseridas num universo normativo e contratual.</p>",
    posicao_pdf: "apos_sumario",
    ordem_global: 1000,
  },
  {
    titulo: "3 – Objetivo",
    conteudo:
      "<p>Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.</p>" +
      "<p><strong>BASE LEGAL:</strong> Portaria 3.214/78 do Ministério do Trabalho – NR-17</p>",
    posicao_pdf: "apos_sumario",
    ordem_global: 1010,
  },
  {
    titulo: "4 – Metodologia",
    conteudo:
      "<p>Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET, excluindo-se a metodologia por amostragem, uma vez que cada função de trabalho caracteriza um desenvolvimento laboral de forma diferenciada.</p>" +
      "<p>A AET tem por finalidade transformar as condições de trabalho e adaptar às características psicofisiológicas dos trabalhadores, buscando conciliar dois universos: saúde e produtividade.</p>" +
      "<p>A metodologia da AET utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas suas diferentes dimensões (física, cognitiva, mental e social).</p>",
    posicao_pdf: "apos_sumario",
    ordem_global: 1020,
  },
  {
    titulo: "5 – Levantamento, Transporte e Descarga Individual de Materiais",
    conteudo:
      "<p>Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua capacidade de força e não comprometa a sua saúde ou sua segurança.</p>" +
      "<p>Para manipulações ocasionais, não repetitivas, o limite de 25 quilos para homens e 15 quilos para mulheres é sugerido por vários autores, desde que observadas boas práticas para a manipulação.</p>",
    posicao_pdf: "apos_sumario",
    ordem_global: 1030,
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
    ordem_global: 1040,
  },
  {
    titulo: "7 – Equipamentos dos Postos de Trabalho",
    conteudo:
      "<p>A análise ergonômica do trabalho leva em consideração que o mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais, em boa condição postural e livre de reflexos.</p>",
    posicao_pdf: "apos_sumario",
    ordem_global: 1050,
  },
  {
    titulo: "8 – Condições Ambientais de Trabalho",
    conteudo:
      "<p>O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa de Gerenciamento de Riscos – PGR da empresa.</p>",
    posicao_pdf: "apos_sumario",
    ordem_global: 1060,
  },
  {
    titulo: "10 – Conforto em Áreas Administrativas",
    conteudo:
      "<p>A temperatura efetiva foi avaliada utilizando um termo higrômetro eletrônico. Foram considerados os limites: temperatura efetiva entre 20 a 23 ºC (NR-17, item 17.5.2.1.b), velocidade do ar não superior a 0,75 m/s (item 17.5.2.1.c) e umidade relativa mínima de 40% (item 17.5.2.1.d).</p>",
    posicao_pdf: "apos_setores",
    ordem_global: 3000,
  },
  {
    titulo: "11 – Organização do Trabalho",
    conteudo:
      "<p>Na análise foram levados em consideração os seguintes aspectos:</p>" +
      "<ul><li>As normas de produção;</li><li>O modo operatório;</li><li>A exigência de tempo;</li>" +
      "<li>A determinação do conteúdo de tempo;</li><li>O ritmo de trabalho;</li>" +
      "<li>O conteúdo das tarefas;</li><li>Horário de trabalho.</li></ul>",
    posicao_pdf: "apos_setores",
    ordem_global: 3010,
  },
  {
    titulo: "12 – Ferramentas Biomecânicas Aplicadas",
    conteudo:
      "<p>Método OWAS: O Método OWAS (Ovako Working Posture Analysing System) foi desenvolvido na Finlândia por Karhu, Kansi e Kuorinka, entre 1974 e 1978, juntamente com o Instituto Finlandês de Saúde Ocupacional, objetivando gerar informações para melhorar os métodos de trabalho pela identificação de posturas corporais prejudiciais durante a realização das atividades.</p>",
    posicao_pdf: "apos_setores",
    ordem_global: 3020,
  },
];

// ─── Descrição dos capítulos fixos do sistema ─────────────────────────────────

const SLUG_DESCRICAO: Record<string, string> = {
  aet_agentes_ambientais:   "Tabela de agentes/riscos por setor — gerada automaticamente a partir dos setores cadastrados.",
  aet_analise_ergonomica:   "OWAS, checklist ergonômico, fotos, parecer e recomendações por setor — gerado automaticamente.",
  aet_psicossocial:         "Seções 14–19: intro QPS, dados de aplicação, resultados, análise, perigos e plano de ação — gerado automaticamente.",
  aet_consideracoes_finais: "Campo de texto rico editável diretamente no laudo + bloco de assinatura do responsável técnico.",
  aet_assinatura:           "Rodapé de assinatura do responsável técnico — gerado automaticamente com os dados informados no laudo.",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetTextoPadraoPage() {
  const { data: capitulos = [], isLoading } = useAetTextoPadrao();
  const criar = useAetCriarCapitulo();
  const salvar = useAetSalvarCapitulo();
  const excluir = useAetExcluirCapitulo();
  const seedFixos = useAetSeedCapitulosFixos();

  const [confirmExcluir, setConfirmExcluir] = useState<AetTextoPadraoCapitulo | null>(null);
  const [mostrarVars, setMostrarVars] = useState(false);
  const [busca, setBusca] = useState(false ? "" : "");

  // Ordenação global: usa ordem_global se disponível, senão fallback para ordem
  const capitulosOrdenados = [...capitulos].sort(
    (a, b) => (a.ordem_global ?? a.ordem * 10) - (b.ordem_global ?? b.ordem * 10)
  );

  const capitulosFiltrados = capitulosOrdenados;

  function novoCapitulo() {
    const maxGlobal = capitulos.reduce((m, c) => Math.max(m, c.ordem_global ?? c.ordem * 10), 0);
    criar.mutate({
      titulo: `Capítulo ${capitulos.filter((c) => c.tipo !== "fixo").length + 1}`,
      conteudo: "",
      ordem: capitulos.length,
      posicao_pdf: "inicio",
      tipo: "editavel",
      ordem_global: maxGlobal + 100,
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
        posicao_pdf: tpl.posicao_pdf,
        tipo: "editavel",
        ordem_global: tpl.ordem_global,
      });
    }
    toast.success(`${novas.length} seção(ões) adicionada(s).`);
  }

  function mover(cap: AetTextoPadraoCapitulo, direcao: "up" | "down") {
    const idx = capitulosOrdenados.findIndex((c) => c.id_capitulo === cap.id_capitulo);
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= capitulosOrdenados.length) return;
    const outro = capitulosOrdenados[novoIdx];
    const ordemA = cap.ordem_global ?? cap.ordem * 10;
    const ordemB = outro.ordem_global ?? outro.ordem * 10;
    salvar.mutate({ id_capitulo: cap.id_capitulo, ordem_global: ordemB });
    salvar.mutate({ id_capitulo: outro.id_capitulo, ordem_global: ordemA });
  }

  function toggleMostrar(cap: AetTextoPadraoCapitulo) {
    salvar.mutate({ id_capitulo: cap.id_capitulo, mostrar: !cap.mostrar });
  }

  const contagensPorPosicao = capitulos.reduce<Partial<Record<PosicaoPdfValor, number>>>(
    (acc, c) => {
      const p = (c.posicao_pdf ?? "inicio") as PosicaoPdfValor;
      acc[p] = (acc[p] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Texto Padrão — AET</h1>
          <p className="max-w-2xl text-sm text-gray-600">
            Capítulos do laudo de Análise Ergonômica do Trabalho (NR-17). Capítulos{" "}
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">SISTEMA</span>{" "}
            são gerados automaticamente; capítulos{" "}
            <span className="rounded bg-verde-light px-1.5 py-0.5 text-[11px] font-bold text-verde-primary">EDITÁVEL</span>{" "}
            contêm texto livre ou variáveis como{" "}
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
            onClick={() => seedFixos.mutate(capitulos)}
            disabled={seedFixos.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            title="Adiciona os capítulos gerados pelo sistema (Seções 9, 13, 14-19, 20 e Assinatura)"
          >
            {seedFixos.isPending ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
            Seções do sistema
          </button>
          {!isLoading && (
            <button
              type="button"
              onClick={seedTemplate}
              disabled={criar.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-verde-primary bg-white px-3 py-2 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-50"
              title="Adiciona as seções padrão NR-17 editáveis (1-12) que ainda não existem"
            >
              <BookOpen className="size-4" />
              {capitulos.filter((c) => c.tipo !== "fixo").length === 0
                ? "Carregar modelo inicial"
                : "Adicionar seções padrão"}
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
                >
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista unificada */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={4} />
        </div>
      ) : capitulos.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
          Nenhum capítulo cadastrado ainda. Clique em{" "}
          <strong>Seções do sistema</strong> para adicionar as seções automáticas e em{" "}
          <strong>Carregar modelo inicial</strong> para as seções editáveis NR-17.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            {capitulos.length} capítulo{capitulos.length !== 1 ? "s" : ""} no total ·{" "}
            {capitulos.filter((c) => c.tipo === "fixo").length} do sistema ·{" "}
            {capitulos.filter((c) => c.tipo !== "fixo").length} editáveis
          </p>
          {capitulosFiltrados.map((cap, idx) => {
            if (cap.tipo === "fixo") {
              return (
                <FixoCard
                  key={cap.id_capitulo}
                  capitulo={cap}
                  indice={idx}
                  total={capitulosFiltrados.length}
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
                total={capitulosFiltrados.length}
                salvando={salvar.isPending}
                contagensPorPosicao={contagensPorPosicao}
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

// ─── Card de capítulo SISTEMA (fixo) ─────────────────────────────────────────

const SLUGS_COM_IA = new Set([
  "aet_agentes_ambientais",
  "aet_analise_ergonomica",
  "aet_psicossocial",
  "aet_consideracoes_finais",
]);

function FixoCard({
  capitulo,
  indice,
  total,
  salvando,
  onMover,
  onToggleMostrar,
  onSalvar,
}: {
  capitulo: AetTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  onMover: (dir: "up" | "down") => void;
  onToggleMostrar: () => void;
  onSalvar: (patch: Partial<Omit<AetTextoPadraoCapitulo, "id_capitulo" | "created_at" | "updated_at">>) => void;
}) {
  const descricao = capitulo.slug_fixo ? SLUG_DESCRICAO[capitulo.slug_fixo] : null;
  const orientacao = capitulo.orientacao ?? "retrato";
  const temIA = capitulo.slug_fixo ? SLUGS_COM_IA.has(capitulo.slug_fixo) : false;
  const [conteudo, setConteudo] = useState(capitulo.conteudo ?? "");
  const [expandido, setExpandido] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [dirtyConteudo, setDirtyConteudo] = useState(false);

  useEffect(() => {
    setConteudo(capitulo.conteudo ?? "");
    setDirtyConteudo(false);
  }, [capitulo.id_capitulo, capitulo.conteudo]);

  async function gerarIA() {
    if (!capitulo.slug_fixo) return;
    setGerandoIA(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.functions.invoke("gerar-intro-capitulo-aet-ia", {
        body: {
          slug_fixo: capitulo.slug_fixo,
          textoAtual: conteudo || null,
        },
      });
      if (error) {
        const msg = (error as { message?: string })?.message ?? JSON.stringify(error);
        toast.error(`IA: ${msg}`);
        return;
      }
      const intro: string = data?.data?.intro ?? data?.intro ?? "";
      if (!intro) { toast.error("IA não retornou texto"); return; }
      setConteudo(intro);
      setDirtyConteudo(true);
      setExpandido(true);
    } catch (err) {
      toast.error(`IA: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGerandoIA(false);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-blue-50/60 p-3 shadow-sm",
      capitulo.mostrar ? "border-blue-200" : "border-gray-200 opacity-60"
    )}>
      <div className="flex items-center gap-2">
        {/* Setas */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onMover("up")}
            disabled={indice === 0}
            className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-700 disabled:opacity-30"
            title="Mover para cima"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover("down")}
            disabled={indice === total - 1}
            className="rounded p-1 text-gray-400 hover:bg-blue-100 hover:text-gray-700 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        {/* Badge SISTEMA */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Lock className="size-2.5" /> Sistema
        </span>

        {/* Título */}
        <p className="flex-1 text-sm font-semibold text-gray-800">{capitulo.titulo}</p>

        {/* Orientação */}
        <div className="inline-flex overflow-hidden rounded-md border border-blue-200 bg-white shrink-0">
          <button
            type="button"
            onClick={() => orientacao !== "retrato" && onSalvar({ orientacao: "retrato" })}
            disabled={salvando}
            title="Página retrato (vertical)"
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
              orientacao === "retrato" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-blue-50"
            )}
          >
            <FileText className="size-3" /> Retrato
          </button>
          <button
            type="button"
            onClick={() => orientacao !== "paisagem" && onSalvar({ orientacao: "paisagem" })}
            disabled={salvando}
            title="Página paisagem (horizontal)"
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
              orientacao === "paisagem" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-blue-50"
            )}
          >
            <RectangleHorizontal className="size-3" /> Paisagem
          </button>
        </div>

        {/* Toggle visibilidade */}
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
        <p className="mt-1.5 pl-16 text-[11px] italic text-blue-700/80">
          {descricao}
          {orientacao === "paisagem" && (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 not-italic">
              A4 horizontal
            </span>
          )}
        </p>
      )}

      {/* Área de texto introdutório + IA */}
      {temIA && (
        <div className="mt-2 pl-16">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={gerarIA}
              disabled={gerandoIA || salvando}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {gerandoIA ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {gerandoIA ? "Gerando…" : conteudo ? "Regerar com IA" : "Gerar com IA"}
            </button>
            {conteudo && !expandido && (
              <button
                type="button"
                onClick={() => setExpandido(true)}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Ver texto gerado
              </button>
            )}
            {conteudo && expandido && (
              <button
                type="button"
                onClick={() => setExpandido(false)}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Recolher
              </button>
            )}
          </div>

          {expandido && (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={conteudo}
                onChange={(e) => { setConteudo(e.target.value); setDirtyConteudo(true); }}
                rows={4}
                placeholder="Parágrafo introdutório gerado pela IA (aparece antes do conteúdo automático no laudo)..."
                className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-700 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSalvar({ conteudo: conteudo.trim() || null });
                    setDirtyConteudo(false);
                  }}
                  disabled={!dirtyConteudo || salvando}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  Salvar texto
                </button>
                {conteudo && (
                  <button
                    type="button"
                    onClick={() => { setConteudo(""); setDirtyConteudo(true); }}
                    className="text-[11px] text-gray-500 hover:text-red-600"
                  >
                    Remover texto
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card de capítulo EDITÁVEL ────────────────────────────────────────────────

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
  capitulo: AetTextoPadraoCapitulo;
  indice: number;
  total: number;
  salvando: boolean;
  contagensPorPosicao: Partial<Record<PosicaoPdfValor, number>>;
  onSalvar: (patch: Partial<Omit<AetTextoPadraoCapitulo, "id_capitulo" | "created_at" | "updated_at">>) => void;
  onMover: (dir: "up" | "down") => void;
  onExcluir: () => void;
  onToggleMostrar: () => void;
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
      toast.error(err instanceof Error ? err.message : "Falha no upload", { id: loadingId });
    } finally {
      setEnviandoBg(false);
    }
  }

  const orientacao = capitulo.orientacao ?? "retrato";
  const quebraPagina = capitulo.quebra_pagina ?? "nova";

  return (
    <div className={cn(
      "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
      !capitulo.mostrar && "opacity-60"
    )}>
      {/* Linha do título */}
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

        {/* Badge EDITÁVEL */}
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

        {/* Toggle visibilidade */}
        <button
          type="button"
          onClick={onToggleMostrar}
          disabled={salvando}
          title={capitulo.mostrar ? "Ocultar no laudo" : "Mostrar no laudo"}
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
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>

        <button
          type="button"
          onClick={onExcluir}
          className="rounded-md border border-gray-300 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
          title="Excluir capítulo"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Configurações: orientação, quebra_pagina, posição, imagem */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-2">
        {/* Orientação */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Orientação:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => orientacao !== "retrato" && onSalvar({ orientacao: "retrato" })}
              disabled={salvando}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                orientacao === "retrato" ? "bg-verde-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
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
                orientacao === "paisagem" ? "bg-verde-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <RectangleHorizontal className="size-3.5" /> Paisagem
            </button>
          </div>
        </div>

        {/* Início da página */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Início:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => quebraPagina !== "nova" && onSalvar({ quebra_pagina: "nova" })}
              disabled={salvando || !!capitulo.bg_imagem_url}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                quebraPagina === "nova" || capitulo.bg_imagem_url
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <FilePlus2 className="size-3.5" /> Nova página
            </button>
            <button
              type="button"
              onClick={() => quebraPagina !== "continua" && onSalvar({ quebra_pagina: "continua" })}
              disabled={salvando || !!capitulo.bg_imagem_url || indice === 0}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                quebraPagina === "continua" && !capitulo.bg_imagem_url
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
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

        {/* Posição no PDF (legado) */}
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
            <img src={capitulo.bg_imagem_url} alt="Fundo" className="h-10 w-16 rounded border border-gray-300 object-cover" />
            <span className="text-[10px] text-gray-600">Este capítulo sai como página inteira no PDF.</span>
            <button
              type="button"
              onClick={() => onSalvar({ bg_imagem_url: null })}
              disabled={salvando}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
