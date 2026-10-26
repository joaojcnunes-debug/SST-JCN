"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileSignature, Layers, TrendingUp, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { mesAbsSP, mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import {
  acumuladoPorPessoa,
  empresasAssociadasPorMes,
  empresasPorPessoa,
  eventosDeAssociacao,
  semDataDeAssociacao,
  type PessoaEmpresas,
} from "@/lib/dashboard/associacoes-empresas";
import { useAssociacoesEmpresas } from "@/lib/hooks/useDashboardFontes";
import { corAvatar } from "@/lib/hooks/useGestao";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { BalaoUmValor } from "@/components/ui/BalaoGrafico";
import TickPessoa from "@/components/dashboard/TickPessoa";

/**
 * Documentos associados — em EMPRESAS por pessoa, mês a mês (pedido de 26/10/2026).
 *
 * ⚠️ Trabalho de ESCRITÓRIO (quem montou o documento depois da visita), não inspeção de campo.
 *
 *  - "Por pessoa": quantas empresas foram associadas à pessoa NO mês — tanto faz se ela mesma se
 *    associou ou se outra pessoa a associou. Duas empresas iguais no mês contam 1. Sem acumular.
 *  - "Por pessoa — acumulado": a soma dos meses até o mês escolhido.
 *  - Documento assumido pelo botão "Assumir elaboração" (sem linha de associação) entra no mês em que
 *    foi assumido — data da auditoria (v295; só existe a partir de quando a auditoria foi ligada).
 *  - Até 25/10 contava DOCUMENTOS, creditados a quem estava com o documento agora.
 *
 * A conta mora em lib/dashboard/associacoes-empresas (testada).
 */
export default function PorAssociadosDashboard() {
  const { data, isLoading } = useAssociacoesEmpresas();
  const eventos = data ? eventosDeAssociacao(data.assoc, data.assuncoes, data.docs, mesAbsSP) : [];

  const [mesSel, setMesSel] = useState<number | null>(mesAbsAgoraSP());
  const mesAtual = mesAbsAgoraSP();

  const porMes = empresasAssociadasPorMes(eventos, mesAtual, 12).map((m) => ({ ...m, mes: rotuloMesAbs(m.chave, true) }));
  const mesSelLabel = mesSel != null ? porMes.find((m) => m.chave === mesSel)?.mes ?? null : null;
  const porPessoa = empresasPorPessoa(eventos, mesSel);
  const acumulado = acumuladoPorPessoa(eventos, mesSel ?? mesAtual);
  const semData = data ? semDataDeAssociacao(data.docs, eventos) : 0;
  const empresasTotal = new Set(eventos.map((e) => e.id_empresa)).size;

  const grafico = (dados: PessoaEmpresas[], rotulo: string) => (
    <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 38)}>
      <BarChart data={dados} layout="vertical" barSize={22} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="pessoa"
          axisLine={false}
          tickLine={false}
          width={150}
          tick={(p: object) => <TickPessoa {...p} fonte="associados" />}
        />
        <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo={rotulo} />} />
        <Bar dataKey="total" radius={[0, 6, 6, 0]}>
          {dados.map((p) => (
            <Cell key={p.pessoa} fill={corAvatar(p.pessoa)} />
          ))}
          <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "var(--text-strong)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <FileSignature className="size-5 text-verde-primary" />
          Documentos Associados (empresas por pessoa)
        </h1>
        <p className="text-sm text-gray-500">
          {isLoading ? "Carregando…" : `${empresasTotal} empresa${empresasTotal !== 1 ? "s" : ""} com documento associado, no total`}
        </p>
        <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Isto é <strong>trabalho de escritório</strong>: quem montou o documento depois da visita. Não é inspeção de campo — para
          saber quem foi à visita, veja{" "}
          <Link href="/dashboard/inspecoes-concluidas" className="font-semibold underline">
            Inspeções realizadas por TST
          </Link>
          .
        </p>
      </div>

      {/* Por mês */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Por mês (últimos 12 meses)</h2>
              <p className="text-xs text-gray-400">Empresas associadas no mês (soma das pessoas, sem acumular)</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">Clique num mês para filtrar abaixo</p>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes} barSize={26} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Empresas" />} />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(d: { chave?: number; payload?: { chave?: number } }) => {
                  const k = d?.chave ?? d?.payload?.chave ?? null;
                  if (k == null) return;
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
        {!isLoading && semData > 0 && (
          <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>{semData}</strong> documento{semData !== 1 ? "s têm" : " tem"} responsável de elaboração sem data de entrada (assumido
            antes de a auditoria começar, e sem registro de associação) — {semData !== 1 ? "não entram" : "não entra"} em
            mês nenhum.
          </p>
        )}
      </div>

      {/* Por pessoa — no mês */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSignature className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Por pessoa {mesSelLabel ? `— ${mesSelLabel}` : "— todos os meses"}</h2>
              <p className="text-xs text-gray-400">
                {mesSelLabel
                  ? "Empresas associadas a cada pessoa neste mês (por ela ou por outra pessoa), sem acumular"
                  : "Soma dos meses — não é a produção de um mês"}
                {" · clique no nome para ver as empresas"}
              </p>
            </div>
          </div>
          {mesSel != null ? (
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
              onClick={() => setMesSel(mesAbsAgoraSP())}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="size-3" /> Voltar ao mês atual
            </button>
          )}
        </div>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : porPessoa.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma empresa associada{mesSelLabel ? ` em ${mesSelLabel}` : ""}.</p>
        ) : (
          grafico(porPessoa, "Empresas")
        )}
      </div>

      {/* Por pessoa — acumulado */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="size-4 text-verde-primary" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Por pessoa — acumulado até {rotuloMesAbs(mesSel ?? mesAtual, true)}
            </h2>
            <p className="text-xs text-gray-400">
              Soma, mês a mês, das empresas associadas a cada pessoa até o mês escolhido no gráfico de cima
            </p>
          </div>
        </div>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : acumulado.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma empresa associada até aqui.</p>
        ) : (
          grafico(acumulado, "Empresas (acumulado)")
        )}
      </div>

      <div className="flex justify-end">
        <Link
          href="/dashboard/inspecoes-concluidas"
          className="inline-flex items-center gap-1.5 rounded-lg bg-verde-light px-3 py-2 text-xs font-semibold text-verde-primary transition-colors hover:bg-verde-primary hover:text-white"
        >
          Ver produção de campo (inspeções realizadas por TST)
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
