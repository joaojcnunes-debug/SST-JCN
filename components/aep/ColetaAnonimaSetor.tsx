"use client";

// Questionário anônimo por QR Code de UM setor da AEP (Fase 3, 2026-10-06;
// v273, dentro do QPS). Gera o link + QR, imprime, encerra/prorroga e mostra
// o resultado só com ≥ 5 respostas (k-anonimato). Fator com ≥ 30% de
// "Frequentemente/Sempre" é SUGERIDO — o técnico decide; com o fator em "Sim",
// um clique registra a origem "questionário anônimo". Triagem complementar:
// não substitui o DRPS.

import { useMemo, useState } from "react";
import { Copy, Loader2, MessageSquareText, Printer, QrCode, RotateCcw, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
  buscarComentariosColeta,
  useAtualizarColetaAnonima,
  useCriarColetaAnonima,
  usePerguntasTriagem,
  useResultadoColeta,
  type ColetaAnonima,
} from "@/lib/hooks/useColetaAnonima";
import {
  AVISO_COMPLEMENTAR,
  K_MINIMO,
  LIMIAR_PADRAO,
  VALIDADE_PADRAO_DIAS,
  percentuaisPorFator,
  situacaoColeta,
} from "@/lib/qps/triagem-anonima";
import { qrSvg } from "@/lib/qr/qrcode";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { cn, fmtData } from "@/lib/utils";

const rotuloFator = (k: string) => ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k;

function urlDoToken(token: string) {
  return `${window.location.origin}/q/${token}`;
}

function imprimirQr(coleta: ColetaAnonima) {
  const url = urlDoToken(coleta.token);
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return toast.error("Libere as janelas pop-up para imprimir.");
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Questionário anônimo</title>
<style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#111}h1{font-size:26px;margin:0 0 6px}
p{font-size:16px;margin:6px 0}.qr{width:360px;height:360px;margin:20px auto}.qr svg{width:100%;height:100%}
.pe{font-size:12px;color:#555;margin-top:24px}.url{font-size:11px;color:#777;word-break:break-all}</style></head><body>
<h1>Questionário anônimo</h1><p><strong>Setor: ${esc(coleta.setor)}</strong></p>
<p>Aponte a câmera do celular para o código e responda. Leva 2 minutos.</p>
<p><strong>Não pedimos seu nome.</strong> Ninguém da empresa vê as respostas individuais.</p>
<div class="qr">${qrSvg(url, "M")}</div>
<p>Disponível até ${esc(fmtData(coleta.expira_em) ?? coleta.expira_em)}</p>
<p class="url">${esc(url)}</p>
<p class="pe">JCN Consultoria — triagem complementar da avaliação ergonômica.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

export default function ColetaAnonimaSetor({
  idRelatorio,
  idEmpresa,
  empresaNome,
  idSetor,
  setorNome,
  coletas,
  checklistOrg,
  origens,
  onRegistrarOrigem,
  disabled,
}: {
  idRelatorio: string;
  idEmpresa: string | null | undefined;
  empresaNome?: string | null;
  idSetor: string;
  setorNome: string;
  /** Todas as coletas da AEP (para achar a do setor e a aplicação QPS). */
  coletas: ColetaAnonima[];
  checklistOrg: Record<string, string>;
  origens: Record<string, string[]>;
  onRegistrarOrigem: (fator: string) => void;
  disabled?: boolean;
}) {
  const criar = useCriarColetaAnonima();
  const atualizar = useAtualizarColetaAnonima();
  const [dias, setDias] = useState(VALIDADE_PADRAO_DIAS);
  const [comentarios, setComentarios] = useState<string[] | null>(null);
  const coleta = coletas.find((c) => c.id_setor_aep === idSetor) ?? null;
  const { data: resultado, isLoading: carregandoRes } = useResultadoColeta(coleta?.id_coleta);
  const { data: fatorDaPergunta = {} } = usePerguntasTriagem();
  const hoje = new Date().toISOString().slice(0, 10);
  const situacao = coleta ? situacaoColeta(coleta, hoje, resultado?.total ?? 0) : null;
  const pcts = useMemo(
    () => percentuaisPorFator(resultado, fatorDaPergunta, LIMIAR_PADRAO).sort((a, b) => b.pct - a.pct),
    [resultado, fatorDaPergunta],
  );
  const qr = useMemo(() => (coleta ? qrSvg(urlDoToken(coleta.token), "M") : ""), [coleta]);

  return (
    <div className="space-y-2 border-t border-emerald-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
          <QrCode className="size-3.5" /> Questionário anônimo (QR Code)
        </p>
        <span className="text-[11px] text-gray-500">{AVISO_COMPLEMENTAR}</span>
      </div>

      {!coleta && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>Para quando os trabalhadores não se manifestam na entrevista. Válido por</span>
          <input
            type="number"
            min={1}
            max={90}
            disabled={disabled}
            value={dias}
            onChange={(e) => setDias(Math.min(90, Math.max(1, Number(e.target.value) || VALIDADE_PADRAO_DIAS)))}
            className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
          />
          <span>dias.</span>
          {!disabled && (
            <button
              type="button"
              disabled={criar.isPending || !idEmpresa}
              onClick={() =>
                criar.mutate({
                  idRelatorio,
                  idEmpresa: idEmpresa!,
                  empresaNome,
                  idSetor,
                  setorNome,
                  dias,
                  idAplicacaoExistente: coletas[0]?.id_aplicacao ?? null,
                })
              }
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {criar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <QrCode className="size-3.5" />}
              Gerar link anônimo
            </button>
          )}
        </div>
      )}

      {coleta && (
        <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[120px_1fr]">
          <div className="mx-auto size-[120px]" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  situacao === "aberta" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600",
                )}
              >
                {situacao === "aberta" ? "Recebendo respostas" : situacao === "expirada" ? "Expirado" : situacao === "cheia" ? "Limite atingido" : "Encerrado"}
              </span>
              <span className="text-gray-500">até {fmtData(coleta.expira_em)}</span>
              <span className="text-gray-500">· {resultado?.total ?? 0} resposta{(resultado?.total ?? 0) === 1 ? "" : "s"}</span>
            </div>
            <p className="truncate font-mono text-[11px] text-gray-500">{urlDoToken(coleta.token)}</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => imprimirQr(coleta)} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50">
                <Printer className="size-3.5" /> Imprimir QR
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(urlDoToken(coleta.token)).then(() => toast.success("Link copiado"))}
                className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
              >
                <Copy className="size-3.5" /> Copiar link
              </button>
              {!disabled && (
                <>
                  <button
                    type="button"
                    disabled={atualizar.isPending}
                    onClick={() =>
                      atualizar.mutate({
                        idColeta: coleta.id_coleta,
                        idRelatorio,
                        patch: {
                          ativo: true,
                          expira_em: new Date(Date.now() + VALIDADE_PADRAO_DIAS * 86400000).toISOString().slice(0, 10),
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RotateCcw className="size-3.5" /> {coleta.ativo ? `Prorrogar ${VALIDADE_PADRAO_DIAS} dias` : "Reabrir"}
                  </button>
                  {coleta.ativo && (
                    <button
                      type="button"
                      disabled={atualizar.isPending}
                      onClick={() => atualizar.mutate({ idColeta: coleta.id_coleta, idRelatorio, patch: { ativo: false } })}
                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 font-medium text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="size-3.5" /> Encerrar
                    </button>
                  )}
                </>
              )}
            </div>

            {carregandoRes && <p className="text-gray-400">Carregando resultado…</p>}
            {resultado && !resultado.suficiente && (
              <p className="rounded bg-gray-50 px-2 py-1 text-gray-600">
                Respostas insuficientes para exibição ({resultado.total} de {K_MINIMO}). O resultado só aparece com {K_MINIMO} ou
                mais respostas, para proteger o anonimato.
              </p>
            )}
            {resultado?.suficiente && (
              <div className="space-y-1">
                <p className="font-semibold text-gray-700">
                  % de “Frequentemente/Sempre” por fator (sugere a partir de {Math.round(LIMIAR_PADRAO * 100)}%)
                </p>
                {pcts.map((p) => {
                  const sim = checklistOrg[p.fator] === "sim";
                  const jaTem = (origens[p.fator] ?? []).includes("questionario_anonimo");
                  return (
                    <div key={p.fator} className="flex flex-wrap items-center gap-2">
                      <span className={cn("w-56 truncate", p.sugerido && "font-semibold text-amber-800")} title={rotuloFator(p.fator)}>
                        {rotuloFator(p.fator)}
                      </span>
                      <span className="h-2 w-24 overflow-hidden rounded bg-gray-100">
                        <span className={cn("block h-full", p.sugerido ? "bg-amber-500" : "bg-gray-400")} style={{ width: `${Math.round(p.pct * 100)}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums">{Math.round(p.pct * 100)}%</span>
                      {p.sugerido &&
                        (sim ? (
                          jaTem ? (
                            <span className="text-[11px] text-emerald-700">origem registrada</span>
                          ) : (
                            !disabled && (
                              <button type="button" onClick={() => onRegistrarOrigem(p.fator)} className="text-[11px] font-semibold text-sky-700 underline">
                                Registrar como origem da evidência
                              </button>
                            )
                          )
                        ) : (
                          <span className="text-[11px] text-amber-700">sugerido — avalie marcar Sim</span>
                        ))}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    buscarComentariosColeta(coleta.id_coleta)
                      .then(setComentarios)
                      .catch((e: Error) => toast.error(e.message))
                  }
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 underline"
                >
                  <MessageSquareText className="size-3.5" /> Ver comentários (uso interno)
                </button>
                {comentarios && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-gray-600">
                    {comentarios.length === 0 ? <li>Nenhum comentário.</li> : comentarios.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
                <p className="text-[10px] text-gray-400">Comentários não vão para o laudo; use-os só de forma agregada.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
