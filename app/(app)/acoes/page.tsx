"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Building2,
  Layers,
  AlertTriangle,
  Search,
  Printer,
} from "lucide-react";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useAcoes, useDeleteAcao } from "@/lib/hooks/useAcoes";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { usePagination } from "@/lib/hooks/usePagination";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AcaoForm from "@/components/acoes/AcaoForm";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import Modal from "@/components/ui/Modal";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { buscarAcoes } from "@/lib/busca/acoes";
import { fmtData, cn } from "@/lib/utils";
import type {
  Acao5W2H,
  AcaoPrioridade,
  AcaoStatus,
} from "@/lib/supabase/types";

const STATUS_CFG: Record<
  AcaoStatus,
  { label: string; border: string; bg: string; text: string }
> = {
  Pendente: {
    label: "Pendente",
    border: "border-gray-300",
    bg: "bg-gray-100",
    text: "text-gray-700",
  },
  "Em Andamento": {
    label: "Em Andamento",
    border: "border-blue-300",
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
  Concluida: {
    label: "Concluída",
    border: "border-green-300",
    bg: "bg-green-100",
    text: "text-green-800",
  },
  Cancelada: {
    label: "Cancelada",
    border: "border-red-300",
    bg: "bg-red-100",
    text: "text-red-800",
  },
};

const PRIORIDADE_CFG: Record<
  AcaoPrioridade,
  { label: string; bg: string; text: string }
> = {
  Baixa: { label: "Baixa", bg: "bg-slate-100", text: "text-slate-700" },
  Media: { label: "Média", bg: "bg-amber-100", text: "text-amber-800" },
  Alta: { label: "Alta", bg: "bg-orange-100", text: "text-orange-800" },
  Critica: { label: "Crítica", bg: "bg-red-100", text: "text-red-800" },
};

export default function AcoesPage() {
  const canEdit = useCanEdit();
  const { data: empresas = [] } = useEmpresas();
  const { data: acoes = [], isLoading } = useAcoes();
  const del = useDeleteAcao();

  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<AcaoStatus | "">("");
  const [filtroPrior, setFiltroPrior] = useState<AcaoPrioridade | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Acao5W2H | null>(null);
  const [confirmDel, setConfirmDel] = useState<Acao5W2H | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  const empresaPorId = useMemo(
    () => new Map(empresas.map((e) => [e.id_empresa, e.nome_empresa])),
    [empresas]
  );

  const { itens: filtradas, aproximado } = useMemo(() => {
    let arr = acoes;
    if (filtroEmpresa) arr = arr.filter((a) => a.id_empresa === filtroEmpresa);
    if (filtroStatus) arr = arr.filter((a) => a.status === filtroStatus);
    if (filtroPrior) arr = arr.filter((a) => a.prioridade === filtroPrior);
    // Mesmo critério do PDF (lib/busca/acoes.ts): tolerante a acento e erro de digitação.
    return buscarAcoes(arr, busca);
  }, [acoes, filtroEmpresa, filtroStatus, filtroPrior, busca]);

  /**
   * As ações vêm do banco por prazo, então duas da mesma empresa apareciam
   * separadas por ações de outras no meio. Aqui elas ficam juntas: as empresas
   * em ordem alfabética e, dentro de cada uma, a ordem de prazo de sempre
   * (`sort` do JS é estável, não embaralha o que já veio ordenado).
   */
  const agrupadas = useMemo(() => {
    const nome = (a: Acao5W2H) =>
      empresaPorId.get(a.id_empresa) ?? a.id_empresa;
    return [...filtradas].sort((a, b) =>
      nome(a).localeCompare(nome(b), "pt-BR", { sensitivity: "base" })
    );
  }, [filtradas, empresaPorId]);

  /** Total por empresa — o cabeçalho do grupo conta o plano inteiro dela, e
   *  não só o pedaço que coube na página. */
  const totalPorEmpresa = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of agrupadas) m.set(a.id_empresa, (m.get(a.id_empresa) ?? 0) + 1);
    return m;
  }, [agrupadas]);

  /** URL do PDF de uma empresa; com `aplicarFiltros`, leva o recorte da tela. */
  const montarUrlPdf = useCallback(
    (idEmpresa: string, aplicarFiltros: boolean) => {
      const qs = new URLSearchParams();
      if (aplicarFiltros) {
        if (filtroStatus) qs.set("status", filtroStatus);
        if (filtroPrior) qs.set("prioridade", filtroPrior);
        if (busca.trim()) qs.set("q", busca.trim());
      }
      const sufixo = qs.toString();
      return `/api/pdf/plano-acao/${idEmpresa}${sufixo ? `?${sufixo}` : ""}`;
    },
    [filtroStatus, filtroPrior, busca]
  );

  const pag = usePagination({
    data: agrupadas,
    pageSize: 20,
    resetKey: `${filtroEmpresa}|${filtroStatus}|${filtroPrior}|${busca}`,
  });

  // Contagens por status pra mostrar nas pills de filtro
  const counts = useMemo(() => {
    const acc: Record<AcaoStatus | "Total", number> = {
      Total: acoes.length,
      Pendente: 0,
      "Em Andamento": 0,
      Concluida: 0,
      Cancelada: 0,
    };
    for (const a of acoes) acc[a.status]++;
    return acc;
  }, [acoes]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Target className="size-6 text-verde-primary" />
            Plano de Ação
          </h1>
          <p className="text-sm text-gray-600">
            Tabela 5W2H · {counts.Total} ação(ões) cadastrada(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* A empresa é escolhida no próprio fluxo do PDF: depender do filtro
              da lista escondia a funcionalidade de quem só quer imprimir. */}
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-verde-primary bg-white px-4 py-2.5 text-sm font-semibold text-verde-primary shadow-sm transition hover:bg-verde-primary/5 active:scale-95"
          >
            <Printer className="size-4" /> Baixar PDF
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
            >
              <Plus className="size-4" /> Nova Ação
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar ação, responsável ou local..."
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}
              </option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as AcaoStatus | "")}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Todos status</option>
            {(Object.keys(STATUS_CFG) as AcaoStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_CFG[s].label} ({counts[s]})
              </option>
            ))}
          </select>
          <select
            value={filtroPrior}
            onChange={(e) =>
              setFiltroPrior(e.target.value as AcaoPrioridade | "")
            }
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Toda prioridade</option>
            {(Object.keys(PRIORIDADE_CFG) as AcaoPrioridade[]).map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_CFG[p].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="reveal-up overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-5">
            <TabelaSkeleton linhas={5} />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-verde-light">
              <Target className="size-7 text-verde-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-800">
              {acoes.length === 0 ? "Nenhuma ação cadastrada ainda" : "Nenhuma ação encontrada"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {acoes.length === 0 ? "Crie a primeira ação 5W2H" : "Tente ajustar os filtros"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={filtradas.length} className="m-3" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ação (O quê)</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Local / Setor</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Responsável</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prazo</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prioridade</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pag.pageItems.map((a, i) => {
                  const sCfg = STATUS_CFG[a.status];
                  const pCfg = PRIORIDADE_CFG[a.prioridade];
                  const anterior = i > 0 ? pag.pageItems[i - 1] : null;
                  const abreGrupo = !anterior || anterior.id_empresa !== a.id_empresa;
                  // Grupo grande é partido pela paginação: o cabeçalho se
                  // repete no topo da página seguinte, avisando que continua.
                  const continuacao =
                    i === 0 &&
                    agrupadas[(pag.page - 1) * pag.pageSize - 1]?.id_empresa ===
                      a.id_empresa;
                  return (
                    <Fragment key={a.id_acao}>
                      {abreGrupo && (
                        <tr className="border-b border-gray-100 bg-verde-light">
                          <td colSpan={7} className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <Building2 className="size-4 text-verde-primary" />
                              <span className="text-sm font-semibold text-gray-900">
                                {empresaPorId.get(a.id_empresa) ?? a.id_empresa}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                · {totalPorEmpresa.get(a.id_empresa) ?? 0} ação(ões)
                                {continuacao && " · continuação"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-50 transition-colors hover:bg-verde-light/25 last:border-b-0">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{a.what_acao}</p>
                          {a.why_justificativa && (
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              <em>Por quê:</em> {a.why_justificativa}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {a.where_local ? (
                            <div className="flex items-center gap-1 text-gray-700">
                              <Layers className="size-3.5 text-gray-400" />
                              {a.where_local}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {a.id_risco && (
                            <div className="mt-0.5 flex items-center gap-1 text-red-700">
                              <AlertTriangle className="size-3.5" />
                              Risco vinculado
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {a.who_responsavel ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {a.when_prazo ? (
                            <div className="inline-flex items-center gap-1 text-gray-700">
                              <Calendar className="size-3.5 text-gray-400" />
                              {fmtData(a.when_prazo)}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              pCfg.bg,
                              pCfg.text
                            )}
                          >
                            {pCfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              sCfg.border,
                              sCfg.bg,
                              sCfg.text
                            )}
                          >
                            {sCfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditing(a);
                                    setFormOpen(true);
                                  }}
                                  className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-verde-light hover:text-verde-primary"
                                  title="Editar"
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDel(a)}
                                  className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                  title="Excluir"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {pag.showPagination && (
              <Pagination
                page={pag.page}
                totalPages={pag.totalPages}
                totalItems={pag.totalItems}
                pageSize={pag.pageSize}
                onChange={pag.setPage}
              />
            )}
          </div>
        )}
      </div>

      <ModalPdfPlano
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        empresas={empresas.map((e) => ({ id: e.id_empresa, nome: e.nome_empresa }))}
        empresaInicial={filtroEmpresa}
        acoes={acoes}
        filtrosTela={{ status: filtroStatus, prioridade: filtroPrior, busca: busca.trim() }}
        montarUrlPdf={montarUrlPdf}
      />

      <AcaoForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir ação?"
        description={
          confirmDel
            ? `"${confirmDel.what_acao}" será removida permanentemente.`
            : undefined
        }
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirmDel && del.mutate(confirmDel.id_acao)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

// ============================================================
// Modal "Baixar PDF" — escolha da empresa dentro do próprio fluxo
// ============================================================

/**
 * O documento é sempre de UMA empresa: um plano que mistura clientes não é
 * entregável, e o cabeçalho do PDF é a identificação dela. A escolha acontece
 * aqui, e não no filtro da lista — quem abre a tela só para imprimir não tinha
 * como adivinhar que o filtro de cima destravava o botão.
 *
 * Os filtros da tela (status, prioridade, busca) entram como opção: por padrão
 * o PDF sai com o plano inteiro da empresa; marcando a caixa, sai só o recorte
 * que está na tela — e o próprio PDF imprime qual recorte foi aplicado.
 */
function ModalPdfPlano({
  open,
  onClose,
  empresas,
  empresaInicial,
  acoes,
  filtrosTela,
  montarUrlPdf,
}: {
  open: boolean;
  onClose: () => void;
  empresas: Array<{ id: string; nome: string }>;
  empresaInicial: string;
  acoes: Acao5W2H[];
  filtrosTela: { status: string; prioridade: string; busca: string };
  montarUrlPdf: (idEmpresa: string, aplicarFiltros: boolean) => string;
}) {
  const [idEmpresa, setIdEmpresa] = useState(empresaInicial);
  const [aplicarFiltros, setAplicarFiltros] = useState(false);

  // Reabrir o modal parte do filtro atual da tela — mas só se aquela empresa
  // tiver plano; senão o campo abriria preenchido com uma escolha inválida.
  useEffect(() => {
    if (!open) return;
    const temPlano =
      !!empresaInicial && acoes.some((a) => a.id_empresa === empresaInicial);
    setIdEmpresa(temPlano ? empresaInicial : "");
  }, [open, empresaInicial, acoes]);

  const temFiltro =
    !!filtrosTela.status || !!filtrosTela.prioridade || !!filtrosTela.busca;

  const descricaoFiltros = [
    filtrosTela.status && `status ${STATUS_CFG[filtrosTela.status as AcaoStatus]?.label ?? filtrosTela.status}`,
    filtrosTela.prioridade && `prioridade ${PRIORIDADE_CFG[filtrosTela.prioridade as AcaoPrioridade]?.label ?? filtrosTela.prioridade}`,
    filtrosTela.busca && `busca "${filtrosTela.busca}"`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Quantas ações o PDF vai conter — evita gerar um documento vazio sem saber.
  const totalNoPdf = useMemo(() => {
    if (!idEmpresa) return 0;
    const daEmpresa = acoes.filter((a) => {
      if (a.id_empresa !== idEmpresa) return false;
      if (!aplicarFiltros) return true;
      if (filtrosTela.status && a.status !== filtrosTela.status) return false;
      if (filtrosTela.prioridade && a.prioridade !== filtrosTela.prioridade) return false;
      return true;
    });
    // Mesmo critério da tela e da rota do PDF (lib/busca/acoes.ts).
    return buscarAcoes(daEmpresa, aplicarFiltros ? filtrosTela.busca : "").itens.length;
  }, [acoes, idEmpresa, aplicarFiltros, filtrosTela]);

  const nomeEmpresa = empresas.find((e) => e.id === idEmpresa)?.nome;

  // Só entram empresas que têm ação: oferecer o cadastro inteiro fazia o
  // usuário escolher uma empresa sem plano e receber um PDF sem linhas —
  // e não dava para saber, de fora, quais têm plano montado.
  const empresasComPlano = useMemo(() => {
    const porEmpresa = new Map<string, number>();
    for (const a of acoes) {
      porEmpresa.set(a.id_empresa, (porEmpresa.get(a.id_empresa) ?? 0) + 1);
    }
    return empresas
      .filter((e) => porEmpresa.has(e.id))
      .map((e) => ({ ...e, total: porEmpresa.get(e.id) ?? 0 }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [empresas, acoes]);

  return (
    <Modal open={open} onClose={onClose} title="Baixar PDF do Plano de Ação" size="md">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
            Empresa *
          </label>
          <select
            value={idEmpresa}
            onChange={(e) => setIdEmpresa(e.target.value)}
            disabled={empresasComPlano.length === 0}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:bg-gray-50"
          >
            <option value="">Selecione a empresa...</option>
            {empresasComPlano.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome} — {e.total} ação(ões)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {empresasComPlano.length === 0
              ? "Nenhuma empresa tem ação cadastrada ainda — cadastre em “Nova Ação” para poder gerar o PDF."
              : "Só aparecem empresas com ação cadastrada. O PDF sai com o plano 5W2H da empresa escolhida — só o plano, sem o restante da inspeção."}
          </p>
        </div>

        {temFiltro && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <input
              type="checkbox"
              checked={aplicarFiltros}
              onChange={(e) => setAplicarFiltros(e.target.checked)}
              className="mt-0.5 size-4 accent-verde-primary"
            />
            <span className="text-xs text-gray-700">
              Aplicar os filtros da tela ({descricaoFiltros}).
              <span className="block text-gray-500">
                Desmarcado, o PDF traz o plano completo da empresa.
              </span>
            </span>
          </label>
        )}

        {idEmpresa && (
          <p className="text-xs text-gray-600">
            {totalNoPdf === 0
              ? "Nenhuma ação nesse recorte — o PDF sairia sem linhas."
              : `${totalNoPdf} ação(ões) entram no documento.`}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <BotaoGerarPdf
            label="Gerar PDF"
            disabled={!idEmpresa || totalNoPdf === 0}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
            apiPdfUrl={idEmpresa ? montarUrlPdf(idEmpresa, aplicarFiltros) : undefined}
            tabelaNome="plano_acao"
            docId={idEmpresa || undefined}
            registrarPdf={
              idEmpresa
                ? {
                    modulo: "plano_acao",
                    tipoDocumento: "Plano de Ação 5W2H",
                    idRelatorio: idEmpresa,
                    empresaId: idEmpresa,
                    empresaNome: nomeEmpresa,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </Modal>
  );
}
