"use client";

import { useEffect, useMemo, useState, use } from "react";
import { Save, Check } from "lucide-react";
import {
  useDrpsPlanoMedidas,
  useDrpsRelatorio,
  useDrpsSalvarPlanoMedidas,
} from "@/lib/hooks/useDrps";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { MEDIDAS_CONTROLE, MESES } from "@/lib/drps/topicos";
import type { MedidaPlano } from "@/lib/drps/types";

type PlanoState = Record<string, MedidaPlano>;

function planoVazio(): PlanoState {
  const p: PlanoState = {};
  for (const acao of MEDIDAS_CONTROLE) {
    p[acao] = { meses: Array(12).fill(false), responsavel: "" };
  }
  return p;
}

export default function MedidasPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const canEdit = useCanEdit();
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const { data: planoDB, isLoading } = useDrpsPlanoMedidas(idRelatorio, ano);
  const salvar = useDrpsSalvarPlanoMedidas();

  const [plano, setPlano] = useState<PlanoState>(planoVazio);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const base = planoVazio();
    if (planoDB?.plano) {
      for (const [acao, dados] of Object.entries(planoDB.plano)) {
        base[acao] = dados as MedidaPlano;
      }
    }
    setPlano(base);
    setDirty(false);
  }, [planoDB, isLoading]);

  function toggleMes(acao: string, mes: number) {
    setPlano((p) => {
      const atual = p[acao];
      const novosMeses = [...atual.meses];
      novosMeses[mes] = !novosMeses[mes];
      return { ...p, [acao]: { ...atual, meses: novosMeses } };
    });
    setDirty(true);
  }

  function setResponsavel(acao: string, valor: string) {
    setPlano((p) => ({ ...p, [acao]: { ...p[acao], responsavel: valor } }));
    setDirty(true);
  }

  function onSalvar() {
    if (!relatorio) return;
    salvar.mutate(
      {
        id_relatorio: idRelatorio,
        id_empresa: relatorio.id_empresa,
        ano,
        plano,
      },
      { onSuccess: () => setDirty(false) }
    );
  }

  const totalMarcacoes = useMemo(
    () =>
      Object.values(plano).reduce(
        (s, m) => s + m.meses.filter(Boolean).length,
        0
      ),
    [plano]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Medidas de Controle — Plano Anual
        </h1>
        <p className="text-sm text-gray-600">
          Calendário de implementação dos 13 programas recomendados.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Ano:
          </label>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            {[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {totalMarcacoes} marcação(ões)
          </span>
        </div>
        <button
          type="button"
          onClick={onSalvar}
          disabled={!canEdit || !dirty || salvar.isPending || !relatorio}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          {salvar.isPending ? "Salvando..." : "Salvar Plano"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-50">
                  Ação
                </th>
                {MESES.map((m) => (
                  <th
                    key={m}
                    className="px-1 py-2 text-center font-medium w-10"
                  >
                    {m}
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-medium w-40">
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MEDIDAS_CONTROLE.map((acao) => {
                const p = plano[acao];
                if (!p) return null;
                return (
                  <tr key={acao} className="hover:bg-gray-50">
                    <td className="px-2 py-1 font-medium text-gray-800 sticky left-0 bg-white">
                      {acao}
                    </td>
                    {p.meses.map((m, i) => (
                      <td key={i} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => toggleMes(acao, i)}
                          disabled={!canEdit}
                          className={
                            m
                              ? "flex size-7 mx-auto items-center justify-center rounded bg-verde-primary text-white hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-60"
                              : "flex size-7 mx-auto items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          }
                        >
                          {m && <Check className="size-3.5" />}
                        </button>
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={p.responsavel}
                        onChange={(e) =>
                          setResponsavel(acao, e.target.value)
                        }
                        disabled={!canEdit}
                        placeholder="—"
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
