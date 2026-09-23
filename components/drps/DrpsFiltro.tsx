"use client";

import { useEffect, useMemo } from "react";
import { useDrpsStore } from "@/lib/drps/store";
import { useDrpsRespondentes } from "@/lib/hooks/useDrps";
import {
  filtrarPorUnidade,
  listarSetores,
  listarUnidades,
} from "@/lib/drps/calculos";

/**
 * Filtro do editor de relatório DRPS.
 *
 * Setor sempre; unidade de trabalho só quando o formulário do cliente tem a
 * pergunta (v149/v150) — a maioria dos relatórios não tem, e para esses a tela
 * fica exatamente como era. Escolhida uma unidade, a lista de setores passa a
 * ser só a daquela unidade.
 */
export default function DrpsFiltro({ idRelatorio }: { idRelatorio: string }) {
  const setor = useDrpsStore((s) => s.setor);
  const setSetor = useDrpsStore((s) => s.setSetor);
  const unidade = useDrpsStore((s) => s.unidade);
  const setUnidade = useDrpsStore((s) => s.setUnidade);

  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);

  const unidades = useMemo(() => listarUnidades(respondentes), [respondentes]);
  const temUnidades = unidades.length > 0;

  // Setores da unidade escolhida (ou todos, quando "Todas").
  const setores = useMemo(
    () => listarSetores(filtrarPorUnidade(respondentes, unidade)),
    [respondentes, unidade]
  );

  const respondentesFiltrados = useMemo(
    () => filtrarPorUnidade(respondentes, unidade).length,
    [respondentes, unidade]
  );

  // O filtro persiste em localStorage e é compartilhado entre relatórios: ao
  // abrir um relatório que não tem a unidade guardada (ou que nem pergunta
  // unidade), volta para "Todas" em vez de filtrar tudo fora e mostrar vazio.
  useEffect(() => {
    if (unidade === "Todas") return;
    if (respondentes.length === 0) return;
    if (!unidades.includes(unidade)) setUnidade("Todas");
  }, [unidade, unidades, respondentes.length, setUnidade]);

  // Mesma proteção para o setor, que agora depende da unidade.
  useEffect(() => {
    if (setor === "Todos") return;
    if (respondentes.length === 0) return;
    if (!setores.includes(setor)) setSetor("Todos");
  }, [setor, setores, respondentes.length, setSetor]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
      {temUnidades && (
        <>
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Unidade
          </label>
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="Todas">Todas as unidades ({unidades.length})</option>
            {unidades.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Setor
      </label>
      <select
        value={setor}
        onChange={(e) => setSetor(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      >
        <option value="Todos">Todos os setores</option>
        {setores.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <span className="text-xs text-gray-500">
        {unidade === "Todas"
          ? `${respondentes.length} respondente(s) no relatório`
          : `${respondentesFiltrados} de ${respondentes.length} respondente(s) — ${unidade}`}
      </span>
    </div>
  );
}
