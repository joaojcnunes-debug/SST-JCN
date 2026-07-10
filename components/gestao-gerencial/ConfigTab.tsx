"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Loader2, Layers, Clock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useGGCategorias, useGGTurnos, useCategoriaCrud, useTurnoCrud,
  type GGCategoria, type GGTurno,
} from "@/lib/hooks/useGestaoGerencial";

type Item = GGCategoria | GGTurno;
type Crud = ReturnType<typeof useCategoriaCrud>;

/**
 * Configuração da unidade: categorias (Médico/Técnico/Fono) e turnos (Manhã/Tarde),
 * ambos POR UNIDADE. Reusa a mesma lista para os dois (mesmo shape).
 */
export default function ConfigTab({ idUnidade }: { idUnidade: string }) {
  const cats = useGGCategorias(idUnidade);
  const turnos = useGGTurnos(idUnidade);
  const catCrud = useCategoriaCrud();
  const turnoCrud = useTurnoCrud();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ListaConfig
        titulo="Categorias"
        descricao="Funções da equipe desta unidade (ex.: Médico, Técnico, Fonoaudiólogo)."
        icone={<Layers className="size-4 text-verde-primary" />}
        idUnidade={idUnidade}
        itens={cats.data ?? []}
        carregando={cats.isLoading}
        crud={catCrud}
      />
      <ListaConfig
        titulo="Turnos"
        descricao="Períodos de trabalho desta unidade (ex.: Manhã, Tarde)."
        icone={<Clock className="size-4 text-verde-primary" />}
        idUnidade={idUnidade}
        itens={turnos.data ?? []}
        carregando={turnos.isLoading}
        crud={turnoCrud}
      />
    </div>
  );
}

function ListaConfig({
  titulo, descricao, icone, idUnidade, itens, carregando, crud,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  idUnidade: string;
  itens: Item[];
  carregando: boolean;
  crud: Crud;
}) {
  const podeEditar = useCanEdit();
  const [novo, setNovo] = useState("");
  const [excluir, setExcluir] = useState<Item | null>(null);

  function add() {
    const v = novo.trim();
    if (!v) return;
    if (itens.some((i) => i.nome.toLowerCase() === v.toLowerCase())) {
      toast.error("Já existe um item com esse nome");
      return;
    }
    const ordem = itens.reduce((m, i) => Math.max(m, i.ordem), 0) + 1;
    crud.criar.mutate({ id_unidade: idUnidade, nome: v, ordem }, { onSuccess: () => setNovo("") });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        {icone}
        <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      </div>
      <p className="mb-3 text-xs text-gray-500">{descricao}</p>

      {podeEditar && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`Novo item de ${titulo.toLowerCase()}…`}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
          />
          <button
            type="button"
            onClick={add}
            disabled={crud.criar.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-500">
          Nenhum item cadastrado.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((it) => (
            <LinhaItem
              key={it.id}
              item={it}
              idUnidade={idUnidade}
              crud={crud}
              podeEditar={podeEditar}
              onExcluir={() => setExcluir(it)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!excluir}
        title={`Excluir "${excluir?.nome}"`}
        description="Se houver profissionais ou escalas usando este item, os vínculos correspondentes serão afetados."
        confirmLabel="Excluir"
        variant="danger"
        loading={crud.excluir.isPending}
        onConfirm={() => {
          if (!excluir) return;
          crud.excluir.mutate({ id: excluir.id, id_unidade: idUnidade }, { onSuccess: () => setExcluir(null) });
        }}
        onCancel={() => setExcluir(null)}
      />
    </section>
  );
}

function LinhaItem({
  item, idUnidade, crud, podeEditar, onExcluir,
}: {
  item: Item;
  idUnidade: string;
  crud: Crud;
  podeEditar: boolean;
  onExcluir: () => void;
}) {
  const [nome, setNome] = useState(item.nome);
  const dirty = nome.trim() !== item.nome && nome.trim().length > 0;

  return (
    <li className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${item.ativo ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50"}`}>
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        disabled={!podeEditar}
        className={`flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm ${item.ativo ? "text-gray-900" : "text-gray-400 line-through"} hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none disabled:cursor-default`}
      />
      {podeEditar && dirty && (
        <button
          type="button"
          onClick={() => crud.atualizar.mutate({ id: item.id, id_unidade: idUnidade, nome })}
          disabled={crud.atualizar.isPending}
          className="inline-flex items-center gap-1 rounded bg-verde-primary px-2 py-0.5 text-xs font-medium text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {crud.atualizar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
        </button>
      )}
      {podeEditar && (
        <>
          <button
            type="button"
            onClick={() => crud.atualizar.mutate({ id: item.id, id_unidade: idUnidade, ativo: !item.ativo })}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title={item.ativo ? "Desativar" : "Ativar"}
          >
            {item.ativo ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={onExcluir}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
            title="Excluir"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </li>
  );
}
