"use client";

// 0.3.321 (pedido do João, 26/11/2026) — Plano de intervenções, abaixo da tabela da etapa 3. Desde a 0.3.324 só o
// planejamento das ações (um tema por mês, ou EAD o período todo; início, duração, mês de cada tema e cronograma):
// setores, riscos, temas, método e a descrição dele já estão na tabela, em cada intervenção. Grava sozinho.

import { useMemo, type ReactNode } from "react";
import type { AlvoConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { usePlanoIntervencoes, useSalvarPlanoIntervencoes } from "@/lib/hooks/useComercial";
import type { IntervencaoIndicada } from "@/lib/comercial/liberacao";
import {
  cronograma, ehEad, linhasDoPlano, mesDoTema, mesesDoPlano, planoVazio, rotuloMes, rotuloModalidade, temasDoPlano, temasMensais,
  type PlanoIntervencoes, type TemaPlano,
} from "@/lib/comercial/plano";
import { cn } from "@/lib/utils";

const campo = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-600";

function Item({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <p className="mb-1.5 text-sm font-semibold text-gray-800">{titulo}</p>
      {children}
    </div>
  );
}

export default function PlanoIntervencoes({
  alvo,
  indicadas,
  podeAlterar,
  agrupar = "risco",
  onAgrupar,
}: {
  /** 0.3.326: o mesmo botão Por setor | Por risco no plano (troca a visão da tabela também). */
  onAgrupar?: (v: "setor" | "risco") => void;
  /** 0.3.325: a visão escolhida no topo da tabela (Por setor | Por risco) vale também aqui. */
  agrupar?: "setor" | "risco";
  alvo: AlvoConciliacao;
  indicadas: readonly IntervencaoIndicada[];
  podeAlterar: boolean;
}) {
  const { data: salvo } = usePlanoIntervencoes(alvo);
  const salvar = useSalvarPlanoIntervencoes();
  const plano: PlanoIntervencoes = salvo ?? planoVazio(alvo.id, alvo.tipo);

  const temas = useMemo(() => temasDoPlano(indicadas), [indicadas]);
  const crono = useMemo(() => cronograma(plano, temas), [plano, temas]);
  const mensais = temasMensais(plano.planejamento, temas);
  const totalMeses = mesesDoPlano(plano, temas);
  const linhas = linhasDoPlano(indicadas, mensais, agrupar);
  const ondeEntra = (t: TemaPlano) => (agrupar === "setor" ? t.setores : t.riscos).join(", ");

  const mudar = (p: Partial<PlanoIntervencoes>) => podeAlterar && salvar.mutate({ ...plano, ...p });

  return (
    <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-bold text-gray-900">Plano de intervenções</p>
        {onAgrupar && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium" role="group" aria-label="Mostrar o plano">
            {(["setor", "risco"] as const).map((k) => (
              <button key={k} type="button" onClick={() => onAgrupar(k)} aria-pressed={agrupar === k}
                className={cn("rounded-md px-2.5 py-1", agrupar === k ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
                {k === "setor" ? "Por setor" : "Por risco"}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* 0.3.324 (pedido do João): os itens 1 a 5 (setores, riscos, temas, método por tema e descrição dos métodos)
          saíram — repetiam o que a tabela acima já mostra. Fica o planejamento. */}
      <p className="text-xs text-gray-500">Como as intervenções da tabela acima se distribuem no tempo. Grava sozinho.</p>

      <Item titulo="Planejamento das ações">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name={`plan-${alvo.id}`} disabled={!podeAlterar} checked={plano.planejamento === "tema_por_mes"} onChange={() => mudar({ planejamento: "tema_por_mes" })} />
            Um tema por mês
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name={`plan-${alvo.id}`} disabled={!podeAlterar} checked={plano.planejamento === "ead_continuo"} onChange={() => mudar({ planejamento: "ead_continuo" })} />
            EAD disponível o período todo, com ações online e presenciais todo mês
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <label className="inline-flex items-center gap-1.5">
            Início
            <input type="month" value={plano.inicio?.slice(0, 7) ?? ""} disabled={!podeAlterar}
              onChange={(e) => mudar({ inicio: e.target.value ? `${e.target.value}-01` : null })} className={campo} />
          </label>
          <label className="inline-flex items-center gap-1.5">
            Duração
            <input type="number" min={1} max={36} key={`meses:${plano.meses ?? ""}`} defaultValue={plano.meses ?? ""} placeholder={String(totalMeses)} disabled={!podeAlterar}
              onBlur={(e) => {
                const n = e.target.value.trim() ? Math.min(36, Math.max(1, Math.floor(Number(e.target.value)))) : null;
                if (n !== plano.meses) mudar({ meses: Number.isFinite(n as number) ? n : null });
              }} className={cn(campo, "w-20 tabular-nums")} />
            meses
          </label>
        </div>

        {mensais.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            {/* 0.3.327 (pedido do João): colunas de setor e risco no lugar das faixas de grupo, e "Intervenção" no lugar de "Tema"
                (o mesmo nome da tabela de cima). O setor/risco aparece só na 1ª linha de cada grupo. */}
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="w-44 py-1 pr-3">{agrupar === "setor" ? "Setor" : "Risco"}</th>
                  <th className="w-44 py-1 pr-3">{agrupar === "setor" ? "Risco" : "Setores"}</th>
                  <th className="py-1 pr-3">Intervenção</th>
                  <th className="w-36 py-1 pr-3">Método</th>
                  <th className="w-36 py-1">Mês</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, n) => {
                  const primeira = n === 0 || linhas[n - 1].grupo !== l.grupo;
                  const t = l.tema;
                  return (
                    <tr key={`${l.grupo}:${t.chave}`} className={cn(primeira ? "border-t border-gray-200" : "border-t border-gray-50")}>
                      <td className="py-1.5 pr-3 align-top font-semibold text-gray-900">{primeira ? l.grupo : ""}</td>
                      <td className="py-1.5 pr-3 align-top text-gray-600">{l.outros.join(", ")}</td>
                      <td className="py-1.5 pr-3 align-top font-medium text-gray-800">{t.nome}</td>
                      <td className="py-1.5 pr-3 align-top text-gray-600">
                        {(plano.planejamento === "ead_continuo" ? t.modalidades.filter((m) => !ehEad(m)) : t.modalidades).map(rotuloModalidade).join(" + ") || "—"}
                      </td>
                      <td className="py-1 align-top">
                        <select value={mesDoTema(plano, mensais, t.chave, totalMeses)} disabled={!podeAlterar}
                          onChange={(e) => mudar({ temas: { ...plano.temas, [t.chave]: Number(e.target.value) } })} className={campo}>
                          {Array.from({ length: totalMeses }, (_, k) => <option key={k} value={k + 1}>{rotuloMes(plano.inicio, k + 1)}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {temas.length > 0 && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Cronograma</p>
            {crono.continuos.length > 0 && (
              <p className="mb-1.5 text-sm text-gray-700">
                <span className="font-medium">Todo o período (EAD):</span> {crono.continuos.map((t) => t.nome).join(", ")}
              </p>
            )}
            <ul className="grid gap-1 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
              {crono.meses.map((m) => (
                <li key={m.n}>
                  <span className="font-medium">{m.rotulo}:</span>{" "}
                  {m.temas.length ? m.temas.map((t, k) => (
                    <span key={t.chave}>{k > 0 && "; "}{t.nome} <span className="text-xs text-gray-500">({ondeEntra(t)})</span></span>
                  )) : <span className="text-gray-400">—</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Item>
    </div>
  );
}
