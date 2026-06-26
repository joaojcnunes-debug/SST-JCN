"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Folder, List, Layers, CircleUser, BarChart3, Inbox, Lock } from "lucide-react";
import {
  useSalvarEspaco, useExcluirEspaco, useSalvarPasta, useExcluirPasta,
  useCriarQuadro, useRenomearQuadro, useExcluirQuadro,
  type GestaoEspaco, type GestaoPasta, type GestaoQuadro,
} from "@/lib/hooks/useGestao";
import { confirmar } from "@/components/ui/confirm";

const inputDark = "min-w-0 flex-1 rounded border border-white/40 bg-white/10 px-1 py-0.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-verde-accent";

export default function GestaoSidebar({
  espacos,
  pastas,
  quadros,
  quadroId,
  onSelect,
  podeEditar,
  minhasAtivo,
  onMinhas,
  painelAtivo,
  onPainel,
  inboxAtivo,
  onInbox,
  inboxCount,
}: {
  espacos: GestaoEspaco[];
  pastas: GestaoPasta[];
  quadros: GestaoQuadro[];
  quadroId: string | null;
  onSelect: (id: string) => void;
  podeEditar: boolean;
  minhasAtivo: boolean;
  onMinhas: () => void;
  painelAtivo: boolean;
  onPainel: () => void;
  inboxAtivo: boolean;
  onInbox: () => void;
  inboxCount: number;
}) {
  const salvarEspaco = useSalvarEspaco();
  const excluirEspaco = useExcluirEspaco();
  const salvarPasta = useSalvarPasta();
  const excluirPasta = useExcluirPasta();
  const criarQuadro = useCriarQuadro();
  const renomearQuadro = useRenomearQuadro();
  const excluirQuadro = useExcluirQuadro();

  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);

  const toggle = (id: string) => setFechados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const aberto = (id: string) => !fechados.has(id);

  async function novaLista(id_espaco: string, id_pasta: string | null) {
    const id = await criarQuadro.mutateAsync({ nome: "Nova lista", id_espaco, id_pasta });
    onSelect(id);
    setEditando(`q:${id}`);
  }

  const Nome = ({ chave, nome, onSalvar, className }: { chave: string; nome: string; onSalvar: (v: string) => void; className?: string }) =>
    editando === chave ? (
      <input
        autoFocus
        defaultValue={nome}
        onBlur={(e) => { onSalvar(e.target.value); setEditando(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onSalvar((e.target as HTMLInputElement).value); setEditando(null); } if (e.key === "Escape") setEditando(null); }}
        onClick={(e) => e.stopPropagation()}
        className={inputDark}
      />
    ) : <span className={`min-w-0 flex-1 truncate ${className ?? ""}`}>{nome}</span>;

  const AcoesBtn = ({ children }: { children: React.ReactNode }) => (
    <div className="ml-auto flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">{children}</div>
  );

  return (
    <nav className="space-y-1 text-sm">
      <button type="button" onClick={onInbox} className={`relative mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verde-accent ${inboxAtivo ? "bg-white/[0.16] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
        {inboxAtivo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-verde-accent" />}
        <Inbox className="size-4" /> Caixa de entrada
        {inboxCount > 0 && <span className="ml-auto rounded-full bg-verde-accent px-1.5 text-[11px] font-bold text-verde-dark">{inboxCount}</span>}
      </button>
      <button type="button" onClick={onMinhas} className={`relative mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verde-accent ${minhasAtivo ? "bg-white/[0.16] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
        {minhasAtivo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-verde-accent" />}
        <CircleUser className="size-4" /> Minhas tarefas
      </button>
      <button type="button" onClick={onPainel} className={`relative mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verde-accent ${painelAtivo ? "bg-white/[0.16] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
        {painelAtivo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-verde-accent" />}
        <BarChart3 className="size-4" /> Painel
      </button>
      <div className="mb-1 border-t border-white/[0.07]" />
      {espacos.map((esp) => {
        const pastasDoEspaco = pastas.filter((p) => p.id_espaco === esp.id);
        const listasSoltas = quadros.filter((q) => q.id_espaco === esp.id && !q.id_pasta);
        return (
          <div key={esp.id}>
            <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verde-accent" onClick={() => toggle(`e:${esp.id}`)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(`e:${esp.id}`); } }} role="button" tabIndex={0}>
              {aberto(`e:${esp.id}`) ? <ChevronDown className="size-3.5 shrink-0 text-white/40" /> : <ChevronRight className="size-3.5 shrink-0 text-white/40" />}
              <Layers className="size-4 shrink-0" style={{ color: esp.cor }} />
              <Nome chave={`e:${esp.id}`} nome={esp.nome} onSalvar={(v) => salvarEspaco.mutate({ id: esp.id, nome: v })} className="font-semibold text-white/90" />
              {podeEditar && (
                <AcoesBtn>
                  <button type="button" title="Nova pasta" onClick={(e) => { e.stopPropagation(); salvarPasta.mutate({ id_espaco: esp.id, nome: "Nova pasta" }); }} className="rounded p-0.5 text-white/40 hover:text-white"><Plus className="size-3.5" /></button>
                  <button type="button" title="Renomear" onClick={(e) => { e.stopPropagation(); setEditando(`e:${esp.id}`); }} className="rounded p-0.5 text-white/40 hover:text-white"><Pencil className="size-3.5" /></button>
                  <button type="button" title="Excluir espaço" onClick={async (e) => { e.stopPropagation(); if (await confirmar({ title: `Excluir espaço "${esp.nome}"?` })) excluirEspaco.mutate(esp.id); }} className="rounded p-0.5 text-white/30 hover:text-red-300"><Trash2 className="size-3.5" /></button>
                </AcoesBtn>
              )}
            </div>

            {aberto(`e:${esp.id}`) && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-2">
                {/* Listas soltas (direto no espaço) */}
                {listasSoltas.map((q) => (
                  <ItemLista key={q.id_quadro} q={q} ativo={q.id_quadro === quadroId} editando={editando === `q:${q.id_quadro}`}
                    onSelect={onSelect} podeEditar={podeEditar} onRenomearStart={() => setEditando(`q:${q.id_quadro}`)}
                    onRenomear={(v) => { renomearQuadro.mutate({ id_quadro: q.id_quadro, nome: v }); setEditando(null); }} onExcluir={async () => { if (await confirmar({ title: `Excluir lista "${q.nome}"?` })) excluirQuadro.mutate(q.id_quadro); }} />
                ))}
                {podeEditar && (
                  <button type="button" onClick={() => novaLista(esp.id, null)} className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/45 hover:bg-white/10 hover:text-white">
                    <Plus className="size-3" /> Lista
                  </button>
                )}

                {/* Pastas */}
                {pastasDoEspaco.map((pa) => {
                  const listas = quadros.filter((q) => q.id_pasta === pa.id);
                  return (
                    <div key={pa.id}>
                      <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verde-accent" onClick={() => toggle(`p:${pa.id}`)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(`p:${pa.id}`); } }} role="button" tabIndex={0}>
                        {aberto(`p:${pa.id}`) ? <ChevronDown className="size-3.5 shrink-0 text-white/40" /> : <ChevronRight className="size-3.5 shrink-0 text-white/40" />}
                        <Folder className="size-4 shrink-0 text-white/45" />
                        <Nome chave={`p:${pa.id}`} nome={pa.nome} onSalvar={(v) => salvarPasta.mutate({ id: pa.id, nome: v })} className="font-medium text-white/80" />
                        {podeEditar && (
                          <AcoesBtn>
                            <button type="button" title="Nova lista" onClick={(e) => { e.stopPropagation(); novaLista(esp.id, pa.id); }} className="rounded p-0.5 text-white/40 hover:text-white"><Plus className="size-3.5" /></button>
                            <button type="button" title="Renomear" onClick={(e) => { e.stopPropagation(); setEditando(`p:${pa.id}`); }} className="rounded p-0.5 text-white/40 hover:text-white"><Pencil className="size-3.5" /></button>
                            <button type="button" title="Excluir pasta" onClick={async (e) => { e.stopPropagation(); if (await confirmar({ title: `Excluir pasta "${pa.nome}"?` })) excluirPasta.mutate(pa.id); }} className="rounded p-0.5 text-white/30 hover:text-red-300"><Trash2 className="size-3.5" /></button>
                          </AcoesBtn>
                        )}
                      </div>
                      {aberto(`p:${pa.id}`) && (
                        <div className="ml-3 space-y-0.5 border-l border-white/10 pl-2">
                          {listas.map((q) => (
                            <ItemLista key={q.id_quadro} q={q} ativo={q.id_quadro === quadroId} editando={editando === `q:${q.id_quadro}`}
                              onSelect={onSelect} podeEditar={podeEditar} onRenomearStart={() => setEditando(`q:${q.id_quadro}`)}
                              onRenomear={(v) => { renomearQuadro.mutate({ id_quadro: q.id_quadro, nome: v }); setEditando(null); }} onExcluir={async () => { if (await confirmar({ title: `Excluir lista "${q.nome}"?` })) excluirQuadro.mutate(q.id_quadro); }} />
                          ))}
                          {listas.length === 0 && <p className="px-1.5 py-0.5 text-xs text-white/30">Vazia</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {podeEditar && (
        <button type="button" onClick={() => salvarEspaco.mutate({ nome: "Novo espaço" })} className="mt-2 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white">
          <Plus className="size-3.5" /> Novo espaço
        </button>
      )}
    </nav>
  );
}

function ItemLista({ q, ativo, editando, onSelect, podeEditar, onRenomearStart, onRenomear, onExcluir }: {
  q: GestaoQuadro;
  ativo: boolean;
  editando: boolean;
  onSelect: (id: string) => void;
  podeEditar: boolean;
  onRenomearStart: () => void;
  onRenomear: (v: string) => void;
  onExcluir: () => void;
}) {
  return (
    <div className={`group relative flex items-center gap-1.5 rounded-md px-1.5 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-verde-accent ${ativo ? "bg-white/[0.16] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`} onClick={() => onSelect(q.id_quadro)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(q.id_quadro); } }} role="button" tabIndex={0}>
      {ativo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-verde-accent" />}
      <List className="size-3.5 shrink-0" />
      {editando ? (
        <input autoFocus defaultValue={q.nome} onClick={(e) => e.stopPropagation()}
          onBlur={(e) => onRenomear(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onRenomear((e.target as HTMLInputElement).value); }}
          className="min-w-0 flex-1 rounded border border-white/40 bg-white/10 px-1 py-0.5 text-sm text-white focus:outline-none" />
      ) : <span className="min-w-0 flex-1 truncate">{q.nome}</span>}
      {q.restrito && !editando && <Lock className="size-3 shrink-0 text-amber-300/90" aria-label="Lista restrita" />}
      {podeEditar && !editando && (
        <div className="ml-auto flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
          <button type="button" title="Renomear" onClick={(e) => { e.stopPropagation(); onRenomearStart(); }} className="rounded p-0.5 text-white/40 hover:text-white"><Pencil className="size-3" /></button>
          <button type="button" title="Excluir lista" onClick={(e) => { e.stopPropagation(); onExcluir(); }} className="rounded p-0.5 text-white/30 hover:text-red-300"><Trash2 className="size-3" /></button>
        </div>
      )}
    </div>
  );
}
