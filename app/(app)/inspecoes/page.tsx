"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, ChartBar, Search } from "lucide-react";
import { Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import InspecaoRow from "@/components/inspecoes/InspecaoRow";
import { useAssociadosPorInspecao } from "@/lib/hooks/useInspecaoAssociados";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  useInspecoesPaginadas,
  type FiltroInspecao,
  type OrdemInspecao,
} from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCanCreate, useCanDelete, useIsAdmin } from "@/lib/hooks/useUsuario";
import { useUnidadeAtiva } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { registrarSoftNaLixeira } from "@/lib/hooks/useLixeira";
import { cn } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

const FILTROS: { value: FiltroInspecao; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "CONCLUIDA", label: "Concluídas" },
];

const ORDENS: { value: OrdemInspecao; label: string }[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "revisao", label: "Por revisão" },
];

export default function InspecoesPage() {
  return (
    <Suspense fallback={null}>
      <InspecoesInner />
    </Suspense>
  );
}

function InspecoesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState<Inspecao | null>(null);
  const [editResp, setEditResp] = useState<Inspecao | null>(null);

  const delInsp = useMutation({
    mutationFn: async (insp: Inspecao) => {
      const supabase = createSupabaseBrowserClient();
      // Registra na lixeira com o status ANTERIOR preservado (para restaurar).
      await registrarSoftNaLixeira({
        tabela: "inspecoes",
        chave: "id_inspecao",
        id: insp.id_inspecao,
        dados: insp as unknown as Record<string, unknown>,
        rotulo: `Inspeção ${insp.id_inspecao} (rev. ${insp.revisao})`,
        modulo: "inspecoes",
      });
      const { error } = await supabase
        .from("inspecoes")
        .update({ status: "DELETADA", updated_at: new Date().toISOString() } as never)
        .eq("id_inspecao", insp.id_inspecao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-lista"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-counts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Inspeção excluída");
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empresaParam = params.get("empresa");
  const unidadeAtivaId = useUnidadeAtiva((s) => s.id);
  const [empresaId, setEmpresaId] = useState<string | null>(empresaParam);
  // Filtro de unidade inicia na Unidade ativa (escopo global), se houver.
  const [idUnidade, setIdUnidade] = useState<string>(unidadeAtivaId ?? "");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [filtro, setFiltro] = useState<FiltroInspecao>("Todos");
  const [ordem, setOrdem] = useState<OrdemInspecao>("recentes");
  const [buscaTecnico, setBuscaTecnico] = useState("");
  const [buscaAssociado, setBuscaAssociado] = useState("");
  const [page, setPage] = useState(1);

  const { data: unidades = [] } = useUnidades();

  // Reseta para página 1 quando qualquer filtro muda
  useEffect(() => { setPage(1); }, [empresaId, idUnidade, dataIni, dataFim, filtro, ordem, buscaTecnico, buscaAssociado]);

  // Mantém o filtro de unidade alinhado à Unidade ativa (inclusive ao limpá-la).
  useEffect(() => { setIdUnidade(unidadeAtivaId ?? ""); }, [unidadeAtivaId]);

  // Sincroniza empresa na URL para deep-linking
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (empresaId) sp.set("empresa", empresaId);
    else sp.delete("empresa");
    const next = sp.toString();
    router.replace(`${pathname}${next ? "?" + next : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const { data: empresa } = useEmpresa(empresaId);
  const { lista, counts } = useInspecoesPaginadas({
    idEmpresa: empresaId,
    tecnico: buscaTecnico,
    associado: buscaAssociado,
    idUnidade: idUnidade || null,
    dataIni,
    dataFim,
    filtro,
    ordem,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = lista.data?.items ?? [];
  const total = lista.data?.total ?? 0;
  const { data: associadosMap } = useAssociadosPorInspecao(items.map((i) => i.id_inspecao));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isLoading = lista.isLoading;
  const isFetching = lista.isFetching;
  const countData = counts.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1 max-w-xl">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Empresa
          </label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} modulo="sst" unidadeId={unidadeAtivaId} />
        </div>
        <div className="flex gap-2">
          {empresaId && (
            <Link
              href={`/empresas/${empresaId}/relatorio`}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Relatório consolidado"
            >
              <ChartBar className="size-4" />
              Consolidado
            </Link>
          )}
          {canCreate && (
            <Link
              href={empresaId ? `/inspecoes/nova?empresa=${empresaId}` : "/inspecoes/nova"}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
            >
              <Plus className="size-4" />
              Nova Inspeção
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Técnico</label>
          <Search className="pointer-events-none absolute left-2.5 top-[31px] size-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por técnico..."
            value={buscaTecnico}
            onChange={(e) => setBuscaTecnico(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Associado</label>
          <Search className="pointer-events-none absolute left-2.5 top-[31px] size-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por associado..."
            value={buscaAssociado}
            onChange={(e) => setBuscaAssociado(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Unidade</label>
          <select
            value={idUnidade}
            onChange={(e) => setIdUnidade(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">De</label>
          <input
            type="date"
            value={dataIni}
            onChange={(e) => setDataIni(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Até</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        {(idUnidade || dataIni || dataFim || buscaTecnico || buscaAssociado) && (
          <button
            type="button"
            onClick={() => { setIdUnidade(""); setDataIni(""); setDataFim(""); setBuscaTecnico(""); setBuscaAssociado(""); }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {empresaId && empresa && (
        <div className="rounded-lg border border-verde-border bg-verde-light px-4 py-2 text-sm text-verde-dark">
          Mostrando inspeções de <strong>{empresa.nome_empresa}</strong>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filtro === f.value
                  ? "border-verde-primary bg-verde-primary text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
              {countData && (
                <span className="ml-1.5 opacity-75">({countData[f.value]})</span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500">Ordenar:</label>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemInspecao)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              {ORDENS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
      </div>

      <div className={cn(
        "reveal-up overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm",
        isFetching && "opacity-70 transition-opacity"
      )}>
        {isLoading ? (
          <div className="p-5">
            <TabelaSkeleton linhas={6} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-14 text-center text-sm text-gray-500">
            Nenhuma inspeção {filtro !== "Todos" ? "nesse status" : "encontrada"}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">ID</th>
                  {!empresaId && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Empresa</th>
                  )}
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rev.</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Data</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Responsável</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Associados</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <InspecaoRow
                    key={i.id_inspecao}
                    insp={i}
                    associados={associadosMap?.get(i.id_inspecao) ?? []}
                    onDelete={canDelete ? setConfirmDel : undefined}
                    onEditResponsavel={isAdmin ? setEditResp : undefined}
                    showEmpresa={!empresaId}
                  />
                ))}
              </tbody>
            </table>
            {total > PAGE_SIZE && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir inspeção?"
        description={
          confirmDel
            ? `A inspeção ${confirmDel.id_inspecao} (rev. ${confirmDel.revisao}) será marcada como excluída. Ela não aparecerá mais na lista, mas o histórico fica preservado no banco.`
            : undefined
        }
        variant="danger"
        loading={delInsp.isPending}
        onConfirm={() => confirmDel && delInsp.mutate(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />

      {editResp && (
        <ModalEditarResponsavel insp={editResp} onClose={() => setEditResp(null)} />
      )}
    </div>
  );
}

/** Edição do responsável (técnico) de uma inspeção — apenas Admin. */
function ModalEditarResponsavel({ insp, onClose }: { insp: Inspecao; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(insp.responsavel ?? "");

  // Técnicos/Admins ativos cadastrados como usuários (modal só abre para Admin → pode ler usuarios).
  const { data: tecnicos = [] } = useQuery({
    queryKey: ["usuarios-tecnicos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("usuarios")
        .select("nome, perfil, ativo_sistema")
        .in("perfil", ["Admin", "Tecnico"])
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as Array<{ nome: string; ativo_sistema: boolean | null }>)
        .filter((u) => u.ativo_sistema !== false && (u.nome ?? "").trim())
        .map((u) => u.nome.trim());
    },
  });

  // Lista de opções: técnicos cadastrados + o valor atual (se for nome legado fora da lista).
  const opcoes = Array.from(
    new Set([...(insp.responsavel?.trim() ? [insp.responsavel.trim()] : []), ...tecnicos]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const save = useMutation({
    mutationFn: async (responsavel: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("inspecoes")
        .update({ responsavel, updated_at: new Date().toISOString() } as never)
        .eq("id_inspecao", insp.id_inspecao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecoes-lista"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-tecnico"] });
      qc.invalidateQueries({ queryKey: ["dashboard-por-mes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-concluidas-detalhe"] });
      qc.invalidateQueries({ queryKey: ["inspecao", insp.id_inspecao] });
      toast.success("Responsável atualizado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Editar responsável</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Inspeção {insp.id_inspecao} · rev. {insp.revisao}
          </p>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Técnico responsável</label>
          <select
            value={nome}
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-primary/40"
          >
            <option value="">Selecione o técnico…</option>
            {opcoes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Lista de usuários cadastrados como Técnico/Admin (ativos).
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => save.mutate(nome.trim())}
            disabled={save.isPending || !nome.trim()}
            className="rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {save.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
