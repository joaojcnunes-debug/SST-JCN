"use client";

// Biblioteca psicossocial — BASE DE OPÇÕES do inventário de risco (v276).
// Cada tópico de cada fator é uma lista de opções; meio de propagação,
// situação e tempo de exposição são listas comuns a todos os fatores, com um
// padrão por fator. Admin inclui/edita/exclui e aprova sugestões; os demais
// SUGEREM (ficam pendentes). "Padrão" = a opção já vem marcada no inventário.
// Lida pelo editor da AEP, laudo, PDF, planilha e IA (lib/aep/biblioteca.ts).

import { useMemo, useState } from "react";
import { BookMarked, Check, ChevronDown, Inbox, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  useAtualizarItemBiblioteca,
  useBibliotecaPsi,
  useDefinirPadraoComum,
  useExcluirItemBiblioteca,
  useIncluirItemBiblioteca,
} from "@/lib/hooks/useBibliotecaPsi";
import { useIsAdmin, useCanEdit } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import {
  ROTULO_TOPICO,
  TOPICOS_COMUNS,
  TOPICOS_DO_FATOR,
  itensDe,
  padraoComum,
  type Biblioteca,
  type ItemBiblioteca,
  type TopicoBib,
} from "@/lib/aep/biblioteca";
import { cn, fmtData } from "@/lib/utils";

const rotuloFator = (k: string | null) => (k ? ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k : "Comum a todos");

/** Uma opção: texto (e código) editáveis pelo Admin, padrão e excluir. */
function LinhaItem({ item, isAdmin, mostrarPadrao }: { item: ItemBiblioteca; isAdmin: boolean; mostrarPadrao: boolean }) {
  const atualizar = useAtualizarItemBiblioteca();
  const excluir = useExcluirItemBiblioteca();
  const [texto, setTexto] = useState(item.texto);
  const [codigo, setCodigo] = useState(item.codigo ?? "");
  const salvarTexto = () => {
    const t = texto.trim();
    if (!t || t === item.texto) return setTexto(item.texto);
    atualizar.mutate({ id: item.id_item, patch: { texto: t } }, { onError: () => setTexto(item.texto) });
  };
  return (
    <div className="flex items-start gap-2 py-1">
      {item.topico === "fonte" &&
        (isAdmin ? (
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onBlur={() => codigo.trim() !== (item.codigo ?? "") && atualizar.mutate({ id: item.id_item, patch: { codigo: codigo.trim() || null } })}
            placeholder="cód."
            className="w-14 shrink-0 rounded border border-gray-200 px-1.5 py-1 font-mono text-[11px]"
          />
        ) : (
          <span className="w-14 shrink-0 pt-1 font-mono text-[11px] text-gray-500">{item.codigo}</span>
        ))}
      {isAdmin ? (
        <textarea
          rows={item.texto.length > 110 ? 3 : 1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvarTexto}
          className="min-w-0 flex-1 resize-y rounded border border-gray-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
        />
      ) : (
        <p className="min-w-0 flex-1 py-1 text-sm text-gray-800">{item.texto}</p>
      )}
      {mostrarPadrao && (
        <label className={cn("flex shrink-0 items-center gap-1 pt-1.5 text-[11px] text-gray-600", isAdmin && "cursor-pointer")} title="Já vem marcada no inventário">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={item.padrao}
            onChange={(e) => atualizar.mutate({ id: item.id_item, patch: { padrao: e.target.checked } })}
            className="size-3 accent-emerald-600"
          />
          padrão
        </label>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => window.confirm(`Excluir "${item.texto.slice(0, 80)}"? Quem já marcou esta opção perde a marcação.`) && excluir.mutate(item.id_item)}
          className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Excluir"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Lista de um tópico + campo para incluir (Admin) ou sugerir (técnico). */
function ListaTopico({
  b,
  fator,
  topico,
  isAdmin,
  podeSugerir,
}: {
  b: Biblioteca;
  fator: string | null;
  topico: TopicoBib;
  isAdmin: boolean;
  podeSugerir: boolean;
}) {
  const incluir = useIncluirItemBiblioteca();
  const [novo, setNovo] = useState("");
  const comum = TOPICOS_COMUNS.includes(topico);
  const itens = itensDe(b, fator ?? "", topico);
  const enviar = () => {
    const t = novo.trim();
    if (!t) return;
    incluir.mutate({ fator: comum ? null : fator, topico, texto: t, padrao: false }, { onSuccess: () => setNovo("") });
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {ROTULO_TOPICO[topico]} <span className="font-normal normal-case text-gray-400">({itens.length})</span>
      </p>
      <div className="divide-y divide-gray-100">
        {itens.map((i) => (
          <LinhaItem key={i.id_item} item={i} isAdmin={isAdmin} mostrarPadrao={!comum} />
        ))}
        {itens.length === 0 && <p className="py-1 text-sm text-gray-400">Nenhuma opção ainda.</p>}
      </div>
      {(isAdmin || podeSugerir) && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), enviar())}
            placeholder={isAdmin ? `Incluir em ${ROTULO_TOPICO[topico].toLowerCase()}…` : `Sugerir opção de ${ROTULO_TOPICO[topico].toLowerCase()}…`}
            className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={incluir.isPending || !novo.trim()}
            onClick={enviar}
            className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {incluir.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {isAdmin ? "Incluir" : "Sugerir"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Padrão de meio/situação/tempo por fator (Admin escolhe na lista comum). */
function PadroesComuns({ b, isAdmin }: { b: Biblioteca; isAdmin: boolean }) {
  const definir = useDefinirPadraoComum();
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs text-gray-600">
            <th className="px-3 py-2">Fator</th>
            {TOPICOS_COMUNS.map((t) => (
              <th key={t} className="px-3 py-2">
                {ROTULO_TOPICO[t]} (padrão)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ITENS_ORGANIZACIONAL.map(({ key, label }) => (
            <tr key={key} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-800">{label}</td>
              {TOPICOS_COMUNS.map((t) => {
                const atual = padraoComum(b, key, t);
                const opcoes = itensDe(b, key, t);
                return (
                  <td key={t} className="px-3 py-1.5">
                    {isAdmin ? (
                      <select
                        value={atual}
                        onChange={(e) => definir.mutate({ fator: key, topico: t as "meio" | "situacao" | "tempo", texto: e.target.value })}
                        className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                      >
                        {!opcoes.some((o) => o.texto === atual) && <option value={atual}>{atual || "—"}</option>}
                        {opcoes.map((o) => (
                          <option key={o.id_item} value={o.texto}>
                            {o.texto}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-600">{atual || "—"}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fila de sugestões: Admin aprova/recusa; técnico vê as próprias. */
function Sugestoes({ b, isAdmin }: { b: Biblioteca; isAdmin: boolean }) {
  const atualizar = useAtualizarItemBiblioteca();
  const user = useUserStore((s) => s.user);
  const quem = user?.nome ?? user?.email ?? "";
  const lista = isAdmin
    ? b.itens.filter((i) => i.status === "pendente")
    : b.itens.filter((i) => i.sugerido_por === quem && i.status !== "ativo");
  if (lista.length === 0 && !isAdmin) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <Inbox className="size-4" />
        {isAdmin ? `Sugestões pendentes (${lista.length})` : "Suas sugestões"}
      </p>
      {lista.length === 0 && <p className="text-sm text-amber-800">Nenhuma sugestão aguardando aprovação.</p>}
      <div className="space-y-1.5">
        {lista.map((i) => (
          <div key={i.id_item} className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-gray-900">{i.texto}</p>
              <p className="text-[11px] text-gray-500">
                {rotuloFator(i.fator)} · {ROTULO_TOPICO[i.topico]}
                {i.sugerido_por && ` · sugerido por ${i.sugerido_por}`}
                {i.sugerido_em && ` em ${fmtData(i.sugerido_em)}`}
              </p>
            </div>
            {isAdmin ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={atualizar.isPending}
                  onClick={() => atualizar.mutate({ id: i.id_item, patch: { status: "ativo" } })}
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Check className="size-3.5" /> Aprovar
                </button>
                <button
                  type="button"
                  disabled={atualizar.isPending}
                  onClick={() => atualizar.mutate({ id: i.id_item, patch: { status: "recusado" } })}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <X className="size-3.5" /> Recusar
                </button>
              </div>
            ) : (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", i.status === "pendente" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600")}>
                {i.status === "pendente" ? "aguardando" : "recusada"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BibliotecaPsiPage() {
  const { data: b, isLoading } = useBibliotecaPsi();
  const isAdmin = useIsAdmin();
  const podeSugerir = useCanEdit();
  const [aberto, setAberto] = useState<string | null>(null);
  const totais = useMemo(() => {
    const ativos = b?.itens.filter((i) => i.status === "ativo") ?? [];
    return { ativos: ativos.length, pendentes: b?.itens.filter((i) => i.status === "pendente").length ?? 0 };
  }, [b]);

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BookMarked className="size-5 text-emerald-600" /> Biblioteca psicossocial
        </h1>
        <p className="mt-1 max-w-4xl text-sm text-gray-500">
          Base de opções do inventário de risco da AEP: em cada tópico de cada fator, o técnico marca as opções daqui e
          inclui o que faltar. <strong>Padrão</strong> = a opção já vem marcada. Meio de propagação, situação e tempo de
          exposição são listas comuns, com um padrão por fator.{" "}
          {isAdmin
            ? "Como Admin, você inclui, edita e exclui direto e aprova as sugestões dos técnicos."
            : "Você pode sugerir opções; elas entram depois que um Admin aprovar."}
        </p>
        {b && (
          <p className="mt-1 text-xs text-gray-400">
            {totais.ativos} opções ativas{totais.pendentes > 0 && ` · ${totais.pendentes} sugestão(ões) pendente(s)`}
          </p>
        )}
      </div>

      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-gray-100" />}

      {b && (
        <>
          <Sugestoes b={b} isAdmin={isAdmin} />

          {[
            {
              id: "__comuns",
              titulo: "Listas comuns a todos os fatores",
              sub: "Meio de propagação, situação e tempo de exposição — e o padrão de cada fator",
              corpo: (
                <div className="space-y-3">
                  <div className="space-y-3">
                    {TOPICOS_COMUNS.map((t) => (
                      <ListaTopico key={t} b={b} fator={null} topico={t} isAdmin={isAdmin} podeSugerir={podeSugerir} />
                    ))}
                  </div>
                  <PadroesComuns b={b} isAdmin={isAdmin} />
                </div>
              ),
            },
            ...ITENS_ORGANIZACIONAL.map(({ key, label }, idx) => ({
              id: key,
              titulo: `${idx + 1}. ${label}`,
              sub: TOPICOS_DO_FATOR.map((t) => `${itensDe(b, key, t).length} ${ROTULO_TOPICO[t].toLowerCase()}`).join(" · "),
              corpo: (
                <div className="space-y-3">
                  {TOPICOS_DO_FATOR.map((t) => (
                    <ListaTopico key={t} b={b} fator={key} topico={t} isAdmin={isAdmin} podeSugerir={podeSugerir} />
                  ))}
                </div>
              ),
            })),
          ].map((sec) => {
            const open = aberto === sec.id;
            return (
              <div key={sec.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setAberto(open ? null : sec.id)}
                  className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{sec.titulo}</p>
                    <p className="truncate text-xs text-gray-500">{sec.sub}</p>
                  </div>
                  <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition", open && "rotate-180")} />
                </button>
                {open && <div className="border-t border-gray-100 p-4">{sec.corpo}</div>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
