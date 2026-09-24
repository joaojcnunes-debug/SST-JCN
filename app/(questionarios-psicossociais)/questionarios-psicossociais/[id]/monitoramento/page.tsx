"use client";

import { useMemo, useState, use } from "react";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useQpsAllPerguntas,
  useQpsAplicacao,
  useQpsCategorias,
  useQpsProbabilidades,
  useQpsRespondentes,
  useQpsTipos,
} from "@/lib/hooks/useQuestionarios";
import { useQpsMonitoramento, useQpsSalvarMonitoramento } from "@/lib/hooks/useQpsGestao";
import { calcularAnaliseSetor, listarSetoresQps, TODOS_OS_SETORES } from "@/lib/qps/gravidade";
import type { CategoriaGravidade } from "@/lib/qps/gravidade";
import { CORES_MATRIZ } from "@/lib/drps/calculos";
import type { NivelMatriz } from "@/lib/drps/types";
import { recomendacoesMonitoramento } from "@/lib/qps/gestao";
import type { StatusQpsMonitoramento } from "@/lib/supabase/types";

/**
 * Monitoramento do Desempenho — espelho de `psicossocial/[idRelatorio]/monitoramento`
 * (v225, "igual ao DRPS"). Uma linha por CATEGORIA do questionário (no DRPS é por
 * tópico), com o risco atual vindo da régua do DRPS (`calcularAnaliseSetor`:
 * gravidade da resposta × probabilidade informada). Só edita com um setor
 * escolhido; em "Todos" a tabela é leitura, como lá.
 */

const STATUS: StatusQpsMonitoramento[] = ["Pendente", "Em Andamento", "Concluido", "Cancelado"];

export default function MonitoramentoQpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canEdit = useCanEdit();
  const { data: ap } = useQpsAplicacao(id);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: perguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [] } = useQpsRespondentes(id);
  const { data: probabilidades = [] } = useQpsProbabilidades(id);
  const { data: monitoramentos = [] } = useQpsMonitoramento(id);
  const salvar = useQpsSalvarMonitoramento();

  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo);
  const setores = useMemo(() => listarSetoresQps(respondentes), [respondentes]);
  const [setor, setSetor] = useState<string>(TODOS_OS_SETORES);
  const ehTodos = setor === TODOS_OS_SETORES;

  const analise = useMemo<CategoriaGravidade[]>(() => {
    if (!tipo || categorias.length === 0) return [];
    return calcularAnaliseSetor(setor, categorias, perguntas, respondentes, probabilidades, tipo.escala_min, tipo.escala_max);
  }, [tipo, setor, categorias, perguntas, respondentes, probabilidades]);

  const recomendacoes = recomendacoesMonitoramento();

  function getMonit(idCategoria: string) {
    return monitoramentos.find((m) => m.setor === setor && m.id_categoria === idCategoria);
  }

  function atualizar(
    idCategoria: string,
    campo: "data_intervencao" | "responsavel" | "status" | "proxima_avaliacao",
    valor: string,
  ) {
    if (!ap || ehTodos) return;
    const m = getMonit(idCategoria);
    salvar.mutate({
      id_aplicacao: id,
      setor,
      id_categoria: idCategoria,
      data_intervencao: campo === "data_intervencao" ? valor || null : m?.data_intervencao ?? null,
      responsavel: campo === "responsavel" ? valor || null : m?.responsavel ?? null,
      status: campo === "status" ? (valor as StatusQpsMonitoramento) : m?.status ?? "Pendente",
      proxima_avaliacao: campo === "proxima_avaliacao" ? valor || null : m?.proxima_avaliacao ?? null,
      observacoes: m?.observacoes ?? null,
    });
  }

  const podeEditar = !ehTodos && canEdit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Monitoramento do Desempenho</h1>
          <p className="text-sm text-gray-600">
            {ap?.titulo ?? "Carregando..."} · recomendações por nível de risco e acompanhamento por
            categoria. Selecione um setor específico para editar.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Setor
          <select
            id="qps-monitoramento-setor"
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none"
          >
            {[TODOS_OS_SETORES, ...setores].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(recomendacoes) as [NivelMatriz, { titulo: string; texto: string }][]).map(
          ([nivel, info]) => (
            <div
              key={nivel}
              className="rounded-xl border-l-4 bg-white p-3 shadow-sm"
              style={{ borderLeftColor: CORES_MATRIZ[nivel] }}
            >
              <h3 className="text-sm font-semibold text-gray-900">{info.titulo}</h3>
              <p className="mt-1 text-xs text-gray-600">{info.texto}</p>
            </div>
          ),
        )}
      </div>

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado nesta aplicação.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Categoria</th>
                  <th className="px-2 py-2 text-center font-medium w-24">Risco Atual</th>
                  <th className="px-2 py-2 text-left font-medium w-32">Data Intervenção</th>
                  <th className="px-2 py-2 text-left font-medium w-40">Responsável</th>
                  <th className="px-2 py-2 text-left font-medium w-36">Status</th>
                  <th className="px-2 py-2 text-left font-medium w-32">Próxima Avaliação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analise.map((c, i) => {
                  const m = getMonit(c.id_categoria);
                  return (
                    <tr key={c.id_categoria} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-medium text-gray-800">
                        {i + 1}. {c.nome}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {c.matriz ? (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: c.corMatriz ?? undefined }}
                          >
                            {c.matriz}
                          </span>
                        ) : (
                          <span className="text-[10px] italic text-gray-400">sem resposta</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={m?.data_intervencao ?? ""}
                          disabled={!podeEditar}
                          onChange={(e) => atualizar(c.id_categoria, "data_intervencao", e.target.value)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          key={`${setor}-${c.id_categoria}-${m?.responsavel ?? ""}`}
                          defaultValue={m?.responsavel ?? ""}
                          disabled={!podeEditar}
                          onBlur={(e) => {
                            if ((e.target.value || null) !== (m?.responsavel ?? null))
                              atualizar(c.id_categoria, "responsavel", e.target.value);
                          }}
                          placeholder="—"
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={m?.status ?? "Pendente"}
                          disabled={!podeEditar}
                          onChange={(e) => atualizar(c.id_categoria, "status", e.target.value)}
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
                          onChange={(e) => atualizar(c.id_categoria, "proxima_avaliacao", e.target.value)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ehTodos && (
            <p className="border-t border-gray-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Selecione um setor específico para editar o monitoramento. O risco em &ldquo;Todos os
              setores&rdquo; é o consolidado da tela Análise.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
