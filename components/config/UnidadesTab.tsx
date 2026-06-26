"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Building2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useUnidades,
  useCriarUnidade,
  useRenomearUnidade,
  useExcluirUnidade,
} from "@/lib/hooks/useUnidades";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Unidade } from "@/lib/supabase/types";

export default function UnidadesTab() {
  const { data: unidades = [], isLoading } = useUnidades();
  const criar = useCriarUnidade();
  const [novo, setNovo] = useState("");
  const [excluir, setExcluir] = useState<Unidade | null>(null);
  const excluirMut = useExcluirUnidade();

  function add() {
    const v = novo.trim();
    if (!v) return;
    if (unidades.some((u) => u.nome.toLowerCase() === v.toLowerCase())) {
      toast.error("Já existe uma unidade com esse nome");
      return;
    }
    criar.mutate(v, { onSuccess: () => setNovo("") });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Unidades</h2>
        <p className="mt-1 text-sm text-gray-600">
          Unidades agrupam empresas para controle de acesso. Cada empresa pode
          ser vinculada a uma unidade, e cada usuário (Técnico/Visualizador) a
          várias. O usuário enxerga as empresas das unidades dele.{" "}
          <strong>Empresa sem unidade fica visível para todos.</strong> Admins
          veem tudo.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nome da unidade (ex: Matriz, Filial Teresópolis, Carteira A)…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
        <button
          type="button"
          onClick={add}
          disabled={criar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
        >
          <Plus className="size-4" /> Adicionar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : unidades.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhuma unidade cadastrada. Sem unidades, todas as empresas ficam
          visíveis para todos os usuários.
        </p>
      ) : (
        <ul className="space-y-2">
          {unidades.map((u) => (
            <LinhaUnidade key={u.id_unidade} unidade={u} onExcluir={() => setExcluir(u)} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!excluir}
        title="Excluir unidade"
        description={`Excluir a unidade "${excluir?.nome}"? As empresas vinculadas a ela voltam a ficar visíveis para todos os usuários.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={excluirMut.isPending}
        onConfirm={() => {
          if (!excluir) return;
          excluirMut.mutate(excluir.id_unidade, { onSuccess: () => setExcluir(null) });
        }}
        onCancel={() => setExcluir(null)}
      />
    </section>
  );
}

function LinhaUnidade({
  unidade,
  onExcluir,
}: {
  unidade: Unidade;
  onExcluir: () => void;
}) {
  const [nome, setNome] = useState(unidade.nome);
  const renomear = useRenomearUnidade();
  const dirty = nome.trim() !== unidade.nome && nome.trim().length > 0;

  return (
    <li className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Building2 className="size-4 shrink-0 text-gray-400" />
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none"
      />
      {dirty && (
        <button
          type="button"
          onClick={() =>
            renomear.mutate({ id_unidade: unidade.id_unidade, nome })
          }
          disabled={renomear.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {renomear.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Salvar
        </button>
      )}
      <button
        type="button"
        onClick={onExcluir}
        className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-alert"
        title="Excluir unidade"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
