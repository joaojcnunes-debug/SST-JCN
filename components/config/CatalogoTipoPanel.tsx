"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Library,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useCatalogoPorTipo,
  useDeleteItemCatalogo,
  useDeleteItemModelo,
  useDeleteModeloRisco,
  useItensModelo,
  useModelosPorTipo,
  useSaveItemCatalogo,
  useSaveItemModelo,
  useSaveModeloRisco,
} from "@/lib/hooks/useV3";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PerguntasDoModelo from "./PerguntasDoModelo";
import { gerarId, cn } from "@/lib/utils";
import type {
  CategoriaCatalogo,
  CategoriaModelo,
  ItemCatalogoTipo,
  ItemModeloRisco,
  ModeloRisco,
} from "@/lib/supabase/types";

const CATEGORIAS_MODELO: {
  key: CategoriaModelo;
  titulo: string;
  desc: string;
}[] = [
  {
    key: "epi_utilizado",
    titulo: "EPI Utilizado",
    desc: "Itens já em uso pelos trabalhadores neste cenário.",
  },
  {
    key: "epi_recomendado",
    titulo: "EPI Recomendado",
    desc: "EPIs sugeridos como medida de proteção.",
  },
  {
    key: "epc_utilizado",
    titulo: "EPC Utilizado",
    desc: "EPCs já instalados no setor.",
  },
  {
    key: "epc_recomendado",
    titulo: "EPC Recomendado",
    desc: "EPCs sugeridos como melhoria.",
  },
  {
    key: "medida_adotada",
    titulo: "Medidas Já Adotadas",
    desc: "Ações administrativas/operacionais em prática.",
  },
  {
    key: "medida_recomendada",
    titulo: "Medidas Recomendadas",
    desc: "Ações que precisam ser implementadas.",
  },
];

const CATEGORIAS_BIBLIOTECA: {
  key: CategoriaCatalogo;
  titulo: string;
  desc: string;
}[] = [
  { key: "agente", titulo: "Agente / Risco", desc: "Sugestões livres do tipo." },
  { key: "fonte_geradora", titulo: "Fonte Geradora", desc: "Sugestões livres." },
  { key: "epi_utilizado", titulo: "EPI Utilizado", desc: "Sugestões livres." },
  { key: "epi_recomendado", titulo: "EPI Recomendado", desc: "Sugestões livres." },
  { key: "epc_utilizado", titulo: "EPC Utilizado", desc: "Sugestões livres." },
  { key: "epc_recomendado", titulo: "EPC Recomendado", desc: "Sugestões livres." },
  { key: "medida_adotada", titulo: "Medidas Já Adotadas", desc: "Sugestões livres." },
  { key: "medida_recomendada", titulo: "Medidas Recomendadas", desc: "Sugestões livres." },
];

export default function CatalogoTipoPanel({ idTipo }: { idTipo: string }) {
  const { data: modelos = [], isLoading: lModelos } = useModelosPorTipo(idTipo, {
    incluirInativos: true,
  });
  const { data: itensTipo = [], isLoading: lTipo } = useCatalogoPorTipo(idTipo, {
    incluirInativos: true,
  });

  const [expandido, setExpandido] = useState<string | null>(null);
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [modeloModal, setModeloModal] = useState<ModeloRisco | "novo" | null>(null);
  const [confirmExclusao, setConfirmExclusao] = useState<ModeloRisco | null>(
    null
  );

  const save = useSaveModeloRisco();
  const del = useDeleteModeloRisco();

  function reordenar(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= modelos.length) return;
    const a = modelos[idx];
    const b = modelos[target];
    save.mutate({ id_modelo: a.id_modelo, id_tipo: a.id_tipo, ordem: b.ordem });
    save.mutate({ id_modelo: b.id_modelo, id_tipo: b.id_tipo, ordem: a.ordem });
  }

  if (lModelos || lTipo) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-600">
          Cada modelo é um <strong>kit de risco</strong> centrado num agente.
          Quando o usuário escolher esse modelo no formulário, todos os campos
          do modelo (fonte, EPIs, EPCs, medidas e perguntas) serão
          pré-preenchidos.
        </p>
        <button
          type="button"
          onClick={() => setModeloModal("novo")}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-3.5" /> Novo Modelo
        </button>
      </div>

      {modelos.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhum modelo cadastrado para este tipo. Comece com{" "}
          <button
            type="button"
            onClick={() => setModeloModal("novo")}
            className="font-semibold text-verde-primary hover:underline"
          >
            Novo Modelo
          </button>
          .
        </div>
      ) : (
        <ul className="space-y-2">
          {modelos.map((m, i) => (
            <ModeloCard
              key={m.id_modelo}
              modelo={m}
              expandido={expandido === m.id_modelo}
              onToggle={() =>
                setExpandido((cur) => (cur === m.id_modelo ? null : m.id_modelo))
              }
              onEditar={() => setModeloModal(m)}
              onRemover={() => setConfirmExclusao(m)}
              onAtivarToggle={() =>
                save.mutate({
                  id_modelo: m.id_modelo,
                  id_tipo: m.id_tipo,
                  ativo: !m.ativo,
                })
              }
              onSubir={() => reordenar(i, -1)}
              onDescer={() => reordenar(i, 1)}
              isFirst={i === 0}
              isLast={i === modelos.length - 1}
            />
          ))}
        </ul>
      )}

      {/* Biblioteca compartilhada (V4) — colapsável, secundária */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setBibliotecaAberta((b) => !b)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100"
        >
          {bibliotecaAberta ? (
            <ChevronDown className="size-4 text-gray-500" />
          ) : (
            <ChevronRight className="size-4 text-gray-500" />
          )}
          <Library className="size-4 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-700">
              Biblioteca compartilhada do tipo
            </p>
            <p className="text-[11px] text-gray-500">
              Sugestões livres para autocomplete quando o usuário não escolhe um
              modelo. Mantém os agentes/itens cadastrados antes do V5.
            </p>
          </div>
        </button>
        {bibliotecaAberta && (
          <div className="space-y-3 border-t border-gray-200 p-3">
            {CATEGORIAS_BIBLIOTECA.map((c) => (
              <CategoriaListaTipo
                key={c.key}
                idTipo={idTipo}
                categoria={c.key}
                titulo={c.titulo}
                desc={c.desc}
                itens={itensTipo.filter((i) => i.categoria === c.key)}
              />
            ))}
          </div>
        )}
      </div>

      <ModeloModal
        open={modeloModal !== null}
        onClose={() => setModeloModal(null)}
        idTipo={idTipo}
        editing={modeloModal === "novo" ? null : modeloModal}
      />

      <ConfirmDialog
        open={!!confirmExclusao}
        title="Remover modelo?"
        description={`"${confirmExclusao?.agente}" e todos os seus itens/perguntas serão removidos permanentemente. Riscos antigos que apontam pra esse modelo perdem a referência (mas não são apagados).`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          confirmExclusao &&
          del.mutate(confirmExclusao.id_modelo, {
            onSuccess: () => setConfirmExclusao(null),
          })
        }
        onCancel={() => setConfirmExclusao(null)}
      />
    </div>
  );
}

// =========================================================================
// Card de um modelo (header + corpo expansível com 6 listas + perguntas)
// =========================================================================

function ModeloCard({
  modelo,
  expandido,
  onToggle,
  onEditar,
  onRemover,
  onAtivarToggle,
  onSubir,
  onDescer,
  isFirst,
  isLast,
}: {
  modelo: ModeloRisco;
  expandido: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onRemover: () => void;
  onAtivarToggle: () => void;
  onSubir: () => void;
  onDescer: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { data: itens = [] } = useItensModelo(modelo.id_modelo, {
    incluirInativos: true,
  });

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border bg-white",
        modelo.ativo ? "border-gray-200" : "border-gray-200 opacity-60"
      )}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
          title={expandido ? "Recolher" : "Expandir"}
        >
          {expandido ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <div className="flex-1 cursor-pointer" onClick={onToggle}>
          <p className="text-sm font-semibold text-gray-900">
            {modelo.agente}
            {!modelo.ativo && (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                inativo
              </span>
            )}
          </p>
          {modelo.fonte_geradora && (
            <p className="text-xs text-gray-500">
              Fonte: {modelo.fonte_geradora}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-gray-400">
            {itens.filter((i) => i.ativo).length} item(ns)
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onSubir}
            disabled={isFirst}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="Subir"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDescer}
            disabled={isLast}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="Descer"
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onAtivarToggle}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
            title={modelo.ativo ? "Desativar" : "Ativar"}
          >
            {modelo.ativo ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
            title="Editar agente / fonte / ordem"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemover}
            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
            title="Remover modelo"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {expandido && (
        <div className="space-y-3 border-t border-gray-200 bg-gray-50 p-3">
          {CATEGORIAS_MODELO.map((c) => (
            <CategoriaListaModelo
              key={c.key}
              idModelo={modelo.id_modelo}
              categoria={c.key}
              titulo={c.titulo}
              desc={c.desc}
              itens={itens.filter((i) => i.categoria === c.key)}
            />
          ))}

          <div className="space-y-2 rounded-lg border border-verde-primary/30 bg-verde-light/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-verde-primary">
              Perguntas Customizadas deste Modelo
            </p>
            <PerguntasDoModelo idModelo={modelo.id_modelo} />
          </div>
        </div>
      )}
    </li>
  );
}

// =========================================================================
// Lista de uma categoria DENTRO de um modelo (V5)
// =========================================================================

function CategoriaListaModelo({
  idModelo,
  categoria,
  titulo,
  desc,
  itens,
}: {
  idModelo: string;
  categoria: CategoriaModelo;
  titulo: string;
  desc: string;
  itens: ItemModeloRisco[];
}) {
  const save = useSaveItemModelo();
  const del = useDeleteItemModelo();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditando((prev) => {
      const next: Record<string, string> = {};
      for (const i of itens) {
        if (prev[i.id_item] !== undefined) next[i.id_item] = prev[i.id_item];
      }
      return next;
    });
  }, [itens]);

  function adicionar() {
    const txt = novo.trim();
    if (!txt) return;
    if (itens.some((i) => i.texto.toLowerCase() === txt.toLowerCase())) {
      toast.error("Já existe nesta categoria");
      return;
    }
    save.mutate(
      {
        id_item: gerarId("ITM"),
        id_modelo: idModelo,
        categoria,
        texto: txt,
        ordem: itens.length,
        ativo: true,
      },
      {
        onSuccess: () => {
          setNovo("");
        },
      }
    );
  }

  function persistirRenomear(item: ItemModeloRisco) {
    const novoTexto = editando[item.id_item];
    if (novoTexto === undefined || novoTexto === item.texto) return;
    const txt = novoTexto.trim();
    if (!txt) {
      toast.error("Texto não pode ficar vazio");
      setEditando((m) => {
        const next = { ...m };
        delete next[item.id_item];
        return next;
      });
      return;
    }
    save.mutate({
      id_item: item.id_item,
      id_modelo: idModelo,
      categoria,
      texto: txt,
    });
  }

  function mover(item: ItemModeloRisco, dir: -1 | 1) {
    const idx = itens.findIndex((i) => i.id_item === item.id_item);
    const target = idx + dir;
    if (target < 0 || target >= itens.length) return;
    const a = itens[idx];
    const b = itens[target];
    save.mutate({
      id_item: a.id_item,
      id_modelo: idModelo,
      categoria,
      ordem: b.ordem,
    });
    save.mutate({
      id_item: b.id_item,
      id_modelo: idModelo,
      categoria,
      ordem: a.ordem,
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{titulo}</h4>
          <p className="text-[11px] text-gray-500">{desc}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
          {itens.filter((i) => i.ativo).length}/{itens.length}
        </span>
      </div>

      {itens.length > 0 && (
        <ul className="mb-2 space-y-1">
          {itens.map((item, i) => {
            const texto = editando[item.id_item] ?? item.texto;
            return (
              <li
                key={item.id_item}
                className={cn(
                  "flex items-center gap-1 rounded border bg-gray-50 px-2 py-1",
                  item.ativo
                    ? "border-gray-200"
                    : "border-gray-200 opacity-60"
                )}
              >
                <span className="w-6 text-center text-xs font-mono text-gray-400">
                  {i}
                </span>
                <input
                  type="text"
                  value={texto}
                  onChange={(e) =>
                    setEditando((m) => ({
                      ...m,
                      [item.id_item]: e.target.value,
                    }))
                  }
                  onBlur={() => persistirRenomear(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => mover(item, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                  title="Subir"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(item, 1)}
                  disabled={i === itens.length - 1}
                  className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                  title="Descer"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    save.mutate({
                      id_item: item.id_item,
                      id_modelo: idModelo,
                      categoria,
                      ativo: !item.ativo,
                    })
                  }
                  className="rounded p-1 text-gray-500 hover:bg-white"
                  title={item.ativo ? "Desativar" : "Ativar"}
                >
                  {item.ativo ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => del.mutate(item.id_item)}
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

      <div className="flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder={`Adicionar ${titulo.toLowerCase()}...`}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
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
// Lista de uma categoria DA BIBLIOTECA do tipo (V4 — preserved)
// =========================================================================

function CategoriaListaTipo({
  idTipo,
  categoria,
  titulo,
  desc,
  itens,
}: {
  idTipo: string;
  categoria: CategoriaCatalogo;
  titulo: string;
  desc: string;
  itens: ItemCatalogoTipo[];
}) {
  const save = useSaveItemCatalogo();
  const del = useDeleteItemCatalogo();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditando((prev) => {
      const next: Record<string, string> = {};
      for (const i of itens) {
        if (prev[i.id_item] !== undefined) next[i.id_item] = prev[i.id_item];
      }
      return next;
    });
  }, [itens]);

  function adicionar() {
    const txt = novo.trim();
    if (!txt) return;
    if (itens.some((i) => i.texto.toLowerCase() === txt.toLowerCase())) {
      toast.error("Já existe nesta categoria");
      return;
    }
    save.mutate(
      {
        id_item: gerarId("CAT"),
        id_tipo: idTipo,
        categoria,
        texto: txt,
        ordem: itens.length,
        ativo: true,
      },
      {
        onSuccess: () => setNovo(""),
      }
    );
  }

  function persistirRenomear(item: ItemCatalogoTipo) {
    const novoTexto = editando[item.id_item];
    if (novoTexto === undefined || novoTexto === item.texto) return;
    const txt = novoTexto.trim();
    if (!txt) {
      toast.error("Texto não pode ficar vazio");
      setEditando((m) => {
        const next = { ...m };
        delete next[item.id_item];
        return next;
      });
      return;
    }
    save.mutate({
      id_item: item.id_item,
      id_tipo: idTipo,
      categoria,
      texto: txt,
    });
  }

  function mover(item: ItemCatalogoTipo, dir: -1 | 1) {
    const idx = itens.findIndex((i) => i.id_item === item.id_item);
    const target = idx + dir;
    if (target < 0 || target >= itens.length) return;
    const a = itens[idx];
    const b = itens[target];
    save.mutate({
      id_item: a.id_item,
      id_tipo: idTipo,
      categoria,
      ordem: b.ordem,
    });
    save.mutate({
      id_item: b.id_item,
      id_tipo: idTipo,
      categoria,
      ordem: a.ordem,
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{titulo}</h4>
          <p className="text-[11px] text-gray-500">{desc}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
          {itens.filter((i) => i.ativo).length}/{itens.length}
        </span>
      </div>

      {itens.length > 0 && (
        <ul className="mb-2 space-y-1">
          {itens.map((item, i) => {
            const texto = editando[item.id_item] ?? item.texto;
            return (
              <li
                key={item.id_item}
                className={cn(
                  "flex items-center gap-1 rounded border bg-gray-50 px-2 py-1",
                  item.ativo
                    ? "border-gray-200"
                    : "border-gray-200 opacity-60"
                )}
              >
                <span className="w-6 text-center text-xs font-mono text-gray-400">
                  {i}
                </span>
                <input
                  type="text"
                  value={texto}
                  onChange={(e) =>
                    setEditando((m) => ({
                      ...m,
                      [item.id_item]: e.target.value,
                    }))
                  }
                  onBlur={() => persistirRenomear(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => mover(item, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                  title="Subir"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(item, 1)}
                  disabled={i === itens.length - 1}
                  className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                  title="Descer"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    save.mutate({
                      id_item: item.id_item,
                      id_tipo: idTipo,
                      categoria,
                      ativo: !item.ativo,
                    })
                  }
                  className="rounded p-1 text-gray-500 hover:bg-white"
                  title={item.ativo ? "Desativar" : "Ativar"}
                >
                  {item.ativo ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => del.mutate(item.id_item)}
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

      <div className="flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder={`Adicionar ${titulo.toLowerCase()}...`}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
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
// Modal de criação/edição de modelo (agente + fonte + ordem)
// =========================================================================

function ModeloModal({
  open,
  onClose,
  idTipo,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  idTipo: string;
  editing: ModeloRisco | null;
}) {
  const save = useSaveModeloRisco();
  const [agente, setAgente] = useState("");
  const [fonte, setFonte] = useState("");
  const [ordem, setOrdem] = useState(99);

  useEffect(() => {
    if (open) {
      setAgente(editing?.agente ?? "");
      setFonte(editing?.fonte_geradora ?? "");
      setOrdem(editing?.ordem ?? 99);
    }
  }, [open, editing]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agente.trim()) {
      toast.error("Agente é obrigatório");
      return;
    }
    save.mutate(
      {
        id_modelo: editing?.id_modelo ?? gerarId("MOD"),
        id_tipo: idTipo,
        agente: agente.trim(),
        fonte_geradora: fonte.trim() || null,
        ordem,
        ativo: editing?.ativo ?? true,
      },
      {
        onSuccess: () => {
          setAgente("");
          setFonte("");
          setOrdem(99);
          onClose();
        },
      }
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Modelo" : "Novo Modelo de Risco"}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Agente / Risco *
          </label>
          <input
            type="text"
            value={agente}
            onChange={(e) => setAgente(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            placeholder="Ex: Ruído contínuo"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">
            Fonte Geradora
          </label>
          <input
            type="text"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            placeholder="Ex: Compressor industrial em operação"
          />
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
