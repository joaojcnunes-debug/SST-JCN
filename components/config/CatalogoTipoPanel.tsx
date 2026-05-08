"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useCatalogoPorTipo,
  useDeleteItemCatalogo,
  useSaveItemCatalogo,
} from "@/lib/hooks/useV3";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PerguntasDoTipo from "./PerguntasDoTipo";
import { gerarId, cn } from "@/lib/utils";
import type { CategoriaCatalogo, ItemCatalogoTipo } from "@/lib/supabase/types";

const CATEGORIAS: { key: CategoriaCatalogo; titulo: string; desc: string }[] = [
  {
    key: "agente",
    titulo: "Agente / Risco",
    desc: "Aparece no campo 'Agente' do form (autocomplete).",
  },
  {
    key: "fonte_geradora",
    titulo: "Fonte Geradora",
    desc: "Aparece no campo 'Fonte Geradora' (autocomplete).",
  },
  {
    key: "epi_utilizado",
    titulo: "EPI Utilizado",
    desc: "Sugestões pro bloco '1º EPI Utilizado' do risco.",
  },
  {
    key: "epi_recomendado",
    titulo: "EPI Recomendado",
    desc: "Sugestões pro bloco '2º EPI Recomendado'.",
  },
  {
    key: "epc_utilizado",
    titulo: "EPC Utilizado",
    desc: "Sugestões pro bloco '3º EPC Utilizado'.",
  },
  {
    key: "epc_recomendado",
    titulo: "EPC Recomendado",
    desc: "Sugestões pro bloco '4º EPC Recomendado'.",
  },
  {
    key: "medida_adotada",
    titulo: "Medidas Já Adotadas",
    desc: "Sugestões pra '5º Medidas Já Adotadas'.",
  },
  {
    key: "medida_recomendada",
    titulo: "Medidas Recomendadas",
    desc: "Sugestões pra '6º Medidas Recomendadas'.",
  },
];

export default function CatalogoTipoPanel({ idTipo }: { idTipo: string }) {
  const { data: itens = [], isLoading } = useCatalogoPorTipo(idTipo, {
    incluirInativos: true,
  });

  if (isLoading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Itens pré-cadastrados pra este tipo. Aparecem como sugestão durante o
        cadastro de risco. Itens inativos não aparecem mas ficam no histórico.
      </p>
      {CATEGORIAS.map((c) => (
        <CategoriaLista
          key={c.key}
          idTipo={idTipo}
          categoria={c.key}
          titulo={c.titulo}
          desc={c.desc}
          itens={itens.filter((i) => i.categoria === c.key)}
        />
      ))}

      <div className="mt-4 space-y-3 rounded-lg border border-verde-primary/30 bg-verde-light/30 p-3">
        <div>
          <h3 className="text-sm font-semibold text-verde-primary">
            Perguntas Customizadas deste Tipo
          </h3>
          <p className="text-[11px] text-gray-600">
            Aparecem no formulário de risco quando o usuário escolhe este tipo.
            As respostas ficam gravadas no risco e saem no relatório PGR. Para
            uma visão geral, use a aba &ldquo;Perguntas Customizadas&rdquo;.
          </p>
        </div>
        <PerguntasDoTipo idTipo={idTipo} />
      </div>
    </div>
  );
}

function CategoriaLista({
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

  // Sincroniza buffer local de edição quando lista muda externamente
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
    if (
      itens.some((i) => i.texto.toLowerCase() === txt.toLowerCase())
    ) {
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
        onSuccess: () => {
          setNovo("");
          toast.success("Adicionado");
        },
      }
    );
  }

  function renomear(item: ItemCatalogoTipo, valor: string) {
    setEditando((m) => ({ ...m, [item.id_item]: valor }));
  }

  function persistirRenomear(item: ItemCatalogoTipo) {
    const novoTexto = editando[item.id_item];
    if (novoTexto === undefined || novoTexto === item.texto) return;
    const txt = novoTexto.trim();
    if (!txt) {
      toast.error("Texto não pode ficar vazio");
      setEditando((m) => {
        const { [item.id_item]: _, ...rest } = m;
        return rest;
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
                  item.ativo ? "border-gray-200" : "border-gray-200 opacity-60"
                )}
              >
                <span className="w-6 text-center text-xs font-mono text-gray-400">
                  {i}
                </span>
                <input
                  type="text"
                  value={texto}
                  onChange={(e) => renomear(item, e.target.value)}
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
