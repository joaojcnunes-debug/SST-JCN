"use client";

// Alocados no jeito do Runrun (0.3.301, 18/11/2026 — pedido do João): na linha, só as fotos/iniciais em círculos
// (nome ao passar o mouse, "+N" quando passa do limite). Clicando, abre a caixinha "Alocados" com a lista de nomes
// (× para tirar) e o botão Adicionar embaixo. Substitui as etiquetas com nome e o "+ Adicionar" de cada linha.
// 0.3.304 (19/11): o mesmo formato vale para as outras telas com pessoas (Inspeções: Responsável e Associados) —
// título, textos e a chave de quem sai viraram parâmetros; na Gestão nada muda.

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";

export interface PessoaAlocada {
  email?: string | null;
  nome: string;
  feito?: boolean;
  /** O que o onTirar recebe (ex.: o id da linha de associado). Sem ela, vai o e-mail. */
  chave?: string | null;
  /** Linha pequena embaixo do nome na caixinha (ex.: "assumiu o documento"). */
  nota?: string | null;
  /** false = esta pessoa não tem o × (mesmo quem edita). */
  tiravel?: boolean;
}

export default function AlocadosCompactos({
  pessoas,
  rotulo,
  podeEditar,
  usuarios = [],
  onAdicionar,
  onTirar,
  ocupado = false,
  max = 3,
  titulo = "Alocados",
  textoVazio = "Ninguém alocado.",
  textoAdicionar = "Adicionar",
  dicaVazio,
}: {
  pessoas: PessoaAlocada[];
  /** Para leitores de tela e o título da caixinha (ex.: "Alocados de Confirmar deslocamento"). */
  rotulo: string;
  podeEditar: boolean;
  /** Quem pode ser adicionado (já sem os alocados). */
  usuarios?: ComponentProps<typeof UsuarioCombobox>["usuarios"];
  onAdicionar?: (email: string) => void;
  onTirar?: (email: string) => void;
  ocupado?: boolean;
  max?: number;
  /** Cabeçalho da caixinha ("Alocados", "Associados", "Responsável"…). */
  titulo?: string;
  textoVazio?: string;
  textoAdicionar?: string;
  /** Dica do círculo tracejado (quem edita, sem ninguém): padrão "Alocar alguém". */
  dicaVazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  const visiveis = pessoas.slice(0, max);
  const resto = pessoas.length - visiveis.length;
  const nomes = pessoas.map((p) => p.nome).join(", ");

  // A caixinha fica presa à tela (fixed), logo abaixo dos círculos — a tabela rola de lado e cortaria um absolute.
  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const r = botaoRef.current.getBoundingClientRect();
    const largura = 260;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
    const top = r.bottom + 6 + 320 > window.innerHeight ? Math.max(8, r.top - 6 - 320) : r.bottom + 6;
    setPos({ top, left });
  }, [aberto, pessoas.length, adicionando]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (caixaRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      // A lista do combobox abre dentro da caixinha; nada mais conta como "dentro".
      setAberto(false);
      setAdicionando(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const semNinguem = pessoas.length === 0;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => { setAberto((v) => !v); setAdicionando(false); }}
        aria-label={semNinguem ? `${rotulo}: ${textoVazio.replace(/\.$/, "").toLowerCase()}` : `${rotulo}: ${nomes}`}
        aria-expanded={aberto}
        title={semNinguem ? (podeEditar ? (dicaVazio ?? "Alocar alguém") : textoVazio.replace(/\.$/, "")) : nomes}
        className="inline-flex items-center gap-1 rounded-full p-0.5 hover:bg-gray-100"
      >
        {semNinguem ? (
          podeEditar ? (
            <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400">
              <UserPlus className="size-3.5" />
            </span>
          ) : <span className="px-1 text-gray-300">—</span>
        ) : (
          <>
            {visiveis.map((p, k) => (
              <span key={`${p.email ?? p.nome}-${k}`} className="relative inline-flex" title={p.feito ? `${p.nome} (entregou)` : p.nome}>
                <AvatarPessoa nome={p.nome} email={p.email ?? undefined} className="size-7 text-[10px] ring-2 ring-white" />
                {p.feito && <CheckCircle2 aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-white text-sky-600" />}
              </span>
            ))}
            {resto > 0 && (
              <span className="flex size-7 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 ring-2 ring-white">+{resto}</span>
            )}
          </>
        )}
      </button>

      {aberto && pos && (
        <div
          ref={caixaRef}
          role="dialog"
          aria-label={rotulo}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); setAdicionando(false); botaoRef.current?.focus(); } }}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 260 }}
          className="z-[60] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl"
        >
          <p className="mb-2 text-sm font-semibold text-gray-800">{titulo}</p>
          {semNinguem ? (
            <p className="mb-2 text-xs text-gray-400">{textoVazio}</p>
          ) : (
            <ul className="mb-2 max-h-48 space-y-1 overflow-y-auto">
              {pessoas.map((p, k) => (
                <li key={`${p.email ?? p.nome}-${k}`} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
                  <AvatarPessoa nome={p.nome} email={p.email ?? undefined} className="size-7 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-800">{p.nome}</span>
                    {p.nota && <span className="block truncate text-[11px] text-gray-400">{p.nota}</span>}
                  </span>
                  {p.feito && <CheckCircle2 aria-label="entregou" className="size-3.5 shrink-0 text-sky-600" />}
                  {podeEditar && (p.chave ?? p.email) && onTirar && p.tiravel !== false && (
                    <button type="button" disabled={ocupado} onClick={() => onTirar((p.chave ?? p.email)!)} aria-label={`Tirar ${p.nome}`} title={`Tirar ${p.nome}`}
                      className="shrink-0 rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-600 disabled:opacity-40">
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {podeEditar && onAdicionar && (
            adicionando ? (
              <UsuarioCombobox
                usuarios={usuarios}
                value=""
                onChange={(em) => { if (em) { onAdicionar(em); setAdicionando(false); } }}
                placeholder="Buscar pessoa…"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none"
              />
            ) : (
              <button type="button" disabled={ocupado} onClick={() => setAdicionando(true)}
                className="w-full rounded-md bg-marca-primary py-2 text-sm font-semibold text-white hover:bg-marca-dark disabled:opacity-50">
                {textoAdicionar}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}
