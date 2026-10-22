"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { cn } from "@/lib/utils";

export interface OpcaoSelectBusca {
  value: string;
  label: string;
  /** Texto à direita na lista (ex.: "3 empresas"). */
  detalhe?: string | null;
  /** Ícone à esquerda na lista. */
  icone?: ReactNode;
  /** Opção fixa ("Todos", "Sem grupo"…): some quando a pessoa digita e não entra na busca. */
  fixa?: boolean;
  /** Textos extras que a busca também compara (descrição, sigla…). */
  buscaExtra?: Array<string | null | undefined>;
}

/**
 * Seleção COM DIGITAÇÃO NO PRÓPRIO CAMPO — o padrão do painel para trocar o
 * `<select>` nativo (pedido de 08/10: "como o campo de pesquisa de /empresas").
 * Clicar abre a lista inteira; digitar filtra na hora, com a busca tolerante de
 * `lib/busca/texto` (acento, ordem das palavras, erro de digitação). Setas,
 * Enter e Esc funcionam; sair do campo sem escolher volta ao valor anterior.
 *
 * Com `onCriar`, a busca sem nome exato oferece "Criar «…»".
 *
 * Teclado por escuta NATIVA, não por onKeyDown: o Modal faz stopPropagation de
 * toda tecla no diálogo, então dentro de um cadastro o onKeyDown do React não
 * dispara — o Enter caía no <form> e salvava, o Esc fechava o cadastro (v0.3.719).
 */
export default function SelectBusca({
  value,
  onChange,
  opcoes,
  placeholder = "Selecione…",
  placeholderBusca = "Digite para buscar…",
  vazio = "Nada encontrado",
  onCriar,
  rotuloCriar = "Criar",
  criando = false,
  limpavel = false,
  disabled = false,
  className,
  campoClassName,
  title,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  opcoes: OpcaoSelectBusca[];
  placeholder?: string;
  placeholderBusca?: string;
  /** Texto quando a busca não acha nada. */
  vazio?: string;
  onCriar?: (texto: string) => void;
  /** "Criar grupo" → aparece como "Criar grupo «texto»". */
  rotuloCriar?: string;
  criando?: boolean;
  /** Mostra o X para voltar a "" (nenhum). */
  limpavel?: boolean;
  disabled?: boolean;
  className?: string;
  /** Classes do campo (borda, raio, padding) — o padrão é o dos formulários. */
  campoClassName?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idLista = useId();

  const selecionada = opcoes.find((o) => o.value === value) ?? null;
  const digitado = consulta.trim();

  const { itens, aproximado } = useMemo(() => {
    const buscaveis = opcoes.filter((o) => !o.fixa);
    if (!digitado) return { itens: opcoes, aproximado: false };
    return buscar(buscaveis, digitado, (o) => [o.label, ...(o.buscaExtra ?? [])]);
  }, [opcoes, digitado]);

  const podeCriar =
    !!onCriar &&
    digitado.length > 0 &&
    !opcoes.some((o) => !o.fixa && o.label.trim().toLocaleLowerCase("pt-BR") === digitado.toLocaleLowerCase("pt-BR"));
  const totalNavegavel = itens.length + (podeCriar ? 1 : 0);

  // Teclado escutado SEMPRE (não só com a lista aberta): depois do Esc o foco
  // fica no campo, e um Enter ali enviaria o <form> do cadastro.
  useEffect(() => {
    const el = ref.current;
    const tecla = (e: KeyboardEvent) => teclasRef.current(e);
    el?.addEventListener("keydown", tecla);
    return () => el?.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // Mantém a opção destacada à vista quando se anda com as setas.
  useEffect(() => {
    if (!aberto) return;
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function abrir() {
    if (disabled || aberto) return;
    setAberto(true);
    setConsulta("");
    const i = opcoes.findIndex((o) => o.value === value);
    setAtivo(i >= 0 ? i : 0);
  }

  function fechar() {
    setAberto(false);
    setConsulta("");
  }

  function escolher(v: string) {
    onChange(v);
    fechar();
    inputRef.current?.blur();
  }

  function criar() {
    if (!onCriar || !digitado) return;
    onCriar(digitado);
    fechar();
  }

  function teclas(e: KeyboardEvent) {
    if (!aberto) {
      // Lista fechada: Enter/seta abrem; nada aqui envia o formulário.
      // Esc segue adiante (fecha o modal, como em qualquer campo).
      if (e.target === inputRef.current && (e.key === "Enter" || e.key === "ArrowDown")) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // fecha só a lista, não o cadastro
      fechar();
      return;
    }
    if (e.key === "Tab") {
      fechar();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, totalNavegavel - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Dentro de formulário: Enter escolhe, não envia.
      e.preventDefault();
      if (ativo < itens.length) escolher(itens[ativo].value);
      else if (podeCriar) criar();
    }
  }
  const teclasRef = useRef(teclas);
  teclasRef.current = teclas;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        className={cn(
          "flex w-full items-center gap-1 border bg-white text-sm",
          "focus-within:border-verde-primary focus-within:ring-2 focus-within:ring-verde-primary/30",
          campoClassName ?? "rounded-md border-gray-300 px-3 py-2",
          disabled && "cursor-not-allowed opacity-60",
        )}
        title={title}
        onMouseDown={(e) => {
          // Clicar em qualquer ponto do campo (inclusive na seta) abre e foca.
          if (disabled) return;
          if (e.target !== inputRef.current) e.preventDefault();
          inputRef.current?.focus();
          abrir();
        }}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-label={ariaLabel ?? title}
          disabled={disabled}
          value={aberto ? consulta : (selecionada?.label ?? "")}
          onFocus={abrir}
          onChange={(e) => {
            if (!aberto) setAberto(true);
            setConsulta(e.target.value);
            setAtivo(0);
          }}
          placeholder={aberto ? (selecionada?.label ?? placeholderBusca) : placeholder}
          className={cn(
            "min-w-0 flex-1 truncate bg-transparent p-0 text-sm outline-none placeholder:text-gray-400",
            aberto && selecionada && "placeholder:text-gray-500",
            disabled && "cursor-not-allowed",
          )}
        />
        {limpavel && value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Limpar"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange("");
              fechar();
            }}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition-transform", aberto && "rotate-180")} />
      </div>

      {aberto && (
        <div className="absolute z-30 mt-1 w-full min-w-60 rounded-md border border-gray-200 bg-white shadow-lg">
          <ul ref={listaRef} id={idLista} role="listbox" className="max-h-64 overflow-auto py-1">
            {aproximado && itens.length > 0 && (
              <li>
                <AvisoBuscaAproximada aproximado busca={consulta} total={itens.length} compacto />
              </li>
            )}
            {itens.map((o, i) => (
              <li key={o.value || "__vazio__"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  data-idx={i}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(o.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                    i === ativo && "bg-verde-light",
                    value === o.value && "font-semibold",
                    o.fixa && "text-gray-600",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {o.icone}
                    <span className="break-words">{o.label}</span>
                  </span>
                  {o.detalhe && <span className="shrink-0 text-xs font-normal text-gray-400">{o.detalhe}</span>}
                </button>
              </li>
            ))}
            {digitado && itens.length === 0 && !podeCriar && (
              <li className="px-3 py-2 text-sm text-gray-500">{vazio}</li>
            )}
            {podeCriar && (
              <li className="border-t border-gray-100">
                <button
                  type="button"
                  data-idx={itens.length}
                  onMouseEnter={() => setAtivo(itens.length)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={criar}
                  disabled={criando}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-verde-primary disabled:opacity-60",
                    ativo === itens.length && "bg-verde-light",
                  )}
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="truncate">
                    {rotuloCriar} <strong>«{digitado}»</strong>
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
