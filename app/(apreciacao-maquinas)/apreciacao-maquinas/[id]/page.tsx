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
  Printer,
  Sparkles,
  X as IconX,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useApreciacaoMaquina,
  useAtualizarApreciacaoMaquina,
  useExcluirApreciacaoMaquina,
  useAdicionarItemLivreApreciacao,
  useGerarParecerApreciacaoIA,
} from "@/lib/hooks/useApreciacoesMaquinas";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useMaquina } from "@/lib/hooks/useInventarioMaquinas";
import { useCanEdit, useCanDelete } from "@/lib/hooks/useUsuario";
import ItemApreciacaoCard from "@/components/apreciacao-maquinas/ItemApreciacaoCard";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import {
  CATEGORIAS_NR12_LABELS,
  CATEGORIAS_NR12_ORDEM,
  type CategoriaNR12,
} from "@/lib/apreciacao-maquinas/catalogo-nr12";
import {
  RISCO_RESIDUAL_LABELS,
  type RiscoResidual,
  type ApreciacaoMaquinaItem,
} from "@/lib/supabase/types";

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
  const [conclusao, setConclusao] = useState("");
  const [recomendacoes, setRecomendacoes] = useState("");
  const [riscoResidual, setRiscoResidual] = useState<RiscoResidual | "">("");
  const [observacoes, setObservacoes] = useState("");

  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

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
    setConclusao(apreciacao.conclusao_tecnica ?? "");
    setRecomendacoes(apreciacao.recomendacoes ?? "");
    setRiscoResidual(apreciacao.risco_residual ?? "");
    setObservacoes(apreciacao.observacoes_gerais ?? "");
  }, [apreciacao]);

  const empresaNome = useMemo(() => {
    if (!apreciacao) return "";
    return (
      empresas.find((e) => e.id_empresa === apreciacao.id_empresa)
        ?.nome_empresa ?? "—"
    );
  }, [empresas, apreciacao]);

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
      // Preenche os 3 campos — usuário revisa e clica "Salvar conclusão"
      setConclusao(result.conclusao_tecnica);
      setRecomendacoes(result.recomendacoes_finais);
      if (result.risco_residual_sugerido) {
        setRiscoResidual(result.risco_residual_sugerido);
      }
      toast.success("Parecer gerado — revise antes de salvar");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao gerar parecer"
      );
    }
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
      {/* Topo — ações (oculta no print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/apreciacao-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Printer className="size-4" /> Imprimir / PDF
          </button>
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
        titulo={`Apreciação NR-12 — ${maquinaNome}`}
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
          <Campo label="Responsável técnico (Chabra)" htmlFor="resp">
            <input
              id="resp"
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              disabled={readOnly}
              className={inputClass}
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
          <select
            id="risco"
            value={riscoResidual}
            onChange={(e) =>
              setRiscoResidual(e.target.value as RiscoResidual | "")
            }
            disabled={readOnly}
            className={inputClass}
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

      {/* Bloco de assinatura — só no print */}
      <section className="hidden print:block print:break-inside-avoid print:mt-6">
        <div className="grid grid-cols-2 gap-12 pt-8">
          <div className="border-t border-gray-400 pt-2 text-center text-xs">
            <p className="font-semibold">
              {apreciacao.responsavel || "Responsável técnico (Chabra)"}
            </p>
            <p className="text-[10px] text-gray-600">Responsável técnico</p>
          </div>
          <div className="border-t border-gray-400 pt-2 text-center text-xs">
            <p className="font-semibold">
              {apreciacao.responsavel_empresa ||
                "Responsável pela empresa avaliada"}
            </p>
            <p className="text-[10px] text-gray-600">
              Responsável pela empresa
            </p>
          </div>
        </div>
        <p className="mt-8 text-center text-[9px] text-gray-500">
          Apreciação NR-12 gerada por Chabra — Segurança e Saúde do Trabalho ·{" "}
          {new Date().toLocaleDateString("pt-BR")}
        </p>
      </section>

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
