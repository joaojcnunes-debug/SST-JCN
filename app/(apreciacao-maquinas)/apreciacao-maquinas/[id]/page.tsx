"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Cog,
  Loader2,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ClipboardList,
  FileText,
  Plus,
  Sparkles,
  Wand2,
  ListTodo,
  Activity,
  ShieldCheck,
  X as IconX,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import {
  useApreciacaoMaquina,
  useAtualizarApreciacaoMaquina,
  useExcluirApreciacaoMaquina,
  useAdicionarItemLivreApreciacao,
  useGerarParecerApreciacaoIA,
} from "@/lib/hooks/useApreciacoesMaquinas";
import PlanoAcaoTable from "@/components/apreciacao-maquinas/PlanoAcaoTable";
import RiscoHrnTable from "@/components/apreciacao-maquinas/RiscoHrnTable";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import {
  montarValoresEmpresa,
  formatarDataBR,
} from "@/lib/textos-padrao/variaveis";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useMaquina } from "@/lib/hooks/useInventarioMaquinas";
import { useCanEdit, useCanDelete } from "@/lib/hooks/useUsuario";
import ItemApreciacaoCard from "@/components/apreciacao-maquinas/ItemApreciacaoCard";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import { cn } from "@/lib/utils";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import RevisaoIAModal, { type CampoRevisaoIA } from "@/components/ui/RevisaoIAModal";
import {
  CATEGORIAS_NR12_LABELS,
  CATEGORIAS_NR12_ORDEM,
  type CategoriaNR12,
} from "@/lib/apreciacao-maquinas/catalogo-nr12";
import {
  RISCO_RESIDUAL_LABELS,
  COMPONENTES_MAQUINA_NR12,
  SISTEMAS_SEGURANCA_NR12,
  NPE_HRN_LABELS,
  type RiscoResidual,
  type ApreciacaoMaquinaItem,
  type NivelRisco,
  type NpeHrn,
} from "@/lib/supabase/types";

/** Mapeia NivelRisco (matriz SST JCN Consultoria) pra RiscoResidual (Apreciação). */
const NIVEL_PARA_RISCO_RESIDUAL: Record<NivelRisco, RiscoResidual> = {
  Trivial: "BAIXO",
  Baixo: "BAIXO",
  Moderado: "MEDIO",
  Alto: "ALTO",
  "Muito Alto": "CRITICO",
};

const ORDEM_NIVEL: NivelRisco[] = [
  "Trivial",
  "Baixo",
  "Moderado",
  "Alto",
  "Muito Alto",
];

export default function DetalheApreciacaoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const canEdit = useCanEdit();
  const canDelete = useCanDelete();
  const { data, isLoading, error } = useApreciacaoMaquina(id);
  const { data: empresas = [] } = useEmpresas();
  const atualizar = useAtualizarApreciacaoMaquina();
  const excluir = useExcluirApreciacaoMaquina();
  const adicionarLivre = useAdicionarItemLivreApreciacao();
  const gerarParecerIA = useGerarParecerApreciacaoIA();
  const { data: maquinaVinculada } = useMaquina(
    data?.apreciacao.id_maquina ?? null
  );

  const apreciacao = data?.apreciacao;
  const itens = data?.itens ?? [];

  // Estado do cabeçalho (form editável)
  const [titulo, setTitulo] = useState("");
  const [setor, setSetor] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelEmpresa, setResponsavelEmpresa] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataApreciacao, setDataApreciacao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [recomendacoes, setRecomendacoes] = useState("");
  const [riscoResidual, setRiscoResidual] = useState<RiscoResidual | "">("");
  const [observacoes, setObservacoes] = useState("");
  // Parecer da IA aguardando revisão (modal aceitar/editar/rejeitar)
  const [revisaoParecer, setRevisaoParecer] = useState<CampoRevisaoIA[] | null>(null);

  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  // Identificação dos componentes / limites / sistemas (NR-12 HRN)
  const [componentes, setComponentes] = useState<string[]>([]);
  const [limiteUso, setLimiteUso] = useState("");
  const [limiteEspaco, setLimiteEspaco] = useState("");
  const [limiteTempo, setLimiteTempo] = useState("");
  const [limiteProdutividade, setLimiteProdutividade] = useState("");
  const [npe, setNpe] = useState<NpeHrn | "">("");
  const [sistemasAtual, setSistemasAtual] = useState<string[]>([]);
  const [sistemasNecessario, setSistemasNecessario] = useState<string[]>([]);

  // Form "Adicionar item livre"
  const [livreOpen, setLivreOpen] = useState(false);
  const [livreCategoria, setLivreCategoria] = useState<CategoriaNR12>(
    "PROCEDIMENTOS"
  );
  const [livreTitulo, setLivreTitulo] = useState("");
  const [livreDescricao, setLivreDescricao] = useState("");

  // Sincroniza estado quando carrega
  useEffect(() => {
    if (!apreciacao) return;
    setTitulo(apreciacao.titulo ?? "");
    setSetor(apreciacao.setor ?? "");
    setResponsavel(apreciacao.responsavel ?? "");
    setResponsavelEmpresa(apreciacao.responsavel_empresa ?? "");
    setCidade(apreciacao.cidade ?? "");
    setDataApreciacao(apreciacao.data_apreciacao ?? "");
    setDataValidade(apreciacao.data_validade ?? "");
    setConclusao(apreciacao.conclusao_tecnica ?? "");
    setRecomendacoes(apreciacao.recomendacoes ?? "");
    setRiscoResidual(apreciacao.risco_residual ?? "");
    setObservacoes(apreciacao.observacoes_gerais ?? "");
    // HRN
    setComponentes(apreciacao.componentes_maquina ?? []);
    setLimiteUso(apreciacao.limite_uso ?? "");
    setLimiteEspaco(apreciacao.limite_espaco ?? "");
    setLimiteTempo(apreciacao.limite_tempo ?? "");
    setLimiteProdutividade(apreciacao.limite_produtividade ?? "");
    setNpe((apreciacao.npe as NpeHrn) ?? "");
    setSistemasAtual(apreciacao.sistemas_atual ?? []);
    setSistemasNecessario(apreciacao.sistemas_necessario ?? []);
  }, [apreciacao]);

  const empresa = useMemo(() => {
    if (!apreciacao) return null;
    return (
      empresas.find((e) => e.id_empresa === apreciacao.id_empresa) ?? null
    );
  }, [empresas, apreciacao]);
  const empresaNome = empresa?.nome_empresa ?? "—";

  // Agrupa itens por categoria preservando a ordem definida no catálogo
  const itensPorCategoria = useMemo(() => {
    const grupos: Record<string, ApreciacaoMaquinaItem[]> = {};
    itens.forEach((i) => {
      const cat = i.item_categoria;
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(i);
    });
    return CATEGORIAS_NR12_ORDEM.map((cat) => ({
      categoria: cat as CategoriaNR12,
      label: CATEGORIAS_NR12_LABELS[cat as CategoriaNR12],
      itens: grupos[cat] ?? [],
    })).filter((g) => g.itens.length > 0);
  }, [itens]);

  // Resumo de situações para barra de progresso
  const resumo = useMemo(() => {
    const r = { CONFORME: 0, NAO_CONFORME: 0, NAO_APLICAVEL: 0, PENDENTE: 0 };
    itens.forEach((i) => {
      r[i.situacao] += 1;
    });
    return r;
  }, [itens]);

  const totalAvaliados = itens.length - resumo.PENDENTE;
  const totalItens = itens.length;
  const podeFinalizar =
    apreciacao?.status === "RASCUNHO" && resumo.PENDENTE === 0;

  const dirty = !!apreciacao && (
    titulo !== (apreciacao.titulo ?? "")
    || setor !== (apreciacao.setor ?? "")
    || responsavel !== (apreciacao.responsavel ?? "")
    || responsavelEmpresa !== (apreciacao.responsavel_empresa ?? "")
    || cidade !== (apreciacao.cidade ?? "")
    || dataApreciacao !== (apreciacao.data_apreciacao ?? "")
    || dataValidade !== (apreciacao.data_validade ?? "")
    || observacoes !== (apreciacao.observacoes_gerais ?? "")
    || conclusao !== (apreciacao.conclusao_tecnica ?? "")
    || recomendacoes !== (apreciacao.recomendacoes ?? "")
    || riscoResidual !== (apreciacao.risco_residual ?? "")
  );

  async function handleSalvarCabecalho() {
    if (!id) return;
    try {
      await atualizar.mutateAsync({
        id_apreciacao: id,
        titulo: titulo.trim() || null,
        setor: setor.trim() || null,
        responsavel: responsavel.trim() || null,
        responsavel_empresa: responsavelEmpresa.trim() || null,
        cidade: cidade.trim() || null,
        data_apreciacao: dataApreciacao || null,
        data_validade: dataValidade || null,
        observacoes_gerais: observacoes.trim() || null,
      });
      toast.success("Dados gerais salvos");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar");
    }
  }

  async function handleSalvarConclusao() {
    if (!id) return;
    try {
      await atualizar.mutateAsync({
        id_apreciacao: id,
        conclusao_tecnica: conclusao.trim() || null,
        recomendacoes: recomendacoes.trim() || null,
        risco_residual: (riscoResidual || null) as RiscoResidual | null,
      });
      toast.success("Conclusão salva");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar conclusão");
    }
  }

  async function handleSalvarAnalise() {
    if (!id) return;
    try {
      await atualizar.mutateAsync({
        id_apreciacao: id,
        componentes_maquina: componentes.length ? componentes : null,
        limite_uso: limiteUso.trim() || null,
        limite_espaco: limiteEspaco.trim() || null,
        limite_tempo: limiteTempo.trim() || null,
        limite_produtividade: limiteProdutividade.trim() || null,
        npe: npe || null,
        sistemas_atual: sistemasAtual.length ? sistemasAtual : null,
        sistemas_necessario: sistemasNecessario.length ? sistemasNecessario : null,
      });
      toast.success("Análise salva");
    } catch {
      toast.error("Falha ao salvar análise");
    }
  }

  async function handleFinalizar() {
    if (!id) return;
    try {
      // Salva conclusão antes (best-effort)
      await atualizar.mutateAsync({
        id_apreciacao: id,
        conclusao_tecnica: conclusao.trim() || null,
        recomendacoes: recomendacoes.trim() || null,
        risco_residual: (riscoResidual || null) as RiscoResidual | null,
        status: "FINALIZADO",
      });
      toast.success("Apreciação finalizada");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao finalizar");
    }
  }

  async function handleReabrir() {
    if (!id) return;
    try {
      await atualizar.mutateAsync({ id_apreciacao: id, status: "RASCUNHO" });
      toast.success("Apreciação reaberta");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao reabrir");
    }
  }

  // Próximo índice pra `LIVRE-{N}` — conta itens livres existentes e pega +1
  const proximoIndiceLivre = useMemo(
    () => itens.filter((i) => i.item_origem === "LIVRE").length + 1,
    [itens]
  );

  async function handleAdicionarLivre() {
    if (!id) return;
    if (!livreTitulo.trim()) {
      toast.error("Título do item é obrigatório");
      return;
    }
    try {
      await adicionarLivre.mutateAsync({
        id_apreciacao: id,
        categoria: livreCategoria,
        titulo: livreTitulo.trim(),
        descricao: livreDescricao.trim() || null,
        ordem: itens.length, // último
        proximoIndiceLivre,
      });
      toast.success("Item livre adicionado");
      setLivreTitulo("");
      setLivreDescricao("");
      setLivreOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao adicionar item");
    }
  }

  async function handleGerarParecerIA() {
    if (!apreciacao) return;
    // Bloqueio: precisa ter pelo menos 1 item avaliado (não-PENDENTE)
    const itensAvaliados = itens.filter((i) => i.situacao !== "PENDENTE");
    if (itensAvaliados.length === 0) {
      toast.error("Avalie ao menos 1 item antes de gerar o parecer");
      return;
    }
    try {
      const result = await gerarParecerIA.mutateAsync({
        empresa: { nome: empresaNome },
        maquina: {
          nome: maquinaVinculada?.nome ?? null,
          descricao: apreciacao.maquina_descricao,
        },
        setor: apreciacao.setor,
        responsavel: apreciacao.responsavel,
        itens: itensAvaliados.map((i) => ({
          codigo: i.item_codigo,
          categoria: i.item_categoria,
          titulo: i.item_titulo,
          situacao: i.situacao,
          observacao: i.observacao,
          recomendacao: i.recomendacao,
          livre: i.item_origem === "LIVRE",
        })),
        textoAtual: conclusao.trim() || null,
      });
      // Abre o modal de revisão — nada é aplicado sem o usuário confirmar
      const campos: CampoRevisaoIA[] = [
        {
          key: "conclusao_tecnica",
          label: "Conclusão técnica",
          valorSugerido: result.conclusao_tecnica,
          valorAtual: conclusao || null,
          multiline: true,
        },
        {
          key: "recomendacoes",
          label: "Recomendações finais",
          valorSugerido: result.recomendacoes_finais,
          valorAtual: recomendacoes || null,
          multiline: true,
        },
      ];
      if (result.risco_residual_sugerido) {
        campos.push({
          key: "risco_residual",
          label: "Risco residual",
          valorSugerido: result.risco_residual_sugerido,
          valorAtual: riscoResidual || null,
          options: (Object.keys(RISCO_RESIDUAL_LABELS) as RiscoResidual[]).map((r) => ({
            value: r,
            label: RISCO_RESIDUAL_LABELS[r],
          })),
        });
      }
      setRevisaoParecer(campos);
    } catch (err) {
      console.error(err);
      toast.error(
        mensagemErro(err, "Falha ao gerar parecer")
      );
    }
  }

  /** Aplica os campos aceitos na revisão do parecer da IA. */
  function aplicarRevisaoParecer(valores: Record<string, string>) {
    if (valores.conclusao_tecnica !== undefined) setConclusao(valores.conclusao_tecnica);
    if (valores.recomendacoes !== undefined) setRecomendacoes(valores.recomendacoes);
    if (valores.risco_residual !== undefined) {
      setRiscoResidual((valores.risco_residual as RiscoResidual) || "");
    }
    setRevisaoParecer(null);
    toast.success("Parecer aplicado — revise e clique em Salvar conclusão");
  }

  /** Sugere risco_residual baseado no MAX nível dos itens NAO_CONFORME. */
  function handleSugerirRiscoResidual() {
    const niveis = itens
      .filter((i) => i.situacao === "NAO_CONFORME" && i.nivel_risco_calculado)
      .map((i) => i.nivel_risco_calculado as NivelRisco);
    if (niveis.length === 0) {
      toast.error(
        "Avalie probabilidade × severidade nos itens NAO_CONFORME antes de sugerir"
      );
      return;
    }
    let maxIdx = 0;
    for (const n of niveis) {
      const idx = ORDEM_NIVEL.indexOf(n);
      if (idx > maxIdx) maxIdx = idx;
    }
    const sugerido = NIVEL_PARA_RISCO_RESIDUAL[ORDEM_NIVEL[maxIdx]];
    setRiscoResidual(sugerido);
    toast.success(
      `Risco residual sugerido: ${RISCO_RESIDUAL_LABELS[sugerido]} (max nível: ${ORDEM_NIVEL[maxIdx]})`
    );
  }

  async function handleExcluir() {
    if (!id) return;
    try {
      await excluir.mutateAsync(id);
      toast.success("Apreciação excluída");
      router.push("/apreciacao-maquinas");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao excluir");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !apreciacao) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href="/apreciacao-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          Apreciação não encontrada.
        </div>
      </div>
    );
  }

  const finalizada = apreciacao.status === "FINALIZADO";
  const readOnly = !canEdit || finalizada;
  const maquinaNome =
    maquinaVinculada?.nome ?? apreciacao.maquina_descricao ?? "Máquina";

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-3">
      {/* CSS de impressão — ABNT NBR 14724 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
          body { font-size: 12pt; line-height: 1.5; }
        }
      `}</style>

      {/* Topo — ações (oculta no print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/apreciacao-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              finalizada
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {finalizada ? "Finalizada" : "Rascunho"}
          </span>
        </div>
      </div>

      {/* Cabeçalho de impressão (visível em tela também, discreto) */}
      <RelatorioPrintHeader
        titulo={`Apreciação de Risco NR-12 — ${maquinaNome}`}
        subtitulo={empresaNome}
        terciario={
          apreciacao.data_apreciacao
            ? new Date(
                apreciacao.data_apreciacao + "T00:00"
              ).toLocaleDateString("pt-BR")
            : null
        }
      />

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Cog className="size-5 text-orange-600" />
          {apreciacao.titulo || `Apreciação ${maquinaNome}`}
        </h1>
        <p className="text-xs text-gray-500">
          {empresaNome}
          {apreciacao.setor ? ` · ${apreciacao.setor}` : ""} · Criada{" "}
          {new Date(apreciacao.created_at).toLocaleDateString("pt-BR")}
          {apreciacao.finalizado_em
            ? ` · Finalizada ${new Date(apreciacao.finalizado_em).toLocaleDateString("pt-BR")}`
            : ""}
        </p>
      </div>

      {finalizada && !canEdit && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 print:hidden">
          Esta apreciação está finalizada — visualização somente leitura.
        </div>
      )}
      {finalizada && canEdit && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 print:hidden">
          <span>
            Apreciação finalizada em{" "}
            {apreciacao.finalizado_em &&
              new Date(apreciacao.finalizado_em).toLocaleDateString("pt-BR")}
            . Reabra pra editar.
          </span>
          <button
            type="button"
            onClick={handleReabrir}
            disabled={atualizar.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <RotateCcw className="size-3" /> Reabrir
          </button>
        </div>
      )}

      {/* Resumo de progresso */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:border print:border-gray-300 print:shadow-none print:p-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
          Progresso do checklist
        </p>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>
            <strong>{totalAvaliados}</strong> de <strong>{totalItens}</strong>{" "}
            itens avaliados
          </span>
          <span className="text-xs text-gray-500">
            {totalItens > 0
              ? `${Math.round((totalAvaliados / totalItens) * 100)}%`
              : "0%"}
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
          {totalItens > 0 && (
            <>
              <div
                className="bg-emerald-500"
                style={{ width: `${(resumo.CONFORME / totalItens) * 100}%` }}
                title={`${resumo.CONFORME} conformes`}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(resumo.NAO_CONFORME / totalItens) * 100}%` }}
                title={`${resumo.NAO_CONFORME} não conformes`}
              />
              <div
                className="bg-gray-400"
                style={{ width: `${(resumo.NAO_APLICAVEL / totalItens) * 100}%` }}
                title={`${resumo.NAO_APLICAVEL} não aplicáveis`}
              />
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            {resumo.CONFORME} conformes
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" />
            {resumo.NAO_CONFORME} não conformes
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-gray-400" />
            {resumo.NAO_APLICAVEL} N/A
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            {resumo.PENDENTE} pendentes
          </span>
        </div>
      </div>

      {/* Textos Padrão — capítulos de introdução antes do conteúdo técnico */}
      <TextosPadraoPrint
        modulo="apreciacao_maquinas"
        valores={{
          ...montarValoresEmpresa(empresa),
          titulo: apreciacao.titulo ?? "",
          maquina_nome: maquinaNome,
          setor: apreciacao.setor ?? "",
          responsavel: apreciacao.responsavel ?? "",
          responsavel_empresa: apreciacao.responsavel_empresa ?? "",
          cidade: apreciacao.cidade ?? "",
          data_apreciacao: formatarDataBR(apreciacao.data_apreciacao),
          data_atual: new Date().toLocaleDateString("pt-BR"),
          total_itens: String(itens.length),
          total_nao_conforme: String(
            itens.filter((i) => i.situacao === "NAO_CONFORME").length
          ),
          risco_residual: apreciacao.risco_residual ?? "",
          carimbo: apreciacao.responsavel ?? "",
          importado: formatarDataBR(apreciacao.created_at),
        }}
        posicao="inicio"
      />

      {/* Seção: Dados Gerais */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <FileText className="size-4" /> Dados Gerais
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Título" htmlFor="titulo">
            <input
              id="titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
          <Campo label="Máquina" htmlFor="maq">
            <input
              id="maq"
              type="text"
              value={maquinaNome}
              disabled
              className={inputClass}
            />
          </Campo>
          <Campo label="Setor" htmlFor="setor">
            <input
              id="setor"
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
          <Campo label="Cidade" htmlFor="cidade">
            <input
              id="cidade"
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
          <Campo label="Responsável técnico (JCN Consultoria)" htmlFor="resp">
            <ProfissionalSelect
              value={responsavel}
              onChange={(nome) => setResponsavel(nome)}
              className={readOnly ? "pointer-events-none opacity-60" : ""}
            />
          </Campo>
          <Campo label="Responsável da empresa" htmlFor="respe">
            <input
              id="respe"
              type="text"
              value={responsavelEmpresa}
              onChange={(e) => setResponsavelEmpresa(e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
          <Campo label="Data da apreciação" htmlFor="data">
            <input
              id="data"
              type="date"
              value={dataApreciacao}
              onChange={(e) => setDataApreciacao(e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
          <Campo label="Validade do documento" htmlFor="validade">
            <input
              id="validade"
              type="date"
              value={dataValidade}
              onChange={(e) => setDataValidade(e.target.value)}
              disabled={readOnly}
              className={inputClass}
            />
          </Campo>
        </div>
        <Campo label="Observações gerais" htmlFor="obs">
          <textarea
            id="obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={readOnly}
            className={inputClass}
          />
        </Campo>
        {!readOnly && (
          <div className="mt-3 flex justify-end print:hidden">
            <button
              type="button"
              onClick={handleSalvarCabecalho}
              disabled={atualizar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {atualizar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar dados gerais
            </button>
          </div>
        )}
      </section>

      {/* ── SEÇÃO: Identificação dos Componentes + Limites ──────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <Cog className="size-4 text-orange-600" /> Identificação dos Componentes da Máquina
        </h2>
        <p className="text-[11px] text-gray-500">
          Marque os tipos de componentes presentes nesta máquina (ABNT ISO/TR 14121-2:2018).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COMPONENTES_MAQUINA_NR12.map((comp) => {
            const checked = componentes.includes(comp);
            return (
              <label key={comp} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors", checked ? "border-orange-300 bg-orange-50 text-orange-800" : "border-gray-200 text-gray-700 hover:bg-gray-50", readOnly && "cursor-default")}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => !readOnly && setComponentes((prev) => checked ? prev.filter((c) => c !== comp) : [...prev, comp])}
                  className="accent-orange-600"
                />
                <span>{comp}</span>
              </label>
            );
          })}
        </div>
        {/* Limites */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600">Limites</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              ["limiteUso", limiteUso, setLimiteUso, "De Uso", "Ex: Alimentos, panificação"],
              ["limiteEspaco", limiteEspaco, setLimiteEspaco, "De Espaço", "Ex: Interior da padaria, 2º andar"],
              ["limiteTempo", limiteTempo, setLimiteTempo, "De Tempo", "Ex: Vida útil 15 anos"],
              ["limiteProdutividade", limiteProdutividade, setLimiteProdutividade, "De Produtividade", "Ex: 80 kg/h"],
            ] as [string, string, (v: string) => void, string, string][]).map(([, val, setter, label, placeholder]) => (
              <label key={label} className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
                <input type="text" value={val} onChange={(e) => setter(e.target.value)} disabled={readOnly}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </label>
            ))}
          </div>
        </div>
        {/* NPE padrão */}
        <div className="w-full sm:w-1/2">
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">NPE — Número de Pessoas Expostas</span>
            <select value={npe} onChange={(e) => setNpe(e.target.value as NpeHrn | "")} disabled={readOnly}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500">
              <option value="">— Não informado —</option>
              {(Object.entries(NPE_HRN_LABELS) as [NpeHrn, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        {/* ── Sistemas de Segurança Analisados ─── */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600">
            <ShieldCheck className="mr-1 inline size-3.5 text-blue-600" />
            Sistemas de Segurança Analisados
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="border border-gray-200 px-2 py-1 text-left font-semibold">Sistema</th>
                  <th className="border border-gray-200 px-2 py-1 text-center font-semibold w-24">Sistema Atual</th>
                  <th className="border border-gray-200 px-2 py-1 text-center font-semibold w-28">Sistema Necessário</th>
                </tr>
              </thead>
              <tbody>
                {SISTEMAS_SEGURANCA_NR12.map((sis) => {
                  const temAtual = sistemasAtual.includes(sis);
                  const temNecessario = sistemasNecessario.includes(sis);
                  return (
                    <tr key={sis} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-1">{sis}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center">
                        <input type="checkbox" checked={temAtual} disabled={readOnly}
                          onChange={() => !readOnly && setSistemasAtual((prev) => temAtual ? prev.filter((s) => s !== sis) : [...prev, sis])}
                          className="accent-emerald-600 size-3.5"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-center">
                        <input type="checkbox" checked={temNecessario} disabled={readOnly}
                          onChange={() => !readOnly && setSistemasNecessario((prev) => temNecessario ? prev.filter((s) => s !== sis) : [...prev, sis])}
                          className="accent-orange-600 size-3.5"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end print:hidden">
            <button type="button" onClick={handleSalvarAnalise} disabled={atualizar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
              {atualizar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar componentes e sistemas
            </button>
          </div>
        )}
      </section>

      {/* ── SEÇÃO: Análise de Riscos HRN ──────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <Activity className="size-4 text-orange-600" /> Análise de Riscos — HRN
        </h2>
        <p className="text-[11px] text-gray-500">
          Avaliação por tipo de perigo: POD (Probabilidade) × FEP (Frequência) × GPD (Gravidade) conforme ABNT ISO/TR 14121-2:2018.
        </p>
        <RiscoHrnTable idApreciacao={apreciacao.id_apreciacao} disabled={readOnly} />
      </section>

      {/* Seção: Checklist NR-12 agrupado por categoria */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <ClipboardList className="size-4" /> Checklist NR-12
        </h2>
        {itensPorCategoria.map((grupo) => (
          <div
            key={grupo.categoria}
            className="space-y-2 print:break-inside-avoid"
          >
            <h3 className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-700 print:bg-transparent print:border-b print:border-orange-300 print:rounded-none print:text-orange-900">
              {grupo.label}{" "}
              <span className="text-orange-500/70">({grupo.itens.length})</span>
            </h3>
            <div className="space-y-2">
              {grupo.itens.map((it) => (
                <ItemApreciacaoCard
                  key={it.id_item}
                  item={it}
                  disabled={readOnly}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Form Adicionar item livre — só na tela quando rascunho */}
        {!readOnly && (
          <div className="rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/30 p-3 print:hidden">
            {livreOpen ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
                    Novo item livre — fora do catálogo NR-12
                  </p>
                  <button
                    type="button"
                    onClick={() => setLivreOpen(false)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                  >
                    <IconX className="size-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="block sm:col-span-1">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                      Categoria
                    </span>
                    <select
                      value={livreCategoria}
                      onChange={(e) =>
                        setLivreCategoria(e.target.value as CategoriaNR12)
                      }
                      className={inputClass}
                    >
                      {CATEGORIAS_NR12_ORDEM.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORIAS_NR12_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                      Título *
                    </span>
                    <input
                      type="text"
                      value={livreTitulo}
                      onChange={(e) => setLivreTitulo(e.target.value)}
                      placeholder="Ex: Falta de calço de bloqueio nas rodas"
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                    Descrição (opcional)
                  </span>
                  <textarea
                    rows={2}
                    value={livreDescricao}
                    onChange={(e) => setLivreDescricao(e.target.value)}
                    placeholder="Contexto adicional, normas relacionadas..."
                    className={inputClass}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLivreOpen(false)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAdicionarLivre}
                    disabled={adicionarLivre.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {adicionarLivre.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    Adicionar item
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLivreOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
              >
                <Plus className="size-4" /> Adicionar item livre (fora do
                catálogo)
              </button>
            )}
          </div>
        )}
      </section>

      {/* Seção: Conclusão Técnica */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
            <CheckCircle2 className="size-4" /> Conclusão Técnica
          </h2>
          {!readOnly && (
            <button
              type="button"
              onClick={handleGerarParecerIA}
              disabled={gerarParecerIA.isPending}
              title="IA lê o checklist preenchido e propõe parecer + recomendações + risco residual"
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 print:hidden"
            >
              {gerarParecerIA.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {gerarParecerIA.isPending ? "Gerando..." : "Gerar parecer com IA"}
            </button>
          )}
        </div>
        {!readOnly && (
          <p className="rounded-md border border-purple-100 bg-purple-50/40 px-2 py-1.5 text-[11px] text-purple-800 print:hidden">
            <Sparkles className="mr-1 inline size-3" />
            A IA analisa as não conformidades do checklist e propõe parecer +
            recomendações + risco residual. Revise sempre antes de finalizar —
            a responsabilidade técnica é do auditor.
          </p>
        )}
        <Campo label="Parecer técnico" htmlFor="conclusao">
          <textarea
            id="conclusao"
            rows={4}
            value={conclusao}
            onChange={(e) => setConclusao(e.target.value)}
            disabled={readOnly}
            placeholder="Resumo da avaliação, principais não conformidades, situação geral da máquina..."
            className={inputClass}
          />
        </Campo>
        <Campo label="Recomendações finais" htmlFor="rec">
          <textarea
            id="rec"
            rows={3}
            value={recomendacoes}
            onChange={(e) => setRecomendacoes(e.target.value)}
            disabled={readOnly}
            placeholder="Ações corretivas prioritárias, prazos sugeridos..."
            className={inputClass}
          />
        </Campo>
        <Campo label="Risco residual" htmlFor="risco">
          <div className="flex gap-2">
            <select
              id="risco"
              value={riscoResidual}
              onChange={(e) =>
                setRiscoResidual(e.target.value as RiscoResidual | "")
              }
              disabled={readOnly}
              className={cn(inputClass, "flex-1")}
            >
              <option value="">— Não classificado —</option>
              {(Object.keys(RISCO_RESIDUAL_LABELS) as RiscoResidual[]).map(
                (r) => (
                  <option key={r} value={r}>
                    {RISCO_RESIDUAL_LABELS[r]}
                  </option>
                )
              )}
            </select>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSugerirRiscoResidual}
                title="Sugerir baseado no MAX nível dos itens NAO_CONFORME"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 print:hidden"
              >
                <Wand2 className="size-3.5" /> Sugerir
              </button>
            )}
          </div>
        </Campo>
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
            <button
              type="button"
              onClick={handleSalvarConclusao}
              disabled={atualizar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="size-4" /> Salvar conclusão
            </button>
            <button
              type="button"
              onClick={handleFinalizar}
              disabled={!podeFinalizar || atualizar.isPending}
              title={
                !podeFinalizar
                  ? "Avalie todos os itens pendentes antes de finalizar"
                  : ""
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" /> Finalizar apreciação
            </button>
          </div>
        )}
      </section>

      {/* Seção: Plano de Ação — standalone da apreciação */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3 print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <ListTodo className="size-4" /> Plano de Adequação
        </h2>
        <PlanoAcaoTable
          idApreciacao={apreciacao.id_apreciacao}
          apreciacao={apreciacao}
          itens={itens}
          readOnly={readOnly}
        />
      </section>

      {/* Textos Padrão — só no print, renderiza capítulos cadastrados */}
      <TextosPadraoPrint
        modulo="apreciacao_maquinas"
        valores={{
          ...montarValoresEmpresa(empresa),
          titulo: apreciacao.titulo ?? "",
          maquina_nome: maquinaNome,
          setor: apreciacao.setor ?? "",
          responsavel: apreciacao.responsavel ?? "",
          responsavel_empresa: apreciacao.responsavel_empresa ?? "",
          cidade: apreciacao.cidade ?? "",
          data_apreciacao: formatarDataBR(apreciacao.data_apreciacao),
          data_atual: new Date().toLocaleDateString("pt-BR"),
          total_itens: String(itens.length),
          total_nao_conforme: String(
            itens.filter((i) => i.situacao === "NAO_CONFORME").length
          ),
          risco_residual: apreciacao.risco_residual ?? "",
          carimbo: apreciacao.responsavel ?? "",
          importado: formatarDataBR(apreciacao.created_at),
        }}
        posicao="fim"
      />

      {/* Bloco de assinatura */}
      <div className="print:break-inside-avoid">
        <AssinaturaRelatorio
          nomeResponsavel={apreciacao.responsavel ?? undefined}
          dataRelatorio={formatarDataBR(apreciacao.data_apreciacao) || undefined}
          tabelaNome="apreciacoes_maquinas"
          docId={id}
          hideAcoes
        />
      </div>

      {/* Zona de perigo */}
      {canDelete && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 print:hidden">
          <h2 className="text-sm font-bold text-red-700">Zona de perigo</h2>
          <p className="mt-1 text-xs text-red-700/80">
            Excluir esta apreciação remove o cabeçalho, todos os itens do
            checklist e suas evidências fotográficas. Ação irreversível.
          </p>
          {confirmarExclusao ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-red-700">
                Tem certeza?
              </p>
              <button
                type="button"
                onClick={handleExcluir}
                disabled={excluir.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {excluir.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Sim, excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmarExclusao(false)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarExclusao(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="size-3" /> Excluir apreciação
            </button>
          )}
        </div>
      )}

      {/* Revisão do parecer gerado pela IA — aceitar/editar/rejeitar */}
      {revisaoParecer && (
        <RevisaoIAModal
          titulo="Parecer técnico sugerido pela IA"
          descricao="Gerado a partir do checklist NR-12 preenchido (itens avaliados, NCs e níveis de risco)."
          campos={revisaoParecer}
          onAplicar={aplicarRevisaoParecer}
          onClose={() => setRevisaoParecer(null)}
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}
