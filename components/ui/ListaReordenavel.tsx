"use client";

/**
 * Arrastar para reordenar — sem biblioteca nova.
 *
 * Usa o arrasto nativo do HTML, o mesmo caminho que o quadro da Gestão já usa.
 * Quem guarda a ordem é o array (ver `lib/reordenar.ts`); aqui mora só a parte
 * de tela: quem está sendo arrastado, onde vai cair, e o atalho de teclado.
 *
 * Duas decisões que valem comentário:
 *
 * 1. A ALÇA é o crachá numerado, não o cartão inteiro. O cabeçalho do cartão já
 *    é clicável para abrir/fechar o setor — se o cartão fosse arrastável, todo
 *    clique viraria um arrasto engasgado e o texto deixaria de ser selecionável.
 *    O arrasto nativo não tem conceito de alça, então o truque é: o cartão só
 *    ganha `draggable` enquanto o mouse está pressionado em cima do crachá.
 *
 * 2. Soltar SALVA NA HORA; o teclado salva com atraso. Soltar é um gesto único
 *    e deliberado. Já a seta ↑/↓ costuma ser repetida várias vezes seguidas —
 *    salvar a cada tecla renderia uma fila de gravações à toa.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, GripVertical, Loader2 } from "lucide-react";
import {
  moverPara,
  moverPasso,
  posicaoDestino,
  type LadoDrop,
} from "@/lib/reordenar";
import { cn } from "@/lib/utils";

export type StatusOrdemSalva = "parado" | "salvando" | "salvo" | "erro";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useListaReordenavel<T extends { id: string }>({
  itens,
  aoReordenar,
  aoSalvar,
  habilitado = true,
  atrasoTecladoMs = 600,
}: {
  itens: T[];
  /** Aplicado na hora, sempre. É o que a tela mostra. */
  aoReordenar: (novos: T[]) => void;
  /** Auto-save. Imediato ao soltar; com atraso no teclado. */
  aoSalvar?: (novos: T[]) => void;
  /** Falso para quem não pode editar: some a alça e o arrasto morre. */
  habilitado?: boolean;
  atrasoTecladoMs?: number;
}) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ id: string; lado: LadoDrop } | null>(null);
  const [prontoId, setProntoId] = useState<string | null>(null);
  const [recemMovido, setRecemMovido] = useState<{ id: string; n: number } | null>(null);

  // Refs para os handlers nunca lerem estado velho.
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const reordenarRef = useRef(aoReordenar);
  reordenarRef.current = aoReordenar;
  const salvarRef = useRef(aoSalvar);
  salvarRef.current = aoSalvar;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<T[] | null>(null);

  const descarregar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const novos = pendente.current;
    pendente.current = null;
    if (novos) salvarRef.current?.(novos);
  }, []);

  // Sair da tela com uma seta recém-apertada não pode perder a ordem.
  useEffect(() => () => descarregar(), [descarregar]);

  const aplicar = useCallback(
    (novos: T[], comAtraso: boolean) => {
      reordenarRef.current(novos);
      if (!salvarRef.current) return;

      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (!comAtraso) {
        pendente.current = null;
        salvarRef.current(novos);
        return;
      }
      pendente.current = novos;
      timer.current = setTimeout(() => {
        timer.current = null;
        const p = pendente.current;
        pendente.current = null;
        if (p) salvarRef.current?.(p);
      }, atrasoTecladoMs);
    },
    [atrasoTecladoMs],
  );

  const encerrar = useCallback(() => {
    setArrastandoId(null);
    setAlvo(null);
    setProntoId(null);
  }, []);

  // O clarão verde no cartão que acabou de se mexer. `n` faz o timer reiniciar
  // quando o MESMO cartão é movido duas vezes seguidas.
  useEffect(() => {
    if (!recemMovido) return;
    const t = setTimeout(() => setRecemMovido(null), 900);
    return () => clearTimeout(t);
  }, [recemMovido]);

  // Soltar o botão fora do cartão não pode deixá-lo arrastável para sempre.
  useEffect(() => {
    if (!prontoId) return;
    const solta = () => setProntoId(null);
    window.addEventListener("mouseup", solta);
    return () => window.removeEventListener("mouseup", solta);
  }, [prontoId]);

  const marcar = useCallback((id: string) => {
    setRecemMovido((prev) => ({ id, n: prev && prev.id === id ? prev.n + 1 : 0 }));
  }, []);

  const aplicarAlvo = useCallback(() => {
    const origem = arrastandoId;
    const destino = alvo;
    encerrar();
    if (!origem || !destino || destino.id === origem) return;

    const novos = moverPara(itensRef.current, origem, destino.id, destino.lado);
    if (novos === itensRef.current) return;
    marcar(origem);
    aplicar(novos, false);
  }, [arrastandoId, alvo, encerrar, marcar, aplicar]);

  // Mover o cartão remonta o nó no DOM e o navegador tira o foco dele. Sem
  // devolver o foco, a segunda seta seguida não ia para lugar nenhum.
  const focarApos = useRef<string | null>(null);
  useEffect(() => {
    const id = focarApos.current;
    if (!id) return;
    focarApos.current = null;
    document
      .querySelector<HTMLButtonElement>(`[data-alca-id="${CSS.escape(id)}"]`)
      ?.focus();
  });

  const moverTeclado = useCallback(
    (id: string, passo: number) => {
      const novos = moverPasso(itensRef.current, id, passo);
      if (novos === itensRef.current) return;
      focarApos.current = id;
      marcar(id);
      aplicar(novos, true);
    },
    [marcar, aplicar],
  );

  /**
   * Vai no cartão de cada item. Sempre devolve o mesmo formato — sem permissão
   * de editar os handlers vêm vazios, em vez de o objeto mudar de tipo.
   */
  function propsItem(id: string) {
    if (!habilitado) {
      return { draggable: false, onMouseUp: undefined, onDragStart: undefined, onDragOver: undefined, onDrop: undefined, onDragEnd: undefined };
    }
    return {
      draggable: prontoId === id,
      onMouseUp: () => setProntoId(null),
      onDragStart: (e: React.DragEvent) => {
        setArrastandoId(id);
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", id);
        } catch {
          // Safari antigo recusa setData fora de alguns tipos; o arrasto segue.
        }
      },
      onDragOver: (e: React.DragEvent) => {
        if (!arrastandoId || arrastandoId === id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const r = e.currentTarget.getBoundingClientRect();
        const lado: LadoDrop = e.clientY - r.top < r.height / 2 ? "antes" : "depois";
        setAlvo((prev) => (prev && prev.id === id && prev.lado === lado ? prev : { id, lado }));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        aplicarAlvo();
      },
      onDragEnd: encerrar,
    };
  }

  /** Vai na alça (o crachá numerado). */
  function propsAlca(id: string) {
    if (!habilitado) return { onMouseDown: undefined, "data-alca-id": undefined };
    return { onMouseDown: () => setProntoId(id), "data-alca-id": id };
  }

  /** Vai no elemento que embrulha a lista: faz o vão entre cartões aceitar o drop. */
  function propsContainer() {
    if (!habilitado) return { onDragOver: undefined, onDrop: undefined };
    return {
      onDragOver: (e: React.DragEvent) => {
        if (arrastandoId) e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        if (!arrastandoId) return;
        e.preventDefault();
        aplicarAlvo();
      },
    };
  }

  return {
    /** Id do cartão sendo arrastado — a tela usa para fechar os setores abertos. */
    arrastandoId,
    /** "antes" | "depois" | null: onde desenhar a barra verde neste cartão. */
    marcaDrop: (id: string): LadoDrop | null =>
      alvo && alvo.id === id && arrastandoId && arrastandoId !== id ? alvo.lado : null,
    /** Número que a barra verde mostra. */
    posicaoDaMarca: (id: string): number | null =>
      arrastandoId && alvo && alvo.id === id
        ? posicaoDestino(itensRef.current, arrastandoId, id, alvo.lado)
        : null,
    recemMovidoId: recemMovido?.id ?? null,
    moverTeclado,
    propsItem,
    propsAlca,
    propsContainer,
  };
}

// ─── Alça: o crachá numerado ──────────────────────────────────────────────────

export function AlcaReordenar({
  numero,
  total,
  nome,
  desabilitado = false,
  onMover,
  ...resto
}: {
  numero: number;
  total: number;
  /** Só para o leitor de tela saber o que está movendo. */
  nome: string;
  desabilitado?: boolean;
  onMover: (passo: number) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement> & { "data-alca-id"?: string }) {
  // Sem permissão de editar, volta a ser o crachá de sempre — nem botão é.
  if (desabilitado) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        {numero}
      </span>
    );
  }

  return (
    <button
      type="button"
      {...resto}
      // O crachá vive dentro do cabeçalho que abre/fecha o setor.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        e.stopPropagation();
        onMover(e.key === "ArrowUp" ? -1 : 1);
      }}
      title="Arraste para reordenar (ou use ↑ ↓)"
      aria-label={`Reordenar ${nome || "setor"}: posição ${numero} de ${total}. Use as setas para cima e para baixo para mover.`}
      className="group/alca grid size-6 shrink-0 cursor-grab place-items-center rounded-full bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 focus:outline-none focus-visible:bg-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 active:cursor-grabbing"
    >
      <span className="col-start-1 row-start-1 text-xs font-bold transition-opacity group-hover/setor:opacity-0 group-focus-visible/alca:opacity-0">
        {numero}
      </span>
      <GripVertical className="col-start-1 row-start-1 size-3.5 opacity-0 transition-opacity group-hover/setor:opacity-100 group-focus-visible/alca:opacity-100" />
    </button>
  );
}

// ─── Barra verde de destino ───────────────────────────────────────────────────

export function MarcaDrop({ lado, posicao }: { lado: LadoDrop; posicao: number | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
        lado === "antes" ? "-top-2.5" : "-bottom-2.5",
      )}
    >
      {posicao !== null && (
        <span className="absolute left-2 top-1/2 grid h-4 min-w-4 -translate-y-1/2 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white">
          {posicao}
        </span>
      )}
    </span>
  );
}

// ─── Aviso de auto-save ───────────────────────────────────────────────────────

export function StatusOrdem({ status }: { status: StatusOrdemSalva }) {
  if (status === "parado") return null;

  if (status === "salvando") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Loader2 className="size-3 animate-spin" /> Salvando ordem…
      </span>
    );
  }
  if (status === "salvo") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <Check className="size-3" /> Ordem salva
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertTriangle className="size-3" /> Ordem não salva — use o botão Salvar
    </span>
  );
}
