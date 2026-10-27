"use client";

import type { Analise, FiltroAnalise } from "@/components/psico-consolidacao/comum";

export const SEM_FILTRO: FiltroAnalise = { empresa: "", setor: "", fator: "" };

/** Filtros comuns às abas de análise (empresa, setor, fator) e o parâmetro da AEP. */
export default function FiltrosAnalise({
  analise,
  filtro,
  onFiltro,
  incluirTrivial,
  onIncluirTrivial,
  linhasSemFator,
}: {
  analise: Analise;
  filtro: FiltroAnalise;
  onFiltro: (f: FiltroAnalise) => void;
  incluirTrivial: boolean;
  onIncluirTrivial: (v: boolean) => void;
  linhasSemFator: number;
}) {
  const { r, nomeEmpresa } = analise;
  const empresas = [...new Set(r.setores.flatMap((s) => s.empresas))].sort((a, b) =>
    nomeEmpresa(a).localeCompare(nomeEmpresa(b), "pt-BR"),
  );
  const sel = "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm";
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filtrar empresa" value={filtro.empresa} onChange={(e) => onFiltro({ ...filtro, empresa: e.target.value })} className={sel}>
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e} value={e}>{nomeEmpresa(e)}</option>
          ))}
        </select>
        <select aria-label="Filtrar setor" value={filtro.setor} onChange={(e) => onFiltro({ ...filtro, setor: e.target.value })} className={sel}>
          <option value="">Todos os setores</option>
          {r.setores.map((s) => (
            <option key={s.setor} value={s.setor}>{s.setor}</option>
          ))}
        </select>
        <select aria-label="Filtrar fator" value={filtro.fator} onChange={(e) => onFiltro({ ...filtro, fator: e.target.value })} className={sel}>
          <option value="">Todos os fatores</option>
          {r.fatores.map((f) => (
            <option key={f.id_fator} value={f.id_fator}>{f.nome}</option>
          ))}
        </select>
        {(filtro.empresa || filtro.setor || filtro.fator) && (
          <button type="button" onClick={() => onFiltro(SEM_FILTRO)} className="text-xs text-gray-500 underline hover:text-gray-700">
            limpar filtros
          </button>
        )}
        <label
          className="ml-auto flex items-center gap-1.5 text-xs text-gray-600"
          title="Desmarcado: fator da AEP com nível AIHA Trivial ou Baixo não entra no perfil"
        >
          <input type="checkbox" checked={incluirTrivial} onChange={(e) => onIncluirTrivial(e.target.checked)} className="size-3.5" />
          AEP: incluir fatores Trivial/Baixo na AIHA
        </label>
      </div>
      <p className="text-[11px] text-gray-500">
        {r.fatores.length} fatores · {r.setores.length} setores padronizados ({r.setores.filter((s) => s.comum).length} comuns) ·{" "}
        {empresas.length} empresas com documento
        {linhasSemFator > 0 && (
          <span className="text-amber-700"> · {linhasSemFator} linha(s) sem fator correspondente ficaram fora (aba Fatores)</span>
        )}
      </p>
    </div>
  );
}
