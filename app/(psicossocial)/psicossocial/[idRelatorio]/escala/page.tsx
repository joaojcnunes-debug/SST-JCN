"use client";

import { useMemo, useState, use } from "react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import { useDrpsRespondentes } from "@/lib/hooks/useDrps";
import {
  calcularResumoCompleto,
  filtrarPorSetor,
} from "@/lib/drps/calculos";

export default function EscalaPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor = useDrpsStore((s) => s.setor);
  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const [topicoFiltro, setTopicoFiltro] = useState<number | "todos">("todos");

  const filtrados = useMemo(
    () => filtrarPorSetor(respondentes, setor),
    [respondentes, setor]
  );

  const topicosCalc = useMemo(
    () => calcularResumoCompleto(filtrados),
    [filtrados]
  );

  const linhas = useMemo(() => {
    const result: Array<{
      n: number;
      topicoIdx: number;
      topicoNome: string;
      texto: string;
      logica: string;
      mediaBruta: number;
      corrigida: number;
      gravidade: { texto: string; cor: string };
    }> = [];
    let n = 1;
    for (const t of topicosCalc) {
      if (topicoFiltro !== "todos" && t.idx !== topicoFiltro) {
        n += t.perguntas.length;
        continue;
      }
      for (const p of t.perguntas) {
        result.push({
          n,
          topicoIdx: t.idx,
          topicoNome: t.nome.replace(/^Tópico \d+ - /, ""),
          texto: p.texto,
          logica: p.logica,
          mediaBruta: p.mediaBruta,
          corrigida: p.pontuacaoCorrigida,
          gravidade: p.gravidade,
        });
        n++;
      }
    }
    return result;
  }, [topicosCalc, topicoFiltro]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Escala — Detalhe das Perguntas
        </h1>
        <p className="text-sm text-gray-600">
          Cada pergunta com média bruta, pontuação corrigida (após ROUNDUP
          e inversão se aplicável) e gravidade individual. Escala 0–4:{" "}
          <strong>0</strong> Nunca · <strong>1</strong> Raramente ·{" "}
          <strong>2</strong> Ocasionalmente · <strong>3</strong>{" "}
          Frequentemente · <strong>4</strong> Sempre.
        </p>
      </div>

      <DrpsFiltro idRelatorio={idRelatorio} />

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado neste relatório.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Filtrar tópico:
            </label>
            <select
              value={topicoFiltro}
              onChange={(e) =>
                setTopicoFiltro(
                  e.target.value === "todos" ? "todos" : Number(e.target.value)
                )
              }
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              <option value="todos">
                Todos os tópicos ({topicosCalc.length})
              </option>
              {topicosCalc.map((t) => (
                <option key={t.idx} value={t.idx}>
                  {t.idx + 1}. {t.nome.replace(/^Tópico \d+ - /, "")}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {linhas.length} pergunta(s) · {filtrados.length} respondente(s)
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-12">#</th>
                    <th className="px-3 py-2 text-left font-medium">Tópico</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Pergunta
                    </th>
                    <th className="px-3 py-2 text-center font-medium w-20">
                      Lógica
                    </th>
                    <th className="px-3 py-2 text-center font-medium w-20">
                      Média Bruta
                    </th>
                    <th className="px-3 py-2 text-center font-medium w-20">
                      Corrigida
                    </th>
                    <th className="px-3 py-2 text-center font-medium w-24">
                      Gravidade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhas.map((l) => (
                    <tr key={l.n} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 font-mono">
                        {l.n}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {l.topicoIdx + 1}. {l.topicoNome}
                      </td>
                      <td className="px-3 py-2 text-gray-800">{l.texto}</td>
                      <td className="px-3 py-2 text-center text-[10px] uppercase text-gray-500">
                        {l.logica}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-gray-700">
                        {l.mediaBruta.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-gray-700">
                        {l.corrigida}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: l.gravidade.cor }}
                        >
                          {l.gravidade.texto}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
