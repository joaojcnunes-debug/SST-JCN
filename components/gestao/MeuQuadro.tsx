"use client";

import { useMemo, useState } from "react";
import { Plus, ExternalLink, Loader2 } from "lucide-react";
import TarefaCard from "@/components/gestao/TarefaCard";
import TarefaModal from "@/components/gestao/TarefaModal";
import {
  useTarefas, useStatusQuadro, useCamposQuadro, useMoverTarefa, useTempoQuadro, useAnexosCountQuadro,
  type GestaoTarefa, type StatusTarefa,
} from "@/lib/hooks/useGestao";
import { useMeuQuadro } from "@/lib/hooks/useGestaoAcesso";

/**
 * "Meu Quadro" (GESTAO-EQUIPES-01): o quadro PESSOAL do usuário, criado sob demanda pelo servidor
 * (RPC gestao_meu_quadro → gestao_quadros.dono_email). Vive dentro de "Meu Espaço", acima da vista
 * das tarefas vinculadas em outros quadros. Kanban compacto pelos status do quadro (A fazer / Em
 * andamento / Concluído), arrastar muda o status, "Nova tarefa" e clique abrem o TarefaModal
 * ligado a ESTE quadro. O dono é `full` pelo resolver; o supervisor abre o mesmo quadro pela vista
 * "Colaboradores" (lá ele entra como quadro normal, com `edit`).
 */
export default function MeuQuadro({ onAbrirCompleto }: { onAbrirCompleto: (idQuadro: string) => void }) {
  const { data: idQuadro, isLoading, error } = useMeuQuadro();
  const { data: tarefas = [] } = useTarefas(idQuadro);
  const { data: statuses = [] } = useStatusQuadro(idQuadro);
  const { data: campos = [] } = useCamposQuadro(idQuadro);
  const { data: tempoEntries = [] } = useTempoQuadro(idQuadro, tarefas.map((t) => t.id_tarefa));
  const { data: anexosCount = new Map<string, number>() } = useAnexosCountQuadro(idQuadro, tarefas.map((t) => t.id_tarefa));
  const mover = useMoverTarefa();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<GestaoTarefa | null>(null);
  const [statusNovo, setStatusNovo] = useState<StatusTarefa>("A_FAZER");
  const [dragId, setDragId] = useState<string | null>(null);
  const [colHover, setColHover] = useState<string | null>(null);

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);
  const tempoPorTarefa = useMemo(() => { const m = new Map<string, number>(); for (const e of tempoEntries) m.set(e.id_tarefa, (m.get(e.id_tarefa) ?? 0) + (e.segundos ?? 0)); return m; }, [tempoEntries]);
  const porStatus = useMemo(() => { const m = new Map<string, GestaoTarefa[]>(); for (const s of statuses) m.set(s.slug, []); for (const t of tarefas) (m.get(t.status) ?? m.set(t.status, []).get(t.status))!.push(t); for (const l of m.values()) l.sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at)); return m; }, [tarefas, statuses]);
  const etiquetasSugeridas = useMemo(() => [...new Set(tarefas.flatMap((t) => t.etiquetas ?? []))].sort(), [tarefas]);

  if (isLoading) return <p className="mt-4 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="size-4 animate-spin" /> Preparando o seu quadro…</p>;
  if (error || !idQuadro) return <p className="mt-4 text-sm text-gray-400">Não foi possível abrir o seu quadro pessoal.</p>;

  const colunas = statuses.length ? statuses : [...porStatus.keys()].map((slug) => ({ id: slug, id_quadro: idQuadro, slug, nome: slug, cor: "#cbd5e1", ordem: 0, tipo: "ativo" as const }));
  const abertas = tarefas.filter((t) => statusMap.get(t.status)?.tipo !== "concluido").length;

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-gray-800">Meu Quadro <span className="text-sm font-normal text-gray-400">— {abertas} aberta{abertas === 1 ? "" : "s"}</span></h2>
        <button type="button" onClick={() => { setEditando(null); setStatusNovo(colunas[0]?.slug ?? "A_FAZER"); setModalOpen(true); }} className="inline-flex items-center gap-1 rounded-lg bg-verde-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent"><Plus className="size-3.5" /> Nova tarefa</button>
        <button type="button" onClick={() => onAbrirCompleto(idQuadro)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50" title="Abrir como quadro completo (lista, calendário, timeline)"><ExternalLink className="size-3.5" /> Abrir completo</button>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {colunas.map((col) => {
          const lista = porStatus.get(col.slug) ?? [];
          return (
            <div key={col.slug}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setColHover(col.slug); } }}
              onDragLeave={(e) => { if (dragId && !e.currentTarget.contains(e.relatedTarget as Node)) setColHover((c) => (c === col.slug ? null : c)); }}
              onDrop={() => { const t = tarefas.find((x) => x.id_tarefa === dragId); setColHover(null); setDragId(null); if (t && t.status !== col.slug) mover.mutate({ id_tarefa: t.id_tarefa, status: col.slug }); }}
              className={`flex h-[max(280px,calc(50vh-6rem))] w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 p-2.5 transition ${colHover === col.slug ? "border-verde-primary ring-2 ring-verde-primary/20" : "border-gray-200"}`}>
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: col.cor }} />
                  <p className="text-sm font-semibold text-gray-700">{col.nome}</p>
                  <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-600">{lista.length}</span>
                </div>
                <button type="button" onClick={() => { setEditando(null); setStatusNovo(col.slug); setModalOpen(true); }} className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700" title="Nova tarefa aqui"><Plus className="size-4" /></button>
              </div>
              <div className="min-h-[40px] flex-1 space-y-2 overflow-y-auto overscroll-contain p-0.5">
                {lista.map((t) => (
                  <TarefaCard key={t.id_tarefa} t={t} statusMap={statusMap} etiquetaCor={new Map()} tempoSeg={tempoPorTarefa.get(t.id_tarefa) ?? 0} anexos={anexosCount.get(t.id_tarefa) ?? 0} campos={campos}
                    arrastavel arrastando={dragId === t.id_tarefa}
                    onAbrir={() => { setEditando(t); setModalOpen(true); }}
                    onDragStart={() => setDragId(t.id_tarefa)} onDragEnd={() => { setDragId(null); setColHover(null); }}
                    onDragOver={(e) => { if (dragId) { e.preventDefault(); e.stopPropagation(); setColHover(col.slug); } }}
                    onDrop={(e) => { e.stopPropagation(); const d = tarefas.find((x) => x.id_tarefa === dragId); setColHover(null); setDragId(null); if (d && d.status !== col.slug) mover.mutate({ id_tarefa: d.id_tarefa, status: col.slug }); }} />
                ))}
                {lista.length === 0 && <div className="rounded-lg border border-dashed border-gray-200 px-2 py-6 text-center text-xs text-gray-300">Sem tarefas</div>}
              </div>
            </div>
          );
        })}
      </div>
      <TarefaModal open={modalOpen} onClose={() => setModalOpen(false)} idQuadro={idQuadro} tarefa={editando} statusInicial={statusNovo} statuses={statuses} campos={campos} tarefasQuadro={tarefas} podeEditar etiquetasSugeridas={etiquetasSugeridas} />
    </section>
  );
}
