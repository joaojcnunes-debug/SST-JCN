"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FileSignature, TrendingUp, X } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { mesAbsSP, mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import {
  porAssociado as agruparPorAssociado,
  resumoAssociacao,
  serieMensalAssociacoes,
  type AssociacaoDoc,
  type DocumentoContavel,
} from "@/lib/dashboard/documentos";
import { corAvatar } from "@/lib/hooks/useGestao";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { BalaoUmValor } from "@/components/ui/BalaoGrafico";

/**
 * Detalhe da elaboração do documento (SGG) por pessoa.
 *
 * ⚠️ Esta tela NÃO mede inspeção de campo — mede quem montou o documento
 * depois da visita. Até 27/08/2026 ela se chamava "Inspeções Associadas" e o
 * número saía com a palavra "inspeções", o que fez a primeira colocada (uma
 * Auxiliar Administrativo, com zero visitas) ser lida como a técnica que mais
 * trabalhou. A conta está em `lib/dashboard/documentos`, junto com o donut do
 * dashboard que fazia a mesma pergunta e respondia outro número.
 *
 * ─── 15/09: UM número só ────────────────────────────────────────────────────
 *
 * De 27/08 a 15/09 a barra media ENTREGUES e o balão abria quatro números
 * (entregues, está elaborando, voltou para a fila, passou pelas mãos dela).
 * Ele pediu: "apenas quantos documentos o usuário foi associado" — e que o
 * donut do dashboard bata com esta tela. Agora:
 *
 *  - barra e balão = `total` (documentos associados à pessoa, regras 1 e 2 da
 *    régua: conta para quem está com o documento AGORA);
 *  - o gráfico mensal conta documentos que ganharam associado no mês;
 *  - abre no MÊS CORRENTE, o mesmo recorte do donut do dashboard (decisão
 *    dele em 15/09, mantendo a lição de 27/08: acumulado lido como produção
 *    do mês). O acumulado fica a um clique.
 */

async function fetchDados(): Promise<{ assoc: AssociacaoDoc[]; docs: DocumentoContavel[] }> {
  const supabase = createSupabaseBrowserClient();
  const [assoc, docs] = await Promise.all([
    fetchAllRows<AssociacaoDoc>((de, ate) =>
      supabase
        .from("inspecao_associados")
        .select("created_at, nome, id_inspecao")
        .range(de, ate),
    ),
    fetchAllRows<DocumentoContavel>((de, ate) =>
      supabase
        .from("inspecoes")
        .select("id_inspecao, status, elaboracao_responsavel, elaboracao_status")
        .neq("status", "DELETADA")
        .range(de, ate),
    ),
  ]);
  return { assoc, docs };
}

export default function PorAssociadosDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-por-associados"],
    queryFn: fetchDados,
  });
  const assoc = data?.assoc ?? [];
  const docs = data?.docs ?? [];

  // Mês corrente por padrão — mesma razão da tela de documentos emitidos:
  // aberta no acumulado, a barra soma meses e é lida como produção do mês.
  const [mesSel, setMesSel] = useState<number | null>(mesAbsAgoraSP());
  const mesAtual = mesAbsAgoraSP();

  const porMes = serieMensalAssociacoes(
    assoc,
    docs,
    mesAtual,
    12,
    (abs) => rotuloMesAbs(abs, true),
    mesAbsSP,
  );
  const mesSelLabel = mesSel != null ? porMes.find((m) => m.chave === mesSel)?.mes ?? null : null;

  const porAssociado = agruparPorAssociado(assoc, docs, { mes: mesSel, mesDe: mesAbsSP });
  const credito = resumoAssociacao(assoc, docs);
  // Documentos distintos com alguém trabalhando neles (associado ou responsável).
  const totalDocumentos = credito.comAssociacao + credito.semAssociacao;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <FileSignature className="size-5 text-verde-primary" />
          Documentos por Associado (elaboração no SGG)
        </h1>
        <p className="text-sm text-gray-500">
          {isLoading
            ? "Carregando…"
            : `${totalDocumentos} documento${totalDocumentos !== 1 ? "s" : ""} com associado, no total`}
        </p>
        {/* O aviso é o remédio da confusão que originou esta tela: quem lia
            "inspeções" achava que era ranking de técnico de campo. */}
        {/* text-sky-800, não 900: a camada noturna de globals.css cobre até o
            800 — no 900 o texto fica escuro sobre fundo escuro. */}
        <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Isto é <strong>trabalho de escritório</strong>: quem montou o documento depois da visita.
          Não é inspeção de campo — para saber quem foi à visita, veja{" "}
          <Link href="/dashboard/inspecoes-concluidas" className="font-semibold underline">
            Inspeções Concluídas
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
              <p className="text-xs text-gray-400">
                Documentos que ganharam associado em cada mês
              </p>
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
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Documentos" />} />
              {/* Documentos que entraram na fila no mês — o mesmo `total` do card
                  "Documentos Associados por Mês" do dashboard. */}
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
      </div>

      {/* Por associado */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSignature className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Por pessoa {mesSelLabel ? `— ${mesSelLabel}` : "— acumulado de todos os meses"}
              </h2>
              <p className="text-xs text-gray-400">
                {mesSelLabel
                  ? "Quantos documentos cada pessoa foi associada neste mês"
                  : "Soma de todos os meses — não é a produção de um mês"}
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

        {/* Os documentos sem linha de associação não têm data de entrada: contam
            no total e somem do recorte por mês. Dizer isso evita a pergunta
            "por que a soma dos meses não fecha com o total?". */}
        {!isLoading && credito.semAssociacao > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>{credito.semAssociacao}</strong> documento
            {credito.semAssociacao !== 1 ? "s têm" : " tem"} responsável de elaboração sem
            registro de associação
            {mesSel != null ? (
              <> — {credito.semAssociacao !== 1 ? "eles não aparecem" : "ele não aparece"} neste mês, só no total.</>
            ) : (
              <> — {credito.semAssociacao !== 1 ? "contam" : "conta"} no total, mas sem data de entrada não {credito.semAssociacao !== 1 ? "entram" : "entra"} no recorte por mês.</>
            )}
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : porAssociado.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhum documento{mesSelLabel ? ` em ${mesSelLabel}` : ""}.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porAssociado.length * 38)}>
            <BarChart data={porAssociado} layout="vertical" barSize={22} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={150} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Documentos" />} />
              {/* A barra mede o TOTAL de documentos associados (15/09). Até
                  então media entregues, com o resto no balão. */}
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {porAssociado.map((p) => (
                  <Cell key={p.nome} fill={corAvatar(p.nome)} />
                ))}
                <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "var(--text-strong)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex justify-end">
        <Link
          href="/dashboard/inspecoes-concluidas"
          className="inline-flex items-center gap-1.5 rounded-lg bg-verde-light px-3 py-2 text-xs font-semibold text-verde-primary transition-colors hover:bg-verde-primary hover:text-white"
        >
          Ver produção de campo (inspeções concluídas)
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
