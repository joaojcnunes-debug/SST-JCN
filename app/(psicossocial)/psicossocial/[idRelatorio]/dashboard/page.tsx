"use client";

import { useMemo, use } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import MatrizRisco from "@/components/drps/MatrizRisco";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsProbabilidades,
  useDrpsRelatorio,
  useDrpsRespondentes,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  CORES_MATRIZ,
  filtrarPorSetor,
} from "@/lib/drps/calculos";
import { TOPICOS } from "@/lib/drps/topicos";
import type { NivelMatriz } from "@/lib/drps/types";

const NIVEIS: NivelMatriz[] = ["Baixo", "Médio", "Alto", "Crítico"];

export default function DashboardPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor = useDrpsStore((s) => s.setor);
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);

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

  const contagem = useMemo(() => {
    const c: Record<NivelMatriz, number> = {
      Baixo: 0,
      Médio: 0,
      Alto: 0,
      Crítico: 0,
    };
    for (const t of topicosComMatriz) c[t.matriz]++;
    return c;
  }, [topicosComMatriz]);

  const dadosBarras = useMemo(
    () =>
      topicosComMatriz.map((t) => ({
        nome: t.nome.replace(/^Tópico \d+ - /, ""),
        nomeCompleto: t.nome,
        gravidade: Number(t.mediaGravidade.toFixed(2)),
        cor: t.classificacaoGravidade.cor,
      })),
    [topicosComMatriz]
  );

  const dadosRosca = useMemo(
    () =>
      NIVEIS.map((n) => ({
        nome: n,
        valor: contagem[n],
        cor: CORES_MATRIZ[n],
      })).filter((d) => d.valor > 0),
    [contagem]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Painel Resumo NR-1
        </h1>
        <p className="text-sm text-gray-600">
          {relatorio ? (
            <>
              Relatório <strong>Rev. {relatorio.revisao}</strong> ·{" "}
              {relatorio.responsavel_tecnico ?? "Sem responsável definido"}
            </>
          ) : (
            "Carregando..."
          )}
        </p>
      </div>

      <DrpsFiltro idRelatorio={idRelatorio} />

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado neste relatório. Vá em{" "}
          <strong>Dados do Forms</strong> para começar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {NIVEIS.map((n) => (
              <div
                key={n}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div
                  className="mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: CORES_MATRIZ[n] }}
                >
                  {n}
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {contagem[n]}
                </p>
                <p className="text-xs text-gray-500">
                  tópico{contagem[n] !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Matriz de Risco
              </h2>
              <MatrizRisco topicos={topicosComMatriz} mostrarTopicos={false} />
              <p className="mt-2 text-[11px] text-gray-500">
                {filtrados.length} respondente(s) considerado(s)
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Distribuição do Risco Final
              </h2>
              {dadosRosca.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dadosRosca}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={(props) => {
                        const p = props as unknown as {
                          nome: string;
                          valor: number;
                        };
                        return `${p.nome}: ${p.valor}`;
                      }}
                    >
                      {dadosRosca.map((d, i) => (
                        <Cell key={i} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-sm text-gray-500">
                  Sem dados
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Gravidade Média por Tópico
            </h2>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={dadosBarras}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 8, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 3]}
                  ticks={[0, 1, 1.5, 2, 2.5, 3]}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={220}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : String(v)
                  }
                  labelFormatter={(_, payload) =>
                    (
                      payload?.[0]?.payload as
                        | { nomeCompleto?: string }
                        | undefined
                    )?.nomeCompleto ?? ""
                  }
                />
                <Bar dataKey="gravidade">
                  {dadosBarras.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[11px] text-gray-500">
              Escala: 0–3 (Baixa &lt; 1,66 &lt; Média ≤ 2,32 &lt; Alta)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
