"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Save, Loader2, UserPlus, Link2, Eye, EyeOff, User } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useGGEquipe, useGGCategorias, useTodosProfissionais, useGGProfissionalMut,
  type GGVinculo,
} from "@/lib/hooks/useGestaoGerencial";

/**
 * Equipe da unidade: profissionais vinculados (com a categoria daquela unidade).
 * Um profissional é uma entidade compartilhada — pode atuar em várias unidades;
 * aqui gerencia-se apenas o vínculo com ESTA unidade.
 */
export default function ProfissionaisTab({ idUnidade }: { idUnidade: string }) {
  const podeEditar = useCanEdit();
  const equipe = useGGEquipe(idUnidade);
  const cats = useGGCategorias(idUnidade);
  const catsAtivas = useMemo(() => (cats.data ?? []).filter((c) => c.ativo), [cats.data]);
  const [excluir, setExcluir] = useState<GGVinculo | null>(null);
  const mut = useGGProfissionalMut();

  return (
    <section className="space-y-4">
      {catsAtivas.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-sm text-amber-800">
          Cadastre ao menos uma <strong>categoria</strong> na aba <em>Configuração</em> antes de adicionar profissionais.
        </p>
      ) : (
        podeEditar && <AddProfissional idUnidade={idUnidade} equipe={equipe.data ?? []} categorias={catsAtivas} mut={mut} />
      )}

      {equipe.isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : (equipe.data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhum profissional nesta unidade.
        </p>
      ) : (
        <ul className="space-y-2">
          {(equipe.data ?? []).map((v) => (
            <LinhaProfissional
              key={v.id}
              vinculo={v}
              idUnidade={idUnidade}
              categorias={catsAtivas}
              podeEditar={podeEditar}
              mut={mut}
              onExcluir={() => setExcluir(v)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!excluir}
        title="Remover da unidade"
        description={`Remover "${excluir?.profissional?.nome}" desta unidade? O profissional continua cadastrado e nas outras unidades onde atua. A escala dele nesta unidade também será removida.`}
        confirmLabel="Remover"
        variant="danger"
        loading={mut.desvincular.isPending}
        onConfirm={() => {
          if (!excluir) return;
          mut.desvincular.mutate({ id_vinculo: excluir.id, id_unidade: idUnidade }, { onSuccess: () => setExcluir(null) });
        }}
        onCancel={() => setExcluir(null)}
      />
    </section>
  );
}

function AddProfissional({
  idUnidade, equipe, categorias, mut,
}: {
  idUnidade: string;
  equipe: GGVinculo[];
  categorias: { id: string; nome: string }[];
  mut: ReturnType<typeof useGGProfissionalMut>;
}) {
  const [modo, setModo] = useState<"novo" | "existente">("novo");
  const [nome, setNome] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [idExistente, setIdExistente] = useState("");
  const todos = useTodosProfissionais();

  // profissionais que ainda NÃO estão nesta unidade
  const naUnidade = useMemo(() => new Set(equipe.map((v) => v.id_profissional)), [equipe]);
  const disponiveis = useMemo(
    () => (todos.data ?? []).filter((p) => !naUnidade.has(p.id)),
    [todos.data, naUnidade],
  );

  function salvar() {
    const cat = idCategoria || categorias[0]?.id;
    if (!cat) { toast.error("Selecione uma categoria"); return; }
    if (modo === "novo") {
      const v = nome.trim();
      if (!v) { toast.error("Informe o nome"); return; }
      mut.criarEVincular.mutate(
        { nome: v, id_unidade: idUnidade, id_categoria: cat },
        { onSuccess: () => { setNome(""); setIdCategoria(""); } },
      );
    } else {
      if (!idExistente) { toast.error("Selecione um profissional"); return; }
      mut.vincular.mutate(
        { id_profissional: idExistente, id_unidade: idUnidade, id_categoria: cat },
        { onSuccess: () => { setIdExistente(""); setIdCategoria(""); } },
      );
    }
  }

  const pending = mut.criarEVincular.isPending || mut.vincular.isPending;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setModo("novo")}
          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium ${modo === "novo" ? "bg-verde-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <UserPlus className="size-3.5" /> Novo
        </button>
        <button
          type="button"
          onClick={() => setModo("existente")}
          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium ${modo === "existente" ? "bg-verde-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <Link2 className="size-3.5" /> Vincular existente
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {modo === "novo" ? (
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="Nome do profissional…"
            className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
          />
        ) : (
          <select
            value={idExistente}
            onChange={(e) => setIdExistente(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
          >
            <option value="">Selecione um profissional…</option>
            {disponiveis.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}{p.ativo ? "" : " (inativo)"}</option>
            ))}
          </select>
        )}

        <select
          value={idCategoria}
          onChange={(e) => setIdCategoria(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        >
          <option value="">Categoria…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar
        </button>
      </div>
      {modo === "existente" && disponiveis.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">Todos os profissionais cadastrados já estão nesta unidade.</p>
      )}
    </div>
  );
}

function LinhaProfissional({
  vinculo, idUnidade, categorias, podeEditar, mut, onExcluir,
}: {
  vinculo: GGVinculo;
  idUnidade: string;
  categorias: { id: string; nome: string }[];
  podeEditar: boolean;
  mut: ReturnType<typeof useGGProfissionalMut>;
  onExcluir: () => void;
}) {
  const ativo = vinculo.profissional?.ativo ?? true;
  const [nome, setNome] = useState(vinculo.profissional?.nome ?? "");
  const dirty = nome.trim() !== (vinculo.profissional?.nome ?? "") && nome.trim().length > 0;

  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${ativo ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50"}`}>
      <User className={`size-4 shrink-0 ${ativo ? "text-gray-400" : "text-gray-300"}`} />
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        disabled={!podeEditar}
        className={`min-w-[160px] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm ${ativo ? "text-gray-900" : "text-gray-400 line-through"} hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none disabled:cursor-default`}
      />

      <select
        value={vinculo.id_categoria ?? ""}
        disabled={!podeEditar}
        onChange={(e) => mut.setCategoria.mutate({ id_vinculo: vinculo.id, id_unidade: idUnidade, id_categoria: e.target.value })}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-verde-primary focus:outline-none disabled:cursor-default disabled:opacity-70"
      >
        <option value="">Sem categoria</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>

      {podeEditar && dirty && (
        <button
          type="button"
          onClick={() => mut.atualizarProf.mutate({ id: vinculo.id_profissional, id_unidade: idUnidade, nome })}
          disabled={mut.atualizarProf.isPending}
          className="inline-flex items-center gap-1 rounded bg-verde-primary px-2 py-1 text-xs font-medium text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {mut.atualizarProf.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Salvar
        </button>
      )}
      {podeEditar && (
        <>
          <button
            type="button"
            onClick={() => mut.atualizarProf.mutate({ id: vinculo.id_profissional, id_unidade: idUnidade, ativo: !ativo })}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title={ativo ? "Desativar profissional (afeta todas as unidades)" : "Ativar profissional"}
          >
            {ativo ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={onExcluir}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
            title="Remover desta unidade"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </li>
  );
}
