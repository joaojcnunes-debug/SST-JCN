"use client";

import { Fragment, use } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Printer,
  Save,
  Users,
  BadgeCheck,
  Download,
} from "lucide-react";
import { useState, useEffect } from "react";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import StorageImg from "@/components/ui/StorageImg";
import { useHtmlImagensAssinadas } from "@/lib/hooks/useSignedUrl";
import StorageBg from "@/components/ui/StorageBg";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
import { usePdfAssinado } from "@/lib/hooks/usePdfsGerados";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { detectRegistroTipo } from "@/lib/registro-profissional";
import {
  useAetRelatorio,
  useSalvarAet,
  useAetTextoPadrao,
  useAetChecklistPerguntas,
  useAetOwasConfig,
  useAet13FatoresConfig,
  useAet13FatoresSemaforo,
  useAetLaudoQpsMeta,
  useAetLaudoFatoresPsi,
  useAetQpsRespostas,
  useAet13FatoresPerguntas,
  zonaFromMedia,
  nivelPgrFromZona,
  SEMAFORO_DEFAULT,
  CHECKLIST_PERGUNTAS_PADRAO,
  SLUG_TO_DEFAULT_IMAGE,
  SLUG_TO_OWAS_FIELD,
} from "@/lib/hooks/useAet";
import { algumaVisivel, perguntaOculta } from "@/lib/aet/checklist";
import {
  apenasSetoresExistentes,
  consolidarPiorCaso,
  mediaFatorDeLinhas,
  recalcularDasRespostas,
} from "@/lib/aet/consolidar-psi";
import { useAetAcoes } from "@/lib/hooks/useAetAcoes";
import { ROTULO_ACOES_GERAIS, agruparAcoesPorSetor } from "@/lib/aet/acoes";
import { formatarPrazoAcao } from "@/lib/acoes/prazo";
import type { AetAcao } from "@/lib/supabase/types";
// A MESMA numeração do PDF (components/pdf/templates/AetTemplate). Antes a
// prévia tinha os números cravados no código — mostrava "13. Análises
// Ergonômicas" onde o PDF diz 10, e 14/15/16/17 onde o PDF tem um único
// capítulo 11 com subtítulos. Só o 9 coincidia, por acaso.
import { numerarCapitulos, numLabel } from "@/components/pdf/templates/shared";
import { htmlVazio, textoParaHtml } from "@/lib/texto-rico";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import {
  montarEnderecoEmpresa,
  substituirVariaveis,
  substituirVariaveisTexto,
} from "@/lib/textos-padrao/variaveis";
import { montarValoresAet } from "@/lib/textos-padrao/variaveis-aet";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import type {
  AetSetor,
  AetTextoPadraoCapitulo,
  AetChecklistPergunta,
  AetOwasCategoria,
  ClassificacaoRiscoAET,
  Aet13FatorConfig,
  Aet13FatorPergunta,
  Aet13FatorSemaforo,
  AetLaudoFatorPsi,
  AetLaudoQpsResposta,
  ZonaPsi,
} from "@/lib/supabase/types";
import type { CaixaTexto } from "@/lib/drps/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

const CLASS_ORDER: ClassificacaoRiscoAET[] = [
  "Trivial", "De Atenção", "Moderado", "Alto", "Crítico",
];

const DASH_RISK_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "text-green-300",
  "De Atenção": "text-yellow-300",
  Moderado: "text-orange-300",
  Alto: "text-red-300",
  Crítico: "text-red-200",
};

const OWAS_ROWS: {
  label: string;
  field: keyof Pick<AetSetor["owas"], "posturas_costas" | "posturas_bracos" | "posturas_pernas" | "esforco">;
  opcoes: Record<number, string>;
}[] = [
  {
    label: "Costas",
    field: "posturas_costas",
    opcoes: { 1: "1 – Ereta", 2: "2 – Inclinada", 3: "3 – Ereta e Torcida", 4: "4 – Inclinada e Torcida" },
  },
  {
    label: "Braços",
    field: "posturas_bracos",
    opcoes: {
      1: "1 – Os dois braços abaixo dos ombros",
      2: "2 – Um braço no nível ou acima dos ombros",
      3: "3 – Ambos braços no nível ou acima dos ombros",
    },
  },
  {
    label: "Pernas",
    field: "posturas_pernas",
    opcoes: {
      1: "1 – Sentado",
      2: "2 – De pé, ambas as pernas esticadas",
      3: "3 – De pé, peso em uma perna",
      4: "4 – De pé / agachado, ambos joelhos",
      5: "5 – De pé / agachado, um joelho",
      6: "6 – Ajoelhado",
      7: "7 – Andando ou se movendo",
    },
  },
  {
    label: "Esforço",
    field: "esforco",
    opcoes: { 1: "1 – Carga ≤ 10 kg", 2: "2 – Carga > 10 kg e ≤ 20 kg", 3: "3 – Carga > 20 kg" },
  },
];

const SLUGS_PADRAO = new Set([
  "levantamento_acima_limite", "trabalho_predominante", "pausas_descanso",
  "uso_cadeira", "cadeira_adequada", "monitor", "organizacao_trabalho",
  "exigencia_levantamento", "ritmo_por_demanda", "pausas_formais", "rodizios_sistematizados",
]);

const ZONA_PRINT: Record<string, string> = {
  verde: "#E8F5E9", amarela: "#FFF9C4", laranja: "#FFE0B2", vermelha: "#FFEBEE",
};
const ZONA_TEXT: Record<string, string> = {
  verde: "#1B5E20", amarela: "#F57F17", laranja: "#E65100", vermelha: "#C62828",
};

/** A conta mora em lib/aet/consolidar-psi.ts — um lugar só para a prévia, o PDF
 *  e as duas telas de preenchimento. Esta cópia local percorria as RESPOSTAS e
 *  contava a resposta órfã com a nota crua: a prévia mostrava amarelo onde o
 *  preenchimento mostra verde, exatamente como o PDF fazia. */
const calcMediaSetor = mediaFatorDeLinhas;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetLaudoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const { data: empresaFull } = useEmpresa((rel as { id_empresa?: string })?.id_empresa ?? null);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();
  const [consideracoes, setConsideracoes] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [tituloProfissional, setTituloProfissional] = useState("");
  const [registroProfissional, setRegistroProfissional] = useState("");
  const [dataElaboracao, setDataElaboracao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [enderecoEmpresa, setEnderecoEmpresa] = useState("");


  // Lê os capítulos da tabela unificada textos_padrao (mesma que o editor
  // grava). Antes lia aet_textos_padrao (dedicada) — após a unificação v79 o
  // editor passou a gravar em textos_padrao, então o laudo tem que ler de lá.
  const { data: capitulos = [] } = useTextosPadrao("aet");
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();
  const { data: owasConfig = [] } = useAetOwasConfig();
  const { data: fatoresConfig = [] } = useAet13FatoresConfig();
  const { data: semaforo = SEMAFORO_DEFAULT } = useAet13FatoresSemaforo();
  const { data: qpsMeta } = useAetLaudoQpsMeta(idRelatorio);
  const { data: fatoresPsi = [] } = useAetLaudoFatoresPsi(idRelatorio);
  const { data: acoes = [] } = useAetAcoes(idRelatorio);
  const { data: qpsRespostas = [] } = useAetQpsRespostas(idRelatorio);
  const { data: fatoresPerguntas = [] } = useAet13FatoresPerguntas();

  useEffect(() => {
    if (rel) {
      setConsideracoes(rel.consideracoes_finais ?? "");
      setResponsavel(rel.responsavel_elaboracao ?? "");
      setTituloProfissional(rel.titulo_profissional ?? "");
      setRegistroProfissional(rel.registro_profissional ?? "");
      setDataElaboracao(rel.data_elaboracao ?? "");
      setDataValidade(rel.data_validade ?? "");
      setEnderecoEmpresa(rel.endereco_empresa ?? "");
    }
  }, [rel]);

  const { pdfAssinado, recarregar } = usePdfAssinado("aet_relatorios", idRelatorio);
  const [baixando, setBaixando] = useState(false);

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      await baixarPdfAssinado(pdfAssinado.pdf_path, "relatorio-assinado.pdf");
    } catch { toast.error("Erro ao baixar o PDF."); }
    finally { setBaixando(false); }
  }

  function handleSaveDados() {
    salvar.mutate(
      {
        id: idRelatorio,
        patch: {
          responsavel_elaboracao: responsavel,
          titulo_profissional: tituloProfissional,
          registro_profissional: registroProfissional,
          data_elaboracao: dataElaboracao || null,
          // Coluna `date`: string vazia tem que virar NULL, senão o Postgres
          // recusa o valor (mesmo tratamento da tela de Dados).
          data_validade: dataValidade || null,
          endereco_empresa: enderecoEmpresa || null,
        },
      },
      {
        onSuccess: () => toast.success("Dados salvos"),
        onError: (e: Error) => toast.error(mensagemErro(e)),
      }
    );
  }

  if (isLoading || !rel) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const dataFormatada = dataElaboracao
    ? new Date(dataElaboracao + "T00:00:00").toLocaleDateString("pt-BR")
    : "—";

  const dirty = responsavel !== (rel.responsavel_elaboracao ?? "")
    || tituloProfissional !== (rel.titulo_profissional ?? "")
    || registroProfissional !== (rel.registro_profissional ?? "")
    || dataElaboracao !== (rel.data_elaboracao ?? "")
    || enderecoEmpresa !== (rel.endereco_empresa ?? "");
  const empresa = rel.empresas;
  // Mesmo formatador do PDF e do EmpresaInfoPanel — o botão "Puxar do
  // cadastro" abaixo grava exatamente o que o laudo já mostra na identificação.
  const enderecoCadastro = montarEnderecoEmpresa(empresaFull);

  // ── Stats dashboard ──────────────────────────────────────────────────────
  const totalSetores = rel.setores.length;
  const totalRiscos = rel.setores.reduce((acc, s) => acc + s.riscos.length, 0);
  const totalCargos = rel.setores.reduce((acc, s) => acc + s.cargos.length, 0);
  const todasClassif = rel.setores.flatMap((s) =>
    s.riscos.map((r) => r.classificacao_risco)
  );
  const classificacaoMax = todasClassif.reduce<ClassificacaoRiscoAET | null>(
    (max, c) =>
      !max || CLASS_ORDER.indexOf(c) > CLASS_ORDER.indexOf(max) ? c : max,
    null
  );

  // ── Modo novo (v56): usa ordem_global e capítulos fixos semeados ──────────────
  const temCapitulosFixos = capitulos.some((c) => c.tipo === "fixo");

  const capitulosOrdenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Legado: grupos por posicao_pdf (usado quando não há capítulos fixos no banco)
  const capitulosInicio = capitulos.filter((c) => !c.posicao_pdf || c.posicao_pdf === "inicio");
  const capitulosAposSumario = capitulos.filter((c) => c.posicao_pdf === "apos_sumario");
  const capitulosAposSetores = capitulos.filter((c) => c.posicao_pdf === "apos_setores");

  const capas = (temCapitulosFixos ? capitulosOrdenados : capitulosInicio).filter((c) => !!c.bg_imagem_url);
  const temCapa = capas.length > 0;

  // Índice do primeiro capítulo que não é capa — não recebe aet-nova-pagina para que
  // o RelatorioPrintHeader e o primeiro capítulo fiquem na mesma página
  const firstContentIdx = capitulosOrdenados.findIndex((c) => !c.bg_imagem_url);

  // Valores para substituição de variáveis nos capítulos de texto padrão
  const valoresCapitulos = montarValoresAet(rel, {
    responsavel_elaboracao: responsavel,
    titulo_profissional: tituloProfissional,
    registro_profissional: registroProfissional,
    data_elaboracao: dataElaboracao,
    endereco_empresa: enderecoEmpresa,
  });

  // Numeração das seções — a MESMA regra e as MESMAS funções do PDF, para o
  // número que aparece aqui ser o número que sai impresso. Espelha
  // `renderizaNumerado` de components/pdf/templates/AetTemplate.
  const consideracoesTxt = (rel.consideracoes_finais ?? "").trim();
  // Fora da função: dentro dela o TS perde a narrowing de `rel`.
  const temSetoresNum = rel.setores.length > 0;
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "aet_agentes_ambientais": return temSetoresNum;
      case "aet_analise_ergonomica": return temSetoresNum;
      case "aet_psicossocial": return fatoresPsi.some((f) => f.avaliado);
      case "aet_plano_acao": return acoes.length > 0;
      case "aet_consideracoes_finais": return !!consideracoesTxt;
      case "aet_assinatura": return true;
      default: return false; // sumario
    }
  }
  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  // Sumário auto-calculado — derivado da estrutura do documento
  const sumarioItems = (() => {
    const items: { numero: string; titulo: string }[] = [];
    let n = 0;

    if (temCapitulosFixos) {
      // Mesma lista do PDF: um item por capítulo que realmente vai aparecer.
      // As sub-seções do psicossocial (Dados da Aplicação, Resultado Geral,
      // Análise Detalhada) NÃO entram — no documento elas são subtítulos de um
      // capítulo só, e contá-las aqui era o que empurrava a numeração para 20.
      const tituloDoFixo: Record<string, string> = {
        identificacao_empresa: "Identificação da Empresa",
        aet_agentes_ambientais: "Agentes Ambientais para as Áreas Operacionais",
        aet_analise_ergonomica: "Análises Ergonômicas do Trabalho",
        aet_psicossocial: "Avaliação dos Fatores Psicossociais — QPS Nordic",
        aet_plano_acao: "Plano de Ação (5W2H)",
        aet_consideracoes_finais: "Considerações Finais",
        aet_assinatura: "Assinatura do Responsável Técnico",
      };
      for (const cap of capitulosOrdenados) {
        if (!renderizaNumerado(cap)) continue;
        n++;
        const titulo = cap.tipo === "fixo"
          ? (cap.titulo?.trim() || tituloDoFixo[cap.slug_fixo ?? ""] || "")
          : substituirVariaveisTexto(cap.titulo, valoresCapitulos);
        if (titulo) items.push({ numero: `${n}.`, titulo });
      }
    } else {
      // Modo legado
      for (const cap of capitulosInicio.filter((c) => !c.bg_imagem_url)) {
        n++;
        items.push({ numero: `${n}.`, titulo: substituirVariaveisTexto(cap.titulo, valoresCapitulos) });
      }
      if (capitulosAposSumario.length > 0) {
        for (const cap of capitulosAposSumario) {
          n++;
          items.push({ numero: `${n}.`, titulo: substituirVariaveisTexto(cap.titulo, valoresCapitulos) });
        }
      } else {
        for (const titulo of [
          "Introdução Geral", "Objetivo", "Metodologia",
          "Levantamento, Transporte e Descarga Individual de Materiais",
          "Mobiliário dos Postos de Trabalho", "Equipamentos dos Postos de Trabalho",
          "Condições Ambientais de Trabalho",
        ]) {
          n++;
          items.push({ numero: `${n}.`, titulo });
        }
      }
      if (rel.setores.length > 0) {
        n++;
        items.push({ numero: `${n}.`, titulo: "Análise por Setor" });
      }
      if (capitulosAposSetores.length > 0) {
        for (const cap of capitulosAposSetores) {
          n++;
          items.push({ numero: `${n}.`, titulo: substituirVariaveisTexto(cap.titulo, valoresCapitulos) });
        }
      } else if (rel.setores.length > 0) {
        for (const titulo of [
          "Conforto em Áreas Administrativas",
          "Organização do Trabalho",
          "Ferramentas Biomecânicas Aplicadas",
        ]) {
          n++;
          items.push({ numero: `${n}.`, titulo });
        }
      }
      if (fatoresPsi.length > 0) {
        const fatAvaliados = fatoresPsi.filter((f) => f.avaliado);
        const comAnalise = fatAvaliados.filter((f) => !htmlVazio(f.observacao));
        n++;
        items.push({ numero: `${n}.`, titulo: "Avaliação dos Fatores Psicossociais — QPS Nordic" });
        if (qpsMeta && (qpsMeta.n_respondentes != null || qpsMeta.periodo_inicio || qpsMeta.modo_aplicacao || qpsMeta.tecnico_aplicador)) {
          n++;
          items.push({ numero: `${n}.`, titulo: "Dados da Aplicação" });
        }
        if (fatAvaliados.length > 0) {
          n++;
          items.push({ numero: `${n}.`, titulo: "Resultado Geral por Fator" });
        }
        if (comAnalise.length > 0) {
          n++;
          items.push({ numero: `${n}.`, titulo: "Análise Detalhada por Fator" });
        }
      }
      n++;
      items.push({ numero: `${n}.`, titulo: "Considerações Finais" });
    }

    return items;
  })();

  return (
    <div className="space-y-0">

      {/* ═══ HEADER DASHBOARD (print:hidden) ═══ */}
      <div className="print:hidden rounded-2xl bg-gradient-to-br from-verde-dark via-verde-primary to-verde-accent p-6 shadow-xl mb-5">
        {/* Topo: empresa + status + botão */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
              Laudo de Avaliação Ergonômica — NR-17
            </p>
            <h1 className="mt-1 text-xl font-bold text-white">
              {empresa?.nome_empresa || "Empresa"}
            </h1>
            {empresa?.cnpj && (
              <p className="mt-0.5 text-xs text-white/60">CNPJ: {empresa.cnpj}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Badge de status */}
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              rel.status === "CONCLUIDO"
                ? "bg-green-400/20 text-green-100"
                : "bg-white/15 text-white/80"
            )}>
              {rel.status === "CONCLUIDO"
                ? <CheckCircle2 className="size-3" />
                : <Clock className="size-3" />}
              {rel.status === "CONCLUIDO" ? "Concluído" : "Rascunho"}
            </span>
            {pdfAssinado ? (
              <>
                <div className="flex items-center gap-1.5 rounded-md border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                  <BadgeCheck className="size-3.5 shrink-0" />
                  Assinado em {new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR")}
                </div>
                <button type="button" onClick={handleBaixarPdf} disabled={baixando}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-emerald-500 disabled:opacity-60">
                  {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Baixar PDF Assinado
                </button>
                <BotaoAssinarPdf reAssinatura={true} apiPdfUrl={`/api/pdf/aet/${idRelatorio}`} defaultSignatoryName={responsavel || undefined} tabelaNome="aet_relatorios" docId={idRelatorio} onAssinado={recarregar} />
              </>
            ) : (
              <BotaoAssinarPdf apiPdfUrl={`/api/pdf/aet/${idRelatorio}`} defaultSignatoryName={responsavel || undefined} tabelaNome="aet_relatorios" docId={idRelatorio} onAssinado={recarregar} />
            )}
            <BotaoGerarPdf
              apiPdfUrl={`/api/pdf/aet/${idRelatorio}`}
              tabelaNome="aet_relatorios"
              docId={idRelatorio}
              label="Gerar Laudo"
              disabled={dirty || salvar.isPending}
              title={dirty ? "Salve as alterações antes de gerar o PDF" : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/30"
              registrarPdf={{
                modulo: "aet",
                tipoDocumento: "Avaliação Ergonômica do Trabalho",
                idRelatorio,
                empresaNome: empresa?.nome_empresa ?? undefined,
                empresaCnpj: empresa?.cnpj ?? undefined,
                responsavelTecnico: responsavel || undefined,
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-white/60">
              <Building2 className="size-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Setores</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalSetores}</p>
            <p className="text-[10px] text-white/50">
              {totalSetores === 1 ? "setor analisado" : "setores analisados"}
            </p>
          </div>

          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-white/60">
              <AlertTriangle className="size-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Riscos</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalRiscos}</p>
            <p className="text-[10px] text-white/50">
              {totalRiscos === 1 ? "risco mapeado" : "riscos mapeados"}
            </p>
          </div>

          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-white/60">
              <Activity className="size-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Classificação</span>
            </div>
            <p className={cn("text-base font-bold leading-tight", classificacaoMax ? DASH_RISK_COLOR[classificacaoMax] : "text-white")}>
              {classificacaoMax || "—"}
            </p>
            <p className="text-[10px] text-white/50">nível mais crítico</p>
          </div>

          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-white/60">
              <Users className="size-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Cargos</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalCargos}</p>
            <p className="text-[10px] text-white/50">
              {totalCargos === 1 ? "cargo avaliado" : "cargos avaliados"}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ DADOS DA EMPRESA (print:hidden) ═══ */}
      <div className="print:hidden mb-5">
        <EmpresaInfoPanel empresa={empresaFull ?? null} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" />
      </div>

      {/* ═══ DADOS DO LAUDO (print:hidden) ═══ */}
      {canEdit && (
        <div className="print:hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mb-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-verde-light">
              <FileText className="size-4 text-verde-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Dados do Laudo</h2>
              <p className="text-[11px] text-gray-500">Responsável técnico, registro, data de elaboração e validade</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Responsável pela Elaboração</label>
              <ProfissionalSelect
                value={responsavel}
                onChange={(nome, cargo, _cert, regValue) => {
                  setResponsavel(nome);
                  setTituloProfissional(cargo ?? "");
                  if (regValue) setRegistroProfissional(regValue);
                }}
                onMatchFound={({ cargo, registro }) => {
                  setTituloProfissional((prev) => prev || cargo || "");
                  setRegistroProfissional((prev) => prev || registro || "");
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Título Profissional</label>
              <input
                type="text"
                value={tituloProfissional}
                onChange={(e) => setTituloProfissional(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
                placeholder="Ex: Ergonomista, Engenheiro de Segurança..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">{detectRegistroTipo(tituloProfissional).label}</label>
              <input
                type="text"
                value={registroProfissional}
                onChange={(e) => setRegistroProfissional(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
                placeholder={detectRegistroTipo(tituloProfissional).placeholder}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Data de Elaboração</label>
              <input
                type="date"
                value={dataElaboracao}
                onChange={(e) => setDataElaboracao(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Validade do Documento</label>
              <input
                type="date"
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
                min={dataElaboracao || undefined}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Sai no bloco &ldquo;Identificação da Empresa&rdquo; do laudo. Em branco, imprime &ldquo;—&rdquo;.
              </p>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-gray-600">Endereço da Empresa</label>
                {/* Os laudos criados antes do preenchimento automático ficaram
                    com este campo vazio. O botão traz o endereço do cadastro
                    sem obrigar a redigitar — e some quando já está igual. */}
                {enderecoCadastro && enderecoEmpresa !== enderecoCadastro && (
                  <button
                    type="button"
                    onClick={() => setEnderecoEmpresa(enderecoCadastro)}
                    className="text-[11px] font-medium text-verde-primary hover:underline"
                  >
                    Puxar do cadastro
                  </button>
                )}
              </div>
              <input
                type="text"
                value={enderecoEmpresa}
                onChange={(e) => setEnderecoEmpresa(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
                placeholder="Rua, nº, bairro, cidade - UF"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveDados}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-4 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {salvar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Salvar Dados
            </button>
          </div>
        </div>
      )}

      {/* CSS de impressão AET — ABNT NBR 14724 */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 3cm 2cm 2cm 3cm; }
          @page :first { margin: 0; }
          @page aet-landscape { size: A4 landscape; margin: 2cm 1.5cm 2cm 1.5cm; }
          @page aet-portrait  { size: A4 portrait;  margin: 3cm 2cm 2cm 3cm; }
          body { font-size: 12pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .aet-section { page-break-inside: avoid; }
          .aet-section-break { page-break-before: always; }
          .aet-orientacao-paisagem { page: aet-landscape; }
          .aet-orientacao-retrato  { /* sem page: aet-portrait — usa @page padrão (mesmas config); evita transição de página nomeada que gerava página em branco */ }
          .aet-nova-pagina { break-before: page; }
          /* Capa no print: full-bleed (1ª página sem margens) */
          .aet-capitulo--capa {
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            width: 100% !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            background-size: cover !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
          }
        }
        /* Capa — tela: altura fixa, arredondada, margem abaixo */
        .aet-capitulo--capa {
          position: relative;
          height: 480px;
          min-height: 480px;
          overflow: hidden;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .aet-caixa-texto { position: absolute; z-index: 1; }
      `}</style>

      {/* ═══ CAPA + DOCUMENTO — ocultos na tela, visíveis apenas no print ═══ */}
      <div className="hidden print:block">

        {/* CAPA */}
        {temCapa && capas.map((cap) => (
          <StorageBg
            key={cap.id_capitulo}
            stored={cap.bg_imagem_url}
            className="aet-capitulo--capa"
          >
            {(cap.caixas_texto ?? []).map((caixa: CaixaTexto) => (
              <div
                key={caixa.id}
                className="aet-caixa-texto"
                style={{
                  left: `${caixa.x}%`,
                  top: `${caixa.y}%`,
                  width: `${caixa.w ?? 40}%`,
                  fontSize: `${caixa.fontSize ?? 14}px`,
                  fontWeight: caixa.bold ? "bold" : "normal",
                  color: caixa.color ?? "#ffffff",
                  textAlign: caixa.align ?? "left",
                  whiteSpace: "pre-wrap",
                }}
              >
                {substituirVariaveisTexto(caixa.conteudo, valoresCapitulos)}
              </div>
            ))}
          </StorageBg>
        ))}

      </div>

      {/* ═══ SUMÁRIO — print only (legado; suprimido quando existe o capítulo
           do sistema "sumario", que é renderizado em fluxo e reposicionável) ═══ */}
      {sumarioItems.length > 0 && !capitulos.some((c) => c.slug_fixo === "sumario") && (
        <section className="aet-sumario">
          <style>{`
            .aet-sumario {
              font-family: 'Times New Roman', Times, serif;
              page-break-before: always;
              page-break-after: always;
            }
            .aet-sumario-titulo {
              font-size: 16pt;
              font-weight: 700;
              color: #1e4d28;
              border-bottom: 2px solid #0ea5e9;
              padding-bottom: 6px;
              margin-bottom: 16pt;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .aet-sumario-lista {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .aet-sumario-item {
              font-size: 12pt;
              line-height: 1.7;
              color: #1f2937;
            }
            .aet-sumario-numero {
              font-weight: 700;
              margin-right: 8pt;
              color: #0ea5e9;
              min-width: 24pt;
              display: inline-block;
            }
          `}</style>
          <h2 className="aet-sumario-titulo">Sumário</h2>
          <ul className="aet-sumario-lista">
            {sumarioItems.map((item, idx) => (
              <li key={idx} className="aet-sumario-item">
                <span className="aet-sumario-numero">{item.numero}</span>
                {item.titulo}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ DOCUMENTO ═══ */}
      {/* Sem `force-light`: a prévia acompanha o tema do app — folha branca fixa
          cansava a vista de quem passa o dia no laudo. A impressão continua clara
          pelo `beforeprint` do ThemeManager e o PDF é montado no servidor
          (/api/pdf/aet/[id]), não capturado desta tela. */}
      <div
        id="laudo-aet"
        className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        {/* Cabeçalho — sempre visível no print (página 2 quando há capa) */}
        <RelatorioPrintHeader
          titulo="Laudo de Avaliação Ergonômica — AET"
          subtitulo={empresa?.nome_empresa ?? null}
          terciario={
            empresa?.cnpj
              ? `CNPJ: ${empresa.cnpj}${enderecoEmpresa ? ` · ${enderecoEmpresa}` : ""}`
              : enderecoEmpresa || null
          }
        />

        {/* Separador de tela (oculto no print — já temos o header acima) */}
        <div className="print:hidden mb-6 flex items-center justify-between border-b border-gray-300 pb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Documento técnico — uso interno e regulatório
          </span>
          <span className="text-[10px] text-gray-400">{dataFormatada}</span>
        </div>

        {/* Capítulos de texto padrão — posição início (só no modo legado sem
            fixos; com fixos, capitulosOrdenados já renderiza tudo) */}
        {!temCapitulosFixos && (
          <TextosPadraoPrint modulo="aet" posicao="inicio" valores={valoresCapitulos} />
        )}

        {/* ── RENDERIZAÇÃO PRINCIPAL ────────────────────────────────────────────── */}
        {temCapitulosFixos ? (
          /* Modo v56: ordem global unificada — cada capítulo renderizado por slug */
          <>
            {capitulosOrdenados.map((cap, mapIdx) => {
              // Capa já renderizada fora do #laudo-aet — evita div vazio com page: aet-portrait que gera páginas em branco
              if (cap.bg_imagem_url) return null;

              // Primeiro capítulo real fica na mesma página que o RelatorioPrintHeader (sem break-before)
              const isFirstContent = mapIdx === firstContentIdx;
              const oClass = cn(
                cap.orientacao === "paisagem" ? "aet-orientacao-paisagem" : "aet-orientacao-retrato",
                !isFirstContent && cap.quebra_pagina !== "continua" && "aet-nova-pagina"
              );

              if (cap.tipo === "fixo") {
                let content: React.ReactNode = null;

                const introFixo = cap.conteudo ? (
                  <p className="mb-4 text-xs leading-relaxed text-gray-700 border-l-2 border-gray-300 pl-3">
                    {cap.conteudo}
                  </p>
                ) : null;

                switch (cap.slug_fixo) {
                  case "identificacao_empresa":
                    content = (
                      <div className="mb-6 break-inside-avoid">
                        <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
                          {numLabel(numPorSlug["identificacao_empresa"], cap.titulo?.trim() || "Identificação da Empresa")}
                        </h2>
                        <EmpresaInfoPanel empresa={empresaFull ?? null} />
                        {/* Espelho do BlocoDatasDocumento do PDF (SecoesComuns).
                            A prévia usa EmpresaInfoPanel e o PDF usa
                            SecaoIdentificacaoEmpresa — são dois componentes, então o
                            bloco de datas precisa existir dos dois lados. Mesmos
                            rótulos e mesma fonte de dado (`valoresCapitulos`). */}
                        {(valoresCapitulos.data_elaboracao || valoresCapitulos.data_validade) && (
                          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-gray-200 pt-3 sm:grid-cols-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                Data de elaboração
                              </p>
                              <p className="text-sm text-gray-900">
                                {valoresCapitulos.data_elaboracao || "—"}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                Validade do documento
                              </p>
                              <p className="text-sm text-gray-900">
                                {valoresCapitulos.data_validade || "—"}
                              </p>
                              {/* Aviso só na tela (nunca no PDF): a validade em
                                  branco passava despercebida até o documento
                                  ficar pronto. */}
                              {!valoresCapitulos.data_validade && (
                                <p className="mt-0.5 text-[10px] font-medium text-amber-700 print:hidden">
                                  Não preenchida — informe em &ldquo;Dados do Laudo&rdquo;, acima.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                    break;

                  case "sumario":
                    content = sumarioItems.length > 0 ? (
                      <div className="mb-6 break-inside-avoid">
                        <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
                          Sumário
                        </h2>
                        <ol className="space-y-1">
                          {sumarioItems.map((item, i) => (
                            <li key={i} className="flex items-baseline gap-2 border-b border-dotted border-gray-300 py-0.5 text-xs text-gray-700">
                              <span className="min-w-5 font-bold text-emerald-800">{i + 1}.</span>
                              <span>{item.titulo}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null;
                    break;

                  case "aet_agentes_ambientais":
                    // SÓ a tabela de riscos, igual ao PDF. A prévia repetia aqui
                    // a análise inteira do setor (OWAS, checklist, fotos, parecer
                    // e 13 fatores) e de novo no capítulo seguinte. Levar essa
                    // duplicação para o PDF custaria +55% de páginas (medido:
                    // NOVAPARECIDA 124 -> 192, MEGA MASTER 47 -> 66).
                    content = rel.setores.length > 0 ? (
                      <Section num={String(numPorSlug["aet_agentes_ambientais"] ?? "")} title={cap.titulo}>
                        {introFixo}
                        <div className="space-y-8">
                          {rel.setores.map((setor, idx) => (
                            <SetorRiscosBlock key={setor.id} setor={setor} idx={idx} />
                          ))}
                        </div>
                      </Section>
                    ) : null;
                    break;

                  case "aet_analise_ergonomica":
                    content = rel.setores.length > 0 ? (
                      <Section num={String(numPorSlug["aet_analise_ergonomica"] ?? "")} title={cap.titulo}>
                        {introFixo}
                        <div className="space-y-8">
                          {rel.setores.map((setor, idx) => (
                            <div key={setor.id}>
                              <SetorRiscosBlock setor={setor} idx={idx} />
                              <div className="mt-4">
                                <SetorAnaliseBlock
                                  setor={setor}
                                  idx={idx}
                                  hideHeader
                                  checklistPerguntas={checklistPerguntas}
                                  owasConfig={owasConfig}
                                  fatoresConfig={fatoresConfig}
                                  fatoresPerguntas={fatoresPerguntas}
                                  qpsRespostas={qpsRespostas}
                                  fatoresPsi={fatoresPsi}
                                  semaforo={semaforo}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    ) : null;
                    break;

                  case "aet_psicossocial":
                    content = fatoresPsi.length > 0 ? (
                      <>
                        {introFixo && (
                          <div className="mb-4">{introFixo}</div>
                        )}
                        <PsicossocialSections
                          fatoresPsi={fatoresPsi}
                          fatoresConfig={fatoresConfig}
                          fatoresPerguntas={fatoresPerguntas}
                          qpsRespostas={qpsRespostas}
                          semaforo={semaforo}
                          qpsMeta={qpsMeta ?? null}
                          setores={rel.setores}
                          zonaFromMedia={zonaFromMedia}
                          nivelPgrFromZona={nivelPgrFromZona}
                          numero={numPorSlug["aet_psicossocial"]}
                          titulo={cap.titulo}
                        />
                      </>
                    ) : null;
                    break;

                  case "aet_plano_acao":
                    // Igual ao PDF: sem ação, o capítulo não existe; a
                    // introdução (texto do capítulo fixo) sai DEPOIS do título.
                    content = acoes.length > 0 ? (
                      <PlanoAcaoSection
                        acoes={acoes}
                        setores={rel.setores}
                        numero={numPorSlug["aet_plano_acao"]}
                        titulo={cap.titulo}
                        intro={introFixo}
                      />
                    ) : null;
                    break;

                  case "aet_consideracoes_finais":
                    content = (
                      <ConsideracoesFinaisSection
                        consideracoes={consideracoes}
                        numero={numPorSlug["aet_consideracoes_finais"]}
                        titulo={cap.titulo}
                      />
                    );
                    break;

                  case "aet_assinatura":
                    content = (
                      <AssinaturaSection
                        responsavel={responsavel}
                        tituloProfissional={tituloProfissional}
                        registroProfissional={registroProfissional}
                        idRelatorio={idRelatorio}
                        dataRelatorio={dataElaboracao ? dataFormatada : undefined}
                        hideAcoes
                        numero={numPorSlug["aet_assinatura"]}
                      />
                    );
                    break;

                  default:
                    content = null;
                }

                return content ? (
                  <div key={cap.id_capitulo} className={oClass}>{content}</div>
                ) : null;
              }

              return (
                <div key={cap.id_capitulo} className={oClass}>
                  <CapituloLaudo cap={cap} valores={valoresCapitulos} numero={numPorId[cap.id_capitulo]} />
                </div>
              );
            })}
          </>
        ) : (
          /* Modo legado: posicao_pdf + seções hardcoded com fallback */
          <>
            {capitulosInicio.map((cap) => (
              <CapituloLaudo key={cap.id_capitulo} cap={cap} valores={valoresCapitulos} />
            ))}

            {capitulosAposSumario.length > 0 ? (
              capitulosAposSumario.map((cap) => <CapituloLaudo key={cap.id_capitulo} cap={cap} valores={valoresCapitulos} />)
            ) : (
              <>
                <Section num="2" title="Introdução Geral">
                  <p className="text-xs leading-relaxed text-gray-700">
                    A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos
                    organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes
                    do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.
                  </p>
                </Section>
                <Section num="3" title="Objetivo">
                  <p className="text-xs leading-relaxed text-gray-700">
                    Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise
                    ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.
                  </p>
                  <p className="text-xs font-semibold text-gray-700">BASE LEGAL: Portaria 3.214/78 do Ministério do Trabalho – NR-17</p>
                </Section>
                <Section num="4" title="Metodologia">
                  <p className="text-xs leading-relaxed text-gray-700">
                    Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET.
                    A metodologia utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e
                    verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas
                    suas diferentes dimensões (física, cognitiva, mental e social).
                  </p>
                </Section>
                <Section num="5" title="Levantamento, Transporte e Descarga Individual de Materiais">
                  <p className="text-xs leading-relaxed text-gray-700">
                    Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua
                    capacidade de força e não comprometa a sua saúde ou segurança. Para manipulações ocasionais, o limite
                    de 25 kg para homens e 15 kg para mulheres é sugerido, desde que observadas boas práticas para a
                    manipulação.
                  </p>
                </Section>
                <Section num="6" title="Mobiliário dos Postos de Trabalho">
                  <ul className="ml-4 list-disc space-y-0.5 text-xs text-gray-700">
                    <li>Sempre que possível o trabalho deve ser executado na posição sentada;</li>
                    <li>O mobiliário deve prover condições dentro da zona de conforto dos segmentos corporais;</li>
                    <li>Os comandos sejam de fácil acionamento;</li>
                    <li>Os assentos sejam adequados.</li>
                  </ul>
                </Section>
                <Section num="7" title="Equipamentos dos Postos de Trabalho">
                  <p className="text-xs leading-relaxed text-gray-700">
                    O mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de
                    conforto dos segmentos corporais, em boa condição postural e livre de reflexos.
                  </p>
                </Section>
                <Section num="8" title="Condições Ambientais de Trabalho">
                  <p className="text-xs leading-relaxed text-gray-700">
                    O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa
                    de Gerenciamento de Riscos – PGR da empresa.
                  </p>
                </Section>
              </>
            )}

            {rel.setores.length > 0 && rel.setores.map((setor, idx) => (
              <div key={setor.id} className="mb-8">
                <SetorRiscosBlock setor={setor} idx={idx} />
                <div className="mt-4">
                  <SetorAnaliseBlock
                    setor={setor}
                    idx={idx}
                    hideHeader
                    checklistPerguntas={checklistPerguntas}
                    owasConfig={owasConfig}
                    fatoresConfig={fatoresConfig}
                    fatoresPerguntas={fatoresPerguntas}
                    qpsRespostas={qpsRespostas}
                    fatoresPsi={fatoresPsi}
                    semaforo={semaforo}
                  />
                </div>
              </div>
            ))}

            {capitulosAposSetores.length > 0 ? (
              capitulosAposSetores.map((cap) => <CapituloLaudo key={cap.id_capitulo} cap={cap} valores={valoresCapitulos} />)
            ) : (
              <>
                <Section num="10" title="Conforto em Áreas Administrativas">
                  <p className="text-xs leading-relaxed text-gray-700">
                    A temperatura efetiva foi avaliada utilizando um termo higrômetro eletrônico. Foram considerados os
                    limites: temperatura efetiva entre 20 a 23 ºC (NR-17, item 17.5.2.1.b), velocidade do ar não superior
                    a 0,75 m/s (item 17.5.2.1.c) e umidade relativa mínima de 40% (item 17.5.2.1.d).
                  </p>
                </Section>
                <Section num="11" title="Organização do Trabalho">
                  <p className="mb-1 text-xs text-gray-700">Na análise foram levados em consideração:</p>
                  <ul className="ml-4 list-[lower-alpha] space-y-0.5 text-xs text-gray-700">
                    {["as normas de produção","o modo operatório","a exigência de tempo","a determinação do conteúdo de tempo","o ritmo de trabalho","o conteúdo das tarefas","horário de trabalho"].map((item) => (
                      <li key={item}>{item};</li>
                    ))}
                  </ul>
                </Section>
                <Section num="12" title="Ferramentas Biomecânicas Aplicadas">
                  <p className="text-xs leading-relaxed text-gray-700">
                    <strong>Método OWAS</strong> (Ovako Working Posture Analysing System) — desenvolvido na Finlândia por
                    Karhu, Kansi e Kuorinka (1974–1978), juntamente com o Instituto Finlandês de Saúde Ocupacional.
                  </p>
                </Section>
              </>
            )}

            {fatoresPsi.length > 0 && (
              <PsicossocialSections
                fatoresPsi={fatoresPsi}
                fatoresConfig={fatoresConfig}
                fatoresPerguntas={fatoresPerguntas}
                qpsRespostas={qpsRespostas}
                semaforo={semaforo}
                qpsMeta={qpsMeta ?? null}
                setores={rel.setores}
                zonaFromMedia={zonaFromMedia}
                nivelPgrFromZona={nivelPgrFromZona}
              />
            )}

            <ConsideracoesFinaisSection consideracoes={consideracoes} />

            <AssinaturaSection
              responsavel={responsavel}
              tituloProfissional={tituloProfissional}
              registroProfissional={registroProfissional}
              idRelatorio={idRelatorio}
              dataRelatorio={dataElaboracao ? dataFormatada : undefined}
              hideAcoes
            />
          </>
        )}

        {/* Capítulos de texto padrão — posição fim */}
        {!temCapitulosFixos && (
          <TextosPadraoPrint modulo="aet" posicao="fim" valores={valoresCapitulos} />
        )}

        {/* Rodapé */}
        <p className="mt-8 text-center text-[9px] text-gray-400">
          Laudo AET gerado em {new Date().toLocaleDateString("pt-BR")} · JCN Consultoria Saúde e Segurança do Trabalho · Portaria 3.214/78 — NR-17
        </p>
      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3 border-b-2 border-gray-700 pb-1">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-700">
          {/* "9. Título", igual ao PDF (numLabel). Era "9 — Título". */}
          {num ? `${num}. ${title}` : title}
        </h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Subtítulo dentro de um capítulo — espelha o `.aet-sub` do PDF. Não recebe
 *  número: no documento estas são sub-seções de um capítulo só. */
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-900">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function RichBlock({ html }: { html: string }) {
  // Assina as imagens inline (<img>) gravadas no HTML rich-text (prévia em tela).
  const assinado = useHtmlImagensAssinadas(html);
  return (
    <div
      className="prose prose-xs max-w-none text-xs leading-relaxed text-gray-700 [&_a]:text-gray-700 [&_a]:no-underline [&_p]:my-1"
      dangerouslySetInnerHTML={{ __html: assinado }}
    />
  );
}

function CapituloLaudo({
  cap,
  valores = {},
  numero,
}: {
  cap: TextoPadraoCapitulo;
  valores?: Record<string, string>;
  /** Número do modelo — o mesmo que o PDF imprime. Sem ele o capítulo saía sem
   *  número na tela e numerado no documento. */
  numero?: number;
}) {
  if (cap.bg_imagem_url) {
    // Capa renderizada na seção antes de #laudo-aet (visível na tela e no print)
    return null;
  }
  return (
    <Section num={numero ? String(numero) : ""} title={substituirVariaveisTexto(cap.titulo, valores)}>
      {cap.conteudo && <RichBlock html={substituirVariaveis(cap.conteudo, valores)} />}
    </Section>
  );
}

// ─── Seção 9 — Agentes Ambientais ────────────────────────────────────────────

function SetorRiscosBlock({ setor, idx }: { setor: AetSetor; idx: number }) {
  return (
    <div className="overflow-hidden rounded border border-gray-300">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white">
          Setor {idx + 1}: {setor.nome_setor || "—"}
        </p>
        {setor.cargos.length > 0 && (
          <p className="text-[10px] text-gray-300">
            {setor.cargos.map((c) => c.nome).filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Info do setor */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          {setor.maquinas_equipamentos && (
            <tr className="border-b border-gray-100">
              <td className="w-44 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">
                Máquinas e Equipamentos
              </td>
              <td className="px-3 py-1.5 text-gray-700">
                {setor.maquinas_equipamentos.split("\n").filter(Boolean).join(" · ")}
              </td>
            </tr>
          )}
          {setor.descricao_atividade && (
            <tr className="border-b border-gray-100">
              <td className="w-44 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">
                Descrição da Atividade
              </td>
              <td className="px-3 py-1.5 text-gray-700">{setor.descricao_atividade}</td>
            </tr>
          )}
          {setor.cargos
            .filter((c) => c.descricao)
            .map((cargo, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="w-44 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">{cargo.nome}</td>
                <td className="px-3 py-1.5 text-gray-700">{cargo.descricao}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* Tabela de riscos */}
      {setor.riscos.length > 0 && (
        <table className="w-full border-collapse border-t border-gray-200 text-xs">
          <thead>
            <tr className="bg-gray-100">
              {[
                "Tipo",
                "Agente / Risco",
                "Intensidade / Conc.",
                "Técnica / Metodologia",
                "EPI (CA)",
                "EPI Eficaz",
                "Classificação",
              ].map((h) => (
                <th
                  key={h}
                  className="border border-gray-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {setor.riscos.map((r) => (
              <tr key={r.id} className="even:bg-gray-50">
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.tipo}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.risco}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.intensidade_concentracao}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.tecnica_metodologia}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.epi_ca}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.epi_eficaz}</td>
                <td
                  className={cn(
                    "border border-gray-100 px-2 py-1 text-center text-[10px] font-bold",
                    CLASS_COLOR[r.classificacao_risco]
                  )}
                >
                  {r.classificacao_risco}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {setor.riscos.length === 0 && (
        <p className="px-3 py-2 text-xs italic text-gray-400">Nenhum agente / risco identificado neste setor.</p>
      )}
    </div>
  );
}

// ─── Seção 13 — Análise Ergonômica ───────────────────────────────────────────

function SetorAnaliseBlock({
  setor,
  idx,
  hideHeader,
  checklistPerguntas,
  owasConfig,
  fatoresConfig,
  fatoresPerguntas,
  qpsRespostas,
  fatoresPsi,
  semaforo,
}: {
  setor: AetSetor;
  idx: number;
  hideHeader?: boolean;
  checklistPerguntas: AetChecklistPergunta[];
  owasConfig: AetOwasCategoria[];
  fatoresConfig: Aet13FatorConfig[];
  fatoresPerguntas: Aet13FatorPergunta[];
  qpsRespostas: AetLaudoQpsResposta[];
  fatoresPsi: AetLaudoFatorPsi[];
  semaforo: Aet13FatorSemaforo[];
}) {
  const { owas, checklist } = setor;

  const pergunta = (slug: string) =>
    checklistPerguntas.find((p) => p.slug === slug)?.label ??
    CHECKLIST_PERGUNTAS_PADRAO.find((p) => p.slug === slug)?.label ??
    slug;

  const temOwas =
    owasConfig.length > 0
      ? owasConfig.some((cat) => {
          const field = SLUG_TO_OWAS_FIELD[cat.slug];
          return field && (owas[field] ?? []).length > 0;
        })
      : OWAS_ROWS.some((r) => (owas[r.field] ?? []).length > 0);

  const customExtras = Object.entries(setor.respostas_extras ?? {}).filter(
    ([slug]) => !SLUGS_PADRAO.has(slug)
  );

  const extrasDeSecao = (secao: string) =>
    customExtras.filter(
      ([slug]) => checklistPerguntas.find((p) => p.slug === slug)?.secao === secao
    );

  const extrasAdocao = customExtras.filter(([slug]) =>
    (checklistPerguntas.find((p) => p.slug === slug)?.secao ?? "").startsWith("Adoção")
  );

  // v209: pergunta excluída na tela de configuração sai da prévia e do PDF.
  // Seção sem nenhuma linha visível não imprime título.
  const oculta = (slug: string) => perguntaOculta(checklistPerguntas, slug);
  const secaoTemLinha = (slugs: string[], extras: unknown[]) =>
    algumaVisivel(checklistPerguntas, slugs) || extras.length > 0;

  const extrasSemSecao = customExtras.filter(([slug]) => {
    const secao = checklistPerguntas.find((p) => p.slug === slug)?.secao ?? "";
    return (
      secao !== "Postura" &&
      secao !== "Exigência de Tempo" &&
      secao !== "Ritmo de Trabalho" &&
      !secao.startsWith("Adoção") &&
      secao !== "Organização do Trabalho"
    );
  });

  return (
    <div className="overflow-hidden rounded border border-gray-300">
      {!hideHeader && (
        <div className="bg-gray-700 px-4 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white">
            Setor {idx + 1}: {setor.nome_setor || "—"}
          </p>
          {setor.cargos.length > 0 && (
            <p className="text-[10px] text-gray-300">
              {setor.cargos.map((c) => c.nome).filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-100">

        {/* Bloco "Atividade geral / cargo: descrição" REMOVIDO: repetia, em outro
            formato, exatamente o que a ficha do setor (SetorRiscosBlock) mostra
            na tabela logo acima — atingia 26 de 26 setores da base. O PDF nunca
            teve esse bloco; agora a prévia também não. */}

        {/* OWAS — cards idênticos ao setores/page.tsx */}
        {temOwas && (
          <div className="px-4 py-3">
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              OWAS — Análise de Posturas
            </p>
            <div className="grid grid-cols-2 gap-3">
              {owasConfig.map((cat) => {
                const field = SLUG_TO_OWAS_FIELD[cat.slug];
                if (!field) return null;
                const selected = (owas[field] ?? []) as number[];
                const imageSrc = cat.imagem_url ?? SLUG_TO_DEFAULT_IMAGE[cat.slug];
                return (
                  <div key={cat.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <h4
                      className="mb-2 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {cat.titulo}
                    </h4>
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1.5">
                        {cat.opcoes.map((opt) => {
                          const checked = selected.includes(opt.value);
                          return (
                            <div key={opt.value} className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                                  checked
                                    ? "border-gray-700 bg-gray-700"
                                    : "border-gray-300 bg-white"
                                )}
                              >
                                {checked && (
                                  <svg
                                    viewBox="0 0 10 8"
                                    className="h-2 w-2"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M1 4l2.5 2.5L9 1" />
                                  </svg>
                                )}
                              </span>
                              <span
                                className="text-xs leading-snug"
                                style={{ color: checked ? "#111827" : "#9ca3af" }}
                              >
                                {opt.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {imageSrc && (
                        <div className="w-32 shrink-0 self-start">
                          <StorageImg
                            stored={imageSrc}
                            alt={`Referência OWAS: ${cat.titulo}`}
                            className="h-auto w-full rounded border border-gray-200"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Checklist — layout idêntico ao da página de setores */}
        <div className="px-4 py-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2.5">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Checklist Ergonômico
            </p>

            {/* Postura */}
            <CheckSep title="Postura" />
            {!oculta("levantamento_acima_limite") && <CheckRow label={pergunta("levantamento_acima_limite")} value={checklist.levantamento_acima_limite} />}
            <CheckSelect label={pergunta("trabalho_predominante")} value={checklist.trabalho_predominante} />
            {!oculta("pausas_descanso") && <CheckRow label={pergunta("pausas_descanso")} value={checklist.pausas_descanso} />}
            {!oculta("uso_cadeira") && <CheckRow label={pergunta("uso_cadeira")} value={checklist.uso_cadeira} />}
            {!oculta("cadeira_adequada") && <CheckRow label={pergunta("cadeira_adequada")} value={checklist.cadeira_adequada} />}
            {!oculta("monitor") && <CheckRow label={pergunta("monitor")} value={checklist.monitor} />}
            {extrasDeSecao("Postura").map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}

            {/* Exigência de Tempo */}
            {secaoTemLinha(["exigencia_levantamento"], extrasDeSecao("Exigência de Tempo")) && (
              <>
            <CheckSep title="Exigência de Tempo" />
            {!oculta("exigencia_levantamento") && <CheckRow label={pergunta("exigencia_levantamento")} value={checklist.exigencia_levantamento} />}
            {extrasDeSecao("Exigência de Tempo").map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}
              </>
            )}

            {/* Ritmo de Trabalho */}
            {secaoTemLinha(["ritmo_por_demanda"], extrasDeSecao("Ritmo de Trabalho")) && (
              <>
            <CheckSep title="Ritmo de Trabalho" />
            {!oculta("ritmo_por_demanda") && <CheckRow label={pergunta("ritmo_por_demanda")} value={checklist.ritmo_por_demanda} />}
            {extrasDeSecao("Ritmo de Trabalho").map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}
              </>
            )}

            {/* Adoção de Rodízios */}
            {secaoTemLinha(["pausas_formais", "rodizios_sistematizados"], extrasAdocao) && (
              <>
            <CheckSep title="Adoção de Rodízios — Ergonômico" />
            {!oculta("pausas_formais") && <CheckRow label={pergunta("pausas_formais")} value={checklist.pausas_formais} />}
            {!oculta("rodizios_sistematizados") && <CheckRow label={pergunta("rodizios_sistematizados")} value={checklist.rodizios_sistematizados} />}
            {extrasAdocao.map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}
              </>
            )}

            {/* Organização do Trabalho */}
            {!oculta("organizacao_trabalho") && (
              <>
            <CheckSep title="Organização do Trabalho" />
            <p className="text-xs italic leading-relaxed" style={{ color: "var(--laudo-texto-suave)" }}>
              {pergunta("organizacao_trabalho")}
            </p>
              </>
            )}

            {/* Perguntas adicionais */}
            {extrasSemSecao.length > 0 && (
              <>
                <CheckSep title="Perguntas Adicionais" />
                {extrasSemSecao.map(([slug, val]) => (
                  <CheckRow
                    key={slug}
                    label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                    value={val}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Fotos */}
        {(setor.fotos ?? []).length > 0 && (
          <div className="px-4 py-3 text-center">
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Registros Fotográficos
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {(setor.fotos ?? []).slice(0, 6).map((url, i) => (
                <div
                  key={i}
                  className="relative w-40 shrink-0 overflow-hidden rounded-md border border-gray-200"
                  style={{ aspectRatio: "16/9" }}
                >
                  <StorageImg
                    stored={url}
                    alt={`Foto ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/40 px-1 text-[10px] text-white">
                    {i + 1}/{(setor.fotos ?? []).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parecer Técnico */}
        {setor.parecer_tecnico && (
          <div className="px-4 py-3">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Parecer Técnico
            </p>
            <RichBlock html={setor.parecer_tecnico} />
          </div>
        )}

        {/* Recomendações */}
        {setor.recomendacoes && (
          <div className="px-4 py-3">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Recomendações
            </p>
            <RichBlock html={setor.recomendacoes} />
          </div>
        )}

        {/* Demais Condições */}
        {setor.demais_condicoes && (
          <div className="px-4 py-3">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Demais Condições Avaliadas
            </p>
            <RichBlock html={setor.demais_condicoes} />
          </div>
        )}

        {/* Fatores Psicossociais — por setor */}
        {(() => {
          const psiRows = fatoresConfig
            .filter((f) => f.codigo !== "F13")
            .map((f) => {
              const media = calcMediaSetor(fatoresPerguntas, qpsRespostas, setor.id, f.codigo);
              if (media === null) return null;
              const zona: ZonaPsi | null = zonaFromMedia(media);
              return { f, media, zona };
            })
            .filter((x): x is { f: Aet13FatorConfig; media: number; zona: ZonaPsi | null } => x !== null);

          // v135: os fatores psi são POR SETOR — sem o filtro de id_setor, este
          // find pegava a linha de um setor qualquer e repetia embaixo de todos.
          const f13 = fatoresPsi.find(
            (fp) => fp.id_setor === setor.id && fp.codigo_fator === "F13" && fp.avaliado && fp.zona,
          );

          if (psiRows.length === 0 && !f13) return null;

          return (
            <div className="px-4 py-3">
              <p
                className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#9ca3af" }}
              >
                Fatores Psicossociais — QPS
              </p>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    {["Cód.", "Fator", "Média", "Zona", "Nível PGR"].map((h) => (
                      <th
                        key={h}
                        className="border border-gray-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {psiRows.map(({ f, media, zona }) => (
                    <tr key={f.codigo} className="border-b border-gray-100 even:bg-gray-50">
                      <td className="border border-gray-100 px-2 py-1 font-mono font-bold text-gray-700">{f.codigo}</td>
                      <td className="border border-gray-100 px-2 py-1 text-gray-800">{f.nome}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center text-gray-700">{media.toFixed(2)}</td>
                      <td className="border border-gray-100 px-2 py-1">
                        {zona ? (
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: ZONA_PRINT[zona], color: ZONA_TEXT[zona] }}
                          >
                            {zona.charAt(0).toUpperCase() + zona.slice(1)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="border border-gray-100 px-2 py-1 text-gray-700">{nivelPgrFromZona(zona)}</td>
                    </tr>
                  ))}
                  {f13 && (
                    <tr className="border-b border-gray-100 even:bg-gray-50">
                      <td className="border border-gray-100 px-2 py-1 font-mono font-bold text-gray-700">F13</td>
                      <td className="border border-gray-100 px-2 py-1 text-gray-800">
                        {fatoresConfig.find((fc) => fc.codigo === "F13")?.nome ?? "Proteção da segurança física"}
                      </td>
                      <td className="border border-gray-100 px-2 py-1 text-center text-gray-700">—</td>
                      <td className="border border-gray-100 px-2 py-1">
                        {f13.zona ? (
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: ZONA_PRINT[f13.zona], color: ZONA_TEXT[f13.zona] }}
                          >
                            {f13.zona.charAt(0).toUpperCase() + f13.zona.slice(1)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="border border-gray-100 px-2 py-1 text-gray-700">{nivelPgrFromZona(f13.zona)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {/* Observações por fator. INCLUI o F13, igual ao PDF: a tabela
                  acima imprime a linha do F13 nos dois lados, e sem isto a
                  prévia mostrava a nota sem o texto que a justifica (20 das 23
                  linhas de F13 da base têm texto escrito). */}
              {(() => {
                const nomeF13 = fatoresConfig.find((fc) => fc.codigo === "F13")?.nome ?? "Proteção da segurança física";
                const paraExplicar = [
                  ...psiRows.map(({ f }) => ({ codigo: f.codigo, nome: f.nome })),
                  ...(f13 ? [{ codigo: "F13", nome: nomeF13 }] : []),
                ]
                  .map((f) => {
                    const fp = fatoresPsi.find((p) => p.id_setor === setor.id && p.codigo_fator === f.codigo);
                    return fp && !htmlVazio(fp.observacao) ? { ...f, html: fp.observacao as string } : null;
                  })
                  .filter((x): x is { codigo: string; nome: string; html: string } => x !== null);
                if (paraExplicar.length === 0) return null;
                return (
                  <div className="mt-2 space-y-2">
                    {paraExplicar.map((o) => (
                      <div key={o.codigo} className="rounded border border-gray-200 p-2">
                        <p className="mb-1 text-[10px] font-bold text-gray-700">
                          {o.codigo} — {o.nome}
                        </p>
                        <div
                          className="prose prose-xs mt-1 max-w-none text-[11px] leading-relaxed text-gray-700 [&_a]:text-gray-700 [&_a]:no-underline [&_p]:my-1"
                          dangerouslySetInnerHTML={{ __html: textoParaHtml(o.html) }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Checklist row helpers (layout idêntico ao setores/page.tsx) ──────────────

function CheckSep({ title }: { title: string }) {
  return (
    <div className="border-t border-gray-200 pt-2.5 first:border-t-0 first:pt-0">
      <p
        className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "#9ca3af" }}
      >
        {title}
      </p>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: string }) {
  const isSim = value === "sim";
  const isNa = value === "nao_aplica";
  const texto = isSim ? "Sim" : isNa ? "N/A" : "Não";
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs leading-snug" style={{ color: "var(--text-body)" }}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
          isSim
            ? "bg-gray-800 text-white"
            : "bg-white ring-1 ring-gray-200"
        )}
        style={!isSim ? { color: "#9ca3af" } : undefined}
      >
        {texto}
      </span>
    </div>
  );
}

function CheckSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs leading-snug" style={{ color: "var(--text-body)" }}>
        {label}
      </span>
      <span
        className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold bg-gray-800 text-white"
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Fatores Psicossociais (QPS) — UM capítulo com subtítulos ────────────────

function PsicossocialSections({
  fatoresPsi,
  fatoresConfig,
  fatoresPerguntas,
  qpsRespostas,
  semaforo: _semaforo,
  qpsMeta,
  setores,
  zonaFromMedia: _zonaFromMedia,
  nivelPgrFromZona,
  numero,
  titulo,
}: {
  fatoresPsi: AetLaudoFatorPsi[];
  fatoresConfig: Aet13FatorConfig[];
  /** Perguntas e respostas: o quadro geral RECALCULA a média (ver abaixo). */
  fatoresPerguntas: Aet13FatorPergunta[];
  qpsRespostas: AetLaudoQpsResposta[];
  semaforo: Aet13FatorSemaforo[];
  qpsMeta: import("@/lib/supabase/types").AetLaudoQpsMeta | null;
  setores: AetSetor[];
  zonaFromMedia: (m: number | null) => ZonaPsi | null;
  nivelPgrFromZona: (z: ZonaPsi | null) => string;
  /** Número do capítulo, do modelo — o mesmo que sai no PDF. */
  numero?: number;
  titulo?: string;
}) {
  const nomeSetor = (idSetor: string) =>
    setores.find((s) => s.id === idSetor)?.nome_setor?.trim() || "Setor sem nome";

  // v135: uma linha por (setor, fator). Descarta setores já excluídos do laudo.
  const existentes = apenasSetoresExistentes(
    fatoresPsi.filter((f) => f.avaliado),
    setores.map((s) => s.id),
  );

  // Média e zona RECALCULADAS das respostas, igual ao PDF: `media` é
  // numeric(3,1) na produção e este quadro era o único da prévia que imprimia
  // o valor gravado — saía "4.30" onde a tabela por setor mostra "4.25".
  const avaliados = recalcularDasRespostas(existentes, fatoresPerguntas, qpsRespostas);

  // Quadro geral: cada fator na condição mais desfavorável entre os setores.
  const fatoresAvaliados = consolidarPiorCaso(avaliados);

  const comAnalise = avaliados
    .filter((f) => !htmlVazio(f.observacao))
    .sort(
      (a, b) =>
        a.codigo_fator.localeCompare(b.codigo_fator) ||
        nomeSetor(a.id_setor).localeCompare(nomeSetor(b.id_setor)),
    );

  const multiSetor = setores.length > 1;

  return (
    <>
      {/* UM capítulo com subtítulos, igual ao PDF. Eram 4 seções numeradas
          (14, 15, 16, 17) — e era isso que empurrava as Considerações para 20. */}
      <Section num={numero ? String(numero) : "14"} title={titulo?.trim() || "Avaliação dos Fatores Psicossociais — QPS Nordic"}>
        <p className="text-xs leading-relaxed text-gray-700">
          A avaliação dos fatores psicossociais foi realizada por meio do instrumento QPS Nordic
          (Questionário de Fatores Psicossociais no Trabalho), desenvolvido pelos institutos
          nórdicos de saúde ocupacional e adaptado à realidade brasileira. O instrumento contempla
          13 fatores relacionados às condições psicossociais do trabalho, classificados em zonas
          de risco: verde (baixo), amarela (moderado), laranja (elevado) e vermelha (crítico).
        </p>

      {qpsMeta && (qpsMeta.n_respondentes || qpsMeta.periodo_inicio || qpsMeta.modo_aplicacao || qpsMeta.tecnico_aplicador) && (
        <SubSection title="Dados da Aplicação">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {qpsMeta.n_respondentes != null && (
                <tr className="border-b border-gray-100">
                  <td className="w-48 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">Respondentes</td>
                  <td className="px-3 py-1.5 text-gray-700">
                    {qpsMeta.n_respondentes}
                    {qpsMeta.total_elegivel ? ` de ${qpsMeta.total_elegivel} elegíveis` : ""}
                  </td>
                </tr>
              )}
              {(qpsMeta.periodo_inicio || qpsMeta.periodo_fim) && (
                <tr className="border-b border-gray-100">
                  <td className="w-48 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">Período</td>
                  <td className="px-3 py-1.5 text-gray-700">
                    {qpsMeta.periodo_inicio
                      ? new Date(qpsMeta.periodo_inicio + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                    {qpsMeta.periodo_fim
                      ? ` a ${new Date(qpsMeta.periodo_fim + "T00:00:00").toLocaleDateString("pt-BR")}`
                      : ""}
                  </td>
                </tr>
              )}
              {qpsMeta.modo_aplicacao && (
                <tr className="border-b border-gray-100">
                  <td className="w-48 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">Modo de Aplicação</td>
                  <td className="px-3 py-1.5 text-gray-700">{qpsMeta.modo_aplicacao}</td>
                </tr>
              )}
              {qpsMeta.tecnico_aplicador && (
                <tr className="border-b border-gray-100">
                  <td className="w-48 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">Técnico Aplicador</td>
                  <td className="px-3 py-1.5 text-gray-700">{qpsMeta.tecnico_aplicador}</td>
                </tr>
              )}
              {qpsMeta.observacao_geral && (
                <tr>
                  <td className="w-48 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">Observações</td>
                  <td className="px-3 py-1.5 text-gray-700">{qpsMeta.observacao_geral}</td>
                </tr>
              )}
            </tbody>
          </table>
        </SubSection>
      )}

      <SubSection title="Resultado Geral por Fator">
        {multiSetor && (
          <p className="mb-2 text-[10px] text-gray-500">
            Consolidado dos setores avaliados pelo pior caso: cada fator é apresentado na condição
            mais desfavorável encontrada entre os setores. O detalhamento por setor consta no
            capítulo de Análise Ergonômica.
          </p>
        )}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              {["Cód.", "Fator", "Média", "Zona de Risco", "Nível PGR"].map((h) => (
                <th key={h} className="border border-gray-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fatoresAvaliados.map((fp) => {
              const cfg = fatoresConfig.find((f) => f.codigo === fp.codigo_fator);
              return (
                <tr key={fp.codigo_fator} className="border-b border-gray-100 even:bg-gray-50">
                  <td className="border border-gray-100 px-2 py-1 font-mono font-bold text-gray-700">{fp.codigo_fator}</td>
                  <td className="border border-gray-100 px-2 py-1 text-gray-800">{cfg?.nome ?? fp.codigo_fator}</td>
                  <td className="border border-gray-100 px-2 py-1 text-center text-gray-700">
                    {fp.codigo_fator === "F13" ? "—" : fp.media != null ? fp.media.toFixed(2) : "—"}
                  </td>
                  <td className="border border-gray-100 px-2 py-1">
                    {fp.zona ? (
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: ZONA_PRINT[fp.zona], color: ZONA_TEXT[fp.zona] }}>
                        {fp.zona.charAt(0).toUpperCase() + fp.zona.slice(1)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="border border-gray-100 px-2 py-1 text-gray-700">{nivelPgrFromZona(fp.zona)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SubSection>

      {comAnalise.length > 0 && (
        <SubSection title="Análise Detalhada por Fator">
          <div className="space-y-4">
            {comAnalise.map((fp) => {
              const cfg = fatoresConfig.find((f) => f.codigo === fp.codigo_fator);
              return (
                <div key={`${fp.id_setor}:${fp.codigo_fator}`} className="rounded border border-gray-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-gray-500">{fp.codigo_fator}</span>
                    <span className="text-[11px] font-bold text-gray-700">{cfg?.nome ?? fp.codigo_fator}</span>
                    {fp.zona && (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: ZONA_PRINT[fp.zona], color: ZONA_TEXT[fp.zona] }}>
                        {fp.zona.charAt(0).toUpperCase() + fp.zona.slice(1)}
                      </span>
                    )}
                    {multiSetor && (
                      <span className="text-[10px] font-semibold text-gray-500">Setor: {nomeSetor(fp.id_setor)}</span>
                    )}
                  </div>
                  {!htmlVazio(fp.observacao) && (
                    <div
                      className="prose prose-xs max-w-none text-xs leading-relaxed text-gray-700 [&_a]:text-gray-700 [&_a]:no-underline [&_p]:my-1"
                      dangerouslySetInnerHTML={{ __html: textoParaHtml(fp.observacao) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </SubSection>
      )}
      </Section>
    </>
  );
}

// ─── Considerações Finais ────────────────────────────────────────────────────

function ConsideracoesFinaisSection({
  consideracoes,
  numero,
  titulo,
}: {
  consideracoes: string;
  numero?: number;
  titulo?: string;
}) {
  return (
    <Section num={numero ? String(numero) : "20"} title={titulo?.trim() || "Considerações Finais"}>
      {consideracoes ? (
        <RichBlock html={consideracoes} />
      ) : (
        <p className="text-xs italic text-gray-400">Sem considerações finais registradas.</p>
      )}
    </Section>
  );
}

// ─── Plano de Ação 5W2H ──────────────────────────────────────────────────────
// Espelha `secaoPlanoAcao` de components/pdf/templates/AetTemplate: mesmas 9
// colunas, mesma ordem, setor como linha de grupo, mesmo agrupamento
// (lib/aet/acoes). Mudou lá, mude aqui.

const PLANO_PRIO_COR: Record<string, string> = {
  Critica: "text-red-700", Alta: "text-orange-700", Media: "text-amber-700", Baixa: "text-emerald-700",
};
const PLANO_STATUS_COR: Record<string, string> = {
  Pendente: "text-amber-700", "Em Andamento": "text-blue-700", Concluida: "text-emerald-700", Cancelada: "text-gray-500",
};
const tdPlano = "border-b border-gray-100 border-r border-r-gray-50 px-1.5 py-1 align-top text-gray-900 [word-break:break-word]";

function PlanoAcaoSection({
  acoes,
  setores,
  numero,
  titulo,
  intro,
}: {
  acoes: AetAcao[];
  setores: AetSetor[];
  numero?: number;
  titulo?: string;
  /** Texto do capítulo fixo (textos_padrao.conteudo) — no PDF sai entre o título e a tabela. */
  intro?: React.ReactNode;
}) {
  const grupos = agruparAcoesPorSetor(acoes, setores);
  const heads = ["Prior.", "O quê", "Por quê", "Como", "Onde", "Quem", "Quando", "Quanto", "Status"];
  const cols = ["6%", "16%", "14%", "13%", "9%", "10%", "13%", "9%", "10%"];
  return (
    <Section num={numero ? String(numero) : ""} title={titulo?.trim() || "Plano de Ação (5W2H)"}>
      {intro}
      <table className="w-full table-fixed border-collapse text-[8px]">
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h} className="border-b-2 border-verde-primary border-r border-r-gray-200 bg-emerald-50 px-1.5 py-1 text-left text-[7.5px] font-bold uppercase tracking-wide text-verde-primary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Fragment key={g.setor?.id ?? "__gerais"}>
              <tr>
                <td colSpan={heads.length} className="bg-gray-700 px-1.5 py-1 text-[8.5px] font-bold uppercase tracking-wider text-white">
                  {g.setor
                    ? `Setor ${setores.indexOf(g.setor) + 1}: ${g.setor.nome_setor?.trim() || "—"}`
                    : ROTULO_ACOES_GERAIS}
                </td>
              </tr>
              {g.acoes.map((a) => (
                <tr key={a.id_acao} className="break-inside-avoid">
                  <td className={cn(tdPlano, "font-bold", PLANO_PRIO_COR[a.prioridade] ?? PLANO_PRIO_COR.Media)}>{a.prioridade}</td>
                  <td className={cn(tdPlano, "font-semibold")}>{a.what_acao}</td>
                  <td className={tdPlano}>{a.why_justificativa || "—"}</td>
                  <td className={tdPlano}>{a.how_metodo || "—"}</td>
                  <td className={tdPlano}>{a.where_local || "—"}</td>
                  <td className={tdPlano}>{a.who_responsavel || "—"}</td>
                  <td className={tdPlano}>{formatarPrazoAcao(a.when_prazo) || "—"}</td>
                  <td className={tdPlano}>{a.how_much_custo || "—"}</td>
                  <td className={cn(tdPlano, "font-bold", PLANO_STATUS_COR[a.status] ?? PLANO_STATUS_COR.Pendente)}>{a.status}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Assinatura do Responsável Técnico ───────────────────────────────────────

function AssinaturaSection({
  responsavel,
  tituloProfissional,
  registroProfissional,
  idRelatorio,
  dataRelatorio,
  hideAcoes,
  numero,
}: {
  responsavel: string;
  tituloProfissional: string;
  registroProfissional: string;
  idRelatorio: string;
  dataRelatorio?: string;
  hideAcoes?: boolean;
  /** Número do modelo — o PDF imprime "15. FOLHA DE ASSINATURAS". */
  numero?: number;
}) {
  return (
    <AssinaturaRelatorio
      nomeResponsavel={responsavel ?? undefined}
      cargoResponsavel={tituloProfissional ?? undefined}
      dataRelatorio={dataRelatorio}
      tabelaNome="aet_relatorios"
      docId={idRelatorio}
      hideAcoes={hideAcoes}
      numero={numero}
    />
  );
}
