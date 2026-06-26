"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import {
  useSalvarTarefa, useUsuariosLista,
  iniciais, corAvatar,
  PRIORIDADES,
  type GestaoTarefa, type AgruparPor, type PrioridadeTarefa, type GestaoStatus, type GestaoCampo,
} from "@/lib/hooks/useGestao";
import { formatarCampoValor } from "@/components/gestao/CampoInput";

const ordemPrio = (p: string) => PRIORIDADES.findIndex((x) => x.value === p);
const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

type Coluna = "titulo" | "status" | "prioridade" | "responsavel" | "data_inicio" | "prazo";

const AGRUPAMENTOS: { value: AgruparPor | ""; label: string }[] = [
  { value: "", label: "Sem agrupar" },
  { value: "status", label: "Status" },
  { value: "responsavel", label: "Responsável" },
  { value: "prioridade", label: "Prioridade" },
  { value: "etiqueta", label: "Etiqueta" },
];

export default function VistaLista({
  tarefas,
  statuses,
  campos,
  agruparPor,
  onAgruparPor,
  podeEditar,
  onAbrir,
  aoMudarStatus,
}: {
  tarefas: GestaoTarefa[];
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  agruparPor: AgruparPor | null;
  onAgruparPor: (a: AgruparPor | null) => void;
  podeEditar: boolean;
  onAbrir: (t: GestaoTarefa) => void;
  aoMudarStatus?: (tarefa: GestaoTarefa, de: string, para: string) => void;
}) {
  const totalCols = 6 + campos.length;
  const salvar = useSalvarTarefa();
  const { data: usuarios = [] } = useUsuariosLista();
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);
  const ordemStatus = useCallback((slug: string) => { const i = statuses.findIndex((s) => s.slug === slug); return i < 0 ? 999 : i; }, [statuses]);
  const [sortBy, setSortBy] = useState<Coluna>("prazo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  function ordenar(col: Coluna) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  }

  function patch(t: GestaoTarefa, campo: Partial<GestaoTarefa>) {
    salvar.mutate({ id_tarefa: t.id_tarefa, id_quadro: t.id_quadro, ...campo });
  }

  const ordenadas = useMemo(() => {
    const arr = [...tarefas];
    const cmp = (a: GestaoTarefa, b: GestaoTarefa): number => {
      let r = 0;
      switch (sortBy) {
        case "titulo": r = a.titulo.localeCompare(b.titulo, "pt-BR"); break;
        case "status": r = ordemStatus(a.status) - ordemStatus(b.status); break;
        case "prioridade": r = ordemPrio(a.prioridade) - ordemPrio(b.prioridade); break;
        case "responsavel": r = (a.responsavel ?? "~").localeCompare(b.responsavel ?? "~", "pt-BR"); break;
        case "data_inicio": r = (a.data_inicio ?? "9999").localeCompare(b.data_inicio ?? "9999"); break;
        case "prazo": r = (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"); break;
      }
      return sortDir === "asc" ? r : -r;
    };
    return arr.sort(cmp);
  }, [tarefas, sortBy, sortDir, ordemStatus]);

  const grupos = useMemo(() => {
    if (!agruparPor) return [{ chave: "__all__", label: "", cor: undefined as string | undefined, itens: ordenadas }];
    const map = new Map<string, { chave: string; label: string; cor?: string; itens: GestaoTarefa[] }>();
    const add = (chave: string, label: string, t: GestaoTarefa, cor?: string) => {
      if (!map.has(chave)) map.set(chave, { chave, label, cor, itens: [] });
      map.get(chave)!.itens.push(t);
    };
    for (const t of ordenadas) {
      if (agruparPor === "status") {
        const s = statusMap.get(t.status);
        add(t.status, s?.nome ?? t.status, t, s?.cor);
      } else if (agruparPor === "prioridade") {
        const p = PRIORIDADES.find((x) => x.value === t.prioridade);
        add(t.prioridade, p?.label ?? t.prioridade, t, p?.cor);
      } else if (agruparPor === "responsavel") {
        const r = t.responsavel?.trim() || "Sem responsável";
        add(r, r, t, t.responsavel ? corAvatar(t.responsavel) : "#cbd5e1");
      } else {
        const tags = t.etiquetas?.length ? t.etiquetas : ["Sem etiqueta"];
        for (const tag of tags) add(tag, tag, t, "#94a3b8");
      }
    }
    // ordena os grupos: status/prioridade pela ordem natural; demais alfabética
    const arr = [...map.values()];
    if (agruparPor === "status") arr.sort((a, b) => ordemStatus(a.chave) - ordemStatus(b.chave));
    else if (agruparPor === "prioridade") arr.sort((a, b) => ordemPrio(a.chave) - ordemPrio(b.chave));
    else arr.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return arr;
  }, [ordenadas, agruparPor, statusMap, ordemStatus]);

  const Th = ({ col, children, className = "" }: { col: Coluna; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2.5 ${className}`}>
      <button type="button" onClick={() => ordenar(col)} className="inline-flex items-center gap-1 hover:text-gray-700">
        {children}
        <ArrowUpDown className={`size-3 ${sortBy === col ? "text-verde-primary" : "text-gray-300"}`} />
      </button>
    </th>
  );

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Agrupar:</span>
        {AGRUPAMENTOS.map((a) => (
          <button
            key={a.value || "none"}
            type="button"
            onClick={() => onAgruparPor(a.value || null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${(agruparPor ?? "") === a.value ? "bg-verde-primary text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <Th col="titulo">Tarefa</Th>
              <Th col="status">Status</Th>
              <Th col="prioridade">Prioridade</Th>
              <Th col="responsavel">Responsável</Th>
              <Th col="data_inicio">Início</Th>
              <Th col="prazo">Prazo</Th>
              {campos.map((c) => <th key={c.id} className="px-3 py-2.5">{c.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const recolhido = recolhidos.has(g.chave);
              return (
                <GrupoBloco key={g.chave} grupo={g} recolhido={recolhido} agrupar={!!agruparPor} cols={totalCols}
                  onToggle={() => setRecolhidos((s) => { const n = new Set(s); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n; })}>
                  {!recolhido && g.itens.map((t) => {
                    const st = statusMap.get(t.status);
                    const dias = t.prazo ? Math.round((new Date(t.prazo + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null;
                    const atrasada = dias != null && dias < 0 && st?.tipo !== "concluido";
                    return (
                      <tr key={t.id_tarefa} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => onAbrir(t)} className="text-left font-medium text-gray-800 hover:text-verde-primary">
                            {t.titulo}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {podeEditar ? (
                            <select value={t.status} onChange={(e) => { const para = e.target.value; const de = t.status; patch(t, { status: para }); aoMudarStatus?.(t, de, para); }}
                              className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-gray-200 focus:border-verde-primary focus:outline-none" style={{ color: st?.cor }}>
                              {statuses.map((s) => <option key={s.slug} value={s.slug} style={{ color: "#374151" }}>{s.nome}</option>)}
                            </select>
                          ) : <span className="text-xs font-medium" style={{ color: st?.cor }}>{st?.nome}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {podeEditar ? (
                            <select value={t.prioridade} onChange={(e) => patch(t, { prioridade: e.target.value as PrioridadeTarefa })}
                              className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-gray-200 focus:border-verde-primary focus:outline-none" style={{ color: PRIORIDADES.find((p) => p.value === t.prioridade)?.cor }}>
                              {PRIORIDADES.map((p) => <option key={p.value} value={p.value} style={{ color: "#374151" }}>{p.label}</option>)}
                            </select>
                          ) : <span className="text-xs">{PRIORIDADES.find((p) => p.value === t.prioridade)?.label}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {podeEditar ? (
                            <input list="gestao-lista-usuarios" defaultValue={t.responsavel ?? ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (t.responsavel ?? "")) patch(t, { responsavel: v || null }); }}
                              placeholder="—" className="w-32 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-verde-primary focus:outline-none" />
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                              {t.responsavel && <span className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: corAvatar(t.responsavel) }}>{iniciais(t.responsavel)}</span>}
                              {t.responsavel ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {podeEditar ? (
                            <input type="date" value={t.data_inicio ?? ""} onChange={(e) => patch(t, { data_inicio: e.target.value || null })}
                              className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-gray-600 hover:border-gray-200 focus:border-verde-primary focus:outline-none" />
                          ) : <span className="text-sm text-gray-600">{fmtData(t.data_inicio)}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {podeEditar ? (
                            <input type="date" value={t.prazo ?? ""} onChange={(e) => patch(t, { prazo: e.target.value || null })}
                              className={`rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-verde-primary focus:outline-none ${atrasada ? "font-medium text-red-600" : "text-gray-600"}`} />
                          ) : <span className={`text-sm ${atrasada ? "font-medium text-red-600" : "text-gray-600"}`}>{fmtData(t.prazo)}</span>}
                        </td>
                        {campos.map((c) => (
                          <td key={c.id} className="px-3 py-2 text-gray-600">{formatarCampoValor(c, (t.campos ?? {})[c.id])}</td>
                        ))}
                      </tr>
                    );
                  })}
                </GrupoBloco>
              );
            })}
            {tarefas.length === 0 && (
              <tr><td colSpan={totalCols} className="px-3 py-8 text-center text-gray-300">Nenhuma tarefa</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <datalist id="gestao-lista-usuarios">{usuarios.map((u) => <option key={u} value={u} />)}</datalist>
    </div>
  );
}

function GrupoBloco({ grupo, recolhido, agrupar, cols, onToggle, children }: {
  grupo: { chave: string; label: string; cor?: string; itens: GestaoTarefa[] };
  recolhido: boolean;
  agrupar: boolean;
  cols: number;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {agrupar && (
        <tr className="bg-gray-50/80">
          <td colSpan={cols} className="px-3 py-1.5">
            <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              {recolhido ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              {grupo.cor && <span className="size-2.5 rounded-full" style={{ background: grupo.cor }} />}
              {grupo.label}
              <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-600">{grupo.itens.length}</span>
            </button>
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
