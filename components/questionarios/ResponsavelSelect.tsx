"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, UserRound } from "lucide-react";
import { iniciais, corAvatar } from "@/lib/hooks/useGestao";
import { useTimePsicossocial, type MembroTimePsi } from "@/lib/hooks/useQuestionarios";
import { cn } from "@/lib/utils";
import { acharMembro, filtrarTime, podeUsarNomeManual } from "@/lib/qps/responsavel";

/**
 * Seletor de Responsável de uma aplicação do QPS: menu suspenso com o time de
 * psicossocial, no padrão de apresentação do painel (gatilho, overlay que
 * fecha no clique fora, painel absoluto com busca, avatar de iniciais).
 *
 * Por que menu próprio e não `<select>`: o nativo não mostra avatar, não
 * destaca a escolha com o check verde e não tem busca — e `ProfissionalSelect`
 * (o `<select>` da casa) lista TODOS os técnicos, não o time daqui.
 *
 * `responsavel` é texto livre no banco, não FK, e os valores já gravados não
 * casam byte a byte com `usuarios.nome` (medido em 06/10/2026: dos 10
 * preenchidos, 7 estão em CAIXA ALTA e 3 são nome parcial, um deles ambíguo
 * entre três cadastros). Por isso o casamento é por nome normalizado e, quando
 * não casa, o valor salvo **não é descartado**: vira uma opção "valor atual"
 * no topo, já marcada. Trocar é ato explícito de quem está na tela — o campo
 * não apaga sozinho o que estava gravado.
 *
 * A caixa de busca também **aceita nome que não é conta do painel** (psicólogo
 * externo): se o que foi digitado não bate com ninguém do time, o menu oferece
 * "Usar «texto»". Sem isso, trocar o input livre pelo menu teria tirado uma
 * capacidade que a tela tinha — decisão do operador em 06/10/2026.
 */
export default function ResponsavelSelect({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  placeholder = "Selecione o responsável...",
  className,
}: {
  /** Nome gravado em `qps_aplicacoes.responsavel` (ou null). */
  value: string | null;
  /** Devolve o nome escolhido, como deve ser gravado. */
  onChange: (nome: string | null) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const { data: time = [], isLoading, isError } = useTimePsicossocial();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const salvo = (value ?? "").trim();
  /** O membro do time que corresponde ao valor salvo, se houver. */
  const selecionado = useMemo(
    () => (salvo ? acharMembro(time, salvo) : null),
    [time, salvo],
  );
  /** Valor gravado que não existe mais no time (ou nome parcial/caixa alta). */
  const legado = salvo && !selecionado ? salvo : "";

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAberto(false); setBusca(""); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  useEffect(() => {
    if (aberto) buscaRef.current?.focus();
  }, [aberto]);

  const filtrados = useMemo(() => filtrarTime(time, busca), [time, busca]);

  // A regra (e os dois estragos que a guarda de lista cheia evita) está em
  // lib/qps/responsavel.ts, que é puro e testado.
  const manual = busca.trim();
  const podeUsarManual = podeUsarNomeManual({ busca, filtrados, time, salvo });

  function escolher(u: MembroTimePsi) {
    onChange(u.nome);
    setAberto(false);
    setBusca("");
  }

  return (
    // `min-w-0` não é enfeite: sem ele o `flex-1` que o pai passa não encolhe
    // (o `min-width: auto` do flex trava no conteúdo), o gatilho vaza do card
    // — medido em 152px de transbordo num card de 212px — e o que vaza cobre
    // o lápis do card vizinho, que fica sem clique.
    <div ref={ref} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        autoFocus={autoFocus}
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : "border-gray-300 bg-white hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
        )}
      >
        {selecionado || legado ? (
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: corAvatar(selecionado?.nome ?? legado) }}
          >
            {iniciais(selecionado?.nome ?? legado)}
          </span>
        ) : (
          <UserRound className="size-4 shrink-0 text-gray-400" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", !selecionado && !legado && "text-gray-400")}>
          {selecionado?.nome || legado || placeholder}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-gray-400 transition-transform", aberto && "rotate-180")}
        />
      </button>

      {aberto && !disabled && (
        <>
          {/* Fecha no clique fora sem roubar o clique de quem está dentro. */}
          <div className="fixed inset-0 z-20" onClick={() => { setAberto(false); setBusca(""); }} />
          {/* O menu é mais largo que o card de propósito (nome + cargo não
              cabem em 212px), mas não pode passar da janela: nas colunas da
              direita ele sairia da tela. */}
          <div
            role="listbox"
            className="menu-abrir absolute z-30 mt-1 w-full min-w-[15rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-2 py-1.5">
              <Search className="size-3.5 shrink-0 text-gray-400" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  // Um resultado só: Enter escolhe. Nenhum: Enter usa o
                  // digitado, como no ComboTagInline.
                  if (filtrados.length === 1 && manual) escolher(filtrados[0]);
                  else if (podeUsarManual) { onChange(manual); setAberto(false); setBusca(""); }
                }}
                placeholder="Buscar no time, ou digitar outro nome..."
                className="w-full border-0 bg-transparent p-0 text-xs focus:outline-none"
              />
            </div>

            <div className="max-h-56 overflow-auto py-1">
              {isLoading && (
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                  <Loader2 className="size-3.5 animate-spin" /> Carregando o time...
                </p>
              )}

              {isError && (
                <p className="px-3 py-2 text-xs text-red-500">
                  Não foi possível carregar o time de psicossocial.
                </p>
              )}

              {/* O que está gravado e não bate com ninguém do time continua à
                  vista e marcado — some só quando alguém escolher outro. */}
              {legado && !busca && (
                <div className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-1.5 text-sm">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: corAvatar(legado) }}
                  >
                    {iniciais(legado)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-gray-800">{legado}</span>
                    <span className="block text-[10px] text-amber-600">
                      valor atual · fora do time de psicossocial
                    </span>
                  </span>
                  <Check className="size-4 shrink-0 text-green-600" />
                </div>
              )}

              {!isLoading && !isError && filtrados.length === 0 && !podeUsarManual && (
                <p className="px-3 py-2 text-xs text-gray-400">
                  {time.length === 0
                    ? "Nenhuma conta com o módulo psicossocial."
                    : "Ninguém no time com esse nome."}
                </p>
              )}

              {/* Nome que não é conta do painel — psicólogo externo, por
                  exemplo. Mesmo gesto do ComboTagInline: digita e, se não
                  existe na lista, usa o que digitou. Âmbar porque é valor
                  manual, não escolha do catálogo. */}
              {podeUsarManual && (
                <button
                  type="button"
                  onClick={() => { onChange(busca.trim()); setAberto(false); setBusca(""); }}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-1.5 text-left text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">Usar “{busca.trim()}”</span>
                </button>
              )}

              {filtrados.map((u) => {
                const marcado = !!selecionado && selecionado.id_usuario === u.id_usuario;
                return (
                  <button
                    key={u.id_usuario}
                    type="button"
                    role="option"
                    aria-selected={marcado}
                    onClick={() => escolher(u)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                      marcado ? "bg-green-50/60" : "hover:bg-gray-50",
                    )}
                  >
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: corAvatar(u.nome) }}
                    >
                      {iniciais(u.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-gray-800">{u.nome}</span>
                      {(u.cargo || u.funcao) && (
                        <span className="block truncate text-[10px] text-gray-400">
                          {u.cargo || u.funcao}
                        </span>
                      )}
                    </span>
                    {marcado && <Check className="size-4 shrink-0 text-green-600" />}
                  </button>
                );
              })}
            </div>

            {salvo && (
              <button
                type="button"
                onClick={() => { onChange(null); setAberto(false); setBusca(""); }}
                className="w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
              >
                Limpar responsável
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
