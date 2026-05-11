"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Phone,
  Plus,
  Save,
  Trash2,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { PaeContato } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  contatos: PaeContato[];
  readOnly?: boolean;
}

/**
 * Plano de Ação e Emergência — árvore editável de contatos.
 * Cada nó tem nome/cargo/telefone editáveis inline. Botão de
 * adicionar filho em cada nó cria um subordinado na hierarquia.
 */
export default function PaeTab({
  idInspecao,
  idEmpresa,
  contatos,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<PaeContato | null>(null);

  // Organiza contatos em árvore (parent → children[])
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, PaeContato[]>();
    for (const c of contatos) {
      const key = c.id_parent ?? null;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Cada lista já ordenada por (ordem) no fetch.
    return map;
  }, [contatos]);

  const save = useMutation({
    mutationFn: async (c: Partial<PaeContato> & { id_contato: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_contato, ...rest } = c;
      const payload = { ...rest, updated_at: new Date().toISOString() };
      // Discriminador: payload completo (inclui id_inspecao) → INSERT
      // (criação de novo contato via adicionar()). Patch parcial sem
      // id_inspecao → UPDATE. Antes o check era `rest.nome === undefined`,
      // mas se o usuário editasse o NOME de um contato existente, o save
      // ia pro UPSERT que tenta INSERT primeiro e falha em id_inspecao
      // NOT NULL.
      if (rest.id_inspecao === undefined) {
        const { error } = await supabase
          .from("pae_contatos")
          .update(payload as never)
          .eq("id_contato", id_contato);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("pae_contatos")
        .insert({ id_contato, ...payload } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (idContato: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("pae_contatos")
        .delete()
        .eq("id_contato", idContato);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Contato removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function adicionar(idParent: string | null) {
    const siblings = childrenOf.get(idParent) ?? [];
    save.mutate({
      id_contato: gerarId("PAE"),
      id_inspecao: idInspecao,
      id_empresa: idEmpresa,
      id_parent: idParent,
      nome: "Novo contato",
      cargo: null,
      telefone: null,
      ordem: siblings.length,
    });
  }

  const raizes = childrenOf.get(null) ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-800">
        <strong>PAE — Plano de Ação e Emergência.</strong> Cadastre os
        contatos em formato hierárquico (o &ldquo;chefe&rdquo; no topo, e os
        subordinados/responsáveis abaixo). Edite os campos diretamente nos
        cards e use <em>+ Adicionar subordinado</em> pra criar novos níveis.
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => adicionar(null)}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Adicionar contato (nível raiz)
          </button>
        </div>
      )}

      {contatos.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum contato cadastrado. Comece pelo nível raiz (responsável
          máximo) e vá adicionando subordinados conforme a hierarquia.
        </div>
      ) : (
        <ul className="space-y-2">
          {raizes.map((r) => (
            <ContatoNode
              key={r.id_contato}
              contato={r}
              childrenOf={childrenOf}
              nivel={0}
              readOnly={readOnly}
              onUpdate={(patch) =>
                save.mutate({ id_contato: r.id_contato, ...patch })
              }
              onAddChild={() => adicionar(r.id_contato)}
              onDelete={() => setConfirm(r)}
              onUpdateAny={(id, patch) =>
                save.mutate({ id_contato: id, ...patch })
              }
              onAddChildAny={(id) => adicionar(id)}
              onDeleteAny={(c) => setConfirm(c)}
            />
          ))}
        </ul>
      )}

      {!readOnly && contatos.length > 0 && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              // Força blur do campo ativo pra disparar o auto-save da
              // edição em andamento (caso o usuário não tenha saído do campo).
              const ativo = document.activeElement as HTMLElement | null;
              if (ativo && typeof ativo.blur === "function") ativo.blur();
              toast.success("Alterações salvas");
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Save className="size-4" /> Salvar alterações
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Remover contato?"
        description={
          confirm
            ? `"${confirm.nome}" e todos os seus subordinados (se houver) serão removidos.`
            : ""
        }
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm.id_contato)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// =========================================================================
// Nó da árvore
// =========================================================================

function ContatoNode({
  contato,
  childrenOf,
  nivel,
  readOnly,
  onUpdate,
  onAddChild,
  onDelete,
  onUpdateAny,
  onAddChildAny,
  onDeleteAny,
}: {
  contato: PaeContato;
  childrenOf: Map<string | null, PaeContato[]>;
  nivel: number;
  readOnly?: boolean;
  onUpdate: (patch: Partial<PaeContato>) => void;
  onAddChild: () => void;
  onDelete: () => void;
  // pra propagar aos filhos (mesmas funções, recursivas)
  onUpdateAny: (id: string, patch: Partial<PaeContato>) => void;
  onAddChildAny: (id: string) => void;
  onDeleteAny: (c: PaeContato) => void;
}) {
  const filhos = childrenOf.get(contato.id_contato) ?? [];
  const [expandido, setExpandido] = useState(true);
  // buffer local pra edição (não persiste a cada keystroke)
  const [nome, setNome] = useState(contato.nome);
  const [cargo, setCargo] = useState(contato.cargo ?? "");
  const [telefone, setTelefone] = useState(contato.telefone ?? "");

  function persistir<K extends keyof PaeContato>(
    campo: K,
    valor: PaeContato[K]
  ) {
    if (contato[campo] === valor) return;
    onUpdate({ [campo]: valor } as Partial<PaeContato>);
  }

  // Indentação visual por nível (max 8 níveis pra não estourar)
  const indent = Math.min(nivel, 8) * 24;

  return (
    <li>
      <div
        className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm"
        style={{ marginLeft: indent }}
      >
        <div className="flex items-start gap-2">
          {filhos.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandido((e) => !e)}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100"
              title={expandido ? "Recolher subordinados" : "Expandir subordinados"}
            >
              {expandido ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          )}
          {filhos.length === 0 && <div className="w-7 shrink-0" />}

          <div className="grid flex-1 gap-2 md:grid-cols-[1fr_1fr_180px]">
            <div className="relative">
              <User className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={nome}
                disabled={readOnly}
                onChange={(e) => setNome(e.target.value)}
                onBlur={() => persistir("nome", nome.trim() || "Novo contato")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Nome"
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-7 pr-2 text-sm font-medium focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
            </div>
            <input
              type="text"
              value={cargo}
              disabled={readOnly}
              onChange={(e) => setCargo(e.target.value)}
              onBlur={() => persistir("cargo", cargo.trim() || null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Cargo"
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
            />
            <div className="relative">
              <Phone className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={telefone}
                disabled={readOnly}
                onChange={(e) => setTelefone(e.target.value)}
                onBlur={() => persistir("telefone", telefone.trim() || null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Telefone"
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-7 pr-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
            </div>
          </div>

          {!readOnly && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onAddChild}
                className="rounded-md border border-verde-primary bg-verde-light px-2 py-1 text-[11px] font-semibold text-verde-primary hover:bg-verde-primary hover:text-white"
                title="Adicionar subordinado"
              >
                + Subordinado
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                title="Remover contato (e seus subordinados)"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {expandido && filhos.length > 0 && (
        <ul
          className={cn("mt-2 space-y-2 border-l-2 border-gray-200")}
          style={{ marginLeft: indent + 12 }}
        >
          {filhos.map((f) => (
            <ContatoNode
              key={f.id_contato}
              contato={f}
              childrenOf={childrenOf}
              nivel={nivel + 1}
              readOnly={readOnly}
              onUpdate={(patch) => onUpdateAny(f.id_contato, patch)}
              onAddChild={() => onAddChildAny(f.id_contato)}
              onDelete={() => onDeleteAny(f)}
              onUpdateAny={onUpdateAny}
              onAddChildAny={onAddChildAny}
              onDeleteAny={onDeleteAny}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
