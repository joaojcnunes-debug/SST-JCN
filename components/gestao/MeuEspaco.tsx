"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KanbanSquare, LayoutList, CalendarClock, CheckSquare, List, Eye, EyeOff } from "lucide-react";
import MinhasTarefas from "@/components/gestao/MinhasTarefas";
import MeuQuadro from "@/components/gestao/MeuQuadro";
import { PRIORIDADES, useSalvarTarefa, type GestaoTarefa, type GestaoStatus, type GestaoQuadro, type PrioridadeTarefa } from "@/lib/hooks/useGestao";
import { useMeusNiveisQuadros, nivelPodeEditar } from "@/lib/hooks/useGestaoAcesso";

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000);
}
const fmtPrazo = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

// Filas de urgência: da mais urgente para a menos (PRIORIDADES está em ordem crescente).
const FILAS: { value: PrioridadeTarefa; label: string; cor: string }[] = [...PRIORIDADES].reverse();

/**
 * "Meu Espaço" — o espaço pessoal do usuário (UX-C1 + kanban por urgência).
 *
 * Dados: a vista AGREGADA das tarefas em que o usuário é responsável OU seguidor, em
 * qualquer quadro (`useMinhasTarefas`, RLS/F1.3-B — só recebe o que enxerga).
 *
 * Vistas: **Kanban por urgência** (default; pedido do operador 2026-09-18) — uma fila por
 * prioridade, Urgente → Baixa, concluídas ocultas por padrão; e **Lista** por quadro
 * (`MinhasTarefas`, a vista original). Abrir o card leva ao modal da tarefa no quadro dela.
 *
 * Arrastar entre filas = mudar a prioridade (UX-03). A vista mistura quadros, e o nível de
 * edição é POR QUADRO: `useMeusNiveisQuadros` resolve `gestao_meu_nivel` para cada quadro
 * presente (gestor pula a consulta — é `full` em todos). Card sem edição não arrasta. A escrita
 * é a mesma do Quadro agrupado por prioridade (`useSalvarTarefa` → RLS `_wr` decide de novo no
 * servidor); a fila muda na hora (otimista) e o refetch de `gestao-minhas` confirma.
 *
 * PONTO DE EXTENSÃO — UX-C(2): o QUADRO PESSOAL do usuário (lista própria em
 * `gestao_quadros`, RLS dono+admin) entra acima destas vistas; nada de banco aqui.
 */
export default function MeuEspaco({
  tarefas,
  quadros,
  statusMap,
  souGestor,
  onAbrir,
  onAbrirQuadro,
}: {
  tarefas: GestaoTarefa[];
  quadros: GestaoQuadro[];
  statusMap: Map<string, GestaoStatus>;
  souGestor: boolean;
  onAbrir: (t: GestaoTarefa) => void;
  /** v235: abre o Meu Quadro como quadro completo (lista/calendário/timeline). */
  onAbrirQuadro: (idQuadro: string) => void;
}) {
  const [vista, setVista] = useState<"kanban" | "lista">("kanban");
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const nomeQuadro = useMemo(() => new Map(quadros.map((q) => [q.id_quadro, q.nome])), [quadros]);

  // Nível de edição por quadro (só para não-gestor; gestor é `full` em todos).
  const idsQuadros = useMemo(() => [...new Set(tarefas.map((t) => t.id_quadro))].sort(), [tarefas]);
  const niveis = useMeusNiveisQuadros(idsQuadros, !souGestor);
  const podeEditar = (t: GestaoTarefa) => souGestor || nivelPodeEditar(niveis.get(t.id_quadro));

  // Prioridade otimista: vale só até o refetch de gestao-minhas terminar (onSettled). Depois o
  // valor do servidor manda — se a RLS recusou em silêncio (PATCH 204 com 0 linhas), o card volta
  // para a fila de origem em vez de ficar preso na errada (ressalva R1 do portão UX-03).
  const qc = useQueryClient();
  const salvar = useSalvarTarefa();
  const [otimista, setOtimista] = useState<Record<string, PrioridadeTarefa>>({});
  const limparOtimista = (id: string) => setOtimista((o) => { if (!(id in o)) return o; const n = { ...o }; delete n[id]; return n; });
  const prioridadeDe = (t: GestaoTarefa): PrioridadeTarefa => otimista[t.id_tarefa] ?? t.prioridade;

  const [dragId, setDragId] = useState<string | null>(null);
  const [filaHover, setFilaHover] = useState<PrioridadeTarefa | null>(null);
  function soltar(fila: PrioridadeTarefa) {
    setFilaHover(null);
    const t = tarefas.find((x) => x.id_tarefa === dragId);
    setDragId(null);
    if (!t || !podeEditar(t) || prioridadeDe(t) === fila) return;
    setOtimista((o) => ({ ...o, [t.id_tarefa]: fila }));
    salvar.mutate(
      { id_tarefa: t.id_tarefa, id_quadro: t.id_quadro, prioridade: fila },
      {
        onError: () => limparOtimista(t.id_tarefa),
        // onSuccess do hook já invalida gestao-minhas; aqui esperamos o refetch ATIVO terminar
        // antes de soltar o otimista, para não piscar de volta e depois pular.
        onSettled: async () => { await qc.invalidateQueries({ queryKey: ["gestao-minhas"] }); limparOtimista(t.id_tarefa); },
      },
    );
  }

  const concluida = (t: GestaoTarefa) => statusMap.get(`${t.id_quadro}|${t.status}`)?.tipo === "concluido";
  const visiveis = useMemo(
    () => (mostrarConcluidas ? tarefas : tarefas.filter((t) => statusMap.get(`${t.id_quadro}|${t.status}`)?.tipo !== "concluido")),
    [tarefas, mostrarConcluidas, statusMap],
  );
  const ocultas = tarefas.length - visiveis.length;

  // Dentro da fila: atrasadas primeiro, depois prazo mais próximo, sem prazo por último.
  const porFila = useMemo(() => {
    const m = new Map<PrioridadeTarefa, GestaoTarefa[]>(FILAS.map((f) => [f.value, []]));
    for (const t of visiveis) (m.get(otimista[t.id_tarefa] ?? t.prioridade) ?? m.get("Media"))!.push(t);
    for (const lista of m.values()) {
      lista.sort((a, b) => {
        if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo) || a.created_at.localeCompare(b.created_at);
        if (a.prazo) return -1;
        if (b.prazo) return 1;
        return a.created_at.localeCompare(b.created_at);
      });
    }
    return m;
  }, [visiveis, otimista]);

  const algumEditavel = souGestor || visiveis.some((t) => nivelPodeEditar(niveis.get(t.id_quadro)));

  return (
    <div className="mt-4">
      {/* v235: o quadro PESSOAL primeiro (criar/arrastar); abaixo, as tarefas em que estou vinculado. */}
      <MeuQuadro onAbrirCompleto={onAbrirQuadro} />
      <h2 className="mt-6 text-base font-semibold text-gray-800">Tarefas em que estou vinculado <span className="text-sm font-normal text-gray-400">— {tarefas.length} em outros quadros</span></h2>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
          <button type="button" onClick={() => setVista("kanban")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${vista === "kanban" ? "bg-verde-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            <KanbanSquare className="size-4" /> Por urgência
          </button>
          <button type="button" onClick={() => setVista("lista")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${vista === "lista" ? "bg-verde-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            <LayoutList className="size-4" /> Por quadro
          </button>
        </div>
        <button type="button" onClick={() => setMostrarConcluidas((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${mostrarConcluidas ? "border-verde-primary bg-verde-light/60 text-verde-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
          {mostrarConcluidas ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {mostrarConcluidas ? "Ocultar concluídas" : `Mostrar concluídas${ocultas > 0 ? ` (${ocultas})` : ""}`}
        </button>
      </div>

      {vista === "lista" ? (
        <MinhasTarefas tarefas={visiveis} quadros={quadros} statusMap={statusMap} onAbrir={onAbrir} />
      ) : tarefas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">Você não tem tarefas atribuídas.</div>
      ) : (
        <>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {FILAS.map((fila) => {
            const lista = porFila.get(fila.value) ?? [];
            const atrasadas = lista.filter((t) => t.prazo && diasAte(t.prazo) < 0 && !concluida(t)).length;
            return (
              <div
                key={fila.value}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setFilaHover(fila.value); } }}
                onDragLeave={(e) => { if (dragId && !e.currentTarget.contains(e.relatedTarget as Node)) setFilaHover((f) => (f === fila.value ? null : f)); }}
                onDrop={() => soltar(fila.value)}
                /* Mesma régua do Quadro: a fila ocupa a altura livre da tela e rola por dentro.
                   12rem ≈ cabeçalho (título + barra de vistas) + rodapé da página. */
                className={`flex h-[max(320px,calc(100vh-12rem))] w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 p-2.5 transition ${filaHover === fila.value ? "border-verde-primary ring-2 ring-verde-primary/20" : "border-gray-200"}`}
                style={{ borderTopColor: fila.cor, borderTopWidth: 3 }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
                  <span className="size-2.5 rounded-full" style={{ background: fila.cor }} />
                  <p className="text-sm font-semibold text-gray-700">{fila.label}</p>
                  <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-600">{lista.length}</span>
                  {atrasadas > 0 && <span className="rounded-full bg-red-50 px-1.5 text-[11px] font-semibold text-red-600" title="Atrasadas">{atrasadas} atras.</span>}
                </div>
                <div className="min-h-[40px] flex-1 space-y-2 overflow-y-auto overscroll-contain p-0.5">
                  {lista.map((t) => {
                    const st = statusMap.get(`${t.id_quadro}|${t.status}`);
                    const concl = st?.tipo === "concluido";
                    const dias = t.prazo ? diasAte(t.prazo) : null;
                    const atrasada = dias != null && dias < 0 && !concl;
                    const subs = t.subtarefas ?? [];
                    const subFeitas = subs.filter((s) => s.feito).length;
                    const editavel = podeEditar(t);
                    return (
                      <div
                        key={t.id_tarefa}
                        role="button"
                        tabIndex={0}
                        draggable={editavel}
                        onDragStart={() => setDragId(t.id_tarefa)}
                        onDragEnd={() => { setDragId(null); setFilaHover(null); }}
                        onClick={() => onAbrir(t)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir(t); } }}
                        title={`${t.titulo} · ${nomeQuadro.get(t.id_quadro) ?? "Lista"} · ${st?.nome ?? t.status}${atrasada ? " · atrasada" : ""}${editavel ? "" : " · sem permissão de edição neste quadro (não arrasta)"}`}
                        style={{ borderLeftColor: fila.cor }}
                        className={`block w-full rounded-lg border border-l-4 border-gray-200 bg-white p-3 text-left shadow-sm transition-all duration-150 hover:border-gray-300 hover:shadow-md ${editavel ? "cursor-grab active:cursor-grabbing hover:-translate-y-0.5" : "cursor-pointer"} ${dragId === t.id_tarefa ? "rotate-1 opacity-40" : ""}`}
                      >
                        <p className={`text-sm font-medium ${concl ? "text-gray-400 line-through" : "text-gray-800"}`}>{t.titulo}</p>
                        <p className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-gray-500">
                          <List className="size-3 shrink-0 text-gray-400" /> {nomeQuadro.get(t.id_quadro) ?? "Lista"}
                        </p>
                        {subs.length > 0 && (
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-1 rounded-full bg-verde-primary transition-all" style={{ width: `${Math.round((subFeitas / subs.length) * 100)}%` }} />
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {st && <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: (st.cor ?? "#999") + "22", color: st.cor }}>{st.nome}</span>}
                          {t.prazo && (
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${atrasada ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                              <CalendarClock className="size-3" /> {dias === 0 ? "hoje" : fmtPrazo(t.prazo)}
                            </span>
                          )}
                          {subs.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500" title="Subtarefas">
                              <CheckSquare className="size-3" /> {subFeitas}/{subs.length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {lista.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 px-2 py-6 text-center text-xs text-gray-300">Nada aqui</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {algumEditavel && (
          <p className="mt-3 text-center text-xs text-gray-400">Arraste um card para outra fila para mudar a prioridade (só nos quadros em que você pode editar).</p>
        )}
        </>
      )}
    </div>
  );
}
