"use client";

import { useMemo } from "react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsProbabilidades,
  useDrpsRespondentes,
  useDrpsSalvarProbabilidade,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
} from "@/lib/drps/calculos";
import { TOPICOS } from "@/lib/drps/topicos";

export default function DrpsResumoPage() {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const setor = useDrpsStore((s) => s.setor);
  const { data: respondentes = [] } = useDrpsRespondentes(idEmpresa);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idEmpresa);
  const salvar = useDrpsSalvarProbabilidade();

  const filtrados = useMemo(
    () => filtrarPorSetor(respondentes, setor),
    [respondentes, setor]
  );

  const topicos = useMemo(
    () => calcularResumoCompleto(filtrados),
    [filtrados]
  );

  // Probabilidades aplicáveis: o psicólogo define por setor. Quando o
  // filtro é "Todos os setores", usa a média ponderada (sem persistência —
  // a edição requer um setor específico selecionado).
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

  const podeEditar = setor !== "Todos" && idEmpresa !== null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Resumo por Tópico
        </h1>
        <p className="text-sm text-gray-600">
          Gravidade média calculada a partir dos respondentes. Probabilidade
          editável pelo psicólogo (1=Baixa, 2=Média, 3=Alta) — definida por
          setor.
        </p>
      </div>

      <DrpsFiltro />

      {!idEmpresa ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Selecione uma empresa.
        </div>
      ) : respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado para esta empresa.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Tópico</th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Média Gravidade
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Classif. Gravidade
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Probabilidade
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Classif. Probab.
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Matriz de Risco
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topicosComMatriz.map((t) => (
                <tr key={t.idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {t.nome}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700">
                    {t.mediaGravidade.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                      style={{
                        backgroundColor: t.classificacaoGravidade.cor,
                      }}
                    >
                      {t.classificacaoGravidade.texto}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <select
                      value={t.probabilidade}
                      disabled={!podeEditar}
                      onChange={(e) => {
                        if (!idEmpresa) return;
                        const v = Number(e.target.value) as 1 | 2 | 3;
                        salvar.mutate({
                          id_empresa: idEmpresa,
                          setor,
                          topico_idx: t.idx,
                          probabilidade: v,
                        });
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value={1}>1 — Baixa</option>
                      <option value={2}>2 — Média</option>
                      <option value={3}>3 — Alta</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700">
                    {t.classificacaoProbabilidade}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white"
                      style={{ backgroundColor: t.corMatriz }}
                    >
                      {t.matriz}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!podeEditar && (
            <p className="border-t border-gray-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Para editar a probabilidade, selecione um setor específico no
              filtro (cada setor tem sua própria probabilidade).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
