"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Hourglass, Layers, TrendingUp, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import FiltroUnidade from "@/components/dashboard/FiltroUnidade";
import { corAvatar } from "@/lib/hooks/useGestao";
import { useAgora, useTempoDocumentos } from "@/lib/hooks/useDocumentoSessoes";
import { useFiltroUnidadeDashboard } from "@/lib/hooks/useFiltroUnidadeDashboard";
import { useIsSupervisor } from "@/lib/hooks/useUsuario";
import { mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import {
  agruparPorDoc,
  documentosParados,
  horasPorMes,
  horasPorPessoa,
  mediasPorComplexidade,
  trabalhandoAgora,
} from "@/lib/dashboard/tempo-documentos";
import { COMPLEXIDADES_DESC, COMPLEXIDADE_INFO, type ComplexidadeInspecao } from "@/lib/inspecoes/complexidade";
import { fmtDuracao } from "@/lib/inspecoes/sessoes";
import { cn } from "@/lib/utils";

/**
 * Dashboard › Tempo nos documentos (v0.3.183, 30/10/2026) — fase 3 do apontamento de tempo (v311).
 *
 * ⚠️ Trabalho de ESCRITÓRIO (documento), não inspeção de campo. Só supervisão.
 *  - Por mês: horas apontadas (a sessão entra no mês em que começou).
 *  - Por pessoa: horas no mês escolhido (clique no mês) e em quantos documentos.
 *  - Por complexidade: média dos documentos ENTREGUES com sessão — trabalhado, aguardando cliente
 *    (fora do trabalhado) e calendário (do primeiro início à conclusão). Base para prever prazo.
 *  - Agora: quem está com o cronômetro correndo; parados: em elaboração sem ninguém há 3+ dias.
 * As contas moram em lib/dashboard/tempo-documentos (testadas).
 */
const horas = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;

export default function TempoDocumentosPage() {
  const supervisor = useIsSupervisor();
  const { data, isLoading: carregandoDados } = useTempoDocumentos(12);
  const unidade = useFiltroUnidadeDashboard();
  const agora = useAgora(60_000);
  const mesAtual = mesAbsAgoraSP();
  const [mesSel, setMesSel] = useState<number | null>(mesAtual);
  const isLoading = carregandoDados || unidade.carregando;

  const { docs, sessoes, porDoc } = useMemo(() => {
    const docsU = (data?.docs ?? []).filter((d) => unidade.naUnidade(d.id_empresa));
    const ids = new Set(docsU.map((d) => d.id_inspecao));
    const sess = (data?.sessoes ?? []).filter((s) => ids.has(s.id_inspecao));
    return { docs: docsU, sessoes: sess, porDoc: agruparPorDoc(sess) };
  }, [data, unidade]);
  const docPorId = useMemo(() => new Map(docs.map((d) => [d.id_inspecao, d])), [docs]);

  const porMes = horasPorMes(sessoes, mesAtual, 12, agora).map((m) => ({ ...m, mes: rotuloMesAbs(m.chave, true), horas: horas(m.ms) }));
  const porPessoa = horasPorPessoa(sessoes, mesSel, agora).map((p) => ({ ...p, horas: horas(p.ms) }));
  const medias = mediasPorComplexidade(docs, porDoc, agora).sort(
    (a, b) => COMPLEXIDADES_DESC.indexOf(a.complexidade as ComplexidadeInspecao) - COMPLEXIDADES_DESC.indexOf(b.complexidade as ComplexidadeInspecao),
  );
  const agoraCorrendo = trabalhandoAgora(sessoes, agora);
  const parados = documentosParados(docs, porDoc, agora, 3);
  const mesSelLabel = mesSel != null ? rotuloMesAbs(mesSel, true) : null;

  if (!supervisor) {
    return <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Esta página é da supervisão.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
            <ArrowLeft className="size-4" /> Voltar ao dashboard
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
            <Clock className="size-5 text-verde-primary" /> Tempo nos documentos
          </h1>
          <p className="text-sm text-gray-500">
            Horas apontadas pelos associados (Iniciar/Pausar) nos documentos{unidade.nomeUnidade ? ` · unidade ${unidade.nomeUnidade}` : ""}.
            &quot;Aguardando cliente&quot; fica fora do tempo trabalhado.
          </p>
        </div>
        <FiltroUnidade idUnidade={unidade.idUnidade} unidades={unidade.unidades} onChange={unidade.setIdUnidade} />
      </div>

      {/* Agora e parados */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Trabalhando agora ({agoraCorrendo.length})
          </h2>
          {isLoading ? (
            <LoadingSkeleton rows={2} />
          ) : agoraCorrendo.length === 0 ? (
            <p className="text-xs text-gray-400">Ninguém com o cronômetro correndo.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {agoraCorrendo.map((s) => (
                <li key={s.id_sessao} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <b className="text-gray-800">{s.nome}</b> · {docPorId.get(s.id_inspecao)?.empresa ?? s.id_inspecao}
                  </span>
                  <Link href={`/inspecoes/${s.id_inspecao}/relatorio`} className="shrink-0 text-xs font-medium text-emerald-700 hover:underline">
                    há {fmtDuracao(agora - new Date(s.inicio).getTime())}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Hourglass className="size-4 text-amber-600" /> Em elaboração, parados há 3 dias ou mais ({parados.length})
          </h2>
          {isLoading ? (
            <LoadingSkeleton rows={2} />
          ) : parados.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum documento parado.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {parados.slice(0, 12).map((p) => (
                <li key={p.doc.id_inspecao} className="flex items-center justify-between gap-2">
                  <Link href={`/inspecoes/${p.doc.id_inspecao}/relatorio`} className="min-w-0 truncate text-gray-800 hover:text-verde-primary hover:underline">
                    {p.doc.empresa}
                  </Link>
                  <span className={cn("shrink-0 text-xs", p.aguardandoCliente ? "text-amber-700" : "text-gray-500")}>
                    {p.aguardandoCliente ? "aguardando cliente · " : ""}há {p.diasParado} dias
                  </span>
                </li>
              ))}
              {parados.length > 12 && <li className="text-xs text-gray-400">e mais {parados.length - 12}.</li>}
            </ul>
          )}
        </div>
      </div>

      {/* Por mês */}
      <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Horas apontadas por mês (últimos 12)</h2>
              <p className="text-xs text-gray-400">A sessão entra no mês em que começou</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">Clique num mês para ver as pessoas abaixo</p>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes} barSize={26} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} formatter={(v) => [`${v} h`, "Horas"]} />
              <Bar
                dataKey="horas"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(d: { chave?: number; payload?: { chave?: number } }) => {
                  const k = d?.chave ?? d?.payload?.chave ?? null;
                  if (k != null) setMesSel((atual) => (atual === k ? null : k));
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

      {/* Por pessoa */}
      <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Users className="size-4 text-verde-primary" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Por pessoa {mesSelLabel ? `— ${mesSelLabel}` : "— todos os meses"}</h2>
            <p className="text-xs text-gray-400">Horas apontadas e em quantos documentos</p>
          </div>
        </div>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : porPessoa.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma hora apontada{mesSelLabel ? ` em ${mesSelLabel}` : ""}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porPessoa.length * 38)}>
            <BarChart data={porPessoa} layout="vertical" barSize={22} margin={{ top: 4, right: 90, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="pessoa" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 12, fill: "var(--text-strong)" }} />
              <Tooltip
                cursor={{ fill: "var(--grafico-cursor)" }}
                formatter={(v, _n, item) => [`${v} h em ${(item?.payload as { documentos?: number } | undefined)?.documentos ?? 0} documento(s)`, "Horas"]}
              />
              <Bar dataKey="horas" radius={[0, 6, 6, 0]}>
                {porPessoa.map((p) => (
                  <Cell key={p.pessoa} fill={corAvatar(p.pessoa)} />
                ))}
                <LabelList
                  dataKey="ms"
                  position="right"
                  formatter={(v) => fmtDuracao(Number(v))}
                  style={{ fontSize: 12, fontWeight: 700, fill: "var(--text-strong)" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Por complexidade */}
      <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="size-4 text-verde-primary" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Tempo médio por complexidade (documentos entregues)</h2>
            <p className="text-xs text-gray-400">Base para prever o prazo de um documento novo</p>
          </div>
        </div>
        {isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : medias.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">Ainda não há documento entregue com tempo apontado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-2">Complexidade</th>
                  <th className="px-3 py-2 text-right">Documentos</th>
                  <th className="px-3 py-2 text-right">Trabalhado (média)</th>
                  <th className="px-3 py-2 text-right">Aguardando cliente (média)</th>
                  <th className="px-3 py-2 text-right">Do início à entrega (média)</th>
                </tr>
              </thead>
              <tbody>
                {medias.map((m) => {
                  const info = m.complexidade ? COMPLEXIDADE_INFO[m.complexidade as ComplexidadeInspecao] : null;
                  return (
                    <tr key={m.complexidade ?? "sem"} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2">
                        {info ? (
                          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", info.classe)}>{info.label}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Sem complexidade</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.documentos}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtDuracao(m.trabalhadoMs)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700">{m.aguardandoClienteMs > 0 ? fmtDuracao(m.aguardandoClienteMs) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtDuracao(m.calendarioMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
