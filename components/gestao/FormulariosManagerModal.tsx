"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Link2, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import MultiChipInput from "@/components/ui/MultiChipInput";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import { confirmar } from "@/components/ui/confirm";
import { dependentesDe } from "@/lib/gestao/formularios";
import {
  useFormulariosQuadro, useSalvarFormulario, useExcluirFormulario, useUsuarios, useCamposQuadro, novoIdPergunta,
  PRIORIDADES, type GestaoFormulario, type PerguntaFormulario, type TipoPergunta, type GestaoStatus, type GestaoEtiqueta,
} from "@/lib/hooks/useGestao";

const inputCls = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none";

// F1 (GESTAO-KANBAN-03): tipos de pergunta e o destino (onde a resposta é gravada na tarefa).
const TIPOS: { value: TipoPergunta; label: string }[] = [
  { value: "texto", label: "Texto" }, { value: "texto_longo", label: "Texto longo" },
  { value: "email", label: "E-mail" }, { value: "cnpj", label: "CNPJ" }, { value: "cpf", label: "CPF" },
  { value: "telefone", label: "Telefone" }, { value: "data", label: "Data" }, { value: "data_hora", label: "Data e hora" },
  { value: "selecao", label: "Seleção (uma)" }, { value: "multipla", label: "Seleção (várias)" },
];

const EMPTY_USUARIOS: { nome: string; email: string }[] = [];

type Draft = Pick<GestaoFormulario,
  "titulo" | "descricao" | "ativo" | "mostra_descricao" | "mostra_prazo" | "mostra_prioridade" |
  "prioridade_padrao" | "status_inicial" | "responsavel_padrao" | "responsavel_email" | "etiquetas_padrao" | "perguntas" | "titulo_composicao">;

function draftDe(f: GestaoFormulario): Draft {
  return {
    titulo: f.titulo, descricao: f.descricao, ativo: f.ativo,
    mostra_descricao: f.mostra_descricao, mostra_prazo: f.mostra_prazo, mostra_prioridade: f.mostra_prioridade,
    prioridade_padrao: f.prioridade_padrao, status_inicial: f.status_inicial,
    responsavel_padrao: f.responsavel_padrao, responsavel_email: f.responsavel_email,
    etiquetas_padrao: f.etiquetas_padrao,
    // F1.5: toda pergunta ganha id estável ao abrir a edição (condição e título composto apontam para ele).
    perguntas: (f.perguntas ?? []).map((p) => (p.id ? p : { ...p, id: novoIdPergunta() })),
    titulo_composicao: f.titulo_composicao ?? null,
  };
}

export default function FormulariosManagerModal({
  open, onClose, idQuadro, statuses, etiquetas, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  statuses: GestaoStatus[];
  etiquetas: GestaoEtiqueta[];
  /** Nomes de usuários (legado; o picker de responsável usa a lista rica nome+email via useUsuarios). */
  usuarios: string[];
  podeEditar: boolean;
}) {
  const { data: forms = [] } = useFormulariosQuadro(idQuadro);
  const { data: usuariosFull = EMPTY_USUARIOS } = useUsuarios();
  const { data: campos = [] } = useCamposQuadro(idQuadro);
  const salvar = useSalvarFormulario();
  const excluir = useExcluirFormulario();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function novo() {
    salvar.mutate({ id_quadro: idQuadro }, { onSuccess: () => toast.success("Formulário criado") });
  }

  function abrirEdicao(f: GestaoFormulario) {
    setEditId(f.id);
    setDraft(draftDe(f));
  }

  function salvarEdicao() {
    if (!editId || !draft) return;
    salvar.mutate({ id: editId, id_quadro: idQuadro, ...draft }, {
      onSuccess: () => { toast.success("Formulário salvo"); setEditId(null); setDraft(null); },
    });
  }

  async function copiarLink(token: string) {
    const url = `${origin}/f/${token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    catch { toast.error(url); }
  }

  const up = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Modal open={open} onClose={onClose} title="Formulários de entrada" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Crie um link público para captar solicitações. Cada envio vira uma tarefa nesta lista — sem login.
        </p>

        {forms.map((f) => (
          <div key={f.id} className="rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 p-2.5">
              <span className={`size-2 shrink-0 rounded-full ${f.ativo ? "bg-green-500" : "bg-gray-300"}`} title={f.ativo ? "Ativo" : "Inativo"} />
              <span className="flex-1 truncate text-sm font-medium text-gray-800">{f.titulo}</span>
              <button type="button" onClick={() => copiarLink(f.token)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50" title="Copiar link público">
                <Link2 className="size-3.5" /> Link
              </button>
              {podeEditar && (
                <>
                  <button type="button" onClick={() => salvar.mutate({ id: f.id, id_quadro: idQuadro, ativo: !f.ativo })} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                    {f.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button type="button" onClick={() => (editId === f.id ? (setEditId(null), setDraft(null)) : abrirEdicao(f))} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Editar"><Pencil className="size-4" /></button>
                  <button type="button" onClick={async () => { if (await confirmar({ title: "Excluir formulário?", description: "O link público deixa de funcionar." })) excluir.mutate(f.id); }} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 className="size-4" /></button>
                </>
              )}
            </div>

            {editId === f.id && draft && (
              <div className="space-y-3 border-t border-gray-100 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Título do formulário</label>
                  <input value={draft.titulo} onChange={(e) => up({ titulo: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Texto de introdução (opcional)</label>
                  <textarea value={draft.descricao ?? ""} onChange={(e) => up({ descricao: e.target.value || null })} rows={2} className={inputCls} />
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.mostra_descricao} onChange={(e) => up({ mostra_descricao: e.target.checked })} /> Campo de detalhes</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.mostra_prazo} onChange={(e) => up({ mostra_prazo: e.target.checked })} /> Pedir prazo</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.mostra_prioridade} onChange={(e) => up({ mostra_prioridade: e.target.checked })} /> Pedir prioridade</label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Status inicial</label>
                    <select value={draft.status_inicial ?? ""} onChange={(e) => up({ status_inicial: e.target.value || null })} className={inputCls}>
                      <option value="">1º da lista</option>
                      {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Prioridade padrão</label>
                    <select value={draft.prioridade_padrao} onChange={(e) => up({ prioridade_padrao: e.target.value })} className={inputCls}>
                      {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Responsável padrão</label>
                    <UsuarioCombobox
                      usuarios={usuariosFull}
                      value={draft.responsavel_email ?? ""}
                      onChange={(email) => up({ responsavel_email: email || null })}
                      incluirVazio
                      vazioLabel="Sem responsável"
                      placeholder="Opcional"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Etiquetas padrão</label>
                  <MultiChipInput value={draft.etiquetas_padrao} onChange={(v) => up({ etiquetas_padrao: v })} sugestoes={etiquetas.map((e) => e.nome)} placeholder="Adicionar…" />
                </div>

                {/* F1.5: título da tarefa montado das respostas (como no Runrun). Vazio = o respondente digita. */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Título da tarefa</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(draft.titulo_composicao ?? []).map((t, k) => {
                      const rotulo = t === "form_title" ? "Título do formulário" : (draft.perguntas.find((q) => q.id === t.slice(2))?.label || "(pergunta removida)");
                      return (
                        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-xs text-verde-primary">
                          {rotulo}
                          <button type="button" onClick={() => up({ titulo_composicao: (draft.titulo_composicao ?? []).filter((_, j) => j !== k) })} className="text-verde-primary/60 hover:text-red-600"><X className="size-3" /></button>
                        </span>
                      );
                    })}
                    <select value="" onChange={(e) => { if (e.target.value) up({ titulo_composicao: [...(draft.titulo_composicao ?? []), e.target.value] }); }} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs focus:outline-none">
                      <option value="">+ montar de…</option>
                      <option value="form_title">Título do formulário</option>
                      {draft.perguntas.filter((q) => q.id && q.label).map((q) => <option key={q.id} value={`p:${q.id}`}>{q.label}</option>)}
                    </select>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{(draft.titulo_composicao ?? []).length ? 'O form público não pede título: ele é montado das partes acima, separadas por " - ".' : "Sem partes: o respondente digita o título."}</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Perguntas extras</label>
                  <div className="space-y-2">
                    {draft.perguntas.map((p, i) => {
                      const tipo = p.tipo ?? "texto";
                      const upP = (patch: Partial<PerguntaFormulario>) => up({ perguntas: draft.perguntas.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                      const campoDest = (p.destino ?? "").startsWith("campo:") ? campos.find((c) => c.id === (p.destino ?? "").slice(6)) : undefined;
                      return (
                        <div key={i} className="space-y-1.5 rounded-md border border-gray-100 bg-gray-50/50 p-2">
                          <div className="flex items-center gap-2">
                            <input value={p.label} onChange={(e) => upP({ label: e.target.value })} placeholder="Rótulo da pergunta" className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
                            <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={p.obrigatorio} onChange={(e) => upP({ obrigatorio: e.target.checked })} /> obrig.</label>
                            <button type="button" onClick={() => up({ perguntas: draft.perguntas.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-600"><X className="size-4" /></button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <select value={tipo} onChange={(e) => upP({ tipo: e.target.value as TipoPergunta })} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs focus:outline-none">
                              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <span className="text-gray-400">grava em</span>
                            <select value={p.destino ?? "descricao"} onChange={(e) => upP({ destino: e.target.value })} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs focus:outline-none">
                              <option value="descricao">Descrição</option>
                              <option value="etiquetas">Etiquetas (tag)</option>
                              <option value="prazo">Prazo</option>
                              {campos.map((c) => <option key={c.id} value={`campo:${c.id}`}>Campo: {c.nome}</option>)}
                            </select>
                            <label className="flex items-center gap-1 text-gray-500" title="A pergunta pede documentos; sem upload público, a tarefa nasce marcada 'anexo pendente'">
                              <input type="checkbox" checked={!!p.pendente_anexo} onChange={(e) => upP({ pendente_anexo: e.target.checked || undefined })} /> anexo
                            </label>
                          </div>
                          {(tipo === "selecao" || tipo === "multipla") && (
                            <MultiChipInput value={p.opcoes ?? []} onChange={(v) => upP({ opcoes: v })} sugestoes={campoDest?.opcoes ?? []} placeholder="Opções da pergunta…" />
                          )}
                          {/* F1.5: texto de ajuda + pergunta condicional (origem = outra pergunta de seleção deste form) */}
                          <input value={p.ajuda ?? ""} onChange={(e) => upP({ ajuda: e.target.value || undefined })} placeholder="Texto de ajuda (opcional)" className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none" />
                          {(() => {
                            // Origem não pode ser a própria pergunta nem quem depende dela (evita ciclo A↔B).
                            const dependentes = p.id ? dependentesDe(p.id, draft.perguntas) : new Set<string>();
                            const origens = draft.perguntas.filter((q) => q.id && q.id !== p.id && !dependentes.has(q.id) && (q.tipo === "selecao" || q.tipo === "multipla") && (q.opcoes ?? []).length > 0);
                            if (origens.length === 0 && !p.condicao) return null;
                            const origem = origens.find((q) => q.id === p.condicao?.pergunta);
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-gray-400">mostrar só se</span>
                                <select value={p.condicao?.pergunta ?? ""} onChange={(e) => upP({ condicao: e.target.value ? { pergunta: e.target.value, opcao: "" } : null })} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs focus:outline-none">
                                  <option value="">(sempre)</option>
                                  {origens.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                                </select>
                                {origem && (
                                  <>
                                    <span className="text-gray-400">=</span>
                                    <select value={p.condicao?.opcao ?? ""} onChange={(e) => upP({ condicao: { pergunta: origem.id as string, opcao: e.target.value } })} className="rounded-md border border-gray-200 px-1.5 py-1 text-xs focus:outline-none">
                                      <option value="">escolha a opção…</option>
                                      {(origem.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => up({ perguntas: [...draft.perguntas, { id: novoIdPergunta(), label: "", obrigatorio: false, tipo: "texto", destino: "descricao" } as PerguntaFormulario] })} className="inline-flex items-center gap-1 text-xs font-medium text-verde-primary hover:underline">
                      <Plus className="size-3.5" /> Adicionar pergunta
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setEditId(null); setDraft(null); }} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
                  <button type="button" onClick={salvarEdicao} disabled={salvar.isPending} className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-dark disabled:opacity-60">
                    <Check className="size-4" /> Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {forms.length === 0 && <p className="text-sm text-gray-400">Nenhum formulário ainda.</p>}

        {podeEditar && (
          <button type="button" onClick={novo} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Novo formulário
          </button>
        )}
      </div>
    </Modal>
  );
}
