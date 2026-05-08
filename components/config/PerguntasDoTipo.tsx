"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import toast from "react-hot-toast";
import {
  useTodasPerguntas,
  useSavePergunta,
  useDeletePergunta,
} from "@/lib/hooks/useV3";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { gerarId, cn } from "@/lib/utils";
import type { PerguntaTipoRisco } from "@/lib/supabase/types";

/**
 * Lista + modal de perguntas customizadas escopadas num único tipo.
 * Compartilhado entre a aba global "Perguntas Customizadas" (que injeta
 * o seletor de tipo por fora) e o modal Catálogo (que já está escopado
 * num tipo).
 */
export default function PerguntasDoTipo({ idTipo }: { idTipo: string }) {
  const { data: perguntas = [] } = useTodasPerguntas(idTipo);
  const save = useSavePergunta();
  const del = useDeletePergunta();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PerguntaTipoRisco | null>(null);
  const [confirm, setConfirm] = useState<PerguntaTipoRisco | null>(null);

  function reordenar(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= perguntas.length) return;
    const a = perguntas[idx];
    const b = perguntas[target];
    save.mutate({
      id_pergunta: a.id_pergunta,
      id_tipo: a.id_tipo,
      ordem: b.ordem,
    });
    save.mutate({
      id_pergunta: b.id_pergunta,
      id_tipo: b.id_tipo,
      ordem: a.ordem,
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Perguntas ({perguntas.length})
        </h3>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-4" /> Nova Pergunta
        </button>
      </div>

      {perguntas.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhuma pergunta customizada para este tipo ainda.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {perguntas.map((p, i) => (
            <li
              key={p.id_pergunta}
              className={cn(
                "rounded-lg border bg-white p-2.5",
                p.ativo ? "border-gray-200" : "border-gray-200 opacity-50"
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {p.texto}
                    {p.obrigatoria && (
                      <span className="ml-1 text-red-alert">*</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
                      {p.chave}
                    </span>
                    <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5">
                      {p.input_type}
                    </span>
                    {p.input_type === "select" &&
                      p.opcoes &&
                      p.opcoes.length > 0 && (
                        <span>{p.opcoes.length} opção(ões)</span>
                      )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => reordenar(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Subir"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reordenar(i, 1)}
                    disabled={i === perguntas.length - 1}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Descer"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setModalOpen(true);
                    }}
                    className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(p)}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PerguntaModal
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
        title="Remover pergunta?"
        description={`"${confirm?.texto}" será removida. Respostas antigas continuam no banco mas deixarão de aparecer no form.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm.id_pergunta)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

/**
 * Converte texto livre em slug compatível com a constraint do banco
 * (chave começa com letra, contém só letras/números/underscore).
 */
function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 60) || "pergunta";
}

function uniqueSlug(base: string, existentes: string[]): string {
  if (!existentes.includes(base)) return base;
  let i = 2;
  while (existentes.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function PerguntaModal({
  open,
  onClose,
  idTipo,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  idTipo: string;
  editing: PerguntaTipoRisco | null;
}) {
  const save = useSavePergunta();
  const { data: existentes = [] } = useTodasPerguntas(idTipo);
  const [form, setForm] = useState({
    chave: "",
    texto: "",
    input_type: "select" as "select" | "text" | "textarea",
    opcoes: ["Sim", "Não", "N/A"],
    ordem: 99,
    obrigatoria: false,
  });

  useEffect(() => {
    if (open) {
      setForm({
        chave: editing?.chave ?? "",
        texto: editing?.texto ?? "",
        input_type: editing?.input_type ?? "select",
        opcoes: editing?.opcoes?.length
          ? editing.opcoes
          : ["Sim", "Não", "N/A"],
        ordem: editing?.ordem ?? 99,
        obrigatoria: editing?.obrigatoria ?? false,
      });
    }
  }, [open, editing]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.texto.trim()) {
      toast.error("Texto da pergunta é obrigatório");
      return;
    }

    let chaveFinal = form.chave.trim();
    if (!editing) {
      if (!chaveFinal) {
        chaveFinal = slugify(form.texto);
      }
      const usadas = existentes.map((p) => p.chave);
      chaveFinal = uniqueSlug(chaveFinal, usadas);
    }

    if (!/^[a-z][a-z0-9_]*$/i.test(chaveFinal)) {
      toast.error(
        "Não foi possível gerar uma chave válida. Informe uma manualmente (letras, números e _)"
      );
      return;
    }

    save.mutate(
      {
        id_pergunta: editing?.id_pergunta ?? gerarId("PRG"),
        id_tipo: idTipo,
        chave: chaveFinal,
        texto: form.texto.trim(),
        input_type: form.input_type,
        opcoes: form.input_type === "select" ? form.opcoes : [],
        ordem: form.ordem,
        obrigatoria: form.obrigatoria,
        ativo: true,
      },
      { onSuccess: onClose }
    );
  }

  function setOpcao(idx: number, val: string) {
    setForm({
      ...form,
      opcoes: form.opcoes.map((o, i) => (i === idx ? val : o)),
    });
  }
  function addOpcao() {
    setForm({ ...form, opcoes: [...form.opcoes, ""] });
  }
  function removeOpcao(idx: number) {
    setForm({ ...form, opcoes: form.opcoes.filter((_, i) => i !== idx) });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Pergunta" : "Nova Pergunta"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Chave {editing ? "" : <span className="text-gray-400">(opcional)</span>}
            </label>
            <input
              type="text"
              value={form.chave}
              onChange={(e) =>
                setForm({
                  ...form,
                  chave: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "_"),
                })
              }
              placeholder={editing ? "" : "Deixe vazio para gerar do texto"}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              disabled={!!editing}
            />
            <p className="mt-1 text-xs text-gray-500">
              {editing
                ? "Identificador interno (não muda após criação)."
                : "Se vazio, gera automaticamente a partir do texto."}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={form.input_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  input_type: e.target.value as typeof form.input_type,
                })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            >
              <option value="select">Seleção (dropdown)</option>
              <option value="text">Texto curto</option>
              <option value="textarea">Texto longo</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Texto da pergunta *
          </label>
          <input
            type="text"
            value={form.texto}
            onChange={(e) => setForm({ ...form, texto: e.target.value })}
            placeholder="Como vai aparecer pro usuário"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            required
          />
        </div>

        {form.input_type === "select" && (
          <div>
            <label className="text-sm font-medium text-gray-700">
              Opções do dropdown
            </label>
            <div className="mt-1 space-y-1.5">
              {form.opcoes.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOpcao(i, e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => removeOpcao(i)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-red-50 hover:text-red-alert"
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOpcao}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Plus className="size-3.5" /> Adicionar opção
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.obrigatoria}
              onChange={(e) =>
                setForm({ ...form, obrigatoria: e.target.checked })
              }
              className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
            />
            Obrigatória
          </label>
          <div>
            <label className="text-xs font-medium text-gray-700">Ordem</label>
            <input
              type="number"
              value={form.ordem}
              onChange={(e) =>
                setForm({ ...form, ordem: Number(e.target.value) || 0 })
              }
              className="mt-0.5 w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
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
