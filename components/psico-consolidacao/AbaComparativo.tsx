"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";
import type { EmpresaFonte } from "@/lib/psico-consolidacao/carregar-grupo";
import type { DocumentoFonte } from "@/lib/psico-consolidacao/fontes";
import type { Alerta } from "@/lib/psico-consolidacao/motor";
import { passa, Secao, Tabela, TD, TH, Vazio, type Analise } from "./comum";

const COR_CLASSE = {
  Unânime: "bg-red-100 text-red-800",
  Parcial: "bg-amber-100 text-amber-800",
  Exclusivo: "bg-gray-100 text-gray-700",
} as const;

const TITULO_ALERTA: Record<Alerta["tipo"], string> = {
  fator_sem_sinal: "Fator marcado sem sinal observado (AEP)",
  aiha_nao_calculada: "Matriz AIHA não gravada — nível pela regra (AEP)",
  empregadora_sem_drps: "Empresa empregadora sem DRPS/Questionário",
  probabilidade_nao_informada: "Probabilidade não informada — valeu Baixa (DRPS/Questionário)",
  poucos_respondentes: "Setor com 1 ou 2 respondentes",
  nao_identificado: "Fator N/I na AEP (pendente de avaliação)",
  sem_base: "Categoria sem resposta no Questionário",
};

/**
 * 5.1 — Comparativo da AEP entre as empresas: quais fatores cada SPE apontou, os sinais
 * por fator e os pontos de atenção automáticos (de todas as fontes).
 */
export default function AbaComparativo({
  a,
  documentos,
  empresasInfo,
  setoresSemConfirmacao,
}: {
  a: Analise;
  documentos: DocumentoFonte[];
  empresasInfo: EmpresaFonte[];
  setoresSemConfirmacao: number;
}) {
  const { r, itens, nomeEmpresa, nomeFator, filtro } = a;
  const [aberto, setAberto] = useState<string | null>(null);

  const docsAep = useMemo(() => {
    const info = new Map(empresasInfo.map((e) => [e.idEmpresa, e]));
    return documentos
      .filter((d) => d.origem === "AEP" && passa(filtro, { idEmpresa: d.idEmpresa }))
      .map((d) => ({
        ...d,
        info: info.get(d.idEmpresa),
        fatores: new Set(itens.filter((i) => i.origem === "AEP" && i.idEmpresa === d.idEmpresa).map((i) => i.idFator)).size,
      }))
      .sort((x, y) => nomeEmpresa(x.idEmpresa).localeCompare(nomeEmpresa(y.idEmpresa), "pt-BR"));
  }, [documentos, empresasInfo, itens, filtro, nomeEmpresa]);

  const fatores = r.comparativoAep.fatores.filter((f) => passa(filtro, { idFator: f.idFator }) && (!filtro.empresa || f.empresas.includes(filtro.empresa)));
  const alertas = r.alertas.filter((x) => passa(filtro, { idEmpresa: x.idEmpresa, idFator: x.idFator }));
  const porTipo = new Map<Alerta["tipo"], Alerta[]>();
  for (const x of alertas) porTipo.set(x.tipo, [...(porTipo.get(x.tipo) ?? []), x]);

  if (r.comparativoAep.empresas.length === 0) {
    return <Vazio>Nenhuma AEP concluída nos documentos escolhidos.</Vazio>;
  }

  return (
    <div className="space-y-6">
      <Secao titulo="Documentos AEP">
        <Tabela>
          <thead>
            <tr>
              <th className={TH}>Empresa</th>
              <th className={TH}>CNPJ</th>
              <th className={TH}>Município</th>
              <th className={TH}>Data</th>
              <th className={TH}>Responsável</th>
              <th className={TH}>AET necessária</th>
              <th className={cn(TH, "text-right")}>Setores</th>
              <th className={cn(TH, "text-right")}>Fatores distintos</th>
            </tr>
          </thead>
          <tbody>
            {docsAep.map((d) => (
              <tr key={d.id}>
                <td className={TD}>{nomeEmpresa(d.idEmpresa)}</td>
                <td className={cn(TD, "whitespace-nowrap text-xs text-gray-600")}>{d.info?.cnpj ? formatCNPJ(d.info.cnpj) : "—"}</td>
                <td className={cn(TD, "text-xs text-gray-600")}>
                  {d.info?.municipio ? `${d.info.municipio}${d.info.uf ? `/${d.info.uf}` : ""}` : "—"}
                </td>
                <td className={cn(TD, "whitespace-nowrap text-xs")}>{d.data ? fmtData(d.data) : "—"}</td>
                <td className={cn(TD, "text-xs")}>{d.responsavel ?? "—"}</td>
                <td className={cn(TD, "text-xs")}>{d.necessitaAet ? "Sim" : "Não"}</td>
                <td className={cn(TD, "text-right")}>{d.setores}</td>
                <td className={cn(TD, "text-right font-semibold")}>{d.fatores}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Secao>

      <Secao
        titulo="Fatores pelo nº de empresas que os apontam"
        descricao={
          <>
            <strong>Unânime</strong> = todas as {r.comparativoAep.empresas.length} empresas com AEP; <strong>Parcial</strong> = de 2
            até uma a menos que todas; <strong>Exclusivo</strong> = uma só. Clique no fator para ver os sinais observados.
          </>
        }
      >
        <div className="space-y-1.5">
          {fatores.map((f) => {
            const k = f.idFator;
            const abre = aberto === k;
            return (
              <div key={k} className="rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setAberto(abre ? null : k)}
                  className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  {abre ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                  <span className="font-medium text-gray-900">{nomeFator(k)}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", COR_CLASSE[f.classe])}>{f.classe}</span>
                  <span className="text-xs text-gray-500">
                    {f.empresas.length} de {r.comparativoAep.empresas.length} empresa(s)
                  </span>
                  {f.sinaisExclusivos.length > 0 && (
                    <span className="text-[11px] text-indigo-700">{f.sinaisExclusivos.length} sinal(is) exclusivo(s)</span>
                  )}
                </button>
                {abre && (
                  <div className="space-y-2 border-t border-gray-100 px-3 py-2 text-xs">
                    <p className="text-gray-600">
                      <strong>Empresas:</strong> {f.empresas.map(nomeEmpresa).sort((x, y) => x.localeCompare(y, "pt-BR")).join("; ")}
                    </p>
                    {f.sinais.length === 0 ? (
                      <p className="text-gray-500">Nenhum sinal observado marcado.</p>
                    ) : (
                      <ul className="space-y-1">
                        {f.sinais.map((s) => (
                          <li key={s.sinal} className="flex gap-2">
                            <span className="w-8 shrink-0 text-right font-semibold text-gray-700">{s.empresas.length}×</span>
                            <span>
                              <span className="text-gray-800">{s.sinal}</span>
                              <span className="ml-1 text-gray-500">— {s.empresas.map(nomeEmpresa).join("; ")}</span>
                              {f.empresas.length >= 2 && s.empresas.length === 1 && (
                                <span className="ml-1 rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-700">exclusivo</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Pontos de atenção" descricao="Gerados automaticamente. Não mudam o cálculo — servem para conferir os documentos.">
        <div className="space-y-1.5">
          {setoresSemConfirmacao > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {setoresSemConfirmacao} nome(s) de setor ainda sem padronização confirmada — a análise usa a sugestão. Confira na aba
              Setores.
            </p>
          )}
          {porTipo.size === 0 && setoresSemConfirmacao === 0 && <p className="text-xs text-gray-500">Nenhum ponto de atenção.</p>}
          {[...porTipo.entries()].map(([tipo, lista]) => (
            <details key={tipo} className="rounded-lg border border-gray-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                <span className="font-medium text-gray-800">{TITULO_ALERTA[tipo]}</span>
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{lista.length}</span>
              </summary>
              <ul className="max-h-72 space-y-0.5 overflow-auto border-t border-gray-100 px-3 py-2 text-xs">
                {lista.map((x, i) => (
                  <li key={i} className="text-gray-700">
                    <strong>{nomeEmpresa(x.idEmpresa)}</strong>
                    {x.setor && <> · {x.setor}</>} — {x.texto}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Secao>
    </div>
  );
}
