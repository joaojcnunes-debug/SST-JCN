"use client";

// "Trazer riscos da AEP/AET" (0.3.308, banco v363, 19/11/2026 — pedido do João). Prévia por setor do que o laudo tem:
// novo, mudou no laudo (atualiza) ou já igual. O técnico desmarca o que não quer e escolhe o setor quando o nome do
// setor do laudo não bate com nenhum setor da inspeção. Grava riscos comuns, com o selo AEP/AET.

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import NivelBadge from "@/components/riscos/NivelBadge";
import { useAplicarRiscosDoLaudo, useLaudosComSetores } from "@/lib/hooks/useRiscosDoLaudo";
import { previaDoLaudo, type ItemDoLaudo, type RiscoGravado } from "@/lib/ergonomia/riscos-do-laudo";
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
  const [setorEscolhido, setSetorEscolhido] = useState<Record<string, string>>({});
  // Ao abrir (ou quando o que o laudo tem muda de fato), marca o que é novo ou mudou. A assinatura evita refazer a
  // marcação a cada desenho (lista nova com o mesmo conteúdo).
  const assinatura = todos.map((i) => `${i.chave}=${i.situacao}`).join("|");
  useEffect(() => {
    if (!open) return;
    setMarcados(Object.fromEntries(assinatura ? assinatura.split("|").map((x) => { const [k, sit] = x.split("="); return [k, sit !== "igual"]; }) : []));
    setSetorEscolhido({});
  }, [open, assinatura]);

  const setorDe = (i: ItemDoLaudo) => i.idSetor ?? setorEscolhido[i.chave] ?? "";
  const escolhidos = todos.filter((i) => marcados[i.chave] && i.situacao !== "igual");
  const semSetor = escolhidos.filter((i) => !setorDe(i));
  const nNovos = escolhidos.filter((i) => i.situacao === "novo").length;
  const nAtualizar = escolhidos.length - nNovos;

  const nomeSetor = useMemo(() => new Map(setores.map((s) => [s.id_setor, s.setor_ghe])), [setores]);

  async function trazer() {
    await aplicar.mutateAsync({
      idInspecao,
      idEmpresa,
      itens: escolhidos.map((i) => ({ ...i, idSetor: setorDe(i) })),
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
              : `${nNovos} novo${nNovos === 1 ? "" : "s"} · ${nAtualizar} atualização${nAtualizar === 1 ? "" : "ões"}`}
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
            atualiza o que mudou no laudo. O setor é o de mesmo nome na inspeção; quando não há, escolha abaixo.
          </p>
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
                      {i.idSetor ? (
                        <span className="text-xs text-gray-600">→ {nomeSetor.get(i.idSetor) ?? "setor"}</span>
                      ) : (
                        <select
                          aria-label={`Setor de ${i.dados.agente}`}
                          value={setorEscolhido[i.chave] ?? ""}
                          onChange={(e) => setSetorEscolhido((s) => ({ ...s, [i.chave]: e.target.value }))}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs"
                        >
                          <option value="">Escolha o setor…</option>
                          {setores.map((s) => (
                            <option key={s.id_setor} value={s.id_setor}>{s.setor_ghe}</option>
                          ))}
                        </select>
                      )}
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
