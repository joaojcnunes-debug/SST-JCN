"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useDeleteOpcaoTriagem,
  useDeleteTriagem,
  useModelosPorTipo,
  useOpcoesDaTriagem,
  useSaveOpcaoTriagem,
  useSaveTriagem,
  useTriagensPorTipo,
} from "@/lib/hooks/useV3";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { gerarId, cn } from "@/lib/utils";
import type { TriagemOpcao, TriagemTipoRisco } from "@/lib/supabase/types";

/**
 * Gerencia triagens (perguntas + opções) de um tipo de risco.
 * Usado dentro do CatalogoTipoPanel. Cada triagem tem opções
 * multi-selecionáveis no RiscoForm; cada opção pode estar
 * vinculada a um modelo do mesmo tipo.
 */
export default function TriagensDoTipo({ idTipo }: { idTipo: string }) {
  const { data: triagens = [] } = useTriagensPorTipo(idTipo, {
    incluirInativas: true,
  });
  const save = useSaveTriagem();
  const del = useDeleteTriagem();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TriagemTipoRisco | null>(null);
  const [confirm, setConfirm] = useState<TriagemTipoRisco | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  function reordenar(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= triagens.length) return;
    const a = triagens[idx];
    const b = triagens[target];
    save.mutate({ id_triagem: a.id_triagem, id_tipo: a.id_tipo, ordem: b.ordem });
    save.mutate({ id_triagem: b.id_triagem, id_tipo: b.id_tipo, ordem: a.ordem });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          Triagens ({triagens.length})
        </h4>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-3.5" /> Nova Triagem
        </button>
      </div>

      {triagens.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-center text-xs text-gray-500">
          Nenhuma triagem cadastrada. Use triagens pra perguntar coisas como
          &ldquo;Há desconforto térmico, acústico ou visual?&rdquo; — cada
          opção marcada pode pré-preencher um modelo no RiscoForm.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {triagens.map((t, i) => (
            <TriagemCard
              key={t.id_triagem}
              triagem={t}
              idTipo={idTipo}
              expandida={expandida === t.id_triagem}
              onToggle={() =>
                setExpandida((cur) =>
                  cur === t.id_triagem ? null : t.id_triagem
                )
              }
              onEditar={() => {
                setEditing(t);
                setModalOpen(true);
              }}
              onRemover={() => setConfirm(t)}
              onAtivarToggle={() =>
                save.mutate({
                  id_triagem: t.id_triagem,
                  id_tipo: t.id_tipo,
                  ativo: !t.ativo,
                })
              }
              onSubir={() => reordenar(i, -1)}
              onDescer={() => reordenar(i, 1)}
              isFirst={i === 0}
              isLast={i === triagens.length - 1}
            />
          ))}
        </ul>
      )}

      <TriagemModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        idTipo={idTipo}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Remover triagem?"
        description={`"${confirm?.texto}" e suas opções serão removidas.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          confirm &&
          del.mutate(confirm.id_triagem, {
            onSuccess: () => setConfirm(null),
          })
        }
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function TriagemCard({
  triagem,
  idTipo,
  expandida,
  onToggle,
  onEditar,
  onRemover,
  onAtivarToggle,
  onSubir,
  onDescer,
  isFirst,
  isLast,
}: {
  triagem: TriagemTipoRisco;
  idTipo: string;
  expandida: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onRemover: () => void;
  onAtivarToggle: () => void;
  onSubir: () => void;
  onDescer: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { data: opcoes = [] } = useOpcoesDaTriagem(triagem.id_triagem, {
    incluirInativas: true,
  });

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border bg-white",
        triagem.ativo ? "border-gray-200" : "border-gray-200 opacity-60"
      )}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
          title={expandida ? "Recolher" : "Expandir"}
        >
          {expandida ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <div className="flex-1 cursor-pointer" onClick={onToggle}>
          <p className="text-sm font-medium text-gray-900">{triagem.texto}</p>
          <p className="text-[10px] text-gray-400">
            {opcoes.filter((o) => o.ativo).length} opção(ões)
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onSubir}
            disabled={isFirst}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="Subir"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDescer}
            disabled={isLast}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="Descer"
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onAtivarToggle}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            title={triagem.ativo ? "Desativar" : "Ativar"}
          >
            {triagem.ativo ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="rounded p-1 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
            title="Editar pergunta"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemover}
            className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-alert"
            title="Remover triagem"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {expandida && (
        <div className="border-t border-gray-200 bg-gray-50 p-2">
          <OpcoesEditor idTriagem={triagem.id_triagem} idTipo={idTipo} opcoes={opcoes} />
        </div>
      )}
    </li>
  );
}

// =========================================================================
// Editor de opções de uma triagem
// =========================================================================

function OpcoesEditor({
  idTriagem,
  idTipo,
  opcoes,
}: {
  idTriagem: string;
  idTipo: string;
  opcoes: TriagemOpcao[];
}) {
  const { data: modelos = [] } = useModelosPorTipo(idTipo);
  const save = useSaveOpcaoTriagem();
  const del = useDeleteOpcaoTriagem();
  const [novoTexto, setNovoTexto] = useState("");
  const [novoModelo, setNovoModelo] = useState<string>("");

  function adicionar() {
    const txt = novoTexto.trim();
    if (!txt) {
      toast.error("Texto da opção é obrigatório");
      return;
    }
    save.mutate(
      {
        id_opcao: gerarId("OPC"),
        id_triagem: idTriagem,
        texto: txt,
        id_modelo: novoModelo || null,
        ordem: opcoes.length,
        ativo: true,
      },
      {
        onSuccess: () => {
          setNovoTexto("");
          setNovoModelo("");
        },
      }
    );
  }

  function mover(opcao: TriagemOpcao, dir: -1 | 1) {
    const idx = opcoes.findIndex((o) => o.id_opcao === opcao.id_opcao);
    const target = idx + dir;
    if (target < 0 || target >= opcoes.length) return;
    const a = opcoes[idx];
    const b = opcoes[target];
    save.mutate({
      id_opcao: a.id_opcao,
      id_triagem: idTriagem,
      ordem: b.ordem,
    });
    save.mutate({
      id_opcao: b.id_opcao,
      id_triagem: idTriagem,
      ordem: a.ordem,
    });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Opções (multi-select no form)
      </p>
      {opcoes.length > 0 && (
        <ul className="space-y-1">
          {opcoes.map((o, i) => {
            const modelo = modelos.find((m) => m.id_modelo === o.id_modelo);
            return (
              <li
                key={o.id_opcao}
                className={cn(
                  "flex items-center gap-1.5 rounded border bg-white px-2 py-1.5",
                  o.ativo ? "border-gray-200" : "border-gray-200 opacity-60"
                )}
              >
                <span className="w-5 text-center text-xs font-mono text-gray-400">
                  {i}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{o.texto}</p>
                  {o.id_modelo && (
                    <p className="text-[10px] text-verde-primary">
                      → modelo: {modelo?.agente ?? o.id_modelo}
                    </p>
                  )}
                </div>
                <select
                  value={o.id_modelo ?? ""}
                  onChange={(e) =>
                    save.mutate({
                      id_opcao: o.id_opcao,
                      id_triagem: idTriagem,
                      texto: o.texto,
                      id_modelo: e.target.value || null,
                    })
                  }
                  className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px]"
                  title="Vincular a um modelo (opcional)"
                >
                  <option value="">— sem modelo —</option>
                  {modelos.map((m) => (
                    <option key={m.id_modelo} value={m.id_modelo}>
                      {m.agente}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => mover(o, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  title="Subir"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(o, 1)}
                  disabled={i === opcoes.length - 1}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  title="Descer"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    save.mutate({
                      id_opcao: o.id_opcao,
                      id_triagem: idTriagem,
                      ativo: !o.ativo,
                    })
                  }
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                  title={o.ativo ? "Desativar" : "Ativar"}
                >
                  {o.ativo ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => del.mutate(o.id_opcao)}
                  className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                  title="Remover"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_180px_auto] gap-1.5">
        <input
          type="text"
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder="Texto da opção (ex: Térmico)"
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        />
        <select
          value={novoModelo}
          onChange={(e) => setNovoModelo(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        >
          <option value="">— sem modelo —</option>
          {modelos.map((m) => (
            <option key={m.id_modelo} value={m.id_modelo}>
              {m.agente}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={adicionar}
          disabled={save.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
}

// =========================================================================
// Modal de criação/edição da TRIAGEM (apenas o texto da pergunta)
// =========================================================================

function TriagemModal({
  open,
  onClose,
  idTipo,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  idTipo: string;
  editing: TriagemTipoRisco | null;
}) {
  const save = useSaveTriagem();
  const [texto, setTexto] = useState("");
  const [ordem, setOrdem] = useState(99);

  // Reset on open
  if (open && editing && texto === "" && editing.texto !== "") {
    setTexto(editing.texto);
    setOrdem(editing.ordem);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) {
      toast.error("Texto da pergunta é obrigatório");
      return;
    }
    save.mutate(
      {
        id_triagem: editing?.id_triagem ?? gerarId("TRI"),
        id_tipo: idTipo,
        texto: texto.trim(),
        ordem,
        ativo: editing?.ativo ?? true,
      },
      {
        onSuccess: () => {
          setTexto("");
          setOrdem(99);
          onClose();
        },
      }
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setTexto("");
        onClose();
      }}
      title={editing ? "Editar Triagem" : "Nova Triagem"}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Pergunta *
          </label>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            placeholder="Ex: Há desconforto térmico, acústico ou visual?"
            required
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Aparece no RiscoForm acima do agente. Após criar, expanda o card
            pra adicionar as opções multi-selecionáveis.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">
            Ordem (menor = primeiro)
          </label>
          <input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value) || 0)}
            className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => {
              setTexto("");
              onClose();
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
