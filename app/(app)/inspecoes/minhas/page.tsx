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
import { AlarmClock, CalendarClock, CheckCircle2, ClipboardList, FileText, Flame, Hourglass, Loader2, Search } from "lucide-react";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { PrioridadeCelula } from "@/components/inspecoes/PrioridadeInspecao";
import PrioridadeCalculada from "@/components/inspecoes/PrioridadeCalculada";
import ComplexidadeCelula from "@/components/inspecoes/ComplexidadeCelula";
import { useFilaAtribuida, usePessoasAtribuicao, useResumoFila, type FiltrosFila } from "@/lib/hooks/useInspecoesAtribuidas";
import { useCanEdit, useIsSupervisor } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { PRIORIDADES_DESC, PRIORIDADE_INFO, hojeSP, textoEspera, type PrioridadeInspecao } from "@/lib/inspecoes/prioridade";
import { ROTULO_PERIODO, intervaloDoPeriodo, type Periodo } from "@/lib/inspecoes/filtros-url";
import { cn, fmtData } from "@/lib/utils";

type Papel = "tecnico" | "associado";

const DOC_ROTULO: Record<string, { texto: string; cor: string }> = {
  PENDENTE: { texto: "Documento pendente", cor: "bg-gray-100 text-gray-600" },
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
  const [situacao, setSituacao] = useState<"abertas" | "todas">(ler("situacao") === "todas" ? "todas" : "abertas");
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
    if (situacao !== "abertas") sp.set("situacao", situacao);
    if (prioridade.length) sp.set("prioridade", prioridade.join(","));
    if (espera) sp.set("espera", String(espera));
    if (periodo) sp.set("periodo", periodo);
    if (q.trim()) sp.set("q", q.trim());
    if (ordem !== "prioridade") sp.set("ordem", ordem);
    const s = sp.toString();
    router.replace(`${pathname}${s ? "?" + s : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa, papel, situacao, prioridade, espera, periodo, q, ordem]);

  // "pessoa" vazio = eu (o banco usa o e-mail de quem chama).
  const idUsuario = supervisor && pessoa && pessoa !== eu?.id_usuario ? pessoa : null;
  const nomePessoa = idUsuario ? (pessoas.find((p) => p.id_usuario === idUsuario)?.nome ?? "") : (eu?.nome ?? "");
  const hoje = hojeSP();
  const { de, ate } = intervaloDoPeriodo(periodo, hoje);

  const fila = useFilaAtribuida({ idUsuario, papel, situacao, prioridade, esperaMin: espera, dataIni: de, dataFim: ate, busca: qDeb.trim().length >= 2 ? qDeb : "", ordem });
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
          { k: "abertas", rot: "Abertas", v: kpis.abertas, icone: Hourglass, cor: "text-gray-800", acao: () => { limparCartao(); setSituacao("abertas"); } },
          { k: "urgentes", rot: "Críticas e urgentes", v: kpis.urgentes, icone: Flame, cor: "text-red-700", acao: () => { limparCartao(); setSituacao("abertas"); setPrioridade(["CRITICA", "GRAVE"]); } },
          { k: "vencidas", rot: "Prazo vencido", v: kpis.vencidas, icone: AlarmClock, cor: "text-red-700", acao: () => { limparCartao(); setSituacao("abertas"); setOrdem("prazo"); } },
          { k: "paradas", rot: "Esperando +15 dias", v: kpis.paradas, icone: CalendarClock, cor: "text-orange-700", acao: () => { limparCartao(); setSituacao("abertas"); setEspera(15); setOrdem("espera"); } },
          { k: "mes", rot: papel === "tecnico" ? "Concluídas no mês" : "Entregues no mês", v: kpis.noMes, icone: CheckCircle2, cor: "text-emerald-700", acao: () => { limparCartao(); setSituacao("todas"); setPeriodo("mes"); setOrdem("recentes"); } },
        ].map((c) => (
          <button key={c.k} type="button" onClick={c.acao} className="rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-verde-primary/40 hover:shadow">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500"><c.icone className="size-3.5" /> {c.rot}</p>
            <p className={cn("mt-1 text-2xl font-bold", c.cor)}>{resumo ? c.v : "…"}</p>
          </button>
        ))}
      </div>

      {/* 28/10: cada filtro com o título em cima, como na lista de Inspeções. */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={rot}>Situação</label>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            {(["abertas", "todas"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSituacao(s)} className={cn("rounded-md px-3 py-1", situacao === s ? "bg-verde-primary font-medium text-white" : "text-gray-600 hover:bg-gray-50")}>
                {s === "abertas" ? "Só as abertas" : "Todas"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={rot}>Prioridade</label>
          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
            {PRIORIDADES_DESC.map((p) => {
              const on = prioridade.includes(p);
              return (
                <button key={p} type="button" onClick={() => setPrioridade(on ? prioridade.filter((x) => x !== p) : [...prioridade, p])} className={cn("rounded-full border px-2.5 py-1 text-xs", on ? cn(PRIORIDADE_INFO[p].classe, "font-semibold ring-2 ring-verde-primary/30") : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
                  {PRIORIDADE_INFO[p].label}
                </button>
              );
            })}
          </div>
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
            {situacao === "abertas" ? "Nada esperando aqui. " : "Nenhuma inspeção com esses filtros. "}
            {papel === "tecnico" ? "Como técnico, entram as inspeções em que você foi a campo (aba Responsáveis)." : "Como associado, entram os documentos em que você está associado ou assumiu a elaboração."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {itens.map((i) => {
              const doc = i.situacao_documento ? DOC_ROTULO[i.situacao_documento] : null;
              const espera = textoEspera(i.status, i.dias_espera);
              return (
                <li key={i.id_inspecao} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-verde-light/20">
                  <div className="w-36 shrink-0">
                    {/* a marcada (quem edita troca aqui) + a calculada, quando passa, e o prazo.
                        Cada seletor com o nome em cima: vazios, os dois mostravam só "—". */}
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Prioridade</p>
                    <PrioridadeCelula id={i.id_inspecao} valor={i.prioridade} podeEditar={canEdit} />
                    <PrioridadeCalculada insp={i} podeEditarPrazo={canEdit} compacto />
                    <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">Complexidade</p>
                    <ComplexidadeCelula id={i.id_inspecao} valor={i.complexidade} podeEditar={canEdit} />
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium text-gray-900">{i.empresas?.nome_empresa ?? "—"}</p>
                    <p className="text-[11px] text-gray-400">
                      <span className="font-mono">{i.id_inspecao}</span> · rev. {i.revisao}
                      {i.data_inspecao && <> · visita {fmtData(i.data_inspecao)}</>}
                      {i.tecnicos_campo && papel === "associado" && <> · campo: {i.tecnicos_campo}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={i.status} />
                    {doc && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", doc.cor)}>{doc.texto}</span>}
                  </div>
                  <div className="w-44 shrink-0 text-xs text-gray-500">{espera ?? (i.status === "CONCLUIDA" ? "Nada esperando" : "")}</div>
                  <Link
                    href={papel === "associado" ? `/inspecoes/${i.id_inspecao}/relatorio` : `/inspecoes/${i.id_inspecao}`}
                    className="shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-verde-primary hover:text-verde-primary"
                  >
                    {papel === "associado" ? "Abrir documento" : "Abrir inspeção"}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {itens.length >= 500 && <p className="text-xs text-gray-400">Mostrando as 500 primeiras — use os filtros para afinar.</p>}
    </div>
  );
}
