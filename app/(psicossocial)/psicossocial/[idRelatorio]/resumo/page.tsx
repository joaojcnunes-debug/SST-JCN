"use client";

import { useMemo, use } from "react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useDrpsProbabilidades,
  useDrpsProbabilidadesUnidade,
  useDrpsRelatorio,
  useDrpsRespondentes,
  useDrpsRemoverProbabilidadeUnidade,
  useDrpsSalvarProbabilidade,
  useDrpsSalvarProbabilidadeUnidade,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  filtrarPorUnidade,
} from "@/lib/drps/calculos";
import { montarMapaProb, montarMapaProbUnidade } from "@/lib/drps/blocos";
import { TOPICOS } from "@/lib/drps/topicos";
import type { NivelProbabilidade } from "@/lib/drps/types";

const COR_PROBABILIDADE: Record<NivelProbabilidade, string> = {
  Baixa: "#27ae60",
  Média: "#f39c12",
  Alta: "#e74c3c",
};

export default function ResumoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor = useDrpsStore((s) => s.setor);
  const unidade = useDrpsStore((s) => s.unidade);
  const canEdit = useCanEdit();
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);
  const { data: overrides = [] } = useDrpsProbabilidadesUnidade(idRelatorio);
  const salvar = useDrpsSalvarProbabilidade();
  const salvarUnidade = useDrpsSalvarProbabilidadeUnidade();
  const removerUnidade = useDrpsRemoverProbabilidadeUnidade();

  // Editando uma unidade específica: a gravação vai para a tabela de
  // overrides (v150), não para o valor do setor — que é o padrão herdado
  // por TODAS as unidades e não pode ser alterado sem querer daqui.
  const editandoUnidade = unidade !== "Todas";

  const filtrados = useMemo(
    () => filtrarPorSetor(filtrarPorUnidade(respondentes, unidade), setor),
    [respondentes, unidade, setor]
  );

  const topicos = useMemo(
    () => calcularResumoCompleto(filtrados),
    [filtrados]
  );

  const { mapaProb, herdados } = useMemo(() => {
    const vazio: Record<number, 1 | 2 | 3> = {};
    for (let i = 0; i < TOPICOS.length; i++) vazio[i] = 1;
    if (setor === "Todos") return { mapaProb: vazio, herdados: new Set<number>() };
    if (!editandoUnidade) {
      return {
        mapaProb: montarMapaProb(probabilidades, setor),
        herdados: new Set<number>(),
      };
    }
    const { mapa, herdados: h } = montarMapaProbUnidade(
      probabilidades,
      overrides,
      unidade,
      setor
    );
    return { mapaProb: mapa, herdados: new Set(h) };
  }, [probabilidades, overrides, setor, unidade, editandoUnidade]);

  const topicosComMatriz = useMemo(
    () => aplicarMatriz(topicos, mapaProb),
    [topicos, mapaProb]
  );

  const podeEditar = setor !== "Todos" && relatorio !== null && canEdit;

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

      <DrpsFiltro idRelatorio={idRelatorio} />

      {editandoUnidade && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Editando <strong>{unidade}</strong>. Cada tópico começa{" "}
          <strong>herdando</strong> a probabilidade do setor — que continua
          valendo para as demais unidades. Ao mudar um valor aqui, ele passa a
          ser próprio desta unidade e o do setor não é alterado. Para editar o
          valor do setor (o padrão de todas), volte o filtro para{" "}
          <strong>Todas as unidades</strong>.
        </div>
      )}

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado neste relatório.
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
                  Média Probabilidade
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Classificação Gravidade
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Classificação Probabilidade
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
                    {t.idx + 1}. {t.nome.replace(/^Tópico \d+ - /, "")}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700">
                    {t.mediaGravidade.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <select
                      value={t.probabilidade}
                      disabled={!podeEditar}
                      onChange={(e) => {
                        if (!relatorio) return;
                        const v = Number(e.target.value) as 1 | 2 | 3;
                        if (editandoUnidade) {
                          salvarUnidade.mutate({
                            id_relatorio: idRelatorio,
                            id_empresa: relatorio.id_empresa,
                            unidade,
                            setor,
                            topico_idx: t.idx,
                            probabilidade: v,
                          });
                          return;
                        }
                        salvar.mutate({
                          id_relatorio: idRelatorio,
                          id_empresa: relatorio.id_empresa,
                          setor,
                          topico_idx: t.idx,
                          probabilidade: v,
                        });
                      }}
                      style={{
                        backgroundColor:
                          COR_PROBABILIDADE[t.classificacaoProbabilidade],
                        color: "white",
                        fontWeight: 600,
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option
                        value={1}
                        style={{
                          backgroundColor: COR_PROBABILIDADE.Baixa,
                          color: "white",
                        }}
                      >
                        1 — Baixa
                      </option>
                      <option
                        value={2}
                        style={{
                          backgroundColor: COR_PROBABILIDADE.Média,
                          color: "white",
                        }}
                      >
                        2 — Média
                      </option>
                      <option
                        value={3}
                        style={{
                          backgroundColor: COR_PROBABILIDADE.Alta,
                          color: "white",
                        }}
                      >
                        3 — Alta
                      </option>
                    </select>
                    {editandoUnidade &&
                      (herdados.has(t.idx) ? (
                        <div className="mt-1 text-[10px] font-medium text-gray-400">
                          herdado do setor
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!podeEditar}
                          onClick={() =>
                            removerUnidade.mutate({
                              id_relatorio: idRelatorio,
                              unidade,
                              setor,
                              topico_idx: t.idx,
                            })
                          }
                          className="mt-1 text-[10px] font-medium text-verde-primary underline decoration-dotted hover:text-verde-dark disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                          title="Descarta o valor próprio desta unidade e volta a usar o valor do setor"
                        >
                          próprio · voltar a herdar
                        </button>
                      ))}
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
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                      style={{
                        backgroundColor:
                          COR_PROBABILIDADE[t.classificacaoProbabilidade],
                      }}
                    >
                      {t.classificacaoProbabilidade}
                    </span>
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
