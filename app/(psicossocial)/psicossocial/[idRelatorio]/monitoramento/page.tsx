"use client";

import { useMemo, use } from "react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsMonitoramento,
  useDrpsProbabilidades,
  useDrpsRelatorio,
  useDrpsRespondentes,
  useDrpsSalvarMonitoramento,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  CORES_MATRIZ,
  filtrarPorSetor,
} from "@/lib/drps/calculos";
import { TOPICOS } from "@/lib/drps/topicos";
import type { NivelMatriz, StatusMonitoramento } from "@/lib/drps/types";

const STATUS: StatusMonitoramento[] = [
  "Pendente",
  "Em Andamento",
  "Concluido",
  "Cancelado",
];

const RECOMENDACOES: Record<NivelMatriz, { titulo: string; texto: string }> = {
  Baixo: {
    titulo: "🟢 Risco Baixo",
    texto:
      "Implementar programas prevencionistas. Monitoramento trimestral. Reavaliação em até 12 meses.",
  },
  Médio: {
    titulo: "🟡 Risco Moderado",
    texto:
      "Implementar programas prevencionistas com reforço. Monitoramento bimestral. Reavaliação em até 9 meses.",
  },
  Alto: {
    titulo: "🔴 Risco Alto",
    texto:
      "Implementar programas interventivos urgentes. Monitoramento mensal. Reavaliação em até 6 meses.",
  },
  Crítico: {
    titulo: "⚫ Risco Crítico",
    texto:
      "Programas interventivos imediatos + reavaliação do DRPS em 90 dias.",
  },
};

export default function MonitoramentoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor = useDrpsStore((s) => s.setor);
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);
  const { data: monitoramentos = [] } = useDrpsMonitoramento(idRelatorio);
  const salvar = useDrpsSalvarMonitoramento();

  const filtrados = useMemo(
    () => filtrarPorSetor(respondentes, setor),
    [respondentes, setor]
  );

  const topicos = useMemo(
    () => calcularResumoCompleto(filtrados),
    [filtrados]
  );

  const mapaProb = useMemo(() => {
    const m: Record<number, 1 | 2 | 3> = {};
    for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
    if (setor === "Todos") return m;
    for (const p of probabilidades) {
      if (p.setor === setor) {
        m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
      }
    }
    return m;
  }, [probabilidades, setor]);

  const topicosComMatriz = useMemo(
    () => aplicarMatriz(topicos, mapaProb),
    [topicos, mapaProb]
  );

  function getMonit(topicoIdx: number) {
    return monitoramentos.find(
      (m) => m.setor === setor && m.topico_idx === topicoIdx
    );
  }

  function atualizar(
    topicoIdx: number,
    campo:
      | "data_intervencao"
      | "responsavel"
      | "status"
      | "proxima_avaliacao",
    valor: string
  ) {
    if (!relatorio || setor === "Todos") return;
    const m = getMonit(topicoIdx);
    salvar.mutate({
      id_relatorio: idRelatorio,
      id_empresa: relatorio.id_empresa,
      setor,
      topico_idx: topicoIdx,
      data_intervencao:
        campo === "data_intervencao"
          ? valor || null
          : m?.data_intervencao ?? null,
      responsavel:
        campo === "responsavel" ? valor || null : m?.responsavel ?? null,
      status:
        campo === "status"
          ? (valor as StatusMonitoramento)
          : m?.status ?? "Pendente",
      proxima_avaliacao:
        campo === "proxima_avaliacao"
          ? valor || null
          : m?.proxima_avaliacao ?? null,
      observacoes: m?.observacoes ?? null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Monitoramento do Desempenho
        </h1>
        <p className="text-sm text-gray-600">
          Recomendações por nível de risco e acompanhamento por tópico.
          Selecione um setor específico para editar.
        </p>
      </div>

      <DrpsFiltro idRelatorio={idRelatorio} />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(
          Object.entries(RECOMENDACOES) as [
            NivelMatriz,
            (typeof RECOMENDACOES)["Baixo"],
          ][]
        ).map(([nivel, info]) => (
          <div
            key={nivel}
            className="rounded-xl border-l-4 bg-white p-3 shadow-sm"
            style={{ borderLeftColor: CORES_MATRIZ[nivel] }}
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {info.titulo}
            </h3>
            <p className="mt-1 text-xs text-gray-600">{info.texto}</p>
          </div>
        ))}
      </div>

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado neste relatório.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Tópico</th>
                  <th className="px-2 py-2 text-center font-medium w-24">
                    Risco Atual
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-32">
                    Data Intervenção
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-40">
                    Responsável
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-36">
                    Status
                  </th>
                  <th className="px-2 py-2 text-left font-medium w-32">
                    Próxima Avaliação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topicosComMatriz.map((t) => {
                  const m = getMonit(t.idx);
                  const podeEditar = setor !== "Todos";
                  return (
                    <tr key={t.idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-medium text-gray-800">
                        {t.idx + 1}. {t.nome.replace(/^Tópico \d+ - /, "")}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: t.corMatriz }}
                        >
                          {t.matriz}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={m?.data_intervencao ?? ""}
                          disabled={!podeEditar}
                          onChange={(e) =>
                            atualizar(t.idx, "data_intervencao", e.target.value)
                          }
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          defaultValue={m?.responsavel ?? ""}
                          disabled={!podeEditar}
                          onBlur={(e) =>
                            atualizar(t.idx, "responsavel", e.target.value)
                          }
                          placeholder="—"
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={m?.status ?? "Pendente"}
                          disabled={!podeEditar}
                          onChange={(e) =>
                            atualizar(t.idx, "status", e.target.value)
                          }
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        >
                          {STATUS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={m?.proxima_avaliacao ?? ""}
                          disabled={!podeEditar}
                          onChange={(e) =>
                            atualizar(
                              t.idx,
                              "proxima_avaliacao",
                              e.target.value
                            )
                          }
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {setor === "Todos" && (
            <p className="border-t border-gray-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Selecione um setor específico no filtro para editar o
              monitoramento.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
