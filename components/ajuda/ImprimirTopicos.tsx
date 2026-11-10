"use client";

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import Modal from "@/components/ui/Modal";

/**
 * Botão de impressão das páginas de ajuda: abre a lista de tópicos e imprime só os marcados.
 *
 * Os tópicos são os blocos diretos do contêiner marcado com `data-ajuda-topicos`, com o título
 * lido do próprio bloco. Assim o texto dos guias fica onde está e um bloco novo já entra na lista.
 * O bloco do próprio botão (cabeçalho do guia) e os sem título (rodapé) sempre são impressos.
 */

interface Topico { indice: number; titulo: string }

function tituloDoBloco(bloco: Element): string | null {
  const explicito = bloco.getAttribute("data-ajuda-titulo");
  if (explicito) return explicito;
  for (const seletor of ["h1, h2, h3", "p.font-semibold, p.font-bold"]) {
    const texto = bloco.querySelector(seletor)?.textContent?.replace(/\s+/g, " ").trim();
    if (texto) return texto;
  }
  return null;
}

export default function ImprimirTopicos({
  rotulo,
  className,
  onModoImpressao,
}: {
  rotulo: string;
  className: string;
  /** Liga/desliga o modo que abre os itens expansíveis da página, nos guias que os têm. */
  onModoImpressao?: (ligado: boolean) => void;
}) {
  const botao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());

  const raiz = () => botao.current?.closest("[data-ajuda-topicos]") ?? null;

  function abrir() {
    const lista: Topico[] = [];
    Array.from(raiz()?.children ?? []).forEach((bloco, indice) => {
      if (bloco.contains(botao.current)) return;
      const titulo = tituloDoBloco(bloco);
      if (titulo) lista.push({ indice, titulo });
    });
    setTopicos(lista);
    setMarcados(new Set(lista.map((t) => t.indice)));
    setAberto(true);
  }

  function alternar(indice: number) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(indice)) novo.delete(indice);
      else novo.add(indice);
      return novo;
    });
  }

  function imprimir() {
    const omitir = topicos.filter((t) => !marcados.has(t.indice)).map((t) => t.indice);
    setAberto(false);
    onModoImpressao?.(true);
    // Só depois de a página redesenhar: o modo de impressão pode recriar blocos (Matriz AIHA da AEP).
    setTimeout(() => {
      const blocos = Array.from(raiz()?.children ?? []);
      const omitidos = omitir.map((i) => blocos[i]).filter(Boolean);
      omitidos.forEach((b) => b.classList.add("print:hidden"));
      const terminar = () => {
        window.removeEventListener("afterprint", terminar);
        omitidos.forEach((b) => b.classList.remove("print:hidden"));
        onModoImpressao?.(false);
      };
      window.addEventListener("afterprint", terminar);
      window.print();
    }, 200);
  }

  const todos = marcados.size === topicos.length;

  return (
    <>
      <button ref={botao} type="button" onClick={abrir} className={className}>
        <Printer className="size-4" />
        {rotulo}
      </button>
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="O que você quer imprimir?"
        size="md"
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMarcados(todos ? new Set() : new Set(topicos.map((t) => t.indice)))}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {todos ? "Desmarcar todos" : "Marcar todos"}
            </button>
            <button
              type="button"
              onClick={imprimir}
              disabled={marcados.size === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-marca-primary px-4 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50"
            >
              <Printer className="size-4" />
              Imprimir ({marcados.size})
            </button>
          </div>
        }
      >
        <div className="space-y-1">
          {topicos.map((t) => (
            <label key={t.indice} className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={marcados.has(t.indice)}
                onChange={() => alternar(t.indice)}
                className="mt-0.5 size-4 shrink-0 accent-marca-primary"
              />
              {t.titulo}
            </label>
          ))}
        </div>
      </Modal>
    </>
  );
}
