"use client";

// Inspeções › Minhas inspeções (v306, 28/10/2026).
//
// O técnico vê só as inspeções em que foi a campo; o associado, só os documentos em que está.
// Abre na fila ABERTA (o que ainda espera alguma coisa), ordenada pela prioridade, com o tempo
// de espera e o prazo. Supervisor (Admin ou nível Aprovação) abre na própria fila e pode escolher
// qualquer pessoa para acompanhar — o banco confere (RPC inspecoes_atribuidas).
//
// Prioridade, espera e documento são colunas calculadas do banco (v306); a régua e os textos
// estão em lib/inspecoes/prioridade.ts.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlarmClock, CalendarClock, CheckCircle2, ClipboardList, FileText, Flame, Hourglass, Loader2, Play, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { PrioridadeCelula } from "@/components/inspecoes/PrioridadeInspecao";
import PrioridadeCalculada from "@/components/inspecoes/PrioridadeCalculada";
import ComplexidadeCelula from "@/components/inspecoes/ComplexidadeCelula";
import FiltroSuspenso from "@/components/ui/FiltroSuspenso";
import { useFilaAtribuida, usePessoasAtribuicao, useResumoFila, type FiltrosFila } from "@/lib/hooks/useInspecoesAtribuidas";
import { useCanEdit, useIsSupervisor } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { PRIORIDADES_DESC, PRIORIDADE_INFO, diasEntre, hojeSP, textoEspera, type PrioridadeInspecao } from "@/lib/inspecoes/prioridade";
import { ROTULO_PERIODO, intervaloDoPeriodo, type Periodo } from "@/lib/inspecoes/filtros-url";
import { cn, fmtData } from "@/lib/utils";

type Papel = "tecnico" | "associado";
type StatusFiltro = "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA";

/** As pílulas de Status — os mesmos rótulos da lista de Inspeções. */
const STATUS_FILTRO: { value: StatusFiltro; label: string }[] = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "CONCLUIDA", label: "Concluídas" },
];

/** 28/10 (v309): na aba do associado, filtrar pelo andamento do documento. */
type DocFiltro = "ATRIBUIDO" | "EM_ELABORACAO" | "ENTREGUE";
const DOC_FILTRO: { value: DocFiltro; label: string }[] = [
  { value: "ATRIBUIDO", label: "Atribuído (não iniciado)" },
  { value: "EM_ELABORACAO", label: "Em elaboração" },
  { value: "ENTREGUE", label: "Entregue" },
];

const DOC_ROTULO: Record<string, { texto: string; cor: string }> = {
  PENDENTE: { texto: "Documento pendente", cor: "bg-gray-100 text-gray-600" },
  ATRIBUIDO: { texto: "Atribuído · não iniciado", cor: "bg-amber-50 text-amber-800" },
  EM_ELABORACAO: { texto: "Em elaboração", cor: "bg-sky-100 text-sky-800" },
  ENTREGUE: { texto: "Documento entregue", cor: "bg-emerald-100 text-emerald-800" },
};

export default function MinhasInspecoesPage() {
  return (
    <Suspense fallback={null}>
      <MinhasInner />
    </Suspense>
  );
}

function MinhasInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const eu = useUserStore((s) => s.user);
  const supervisor = useIsSupervisor();
  const canEdit = useCanEdit();
  const { data: pessoas = [] } = usePessoasAtribuicao(supervisor);

  const ler = (k: string) => params.get(k) ?? "";
  const [pessoa, setPessoa] = useState(ler("pessoa"));
  const [papel, setPapel] = useState<Papel>(ler("papel") === "associado" ? "associado" : "tecnico");
  const [status, setStatus] = useState<StatusFiltro[]>(ler("status").split(",").filter((s): s is StatusFiltro => STATUS_FILTRO.some((x) => x.value === s)));
  const [documento, setDocumento] = useState<DocFiltro[]>(ler("doc").split(",").filter((d): d is DocFiltro => DOC_FILTRO.some((x) => x.value === d)));
  const [prioridade, setPrioridade] = useState<PrioridadeInspecao[]>(ler("prioridade").split(",").filter((p): p is PrioridadeInspecao => (PRIORIDADES_DESC as readonly string[]).includes(p)));
  const [espera, setEspera] = useState(Number(ler("espera")) || 0);
  const [periodo, setPeriodo] = useState<Periodo>((Object.keys(ROTULO_PERIODO) as string[]).includes(ler("periodo")) ? (ler("periodo") as Periodo) : "");
  const [q, setQ] = useState(ler("q"));
  const [qDeb, setQDeb] = useState(q);
  const [ordem, setOrdem] = useState<FiltrosFila["ordem"]>((["prioridade", "espera", "prazo", "recentes"] as const).find((o) => o === ler("ordem")) ?? "prioridade");

  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Os filtros ficam no endereço (recarregar não perde; dá para mandar o link).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (pessoa) sp.set("pessoa", pessoa);
    if (papel !== "tecnico") sp.set("papel", papel);
    if (status.length) sp.set("status", status.join(","));
    if (papel === "associado" && documento.length) sp.set("doc", documento.join(","));
    if (prioridade.length) sp.set("prioridade", prioridade.join(","));
    if (espera) sp.set("espera", String(espera));
    if (periodo) sp.set("periodo", periodo);
    if (q.trim()) sp.set("q", q.trim());
    if (ordem !== "prioridade") sp.set("ordem", ordem);
    const s = sp.toString();
    router.replace(`${pathname}${s ? "?" + s : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa, papel, status, documento, prioridade, espera, periodo, q, ordem]);

  // "pessoa" vazio = eu (o banco usa o e-mail de quem chama).
  const idUsuario = supervisor && pessoa && pessoa !== eu?.id_usuario ? pessoa : null;
  const nomePessoa = idUsuario ? (pessoas.find((p) => p.id_usuario === idUsuario)?.nome ?? "") : (eu?.nome ?? "");
  const hoje = hojeSP();
  const { de, ate } = intervaloDoPeriodo(periodo, hoje);

  const fila = useFilaAtribuida({ idUsuario, papel, status, documento: papel === "associado" ? documento : [], prioridade, esperaMin: espera, dataIni: de, dataFim: ate, busca: qDeb.trim().length >= 2 ? qDeb : "", ordem });
  const resumoTec = useResumoFila(idUsuario, "tecnico");
  const resumoAssoc = useResumoFila(idUsuario, "associado");
  const resumo = papel === "tecnico" ? resumoTec.data : resumoAssoc.data;

  const kpis = useMemo(() => {
    const r = resumo ?? [];
    const abertas = r.filter((x) => x.dias_espera != null);
    const mes = hoje.slice(0, 7);
    const feitoEm = (x: (typeof r)[number]) => (papel === "tecnico" ? x.concluida_em : x.elaboracao_concluida_em);
    return {
      abertas: abertas.length,
      urgentes: abertas.filter((x) => x.prioridade_efetiva === "CRITICA" || x.prioridade_efetiva === "GRAVE").length,
      vencidas: abertas.filter((x) => x.prazo && x.prazo < hoje).length,
      paradas: abertas.filter((x) => (x.dias_espera ?? 0) > 15).length,
      noMes: r.filter((x) => (feitoEm(x) ?? "").slice(0, 7) === mes && (papel === "tecnico" ? x.status === "CONCLUIDA" : true)).length,
    };
  }, [resumo, hoje, papel]);
  const abertasPapel = (p: Papel) => ((p === "tecnico" ? resumoTec.data : resumoAssoc.data) ?? []).filter((x) => x.dias_espera != null).length;

  const limparCartao = () => {
    setStatus([]);
    setDocumento([]);
    setPeriodo("");
    setPrioridade([]);
    setEspera(0);
    setOrdem("prioridade");
  };
  const itens = fila.data ?? [];
  const sel = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
  const rot = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ClipboardList className="size-5 text-verde-primary" /> Minhas inspeções
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {idUsuario ? <>Fila de <strong>{nomePessoa}</strong></> : "O que foi atribuído a você"} — o mais urgente primeiro.
          </p>
        </div>
        {supervisor && (
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">Ver a fila de</span>
            <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className={cn(sel, "min-w-[240px]")}>
              <option value="">Eu ({eu?.nome ?? "…"})</option>
              {pessoas.filter((p) => p.id_usuario !== eu?.id_usuario).map((p) => (
                <option key={p.id_usuario} value={p.id_usuario}>{p.nome} · {p.perfil}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(["tecnico", "associado"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPapel(p)} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium", papel === p ? "border-verde-primary text-verde-primary" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {p === "tecnico" ? <ClipboardList className="size-4" /> : <FileText className="size-4" />}
            {p === "tecnico" ? "Como técnico (campo)" : "Como associado (documento)"}
            <span className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600">{abertasPapel(p)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { k: "abertas", rot: "Abertas", v: kpis.abertas, icone: Hourglass, cor: "text-gray-800", acao: () => limparCartao() },
          { k: "urgentes", rot: "Críticas e urgentes", v: kpis.urgentes, icone: Flame, cor: "text-red-700", acao: () => { limparCartao(); setPrioridade(["CRITICA", "GRAVE"]); } },
          { k: "vencidas", rot: "Prazo vencido", v: kpis.vencidas, icone: AlarmClock, cor: "text-red-700", acao: () => { limparCartao(); setOrdem("prazo"); } },
          { k: "paradas", rot: "Esperando +15 dias", v: kpis.paradas, icone: CalendarClock, cor: "text-orange-700", acao: () => { limparCartao(); setEspera(15); setOrdem("espera"); } },
          { k: "mes", rot: papel === "tecnico" ? "Concluídas no mês" : "Entregues no mês", v: kpis.noMes, icone: CheckCircle2, cor: "text-emerald-700", acao: () => { limparCartao(); if (papel === "tecnico") setStatus(["CONCLUIDA"]); setPeriodo("mes"); setOrdem("recentes"); } },
        ].map((c) => (
          <button key={c.k} type="button" onClick={c.acao} className="rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-verde-primary/40 hover:shadow">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500"><c.icone className="size-3.5" /> {c.rot}</p>
            <p className={cn("mt-1 text-2xl font-bold", c.cor)}>{resumo ? c.v : "…"}</p>
          </button>
        ))}
      </div>

      {/* 28/10: cada filtro com o título em cima, como na lista de Inspeções. */}
      <div className="flex flex-wrap items-end gap-3">
        {/* 28/10: Status da inspeção no lugar de "Situação" (Só as abertas / Todas). Vazio = todos. */}
        <div>
          <label className={rot}>Status</label>
          {/* 28/10: lista suspensa como "Tempo de espera", com caixinhas (dá para marcar mais de uma). */}
          <FiltroSuspenso ariaLabel="Filtrar por status" opcoes={STATUS_FILTRO} value={status} onChange={(v) => setStatus(v as StatusFiltro[])} />
        </div>
        {papel === "associado" && (
          <div>
            <label className={rot}>Documento</label>
            <FiltroSuspenso ariaLabel="Filtrar pelo andamento do documento" opcoes={DOC_FILTRO} value={documento} onChange={(v) => setDocumento(v as DocFiltro[])} />
          </div>
        )}
        <div>
          <label className={rot}>Prioridade</label>
          <FiltroSuspenso
            ariaLabel="Filtrar por prioridade"
            rotuloTodos="Todas"
            opcoes={PRIORIDADES_DESC.map((p) => ({ value: p, label: PRIORIDADE_INFO[p].label }))}
            value={prioridade}
            onChange={(v) => setPrioridade(v as PrioridadeInspecao[])}
          />
        </div>
        <div>
          <label className={rot}>Tempo de espera</label>
          <select value={espera} onChange={(e) => setEspera(Number(e.target.value))} className={sel}>
            <option value={0}>Qualquer espera</option>
            {[7, 15, 30, 45].map((d) => <option key={d} value={d}>Esperando há +{d} dias</option>)}
          </select>
        </div>
        <div>
          <label className={rot}>Período</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={sel}>
            <option value="">Qualquer data</option>
            {(Object.keys(ROTULO_PERIODO) as Exclude<Periodo, "">[]).filter((p) => p !== "personalizado").map((p) => <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>)}
          </select>
        </div>
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <label className={rot}>Empresa</label>
          <Search className="pointer-events-none absolute left-2.5 top-[31px] size-3.5 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome da empresa…" className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-verde-primary focus:outline-none" />
        </div>
        <div className="ml-auto">
          <label className={rot}>Ordenar</label>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as FiltrosFila["ordem"])} className={sel}>
            <option value="prioridade">Mais urgente primeiro</option>
            <option value="espera">Esperando há mais tempo</option>
            <option value="prazo">Prazo mais próximo</option>
            <option value="recentes">Mais recentes</option>
          </select>
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm", fila.isFetching && "opacity-70 transition-opacity")}>
        {fila.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
        ) : fila.isError ? (
          <p className="p-12 text-center text-sm text-red-600">Não foi possível carregar a fila.</p>
        ) : itens.length === 0 ? (
          <p className="p-12 text-center text-sm text-gray-500">
            Nenhuma inspeção com esses filtros.{" "}
            {papel === "tecnico" ? "Como técnico, entram as inspeções em que você foi a campo (aba Responsáveis)." : "Como associado, entram os documentos em que você está associado ou assumiu a elaboração."}
          </p>
        ) : (
          // 28/10: tabela com a linha de títulos no topo, como a lista de Inspeções (antes cada
          // cartão repetia "Prioridade"/"Complexidade" em cima dos seletores).
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {["Prioridade", "Complexidade", "Empresa", "Status", "Espera"].map((t) => (
                    <th key={t} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {itens.map((i) => {
                  const doc = i.situacao_documento ? DOC_ROTULO[i.situacao_documento] : null;
                  const espera = textoEspera(i.status, i.dias_espera);
                  return (
                    <tr key={i.id_inspecao} className="align-top hover:bg-verde-light/20">
                      <td className="px-4 py-3">
                        {/* a marcada (quem edita troca aqui) + a calculada, quando passa, e o prazo */}
                        <PrioridadeCelula id={i.id_inspecao} valor={i.prioridade} podeEditar={canEdit} />
                        <PrioridadeCalculada insp={i} podeEditarPrazo={canEdit} compacto />
                      </td>
                      <td className="px-4 py-3">
                        <ComplexidadeCelula id={i.id_inspecao} valor={i.complexidade} podeEditar={canEdit} />
                      </td>
                      <td className="min-w-[220px] px-4 py-3">
                        <p className="font-medium text-gray-900">{i.empresas?.nome_empresa ?? "—"}</p>
                        <p className="text-[11px] text-gray-400">
                          <span className="font-mono">{i.id_inspecao}</span> · rev. {i.revisao}
                          {i.data_inspecao && <> · visita {fmtData(i.data_inspecao)}</>}
                          {i.tecnicos_campo && papel === "associado" && <> · campo: {i.tecnicos_campo}</>}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={i.status} />
                          {doc && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", doc.cor)}>{doc.texto}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {espera ?? (i.status === "CONCLUIDA" ? "Nada esperando" : "—")}
                        {/* 28/10 (v309): quanto tempo levou (ou está levando) para começar o documento */}
                        {i.situacao_documento === "ATRIBUIDO" && i.atribuido_em && (
                          <p className="font-medium text-amber-700">{textoAtribuido(i.atribuido_em, hoje)}</p>
                        )}
                        {i.situacao_documento === "EM_ELABORACAO" && i.elaboracao_iniciada_em && (
                          <p className="text-sky-700">
                            Iniciado em {fmtData(i.elaboracao_iniciada_em)}
                            {i.elaboracao_inicio_origem === "AUTOMATICO" && <span className="text-gray-400"> (1ª edição)</span>}
                          </p>
                        )}
                      </td>
                      <td className="space-y-1 px-4 py-3 text-right">
                        {papel === "associado" && !idUsuario && i.situacao_documento === "ATRIBUIDO" && (
                          <IniciarElaboracao id={i.id_inspecao} nome={eu?.nome ?? ""} />
                        )}
                        <Link
                          href={papel === "associado" ? `/inspecoes/${i.id_inspecao}/relatorio` : `/inspecoes/${i.id_inspecao}`}
                          className="inline-block whitespace-nowrap rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-verde-primary hover:text-verde-primary"
                        >
                          {papel === "associado" ? "Abrir documento" : "Abrir inspeção"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {itens.length >= 500 && <p className="text-xs text-gray-400">Mostrando as 500 primeiras — use os filtros para afinar.</p>}
    </div>
  );
}

/** "Atribuído há 4 dias, não iniciado" (a partir da primeira associação). */
function textoAtribuido(atribuidoEm: string, hoje: string): string {
  const n = Math.max(0, diasEntre(hojeSP(new Date(atribuidoEm)), hoje));
  return n === 0 ? "Atribuído hoje, não iniciado" : `Atribuído há ${n} dia${n === 1 ? "" : "s"}, não iniciado`;
}

/**
 * 28/10 (v309): o associado marca que começou o documento — a mesma RPC do botão do relatório
 * (set_elaboracao_documento); o banco carimba quando e quem (origem BOTAO). Se ele esquecer, a
 * primeira edição dele no documento marca sozinha.
 */
function IniciarElaboracao({ id, nome }: { id: string; nome: string }) {
  const qc = useQueryClient();
  const iniciar = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (createSupabaseBrowserClient() as any).rpc("set_elaboracao_documento", {
        p_id_inspecao: id, p_status: "EM_ELABORACAO", p_responsavel: nome || null, p_concluida_em: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["inspecoes-atribuidas", "inspecao", "inspecoes-lista", "inspecoes-counts"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success("Elaboração iniciada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      type="button"
      disabled={iniciar.isPending}
      onClick={() => iniciar.mutate()}
      className="mr-1 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-verde-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
      title="Marca que você começou a trabalhar neste documento"
    >
      {iniciar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />} Iniciar
    </button>
  );
}
