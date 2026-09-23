"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  Clock,
  CheckCircle2,
  FileText,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { mesAbsSP, mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import { RENOVACAO, type MesInspecoes } from "@/lib/dashboard/inspecoes";
import { useInspecoesPorMes } from "@/lib/hooks/useInspecoesPorMes";
import {
  porAssociado as agruparPorAssociado,
  serieMensalAssociacoes,
  type AssociacaoDoc,
  type DocumentoContavel,
} from "@/lib/dashboard/documentos";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { BalaoGrafico, BalaoUmValor, LinhaBalao } from "@/components/ui/BalaoGrafico";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import { cn, fmtData } from "@/lib/utils";
import { useUserStore, useTema } from "@/lib/store";
import { corAvatar } from "@/lib/hooks/useGestao";
import type { Inspecao, Empresa } from "@/lib/supabase/types";
import { useState, useEffect, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  empresasAtivas: number;
  totalInspecoes: number;
  emAndamento: number;
  concluidas: number;
  rascunho: number;
}

interface InspecaoComEmpresa extends Inspecao {
  empresa_nome?: string;
}

interface MesData {
  mes: string;
  total: number;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchStats(): Promise<DashboardStats> {
  const supabase = createSupabaseBrowserClient();
  // Renovação de documento (23/09) não é inspeção: fica fora dos quatro cards.
  // `or` com `is.null` e não `neq` sozinho — no PostgREST `neq` descarta a
  // linha com valor nulo, e registro antigo sem `tipo_criacao` sumiria junto.
  const inspecoes = () =>
    supabase
      .from("inspecoes")
      .select("id_inspecao", { count: "exact", head: true })
      .or(`tipo_criacao.is.null,tipo_criacao.neq.${RENOVACAO}`);
  const [empAtivas, total, andamento, concluidas, rascunho] = await Promise.all([
    supabase.from("empresas").select("id_empresa", { count: "exact", head: true }).eq("status", "Ativo"),
    inspecoes().neq("status", "DELETADA"),
    inspecoes().eq("status", "EM_ANDAMENTO"),
    inspecoes().eq("status", "CONCLUIDA"),
    inspecoes().eq("status", "RASCUNHO"),
  ]);
  return {
    empresasAtivas: empAtivas.count ?? 0,
    totalInspecoes: total.count ?? 0,
    emAndamento: andamento.count ?? 0,
    concluidas: concluidas.count ?? 0,
    rascunho: rascunho.count ?? 0,
  };
}

// Inspeções por mês: a consulta e a régua moram em lib/hooks/useInspecoesPorMes,
// compartilhado com o mini-gráfico da tela Início (15/09) — antes cada um
// contava por conta própria e os dois divergiam (agosto: 153 × 140).

async function fetchDocumentosPorMes(): Promise<MesData[]> {
  const supabase = createSupabaseBrowserClient();
  const agora = mesAbsAgoraSP();
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 6);

  const { data } = await supabase
    .from("inspecoes")
    .select("elaboracao_concluida_em")
    .eq("elaboracao_status", "CONCLUIDO")
    .gte("elaboracao_concluida_em", desde.toISOString());

  const months: MesData[] = Array.from({ length: 6 }, (_, i) => ({
    mes: rotuloMesAbs(agora - (5 - i)),
    total: 0,
  }));

  (data ?? []).forEach(({ elaboracao_concluida_em }) => {
    if (!elaboracao_concluida_em) return;
    const idx = 5 - (agora - mesAbsSP(elaboracao_concluida_em));
    if (idx >= 0 && idx < 6) months[idx].total++;
  });

  return months;
}

// Documentos que ganharam um associado no mês. A conta (e o filtro de inspeção
// deletada) mora em lib/dashboard/documentos, junto com a do donut por pessoa —
// as duas respondiam a mesma pergunta com números diferentes.
async function fetchDocumentosAssociadosPorMes(): Promise<MesData[]> {
  const supabase = createSupabaseBrowserClient();
  const [assoc, docs] = await Promise.all([
    fetchAllRows<AssociacaoDoc>(
      (de, ate) =>
        supabase.from("inspecao_associados").select("created_at, nome, id_inspecao").range(de, ate),
    ),
    fetchAllRows<DocumentoContavel>(
      (de, ate) =>
        supabase
          .from("inspecoes")
          .select("id_inspecao, status, elaboracao_responsavel, elaboracao_status")
          .neq("status", "DELETADA")
          .range(de, ate),
    ),
  ]);
  return serieMensalAssociacoes(assoc, docs, mesAbsAgoraSP(), 6, (abs) => rotuloMesAbs(abs), mesAbsSP);
}

async function fetchDocumentosPorSituacao(): Promise<{ name: string; value: number }[]> {
  const supabase = createSupabaseBrowserClient();
  const data = await fetchAllRows<{ status: string; elaboracao_status: string | null }>(
    (de, ate) =>
      supabase.from("inspecoes").select("status, elaboracao_status").neq("status", "DELETADA").range(de, ate),
  );

  let pendentes = 0, assumidos = 0, concluidos = 0;
  for (const row of data) {
    if (row.elaboracao_status === "CONCLUIDO") concluidos++;
    else if (row.elaboracao_status === "EM_ELABORACAO") assumidos++;
    else if (row.status === "CONCLUIDA") pendentes++; // inspeção concluída aguardando documento
  }

  // Ordem fixa (cor é posicional): Pendentes · Assumidos · Concluídos
  return [
    { name: "Pendentes",  value: pendentes },
    { name: "Assumidos",  value: assumidos },
    { name: "Concluídos", value: concluidos },
  ];
}

// Documentos por pessoa (donut). Top 6 + "Outros". A união das duas fontes
// (associados + quem assumiu a elaboração) mora em lib/dashboard/documentos: a
// tela de detalhe usava só a primeira e perdia 109 documentos, trocando até a
// ordem do pódio.
async function fetchDocumentosPorAssociado(): Promise<{ name: string; value: number }[]> {
  const supabase = createSupabaseBrowserClient();
  const [assoc, docs] = await Promise.all([
    fetchAllRows<AssociacaoDoc>(
      (de, ate) =>
        supabase.from("inspecao_associados").select("created_at, nome, id_inspecao").range(de, ate),
    ),
    fetchAllRows<DocumentoContavel>(
      (de, ate) =>
        supabase
          .from("inspecoes")
          .select("id_inspecao, status, elaboracao_responsavel, elaboracao_status")
          .neq("status", "DELETADA")
          .range(de, ate),
    ),
  ]);

  // Documentos ASSOCIADOS a cada pessoa NO MÊS CORRENTE — o mesmo número, no
  // mesmo recorte, que a tela de detalhe mostra ao abrir (decisão de 15/09).
  //
  // Até 15/09 era o acumulado de sempre e media ENTREGUES; a tela abria no
  // mês e também media entregues — dois recortes sob o mesmo título, e ele
  // viu os números diferentes. Mês corrente nos dois, e não acumulado, para
  // manter a lição de 27/08: acumulado num painel é lido como produção do mês.
  const ordenado = agruparPorAssociado(assoc, docs, { mes: mesAbsAgoraSP(), mesDe: mesAbsSP })
    .map((p) => ({ name: p.nome, value: p.total }))
    .filter((p) => p.value > 0);
  const TOP = 6;
  if (ordenado.length <= TOP) return ordenado;
  const outros = ordenado.slice(TOP).reduce((s, x) => s + x.value, 0);
  const top = ordenado.slice(0, TOP);
  return outros > 0 ? [...top, { name: "Outros", value: outros }] : top;
}

async function fetchInspecoesRecentes(): Promise<InspecaoComEmpresa[]> {
  const supabase = createSupabaseBrowserClient();
  const { data: insp, error } = await supabase
    .from("inspecoes")
    .select("*")
    .neq("status", "DELETADA")
    .order("data_inspecao", { ascending: false, nullsFirst: false })
    .limit(8);
  if (error) throw error;

  const inspecoes = (insp ?? []) as unknown as Inspecao[];
  const ids = Array.from(new Set(inspecoes.map((i) => i.id_empresa)));
  if (ids.length === 0) return [];

  const { data: emps } = await supabase
    .from("empresas")
    .select("id_empresa, nome_empresa")
    .in("id_empresa", ids);

  const empMap = new Map(
    ((emps ?? []) as unknown as Pick<Empresa, "id_empresa" | "nome_empresa">[])
      .map((e) => [e.id_empresa, e.nome_empresa])
  );

  return inspecoes.map((i) => ({ ...i, empresa_nome: empMap.get(i.id_empresa) ?? "—" }));
}

// ─── Constantes visuais ───────────────────────────────────────────────────────

const PIE_COLORS = ["#d97706", "#0ea5e9", "#94a3b8"];
// Documentos por situação: Pendentes (cinza) · Assumidos (âmbar) · Concluídos (verde)
const DOC_COLORS = ["#94a3b8", "#d97706", "#0ea5e9"];

const KPI_CONFIG = [
  { key: "empresasAtivas" as const, label: "Empresas Ativas",  icon: Building2,    color: "#0ea5e9", from: "#ecfdf5" },
  { key: "totalInspecoes" as const, label: "Total Inspeções",  icon: ClipboardList, color: "#0369a1", from: "#eff6ff" },
  { key: "emAndamento"    as const, label: "Em Andamento",     icon: Clock,         color: "#d97706", from: "#fffbeb" },
  { key: "concluidas"     as const, label: "Concluídas",       icon: CheckCircle2,  color: "#16a34a", from: "#f0fdf4" },
  { key: "rascunho"       as const, label: "Rascunhos",        icon: FileText,      color: "#64748b", from: "#f8fafc" },
] as const;

// ─── Gráfico mensal reutilizável (Técnicos / ADM) ──────────────────────────────

function GraficoMes({
  titulo, sub, data, loading, link, linkLabel, linkTitle, rotulo, className,
}: {
  titulo: string;
  /** Linha de apoio sob o título. Sem ela, só o período. */
  sub?: string;
  data: MesData[] | undefined;
  loading: boolean;
  link?: string;
  linkLabel?: string;
  linkTitle?: string;
  /** O que o número É no balão: "Documentos". Sem unidade colada. */
  rotulo: string;
  className?: string;
}) {
  return (
    <div className={`glass reveal-up flex flex-col rounded-2xl p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <p className="mt-0.5 text-xs text-gray-400">Últimos 6 meses{sub ? ` · ${sub}` : ""}</p>
        </div>
        {link && (
          <Link
            href={link}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-verde-light px-2.5 py-1.5 text-xs font-semibold text-verde-primary transition-colors hover:bg-verde-primary hover:text-white"
            title={linkTitle}
          >
            <TrendingUp className="size-3.5" />
            {linkLabel}
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {loading ? (
        <div className="min-h-40 flex-1 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <div className="min-h-40 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={24} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo={rotulo} />} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {(data ?? []).map((_, idx, arr) => (
                <Cell key={idx} fill={idx === arr.length - 1 ? "#0ea5e9" : "#0ea5e960"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Inspeções por mês — CONCLUÍDAS, pela data de conclusão ─────────────────
//
// Terceiro desenho deste cartão, e o mais simples — pedido de 15/09.
//
//  • Até 24/08 contava concluídas, mas o título não dizia isso.
//  • De 24/08 a 08/09, duas barras (visita × finalização) que pareciam
//    comparáveis e não eram.
//  • De 08/09 a 15/09, a SAFRA: as visitas do mês divididas em concluídas × em
//    aberto. Coerente por dentro, mas discordava do botão "Ver detalhe" ao
//    lado — agosto era 140 aqui (visitas) e 153 lá (conclusões), e quem lia os
//    dois achava que um deles estava errado. Não estava: eram perguntas
//    diferentes, e é justamente isso que não compensa explicar num cartão.
//
// Agora o cartão responde a UMA pergunta, a mesma da tela de detalhe: quantas
// inspeções foram CONCLUÍDAS em cada mês — `concluidas`, por `mesDeConclusao`,
// a régua de lib/dashboard/inspecoes. Os dois números fecham por construção.
//
// ⚠️ O preço, que a tela de detalhe já paga e avisa: antes de 04/08/2026 a
// data de conclusão é ESTIMADA (backfill da v154, herdou a última alteração),
// então mês antigo aparece menor do que o trabalho que houve. Medido em 15/09:
// maio/26 tem 111 visitas e 16 conclusões; julho, 157 visitas e 219
// conclusões (219 estimadas). A linha de apoio avisa enquanto houver mês assim
// na janela, e o aviso some sozinho quando os 6 meses passarem de julho/26.
// A safra continua calculada em `serieMensal` (e travada em teste), só não é
// mais desenhada aqui.

const COR_CONCLUIDAS = "#0ea5e9";

function GraficoInspecoesMes({
  data, loading, className,
}: {
  data: MesInspecoes[] | undefined;
  loading: boolean;
  className?: string;
}) {
  // Quantas conclusões da janela têm data estimada (backfill da v154). Some
  // sozinho quando a janela passar de julho/26.
  const estimadas = (data ?? []).reduce((s, m) => s + m.concluidasAprox, 0);
  return (
    <div className={`glass reveal-up flex flex-col rounded-2xl p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Inspeções por Mês</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Últimos 6 meses · concluídas, pela data de conclusão · o mesmo número do detalhe
            {estimadas > 0 && <> · antes de 04/08/26 a data é estimada</>}
          </p>
        </div>
        <Link
          href="/dashboard/inspecoes-concluidas"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-verde-light px-2.5 py-1.5 text-xs font-semibold text-verde-primary transition-colors hover:bg-verde-primary hover:text-white"
          title="Abrir o detalhe por mês e por pessoa"
        >
          <TrendingUp className="size-3.5" />
          Ver detalhe
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {loading ? (
        <div className="min-h-40 flex-1 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <div className="min-h-40 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {/* Eixo Y: `left: -16` com `width={28}` empurrava os números para fora
                do cartão — só sobrava a metade direita de cada algarismo. Visto
                em 15/09; os 5 gráficos de barras do dashboard tinham o mesmo par. */}
            <BarChart data={data} barSize={24} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Concluídas" cor={COR_CONCLUIDAS} />} />
              <Bar dataKey="concluidas" name="Concluídas" fill={COR_CONCLUIDAS} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Donut reutilizável (Por Status / Documentos por Situação) ─────────────────

/** Balão do donut: a fatia já se chama pelo rótulo, então não precisa de título. */
function BalaoDonut({
  colors, data, active, payload,
}: {
  colors: string[];
  data: { name: string; value: number }[];
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: { fill?: string } }[];
}) {
  const item = active ? payload?.[0] : undefined;
  if (!item || item.value == null) return null;
  const idx = data.findIndex((d) => d.name === item.name);
  const cor = item.payload?.fill ?? colors[(idx < 0 ? 0 : idx) % colors.length];
  return (
    <BalaoGrafico>
      <LinhaBalao texto={item.name ?? ""} valor={item.value} cor={cor} />
    </BalaoGrafico>
  );
}

function GraficoDonut({
  titulo, sub, data, colors, loading, className,
}: {
  titulo: string;
  sub: string;
  data: { name: string; value: number }[];
  colors: string[];
  loading: boolean;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={cn("glass reveal-up delay-1 rounded-2xl p-5", className)}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-lg bg-verde-light">
          <Target className="size-4 text-verde-primary" />
        </div>
      </div>

      {loading ? (
        <div className="h-52 animate-pulse rounded-xl bg-gray-100" />
      ) : total === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-gray-400">
          Nenhum dado disponível
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={data.filter((d) => d.value > 0)} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" nameKey="name" strokeWidth={0}>
                {data.filter((d) => d.value > 0).map((item) => (
                  <Cell key={item.name} fill={colors[data.findIndex((x) => x.name === item.name) % colors.length]} />
                ))}
              </Pie>
              {/* No donut o "nome" da fatia é o próprio rótulo (Em Andamento,
                  Concluídas), então o balão de uma medida serve: título = fatia. */}
              <Tooltip content={<BalaoDonut colors={colors} data={data} />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legenda manual */}
          <div className="mt-1 w-full space-y-2">
            {data.map((item, idx) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-800">{item.value}</span>
                    <span className="text-gray-400">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const [greeting, setGreeting] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const nome = user?.nome?.split(" ")[0] ?? "";
      const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      setGreeting(`${saudacao}${nome ? `, ${nome}` : ""}`);
      setLastUpdate(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [user?.nome]);

  const { data: stats, isLoading: loadingStats, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const { data: porMes, isLoading: loadingMes } = useInspecoesPorMes();

  const { data: porMesAdm, isLoading: loadingMesAdm } = useQuery({
    queryKey: ["dashboard-por-mes-adm"],
    queryFn: fetchDocumentosPorMes,
  });

  const { data: docSituacao = [], isLoading: loadingDocSit } = useQuery({
    queryKey: ["dashboard-doc-situacao"],
    queryFn: fetchDocumentosPorSituacao,
  });

  const { data: docAssociado = [], isLoading: loadingDocAssoc } = useQuery({
    queryKey: ["dashboard-doc-associado"],
    queryFn: fetchDocumentosPorAssociado,
  });
  const { data: assocPorMes, isLoading: loadingAssocMes } = useQuery({
    queryKey: ["dashboard-assoc-por-mes"],
    queryFn: fetchDocumentosAssociadosPorMes,
  });
  const assocColors = useMemo(
    () => docAssociado.map((d) => (d.name === "Outros" ? "#9ca3af" : corAvatar(d.name))),
    [docAssociado],
  );

  const { data: recentes, isLoading: loadingRecentes } = useQuery({
    queryKey: ["dashboard-recentes"],
    queryFn: fetchInspecoesRecentes,
  });

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Em Andamento", value: stats.emAndamento },
      { name: "Concluídas",   value: stats.concluidas },
      { name: "Rascunho",     value: stats.rascunho },
    ].filter((d) => d.value > 0);
  }, [stats]);

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting || "Dashboard"}</h1>
          <p className="mt-0.5 text-xs text-gray-400">
            Última atualização às {lastUpdate || "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 active:scale-95"
        >
          <RefreshCw className="size-3.5" />
          Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {loadingStats
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200/70" />
            ))
          : KPI_CONFIG.map(({ key, label, icon: Icon, color, from }) => (
              <KpiCard
                key={key}
                label={label}
                value={stats?.[key] ?? 0}
                icon={Icon}
                color={color}
                from={from}
                warn={key === "emAndamento" && (stats?.emAndamento ?? 0) > 0}
              />
            ))}
      </section>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      {/* Grade por linhas: cada linha = barra (col-span-2) + donut (col-span-1).
          items-stretch alinha os dois cards da linha na mesma altura. */}
      <section className="grid items-stretch gap-4 lg:auto-rows-fr lg:grid-cols-3">

        {/* Linha 1: Inspeções (Técnicos) + Por Status */}
        <GraficoInspecoesMes
          className="lg:col-span-2"
          data={porMes}
          loading={loadingMes}
        />
        <GraficoDonut
          titulo="Por Status"
          sub="Inspeções — distribuição total"
          data={pieData}
          colors={PIE_COLORS}
          loading={loadingStats}
        />

        {/* Linha 2: Documentos (ADM) + Documentos por Situação */}
        <GraficoMes
          className="lg:col-span-2"
          titulo="Documentos por Mês (ADM)"
          data={porMesAdm}
          loading={loadingMesAdm}
          link="/dashboard/documentos-emitidos"
          linkLabel="Ver por ADM"
          linkTitle="Produção de documentos por ADM (elaborados no SGG e enviados), por mês"
          rotulo="Documentos"
        />
        <GraficoDonut
          titulo="Documentos por Situação"
          sub="Pendentes · Assumidos · Concluídos"
          data={docSituacao}
          colors={DOC_COLORS}
          loading={loadingDocSit}
        />

        {/* Linha 3: Documentos em elaboração (barra) + por pessoa (donut). Os dois
            medem trabalho de ESCRITÓRIO; até 27/08/2026 o título dizia
            "Inspeções Associadas" e era lido como produção de campo. */}
        <GraficoMes
          className="lg:col-span-2"
          titulo="Documentos Associados por Mês"
          sub="documentos que ganharam associado no mês (escritório)"
          data={assocPorMes}
          loading={loadingAssocMes}
          link="/dashboard/por-associados"
          linkLabel="Ver por pessoa"
          linkTitle="Documentos do SGG por mês e por pessoa do administrativo — não é inspeção de campo"
          rotulo="Documentos"
        />
        <GraficoDonut
          className="lg:col-start-3"
          titulo="Documentos por Associado"
          sub="Associados neste mês (SGG) — não é campo"
          data={docAssociado}
          colors={assocColors}
          loading={loadingDocAssoc}
        />
      </section>

      {/* ── Atividade recente ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Atividade Recente</h2>
          <Link
            href="/inspecoes"
            className="flex items-center gap-1 text-xs font-medium text-verde-primary transition hover:underline"
          >
            Ver todas <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="glass reveal-up delay-2 overflow-hidden rounded-2xl">
          {loadingRecentes ? (
            <div className="p-4">
              <TabelaSkeleton linhas={6} />
            </div>
          ) : !recentes || recentes.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Nenhuma inspeção registrada ainda.{" "}
              <Link href="/inspecoes/nova" className="font-medium text-verde-primary hover:underline">
                Crie a primeira →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["Empresa", "Técnico", "Resp. Documento", "Status", "Data", ""].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400",
                          h === "" ? "text-right" : "text-left"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((insp, idx) => (
                    <tr
                      key={insp.id_inspecao}
                      className={cn(
                        "transition-colors hover:bg-verde-light/30",
                        idx < recentes.length - 1 && "border-b border-gray-50"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {insp.empresa_nome}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {insp.responsavel?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {insp.elaboracao_responsavel?.trim() || (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={insp.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {fmtData(insp.data_inspecao)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/inspecoes/${insp.id_inspecao}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-verde-light px-2.5 py-1 text-xs font-medium text-verde-primary transition hover:bg-verde-border"
                        >
                          Abrir <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  from,
  warn = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  from: string;
  warn?: boolean;
}) {
  const escuro = useTema((s) => s.tema) === "dark";
  return (
    <div
      className={cn(
        "tilt-3d reveal-up relative overflow-hidden rounded-2xl border p-4 shadow-sm",
        warn ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"
      )}
      style={
        !warn
          ? {
              // Claro = o gradiente original (pastel cheio → branco). No escuro
              // o mesmo pastel viraria um bloco claro, então lá ele vira tinta
              // sobre a superfície do tema.
              background: escuro
                ? `linear-gradient(135deg, color-mix(in srgb, ${from} 45%, var(--surface)) 0%, var(--surface) 100%)`
                : `linear-gradient(135deg, ${from} 0%, #ffffff 100%)`,
            }
          : undefined
      }
    >
      {/* Círculo decorativo de fundo */}
      <div
        className="pointer-events-none absolute -right-4 -top-4 size-20 rounded-full opacity-[0.07]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between">
        <p className="text-xs font-medium leading-tight text-gray-500">{label}</p>
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: color + "18", color }}
        >
          <Icon className="size-4" />
        </div>
      </div>

      <p className="mt-2 text-3xl font-bold tracking-tight" style={{ color }}>
        {value.toLocaleString("pt-BR")}
      </p>

      {warn && value > 0 && (
        <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
          <AlertTriangle className="size-3" />
          Requer atenção
        </p>
      )}
    </div>
  );
}
