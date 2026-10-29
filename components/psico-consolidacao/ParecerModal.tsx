"use client";

// Conciliação DRPS/QPS × AEP — parecer de UM cruzamento setor × fator × questionário
// (v0.3.176, banco v310). Confirmar no inventário do PGR (NR-01), aprofundar com AET
// (NR-17, 17.3.2) ou descartar com justificativa; Confirmar/AET podem criar a ação 5W2H.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { SeloClasse } from "@/components/psico-consolidacao/ConciliacaoSelos";
import { useExcluirParecer, useSalvarParecer } from "@/lib/hooks/useConciliacaoParecer";
import {
  ROTULO_DECISAO,
  type CelulaConciliacao,
  type DecisaoParecer,
  type ParecerConciliacao,
  type Questionario,
} from "@/lib/psico-consolidacao/conciliacao";
import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";
import { cn, fmtData } from "@/lib/utils";

const EXPLICACAO_DECISAO: Record<DecisaoParecer, string> = {
  CONFIRMAR: "O fator entra no inventário de riscos do PGR deste setor (NR-01), com medida no plano de ação.",
  AET: "A divergência pede avaliação mais aprofundada: Análise Ergonômica do Trabalho do setor (NR-17, 17.3.2).",
  DESCARTAR: "Não é risco deste setor. Escreva o porquê (ex.: baixa adesão ao questionário, fato pontual já resolvido).",
};

export interface ContextoParecer {
  idEmpresa: string;
  celula: CelulaConciliacao;
  questionario: Questionario;
  fator: string;
  expostos: number | null;
  necessitaAet: boolean;
  documentos: Partial<Record<OrigemFonte, string>>;
  atual: ParecerConciliacao | undefined;
}

function decisaoSugerida(c: CelulaConciliacao, q: Questionario): DecisaoParecer {
  if (c.sugereAet[q]) return "AET";
  if (c.baixaRepresentatividade[q] && c.classe[q] === "Só questionário") return "DESCARTAR";
  return "CONFIRMAR";
}

export default function ParecerModal({
  ctx,
  podeEditar,
  onClose,
}: {
  ctx: ContextoParecer;
  podeEditar: boolean;
  onClose: () => void;
}) {
  const { celula: c, questionario: q, atual } = ctx;
  const classe = c.classe[q]!;
  const lado = q === "DRPS" ? c.drps : c.qps;
  const [decisao, setDecisao] = useState<DecisaoParecer>(atual?.decisao ?? decisaoSugerida(c, q));
  const [justificativa, setJustificativa] = useState(atual?.justificativa ?? "");
  const [gerarAcao, setGerarAcao] = useState(!atual?.id_acao);
  const salvar = useSalvarParecer();
  const excluir = useExcluirParecer();

  const textoAep = c.aep ? c.aep.nivelAiha ?? "Sim (sem AIHA)" : c.aepNaoIdentificado ? "N/I" : "Não marcado";
  const textoQ = lado ? `${lado.nivel}${lado.respondentes != null ? ` (${lado.respondentes} resp.)` : ""}` : "—";
  const precisaJustificativa = decisao === "DESCARTAR";
  const podeSalvar = podeEditar && (!precisaJustificativa || justificativa.trim() !== "");

  const enviar = () =>
    salvar.mutate(
      {
        atual,
        idEmpresa: ctx.idEmpresa,
        setorChave: c.chaveSetor,
        setorNome: c.setor,
        idFator: c.idFator,
        questionario: q,
        decisao,
        justificativa,
        classe,
        documentos: ctx.documentos,
        gerarAcao:
          gerarAcao && decisao !== "DESCARTAR" && !atual?.id_acao
            ? {
                setor: c.setor,
                fator: ctx.fator,
                classe,
                retrato: `AEP ${textoAep} × ${q} ${textoQ}`,
                maiorDegrau: Math.max(c.aep?.degrau ?? 0, lado?.degrau ?? 0),
              }
            : null,
      },
      { onSuccess: onClose },
    );

  const remover = async () => {
    if (!atual) return;
    const ok = await confirmar({
      title: "Remover este parecer?",
      description: atual.id_acao ? "A ação 5W2H já criada continua no Plano de Ação." : undefined,
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (ok) excluir.mutate(atual.id_parecer, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Parecer — ${c.setor} · ${ctx.fator} (${q} × AEP)`}
      footer={
        <div className="flex w-full items-center gap-2">
          {atual && podeEditar && (
            <button type="button" onClick={remover} className="mr-auto text-xs font-medium text-red-600 hover:underline">
              Remover parecer
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            {podeEditar ? "Cancelar" : "Fechar"}
          </button>
          {podeEditar && (
            <button
              type="button"
              disabled={!podeSalvar || salvar.isPending}
              onClick={enviar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />} Salvar parecer
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-gray-400">AEP (técnico)</p>
            <p className="font-medium text-gray-800">{textoAep}</p>
            {c.aep && c.aep.sinais.length > 0 && <p className="text-[11px] text-gray-500">{c.aep.sinais.join("; ")}</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-gray-400">{q} (trabalhadores)</p>
            <p className="font-medium text-gray-800">{textoQ}</p>
            {ctx.expostos != null && <p className="text-[11px] text-gray-500">{ctx.expostos} expostos no setor (AEP)</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-gray-400">Resultado</p>
            <SeloClasse classe={classe} />
          </div>
        </div>

        {(c.sugereAet[q] || ctx.necessitaAet) && (
          <p className="flex gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 text-xs text-indigo-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {c.sugereAet[q] && "A percepção dos trabalhadores e a AEP divergem neste fator: a NR-17 (17.3.2) pede avaliação mais aprofundada (AET). "}
              {ctx.necessitaAet && "A AEP já marcou que este setor necessita de AET."}
            </span>
          </p>
        )}
        {c.baixaRepresentatividade[q] && (
          <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Poucos respondentes para o tamanho do setor: o resultado do questionário aqui é só indicativo.
          </p>
        )}
        {atual && atual.classe !== classe && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            Este parecer foi dado quando o resultado era <b>{atual.classe}</b>. Os documentos mudaram: confira e salve de novo.
          </p>
        )}

        <fieldset className="space-y-2" disabled={!podeEditar}>
          <legend className="mb-1 text-xs font-semibold text-gray-600">Decisão</legend>
          {(Object.keys(ROTULO_DECISAO) as DecisaoParecer[]).map((d) => (
            <label
              key={d}
              className={cn(
                "flex cursor-pointer gap-2.5 rounded-lg border p-2.5",
                decisao === d ? "border-indigo-400 bg-indigo-50/50" : "border-gray-200 hover:bg-gray-50",
              )}
            >
              <input type="radio" name="decisao" checked={decisao === d} onChange={() => setDecisao(d)} className="mt-0.5" />
              <span>
                <span className="font-medium text-gray-800">{ROTULO_DECISAO[d]}</span>
                <span className="block text-xs text-gray-500">{EXPLICACAO_DECISAO[d]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600">
            Justificativa {precisaJustificativa ? <span className="text-red-600">(obrigatória)</span> : "(opcional)"}
          </span>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            disabled={!podeEditar}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="O que levou a esta decisão (fica no histórico da conciliação)"
          />
        </label>

        {decisao !== "DESCARTAR" &&
          (atual?.id_acao ? (
            <p className="text-xs text-gray-600">
              Ação já criada: <b>{atual.id_acao}</b> ·{" "}
              <Link href="/acoes" className="inline-flex items-center gap-0.5 text-indigo-700 hover:underline">
                ver no Plano de Ação <ExternalLink className="size-3" />
              </Link>
            </p>
          ) : (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={gerarAcao} disabled={!podeEditar} onChange={(e) => setGerarAcao(e.target.checked)} />
              Criar a ação 5W2H no Plano de Ação (sem prazo e sem responsável, para completar lá)
            </label>
          ))}

        {atual && (
          <p className="text-[11px] text-gray-400">
            Parecer de {atual.criado_por ?? "—"}
            {atual.criado_em ? ` em ${fmtData(atual.criado_em)}` : ""}
            {atual.atualizado_em && atual.atualizado_em !== atual.criado_em
              ? ` · atualizado por ${atual.atualizado_por ?? "—"} em ${fmtData(atual.atualizado_em)}`
              : ""}
          </p>
        )}
      </div>
    </Modal>
  );
}
