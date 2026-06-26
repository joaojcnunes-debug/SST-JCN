"use client";

import { useState } from "react";
import { Filter, ChevronDown, Trash2, Bookmark } from "lucide-react";
import {
  useFiltrosSalvos, useSalvarFiltro, useExcluirFiltro, contarFiltros,
  PRIORIDADES, FILTRO_VAZIO,
  type FiltrosGestao, type GestaoStatus, type GestaoEtiqueta,
} from "@/lib/hooks/useGestao";

const PRAZOS: { value: FiltrosGestao["prazo"]; label: string }[] = [
  { value: "", label: "Qualquer" },
  { value: "atrasadas", label: "Atrasadas" },
  { value: "sem", label: "Sem prazo" },
  { value: "hoje", label: "Vence hoje" },
  { value: "semana", label: "Esta semana" },
];

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function FiltrosPanel({
  filtros,
  onChange,
  statuses,
  etiquetas,
  usuarios,
  idQuadro,
}: {
  filtros: FiltrosGestao;
  onChange: (f: FiltrosGestao) => void;
  statuses: GestaoStatus[];
  etiquetas: GestaoEtiqueta[];
  usuarios: string[];
  idQuadro: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const { data: salvos = [] } = useFiltrosSalvos(idQuadro);
  const salvarFiltro = useSalvarFiltro();
  const excluirFiltro = useExcluirFiltro();
  const n = contarFiltros(filtros);
  const set = (patch: Partial<FiltrosGestao>) => onChange({ ...filtros, ...patch });

  const Chip = ({ on, cor, children, onClick }: { on: boolean; cor?: string; children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      style={on ? { background: cor ?? "#0ea5e9" } : undefined}>
      {children}
    </button>
  );

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} className={`relative z-40 inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm font-medium ${n > 0 ? "border-verde-primary bg-verde-light/60 text-verde-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
        <Filter className="size-4" /> Filtros{n > 0 && <span className="ml-0.5 rounded-full bg-verde-primary px-1.5 text-[11px] font-bold text-white">{n}</span>}
        <ChevronDown className="size-3.5 text-gray-400" />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute left-0 z-40 mt-1 max-h-[80vh] w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            {/* Responsável */}
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Responsável</label>
              <select value={filtros.responsavel} disabled={filtros.semResponsavel} onChange={(e) => set({ responsavel: e.target.value })} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50">
                <option value="">Todos</option>
                {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={filtros.semResponsavel} onChange={(e) => set({ semResponsavel: e.target.checked, responsavel: e.target.checked ? "" : filtros.responsavel })} className="size-3.5 rounded accent-verde-primary" /> Sem responsável
              </label>
            </div>

            {/* Prioridade */}
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Prioridade</label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORIDADES.map((p) => <Chip key={p.value} on={filtros.prioridades.includes(p.value)} cor={p.cor} onClick={() => set({ prioridades: toggle(filtros.prioridades, p.value) })}>{p.label}</Chip>)}
              </div>
            </div>

            {/* Status */}
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => <Chip key={s.slug} on={filtros.status.includes(s.slug)} cor={s.cor} onClick={() => set({ status: toggle(filtros.status, s.slug) })}>{s.nome}</Chip>)}
              </div>
            </div>

            {/* Etiquetas */}
            {etiquetas.length > 0 && (
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Etiquetas</label>
                <div className="flex flex-wrap gap-1.5">
                  {etiquetas.map((e) => <Chip key={e.id} on={filtros.etiquetas.includes(e.nome)} cor={e.cor} onClick={() => set({ etiquetas: toggle(filtros.etiquetas, e.nome) })}>{e.nome}</Chip>)}
                </div>
              </div>
            )}

            {/* Prazo */}
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Prazo</label>
              <div className="flex flex-wrap gap-1.5">
                {PRAZOS.map((p) => <Chip key={p.value} on={filtros.prazo === p.value} onClick={() => set({ prazo: p.value })}>{p.label}</Chip>)}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <button type="button" onClick={() => onChange(FILTRO_VAZIO)} className="text-xs font-medium text-gray-500 hover:text-gray-800">Limpar filtros</button>
            </div>

            {/* Salvar / aplicar filtros salvos */}
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Filtros salvos</p>
              <div className="space-y-1">
                {salvos.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2">
                    <button type="button" onClick={() => { onChange(f.criterios); setAberto(false); }} className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-50">
                      <Bookmark className="size-3.5 text-verde-primary" /> <span className="truncate">{f.nome}</span>
                    </button>
                    <button type="button" onClick={() => excluirFiltro.mutate(f.id)} className="text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                  </div>
                ))}
                {salvos.length === 0 && <p className="px-1.5 text-xs text-gray-400">Nenhum filtro salvo.</p>}
              </div>
              {n > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome do filtro…" className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
                  <button type="button" disabled={!nomeNovo.trim()} onClick={() => { salvarFiltro.mutate({ id_quadro: idQuadro, nome: nomeNovo.trim(), criterios: filtros }); setNomeNovo(""); }} className="rounded-md bg-verde-primary px-2.5 py-1 text-sm font-medium text-white disabled:opacity-50">Salvar</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
