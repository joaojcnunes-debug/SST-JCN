"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MovimentacaoNfe from "@/components/equipamentos/MovimentacaoNfe";
import { useUnidades } from "@/lib/hooks/useUnidades";

/**
 * Importar NF-e em TELA CHEIA, e não em janela sobreposta.
 *
 * A conferência lista item por item, e cada linha tem três decisões possíveis
 * (vincular, criar, ignorar) mais um campo de nome. Uma nota com 15 itens numa
 * janela de 700px vira rolagem dentro de rolagem — e conferência apertada é
 * conferência mal feita, que é justamente o que esta tela existe para evitar.
 */
export default function ImportarNfePage() {
  const { data: unidades = [] } = useUnidades();

  const bases = useMemo(
    () =>
      [...unidades]
        .filter((u) => !/^conselh/i.test((u.nome ?? "").trim()))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [unidades]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link
          href="/equipamentos/movimentacao"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="size-4" />
          Movimentação
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Importar NF-e</h1>
        <p className="text-sm text-gray-500">
          O XML entra aqui, mas nada vai para o estoque antes de você conferir
          item a item.
        </p>
      </div>

      <MovimentacaoNfe bases={bases} />
    </div>
  );
}
