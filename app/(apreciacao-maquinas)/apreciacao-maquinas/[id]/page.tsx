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
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useApreciacaoMaquina,
  useAtualizarApreciacaoMaquina,
  useExcluirApreciacaoMaquina,
} from "@/lib/hooks/useApreciacoesMaquinas";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useMaquina } from "@/lib/hooks/useInventarioMaquinas";
import { useCanEdit, useCanDelete } from "@/lib/hooks/useUsuario";
import ItemApreciacaoCard from "@/components/apreciacao-maquinas/ItemApreciacaoCard";
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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/apreciacao-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Esta apreciação está finalizada — visualização somente leitura.
        </div>
      )}
      {finalizada && canEdit && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
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
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
          <div className="mt-3 flex justify-end">
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
          <div key={grupo.categoria} className="space-y-2">
            <h3 className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-700">
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
      </section>

      {/* Seção: Conclusão Técnica */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <CheckCircle2 className="size-4" /> Conclusão Técnica
        </h2>
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
          <div className="flex flex-wrap items-center justify-end gap-2">
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

      {/* Zona de perigo */}
      {canDelete && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
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
