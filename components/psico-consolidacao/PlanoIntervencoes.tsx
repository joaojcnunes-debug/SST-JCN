"use client";

// 0.3.321 (pedido do João, 26/11/2026) — Plano de intervenções, abaixo da tabela da etapa 3. Os itens 1 a 4 saem da
// conciliação e da tabela (setores, riscos, temas = intervenções indicadas, método = modalidade); o 5 é o texto padrão
// de cada método (Catálogo › Métodos por modalidade) com o ajuste desta empresa; o 6 é o planejamento. Grava sozinho.

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { AlvoConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { useMetodosModalidade, usePlanoIntervencoes, useSalvarPlanoIntervencoes } from "@/lib/hooks/useComercial";
import type { IntervencaoIndicada, RiscoConciliado } from "@/lib/comercial/liberacao";
import {
  CAMPOS_METODO, cronograma, ehEad, mesDoTema, mesesDoPlano, metodoDe, modalidadesEmUso, planoVazio, riscosDoPlano, rotuloMes,
  rotuloModalidade, setoresDoPlano, temasDoPlano, temasMensais, type MetodoTexto, type PlanoIntervencoes,
} from "@/lib/comercial/plano";
import { cn } from "@/lib/utils";

const campo = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-600";
const chip = "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700";

function Item({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div className="border-t border-gray-100 py-3 first:border-t-0">
      <p className="mb-1.5 text-sm font-semibold text-gray-800">
        <span className="mr-1.5 text-indigo-600">{n}.</span>
        {titulo}
      </p>
      {children}
    </div>
  );
}

export default function PlanoIntervencoes({
  alvo,
  riscos,
  indicadas,
  podeAlterar,
}: {
  alvo: AlvoConciliacao;
  riscos: readonly RiscoConciliado[];
  indicadas: readonly IntervencaoIndicada[];
  podeAlterar: boolean;
}) {
  const { data: metodos = [] } = useMetodosModalidade();
  const { data: salvo } = usePlanoIntervencoes(alvo);
  const salvar = useSalvarPlanoIntervencoes();
  const plano: PlanoIntervencoes = salvo ?? planoVazio(alvo.id, alvo.tipo);

  const setores = useMemo(() => setoresDoPlano(riscos.filter((r) => !r.foraDaConciliacao)), [riscos]);
  const riscosLista = useMemo(() => riscosDoPlano(riscos.filter((r) => !r.foraDaConciliacao)), [riscos]);
  const temas = useMemo(() => temasDoPlano(indicadas), [indicadas]);
  const modalidades = useMemo(() => modalidadesEmUso(temas, metodos), [temas, metodos]);
  const crono = useMemo(() => cronograma(plano, temas), [plano, temas]);
  const mensais = temasMensais(plano.planejamento, temas);
  const totalMeses = mesesDoPlano(plano, temas);

  const mudar = (p: Partial<PlanoIntervencoes>) => podeAlterar && salvar.mutate({ ...plano, ...p });

  const ajustarMetodo = (modalidade: string, c: keyof MetodoTexto, valor: string) => {
    const atual = metodoDe(modalidade, metodos, plano)[c] ?? "";
    const t = valor.trim();
    if (t === atual.trim()) return;
    mudar({ metodos: { ...plano.metodos, [modalidade]: { ...(plano.metodos[modalidade] ?? {}), [c]: t || null } } });
  };
  const voltarAoPadrao = (modalidade: string) => {
    const resto = { ...plano.metodos };
    delete resto[modalidade];
    mudar({ metodos: resto });
  };

  return (
    <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
      <p className="text-base font-bold text-gray-900">Plano de intervenções</p>
      <p className="text-xs text-gray-500">
        Os itens 1 a 4 vêm da conciliação e da tabela acima. A descrição dos métodos vem do{" "}
        <Link href="/consolidacao-grupo/intervencoes" className="font-medium text-indigo-700 underline">catálogo</Link> e pode ser ajustada aqui só
        para esta empresa. Tudo grava sozinho.
      </p>

      <Item n={1} titulo="Setores envolvidos">
        <div className="flex flex-wrap gap-1.5">{setores.length ? setores.map((s) => <span key={s} className={chip}>{s}</span>) : <span className="text-sm text-gray-400">Nenhum.</span>}</div>
      </Item>

      <Item n={2} titulo="Riscos identificados">
        <ul className="space-y-1 text-sm text-gray-700">
          {riscosLista.map((r) => (
            <li key={r.fator}>
              <span className="font-medium">{r.fator}</span>
              {r.aet && <span className="ml-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">Aprofundar com AET</span>}
              <span className="text-gray-500"> — {r.setores.join(", ")}</span>
            </li>
          ))}
        </ul>
      </Item>

      <Item n={3} titulo="Temas sugeridos">
        {temas.length === 0 ? (
          <p className="text-sm text-gray-400">Escolha as intervenções na tabela acima: cada uma é um tema.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {temas.map((t) => (
              <li key={t.chave}><span className="font-medium">{t.nome}</span><span className="text-gray-500"> — para {t.riscos.join(", ")} ({t.setores.join(", ")})</span></li>
            ))}
          </ul>
        )}
      </Item>

      <Item n={4} titulo="Método por tema">
        {temas.length === 0 ? <p className="text-sm text-gray-400">—</p> : (
          <ul className="space-y-1 text-sm text-gray-700">
            {temas.map((t) => (
              <li key={t.chave}>
                <span className="font-medium">{t.nome}:</span>{" "}
                {t.modalidades.length ? t.modalidades.map(rotuloModalidade).join(" + ") : <span className="text-amber-700">sem modalidade (escolha na tabela)</span>}
              </li>
            ))}
          </ul>
        )}
      </Item>

      <Item n={5} titulo="Descrição dos métodos">
        {modalidades.length === 0 ? <p className="text-sm text-gray-400">Aparece quando os temas tiverem modalidade.</p> : (
          <div className="grid gap-3 lg:grid-cols-3">
            {modalidades.map((m) => {
              const texto = metodoDe(m, metodos, plano);
              const ajustado = !!plano.metodos[m];
              return (
                <div key={m} className="space-y-1.5 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{rotuloModalidade(m)}</p>
                    {ajustado && podeAlterar && (
                      <button type="button" onClick={() => voltarAoPadrao(m)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-700" title="Volta ao texto do catálogo">
                        <RotateCcw className="size-3" /> padrão
                      </button>
                    )}
                  </div>
                  {CAMPOS_METODO.map(({ campo: c, rotulo }) => (
                    <label key={c} className="block text-xs font-medium text-gray-600">
                      {rotulo}
                      <textarea key={`${m}:${c}:${texto[c] ?? ""}`} rows={2} defaultValue={texto[c] ?? ""} disabled={!podeAlterar}
                        placeholder={podeAlterar ? "Sem texto no catálogo — escreva aqui" : ""}
                        onBlur={(e) => ajustarMetodo(m, c, e.target.value)} className={cn(campo, "w-full")} />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Item>

      <Item n={6} titulo="Planejamento das ações">
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
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs font-semibold text-gray-600">
                <tr><th className="py-1 pr-3">Tema</th><th className="py-1 pr-3">Método</th><th className="w-44 py-1">Mês</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mensais.map((t) => (
                  <tr key={t.chave}>
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{t.nome}</td>
                    <td className="py-1.5 pr-3 text-gray-600">
                      {(plano.planejamento === "ead_continuo" ? t.modalidades.filter((m) => !ehEad(m)) : t.modalidades).map(rotuloModalidade).join(" + ") || "—"}
                    </td>
                    <td className="py-1.5">
                      <select value={mesDoTema(plano, mensais, t.chave, totalMeses)} disabled={!podeAlterar}
                        onChange={(e) => mudar({ temas: { ...plano.temas, [t.chave]: Number(e.target.value) } })} className={campo}>
                        {Array.from({ length: totalMeses }, (_, k) => <option key={k} value={k + 1}>{rotuloMes(plano.inicio, k + 1)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
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
                <li key={m.n}><span className="font-medium">{m.rotulo}:</span> {m.temas.length ? m.temas.map((t) => t.nome).join(", ") : <span className="text-gray-400">—</span>}</li>
              ))}
            </ul>
          </div>
        )}
      </Item>
    </div>
  );
}
