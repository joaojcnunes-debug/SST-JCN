"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useEscalaSupervisores, useUnidadesDaEscala } from "@/lib/hooks/useEscalaCadastro";
import { useEscalaDiasDoPeriodo } from "@/lib/hooks/useEscalaRelatorio";
import {
  porMes,
  porSituacao,
  porUnidadeESupervisor,
  rotuloSupervisor,
  supervisoresDoRelatorio,
  type Matriz,
} from "@/lib/escala/relatorios";
import { baixarXlsxDaEscala } from "@/lib/escala/exportar-xlsx";
import { MESES_PT, rotuloMes } from "@/lib/escala/datas";
import type { EscalaSupervisor } from "@/lib/escala/tipos";

/**
 * Relatórios (Fase 7) — a aba "Resumo Anual" da planilha.
 *
 * Dois períodos: o ano inteiro ou um mês. A planilha só tinha o ano; o mês
 * entrou porque é a pergunta que se faz no fim de cada mês, e recortar 12 abas
 * à mão para respondê-la era exatamente o trabalho que este módulo veio tirar.
 *
 * ⚠️ Os dois relatórios têm totais DIFERENTES de propósito, e a tela diz isso
 * em vez de deixar a pessoa achar que um deles está errado:
 *  - "por unidade" conta **dias-unidade** — um dia em duas unidades conta duas
 *    vezes, como a própria planilha declara;
 *  - "por mês" conta o **dia**, uma vez, com unidade ou sem.
 */

export default function Relatorios() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState<number | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // TODOS, não só os ativos: quem saiu no meio do ano trabalhou, e o
  // relatório é histórico. `supervisoresDoRelatorio` corta os inativos que
  // não têm dia nenhum no período.
  const { data: todosSupervisores = [], isLoading: carSup } = useEscalaSupervisores(false);
  const { data: unidades = [] } = useUnidadesDaEscala(true);

  // Uma consulta só, com o intervalo do período escolhido — ano ou mês.
  const { data: dias = [], isLoading: carregando } = useEscalaDiasDoPeriodo(ano, mes);

  const supervisores = useMemo(
    () => supervisoresDoRelatorio(todosSupervisores, dias),
    [todosSupervisores, dias]
  );

  const entrada = useMemo(
    () => ({ supervisores, unidades, dias }),
    [supervisores, unidades, dias]
  );

  const matrizUnidades = useMemo(() => porUnidadeESupervisor(entrada), [entrada]);
  const matrizMeses = useMemo(() => porMes({ ...entrada, ano }), [entrada, ano]);
  const situacoes = useMemo(() => porSituacao(entrada), [entrada]);

  const periodo = mes === null ? String(ano) : rotuloMes(ano, mes);

  async function baixarPdf() {
    setGerandoPdf(true);
    try {
      const url = `/api/pdf/escala-resumo?ano=${ano}${mes !== null ? `&mes=${mes}` : ""}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => null);
        throw new Error(corpo?.error ?? `O servidor respondeu ${resp.status}`);
      }
      const blob = await resp.blob();
      // Abre numa aba, como os outros PDFs do painel — quem quer arquivo salva
      // do próprio visualizador.
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o PDF");
    } finally {
      setGerandoPdf(false);
    }
  }

  function baixarXlsx() {
    baixarXlsxDaEscala({
      periodo,
      supervisores,
      unidades: matrizUnidades,
      meses: matrizMeses,
      situacoes,
    });
  }

  if (carSup) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  const semEquipe = supervisores.length === 0;

  return (
    <div className="space-y-5">
      {/* ── Período e exportação ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAno((a) => a - 1)}
              className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
              aria-label="Ano anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="w-16 text-center text-lg font-bold tabular-nums text-gray-900">
              {ano}
            </span>
            <button
              type="button"
              onClick={() => setAno((a) => a + 1)}
              className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
              aria-label="Próximo ano"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <select
            value={mes ?? ""}
            onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">O ano inteiro</option>
            {MESES_PT.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={baixarXlsx}
            disabled={semEquipe}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={baixarPdf}
            disabled={semEquipe || gerandoPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-50"
          >
            {gerandoPdf ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            PDF
          </button>
        </div>
      </div>

      {semEquipe ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          Nenhum supervisor ativo — não há o que consolidar.
        </div>
      ) : carregando ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" />
          Consolidando {periodo}...
        </div>
      ) : (
        <>
          <TabelaMatriz
            titulo="Dias por unidade"
            nota="Um dia em mais de uma unidade conta em cada uma delas — por isso o total daqui pode passar do número de dias do período."
            primeiraColuna="Unidade"
            matriz={matrizUnidades}
            supervisores={supervisores}
          />

          {mes === null && (
            <TabelaMatriz
              titulo="Dias com escala definida, por mês"
              nota="Conta o dia uma vez, com unidade ou situação — menos o feriado, que a planilha também não contava."
              primeiraColuna="Mês"
              matriz={matrizMeses}
              supervisores={supervisores}
            />
          )}

          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dias fora de unidade</h2>
            {situacoes.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                Nenhum dia fora de unidade em {periodo}.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {situacoes.map((s) => (
                  <span
                    key={s.situacao}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs"
                  >
                    <span className="text-gray-600">{s.situacao}</span>
                    <span className="font-semibold tabular-nums text-gray-900">{s.dias}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── A matriz ───────────────────────────────────────────────────────────────

function TabelaMatriz({
  titulo,
  nota,
  primeiraColuna,
  matriz,
  supervisores,
}: {
  titulo: string;
  nota: string;
  primeiraColuna: string;
  matriz: Matriz;
  supervisores: EscalaSupervisor[];
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
      <p className="mb-2 text-xs text-gray-500">{nota}</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">{primeiraColuna}</th>
              {supervisores.map((s) => (
                <th key={s.id_supervisor} className="px-3 py-2 text-right">
                  {rotuloSupervisor(s)}
                  {!s.ativo && (
                    <span className="block text-[10px] font-normal text-gray-400">
                      saiu da equipe
                    </span>
                  )}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matriz.linhas.map((l) => (
              <tr key={l.chave}>
                <td className="px-3 py-1.5 font-medium capitalize text-gray-900">{l.rotulo}</td>
                {supervisores.map((s) => {
                  const v = l.porSupervisor[s.id_supervisor] ?? 0;
                  return (
                    <td
                      key={s.id_supervisor}
                      className={cn(
                        "px-3 py-1.5 text-right tabular-nums",
                        v === 0 ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      {v}
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900">
                  {l.total}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[#0891B2] bg-gray-50">
            <tr>
              <td className="px-3 py-2 text-sm font-bold text-gray-900">Total geral</td>
              {supervisores.map((s) => (
                <td
                  key={s.id_supervisor}
                  className="px-3 py-2 text-right font-bold tabular-nums text-gray-900"
                >
                  {matriz.totalPorSupervisor[s.id_supervisor] ?? 0}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900">
                {matriz.totalGeral}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
