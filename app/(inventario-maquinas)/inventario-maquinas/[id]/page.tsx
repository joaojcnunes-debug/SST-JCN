"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Loader2, Trash2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import MaquinaForm from "@/components/inventario-maquinas/MaquinaForm";
import {
  useMaquina,
  useAtualizarMaquina,
  useExcluirMaquina,
  type MaquinaInput,
} from "@/lib/hooks/useInventarioMaquinas";
import { useCanEdit, useCanDelete } from "@/lib/hooks/useUsuario";

export default function DetalheMaquinaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const canEdit = useCanEdit();
  const canDelete = useCanDelete();
  const { data: maquina, isLoading, error } = useMaquina(id);
  const atualizar = useAtualizarMaquina();
  const excluir = useExcluirMaquina();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  async function handleSubmit(input: MaquinaInput) {
    if (!id) return;
    try {
      await atualizar.mutateAsync({ id_maquina: id, patch: input });
      toast.success("Máquina atualizada");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar alterações");
    }
  }

  async function handleExcluir() {
    if (!id) return;
    try {
      await excluir.mutateAsync(id);
      toast.success("Máquina excluída");
      router.push("/inventario-maquinas");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao excluir máquina");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !maquina) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href="/inventario-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao inventário
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          Máquina não encontrada ou indisponível.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/inventario-maquinas"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
      >
        <ArrowLeft className="size-3.5" /> Voltar ao inventário
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Boxes className="size-5 text-blue-600" />
          {maquina.nome}
        </h1>
        <p className="text-xs text-gray-500">
          Cadastrado em{" "}
          {new Date(maquina.created_at).toLocaleDateString("pt-BR")}
          {maquina.usuario_nome ? ` por ${maquina.usuario_nome}` : ""}
          {maquina.updated_at
            ? ` · Atualizado em ${new Date(maquina.updated_at).toLocaleDateString("pt-BR")}`
            : ""}
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Você está em modo somente leitura. Apenas usuários com permissão de
          edição podem alterar dados desta máquina.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <MaquinaForm
          inicial={maquina}
          idMaquina={maquina.id_maquina}
          disabled={!canEdit}
          onSubmit={handleSubmit}
          submitLabel="Salvar alterações"
        />
      </div>

      {canDelete && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <h2 className="text-sm font-bold text-red-700">Zona de perigo</h2>
          <p className="mt-1 text-xs text-red-700/80">
            Excluir esta máquina remove o cadastro e a foto vinculada. Esta ação
            não pode ser desfeita.
          </p>
          {confirmandoExclusao ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-red-700">
                Tem certeza?
              </p>
              <button
                type="button"
                onClick={handleExcluir}
                disabled={excluir.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {excluir.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Sim, excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="size-3" /> Excluir máquina
            </button>
          )}
        </div>
      )}
    </div>
  );
}
