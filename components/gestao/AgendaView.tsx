"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import VistaCalendario from "@/components/gestao/VistaCalendario";
import { useAgendaDe, type GestaoQuadro, type GestaoStatus, type GestaoTarefa, type TarefaAgenda } from "@/lib/hooks/useGestao";
import { normalizarTexto } from "@/lib/busca/texto";
import { cn } from "@/lib/utils";

type Tipo = "tudo" | "tarefas" | "subtarefas";

/**
 * Agenda (pedido de 10/11/2026): numa página só, o que cada pessoa tem em cada dia — as tarefas (os serviços) e as
 * subtarefas (as visitas às empresas) em que ela é responsável, em todas as listas que eu vejo. Abre na minha agenda;
 * a lateral escolhe uma ou várias pessoas (ou uma equipe inteira). Por ora TODOS podem ver a agenda de todos; o que
 * aparece segue o acesso de cada lista (a RLS decide em `useAgendaDe`).
 *
 * As datas se mudam abrindo a tarefa (a janela confere a permissão da lista): na Agenda não se arrasta.
 */
export default function AgendaView({
  quadros,
  statusGlobalMap,
  pessoas,
  equipes,
  membrosPorEquipe,
  eu,
  onAbrir,
}: {
  quadros: GestaoQuadro[];
  /** Status de todas as listas, por `${id_quadro}|${slug}`. */
  statusGlobalMap: Map<string, GestaoStatus>;
  pessoas: { email: string; nome: string }[];
  /** As equipes cujos membros eu vejo. */
  equipes: { id: string; nome: string }[];
  membrosPorEquipe: Map<string, string[]>;
  eu: string | null;
  onAbrir: (t: GestaoTarefa) => void;
}) {
  const [escolhidos, setEscolhidos] = useState<string[]>(() => (eu ? [eu.toLowerCase()] : []));
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<Tipo>("tudo");
  const [periodo, setPeriodo] = useState<[string, string]>(["", ""]);
  const aoPeriodo = useCallback((a: string, b: string) => setPeriodo((p) => (p[0] === a && p[1] === b ? p : [a, b])), []);

  const { data: tarefas = [], isFetching } = useAgendaDe(escolhidos, periodo[0], periodo[1]);

  const nomePorEmail = useMemo(() => new Map(pessoas.map((p) => [p.email.toLowerCase(), p.nome])), [pessoas]);
  const nomeQuadro = useMemo(() => new Map(quadros.map((q) => [q.id_quadro, q.nome])), [quadros]);
  const ordenadas = useMemo(() => {
    const euMin = eu?.toLowerCase();
    return [...pessoas].sort((a, b) => (a.email.toLowerCase() === euMin ? -1 : b.email.toLowerCase() === euMin ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));
  }, [pessoas, eu]);
  const termo = normalizarTexto(busca);
  const pessoasVisiveis = termo ? ordenadas.filter((p) => normalizarTexto(p.nome).includes(termo)) : ordenadas;

  // O calendário mostra os responsáveis pelo texto `responsavel`: aqui ele vira os nomes das pessoas da agenda
  // (só para desenhar — a janela da tarefa relê a tarefa do banco).
  const visiveis = useMemo(
    () =>
      tarefas
        .filter((t) => (tipo === "tudo" ? true : tipo === "subtarefas" ? !!t.id_tarefa_pai : !t.id_tarefa_pai))
        .map((t): TarefaAgenda => ({ ...t, responsavel: t.emails_agenda.map((e) => nomePorEmail.get(e) ?? e).join(", ") })),
    [tarefas, tipo, nomePorEmail],
  );
  const nSub = tarefas.filter((t) => t.id_tarefa_pai).length;

  const statusDe = (t: GestaoTarefa) => statusGlobalMap.get(`${t.id_quadro}|${t.status}`);
  const alternar = (email: string) =>
    setEscolhidos((s) => (s.includes(email) ? s.filter((x) => x !== email) : [...s, email]));

  const lateral = (
    <div aria-label="Pessoas da agenda" className="space-y-4 text-sm">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mostrar</p>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
          {([["tudo", "Tudo"], ["tarefas", "Tarefas"], ["subtarefas", "Subtarefas"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTipo(k)} aria-pressed={tipo === k}
              className={cn("flex-1 rounded-md px-2 py-1 font-medium", tipo === k ? "bg-marca-primary text-white" : "text-gray-600 hover:bg-gray-50")}>
              {l}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">
          Tarefas são os serviços; subtarefas (↳) são as etapas dentro deles, como a visita a uma empresa.
        </p>
      </div>

      {equipes.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Equipes</p>
          <div className="flex flex-wrap gap-1.5">
            {equipes.map((e) => (
              <button key={e.id} type="button" onClick={() => setEscolhidos(membrosPorEquipe.get(e.id) ?? [])}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:border-marca-primary hover:text-marca-primary">
                <Users className="size-3" /> {e.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <p className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-gray-500">Pessoas ({escolhidos.length})</p>
          {eu && (
            <button type="button" onClick={() => setEscolhidos([eu.toLowerCase()])} className="text-[11px] font-medium text-marca-primary hover:underline">Só eu</button>
          )}
          <button type="button" onClick={() => setEscolhidos([])} className="text-[11px] font-medium text-gray-500 hover:underline">Limpar</button>
        </div>
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa…"
            className="w-full rounded-md border border-gray-200 py-1 pl-7 pr-2 text-sm focus:border-marca-primary focus:outline-none" />
        </div>
        <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
          {pessoasVisiveis.map((p) => {
            const e = p.email.toLowerCase();
            return (
              <li key={e}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-50">
                  <input type="checkbox" checked={escolhidos.includes(e)} onChange={() => alternar(e)} className="size-3.5 rounded accent-marca-primary" />
                  <span className="truncate">{p.nome}{e === eu?.toLowerCase() ? " (eu)" : ""}</span>
                </label>
              </li>
            );
          })}
          {!pessoasVisiveis.length && <li className="px-1.5 py-1 text-xs text-gray-400">Ninguém com esse nome.</li>}
        </ul>
      </div>
    </div>
  );

  return (
    <div>
      {!escolhidos.length && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Escolha ao menos uma pessoa na coluna da esquerda.</p>
      )}
      <VistaCalendario
        tarefas={visiveis}
        statuses={[]}
        podeEditar={false}
        concluida={(t) => statusDe(t)?.tipo === "concluido"}
        statusDe={statusDe}
        rotulo={(t) => nomeQuadro.get(t.id_quadro) ?? "Lista"}
        inicioSemPrazo
        onAbrir={onAbrir}
        onPeriodo={aoPeriodo}
        carregando={isFetching}
        lateral={lateral}
      />
      {nSub > 0 && tipo !== "tarefas" && (
        <p className="mt-2 text-xs text-gray-500">{nSub} subtarefa(s) no período. Subtarefa sem data não aparece: abra a subtarefa e preencha o prazo.</p>
      )}
    </div>
  );
}
