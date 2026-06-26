"use client";

import { useState } from "react";
import { Brain, Plus, Pencil, Trash2, Check, X, RotateCcw, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  useAgravos,
  useCriarAgravo,
  useAtualizarAgravo,
  useExcluirAgravo,
  useRestaurarBaseAgravos,
  type AgravoCatalogo,
} from "@/lib/hooks/useAgravos";

export default function AgravosPage() {
  const canEdit = useCanEdit();
  const { data: agravos = [], isLoading } = useAgravos();
  const criar = useCriarAgravo();
  const atualizar = useAtualizarAgravo();
  const excluir = useExcluirAgravo();
  const restaurar = useRestaurarBaseAgravos();

  const [novo, setNovo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [aExcluir, setAExcluir] = useState<AgravoCatalogo | null>(null);

  function handleCriar() {
    const t = novo.trim();
    if (!t) return;
    criar.mutate(t, { onSuccess: () => setNovo("") });
  }

  function iniciarEdicao(a: AgravoCatalogo) {
    setEditId(a.id);
    setEditTexto(a.titulo);
  }
  function salvarEdicao() {
    if (!editId) return;
    const t = editTexto.trim();
    if (!t) return;
    atualizar.mutate({ id: editId, titulo: t }, { onSuccess: () => setEditId(null) });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 reveal-up">
      {/* Cabeçalho */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
              <Brain className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Possíveis Agravos à Saúde Mental</h1>
              <p className="text-xs text-gray-500">
                Catálogo base do campo “Possíveis Agravos à Saúde Mental” na aba Análise e Avaliação.
                {agravos.length > 0 ? ` ${agravos.length} cadastrado(s).` : ""}
              </p>
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => restaurar.mutate()}
              disabled={restaurar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              title="Repõe os agravos da base inicial que estiverem faltando"
            >
              {restaurar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Restaurar base
            </button>
          )}
        </div>

        {/* Adicionar */}
        {canEdit && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriar()}
              placeholder="Novo agravo à saúde mental..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCriar}
              disabled={criar.isPending || !novo.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Adicionar
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        ) : agravos.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Nenhum agravo cadastrado.{canEdit ? " Use “Restaurar base” ou adicione acima." : ""}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {agravos.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  !a.ativo && "bg-gray-50/60 opacity-60"
                )}
              >
                {editId === a.id ? (
                  <>
                    <input
                      autoFocus
                      value={editTexto}
                      onChange={(e) => setEditTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") salvarEdicao();
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="flex-1 rounded-lg border border-verde-primary/40 px-2.5 py-1.5 text-sm"
                    />
                    <button type="button" onClick={salvarEdicao} disabled={atualizar.isPending} className="rounded-md p-1.5 text-verde-primary hover:bg-verde-light" title="Salvar">
                      <Check className="size-4" />
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" title="Cancelar">
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={cn("flex-1 text-sm text-gray-800", !a.ativo && "line-through")}>{a.titulo}</span>
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => atualizar.mutate({ id: a.id, ativo: !a.ativo })}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={a.ativo ? "Desativar (não aparece na Análise)" : "Ativar"}
                        >
                          {a.ativo ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </button>
                        <button type="button" onClick={() => iniciarEdicao(a)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Editar">
                          <Pencil className="size-4" />
                        </button>
                        <button type="button" onClick={() => setAExcluir(a)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Excluir">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!aExcluir}
        variant="danger"
        title="Excluir agravo?"
        description={
          aExcluir
            ? `"${aExcluir.titulo}" será removido do catálogo (recuperável na Lixeira). Não afeta relatórios já preenchidos.`
            : ""
        }
        confirmLabel="Excluir"
        loading={excluir.isPending}
        onCancel={() => setAExcluir(null)}
        onConfirm={() => {
          if (aExcluir) excluir.mutate(aExcluir.id, { onSuccess: () => setAExcluir(null) });
        }}
      />
    </div>
  );
}
