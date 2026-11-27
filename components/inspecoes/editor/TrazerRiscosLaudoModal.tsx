"use client";

// "Trazer riscos da AEP/AET" (0.3.308, banco v363, 19/11/2026 — pedido do João). Prévia por setor do que o laudo tem:
// novo, mudou no laudo (atualiza) ou já igual. O técnico desmarca o que não quer e escolhe o setor quando o nome do
// setor do laudo não bate com nenhum setor da inspeção. Grava riscos comuns, com o selo AEP/AET.
// 0.3.331 (pedido do João, 27/11/2026): o setor se resolve por SETOR DO LAUDO, num quadro no topo, e já vem casado — nome
// igual vai direto, nome parecido vem para conferir e, sem nenhum, a sugestão é criar o setor com o nome do laudo (com a
// descrição do pré-cadastro da empresa, se ela já tem esse setor em outra inspeção).

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import NivelBadge from "@/components/riscos/NivelBadge";
import { useAplicarRiscosDoLaudo, useLaudosComSetores } from "@/lib/hooks/useRiscosDoLaudo";
import { casarSetoresDoLaudo, chaveSetor, previaDoLaudo, type DestinoSetor, type ItemDoLaudo, type RiscoGravado } from "@/lib/ergonomia/riscos-do-laudo";
import { useCatalogoSetoresEmpresa } from "@/lib/hooks/useAep";
import { cn } from "@/lib/utils";
import type { NivelRisco, Risco, Setor } from "@/lib/supabase/types";

const ROTULO: Record<ItemDoLaudo["situacao"], { txt: string; cls: string }> = {
  novo: { txt: "Novo", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  atualizar: { txt: "Mudou no laudo", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  igual: { txt: "Já está igual", cls: "bg-gray-50 text-gray-500 ring-gray-200" },
};

export default function TrazerRiscosLaudoModal({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  riscos,
}: {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  riscos: Risco[];
}) {
  const { data: laudosData, isLoading } = useLaudosComSetores(idInspecao, open);
  const laudos = useMemo(() => laudosData ?? [], [laudosData]);
  const aplicar = useAplicarRiscosDoLaudo();

  const previas = useMemo(
    () =>
      laudos.map((l) => ({
        origem: l.origem,
        ...previaDoLaudo(l.origem, l.setores, setores, riscos as unknown as RiscoGravado[]),
      })),
    [laudos, setores, riscos],
  );
  const todos = useMemo(() => previas.flatMap((p) => p.itens), [previas]);

  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  // A escolha do destino por setor do laudo (a chave do nome): "criar" ou o id de um setor da inspeção.
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const { data: cadastro = [] } = useCatalogoSetoresEmpresa(open ? idEmpresa : null);
  // Só os itens que ainda não estão gravados escolhem setor (o já trazido fica onde está).
  const casamentos = useMemo(
    () => casarSetoresDoLaudo(todos.filter((i) => !i.idRisco), setores, cadastro),
    [todos, setores, cadastro],
  );
  // Ao abrir (ou quando o que o laudo tem muda de fato), marca o que é novo ou mudou. A assinatura evita refazer a
  // marcação a cada desenho (lista nova com o mesmo conteúdo).
  const assinatura = todos.map((i) => `${i.chave}=${i.situacao}`).join("|");
  useEffect(() => {
    if (!open) return;
    setMarcados(Object.fromEntries(assinatura ? assinatura.split("|").map((x) => { const [k, sit] = x.split("="); return [k, sit !== "igual"]; }) : []));
    setEscolha({});
  }, [open, assinatura]);

  const destinoDoSetor = (setorLaudo: string): DestinoSetor | null => {
    const c = casamentos.find((x) => chaveSetor(x.setorLaudo) === chaveSetor(setorLaudo));
    if (!c) return null;
    const e = escolha[chaveSetor(setorLaudo)];
    if (!e) return c.sugestao;
    if (e === "criar") return { tipo: "criar", nome: c.doCadastro?.nome ?? c.setorLaudo, descricao: c.doCadastro?.descricao || null };
    return { tipo: "existente", idSetor: e };
  };
  const destinoDe = (i: ItemDoLaudo): DestinoSetor | null =>
    i.idRisco && i.idSetor ? { tipo: "existente", idSetor: i.idSetor } : destinoDoSetor(i.setorLaudo);
  const escolhidos = todos.filter((i) => marcados[i.chave] && i.situacao !== "igual");
  const semSetor = escolhidos.filter((i) => !destinoDe(i));
  const nNovos = escolhidos.filter((i) => i.situacao === "novo").length;
  const nAtualizar = escolhidos.length - nNovos;

  const nomeSetor = useMemo(() => new Map(setores.map((s) => [s.id_setor, s.setor_ghe])), [setores]);

  async function trazer() {
    await aplicar.mutateAsync({
      idInspecao,
      idEmpresa,
      itens: escolhidos.map((i) => ({ ...i, destino: destinoDe(i)! })),
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Trazer riscos da AEP/AET"
      size="3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {escolhidos.length === 0
              ? "Nada marcado."
              : `${nNovos} novo${nNovos === 1 ? "" : "s"} · ${nAtualizar} ${nAtualizar === 1 ? "atualização" : "atualizações"}`}
            {semSetor.length > 0 && <span className="ml-2 font-medium text-amber-700">Escolha o setor de {semSetor.length} risco{semSetor.length === 1 ? "" : "s"}.</span>}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="button"
              disabled={escolhidos.length === 0 || semSetor.length > 0 || aplicar.isPending}
              onClick={trazer}
              className="rounded-lg bg-marca-primary px-4 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50"
            >
              {aplicar.isPending ? "Trazendo..." : `Trazer ${escolhidos.length || ""}`.trim()}
            </button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : laudos.length === 0 ? (
        <p className="text-sm text-gray-500">Esta inspeção não tem AEP nem AET. Inicie ou traga uma nas abas AEP/AET.</p>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Os riscos entram como os demais riscos da inspeção, com o selo AEP ou AET. Trazer de novo depois não duplica:
            atualiza o que mudou no laudo.
          </p>
          {casamentos.length > 0 && (
            // 0.3.331: para onde vai cada setor do laudo — já casado; mude se precisar.
            <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <h3 className="text-sm font-semibold text-gray-900">Setores do laudo</h3>
              <p className="mb-2 text-xs text-gray-500">
                Nome igual a um setor da inspeção vai direto; nome parecido vem para conferir; sem nenhum, o setor é criado nesta
                inspeção com o nome do laudo. Mude se precisar.
              </p>
              <ul className="space-y-1.5">
                {casamentos.map((c) => {
                  const k = chaveSetor(c.setorLaudo);
                  const valor = escolha[k] ?? (c.sugestao.tipo === "criar" ? "criar" : c.sugestao.idSetor);
                  return (
                    <li key={k} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
                      <span className="min-w-[10rem] font-medium text-gray-900">{c.setorLaudo}</span>
                      <span className="text-xs text-gray-500">{c.riscos} risco{c.riscos === 1 ? "" : "s"}</span>
                      {c.como === "igual" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">mesmo nome na inspeção</span>}
                      {c.como === "parecido" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">nome parecido — confira</span>}
                      {c.como === "novo" && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">não existe na inspeção</span>}
                      {c.doCadastro && c.como !== "igual" && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200" title={c.doCadastro.descricao || undefined}>
                          já cadastrado na empresa
                        </span>
                      )}
                      <span className="ml-auto text-xs text-gray-400">→</span>
                      <select
                        aria-label={`Setor da inspeção para ${c.setorLaudo}`}
                        value={valor}
                        onChange={(e) => setEscolha((x) => ({ ...x, [k]: e.target.value }))}
                        className={cn("rounded-md border px-2 py-1 text-xs", valor === "criar" ? "border-sky-300 bg-sky-50" : "border-gray-300 bg-white")}
                      >
                        <option value="criar">+ Criar o setor “{c.doCadastro?.nome ?? c.setorLaudo}” nesta inspeção</option>
                        {setores.map((s) => (
                          <option key={s.id_setor} value={s.id_setor}>{s.setor_ghe}</option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {previas.map((p) => (
            <section key={p.origem}>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                {p.origem} <span className="font-normal text-gray-400">· {p.itens.length} risco{p.itens.length === 1 ? "" : "s"} no laudo</span>
              </h3>
              {p.itens.length === 0 ? (
                <p className="text-xs text-gray-400">O laudo ainda não tem riscos nem fatores organizacionais marcados.</p>
              ) : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                  {p.itens.map((i) => (
                    <li key={i.chave} className={cn("flex flex-wrap items-center gap-3 px-3 py-2 text-sm", i.situacao === "igual" && "bg-gray-50/60")}>
                      <input
                        type="checkbox"
                        aria-label={`Trazer ${i.dados.agente}`}
                        disabled={i.situacao === "igual"}
                        checked={!!marcados[i.chave] && i.situacao !== "igual"}
                        onChange={(e) => setMarcados((m) => ({ ...m, [i.chave]: e.target.checked }))}
                        className="size-4 rounded border-gray-300"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{i.dados.agente}</span>
                          <span className="text-xs text-gray-500">{i.dados.tipo_risco}</span>
                          {i.dados.nivel_risco && <NivelBadge nivel={i.dados.nivel_risco as NivelRisco} />}
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", ROTULO[i.situacao].cls)}>{ROTULO[i.situacao].txt}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          Setor no laudo: {i.setorLaudo || "—"}
                          {i.dados.probabilidade && ` · ${i.dados.probabilidade}`}
                          {i.dados.severidade && ` · ${i.dados.severidade}`}
                        </div>
                      </div>
                      {(() => {
                        // 0.3.331: o destino vem do quadro "Setores do laudo" (o risco já trazido fica onde está).
                        const d = destinoDe(i);
                        return (
                          <span className={cn("text-xs", d?.tipo === "criar" ? "text-sky-700" : "text-gray-600")}>
                            → {!d ? "—" : d.tipo === "criar" ? `${d.nome} (novo)` : nomeSetor.get(d.idSetor) ?? "setor"}
                          </span>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              )}
              {p.foraDoLaudo.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  {p.foraDoLaudo.length} risco{p.foraDoLaudo.length === 1 ? "" : "s"} trazido{p.foraDoLaudo.length === 1 ? "" : "s"} antes não {p.foraDoLaudo.length === 1 ? "está" : "estão"} mais no laudo
                  ({p.foraDoLaudo.map((r) => r.agente).join(", ")}). Eles continuam na aba; remova lá se quiser.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
