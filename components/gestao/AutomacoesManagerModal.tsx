"use client";

import { Plus, Trash2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import AutomacaoCondicaoBuilder from "@/components/gestao/AutomacaoCondicaoBuilder";
import {
  useAutomacoes, useSalvarAutomacao, useExcluirAutomacao, useUsuariosLista, useUsuarios,
  useModelos, useQuadros,
  PRIORIDADES, type GestaoAutomacao, type GestaoStatus, type GatilhoAutomacao,
  type GestaoCampo, type CondicaoAutomacao, type AcaoAutomacao,
} from "@/lib/hooks/useGestao";

const GATILHOS: { value: GatilhoAutomacao; label: string }[] = [
  { value: "status_muda", label: "Quando o status muda" },
  { value: "tarefa_criada", label: "Quando a tarefa é criada" },
  { value: "tarefa_movida_quadro", label: "Quando a tarefa muda de quadro" },
  { value: "subtarefa_concluida", label: "Quando uma subtarefa é concluída" },
  { value: "tarefa_aprovada", label: "Quando a tarefa é aprovada" },
  { value: "prazo_proximo", label: "Quando o prazo se aproxima" },
  { value: "prazo_vencido", label: "Quando o prazo vence (atrasada)" },
];

const ACOES: { value: string; label: string }[] = [
  { value: "mover_status", label: "Mover para status" },
  { value: "definir_responsavel", label: "Definir responsável" },
  { value: "definir_prioridade", label: "Definir prioridade" },
  { value: "definir_campo", label: "Definir campo" },
  { value: "notificar", label: "Notificar todos os vinculados" },
  { value: "adicionar_vinculados", label: "Adicionar vinculados (responsável/seguidor)" },
  { value: "solicitar_aprovacao", label: "Solicitar aprovação" },
  { value: "mover_tarefa_quadro", label: "Mover tarefa para outro quadro" },
  { value: "criar_tarefa_quadro", label: "Criar tarefa em outro quadro" },
  { value: "criar_subtarefas_modelo", label: "Criar subtarefas a partir de modelo" },
];

// Gatilhos que passam pelo avaliador E/OU (gestao_automacao_cond_bate). Os de prazo
// usam só `dias_antes` (o motor de prazos não chama cond_bate) — sem E/OU lá.
const GATILHOS_EOU = new Set<GatilhoAutomacao>([
  "status_muda", "tarefa_criada", "tarefa_movida_quadro", "subtarefa_concluida", "tarefa_aprovada",
]);

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none";

const EMPTY_USUARIOS: { nome: string; email: string }[] = [];

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
  const { data: automacoes = [] } = useAutomacoes(idQuadro);
  const { data: usuarios = [] } = useUsuariosLista();
  const { data: usuariosFull = EMPTY_USUARIOS } = useUsuarios();
  const { data: modelos = [] } = useModelos(idQuadro);
  const { data: quadros = [] } = useQuadros();
  const salvar = useSalvarAutomacao();
  const excluir = useExcluirAutomacao();

  const outrosQuadros = quadros.filter((q) => q.id_quadro !== idQuadro);

  const setCampo = (a: GestaoAutomacao, patch: Partial<GestaoAutomacao>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, ...patch });
  // Merge preserva a condição PLANA legada (de/para/dias_antes) — não zera o que não foi tocado.
  const setCond = (a: GestaoAutomacao, patch: Partial<CondicaoAutomacao>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: { ...a.condicao, ...patch } });
  // Substitui a condição inteira (usado pelo construtor E/OU e pela troca de modo).
  const setCondFull = (a: GestaoAutomacao, cond: CondicaoAutomacao) => salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: cond });
  const setAcao = (a: GestaoAutomacao, patch: Partial<AcaoAutomacao>) => salvar.mutate({ id: a.id, id_quadro: idQuadro, acao: { ...a.acao, ...patch } });
  // Troca de tipo de ação: reset para {tipo} evita chaves órfãs de outra ação.
  const trocarAcao = (a: GestaoAutomacao, tipo: string) => salvar.mutate({ id: a.id, id_quadro: idQuadro, acao: { tipo } });

  return (
    <Modal open={open} onClose={onClose} title="Automações" size="lg">
      <div className="space-y-3">
        {automacoes.map((a) => {
          const usaEou = !!(a.condicao?.all || a.condicao?.any);
          const emails = a.acao?.emails ?? [];
          return (
          <div key={a.id} className="space-y-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <input defaultValue={a.nome} disabled={!podeEditar} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) setCampo(a, { nome: v }); }}
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm font-medium focus:border-verde-primary focus:outline-none" />
              <label className="inline-flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" disabled={!podeEditar} checked={a.ativo} onChange={(e) => setCampo(a, { ativo: e.target.checked })} className="size-3.5 rounded accent-verde-primary" /> Ativa
              </label>
              {podeEditar && <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir automação "${a.nome}"?` })) excluir.mutate(a.id); }} className="rounded p-1 text-gray-300 hover:text-red-600"><Trash2 className="size-4" /></button>}
            </div>

            {/* QUANDO — gatilho */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-gray-400">Quando</span>
              <select value={a.gatilho} disabled={!podeEditar} onChange={(e) => setCampo(a, { gatilho: e.target.value as GatilhoAutomacao })} className={sel}>
                {GATILHOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
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
              {a.gatilho === "prazo_proximo" && (
                <>
                  <input type="number" min={0} max={90} value={a.condicao?.dias_antes ?? "3"} disabled={!podeEditar}
                    onChange={(e) => setCond(a, { dias_antes: e.target.value || undefined })} className={`${sel} w-16`} />
                  <span className="text-gray-400">dia(s) antes do prazo</span>
                </>
              )}
            </div>

            {/* CONDIÇÃO avançada E/OU — só nos gatilhos que passam por cond_bate */}
            {GATILHOS_EOU.has(a.gatilho) && (
              <div className="space-y-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    disabled={!podeEditar}
                    checked={usaEou}
                    onChange={(e) => setCondFull(a, e.target.checked ? { all: [] } : {})}
                    className="size-3.5 rounded accent-verde-primary"
                  />
                  Condição avançada (E/OU)
                </label>
                {usaEou && (
                  <AutomacaoCondicaoBuilder
                    key={a.id}
                    condicao={a.condicao}
                    statuses={statuses}
                    campos={campos}
                    quadros={quadros}
                    disabled={!podeEditar}
                    onAplicar={(cond) => setCondFull(a, cond)}
                  />
                )}
              </div>
            )}

            {/* ENTÃO — ação */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-gray-400">Então</span>
              <select value={a.acao?.tipo ?? ""} disabled={!podeEditar} onChange={(e) => trocarAcao(a, e.target.value)} className={sel}>
                <option value="">escolher ação…</option>
                {ACOES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>

              {a.acao?.tipo === "mover_status" && (
                <select value={a.acao?.valor ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { valor: e.target.value })} className={sel}>
                  <option value="">status…</option>
                  {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                </select>
              )}

              {a.acao?.tipo === "definir_responsavel" && (
                <>
                  <input list="autom-usuarios" defaultValue={a.acao?.valor ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { valor: e.target.value.trim() })} placeholder="responsável" className={sel} />
                  <datalist id="autom-usuarios">{usuarios.map((u) => <option key={u} value={u} />)}</datalist>
                </>
              )}

              {a.acao?.tipo === "definir_prioridade" && (
                <select value={a.acao?.valor ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { valor: e.target.value })} className={sel}>
                  <option value="">prioridade…</option>
                  {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              )}

              {a.acao?.tipo === "definir_campo" && (
                <>
                  <select value={a.acao?.campo_id ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { campo_id: e.target.value, valor: undefined })} className={sel}>
                    <option value="">campo…</option>
                    {campos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <input defaultValue={a.acao?.valor ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { valor: e.target.value.trim() })} placeholder="valor" className={sel} />
                  {campos.length === 0 && <span className="text-[11px] text-gray-400">crie um campo primeiro</span>}
                </>
              )}

              {a.acao?.tipo === "notificar" && (
                <input defaultValue={a.acao?.valor ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { valor: e.target.value.trim() })} placeholder="mensagem (opcional)" className={`${sel} flex-1`} />
              )}

              {a.acao?.tipo === "criar_subtarefas_modelo" && (
                <>
                  <select value={a.acao?.modelo_slug ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { modelo_slug: e.target.value || undefined })} className={sel}>
                    <option value="">modelo…</option>
                    {modelos.map((m) => <option key={m.slug} value={m.slug}>{m.titulo}</option>)}
                  </select>
                  {modelos.length === 0 && <span className="text-[11px] text-gray-400">crie um modelo de checklist primeiro</span>}
                </>
              )}

              {a.acao?.tipo === "solicitar_aprovacao" && (
                <div className="min-w-[14rem]">
                  <UsuarioCombobox
                    usuarios={usuariosFull}
                    value={a.acao?.aprovador_email ?? ""}
                    onChange={(email) => setAcao(a, { aprovador_email: email || undefined })}
                    disabled={!podeEditar}
                    incluirVazio
                    vazioLabel="Qualquer gestor"
                    placeholder="Aprovador (opcional)"
                    className={`${sel} w-full`}
                  />
                </div>
              )}

              {(a.acao?.tipo === "mover_tarefa_quadro" || a.acao?.tipo === "criar_tarefa_quadro") && (
                <select value={a.acao?.id_quadro_destino ?? ""} disabled={!podeEditar} onChange={(e) => setAcao(a, { id_quadro_destino: e.target.value || undefined })} className={sel}>
                  <option value="">quadro destino…</option>
                  {(a.acao?.tipo === "mover_tarefa_quadro" ? outrosQuadros : quadros).map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
                </select>
              )}

              {a.acao?.tipo === "mover_tarefa_quadro" && (
                <input defaultValue={a.acao?.status_destino ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { status_destino: e.target.value.trim() || undefined })} placeholder="status destino (slug, opcional)" className={sel} />
              )}

              {a.acao?.tipo === "criar_tarefa_quadro" && (
                <>
                  <input defaultValue={a.acao?.titulo_template ?? ""} disabled={!podeEditar} onBlur={(e) => setAcao(a, { titulo_template: e.target.value.trim() || undefined })} placeholder="título (use {{titulo}})" className={`${sel} min-w-[10rem]`} />
                  <label className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" disabled={!podeEditar} checked={a.acao?.copiar_campos === "true"} onChange={(e) => setAcao(a, { copiar_campos: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-verde-primary" /> copiar campos
                  </label>
                </>
              )}
            </div>

            {/* config extra da ação adicionar_vinculados (linha própria: chips + tipo) */}
            {a.acao?.tipo === "adicionar_vinculados" && (
              <div className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/60 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase text-gray-400">Vincular como</span>
                  <select value={a.acao?.vinculo_tipo ?? "seguidor"} disabled={!podeEditar} onChange={(e) => setAcao(a, { vinculo_tipo: e.target.value })} className={sel}>
                    <option value="seguidor">Seguidor</option>
                    <option value="responsavel">Responsável</option>
                  </select>
                </div>
                {emails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {emails.map((em) => (
                      <span key={em} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs font-medium text-verde-primary">
                        {em}
                        {podeEditar && (
                          <button type="button" onClick={() => setAcao(a, { emails: emails.filter((x) => x !== em) })} className="text-verde-primary/60 hover:text-red-600" aria-label={`Remover ${em}`}><X className="size-3" /></button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {podeEditar && (
                  <div className="max-w-xs">
                    <UsuarioCombobox
                      usuarios={usuariosFull}
                      value=""
                      onChange={(email) => { if (email && !emails.includes(email)) setAcao(a, { emails: [...emails, email] }); }}
                      placeholder="Adicionar usuário…"
                      className={`${sel} w-full`}
                    />
                  </div>
                )}
              </div>
            )}

            {(a.gatilho === "prazo_proximo" || a.gatilho === "prazo_vencido") && <p className="text-[11px] text-gray-400">Verificada diariamente pelo servidor (não precisa estar com o quadro aberto).</p>}
          </div>
        );})}
        {podeEditar && (
          <button type="button" onClick={() => salvar.mutate({ id_quadro: idQuadro, nome: "Nova automação", gatilho: "status_muda", ordem: automacoes.length })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Nova automação
          </button>
        )}
        {automacoes.length === 0 && !podeEditar && <p className="text-sm text-gray-400">Nenhuma automação.</p>}
        <p className="pt-1 text-xs text-gray-400">As automações rodam no servidor: status/criação/aprovação/subtarefa disparam na hora; as de prazo são verificadas diariamente.</p>
      </div>
    </Modal>
  );
}
