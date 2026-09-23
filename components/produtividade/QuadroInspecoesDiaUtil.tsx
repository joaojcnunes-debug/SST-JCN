"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useMediaInspecoesUnidade } from "@/lib/hooks/useMediaInspecoesUnidade";
import { SEM_EQUIPE, type LinhaMedia } from "@/lib/produtividade/media-inspecoes";
import { rotuloMes } from "@/lib/escala/datas";

/**
 * Quadro "Inspeções por dia útil" do Controle Mensal — só leitura, segue o
 * mês/ano da tela. A conta e as decisões estão em
 * `lib/produtividade/media-inspecoes`; aqui é só desenho.
 *
 * O número principal é `porTecnicoDiaUtil`. A coluna "por dia em campo" fica
 * ao lado porque responde a pergunta seguinte ("e nos dias em que saem?") —
 * se não vingar, é uma coluna a tirar.
 */
export default function QuadroInspecoesDiaUtil({ mes, ano }: { mes: number; ano: number }) {
  const { data, isLoading, error } = useMediaInspecoesUnidade(mes, ano);

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">Inspeções por dia útil</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Quantas inspeções cada técnico de campo faz por dia útil, por unidade, em {rotuloMes(ano, mes)} —
          medido nas inspeções do painel, com a equipe cadastrada em Unidades e Equipe.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Contando as inspeções do mês…
        </div>
      )}

      {error && (
        <p className="px-4 py-6 text-sm text-red-600">Não foi possível calcular: {(error as Error).message}</p>
      )}

      {data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
                  <th className="px-4 py-2.5 text-left">Equipe</th>
                  <th className="px-4 py-2.5 text-center">Visitas</th>
                  <th className="px-4 py-2.5 text-center">Técnicos</th>
                  <th className="px-4 py-2.5 text-center">
                    Dias úteis
                    {data.ateHoje && <span className="block font-normal normal-case text-teal-700">até hoje</span>}
                  </th>
                  <th className="px-4 py-2.5 text-center text-teal-800">Por técnico / dia útil</th>
                  <th className="px-4 py-2.5 text-center">Dias em campo</th>
                  <th className="px-4 py-2.5 text-center">Por dia em campo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.linhas.map((l) => (
                  <Linha key={l.chave} linha={l} />
                ))}
                <Linha linha={data.total} total />
              </tbody>
            </table>
          </div>

          <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            {data.ateHoje && data.diasUteisGerais > 0 && (
              <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-teal-900">
                <strong>{rotuloMes(ano, mes)} está em curso:</strong> os dias úteis contam só até hoje,{" "}
                {dataCurta(data.ateHoje)} — <strong>{data.diasUteisGerais}</strong> dos {data.diasUteisMesInteiro} do
                mês. O número por técnico é o ritmo até agora, não a projeção do mês fechado.
              </p>
            )}
            {data.ateHoje && data.diasUteisGerais === 0 && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">
                {rotuloMes(ano, mes)} ainda não teve dia útil — não há por onde dividir.
              </p>
            )}
            {!data.temFeriadoMunicipalCadastrado && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Os dias úteis descontam só os feriados nacionais e estaduais cadastrados na Escala de
                Supervisores: <strong>ainda não há feriado municipal cadastrado</strong>. Quando houver, cada
                unidade desconta o do seu município.
              </p>
            )}
            {data.linhas.some((l) => l.maisPessoasQueEquipe && l.chave !== SEM_EQUIPE) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Na linha com <AlertTriangle className="inline size-3.5 align-text-bottom" />, mais pessoas fizeram
                inspeção do que há técnicos de campo cadastrados em Unidades e Equipe — o número por técnico
                sai maior do que é. Cadastrar a equipe corrige.
              </p>
            )}
            <p>
              <strong>Visitas</strong> são as inspeções com data de visita no mês, sem cópia nem revisão
              {data.copiasIgnoradas > 0 && (
                <> ({data.copiasIgnoradas} {data.copiasIgnoradas === 1 ? "ficou" : "ficaram"} de fora)</>
              )}
              . <strong>Técnicos</strong> é a equipe de campo ativa cadastrada em Unidades e Equipe; unidade que
              compartilha equipe aparece junto com a dona. <strong>Dias em campo</strong> conta os dias em que
              cada técnico saiu (um técnico com duas visitas no mesmo dia é um dia). Quem fez a visita é a mesma
              regra do dashboard: a aba Responsáveis, ou quem lançou no sistema.
              {data.visitasSemUnidade > 0 && (
                <>
                  {" "}
                  {data.visitasSemUnidade} {data.visitasSemUnidade === 1 ? "visita é" : "visitas são"} de empresa
                  sem unidade e {data.visitasSemUnidade === 1 ? "conta" : "contam"} só no total.
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** "2026-09-17" → "17/09", sem passar por Date (data pura). */
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmt2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Linha({ linha: l, total = false }: { linha: LinhaMedia; total?: boolean }) {
  const semEquipe = l.chave === SEM_EQUIPE;
  const cls = total
    ? "border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800"
    : "hover:bg-gray-50/50";
  return (
    <tr className={cls}>
      <td className="px-4 py-2.5 font-medium text-gray-800">
        {total ? <span className="text-xs uppercase tracking-wide text-gray-400">Total</span> : l.equipe}
        {total && <span className="ml-2 text-xs font-normal text-gray-400">· {l.equipe}</span>}
        {semEquipe && (
          <span className="ml-1 text-xs font-normal text-gray-400">· sem par em Unidades e Equipe</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center font-mono">{l.visitas}</td>
      <td className="px-4 py-2.5 text-center font-mono">
        {l.tecnicos}
        {l.maisPessoasQueEquipe && !semEquipe && (
          <span
            className="ml-1 inline-flex items-center gap-0.5 font-sans text-[11px] text-amber-700"
            title={`${l.pessoasQueFizeram} pessoas fizeram inspeção no mês, com ${l.tecnicos} cadastrada${l.tecnicos === 1 ? "" : "s"}`}
          >
            <AlertTriangle className="size-3.5" /> {l.pessoasQueFizeram} fizeram
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center font-mono">
        {l.diasUteis}
        {l.feriadosMunicipais > 0 && (
          <span className="ml-1 font-sans text-[11px] text-gray-400" title="feriado municipal descontado">
            −{l.feriadosMunicipais} mun.
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center font-mono text-base font-bold text-teal-800">
        {l.porTecnicoDiaUtil == null ? <span className="text-sm font-normal text-gray-300">—</span> : fmt2(l.porTecnicoDiaUtil)}
      </td>
      <td className="px-4 py-2.5 text-center font-mono text-gray-600">
        {l.tecnicoDias}
        {l.pessoasQueFizeram > 0 && (
          <span className="ml-1 font-sans text-[11px] text-gray-400">
            · {l.pessoasQueFizeram} {l.pessoasQueFizeram === 1 ? "pessoa" : "pessoas"}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center font-mono text-gray-600">
        {l.porDiaEmCampo == null ? <span className="text-gray-300">—</span> : fmt1(l.porDiaEmCampo)}
      </td>
    </tr>
  );
}
