"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Folder, List, Layers, Lock, UserSquare, Users, CalendarDays, ShieldCheck, Search, X, Package, Settings2 } from "lucide-react";
import {
  useSalvarEspaco, useExcluirEspaco, useSalvarPasta, useExcluirPasta,
  useCriarQuadro, useRenomearQuadro, useExcluirQuadro, DIAS_LIXEIRA,
  type GestaoEspaco, type GestaoPasta, type GestaoQuadro,
} from "@/lib/hooks/useGestao";
import { confirmar } from "@/components/ui/confirm";
import { normalizarTexto, tokenizar } from "@/lib/busca/texto";

const inputDark = "min-w-0 flex-1 rounded border border-white/40 bg-white/10 px-1 py-0.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-marca-accent";

export default function GestaoSidebar({
  espacos,
  pastas,
  quadros,
  quadroId,
  onSelect,
  podeEditar,
  meuEspacoAtivo,
  onMeuEspaco,
  agendaAtiva = false,
  onAgenda,
  colabAtivo = false,
  onColab,
  mostrarColab = false,
  onAcessos,
  onLixeira,
  onProdutos,
}: {
  espacos: GestaoEspaco[];
  pastas: GestaoPasta[];
  quadros: GestaoQuadro[];
  quadroId: string | null;
  onSelect: (id: string) => void;
  podeEditar: boolean;
  meuEspacoAtivo: boolean;
  onMeuEspaco: () => void;
  /** "Agenda" (10/11/2026): o que cada pessoa tem em cada dia, tarefas e subtarefas. */
  agendaAtiva?: boolean;
  onAgenda?: () => void;
  /** "Colaboradores" (v235): só para gestor/supervisor — o servidor decide quem aparece. */
  colabAtivo?: boolean;
  onColab?: () => void;
  mostrarColab?: boolean;
  /** "Membros e acessos": só para gestor — sem a função, o item não aparece. */
  onAcessos?: () => void;
  /** "Lixeira" (v361): para todos — cada pessoa vê o que excluiu; gestores veem tudo. */
  onLixeira?: () => void;
  /** "Produtos" (v363): só gestor — criar, renomear e excluir os produtos da Gestão. */
  onProdutos?: () => void;
}) {
  const salvarEspaco = useSalvarEspaco();
  const excluirEspaco = useExcluirEspaco();
  const salvarPasta = useSalvarPasta();
  const excluirPasta = useExcluirPasta();
  const criarQuadro = useCriarQuadro();
  const renomearQuadro = useRenomearQuadro();
  const excluirQuadro = useExcluirQuadro();

  const [fechados, setFechados] = useState<Set<string>>(new Set());
  // 11/11/2026: "Configuração" junta Lixeira e Produtos num menu (pedido do usuário).
  const [configAberta, setConfigAberta] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Busca nas listas: cada palavra precisa aparecer no nome da lista, da pasta ou do espaço (sem acento).
  // Buscando, tudo que tem resultado fica aberto e o resto some.
  const termos = tokenizar(busca);
  const buscando = termos.length > 0;
  const nomePasta = new Map(pastas.map((p) => [p.id, p.nome]));
  const nomeEspaco = new Map(espacos.map((e) => [e.id, e.nome]));
  const casa = (q: GestaoQuadro) => {
    if (!buscando) return true;
    const alvo = normalizarTexto(`${(q.id_espaco && nomeEspaco.get(q.id_espaco)) || ""} ${q.id_pasta ? nomePasta.get(q.id_pasta) ?? "" : ""} ${q.nome}`);
    return termos.every((t) => alvo.includes(t));
  };
  const quadrosVisiveis = buscando ? quadros.filter(casa) : quadros;

  const toggle = (id: string) => setFechados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const aberto = (id: string) => buscando || !fechados.has(id);

  async function novaLista(id_espaco: string, id_pasta: string | null) {
    const id = await criarQuadro.mutateAsync({ nome: "Nova lista", id_espaco, id_pasta });
    onSelect(id);
    setEditando(`q:${id}`);
  }

  return (
    <nav className="space-y-1 text-sm">
      {/* Meu Espaço — o espaço PESSOAL do usuário (UX-C1). Consolidou a antiga aba
          "Minhas tarefas" (removida no ciclo 2): ao abrir, mostra a vista AGREGADA das
          tarefas em que ele é responsável OU seguidor em qualquer quadro
          (useMinhasTarefas, já RLS-gated). É o CONTAINER que a UX-C(2) vai completar
          com o quadro pessoal (a lista própria onde ele cria tarefas) — quando esse
          pacote chegar, o quadro entra logo abaixo desta entrada. */}
      <button type="button" onClick={onMeuEspaco} className={`relative mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent ${meuEspacoAtivo ? "bg-white/[0.16] text-white" : "text-white/90 hover:bg-white/10 hover:text-white"}`}>
        {meuEspacoAtivo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-marca-accent" />}
        <UserSquare className="size-4" /> Meu Espaço
      </button>
      {onAgenda && (
        <button type="button" onClick={onAgenda} className={`relative mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent ${agendaAtiva ? "bg-white/[0.16] text-white" : "text-white/90 hover:bg-white/10 hover:text-white"}`}>
          {agendaAtiva && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-marca-accent" />}
          <CalendarDays className="size-4" /> Agenda
        </button>
      )}
      <div className="mb-1 border-t border-white/[0.07]" />
      {mostrarColab && onColab && (
        <button type="button" onClick={onColab} className={`relative mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent ${colabAtivo ? "bg-white/[0.16] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
          {colabAtivo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-marca-accent" />}
          <Users className="size-4" /> Colaboradores
        </button>
      )}
      {/* 28/10: "Membros e acessos" saiu da barra da lista e veio para cá, ao lado de Colaboradores.
          Só gestor (como o botão antigo); abre o mesmo modal. */}
      {onAcessos && (
        <button type="button" onClick={onAcessos} title="Membros e acessos da Gestão — quem vê cada quadro" className="mb-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent">
          <ShieldCheck className="size-4" /> Membros e acessos
        </button>
      )}
      {/* 11/11/2026: "Configuração" (abaixo de "Membros e acessos") abre um menu com Lixeira (todos) e Produtos (só
          gestor); cada opção abre a mesma janela de antes. */}
      {(onLixeira || onProdutos) && (
        <div className="relative mb-1">
          <button type="button" onClick={() => setConfigAberta((v) => !v)} aria-haspopup="menu" aria-expanded={configAberta}
            className={`relative z-40 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent ${configAberta ? "bg-white/[0.16] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
            <Settings2 className="size-4" /> Configuração
            <ChevronDown className={`ml-auto size-3.5 text-white/50 transition-transform ${configAberta ? "rotate-180" : ""}`} />
          </button>
          {configAberta && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setConfigAberta(false)} aria-hidden />
              <div role="menu" aria-label="Configuração da Gestão" onKeyDown={(e) => { if (e.key === "Escape") setConfigAberta(false); }}
                className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {onLixeira && (
                  <button type="button" role="menuitem" autoFocus onClick={() => { setConfigAberta(false); onLixeira(); }}
                    title={`Cartões e listas excluídos — restaure em até ${DIAS_LIXEIRA} dias`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marca-primary">
                    <Trash2 className="size-4 text-gray-400" /> Lixeira
                  </button>
                )}
                {onProdutos && (
                  <button type="button" role="menuitem" autoFocus={!onLixeira} onClick={() => { setConfigAberta(false); onProdutos(); }}
                    title="Produtos da Gestão — criar, renomear e excluir"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marca-primary">
                    <Package className="size-4 text-gray-400" /> Produtos
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <div className="relative mb-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setBusca(""); }}
          placeholder="Pesquisar listas…"
          aria-label="Pesquisar listas"
          className="w-full rounded-md border border-white/15 bg-white/10 py-1 pl-7 pr-7 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-marca-accent"
        />
        {busca && (
          <button type="button" title="Limpar" onClick={() => setBusca("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:text-white">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mb-1 border-t border-white/[0.07]" />
      {buscando && quadrosVisiveis.length === 0 && <p className="px-1.5 py-1 text-xs text-white/40">Nenhuma lista encontrada.</p>}
      {espacos.map((esp) => {
        const pastasDoEspaco = pastas.filter((p) => p.id_espaco === esp.id && (!buscando || quadrosVisiveis.some((q) => q.id_pasta === p.id)));
        const listasSoltas = quadrosVisiveis.filter((q) => q.id_espaco === esp.id && !q.id_pasta);
        if (buscando && pastasDoEspaco.length === 0 && listasSoltas.length === 0) return null;
        return (
          <div key={esp.id}>
            <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent" onClick={() => toggle(`e:${esp.id}`)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(`e:${esp.id}`); } }} role="button" tabIndex={0}>
              {aberto(`e:${esp.id}`) ? <ChevronDown className="size-3.5 shrink-0 text-white/40" /> : <ChevronRight className="size-3.5 shrink-0 text-white/40" />}
              <Layers className="size-4 shrink-0" style={{ color: esp.cor }} />
              <Nome editando={editando === `e:${esp.id}`} onFim={() => setEditando(null)} nome={esp.nome} onSalvar={(v) => salvarEspaco.mutate({ id: esp.id, nome: v })} className="font-semibold text-white/90" />
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
                    onRenomear={(v) => { renomearQuadro.mutate({ id_quadro: q.id_quadro, nome: v }); setEditando(null); }} onExcluir={async () => { if (await confirmar({ title: `Excluir lista "${q.nome}"?`, description: `A lista vai para a Lixeira com status, campos, etiquetas, automações e formulários; dá para restaurar por ${DIAS_LIXEIRA} dias.` })) excluirQuadro.mutate(q.id_quadro, { onSuccess: () => toast.success(`Lista "${q.nome}" enviada para a Lixeira`) }); }} />
                ))}
                {podeEditar && !buscando && (
                  <button type="button" onClick={() => novaLista(esp.id, null)} className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/45 hover:bg-white/10 hover:text-white">
                    <Plus className="size-3" /> Lista
                  </button>
                )}

                {/* Pastas */}
                {pastasDoEspaco.map((pa) => {
                  const listas = quadrosVisiveis.filter((q) => q.id_pasta === pa.id);
                  return (
                    <div key={pa.id}>
                      <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent" onClick={() => toggle(`p:${pa.id}`)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(`p:${pa.id}`); } }} role="button" tabIndex={0}>
                        {aberto(`p:${pa.id}`) ? <ChevronDown className="size-3.5 shrink-0 text-white/40" /> : <ChevronRight className="size-3.5 shrink-0 text-white/40" />}
                        <Folder className="size-4 shrink-0 text-white/45" />
                        <Nome editando={editando === `p:${pa.id}`} onFim={() => setEditando(null)} nome={pa.nome} onSalvar={(v) => salvarPasta.mutate({ id: pa.id, nome: v })} className="font-medium text-white/80" />
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
                              onRenomear={(v) => { renomearQuadro.mutate({ id_quadro: q.id_quadro, nome: v }); setEditando(null); }} onExcluir={async () => { if (await confirmar({ title: `Excluir lista "${q.nome}"?`, description: `A lista vai para a Lixeira com status, campos, etiquetas, automações e formulários; dá para restaurar por ${DIAS_LIXEIRA} dias.` })) excluirQuadro.mutate(q.id_quadro, { onSuccess: () => toast.success(`Lista "${q.nome}" enviada para a Lixeira`) }); }} />
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

      {podeEditar && !buscando && (
        <button type="button" onClick={() => salvarEspaco.mutate({ nome: "Novo espaço" })} className="mt-2 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white">
          <Plus className="size-3.5" /> Novo espaço
        </button>
      )}
    </nav>
  );
}

// Nome de espaço/pasta (texto ou campo de renomear). No nível do módulo de propósito: declarado
// dentro do render, virava um componente NOVO a cada render — o input remontava (ex.: quando a
// lista de espaços recarregava) e o que a pessoa estava digitando se perdia.
function Nome({ editando, nome, onSalvar, onFim, className }: { editando: boolean; nome: string; onSalvar: (v: string) => void; onFim: () => void; className?: string }) {
  return editando ? (
    <input
      autoFocus
      defaultValue={nome}
      onBlur={(e) => { onSalvar(e.target.value); onFim(); }}
      onKeyDown={(e) => { if (e.key === "Enter") { onSalvar((e.target as HTMLInputElement).value); onFim(); } if (e.key === "Escape") onFim(); }}
      onClick={(e) => e.stopPropagation()}
      className={inputDark}
    />
  ) : <span className={`min-w-0 flex-1 truncate ${className ?? ""}`}>{nome}</span>;
}

// Mesmo motivo do Nome: fora do render para os botões não remontarem a cada render.
function AcoesBtn({ children }: { children: React.ReactNode }) {
  return <div className="ml-auto flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">{children}</div>;
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
    <div className={`group relative flex items-center gap-1.5 rounded-md px-1.5 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-marca-accent ${ativo ? "bg-white/[0.16] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`} onClick={() => onSelect(q.id_quadro)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(q.id_quadro); } }} role="button" tabIndex={0}>
      {ativo && <span className="absolute left-0 top-[15%] h-[70%] w-[3px] rounded-r-full bg-marca-accent" />}
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
