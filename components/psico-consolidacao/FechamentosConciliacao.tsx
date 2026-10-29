"use client";

// Conciliação DRPS/QPS × AEP — fechar a conciliação (foto imutável para o histórico do
// PGR, NR-01) e as conciliações já fechadas da empresa (v0.3.176, banco v310).
// v0.3.178: cada fechamento tem o seu PDF (/api/pdf/conciliacao/[idEmpresa]?fechamento=).

import { useState } from "react";
import { ChevronDown, ChevronRight, FileDown, Loader2, Lock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { SeloClasse } from "@/components/psico-consolidacao/ConciliacaoSelos";
import { useFecharConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { ROTULO_DECISAO, type ContagemPareceres, type ItemFechamento } from "@/lib/psico-consolidacao/conciliacao";
import type { FechamentoConciliacao } from "@/lib/psico-consolidacao/carregar-conciliacao";
import { fmtData } from "@/lib/utils";

export default function FechamentosConciliacao({
  idEmpresa,
  historico,
  contagem,
  podeEditar,
  podeFechar,
  montar,
}: {
  idEmpresa: string;
  historico: FechamentoConciliacao[];
  contagem: ContagemPareceres;
  podeEditar: boolean;
  /** Há o que conciliar (AEP + questionário com setor em comum). */
  podeFechar: boolean;
  /** Monta a foto na hora de fechar (documentos, totais, itens). */
  montar: () => { documentos: Record<string, { id: string; titulo: string; data: string | null }>; resumo: Record<string, unknown>; itens: ItemFechamento[] };
}) {
  const fechar = useFecharConciliacao();
  const [aberto, setAberto] = useState(false);
  const [obs, setObs] = useState("");
  const [visto, setVisto] = useState<string | null>(null);
  const faltam = contagem.pendentes + contagem.desatualizados;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-gray-800">Conciliações fechadas</p>
          <p className="text-xs text-gray-500">
            Fechar guarda uma foto (documentos, régua, resultados e pareceres) que não muda mais: é o registro da avaliação para
            o PGR. O PDF de cada fechamento serve de anexo.
          </p>
        </div>
        {podeEditar && podeFechar && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Lock className="size-3.5" /> Fechar conciliação
          </button>
        )}
      </div>

      {historico.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">Nenhuma conciliação fechada ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {historico.map((f) => {
            const p = f.resumo?.pareceres;
            const aberta = visto === f.id_fechamento;
            return (
              <li key={f.id_fechamento} className="py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisto(aberta ? null : f.id_fechamento)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-gray-700"
                  >
                    {aberta ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                    <span className="font-medium">{fmtData(f.fechado_em)}</span>
                    <span className="text-xs text-gray-500">por {f.fechado_por}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {f.itens?.length ?? 0} cruzamento(s){p ? ` · ${p.semAcao} sem ação` : ""}
                    </span>
                  </button>
                  <a
                    href={`/api/pdf/conciliacao/${encodeURIComponent(idEmpresa)}?fechamento=${encodeURIComponent(f.id_fechamento)}`}
                    target="_blank"
                    rel="noopener"
                    title="PDF desta conciliação fechada, para anexar ao PGR"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <FileDown className="size-3.5" /> PDF
                  </a>
                </div>
                {aberta && (
                  <div className="mt-2 space-y-2 pl-6">
                    <p className="text-xs text-gray-500">
                      Documentos:{" "}
                      {Object.entries(f.documentos ?? {})
                        .map(([o, d]) => `${o} ${d.titulo}${d.data ? ` (${fmtData(d.data)})` : ""}`)
                        .join(" · ") || "—"}
                    </p>
                    {f.observacao && <p className="text-xs text-gray-600">Observação: {f.observacao}</p>}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
                            <th className="py-1 pr-2">Setor</th>
                            <th className="py-1 pr-2">Fator</th>
                            <th className="py-1 pr-2">AEP</th>
                            <th className="py-1 pr-2">Questionário</th>
                            <th className="py-1 pr-2">Resultado</th>
                            <th className="py-1 pr-2">Parecer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(f.itens ?? []).map((i) => (
                            <tr key={`${i.setor_chave}|${i.id_fator}|${i.questionario}`} className="border-t border-gray-50 align-top">
                              <td className="py-1 pr-2">{i.setor}</td>
                              <td className="py-1 pr-2">{i.fator}</td>
                              <td className="py-1 pr-2">{i.aep ?? "Não"}</td>
                              <td className="py-1 pr-2">
                                {i.questionario} {i.nivel_questionario ?? "—"}
                                {i.respondentes != null && ` · ${i.respondentes}${i.expostos ? `/${i.expostos}` : ""} resp.`}
                              </td>
                              <td className="py-1 pr-2"><SeloClasse classe={i.classe} /></td>
                              <td className="py-1 pr-2">
                                {i.decisao ? ROTULO_DECISAO[i.decisao] : <span className="text-amber-700">sem parecer</span>}
                                {i.justificativa && <span className="block text-gray-500">{i.justificativa}</span>}
                                {i.id_acao && <span className="block text-gray-400">Ação {i.id_acao}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aberto && (
        <Modal
          open
          onClose={() => setAberto(false)}
          title="Fechar a conciliação"
          footer={
            <div className="flex w-full justify-end gap-2">
              <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                disabled={faltam > 0 || fechar.isPending}
                onClick={() =>
                  fechar.mutate({ idEmpresa, ...montar(), observacao: obs }, { onSuccess: () => { setAberto(false); setObs(""); } })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {fechar.isPending && <Loader2 className="size-3.5 animate-spin" />} Fechar e guardar
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            {faltam > 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                Antes de fechar, dê parecer em todas as divergências: faltam <b>{contagem.pendentes}</b> sem parecer
                {contagem.desatualizados > 0 && (
                  <>
                    {" "}e <b>{contagem.desatualizados}</b> com parecer de outra situação (os documentos mudaram)
                  </>
                )}
                .
              </p>
            ) : (
              <p className="text-gray-600">
                Fica guardado: os documentos usados, a régua, os resultados e os {contagem.comParecer} parecer(es).
                {contagem.semAcao > 0 && (
                  <span className="mt-1 block text-xs text-amber-700">
                    {contagem.semAcao} parecer(es) Confirmar/AET ainda sem ação no Plano de Ação — dá para fechar, mas fica
                    registrado.
                  </span>
                )}
              </p>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Observação (opcional)</span>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
