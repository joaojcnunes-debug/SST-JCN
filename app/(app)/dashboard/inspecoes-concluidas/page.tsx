"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ListChecks, RotateCcw, TrendingUp, Users, X } from "lucide-react";
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
import { mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import {
  conclusaoEhAproximada,
  ehCopiaOuRevisao,
  instanteDeConclusao,
  mesDeConclusao,
  porTecnico,
  tecnicosCreditados,
  type TecnicoInspecoes,
} from "@/lib/dashboard/inspecoes";
import {
  nomeDaEmpresa,
  useContasDoPainel,
  useInspecoesConcluidas,
  useReaberturas,
  useTecnicosDeCampo,
  type InspecaoConcluida,
} from "@/lib/hooks/useDashboardFontes";
import { useIsSupervisor } from "@/lib/hooks/useUsuario";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { BalaoGrafico, BalaoUmValor, LinhaBalao } from "@/components/ui/BalaoGrafico";
import ReaberturasAviso from "@/components/dashboard/ReaberturasAviso";
import NotaSemTecnico from "@/components/dashboard/NotaSemTecnico";
import TickPessoa from "@/components/dashboard/TickPessoa";
import FiltroUnidade from "@/components/dashboard/FiltroUnidade";
import { useFiltroUnidadeDashboard } from "@/lib/hooks/useFiltroUnidadeDashboard";

/**
 * Inspeções realizadas por TST (pedido de 26/10/2026).
 *
 *  - CONTA PARA O TÉCNICO RESPONSÁVEL que foi a campo (aba Responsáveis, vínculo v204), mesmo que
 *    outra pessoa tenha clicado em Concluir por ele. Visita em dupla conta para os dois. Sem técnico
 *    registrado, conta para quem abriu, marcada "sem registro" — e a nota abaixo deixa o supervisor
 *    escolher quem foi a campo. (Até 25/10 contava quem LANÇOU a inspeção.)
 *  - NO MÊS DA 1ª CONCLUSÃO (v295, travada no banco). Reabrir e concluir de novo não muda nem o mês
 *    nem a pessoa; a reabertura aparece no aviso, com quem reabriu e os campos alterados.
 *
 * As réguas moram em lib/dashboard/inspecoes e são as mesmas do card do dashboard e da página da
 * pessoa (/dashboard/pessoa?fonte=inspecoes).
 */

function BlocoPessoa({ active, payload, label }: { active?: boolean; payload?: { payload?: TecnicoInspecoes }[]; label?: string }) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <BalaoGrafico titulo={label}>
      <LinhaBalao texto="Inspeções realizadas" valor={d.total} cor="#0ea5e9" />
      {d.semRegistro > 0 && <LinhaBalao texto="Sem técnico registrado" valor={d.semRegistro} cor="#f59e0b" />}
    </BalaoGrafico>
  );
}

const ROTULO_TOTAL = { fontSize: 12, fontWeight: 700, fill: "var(--text-strong)" } as const;

export default function InspecoesConcluidasDashboard() {
  const { data: todas = [], isLoading: carregandoInsp } = useInspecoesConcluidas();
  // Filtro por unidade (26/10): recorta pela empresa da inspeção; a régua não muda.
  const unidade = useFiltroUnidadeDashboard();
  const rows = todas.filter((r) => unidade.naUnidade(r.id_empresa));
  const isLoading = carregandoInsp || unidade.carregando;
  const { data: tecnicosDeCampo = new Map(), isLoading: loadingTec } = useTecnicosDeCampo();
  const { data: contas = [] } = useContasDoPainel();
  const { data: reaberturas = [] } = useReaberturas("inspecao");
  // Nota para os SUPERVISORES (26/10): Admin ou nível Aprovação — a mesma regra de toda tela (ehSupervisor).
  const ehSupervisor = useIsSupervisor();
  const carregando = isLoading || loadingTec;

  const [mesSel, setMesSelBruto] = useState<string | null>(String(mesAbsAgoraSP()));
  const [pessoaSel, setPessoaSel] = useState<string | null>(null);
  const setMesSel: typeof setMesSelBruto = (v) => {
    setPessoaSel(null);
    setMesSelBruto(v);
  };

  const mesAtual = mesAbsAgoraSP();
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

  const opcoes = { tecnicosDeCampo, cadastro: contas.map((c) => c.nome), contas };
  const rowsMes = mesSel ? rows.filter((r) => String(mesDeConclusao(r)) === mesSel) : rows;
  const porPessoa = porTecnico(rowsMes, opcoes);
  const totalCopias = porPessoa.reduce((s, t) => s + t.copias, 0);
  const semRegistroRows = rowsMes.filter((r) => tecnicosCreditados(r, opcoes).semRegistro);

  const nomePorEmail = new Map(contas.map((c) => [c.email.toLowerCase(), c.nome]));
  const nomeDoEmail = (e: string | null) => (e ? nomePorEmail.get(e.toLowerCase()) ?? e : "—");
  const empresaPorId = new Map(rows.map((r) => [r.id_inspecao, nomeDaEmpresa(r.empresas)]));
  const idsRecorte = new Set(rowsMes.map((r) => r.id_inspecao));
  const reabRecorte = reaberturas.filter((r) => idsRecorte.has(r.id_inspecao));
  const reabertas = new Set(reaberturas.map((r) => r.id_inspecao));

  const listaPessoa = pessoaSel
    ? rowsMes
        .filter((r) => tecnicosCreditados(r, opcoes).nomes.includes(pessoaSel))
        .sort((a, b) => instanteDeConclusao(a).localeCompare(instanteDeConclusao(b)))
    : [];

  const estimadas = rowsMes.filter(conclusaoEhAproximada).length;
  const total = rows.filter((r) => mesDeConclusao(r) != null).length;

  const abrirPessoa = (d: { tecnico?: string; payload?: { tecnico?: string } }) => {
    const nome = d?.tecnico ?? d?.payload?.tecnico ?? null;
    if (!nome) return;
    setPessoaSel((atual) => (atual === nome ? null : nome));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
            <ArrowLeft className="size-4" /> Voltar ao dashboard
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
            <CheckCircle2 className="size-5 text-verde-primary" />
            Inspeções realizadas por TST
          </h1>
          <p className="text-sm text-gray-500">
            {carregando
              ? "Carregando…"
              : `${total} inspeç${total !== 1 ? "ões" : "ão"} concluída${total !== 1 ? "s" : ""} no total · cada uma conta para o técnico que foi a campo, no mês da 1ª conclusão`}
            {unidade.nomeUnidade ? ` · unidade ${unidade.nomeUnidade}` : ""}
          </p>
        </div>
        <FiltroUnidade idUnidade={unidade.idUnidade} unidades={unidade.unidades} onChange={unidade.setIdUnidade} />
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
        {carregando ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes} barSize={26} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Realizadas" />} />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(d: { chave?: string; payload?: { chave?: string } }) => {
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

      {/* Por técnico */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Por técnico {mesSelLabel ? `— ${mesSelLabel}` : "— acumulado de todos os meses"}
              </h2>
              <p className="text-xs text-gray-400">
                {mesSelLabel ? "Cada inspeção conta para o técnico que foi a campo" : "Soma de todos os meses — não é a produção de um mês"}
                {totalCopias > 0 && <> · {totalCopias} cópia(s)/revisão(ões) no recorte</>}
                {" · clique no nome para ver as empresas"}
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
        <div className="mb-3 space-y-2">
          {!carregando && estimadas > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>{estimadas}</strong> {estimadas !== 1 ? "destas conclusões têm" : "desta conclusão tem"} data <strong>estimada</strong>: o
              painel só passou a registrar o momento da finalização em 04/08/2026.
            </div>
          )}
          {!carregando && (
            <ReaberturasAviso
              reaberturas={reabRecorte}
              nomeDoEmail={nomeDoEmail}
              empresaDe={(id) => empresaPorId.get(id) ?? id}
              titulo={reabRecorte.length !== 1 ? "inspeções foram reabertas depois de concluídas" : "inspeção foi reaberta depois de concluída"}
            />
          )}
          {!carregando && semRegistroRows.length > 0 &&
            (ehSupervisor ? (
              <NotaSemTecnico inspecoes={semRegistroRows} contas={contas} />
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <strong>{semRegistroRows.length}</strong> {semRegistroRows.length !== 1 ? "inspeções não têm" : "inspeção não tem"} técnico na aba
                Responsáveis e {semRegistroRows.length !== 1 ? "contam" : "conta"} para quem abriu (sem registro). Um supervisor pode definir o técnico.
              </div>
            ))}
        </div>
        {carregando ? (
          <LoadingSkeleton rows={4} />
        ) : porPessoa.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma inspeção concluída{mesSelLabel ? ` em ${mesSelLabel}` : ""}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porPessoa.length * 38)}>
            <BarChart data={porPessoa} layout="vertical" barSize={22} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="tecnico"
                axisLine={false}
                tickLine={false}
                width={150}
                tick={(p: object) => <TickPessoa {...p} fonte="inspecoes" naoClicaveis={["Sem responsável"]} />}
              />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BlocoPessoa />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="novas" name="Visitas novas" stackId="t" fill="#0ea5e9" cursor="pointer" onClick={abrirPessoa}>
                <LabelList
                  valueAccessor={(e) => ((e.payload as TecnicoInspecoes).copias > 0 ? null : (e.payload as TecnicoInspecoes).total)}
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
        {!carregando && porPessoa.length > 0 && !pessoaSel && (
          <p className="mt-2 text-xs text-gray-400">Clique na barra para ver as inspeções aqui; no nome, para ver as empresas em todos os meses.</p>
        )}
      </div>

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
                  <th className="py-2 pr-3 font-medium">1ª conclusão</th>
                  <th className="py-2 pr-3 font-medium">Concluída por</th>
                  <th className="py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {listaPessoa.map((i) => (
                  <tr key={i.id_inspecao} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/inspecoes/${i.id_inspecao}`} className="text-gray-800 hover:text-verde-primary hover:underline">
                        {nomeDaEmpresa(i.empresas)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{dataBR(i.data_inspecao)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{instanteBR(instanteDeConclusao(i))}</td>
                    <td className="py-2 pr-3 text-gray-600">{nomeDoEmail(i.primeira_conclusao_por ?? i.concluida_por_email ?? null)}</td>
                    <td className="py-2 text-xs text-gray-500">
                      {observacao(i, tecnicosCreditados(i, opcoes).semRegistro)}
                      {reabertas.has(i.id_inspecao) && (
                        <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          <RotateCcw className="size-3" /> reaberta
                        </span>
                      )}
                    </td>
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

function dataBR(d: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

function instanteBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function observacao(i: InspecaoConcluida, semRegistro: boolean): string {
  const partes = [ehCopiaOuRevisao(i.tipo_criacao) ? "Cópia/revisão" : "Visita nova"];
  if (semRegistro) partes.push("sem técnico registrado (conta para quem abriu)");
  return partes.join(" · ");
}
