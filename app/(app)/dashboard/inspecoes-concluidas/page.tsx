"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ListChecks, TrendingUp, Users, X } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  Legend,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import {
  conclusaoEhAproximada,
  ehCopiaOuRevisao,
  mesDeConclusao,
  concluidasPorDono,
  donoDaInspecao,
  ehRenovacao,
  SEM_AUTOR,
  type InspecaoContavel,
  type DonoConcluidas,
} from "@/lib/dashboard/inspecoes";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { BalaoGrafico, BalaoUmValor, LinhaBalao } from "@/components/ui/BalaoGrafico";

// A régua (qual mês, o que é cópia) mora em lib/dashboard/inspecoes e é a MESMA
// do card do dashboard. Antes cada tela tinha a sua cópia da conta e as duas
// divergiam: julho aparecia 219 no card e 220 aqui.

/** A linha da consulta: a régua + o dono + quem clicou em Concluir + a empresa. */
type LinhaConcluida = InspecaoContavel & {
  concluida_por_email?: string | null;
  /** E-mail de quem lançou — vale como autor quando não há registro (08/10). */
  usuario?: string | null;
  // O PostgREST devolve objeto (FK para um); o tipo gerado diz lista.
  empresas?: { nome_empresa: string | null } | { nome_empresa: string | null }[] | null;
};

async function fetchConcluidas(): Promise<LinhaConcluida[]> {
  const supabase = createSupabaseBrowserClient();
  const linhas = await fetchAllRows<LinhaConcluida>(
    (de, ate) =>
      supabase
        .from("inspecoes")
        .select(
          "id_inspecao, status, data_inspecao, concluida_em, concluida_por_email, usuario, created_at, tipo_criacao, responsavel, empresas(nome_empresa)",
        )
        .eq("status", "CONCLUIDA")
        .order("id_inspecao")
        .range(de, ate),
  );
  // Renovação de documento não é inspeção concluída (23/09) — nem no total do
  // topo, nem na barra de ninguém.
  return linhas.filter((i) => !ehRenovacao(i.tipo_criacao));
}

/**
 * As contas do painel — e-mail e nome — para traduzir o dono (o banco
 * guarda o e-mail, v283) no nome que aparece na barra.
 */
async function fetchContasDoCadastro(): Promise<{ email: string; nome: string }[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("usuarios").select("email, nome");
  if (error) throw error;
  return ((data ?? []) as { email: string | null; nome: string | null }[])
    .map((u) => ({ email: (u.email ?? "").trim(), nome: (u.nome ?? "").trim() }))
    .filter((u) => u.email !== "" && u.nome !== "");
}

/**
 * Bloco que aparece ao passar o mouse na barra da pessoa: UM número, o total
 * de inspeções que ela concluiu no recorte (pedido de 15/09: um número só).
 */
function BlocoPessoa({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { payload?: DonoConcluidas }[];
  label?: string;
}) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <BalaoGrafico titulo={label}>
      <LinhaBalao texto="Concluídas" valor={d.total} cor="#0ea5e9" />
    </BalaoGrafico>
  );
}

const ROTULO_TOTAL = { fontSize: 12, fontWeight: 700, fill: "var(--text-strong)" } as const;

export default function InspecoesConcluidasDashboard() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-concluidas-detalhe"],
    queryFn: fetchConcluidas,
  });
  const { data: contas = [] } = useQuery({
    queryKey: ["dashboard-contas-email"],
    queryFn: fetchContasDoCadastro,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Começa no MÊS CORRENTE — mesma correção das telas de documentos (27/08).
   * Aberta no acumulado, a barra soma todos os meses e é lida como produção do
   * mês: a primeira colocada aparecia com 76 onde o mês dela é ~20.
   */
  const [mesSel, setMesSelBruto] = useState<string | null>(String(mesAbsAgoraSP()));
  // A pessoa cuja barra foi clicada — a lista dela aparece embaixo. Trocar de
  // mês fecha a lista, senão ela mostraria o mês antigo sob o título novo.
  const [pessoaSel, setPessoaSel] = useState<string | null>(null);
  const setMesSel: typeof setMesSelBruto = (v) => {
    setPessoaSel(null);
    setMesSelBruto(v);
  };

  const mesAtual = mesAbsAgoraSP();

  // Por mês — últimos 12 meses (cada barra tem sua chave = mês absoluto)
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const abs = mesAtual - (11 - i);
    return { chave: String(abs), mes: rotuloMesAbs(abs, true), total: 0 };
  });
  rows.forEach((r) => {
    const abs = mesDeConclusao(r);
    if (abs == null) return;
    const item = porMes.find((m) => m.chave === String(abs));
    if (item) item.total++;
  });

  const mesSelLabel = mesSel ? porMes.find((m) => m.chave === mesSel)?.mes ?? null : null;

  /**
   * Por pessoa = o DONO da inspeção, quem a lançou (08/10, ver
   * `donoDaInspecao`). Até 07/10 contava quem foi a campo e, por um dia, quem
   * clicou em Concluir. Cada inspeção tem um único dono, então a soma das
   * barras é sempre o total do recorte.
   */
  const rowsMes = mesSel ? rows.filter((r) => String(mesDeConclusao(r)) === mesSel) : rows;
  const porPessoa = concluidasPorDono(rowsMes, contas);
  const totalCopias = porPessoa.reduce((s, t) => s + t.copias, 0);
  const semAutor = porPessoa.find((p) => p.pessoa === SEM_AUTOR)?.total ?? 0;

  // A lista filtra pelo mesmo critério que montou a barra, e por isso tem
  // sempre o tamanho dela.
  const nomePorEmail = new Map(contas.map((c) => [c.email.toLowerCase(), c.nome]));
  const pessoaDe = (r: LinhaConcluida) => donoDaInspecao(r, contas);
  const listaPessoa = pessoaSel
    ? rowsMes
        .filter((r) => pessoaDe(r) === pessoaSel)
        .sort((a, b) => (a.concluida_em ?? a.created_at).localeCompare(b.concluida_em ?? b.created_at))
    : [];

  // Conclusões do recorte cuja data é ESTIMADA (backfill da v154).
  const estimadas = rowsMes.filter(conclusaoEhAproximada).length;

  const total = rows.length;

  const abrirPessoa = (d: { pessoa?: string; payload?: { pessoa?: string } }) => {
    const nome = d?.pessoa ?? d?.payload?.pessoa ?? null;
    if (!nome) return;
    setPessoaSel((atual) => (atual === nome ? null : nome));
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <CheckCircle2 className="size-5 text-verde-primary" />
          Inspeções Concluídas
        </h1>
        <p className="text-sm text-gray-500">
          {isLoading ? "Carregando…" : `${total} inspeç${total !== 1 ? "ões" : "ão"} concluída${total !== 1 ? "s" : ""} no total`}
        </p>
      </div>

      {/* Por mês */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-verde-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Por mês (últimos 12 meses)</h2>
          </div>
          <p className="text-xs text-gray-400">Clique num mês para filtrar abaixo</p>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            {/* `left: -16` + `width={28}` cortava os números do eixo (15/09). */}
            <BarChart data={porMes} barSize={26} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Concluídas" />} />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(d: { chave?: string; payload?: { chave?: string } }) => {
                  // Usa a chave do próprio dado clicado (o index do recharts não é confiável).
                  const k = d?.chave ?? d?.payload?.chave ?? null;
                  if (!k) return;
                  setMesSel((atual) => (atual === k ? null : k));
                }}
              >
                {porMes.map((m) => (
                  <Cell key={m.chave} fill={mesSel === m.chave ? "#0ea5e9" : "#0ea5e960"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Concluídas por pessoa (dono = quem lançou) */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Concluídas por pessoa {mesSelLabel ? `— ${mesSelLabel}` : "— acumulado de todos os meses"}
              </h2>
              <p className="text-xs text-gray-400">
                {mesSelLabel
                  ? "Cada inspeção concluída conta para quem a lançou"
                  : "Soma de todos os meses — não é a produção de um mês"}
                {totalCopias > 0 && <> · {totalCopias} cópia(s)/revisão(ões) no recorte</>}
              </p>
            </div>
          </div>
          {mesSel ? (
            <button
              type="button"
              onClick={() => setMesSel(null)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Ver todos os meses
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMesSel(String(mesAbsAgoraSP()))}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="size-3" /> Voltar ao mês atual
            </button>
          )}
        </div>
        {!isLoading && estimadas > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>{estimadas}</strong> {estimadas !== 1 ? "destas conclusões têm" : "desta conclusão tem"}{" "}
            data <strong>estimada</strong>: o painel só passou a registrar o momento da
            finalização em 04/08/2026, e o que é anterior herdou a data da última alteração
            da inspeção.
          </div>
        )}
        {!isLoading && semAutor > 0 && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>{semAutor}</strong> {semAutor !== 1 ? "inspeções não têm" : "inspeção não tem"} registro de
            quem lançou. {semAutor !== 1 ? "Elas aparecem" : "Ela aparece"} em &quot;{SEM_AUTOR}&quot;.
          </div>
        )}
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : porPessoa.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma inspeção concluída{mesSelLabel ? ` em ${mesSelLabel}` : ""}.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porPessoa.length * 38)}>
            <BarChart
              data={porPessoa}
              layout="vertical"
              barSize={22}
              margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="pessoa"
                tick={{ fontSize: 11, fill: "var(--text-body)" }}
                axisLine={false}
                tickLine={false}
                width={150}
              />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BlocoPessoa />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              {/* O total no fim da barra. O recharts 3 DESCARTA o retângulo de
                  valor zero antes de desenhar os rótulos (Bar.js: "Filter out
                  0-dimension rectangles"), então cada barra rotula os seus: a
                  das visitas quem não tem cópia, a das cópias quem tem. */}
              <Bar dataKey="novas" name="Visitas novas" stackId="t" fill="#0ea5e9" radius={[0, 0, 0, 0]} cursor="pointer" onClick={abrirPessoa}>
                <LabelList
                  valueAccessor={(e) => ((e.payload as DonoConcluidas).copias > 0 ? null : (e.payload as DonoConcluidas).total)}
                  position="right"
                  style={ROTULO_TOTAL}
                />
              </Bar>
              <Bar dataKey="copias" name="Cópias/revisões" stackId="t" fill="#94a3b8" radius={[0, 6, 6, 0]} cursor="pointer" onClick={abrirPessoa}>
                <LabelList dataKey="total" position="right" style={ROTULO_TOTAL} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {!isLoading && porPessoa.length > 0 && !pessoaSel && (
          <p className="mt-2 text-xs text-gray-400">Clique na barra de uma pessoa para ver as inspeções dela.</p>
        )}
      </div>

      {/* As inspeções por trás da barra. */}
      {pessoaSel && (
        <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-verde-primary" />
              <h2 className="text-sm font-semibold text-gray-800">
                {pessoaSel} — {listaPessoa.length} inspeç{listaPessoa.length !== 1 ? "ões" : "ão"}
                {mesSelLabel ? ` concluída${listaPessoa.length !== 1 ? "s" : ""} em ${mesSelLabel}` : " (todos os meses)"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setPessoaSel(null)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="size-3" /> Fechar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">Visita</th>
                  <th className="py-2 pr-3 font-medium">Concluída</th>
                  <th className="py-2 pr-3 font-medium">Lançada por</th>
                  <th className="py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {listaPessoa.map((i) => (
                  <tr key={i.id_inspecao} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/inspecoes/${i.id_inspecao}`} className="text-gray-800 hover:text-verde-primary hover:underline">
                        {nomeEmpresa(i)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{dataBR(i.data_inspecao)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{instanteBR(i.concluida_em ?? i.created_at)}</td>
                    <td className="py-2 pr-3 text-gray-600">{i.responsavel || "—"}</td>
                    <td className="py-2 text-xs text-gray-500">{observacao(i, nomePorEmail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Data pura "AAAA-MM-DD" → "DD/MM/AAAA", sem passar por fuso. */
function dataBR(d: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

/** Instante → dia em São Paulo. */
function instanteBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Tipo da inspeção e, quando outra pessoa clicou em Concluir, quem foi — é
 * por aqui que o reabrir+concluir (caso DUNA) fica visível sem mudar a conta.
 */
function observacao(i: LinhaConcluida, nomePorEmail: Map<string, string>): string {
  const partes = [ehCopiaOuRevisao(i.tipo_criacao) ? "Cópia/revisão" : "Visita nova"];
  const clicou = (i.concluida_por_email ?? "").trim().toLowerCase();
  const nomeClicou = clicou ? nomePorEmail.get(clicou) ?? clicou : "";
  if (nomeClicou && nomeClicou !== (i.responsavel ?? "").trim()) {
    partes.push(`concluída por ${nomeClicou}`);
  }
  return partes.join(" · ");
}

function nomeEmpresa(i: LinhaConcluida): string {
  const e = Array.isArray(i.empresas) ? i.empresas[0] : i.empresas;
  return e?.nome_empresa ?? "—";
}
