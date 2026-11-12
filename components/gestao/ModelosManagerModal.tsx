"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_GESTAO_LISTA } from "@/lib/dicas/gestao";
import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, LayoutTemplate } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import {
  PRIORIDADES, useModelos, useSalvarModelo, useExcluirModelo, useAutomacoes,
  type GestaoSubtarefaModelo, type ItemModelo, type PrioridadeTarefa,
} from "@/lib/hooks/useGestao";
import { resumoModelo } from "@/lib/gestao/modelos";
import { confirmar } from "@/components/ui/confirm";

const inputCls = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none";
const linhaCls = "flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none";
const rotuloCls = "mb-1 block text-xs font-medium text-gray-600";

interface Draft {
  slug: string;
  titulo: string;
  itens: ItemModelo[];
  descricao: string;
  checklist: string[];
  prioridade: PrioridadeTarefa | "";
  etiquetas: string;
  prazoDias: string;
  prazoUteis: boolean;
  naCriacao: boolean;
}

function draftDe(m: GestaoSubtarefaModelo): Draft {
  return {
    slug: m.slug,
    titulo: m.titulo,
    itens: m.itens ?? [],
    descricao: m.descricao ?? "",
    checklist: m.checklist ?? [],
    prioridade: m.prioridade ?? "",
    etiquetas: (m.etiquetas ?? []).join(", "),
    prazoDias: m.prazo_dias != null ? String(m.prazo_dias) : "",
    prazoUteis: m.prazo_uteis ?? false,
    naCriacao: m.na_criacao ?? false,
  };
}

/**
 * Modelos de tarefa do quadro (v354, item 13 — como os templates do Notion). Na Nova tarefa, "Usar modelo" preenche
 * título, descrição, checklist, subtarefas, prioridade, etiquetas e prazo. As automações continuam usando o
 * identificador (criar_subtarefas_modelo) só para as subtarefas.
 */
export default function ModelosManagerModal({
  open, onClose, idQuadro, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  podeEditar: boolean;
}) {
  const { data: modelos = [] } = useModelos(idQuadro);
  const { data: automacoes = [] } = useAutomacoes(open ? idQuadro : null);
  const salvar = useSalvarModelo();
  const excluir = useExcluirModelo();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function novo() {
    salvar.mutate(
      { id_quadro: idQuadro, slug: `modelo-${Date.now().toString(36)}`, titulo: "Novo modelo", itens: [], na_criacao: true },
      { onSuccess: () => toast.success("Modelo criado. Clique no lápis para preencher.") },
    );
  }

  function abrirEdicao(m: GestaoSubtarefaModelo) {
    setEditId(m.id);
    setDraft(draftDe(m));
  }

  // Automações DESTA lista que criam subtarefas com o modelo do slug (o motor procura o modelo por
  // quadro + slug — v315 gestao_automacao_aplicar). Regra antiga sem `acoes` vale pela `acao`.
  function automacoesQueUsam(slug: string): number {
    return automacoes.filter((a) => {
      const acoes = a.acoes?.length ? a.acoes : a.acao ? [a.acao] : [];
      return acoes.some((x) => x?.tipo === "criar_subtarefas_modelo" && x.modelo_slug === slug);
    }).length;
  }

  async function salvarEdicao() {
    if (!editId || !draft) return;
    const slug = draft.slug.trim();
    if (!slug) { toast.error("Informe um identificador (slug)."); return; }
    // Trocar o slug quebra em silêncio as automações que apontam para o antigo (viram "modelo
    // inexistente" no histórico) — pede confirmação dizendo quantas são.
    const antigo = modelos.find((m) => m.id === editId)?.slug;
    if (antigo && antigo !== slug) {
      const n = automacoesQueUsam(antigo);
      const ok = await confirmar({
        title: "Trocar o identificador do modelo?",
        description: n > 0
          ? `${n === 1 ? "1 automação desta lista usa" : `${n} automações desta lista usam`} o código "${antigo}" e ${n === 1 ? "vai parar" : "vão parar"} de criar subtarefas até você escolher o modelo de novo nelas.`
          : `Automações que usam o código antigo "${antigo}" vão parar de criar subtarefas. Nenhuma automação desta lista usa esse código agora.`,
        confirmLabel: "Trocar mesmo assim",
      });
      if (!ok) return;
    }
    const dias = draft.prazoDias.trim() === "" ? null : Math.min(365, Math.max(0, parseInt(draft.prazoDias, 10) || 0));
    salvar.mutate(
      {
        id: editId,
        id_quadro: idQuadro,
        slug,
        titulo: draft.titulo.trim() || "Modelo",
        itens: draft.itens.filter((i) => i.texto.trim()),
        descricao: draft.descricao.trim() || null,
        checklist: draft.checklist.map((t) => t.trim()).filter(Boolean),
        prioridade: draft.prioridade || null,
        etiquetas: [...new Set(draft.etiquetas.split(",").map((t) => t.trim()).filter(Boolean))],
        prazo_dias: dias,
        prazo_uteis: draft.prazoUteis,
        na_criacao: draft.naCriacao,
      },
      { onSuccess: () => { toast.success("Modelo salvo"); setEditId(null); setDraft(null); } },
    );
  }

  const up = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const upItem = (i: number, patch: Partial<ItemModelo>) =>
    setDraft((d) => (d ? { ...d, itens: d.itens.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : d));
  const upCheck = (i: number, t: string) => setDraft((d) => (d ? { ...d, checklist: d.checklist.map((x, j) => (j === i ? t : x)) } : d));

  return (
    <Modal open={open} onClose={onClose} title="Modelos de tarefa" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Na Nova tarefa, <b>Usar modelo</b> preenche descrição, checklist, subtarefas, prioridade, etiquetas e prazo (o que
          a pessoa já escreveu fica). As automações usam o identificador para criar só as subtarefas.
        </p>

        {modelos.map((m) => (
          <div key={m.id} className="rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 p-2.5">
              <LayoutTemplate className="size-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{m.titulo}</p>
                <p className="truncate text-xs text-gray-500">{resumoModelo(m)}</p>
              </div>
              {m.na_criacao && <span className="shrink-0 rounded bg-marca-light px-1.5 py-0.5 text-[11px] font-medium text-marca-primary">Na Nova tarefa</span>}
              <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 sm:inline">{m.slug}</span>
              {podeEditar && (
                <>
                  <button type="button" onClick={() => (editId === m.id ? (setEditId(null), setDraft(null)) : abrirEdicao(m))} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Editar" aria-label={`Editar ${m.titulo}`}><Pencil className="size-4" /></button>
                  <button type="button" onClick={async () => { if (await confirmar({ title: "Excluir modelo?", description: "Some da Nova tarefa, e as automações que apontam para este identificador deixam de criar subtarefas." })) excluir.mutate(m.id); }} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Excluir" aria-label={`Excluir ${m.titulo}`}><Trash2 className="size-4" /></button>
                </>
              )}
            </div>

            {editId === m.id && draft && (
              <div className="space-y-3 border-t border-gray-100 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={rotuloCls}><Dica texto={DICAS_GESTAO_LISTA.modelo_titulo}>Nome do modelo (vira o título da tarefa)</Dica></label>
                    <input value={draft.titulo} onChange={(e) => up({ titulo: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={rotuloCls}><Dica texto={DICAS_GESTAO_LISTA.modelo_slug}>Identificador (automações)</Dica></label>
                    <input value={draft.slug} onChange={(e) => up({ slug: e.target.value })} placeholder="ex.: visita-tecnica" className={`${inputCls} font-mono`} />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={draft.naCriacao} onChange={(e) => up({ naCriacao: e.target.checked })} className="size-4 accent-marca-primary" />
                  Aparece em <b>Usar modelo</b> na Nova tarefa
                </label>

                <div>
                  <label className={rotuloCls}>Descrição</label>
                  <textarea value={draft.descricao} onChange={(e) => up({ descricao: e.target.value })} rows={4} className={`${inputCls} resize-y`} placeholder="O passo a passo, o que levar, com quem falar…" />
                </div>

                <div>
                  <label className={rotuloCls}>Checklist</label>
                  <div className="space-y-1.5">
                    {draft.checklist.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={t} onChange={(e) => upCheck(i, e.target.value)} placeholder="Item a marcar" aria-label={`Item ${i + 1} do checklist`} className={linhaCls} />
                        <button type="button" onClick={() => up({ checklist: draft.checklist.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-600" aria-label="Tirar item"><X className="size-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => up({ checklist: [...draft.checklist, ""] })} className="inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
                      <Plus className="size-3.5" /> Adicionar item
                    </button>
                  </div>
                </div>

                <div>
                  <label className={rotuloCls}><Dica texto={DICAS_GESTAO_LISTA.modelo_itens}>Subtarefas</Dica></label>
                  <div className="space-y-1.5">
                    {draft.itens.map((it, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={it.texto} onChange={(e) => upItem(i, { texto: e.target.value })} placeholder="Texto da subtarefa" aria-label={`Subtarefa ${i + 1}`} className={linhaCls} />
                        <input value={it.etapa ?? ""} onChange={(e) => upItem(i, { etapa: e.target.value || null })} placeholder="etapa (opc.)" aria-label={`Etapa da subtarefa ${i + 1}`} className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none" />
                        <button type="button" onClick={() => up({ itens: draft.itens.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-600" aria-label="Tirar subtarefa"><X className="size-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => up({ itens: [...draft.itens, { texto: "", etapa: null, tipo: null }] })} className="inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
                      <Plus className="size-3.5" /> Adicionar subtarefa
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className={rotuloCls}>Prioridade</label>
                    <select value={draft.prioridade} onChange={(e) => up({ prioridade: e.target.value as PrioridadeTarefa | "" })} className={inputCls}>
                      <option value="">Não muda</option>
                      {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={rotuloCls}>Etiquetas (separadas por vírgula)</label>
                    <input value={draft.etiquetas} onChange={(e) => up({ etiquetas: e.target.value })} placeholder="ex.: campo, visita" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={rotuloCls}>Prazo (término)</label>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <input inputMode="numeric" value={draft.prazoDias} onChange={(e) => up({ prazoDias: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="—" aria-label="Prazo em dias" className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none" />
                    <select value={draft.prazoUteis ? "uteis" : "corridos"} onChange={(e) => up({ prazoUteis: e.target.value === "uteis" })} aria-label="Tipo de dia" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none">
                      <option value="corridos">dias corridos</option>
                      <option value="uteis">dias úteis</option>
                    </select>
                    <span className="text-xs text-gray-500">depois de criar (vazio = não muda o prazo)</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setEditId(null); setDraft(null); }} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
                  <button type="button" onClick={salvarEdicao} disabled={salvar.isPending} className="inline-flex items-center gap-1 rounded-md bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-dark disabled:opacity-60">
                    <Check className="size-4" /> Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {modelos.length === 0 && <p className="text-sm text-gray-400">Nenhum modelo ainda.</p>}

        {podeEditar && (
          <button type="button" onClick={novo} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-marca-primary ring-1 ring-dashed ring-marca-primary/40 hover:bg-marca-light/40">
            <Plus className="size-4" /> Novo modelo
          </button>
        )}
      </div>
    </Modal>
  );
}
