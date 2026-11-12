"use client";

// Células da tabela setor × fator da Conciliação DRPS/QPS × AEP — usadas pela tela da empresa e, desde a
// v0.3.285, pela Conciliação por grupo (com `rotulo`, cada nível diz de qual empresa do grupo veio).

import { AlertTriangle, CheckCircle2, Microscope } from "lucide-react";
import { SeloClasse, TextoNivel } from "@/components/psico-consolidacao/ConciliacaoSelos";
import {
  ROTULO_DECISAO,
  ladoQuestionario,
  situacaoParecer,
  type CelulaConciliacao,
  type ParecerConciliacao,
  type Questionario,
  type SetorConciliacao,
} from "@/lib/psico-consolidacao/conciliacao";
import { cn } from "@/lib/utils";

export function Colunas({ q, fonteUnica }: { q: Questionario; fonteUnica: boolean }) {
  return (
    <>
      {q !== "AEP" && <th className="px-3 py-3">{q} (questionário)</th>}
      <th className="px-3 py-3">{fonteUnica ? (q === "AEP" ? "Resultado" : `${q}: resultado`) : `${q} × AEP`}</th>
      <th className="px-3 py-3">Parecer {q}</th>
    </>
  );
}

export function CelulaAep({ c, rotulo }: { c: CelulaConciliacao; rotulo?: (idEmpresa: string) => string }) {
  if (c.aep) {
    return (
      <div>
        {c.aep.nivelAiha ? <TextoNivel texto={c.aep.nivelAiha} degrau={c.aep.degrau} /> : <span className="font-medium text-gray-700">Sim · sem AIHA</span>}
        {rotulo && c.aep.idEmpresa && <p className="text-[11px] text-gray-400">empresa {rotulo(c.aep.idEmpresa)}</p>}
        {c.aep.sinais.length > 0 && (
          <p className="mt-0.5 max-w-xs text-[11px] leading-snug text-gray-500" title={c.aep.sinais.join("\n")}>
            {c.aep.sinais.length} {c.aep.sinais.length > 1 ? "sinais" : "sinal"}: {c.aep.sinais.join("; ")}
          </p>
        )}
      </div>
    );
  }
  if (c.aepNaoIdentificado) return <span className="text-xs text-amber-700" title="Marcado N/I (não identificável) na AEP">N/I</span>;
  return <span className="text-xs text-gray-400">Não</span>;
}

export function CelulasQuestionario({
  c,
  q,
  setor,
  parecer,
  podeEditar,
  onParecer,
  rotulo,
}: {
  c: CelulaConciliacao;
  q: Questionario;
  setor: SetorConciliacao | undefined;
  parecer: ParecerConciliacao | undefined;
  podeEditar: boolean;
  onParecer: () => void;
  /** Conciliação por grupo: rótulo da empresa de onde veio o nível. */
  rotulo?: (idEmpresa: string) => string;
}) {
  const lado = ladoQuestionario(c, q);
  const classe = c.classe[q];
  const situacao = situacaoParecer(classe, parecer);
  const expostos = setor?.expostos ?? null;
  return (
    <>
      {q !== "AEP" && <td className="px-3 py-2.5">
        {lado ? (
          <div>
            <TextoNivel texto={lado.nivel} degrau={lado.degrau} />
            {rotulo && lado.idEmpresa && <p className="text-[11px] text-gray-400">empresa {rotulo(lado.idEmpresa)}</p>}
            {lado.respondentes != null && (
              <p className={cn("text-[11px]", c.baixaRepresentatividade[q] ? "font-medium text-amber-700" : "text-gray-400")}>
                {lado.respondentes}
                {expostos ? ` de ${expostos}` : ""} resp.
                {expostos ? ` (${Math.round((lado.respondentes / expostos) * 100)}%)` : ""}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>}
      <td className="px-3 py-2.5">
        <SeloClasse classe={classe} />
        {c.sugereAet[q] && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-700" title="NR-17, 17.3.2: avaliação mais aprofundada">
            <Microscope className="size-3" /> Sugere AET
          </p>
        )}
        {c.baixaRepresentatividade[q] && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700" title="Poucos respondentes para o tamanho do setor: resultado só indicativo">
            <AlertTriangle className="size-3" /> Baixa representatividade
          </p>
        )}
      </td>
      <td className="px-3 py-2.5">
        {situacao === "nao-precisa" && !parecer ? (
          classe && classe !== "Sem par" && podeEditar ? (
            <button type="button" onClick={onParecer} className="text-[11px] text-gray-400 hover:text-indigo-700 hover:underline">
              Dar parecer
            </button>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )
        ) : situacao === "pendente" ? (
          <button
            type="button"
            onClick={onParecer}
            disabled={!podeEditar}
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-default disabled:opacity-70"
          >
            {podeEditar ? "Dar parecer" : "Sem parecer"}
          </button>
        ) : (
          <button type="button" onClick={onParecer} className="text-left">
            <span className="flex items-center gap-1 text-[11px] font-medium text-gray-800">
              {situacao === "ok" && <CheckCircle2 className="size-3 text-emerald-600" />}
              {parecer ? ROTULO_DECISAO[parecer.decisao].split(" (")[0] : ""}
            </span>
            {situacao === "sem-acao" && <span className="block text-[11px] text-amber-700">sem ação no plano</span>}
            {situacao === "desatualizado" && <span className="block text-[11px] text-amber-700">rever (os documentos mudaram)</span>}
            {parecer?.id_acao && <span className="block text-[11px] text-gray-400">Ação {parecer.id_acao}</span>}
          </button>
        )}
      </td>
    </>
  );
}
