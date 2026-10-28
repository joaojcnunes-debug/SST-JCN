"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, ChartBar, Check, SlidersHorizontal, X, UserCheck, ListTodo, LayoutList, ClipboardList, FileText } from "lucide-react";
import { Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import InspecaoRow from "@/components/inspecoes/InspecaoRow";
import { useAssociadosPorInspecao } from "@/lib/hooks/useInspecaoAssociados";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useInspecoesPaginadas, type FiltroInspecao } from "@/lib/hooks/useInspecao";
import { useIdsAtribuidas, usePessoasAtribuicao } from "@/lib/hooks/useInspecoesAtribuidas";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCanCreate, useCanDelete, useCanEdit, useCurrentUser, useIsSupervisor } from "@/lib/hooks/useUsuario";
import AssociadosElaboracao from "@/components/inspecoes/AssociadosElaboracao";
import { useUnidadeAtiva, useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { registrarSoftNaLixeira } from "@/lib/hooks/useLixeira";
import { cn } from "@/lib/utils";
import { alternarPilula } from "@/lib/inspecoes/pilulas";
import {
  FILTROS_VAZIOS,
  ROTULO_PERIODO,
  contarFiltrosExtras,
  escreverFiltros,
  intervaloDoPeriodo,
  lerFiltros,
  trocarVisao,
  type Documento,
  type Visao,
  type FiltrosLista,
  type OrdemLista,
  type Periodo,
} from "@/lib/inspecoes/filtros-url";
import { PRIORIDADES_DESC, PRIORIDADE_INFO, hojeSP, type PrioridadeInspecao } from "@/lib/inspecoes/prioridade";
import { COMPLEXIDADES_DESC, COMPLEXIDADE_INFO, type ComplexidadeInspecao } from "@/lib/inspecoes/complexidade";
import type { Inspecao } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

const FILTROS: { value: FiltroInspecao; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "CONCLUIDA", label: "Concluídas" },
  // Pedido de 16/09, afinado em 21/09: as inspeções que têm alguém associado ao
  // documento (SGG) — mesma pílula, mesmo jeito das outras.
  { value: "ASSOCIADOS", label: "Associados" },
  // 21/10: o avesso — ninguém no documento. Associados + Não associados = Todos.
  { value: "NAO_ASSOCIADOS", label: "Não associados" },
];

// 21/10: dá para marcar mais de uma ("não associados + em andamento"). Status
// somam entre si, associação idem, e os dois grupos se cruzam — a régua mora em
// lib/inspecoes/pilulas (alternarPilula / separarSelecao).
const ROTULO = Object.fromEntries(FILTROS.map((f) => [f.value, f.label])) as Record<FiltroInspecao, string>;

// v306 (28/10): a coluna "Status Assoc." vira filtro, e a prioridade também.
const DOCUMENTOS: { value: Documento; label: string }[] = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "EM_ELABORACAO", label: "Em elaboração" },
  { value: "ENTREGUE", label: "Entregue" },
];

const ORDENS: { value: OrdemLista; label: string }[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "revisao", label: "Por revisão" },
  { value: "prioridade", label: "Prioridade (mais urgente)" },
  { value: "espera", label: "Esperando há mais tempo" },
  { value: "prazo", label: "Prazo mais próximo" },
];

const ESPERAS = [0, 7, 15, 30];

const VISOES: { value: Visao; label: string; icone: typeof ClipboardList; dica: string }[] = [
  { value: "", label: "Todas", icone: LayoutList, dica: "Campo e documento juntos" },
  { value: "tecnicos", label: "Técnicos (campo)", icone: ClipboardList, dica: "Quem foi a campo e o andamento da inspeção" },
  { value: "associados", label: "Associados (documento)", icone: FileText, dica: "Quem está no documento e a situação dele" },
];

const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

/** Só a cor do texto da classe do selo — a pílula desligada fica branca, com o texto na cor. */
const corDoTexto = (classe: string) => classe.split(" ").filter((c) => c.startsWith("text-")).join(" ");

function GrupoPilulas({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-gray-400">{titulo}</span>
      {children}
    </div>
  );
}

export default function InspecoesPage() {
  return (
    <Suspense fallback={null}>
      <InspecoesInner />
    </Suspense>
  );
}

function Pilula({ ativo, onClick, children, contagem, className, semCheck }: { ativo: boolean; onClick: () => void; children: React.ReactNode; contagem?: number; className?: string; semCheck?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        ativo ? "border-verde-primary bg-verde-primary text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
        className,
      )}
    >
      {ativo && !semCheck && <Check className="mr-1 size-3" />}
      {children}
      {contagem !== undefined && <span className="ml-1.5 opacity-75">({contagem})</span>}
    </button>
  );
}

function InspecoesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();
  const canEdit = useCanEdit();
  // v229: trocar o técnico responsável é ato de supervisão (nível Aprovação), não só de Admin.
  const isAdmin = useIsSupervisor();
  const eu = useUserStore((s) => s.user);
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState<Inspecao | null>(null);
  const [editResp, setEditResp] = useState<Inspecao | null>(null);
  const [editAssoc, setEditAssoc] = useState<Inspecao | null>(null);
  const [maisFiltros, setMaisFiltros] = useState(false);

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

  // v306 (28/10): todos os filtros moram no ENDEREÇO — recarregar não perde, o link pode ser
  // mandado para alguém. A unidade sem parâmetro segue a Unidade ativa, como antes.
  const unidadeAtivaId = useUnidadeAtiva((s) => s.id) ?? "";
  const [f, setF] = useState<FiltrosLista>(() => lerFiltros(new URLSearchParams(params.toString()), unidadeAtivaId));
  const [page, setPage] = useState(1);
  const set = (patch: Partial<FiltrosLista>) => setF((atual) => ({ ...atual, ...patch }));

  // Busca digitada vai ao banco com uma pausa (não a cada letra).
  const [buscaQ, setBuscaQ] = useState(f.q);
  useEffect(() => {
    const t = setTimeout(() => setBuscaQ(f.q), 300);
    return () => clearTimeout(t);
  }, [f.q]);

  // Mantém o filtro de unidade alinhado à Unidade ativa quando ELA muda (inclusive ao limpá-la).
  // Na primeira vez não: a unidade que veio no link vale.
  const unidadeAnterior = useRef(unidadeAtivaId);
  useEffect(() => {
    if (unidadeAnterior.current === unidadeAtivaId) return;
    unidadeAnterior.current = unidadeAtivaId;
    setF((atual) => ({ ...atual, unidade: unidadeAtivaId }));
  }, [unidadeAtivaId]);

  // Escreve no endereço e volta para a página 1 a cada mudança de filtro.
  useEffect(() => {
    setPage(1);
    const sp = escreverFiltros(f, unidadeAtivaId).toString();
    router.replace(`${pathname}${sp ? "?" + sp : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  const { data: unidades = [] } = useUnidades();
  const { data: pessoas = [] } = usePessoasAtribuicao();
  const nomes = useMemo(() => pessoas.map((p) => p.nome.trim()), [pessoas]);
  const { de: dataIni, ate: dataFim } = intervaloDoPeriodo(f.periodo, hojeSP(), f.de, f.ate);

  // "Só as minhas": as inspeções em que eu fui a campo ou estou no documento (v306) — na visão
  // Técnicos só o campo; na Associados só o documento.
  const papelMinhas = f.visao === "tecnicos" ? "tecnico" : f.visao === "associados" ? "associado" : "todos";
  const minhas = useIdsAtribuidas(null, papelMinhas, f.minhas && !!eu);
  const idsMinhas = f.minhas ? (minhas.data ?? []) : null;

  const { data: empresa } = useEmpresa(f.empresa || null);
  const { lista, counts } = useInspecoesPaginadas({
    idEmpresa: f.empresa || null,
    tecnico: f.tecnico,
    associado: f.associado,
    idUnidade: f.unidade || null,
    dataIni,
    dataFim,
    filtros: f.pilulas,
    ordem: f.ordem,
    page,
    pageSize: PAGE_SIZE,
    busca: buscaQ.trim().length >= 2 ? buscaQ : "",
    ids: f.minhas && minhas.isSuccess ? idsMinhas : null,
    documento: f.documento,
    prioridade: f.prioridade,
    esperaMin: f.espera,
    complexidade: f.complexidade,
  });
  const countData = counts.data;
  const extras = counts.extras;

  const items = lista.data?.items ?? [];
  const total = lista.data?.total ?? 0;
  const { data: associadosMap } = useAssociadosPorInspecao(items.map((i) => i.id_inspecao));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isLoading = lista.isLoading;
  const isFetching = lista.isFetching;

  // Etiquetas dos filtros ligados (fora as pílulas, que já mostram o seu estado).
  const etiquetas: { chave: string; texto: string; limpar: () => void }[] = [];
  if (f.q.trim()) etiquetas.push({ chave: "q", texto: `Busca: ${f.q.trim()}`, limpar: () => set({ q: "" }) });
  if (f.empresa) etiquetas.push({ chave: "empresa", texto: `Empresa: ${empresa?.nome_empresa ?? "…"}`, limpar: () => set({ empresa: "" }) });
  if (f.minhas) etiquetas.push({ chave: "minhas", texto: "Só as minhas", limpar: () => set({ minhas: false }) });
  if (f.tecnico) etiquetas.push({ chave: "tecnico", texto: `Técnico: ${f.tecnico}`, limpar: () => set({ tecnico: "" }) });
  if (f.associado) etiquetas.push({ chave: "associado", texto: `Associado: ${f.associado}`, limpar: () => set({ associado: "" }) });
  if (f.periodo) etiquetas.push({ chave: "periodo", texto: `Período: ${f.periodo === "personalizado" ? `${dataIni || "…"} a ${dataFim || "…"}` : ROTULO_PERIODO[f.periodo]}`, limpar: () => set({ periodo: "", de: "", ate: "" }) });
  if (f.unidade) etiquetas.push({ chave: "unidade", texto: `Unidade: ${unidades.find((u) => u.id_unidade === f.unidade)?.nome ?? "…"}`, limpar: () => set({ unidade: "" }) });
  if (f.espera > 0) etiquetas.push({ chave: "espera", texto: `Esperando há +${f.espera} dias`, limpar: () => set({ espera: 0 }) });
  const algumFiltro = etiquetas.length > 0 || f.pilulas.length > 0 || f.documento.length > 0 || f.prioridade.length > 0 || f.complexidade.length > 0;
  const extrasLigados = contarFiltrosExtras(f);
  const sel = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
  const rot = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {/* 28/10: a busca por ID/empresa saiu daqui — a empresa se escolhe no seletor. */}
        <div className="min-w-[240px] flex-1 max-w-xl">
          <label className={rot}>Empresa</label>
          <EmpresaSelect value={f.empresa || null} onChange={(id) => set({ empresa: id ?? "" })} modulo="sst" unidadeId={unidadeAtivaId || null} />
        </div>
        <div className="flex gap-2">
          <Link href="/inspecoes/minhas" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" title="Só o que foi atribuído a você, com prioridade e tempo de espera">
            <ListTodo className="size-4" /> Minhas inspeções
          </Link>
          {f.empresa && (
            <Link
              href={`/empresas/${f.empresa}/relatorio`}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Relatório consolidado"
            >
              <ChartBar className="size-4" />
              Consolidado
            </Link>
          )}
          {canCreate && (
            <Link
              href={f.empresa ? `/inspecoes/nova?empresa=${f.empresa}` : "/inspecoes/nova"}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
            >
              <Plus className="size-4" />
              Nova Inspeção
            </Link>
          )}
        </div>
      </div>

      {/* 28/10: três visões — o lado do campo (técnicos), o do documento (associados) ou tudo.
          Cada uma mostra só os filtros dela; trocar de visão limpa o que ficaria escondido. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200">
        {VISOES.map((v) => (
          <button
            key={v.value || "todas"}
            type="button"
            onClick={() => setF((atual) => trocarVisao(atual, v.value))}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              f.visao === v.value ? "border-verde-primary text-verde-primary" : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            <v.icone className="size-4" /> {v.label}
          </button>
        ))}
        <span className="ml-auto pb-1 text-[11px] text-gray-400">{VISOES.find((v) => v.value === f.visao)?.dica}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {f.visao !== "associados" && (
          <div>
            <label className={rot}>Técnico</label>
            <select value={f.tecnico} onChange={(e) => set({ tecnico: e.target.value })} className={cn(sel, "min-w-[180px]")}>
              <option value="">Todos os técnicos</option>
              {f.tecnico && !nomes.includes(f.tecnico) && <option value={f.tecnico}>{f.tecnico}</option>}
              {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        {f.visao !== "tecnicos" && (
          <div>
            <label className={rot}>Associado</label>
            <select value={f.associado} onChange={(e) => set({ associado: e.target.value })} className={cn(sel, "min-w-[180px]")}>
              <option value="">Todos os associados</option>
              {f.associado && !nomes.includes(f.associado) && <option value={f.associado}>{f.associado}</option>}
              {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        <button
          type="button"
          aria-pressed={f.minhas}
          onClick={() => set({ minhas: !f.minhas })}
          title={f.visao === "tecnicos" ? "Só as inspeções em que você foi a campo" : f.visao === "associados" ? "Só os documentos em que você está" : "Só as inspeções em que você foi a campo ou está no documento"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium",
            f.minhas ? "border-verde-primary bg-verde-primary text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          <UserCheck className="size-4" /> Só as minhas
        </button>
        <div>
          <label className={rot}>Período</label>
          <select value={f.periodo} onChange={(e) => set({ periodo: e.target.value as Periodo })} className={sel}>
            <option value="">Qualquer data</option>
            {(Object.keys(ROTULO_PERIODO) as Exclude<Periodo, "">[]).map((p) => <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>)}
          </select>
        </div>
        {f.periodo === "personalizado" && (
          <>
            <div>
              <label className={rot}>De</label>
              <input type="date" value={f.de} onChange={(e) => set({ de: e.target.value })} className={sel} />
            </div>
            <div>
              <label className={rot}>Até</label>
              <input type="date" value={f.ate} onChange={(e) => set({ ate: e.target.value })} className={sel} />
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setMaisFiltros((v) => !v)}
          className={cn("inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium", maisFiltros ? "border-gray-400 bg-gray-50 text-gray-800" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")}
        >
          <SlidersHorizontal className="size-4" /> Mais filtros{extrasLigados > 0 && <span className="rounded-full bg-verde-primary px-1.5 text-[10px] font-semibold text-white">{extrasLigados}</span>}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500">Ordenar:</label>
          <select value={f.ordem} onChange={(e) => set({ ordem: e.target.value as OrdemLista })} className={cn(sel, "py-1 text-xs")}>
            {ORDENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {maisFiltros && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
          <div>
            <label className={rot}>Unidade</label>
            <select value={f.unidade} onChange={(e) => set({ unidade: e.target.value })} className={sel}>
              <option value="">Todas as unidades</option>
              {unidades.map((u) => <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={rot}>Tempo de espera</label>
            <select value={f.espera} onChange={(e) => set({ espera: Number(e.target.value) })} className={sel}>
              {ESPERAS.map((d) => <option key={d} value={d}>{d === 0 ? "Qualquer" : `Há mais de ${d} dias`}</option>)}
            </select>
          </div>
          <p className="basis-full text-[11px] text-gray-400">
            Espera: inspeção aberta conta desde a visita; concluída com o documento ainda não entregue conta desde a conclusão.
            No período, as concluídas contam pela data em que foram concluídas; as demais, pela data da visita.
          </p>
        </div>
      )}

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {etiquetas.map((e) => (
            <span key={e.chave} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs text-verde-dark">
              {e.texto}
              <button type="button" onClick={e.limpar} aria-label={`Tirar ${e.texto}`} className="rounded-full p-0.5 hover:bg-white"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}

      {f.empresa && empresa && (
        <div className="rounded-lg border border-verde-border bg-verde-light px-4 py-2 text-sm text-verde-dark">
          Mostrando inspeções de <strong>{empresa.nome_empresa}</strong>
        </div>
      )}

      {/* A contagem "Todos (N)" é só desta unidade — quem não sabe acha que a inspeção sumiu. */}
      {f.unidade && !f.empresa && (
        <p className="text-xs text-gray-500">
          Mostrando só as inspeções de{" "}
          <strong>{unidades.find((u) => u.id_unidade === f.unidade)?.nome ?? "esta unidade"}</strong> —{" "}
          <button type="button" onClick={() => set({ unidade: "" })} className="font-semibold text-verde-primary hover:underline">
            ver todas as unidades
          </button>
        </p>
      )}

      <div className="space-y-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        {/* Campo (status da inspeção) — Todas e Técnicos */}
        {f.visao !== "associados" && (
          <GrupoPilulas titulo="Status">
            {FILTROS.filter((fi) => fi.value !== "ASSOCIADOS" && fi.value !== "NAO_ASSOCIADOS").map((fi) => (
              <Pilula
                key={fi.value}
                ativo={fi.value === "Todos" ? !f.pilulas.some((p) => p !== "ASSOCIADOS" && p !== "NAO_ASSOCIADOS") : f.pilulas.includes(fi.value)}
                semCheck={fi.value === "Todos"}
                onClick={() => set({ pilulas: fi.value === "Todos" ? f.pilulas.filter((p) => p === "ASSOCIADOS" || p === "NAO_ASSOCIADOS") : alternarPilula(f.pilulas, fi.value) })}
                contagem={countData?.status[fi.value]}
              >
                {fi.label}
              </Pilula>
            ))}
          </GrupoPilulas>
        )}
        {/* Documento (associação e situação) — Todas e Associados */}
        {f.visao !== "tecnicos" && (
          <GrupoPilulas titulo="Documento">
            {FILTROS.filter((fi) => fi.value === "ASSOCIADOS" || fi.value === "NAO_ASSOCIADOS").map((fi) => (
              <Pilula key={fi.value} ativo={f.pilulas.includes(fi.value)} onClick={() => set({ pilulas: alternarPilula(f.pilulas, fi.value) })} contagem={countData?.status[fi.value]}>
                {fi.label}
              </Pilula>
            ))}
            <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
            {DOCUMENTOS.map((d) => (
              <Pilula key={d.value} ativo={f.documento.includes(d.value)} onClick={() => set({ documento: alternar(f.documento, d.value) })} contagem={extras?.documento[d.value] ?? 0}>
                {d.label}
              </Pilula>
            ))}
          </GrupoPilulas>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <GrupoPilulas titulo="Prioridade">
            {PRIORIDADES_DESC.map((p) => (
              <Pilula
                key={p}
                ativo={f.prioridade.includes(p)}
                onClick={() => set({ prioridade: alternar<PrioridadeInspecao>(f.prioridade, p) })}
                contagem={extras?.prioridade[p] ?? 0}
                className={!f.prioridade.includes(p) ? corDoTexto(PRIORIDADE_INFO[p].classe) : undefined}
              >
                {PRIORIDADE_INFO[p].label}
              </Pilula>
            ))}
          </GrupoPilulas>
          <GrupoPilulas titulo="Complexidade">
            {COMPLEXIDADES_DESC.map((c) => (
              <Pilula
                key={c}
                ativo={f.complexidade.includes(c)}
                onClick={() => set({ complexidade: alternar<ComplexidadeInspecao>(f.complexidade, c) })}
                contagem={extras?.complexidade[c] ?? 0}
                className={!f.complexidade.includes(c) ? corDoTexto(COMPLEXIDADE_INFO[c].classe) : undefined}
              >
                {COMPLEXIDADE_INFO[c].label}
              </Pilula>
            ))}
          </GrupoPilulas>
        </div>
        {algumFiltro && (
          <p className="text-xs text-gray-500">
            {f.pilulas.length > 0 && <>Mostrando: <strong className="text-gray-700">{f.pilulas.map((p) => ROTULO[p]).join(" + ")}</strong> · </>}
            {total} {total === 1 ? "inspeção" : "inspeções"} ·{" "}
            <button type="button" onClick={() => setF({ ...FILTROS_VAZIOS, visao: f.visao, unidade: "", ordem: f.ordem })} className="font-semibold text-verde-primary hover:underline">
              limpar todos os filtros
            </button>
          </p>
        )}
      </div>

      <div className={cn(
        "reveal-up overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm",
        isFetching && "opacity-70 transition-opacity"
      )}>
        {isLoading || (f.minhas && minhas.isLoading) ? (
          <div className="p-5">
            <TabelaSkeleton linhas={6} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-14 text-center text-sm text-gray-500">
            Nenhuma inspeção {algumFiltro ? "com esses filtros" : "encontrada"}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">ID</th>
                  {!f.empresa && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Empresa</th>
                  )}
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rev.</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prioridade</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Complexidade</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Data</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Responsável</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Associados</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">Status Assoc.</th>
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
                    onEditAssociados={isAdmin ? setEditAssoc : undefined}
                    showEmpresa={!f.empresa}
                    podeEditarPrioridade={canEdit}
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
      {editAssoc && (
        <ModalEditarAssociados insp={editAssoc} onClose={() => setEditAssoc(null)} />
      )}
    </div>
  );
}

/**
 * Associados da elaboração direto da lista (26/10) — o mesmo bloco da tela do
 * relatório, com as mesmas regras (tirar o responsável limpa o nome do documento).
 * Só supervisor abre, como o lápis do responsável.
 */
function ModalEditarAssociados({ insp, onClose }: { insp: Inspecao; onClose: () => void }) {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const fechar = () => {
    // Tirar o responsável muda a própria inspeção (elaboracao_*), não só os associados.
    qc.invalidateQueries({ queryKey: ["inspecoes-lista"] });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={fechar}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Editar associados</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Inspeção {insp.id_inspecao} · {insp.empresas?.nome_empresa ?? "—"}
          </p>
        </div>
        <div className="min-h-40 px-5 pb-4">
          <AssociadosElaboracao
            idInspecao={insp.id_inspecao}
            user={user}
            isAdmin
            responsavelNome={insp.elaboracao_responsavel}
            elaboracaoStatus={insp.elaboracao_status}
            concluidaEm={insp.elaboracao_concluida_em}
          />
        </div>
        <div className="flex justify-end border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={fechar} className="rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent">
            Fechar
          </button>
        </div>
      </div>
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
      qc.invalidateQueries({ queryKey: ["inspecoes-por-mes"] });
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
