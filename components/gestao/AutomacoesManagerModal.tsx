"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Filter, History, Plus, Trash2, Workflow, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import AutomacaoCondicaoBuilder from "@/components/gestao/AutomacaoCondicaoBuilder";
import AutomacaoAcaoEditor from "@/components/gestao/AutomacaoAcaoEditor";
import AutomacoesHistorico from "@/components/gestao/AutomacoesHistorico";
import { AgendaEditor, ModeloTarefaEditor, ParadaEditor } from "@/components/gestao/AutomacaoGatilhoTempo";
import { acoesDaRegra, regraCompleta } from "@/lib/gestao/automacao-completa";
import {
  useAutomacoes, useSalvarAutomacao, useExcluirAutomacao, useUsuariosLista, useUsuarios,
  useModelos, useQuadros, useEtiquetasQuadro,
  type GestaoAutomacao, type GestaoStatus, type GatilhoAutomacao,
  type GestaoCampo, type CondicaoAutomacao, type AcaoAutomacao,
} from "@/lib/hooks/useGestao";

// v298 (Pacote A do levantamento Jira/Trello/ClickUp/Notion): a regra tem VÁRIAS ações, em ordem;
// cada ação pode ter a sua condição ("só se…") — é o se/senão. Gatilhos e condições novos e a aba
// Histórico, que mostra cada execução (rodou, pulou, falhou e por quê).

const GATILHOS: { value: GatilhoAutomacao; label: string; grupo: string }[] = [
  { value: "tarefa_criada", label: "Quando a tarefa é criada", grupo: "Tarefa" },
  { value: "status_muda", label: "Quando o status muda", grupo: "Tarefa" },
  { value: "prioridade_muda", label: "Quando a prioridade muda", grupo: "Tarefa" },
  { value: "campo_muda", label: "Quando um campo muda", grupo: "Tarefa" },
  { value: "etiqueta_adicionada", label: "Quando uma etiqueta é adicionada", grupo: "Tarefa" },
  { value: "tarefa_movida_quadro", label: "Quando a tarefa muda de quadro", grupo: "Tarefa" },
  { value: "subtarefa_concluida", label: "Quando uma subtarefa é concluída", grupo: "Tarefa" },
  { value: "responsavel_adicionado", label: "Quando um responsável é adicionado", grupo: "Pessoas" },
  { value: "comentario_adicionado", label: "Quando alguém comenta", grupo: "Pessoas" },
  { value: "tarefa_aprovada", label: "Quando a tarefa é aprovada", grupo: "Pessoas" },
  { value: "prazo_proximo", label: "Quando o prazo se aproxima", grupo: "Datas" },
  { value: "prazo_vencido", label: "Quando o prazo vence (atrasada)", grupo: "Datas" },
  // v299 (Pacote B) — rodam no relógio, a cada 10 min
  { value: "data_inicio_chega", label: "Quando a data de início chega", grupo: "Datas" },
  { value: "agendado", label: "Em um horário (agenda)", grupo: "Tempo e cobrança" },
  { value: "tarefa_parada", label: "Quando a tarefa fica parada (SLA)", grupo: "Tempo e cobrança" },
  { value: "dependencia_liberada", label: "Quando as tarefas que bloqueiam são concluídas", grupo: "Tempo e cobrança" },
];
const NO_RELOGIO = new Set<GatilhoAutomacao>(["agendado", "tarefa_parada", "data_inicio_chega"]);
const GRUPOS_GATILHO = [...new Set(GATILHOS.map((g) => g.grupo))];

/** Variáveis aceitas nos textos (comentário, e-mail, aviso, título, valor de campo). */
const VARIAVEIS: Partial<Record<GatilhoAutomacao | "sempre", string[]>> = {
  sempre: ["{titulo}", "{responsavel}", "{prazo}", "{status}", "{prioridade}", "{quadro}", "{data}"],
  comentario_adicionado: ["{comentario}", "{autor_comentario}"],
  etiqueta_adicionada: ["{etiqueta}"],
  responsavel_adicionado: ["{novo_responsavel}"],
  tarefa_parada: ["{dias_parada}"],
  dependencia_liberada: ["{bloqueadora}"],
};

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none";
const EMPTY_USUARIOS: { nome: string; email: string }[] = [];

const novoId = () => crypto.randomUUID().slice(0, 8);

export default function AutomacoesManagerModal({
  open, onClose, idQuadro, statuses, campos, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  podeEditar: boolean;
}) {
  const [aba, setAba] = useState<"regras" | "historico">("regras");
  const { data: automacoes = [] } = useAutomacoes(idQuadro);
  const { data: usuarios = [] } = useUsuariosLista();
  const { data: usuariosFull = EMPTY_USUARIOS } = useUsuarios();
  const { data: modelos = [] } = useModelos(idQuadro);
  const { data: quadros = [] } = useQuadros();
  const { data: etiquetas = [] } = useEtiquetasQuadro(idQuadro);
  const salvar = useSalvarAutomacao();
  const excluir = useExcluirAutomacao();
  // ação com o "só se…" aberto (chave: id da regra + id da ação)
  const [condAberta, setCondAberta] = useState<string | null>(null);

  const outrosQuadros = quadros.filter((q) => q.id_quadro !== idQuadro);

  const setCampo = (a: GestaoAutomacao, patch: Partial<GestaoAutomacao>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, ...patch });
  // Merge preserva a condição PLANA legada (de/para/dias_antes) — não zera o que não foi tocado.
  const setCond = (a: GestaoAutomacao, patch: Partial<CondicaoAutomacao>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: { ...a.condicao, ...patch } });
  // Substitui a condição inteira (construtor E/OU e troca de modo). Mantém dias_antes dos gatilhos de prazo.
  // Mantém a configuração do gatilho (prazo, agenda, modelo, parada) — só troca o E/OU.
  const setCondFull = (a: GestaoAutomacao, cond: CondicaoAutomacao) => {
    const { dias_antes, agenda, modo, modelo_tarefa, parada } = a.condicao ?? {};
    const manter = Object.fromEntries(Object.entries({ dias_antes, agenda, modo, modelo_tarefa, parada }).filter(([, v]) => v !== undefined));
    salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: { ...manter, ...cond } });
  };
  const setAcoes = (a: GestaoAutomacao, acoes: AcaoAutomacao[]) => salvar.mutate({ id: a.id, id_quadro: idQuadro, acoes });

  return (
    <Modal open={open} onClose={onClose} title="Automações" size="lg">
      <div className="mb-3 flex gap-1 border-b border-gray-100">
        {([["regras", "Regras", Workflow], ["historico", "Histórico", History]] as const).map(([k, rot, Icone]) => (
          <button key={k} type="button" onClick={() => setAba(k)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium ${aba === k ? "border-verde-primary text-verde-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icone className="size-4" /> {rot}
          </button>
        ))}
      </div>

      {aba === "historico" ? (
        <AutomacoesHistorico idQuadro={idQuadro} />
      ) : (
      <div className="space-y-3">
        {automacoes.map((a) => {
          const usaEou = !!(a.condicao?.all || a.condicao?.any);
          const acoes = acoesDaRegra(a);
          const completa = regraCompleta(a.gatilho, a.condicao, acoes);
          const criaTarefa = a.gatilho === "agendado" && a.condicao?.modo === "criar_tarefa";
          const variaveis = [...(VARIAVEIS.sempre ?? []), ...(VARIAVEIS[a.gatilho] ?? [])];
          const trocarAcao = (i: number, patch: Partial<AcaoAutomacao> | null, substituir = false) => {
            const nova = acoes.map((x, j) => (j === i ? (substituir ? { id: x.id ?? novoId(), ...patch } : { ...x, ...patch }) : x));
            setAcoes(a, nova);
          };
          const mover = (i: number, d: -1 | 1) => {
            const j = i + d;
            if (j < 0 || j >= acoes.length) return;
            const nova = [...acoes];
            [nova[i], nova[j]] = [nova[j], nova[i]];
            setAcoes(a, nova);
          };
          return (
          <div key={a.id} className={`space-y-2 rounded-lg border p-3 ${completa ? "border-gray-200" : "border-amber-300 bg-amber-50/40"}`}>
            {!completa && (
              <p className="text-xs font-medium text-amber-700">Incompleta — toda ação precisa do destino/valor dela; depois marque “Ativa”. Enquanto isso ela não roda.</p>
            )}
            <div className="flex items-center gap-2">
              <input defaultValue={a.nome} disabled={!podeEditar} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) setCampo(a, { nome: v }); }}
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm font-medium focus:border-verde-primary focus:outline-none" />
              <label className="inline-flex items-center gap-1 text-xs text-gray-500" title={completa ? undefined : "Complete as ações para poder ativar"}>
                <input type="checkbox" disabled={!podeEditar || !completa} checked={a.ativo && completa} onChange={(e) => setCampo(a, { ativo: e.target.checked })} className="size-3.5 rounded accent-verde-primary" /> Ativa
              </label>
              {podeEditar && <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir automação "${a.nome}"?` })) excluir.mutate(a.id); }} className="rounded p-1 text-gray-300 hover:text-red-600"><Trash2 className="size-4" /></button>}
            </div>

            {/* QUANDO — gatilho */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-gray-400">Quando</span>
              <select value={a.gatilho} disabled={!podeEditar} onChange={(e) => setCampo(a, { gatilho: e.target.value as GatilhoAutomacao })} className={sel}>
                {GRUPOS_GATILHO.map((g) => (
                  <optgroup key={g} label={g}>
                    {GATILHOS.filter((x) => x.grupo === g).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {/* condição PLANA legada (status_muda) — só no modo simples */}
              {a.gatilho === "status_muda" && !usaEou && (
                <>
                  <span className="text-gray-400">de</span>
                  <select value={a.condicao?.de ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { de: e.target.value || undefined })} className={sel}>
                    <option value="">qualquer</option>
                    {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                  </select>
                  <span className="text-gray-400">para</span>
                  <select value={a.condicao?.para ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { para: e.target.value || undefined })} className={sel}>
                    <option value="">qualquer</option>
                    {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                  </select>
                </>
              )}
              {a.gatilho === "tarefa_parada" && <ParadaEditor condicao={a.condicao ?? {}} onChange={(p) => setCond(a, p)} disabled={!podeEditar} />}
              {a.gatilho === "data_inicio_chega" && (
                <>
                  <input type="number" min={0} max={90} value={a.condicao?.dias_antes ?? "0"} disabled={!podeEditar}
                    onChange={(e) => setCond(a, { dias_antes: e.target.value || undefined })} className={`${sel} w-16`} />
                  <span className="text-gray-400">dia(s) antes (0 = no dia)</span>
                </>
              )}
              {a.gatilho === "prazo_proximo" && (
                <>
                  <input type="number" min={0} max={90} value={a.condicao?.dias_antes ?? "3"} disabled={!podeEditar}
                    onChange={(e) => setCond(a, { dias_antes: e.target.value || undefined })} className={`${sel} w-16`} />
                  <span className="text-gray-400">dia(s) antes do prazo</span>
                </>
              )}
            </div>

            {a.gatilho === "agendado" && (
              <div className="space-y-2 pl-1">
                <AgendaEditor condicao={a.condicao ?? {}} onChange={(p) => setCond(a, p)} disabled={!podeEditar} />
                {criaTarefa && (
                  <ModeloTarefaEditor key={a.id} modelo={a.condicao?.modelo_tarefa ?? {}} onChange={(m) => setCond(a, { modelo_tarefa: m })}
                    etiquetas={etiquetas} usuariosFull={usuariosFull} disabled={!podeEditar} variaveis="{data}" />
                )}
              </div>
            )}

            {/* SE — condição E/OU da regra (todos os gatilhos) */}
            {!criaTarefa && <div className="space-y-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" disabled={!podeEditar} checked={usaEou}
                  onChange={(e) => setCondFull(a, e.target.checked ? { all: [] } : {})} className="size-3.5 rounded accent-verde-primary" />
                Só rodar se… (condição E/OU)
              </label>
              {usaEou && (
                <AutomacaoCondicaoBuilder key={a.id} condicao={a.condicao} statuses={statuses} campos={campos} quadros={quadros}
                  etiquetas={etiquetas} disabled={!podeEditar} onAplicar={(cond) => setCondFull(a, cond)} />
              )}
            </div>}

            {/* ENTÃO — ações, em ordem */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase text-gray-400">{criaTarefa ? "Depois, na tarefa criada (opcional)" : "Então, em ordem"}</span>
              {acoes.map((x, i) => {
                const chave = `${a.id}:${x.id ?? i}`;
                const temCond = !!(x.condicao?.all || x.condicao?.any);
                return (
                  <div key={x.id ?? i} className="rounded-md border border-gray-100 bg-white p-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-verde-light text-[11px] font-bold text-verde-primary">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <AutomacaoAcaoEditor
                          acao={x}
                          onChange={(patch) => trocarAcao(i, patch)}
                          onTrocarTipo={(tipo) => trocarAcao(i, { tipo, ...(x.condicao ? { condicao: x.condicao } : {}) }, true)}
                          statuses={statuses} campos={campos} etiquetas={etiquetas} quadros={quadros} outrosQuadros={outrosQuadros}
                          modelos={modelos} usuarios={usuarios} usuariosFull={usuariosFull} disabled={!podeEditar}
                        />
                      </div>
                      {podeEditar && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" title="Só executar esta ação se…" onClick={() => setCondAberta(condAberta === chave ? null : chave)}
                            className={`rounded p-1 ${temCond ? "text-verde-primary" : "text-gray-300 hover:text-gray-600"}`}><Filter className="size-3.5" /></button>
                          <button type="button" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                          <button type="button" title="Descer" disabled={i === acoes.length - 1} onClick={() => mover(i, 1)} className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                          <button type="button" title="Remover ação" onClick={() => setAcoes(a, acoes.filter((_, j) => j !== i))} className="rounded p-1 text-gray-300 hover:text-red-600"><X className="size-3.5" /></button>
                        </div>
                      )}
                    </div>
                    {temCond && condAberta !== chave && (
                      <p className="mt-1 pl-7 text-[11px] text-verde-primary">Só executa se a condição da ação casar.</p>
                    )}
                    {condAberta === chave && (
                      <div className="mt-2 space-y-1 pl-7">
                        <p className="text-[11px] text-gray-500">Só executa esta ação se… (as outras ações seguem normalmente). Para um “senão”, crie outra ação com a condição oposta.</p>
                        <AutomacaoCondicaoBuilder key={chave} condicao={x.condicao ?? {}} statuses={statuses} campos={campos} quadros={quadros}
                          etiquetas={etiquetas} disabled={!podeEditar}
                          onAplicar={(cond) => trocarAcao(i, { condicao: (cond.all?.length || cond.any?.length) ? cond : undefined })} />
                      </div>
                    )}
                  </div>
                );
              })}
              {podeEditar && (
                <button type="button" onClick={() => setAcoes(a, [...acoes, { id: novoId() }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-verde-primary hover:underline">
                  <Plus className="size-3.5" /> Adicionar ação
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              Variáveis nos textos: {variaveis.join(" ")}
              {(a.gatilho === "prazo_proximo" || a.gatilho === "prazo_vencido") && " · Verificada todo dia às 7h pelo servidor."}
              {NO_RELOGIO.has(a.gatilho) && " · Verificada pelo servidor a cada 10 minutos (não precisa estar com o quadro aberto)."}
            </p>
          </div>
        );})}
        {podeEditar && (
          <button type="button" onClick={() => salvar.mutate({ id_quadro: idQuadro, nome: "Nova automação", gatilho: "status_muda", ordem: automacoes.length, ativo: false, acoes: [{ id: novoId() }] })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Nova automação
          </button>
        )}
        {automacoes.length === 0 && !podeEditar && <p className="text-sm text-gray-400">Nenhuma automação.</p>}
        <p className="pt-1 text-xs text-gray-400">As automações rodam no servidor: os gatilhos da tarefa disparam na hora; os de prazo, todo dia às 7h; agenda, tarefa parada e data de início, a cada 10 minutos. Veja o que rodou na aba Histórico.</p>
      </div>
      )}
    </Modal>
  );
}
