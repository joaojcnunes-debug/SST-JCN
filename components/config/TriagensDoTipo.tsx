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
  useDeleteTriagem,
  useModelosDaTriagem,
  useModelosPorTipo,
  useSaveTriagem,
  useToggleModeloTriagem,
  useTriagensPorTipo,
} from "@/lib/hooks/useV3";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { gerarId, cn } from "@/lib/utils";
import type { TriagemTipoRisco } from "@/lib/supabase/types";

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
  const { data: relacoes = [] } = useModelosDaTriagem(triagem.id_triagem);

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
            {relacoes.length} modelo(s) associado(s)
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
          <ModelosLinker
            idTriagem={triagem.id_triagem}
            idTipo={idTipo}
            associados={relacoes}
          />
        </div>
      )}
    </li>
  );
}

// =========================================================================
// V8: Linker — multi-select dos modelos do tipo associados à triagem
// =========================================================================

function ModelosLinker({
  idTriagem,
  idTipo,
  associados,
}: {
  idTriagem: string;
  idTipo: string;
  associados: { id_triagem: string; id_modelo: string; ordem: number }[];
}) {
  const { data: modelos = [] } = useModelosPorTipo(idTipo);
  const toggle = useToggleModeloTriagem();

  const idsAssociados = new Set(associados.map((a) => a.id_modelo));

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Modelos associados (aparecem como checkboxes no form)
      </p>
      {modelos.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 bg-white px-2 py-1.5 text-[11px] text-gray-500">
          Nenhum modelo cadastrado neste tipo. Crie modelos antes de associar.
        </p>
      ) : (
        <ul className="space-y-1">
          {modelos.map((m) => {
            const isOn = idsAssociados.has(m.id_modelo);
            return (
              <li
                key={m.id_modelo}
                className={cn(
                  "flex items-center gap-2 rounded border bg-white px-2 py-1.5",
                  isOn
                    ? "border-verde-primary bg-verde-light/30"
                    : "border-gray-200"
                )}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() =>
                    toggle.mutate({
                      id_triagem: idTriagem,
                      id_modelo: m.id_modelo,
                      ativar: !isOn,
                      ordem: associados.length,
                    })
                  }
                  className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {m.agente}
                  </p>
                  {!m.ativo && (
                    <p className="text-[10px] text-gray-400">(modelo inativo)</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
