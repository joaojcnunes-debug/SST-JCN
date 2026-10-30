"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Users,
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
import { ehRenovacao, type MesInspecoes } from "@/lib/dashboard/inspecoes";
import { situacaoPorColaborador, LIMITE_PARADA, type LinhaColaborador } from "@/lib/dashboard/colaboradores";
import { useInspecoesPorMes } from "@/lib/hooks/useInspecoesPorMes";
import {
  concluidosPorMes,
  porSituacao,
  chaveNome,
  type AssociacaoDoc,
  type DocumentoContavel,
} from "@/lib/dashboard/documentos";
import { empresasAssociadasPorMes, empresasPorPessoa, eventosDeAssociacao } from "@/lib/dashboard/associacoes-empresas";
import { useDocumentosConcluidos } from "@/lib/hooks/useDocumentosConcluidos";
import { useAssociacoesEmpresas, useTecnicosDeCampo, useContasDoPainel, nomeDaEmpresa } from "@/lib/hooks/useDashboardFontes";
import { useFiltroUnidadeDashboard } from "@/lib/hooks/useFiltroUnidadeDashboard";
import { useIsSupervisor } from "@/lib/hooks/useUsuario";
import FiltroUnidade from "@/components/dashboard/FiltroUnidade";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { situacaoDocumento, type LinhaDocumento } from "@/lib/inspecoes/documento";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { BalaoGrafico, BalaoUmValor, LinhaBalao } from "@/components/ui/BalaoGrafico";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import { cn, fmtData } from "@/lib/utils";
import { useUserStore, useTema } from "@/lib/store";
import { corAvatar } from "@/lib/hooks/useGestao";
import type { StatusInspecao } from "@/lib/supabase/types";
import { useState, useEffect, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MesData {
  mes: string;
  total: number;
}

/**
 * Uma inspeção como o Dashboard a lê — com a empresa (recorte por unidade, 28/10) e as colunas
 * calculadas do banco (v306/v309): situação do documento, espera, prioridade efetiva.
 */
interface InspecaoPainel {
  id_inspecao: string;
  id_empresa: string | null;
  status: string;
  tipo_criacao: string | null;
  data_inspecao: string | null;
  concluida_em: string | null;
  primeira_conclusao_em?: string | null;
  primeira_conclusao_tecnicos?: { digitado: string; idUsuario: string | null }[] | null;
  created_at: string;
  updated_at: string | null;
  responsavel: string | null;
  elaboracao_status: string | null;
  elaboracao_responsavel: string | null;
  prazo: string | null;
  tecnicos_campo: string | null;
  situacao_documento: string | null;
  dias_espera: number | null;
  prioridade_efetiva: string | null;
  empresas?: { nome_empresa: string | null } | { nome_empresa: string | null }[] | null;
  inspecao_associados?: { nome: string | null }[] | null;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Todas as inspeções (exceto excluídas) com o que os cartões precisam — UMA consulta para os KPIs, o
 * donut de documentos, a Atividade recente e a Situação por colaborador. Antes eram contagens
 * separadas no banco, que não davam para recortar pela unidade (28/10).
 */
async function fetchInspecoesPainel(): Promise<InspecaoPainel[]> {
  const supabase = createSupabaseBrowserClient();
  return fetchAllRows<InspecaoPainel>((de, ate) =>
    supabase
      .from("inspecoes")
      .select(
        "id_inspecao, id_empresa, status, tipo_criacao, data_inspecao, concluida_em, primeira_conclusao_em, primeira_conclusao_tecnicos, created_at, updated_at, responsavel, " +
          "elaboracao_status, elaboracao_responsavel, prazo, tecnicos_campo, situacao_documento, dias_espera, prioridade_efetiva, " +
          "empresas(nome_empresa), inspecao_associados(nome)",
      )
      .neq("status", "DELETADA")
      .order("id_inspecao")
      .range(de, ate),
  );
}

async function fetchEmpresas(): Promise<{ id_empresa: string; status: string | null }[]> {
  const supabase = createSupabaseBrowserClient();
  return fetchAllRows<{ id_empresa: string; status: string | null }>((de, ate) =>
    supabase.from("empresas").select("id_empresa, status").order("id_empresa").range(de, ate),
  );
}

// Inspeções por mês: a consulta e a régua moram em lib/hooks/useInspecoesPorMes,
// compartilhado com o mini-gráfico da tela Início (15/09) — antes cada um
// contava por conta própria e os dois divergiam (agosto: 153 × 140).

/** Todas as chaves que a tela lê — o "Atualizar" recarrega todas (antes só os KPIs). */
// "dashboard-stats" é o prefixo que as telas de inspeção e empresas já invalidam ao gravar.
const CHAVES_DASHBOARD = [
  "dashboard-stats",
  "inspecoes-por-mes",
  "dashboard-documentos-adm",
  "dashboard-associacoes-empresas",
  "dashboard-tecnicos-de-campo",
  "dashboard-contas-painel",
  "dashboard-empresa-unidade",
];

// ─── Constantes visuais ───────────────────────────────────────────────────────

const PIE_COLORS = ["#d97706", "#0ea5e9", "#94a3b8"];
// Documentos por situação: Aguardando campo (cinza claro) · Pendentes (cinza) · Atribuídos (âmbar claro) ·
// Em elaboração (âmbar) · Concluídos (azul)
const DOC_COLORS = ["#cbd5e1", "#94a3b8", "#fcd34d", "#d97706", "#0ea5e9"];

// `status`: o filtro da lista de Inspeções que o cartão abre.
const KPI_CONFIG: {
  key: "empresasAtivas" | "totalInspecoes" | "emAndamento" | "concluidas" | "rascunho";
  label: string;
  icon: React.ElementType;
  color: string;
  from: string;
  status?: string;
}[] = [
  { key: "empresasAtivas", label: "Empresas Ativas", icon: Building2,     color: "#0ea5e9", from: "#ecfdf5" },
  { key: "totalInspecoes", label: "Total Inspeções", icon: ClipboardList, color: "#0369a1", from: "#eff6ff" },
  { key: "emAndamento",    label: "Em Andamento",    icon: Clock,         color: "#d97706", from: "#fffbeb", status: "EM_ANDAMENTO" },
  { key: "concluidas",     label: "Concluídas",      icon: CheckCircle2,  color: "#16a34a", from: "#f0fdf4", status: "CONCLUIDA" },
  { key: "rascunho",       label: "Rascunhos",       icon: FileText,      color: "#64748b", from: "#f8fafc", status: "RASCUNHO" },
];

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
          <h2 className="text-sm font-semibold text-gray-800">Inspeções realizadas por TST</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Últimos 6 meses · no mês da 1ª conclusão (reabrir não muda) · o mesmo número do detalhe
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
  const qc = useQueryClient();
  const supervisor = useIsSupervisor();
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

  // 28/10: a MESMA unidade das telas de detalhe (começa na unidade ativa). Antes a tela principal
  // somava todas as unidades e o detalhe abria na unidade ativa — "o mesmo número do detalhe" não era.
  const unidade = useFiltroUnidadeDashboard();
  const naUnidade = unidade.naUnidade;

  // "Atualizar" recarrega TODOS os cartões (antes só os KPIs; o resto ficava com o número velho).
  const atualizar = () => {
    for (const k of CHAVES_DASHBOARD) qc.invalidateQueries({ queryKey: [k] });
    setLastUpdate(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  };

  const { data: todasInsp, isLoading: loadingInsp } = useQuery({
    queryKey: ["dashboard-stats", "inspecoes"],
    queryFn: fetchInspecoesPainel,
  });
  const { data: todasEmp, isLoading: loadingEmp } = useQuery({
    queryKey: ["dashboard-stats", "empresas"],
    queryFn: fetchEmpresas,
  });
  const insp = useMemo(() => (todasInsp ?? []).filter((i) => naUnidade(i.id_empresa)), [todasInsp, naUnidade]);
  const hoje = hojeSP();

  const stats = useMemo(() => {
    if (!todasInsp || !todasEmp) return undefined;
    // Renovação de documento (23/09) não é inspeção: fica fora dos cartões de inspeção.
    const deCampo = insp.filter((i) => !ehRenovacao(i.tipo_criacao));
    const andamento = deCampo.filter((i) => i.status === "EM_ANDAMENTO");
    return {
      empresasAtivas: todasEmp.filter((e) => e.status === "Ativo" && naUnidade(e.id_empresa)).length,
      totalInspecoes: deCampo.length,
      emAndamento: andamento.length,
      // "Requer atenção" só quando há inspeção PARADA (antes acendia com qualquer uma aberta).
      emAndamentoParadas: andamento.filter((i) => (i.dias_espera ?? 0) > LIMITE_PARADA).length,
      concluidas: deCampo.filter((i) => i.status === "CONCLUIDA").length,
      rascunho: deCampo.filter((i) => i.status === "RASCUNHO").length,
    };
  }, [todasInsp, todasEmp, insp, naUnidade]);
  const loadingStats = loadingInsp || loadingEmp || unidade.carregando;

  const { data: porMes, isLoading: loadingMes } = useInspecoesPorMes(naUnidade);

  // Documentos concluídos (ADM): a mesma consulta e a mesma conta da tela
  // /dashboard/documentos-emitidos — lib/hooks/useDocumentosConcluidos.
  const { data: concluidosAdm, isLoading: loadingMesAdm } = useDocumentosConcluidos();
  const concluidosUnidade = useMemo(() => (concluidosAdm ?? []).filter((d) => naUnidade(d.id_empresa)), [concluidosAdm, naUnidade]);
  const porMesAdm = useMemo<MesData[] | undefined>(
    () =>
      concluidosAdm &&
      concluidosPorMes(concluidosUnidade, mesAbsAgoraSP(), 6, mesAbsSP).map((m) => ({
        mes: rotuloMesAbs(m.chave),
        total: m.total,
      })),
    [concluidosAdm, concluidosUnidade],
  );

  // Documentos associados (26/10/2026): EMPRESAS por pessoa, no mês da associação (ou de quando
  // foi assumido), sem acumular — a mesma conta da tela /dashboard/por-associados
  // (lib/dashboard/associacoes-empresas).
  const { data: fonteAssoc, isLoading: loadingAssoc } = useAssociacoesEmpresas();
  const { assocPorMes, docAssociado } = useMemo(() => {
    if (!fonteAssoc) return { assocPorMes: undefined, docAssociado: [] as { name: string; value: number }[] };
    const docsUnidade = fonteAssoc.docs.filter((d) => naUnidade(d.id_empresa));
    const eventos = eventosDeAssociacao(fonteAssoc.assoc, fonteAssoc.assuncoes, docsUnidade, mesAbsSP);
    const serie = empresasAssociadasPorMes(eventos, mesAbsAgoraSP(), 6).map((m) => ({ mes: rotuloMesAbs(m.chave), total: m.total }));
    const ordenado = empresasPorPessoa(eventos, mesAbsAgoraSP()).map((p) => ({ name: p.pessoa, value: p.total }));
    const TOP = 6;
    const outros = ordenado.slice(TOP).reduce((soma, x) => soma + x.value, 0);
    const donut = ordenado.length <= TOP ? ordenado : outros > 0 ? [...ordenado.slice(0, TOP), { name: "Outros", value: outros }] : ordenado.slice(0, TOP);
    return { assocPorMes: serie, docAssociado: donut };
  }, [fonteAssoc, naUnidade]);
  const assocColors = useMemo(
    () => docAssociado.map((d) => (d.name === "Outros" ? "#9ca3af" : corAvatar(d.name))),
    [docAssociado],
  );

  // Documentos por situação — pela régua da lista (lib/inspecoes/documento), com as associações.
  const docSituacao = useMemo(() => {
    if (!todasInsp || !fonteAssoc) return [];
    const ids = new Set(insp.map((i) => i.id_inspecao));
    const assoc: AssociacaoDoc[] = fonteAssoc.assoc.filter((a) => ids.has(a.id_inspecao));
    const docs: DocumentoContavel[] = insp.map((i) => ({
      id_inspecao: i.id_inspecao,
      status: i.status,
      elaboracao_responsavel: i.elaboracao_responsavel,
      elaboracao_status: i.elaboracao_status,
    }));
    const s = porSituacao(assoc, docs);
    // Ordem fixa (cor é posicional), na ordem do caminho do documento.
    return [
      { name: "Aguardando campo", value: s.aguardandoCampo },
      { name: "Pendentes",        value: s.pendentes },
      { name: "Atribuídos",       value: s.atribuidos },
      { name: "Em elaboração",    value: s.assumidos },
      { name: "Concluídos",       value: s.concluidos },
    ];
  }, [todasInsp, fonteAssoc, insp]);

  // Situação por colaborador (28/10) — lib/dashboard/colaboradores.
  const { data: tecnicosDeCampo, isLoading: loadingTec } = useTecnicosDeCampo();
  const { data: contas = [] } = useContasDoPainel();
  const colaboradores = useMemo<LinhaColaborador[] | undefined>(() => {
    if (!todasInsp || !tecnicosDeCampo || !concluidosAdm) return undefined;
    const associados = new Map<string, string[]>();
    for (const i of insp) {
      const nomes = (i.inspecao_associados ?? []).map((a) => (a.nome ?? "").trim()).filter(Boolean);
      if (nomes.length) associados.set(i.id_inspecao, nomes);
    }
    return situacaoPorColaborador({
      inspecoes: insp,
      associados,
      documentos: concluidosUnidade,
      opcoes: { tecnicosDeCampo, cadastro: contas.map((c) => c.nome), contas },
      mesAtual: mesAbsAgoraSP(),
      mesDe: mesAbsSP,
      hoje,
    });
  }, [todasInsp, tecnicosDeCampo, concluidosAdm, insp, concluidosUnidade, contas, hoje]);
  const idPorNome = useMemo(() => new Map(contas.map((c) => [chaveNome(c.nome), c.id_usuario])), [contas]);

  // Atividade recente: o que MEXEU por último (antes: a data da visita, que põe visita futura no topo).
  const recentes = useMemo(
    () =>
      [...insp]
        .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
        .slice(0, 8),
    [insp],
  );

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Em Andamento", value: stats.emAndamento },
      { name: "Concluídas",   value: stats.concluidas },
      { name: "Rascunho",     value: stats.rascunho },
    ].filter((d) => d.value > 0);
  }, [stats]);

  // Os cartões abrem a lista de Inspeções já filtrada (na mesma unidade).
  const naLista = (status?: string) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    // Sempre, mesmo vazia: sem o parâmetro a lista abriria na unidade ativa, não em "todas".
    sp.set("unidade", unidade.idUnidade);
    return `/inspecoes?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting || "Dashboard"}</h1>
          <p className="mt-0.5 text-xs text-gray-400">
            Última atualização às {lastUpdate || "—"}
            {unidade.nomeUnidade ? ` · unidade ${unidade.nomeUnidade}` : " · todas as unidades"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroUnidade idUnidade={unidade.idUnidade} unidades={unidade.unidades} onChange={unidade.setIdUnidade} />
          <button
            type="button"
            onClick={atualizar}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 active:scale-95"
          >
            <RefreshCw className="size-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {loadingStats
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200/70" />
            ))
          : KPI_CONFIG.map(({ key, label, icon: Icon, color, from, status }) => (
              <Link key={key} href={key === "empresasAtivas" ? "/empresas" : naLista(status)} className="block">
                <KpiCard
                  label={label}
                  value={stats?.[key] ?? 0}
                  icon={Icon}
                  color={color}
                  from={from}
                  aviso={
                    key === "emAndamento" && (stats?.emAndamentoParadas ?? 0) > 0
                      ? `${stats!.emAndamentoParadas} parada${stats!.emAndamentoParadas !== 1 ? "s" : ""} há +${LIMITE_PARADA} dias`
                      : undefined
                  }
                />
              </Link>
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
          loading={loadingMes || unidade.carregando}
        />
        <GraficoDonut
          titulo="Por Status"
          sub="Inspeções — distribuição total (sem renovação)"
          data={pieData}
          colors={PIE_COLORS}
          loading={loadingStats}
        />

        {/* Linha 2: Documentos (ADM) + Documentos por Situação */}
        <GraficoMes
          className="lg:col-span-2"
          titulo="Documentos por Mês (ADM)"
          sub="concluídos no mês, na 1ª conclusão"
          data={porMesAdm}
          loading={loadingMesAdm || unidade.carregando}
          link="/dashboard/documentos-emitidos"
          linkLabel="Ver por ADM"
          linkTitle="Produção de documentos por ADM (elaborados no SGG e enviados), por mês"
          rotulo="Documentos"
        />
        <GraficoDonut
          titulo="Documentos por Situação"
          sub="Aguardando campo · Pendentes · Atribuídos (não iniciados) · Em elaboração · Concluídos"
          data={docSituacao}
          colors={DOC_COLORS}
          loading={loadingStats || loadingAssoc}
        />

        {/* Linha 3: empresas associadas (barra) + por pessoa (donut). Os dois medem trabalho de
            ESCRITÓRIO. Desde 26/10 contam EMPRESAS por pessoa (28/10: o título dizia "Documentos"). */}
        <GraficoMes
          className="lg:col-span-2"
          titulo="Empresas Associadas por Mês"
          sub="empresas associadas no mês, somadas por pessoa, sem acumular (escritório)"
          data={assocPorMes}
          loading={loadingAssoc || unidade.carregando}
          link="/dashboard/por-associados"
          linkLabel="Ver por pessoa"
          linkTitle="Empresas associadas por mês e por pessoa do administrativo — não é inspeção de campo"
          rotulo="Empresas"
        />
        <GraficoDonut
          className="lg:col-start-3"
          titulo="Empresas por Associado"
          sub="Empresas associadas neste mês — não é campo"
          data={docAssociado}
          colors={assocColors}
          loading={loadingAssoc}
        />
      </section>

      {/* ── Situação por colaborador ───────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Users className="size-4 text-verde-primary" /> Situação por colaborador
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              O que está com cada pessoa agora e o que ela entregou no mês. Campo pela aba Responsáveis (sem ninguém, quem abriu);
              documento pelos associados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* v0.3.183: horas apontadas nos documentos (sessões da v311) — só supervisão. */}
            {supervisor && (
              <Link href="/dashboard/tempo-documentos" className="flex items-center gap-1 text-xs font-medium text-verde-primary transition hover:underline">
                Tempo nos documentos <ArrowRight className="size-3" />
              </Link>
            )}
            <Link href="/inspecoes/minhas" className="flex items-center gap-1 text-xs font-medium text-verde-primary transition hover:underline">
              Minhas inspeções <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
        <div className="glass reveal-up overflow-hidden rounded-2xl">
          {!colaboradores || loadingTec || unidade.carregando ? (
            <div className="p-4">
              <TabelaSkeleton linhas={5} />
            </div>
          ) : colaboradores.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">Ninguém com inspeção ou documento em aberto, nem entrega no mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 text-left">Colaborador</th>
                    <th className="px-4 py-3 text-right" title="Inspeções em Rascunho ou Em andamento">Campo aberto</th>
                    <th className="px-4 py-3 text-right" title={`Abertas há mais de ${LIMITE_PARADA} dias`}>Parado +{LIMITE_PARADA}d</th>
                    <th className="px-4 py-3 text-right" title="Documento atribuído, inspeção concluída em campo, ainda não iniciado">Doc. não iniciado</th>
                    <th className="px-4 py-3 text-right">Em elaboração</th>
                    <th className="px-4 py-3 text-right" title="Documentos concluídos neste mês (1ª conclusão)">Entregues no mês</th>
                    <th className="px-4 py-3 text-right" title="Itens abertos com prioridade efetiva Crítica ou Urgente">Críticas/urgentes</th>
                    <th className="px-4 py-3 text-right">Prazo vencido</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((c, idx) => {
                    const id = idPorNome.get(chaveNome(c.pessoa));
                    return (
                      <tr key={c.pessoa} className={cn("transition-colors hover:bg-verde-light/30", idx < colaboradores.length - 1 && "border-b border-gray-50")}>
                        <td className="px-4 py-2.5">
                          {supervisor && id ? (
                            <Link href={`/inspecoes/minhas?pessoa=${id}`} className="font-medium text-gray-900 hover:text-verde-primary hover:underline" title="Abrir a fila desta pessoa">
                              {c.pessoa}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-900">{c.pessoa}</span>
                          )}
                        </td>
                        <Num v={c.campoAbertas} />
                        <Num v={c.campoParadas} alerta="laranja" />
                        <Num v={c.docAtribuidos} alerta={c.docAtribuidos > 0 ? "ambar" : undefined} />
                        <Num v={c.docEmElaboracao} />
                        <Num v={c.entreguesMes} alerta={c.entreguesMes > 0 ? "verde" : undefined} />
                        <Num v={c.criticas} alerta="vermelho" />
                        <Num v={c.prazoVencido} alerta="vermelho" />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Atividade recente ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Atividade Recente</h2>
            <p className="mt-0.5 text-xs text-gray-400">As inspeções alteradas por último</p>
          </div>
          <Link
            href={naLista()}
            className="flex items-center gap-1 text-xs font-medium text-verde-primary transition hover:underline"
          >
            Ver todas <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="glass reveal-up delay-2 overflow-hidden rounded-2xl">
          {loadingStats ? (
            <div className="p-4">
              <TabelaSkeleton linhas={6} />
            </div>
          ) : recentes.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Nenhuma inspeção registrada{unidade.nomeUnidade ? " nesta unidade" : ""}.{" "}
              <Link href="/inspecoes/nova" className="font-medium text-verde-primary hover:underline">
                Crie a primeira →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["Empresa", "Técnico de campo", "Documento", "Status", "Visita", "Alterada", ""].map((h) => (
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
                  {recentes.map((i, idx) => {
                    const campo = (i.tecnicos_campo ?? "").trim();
                    const doc = situacaoDocumento(
                      {
                        status: i.status,
                        elaboracao_status: i.elaboracao_status as LinhaDocumento["elaboracao_status"],
                        elaboracao_responsavel: i.elaboracao_responsavel,
                        elaboracao_concluida_em: null,
                      },
                      (i.inspecao_associados ?? []).map((a) => a.nome ?? ""),
                      "curto",
                    );
                    return (
                      <tr
                        key={i.id_inspecao}
                        className={cn(
                          "transition-colors hover:bg-verde-light/30",
                          idx < recentes.length - 1 && "border-b border-gray-50"
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {nomeDaEmpresa(i.empresas)}
                          {ehRenovacao(i.tipo_criacao) && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">renovação</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {campo || (
                            <span title="Ninguém na aba Responsáveis: conta para quem abriu">
                              {i.responsavel?.trim() || "—"} <span className="text-[11px] text-amber-600">(sem registro)</span>
                            </span>
                          )}
                        </td>
                        <td className={cn("px-4 py-3 text-xs", doc?.cor ?? "text-gray-300")}>{doc?.texto ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={i.status as StatusInspecao} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">{fmtData(i.data_inspecao)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fmtData(i.updated_at ?? i.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/inspecoes/${i.id_inspecao}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-verde-light px-2.5 py-1 text-xs font-medium text-verde-primary transition hover:bg-verde-border"
                          >
                            Abrir <ArrowRight className="size-3" />
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
      </section>
    </div>
  );
}

/** Célula numérica da Situação por colaborador: zero fica apagado; o resto, na cor do alerta. */
function Num({ v, alerta }: { v: number; alerta?: "vermelho" | "laranja" | "ambar" | "verde" }) {
  const cor =
    v === 0
      ? "text-gray-300"
      : alerta === "vermelho"
        ? "font-semibold text-red-600"
        : alerta === "laranja"
          ? "font-semibold text-orange-600"
          : alerta === "ambar"
            ? "font-semibold text-amber-700"
            : alerta === "verde"
              ? "font-semibold text-emerald-700"
              : "text-gray-800";
  return <td className={cn("px-4 py-2.5 text-right tabular-nums", cor)}>{v}</td>;
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  from,
  aviso,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  from: string;
  /** Texto do alerta (ex.: "2 paradas há +30 dias"). Sem ele, o cartão fica normal. */
  aviso?: string;
}) {
  const warn = !!aviso;
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

      {aviso && (
        <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
          <AlertTriangle className="size-3" />
          {aviso}
        </p>
      )}
    </div>
  );
}
