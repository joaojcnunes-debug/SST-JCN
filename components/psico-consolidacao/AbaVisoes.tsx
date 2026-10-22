"use client";

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PESO_NIVEL, type NivelPresente } from "@/lib/psico-consolidacao/motor";
import { Nivel, passa, Secao, Tabela, TD, TD_1A, TH, Vazio, type Analise, type Ocorrencia } from "./comum";

type Visao = "fator_empresa" | "empresa_fator" | "empresa_setor" | "fator_setor" | "totais";

const VISOES: Array<{ id: Visao; label: string }> = [
  { id: "fator_empresa", label: "1. Fator × Empresa → setores" },
  { id: "empresa_fator", label: "2. Empresa × Fator → setores" },
  { id: "empresa_setor", label: "3. Empresa × Setor → fatores" },
  { id: "fator_setor", label: "4. Fator × Setor → empresas" },
  { id: "totais", label: "5. Totais" },
];

const NIVEIS: NivelPresente[] = ["Crítico", "Alto", "Médio", "Identificado"];

const maisGrave = (a: Ocorrencia, b: Ocorrencia) => PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel];

/** 5.2 — as visões cruzadas que antes eram montadas à mão no Excel. Só riscos presentes. */
export default function AbaVisoes({ a }: { a: Analise }) {
  const { r, nomeEmpresa, nomeFator, filtro } = a;
  const [visao, setVisao] = useState<Visao>("fator_empresa");

  const oc = useMemo(
    () => a.ocorrencias.filter((o) => passa(filtro, o)),
    [a.ocorrencias, filtro],
  );
  const empresas = useMemo(
    () => [...new Set(oc.map((o) => o.idEmpresa))].sort((x, y) => nomeEmpresa(x).localeCompare(nomeEmpresa(y), "pt-BR")),
    [oc, nomeEmpresa],
  );
  const fatores = r.fatores.map((f) => f.id_fator).filter((f) => oc.some((o) => o.idFator === f));
  const setores = [...new Set(oc.map((o) => o.setor))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  const de = (f: (o: Ocorrencia) => boolean) => oc.filter(f);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {VISOES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVisao(v.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              visao === v.id ? "border-verde-primary bg-verde-primary text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Só riscos presentes: DRPS/Questionário Médio, Alto ou Crítico e fator marcado na AEP (<Nivel nivel="Identificado" />).
        Quando a empresa tem o mesmo setor mais de uma vez, vale o maior nível.
      </p>

      {oc.length === 0 ? (
        <Vazio>Nenhum risco presente com esses filtros.</Vazio>
      ) : visao === "fator_empresa" ? (
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={cn(TH, "left-0 z-20")}>Fator</th>
              {empresas.map((e) => (
                <th key={e} className={TH}>{nomeEmpresa(e)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fatores.map((f) => (
              <tr key={f}>
                <td className={TD_1A}>{nomeFator(f)}</td>
                {empresas.map((e) => (
                  <td key={e} className={cn(TD, "text-xs")}>
                    {de((o) => o.idFator === f && o.idEmpresa === e)
                      .sort(maisGrave)
                      .map((o) => (
                        <div key={o.setor} className="flex items-center gap-1">
                          <Ponto nivel={o.nivel} /> {o.setor}
                        </div>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Tabela>
      ) : visao === "empresa_fator" ? (
        <Tabela>
          <thead>
            <tr>
              <th className={TH}>Empresa</th>
              <th className={TH}>Fator</th>
              <th className={TH}>Setor</th>
              <th className={TH}>Nível</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) =>
              fatores.map((f) => {
                const l = de((o) => o.idEmpresa === e && o.idFator === f).sort((x, y) => maisGrave(x, y) || x.setor.localeCompare(y.setor, "pt-BR"));
                return l.map((o, i) => (
                  <tr key={`${e}|${f}|${o.setor}`}>
                    <td className={cn(TD, "text-xs", i > 0 && "text-transparent")}>{nomeEmpresa(e)}</td>
                    <td className={cn(TD, "text-xs", i > 0 && "text-transparent")}>{nomeFator(f)}</td>
                    <td className={TD}>{o.setor}</td>
                    <td className={TD}><Nivel nivel={o.nivel} /></td>
                  </tr>
                ));
              }),
            )}
          </tbody>
        </Tabela>
      ) : visao === "empresa_setor" ? (
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={TH}>Empresa</th>
              <th className={TH}>Setor</th>
              <th className={TH} colSpan={fatores.length}>Fatores (um por célula, do mais grave ao menos grave)</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => {
              const ss = setores.filter((s) => oc.some((o) => o.idEmpresa === e && o.setor === s));
              return ss.map((s, i) => {
                const l = de((o) => o.idEmpresa === e && o.setor === s).sort(maisGrave);
                return (
                  <tr key={`${e}|${s}`}>
                    {i === 0 && (
                      <td rowSpan={ss.length} className={cn(TD, "border-r border-gray-200 bg-gray-50 font-medium text-gray-800")}>
                        {nomeEmpresa(e)}
                      </td>
                    )}
                    <td className={cn(TD, "whitespace-nowrap")}>{s}</td>
                    {Array.from({ length: fatores.length }, (_, j) => (
                      <td key={j} className={cn(TD, "text-xs")}>
                        {l[j] && (
                          <span className="flex items-center gap-1">
                            <Ponto nivel={l[j].nivel} /> {nomeFator(l[j].idFator)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              });
            })}
          </tbody>
        </Tabela>
      ) : visao === "fator_setor" ? (
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={TH}>Fator</th>
              <th className={TH}>Setor</th>
              <th className={TH} colSpan={empresas.length}>Empresas (uma por célula, do mais grave ao menos grave)</th>
            </tr>
          </thead>
          <tbody>
            {fatores.map((f) => {
              const ss = setores.filter((s) => oc.some((o) => o.idFator === f && o.setor === s));
              return ss.map((s, i) => {
                const l = de((o) => o.idFator === f && o.setor === s).sort(
                  (x, y) => maisGrave(x, y) || nomeEmpresa(x.idEmpresa).localeCompare(nomeEmpresa(y.idEmpresa), "pt-BR"),
                );
                return (
                  <tr key={`${f}|${s}`}>
                    {i === 0 && (
                      <td rowSpan={ss.length} className={cn(TD, "border-r border-gray-200 bg-gray-50 font-medium text-gray-800")}>
                        {nomeFator(f)}
                      </td>
                    )}
                    <td className={cn(TD, "whitespace-nowrap")}>{s}</td>
                    {Array.from({ length: empresas.length }, (_, j) => (
                      <td key={j} className={cn(TD, "text-xs")}>
                        {l[j] && (
                          <span className={cn("inline-block rounded px-1.5 py-0.5", corFundo(l[j].nivel))}>
                            {nomeEmpresa(l[j].idEmpresa)}
                            {l[j].nivel !== "Identificado" ? ` — ${l[j].nivel}` : " — AEP"}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              });
            })}
          </tbody>
        </Tabela>
      ) : (
        <Totais a={a} oc={oc} fatores={fatores} setores={setores} empresas={empresas} />
      )}
    </div>
  );
}

function corFundo(n: NivelPresente) {
  return n === "Crítico" ? "bg-red-100 text-red-900" : n === "Alto" ? "bg-orange-100 text-orange-900" : n === "Médio" ? "bg-amber-100 text-amber-900" : "bg-indigo-50 text-indigo-800";
}

function Ponto({ nivel }: { nivel: NivelPresente }) {
  const c = nivel === "Crítico" ? "bg-red-600" : nivel === "Alto" ? "bg-orange-500" : nivel === "Médio" ? "bg-amber-400" : "bg-indigo-400";
  return <span title={nivel} className={cn("inline-block size-2 shrink-0 rounded-full", c)} />;
}

function Totais({
  a,
  oc,
  fatores,
  setores,
  empresas,
}: {
  a: Analise;
  oc: Ocorrencia[];
  fatores: string[];
  setores: string[];
  empresas: string[];
}) {
  const { nomeEmpresa, nomeFator, r } = a;
  const conta = (f: (o: Ocorrencia) => boolean) => oc.filter(f).length;
  // Pelas linhas (não pelo maior nível): a mesma empresa pode ter AEP e DRPS.
  const chaves = new Set(oc.map((o) => `${o.idEmpresa}|${o.setor}|${o.idFator}`));
  const empresasDe = (f: string, aep: boolean) =>
    new Set(
      a.itens
        .filter((i) => i.idFator === f && (i.origem === "AEP") === aep && (aep || i.nivel !== "Baixo"))
        .filter((i) => chaves.has(`${i.idEmpresa}|${i.setor}|${i.idFator}`))
        .map((i) => i.idEmpresa),
    ).size;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Secao titulo="Nº de empresas por fator">
        <Tabela minW="min-w-0">
          <thead>
            <tr>
              <th className={TH}>Fator</th>
              <th className={cn(TH, "text-right")}>AEP</th>
              <th className={cn(TH, "text-right")}>DRPS/Quest.</th>
              <th className={cn(TH, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {fatores.map((f) => (
              <tr key={f}>
                <td className={TD}>{nomeFator(f)}</td>
                <td className={cn(TD, "text-right")}>{empresasDe(f, true)}</td>
                <td className={cn(TD, "text-right")}>{empresasDe(f, false)}</td>
                <td className={cn(TD, "text-right font-semibold")}>{new Set(oc.filter((o) => o.idFator === f).map((o) => o.idEmpresa)).size}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Secao>

      <Secao
        titulo="Avaliações do DRPS/Questionário por nível"
        descricao="Cada avaliação = um setor × um fator num documento (inclui o Baixo, que não conta como risco)."
      >
        <Tabela minW="min-w-0">
          <thead>
            <tr>
              <th className={TH}>Fator</th>
              {(["Crítico", "Alto", "Médio", "Baixo"] as const).map((n) => (
                <th key={n} className={cn(TH, "text-right")}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.fatores.filter((f) => r.drps.porFator[f.id_fator]).map((f) => (
              <tr key={f.id_fator}>
                <td className={TD}>{f.nome}</td>
                {(["Crítico", "Alto", "Médio", "Baixo"] as const).map((n) => (
                  <td key={n} className={cn(TD, "text-right")}>{r.drps.porFator[f.id_fator][n] || ""}</td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={TD}>Total</td>
              {(["Crítico", "Alto", "Médio", "Baixo"] as const).map((n) => (
                <td key={n} className={cn(TD, "text-right")}>{r.drps.total[n]}</td>
              ))}
            </tr>
          </tbody>
        </Tabela>
      </Secao>

      <Secao titulo="Nº de setores por nível" descricao="Setores em que algum fator chega àquele nível (em qualquer empresa).">
        <div className="flex flex-wrap gap-2">
          {NIVEIS.map((n) => (
            <div key={n} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center">
              <Nivel nivel={n} />
              <p className="mt-1 text-lg font-bold text-gray-900">{new Set(oc.filter((o) => o.nivel === n).map((o) => o.setor)).size}</p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Nº de riscos por setor e por empresa" descricao="Risco = fator presente num setor de uma empresa.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Tabela minW="min-w-0">
            <thead>
              <tr>
                <th className={TH}>Setor</th>
                <th className={cn(TH, "text-right")}>Riscos</th>
              </tr>
            </thead>
            <tbody>
              {setores.map((s) => (
                <tr key={s}>
                  <td className={TD}>{s}</td>
                  <td className={cn(TD, "text-right")}>{conta((o) => o.setor === s)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Tabela minW="min-w-0">
            <thead>
              <tr>
                <th className={TH}>Empresa</th>
                <th className={cn(TH, "text-right")}>Riscos</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <Fragment key={e}>
                  <tr>
                    <td className={TD}>{nomeEmpresa(e)}</td>
                    <td className={cn(TD, "text-right")}>{conta((o) => o.idEmpresa === e)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </Tabela>
        </div>
      </Secao>
    </div>
  );
}
