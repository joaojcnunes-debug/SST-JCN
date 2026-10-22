"use client";

import { cn } from "@/lib/utils";
import { passa, Secao, Tabela, TD, TD_1A, TH, TH_FATOR, type Analise } from "./comum";

function SimNao({ sim }: { sim: boolean }) {
  return sim ? (
    <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">Sim</span>
  ) : (
    <span className="text-[11px] text-gray-300">Não</span>
  );
}

/**
 * 4.7 — a definição final: o fator consta ou não no PGR. Setor comum vale o perfil do
 * setor; setor de uma empresa só (¹) vale a avaliação própria.
 */
export default function AbaSimNao({ a }: { a: Analise }) {
  const { r, nomeEmpresa, filtro } = a;
  const fatores = r.fatores.filter((f) => passa(filtro, { idFator: f.id_fator }));
  const setores = r.simNaoSetor.filter((s) => passa(filtro, { setor: s.setor }) && (!filtro.empresa || r.setores.find((x) => x.setor === s.setor)?.empresas.includes(filtro.empresa)));
  const linhas = r.simNaoEmpresa.filter((l) => passa(filtro, l));

  return (
    <div className="space-y-6">
      <Secao titulo="Setor × fator" descricao={<>&quot;Sim&quot; = o fator está no perfil do setor. ¹ = setor de uma empresa só.</>}>
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={cn(TH, "left-0 z-20")}>Setor</th>
              {fatores.map((f) => (
                <th key={f.id_fator} className={TH_FATOR}>{f.nome}</th>
              ))}
              <th className={cn(TH, "text-right")}>Sim</th>
            </tr>
          </thead>
          <tbody>
            {setores.map((s) => (
              <tr key={s.setor}>
                <td className={cn(TD_1A, "whitespace-nowrap")}>
                  {s.setor}
                  {s.unicaEmpresa && <sup className="ml-0.5 text-indigo-700">1</sup>}
                </td>
                {fatores.map((f) => (
                  <td key={f.id_fator} className="border-t border-gray-100 p-0.5 text-center">
                    <SimNao sim={!!s.fatores[f.id_fator]} />
                  </td>
                ))}
                <td className={cn(TD, "text-right font-semibold")}>{fatores.filter((f) => s.fatores[f.id_fator]).length}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Secao>

      <Secao
        titulo="Empresa × setor × fator"
        descricao={<>&quot;Sim&quot; = o fator deve constar no PGR daquela empresa naquele setor.</>}
      >
        <Tabela minW="min-w-[1000px]">
          <thead>
            <tr>
              <th className={TH}>Empresa</th>
              <th className={TH}>Setor</th>
              {fatores.map((f) => (
                <th key={f.id_fator} className={TH_FATOR}>{f.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const primeira = i === 0 || linhas[i - 1].idEmpresa !== l.idEmpresa;
              const span = primeira ? linhas.slice(i).findIndex((x) => x.idEmpresa !== l.idEmpresa) : 0;
              return (
                <tr key={`${l.idEmpresa}|${l.setor}`}>
                  {primeira && (
                    <td
                      rowSpan={span === -1 ? linhas.length - i : span}
                      className={cn(TD, "border-r border-gray-200 bg-gray-50 text-xs font-medium text-gray-800")}
                    >
                      {nomeEmpresa(l.idEmpresa)}
                    </td>
                  )}
                  <td className={cn(TD, "whitespace-nowrap")}>
                    {l.setor}
                    {l.unicaEmpresa && <sup className="ml-0.5 text-indigo-700">1</sup>}
                  </td>
                  {fatores.map((f) => (
                    <td key={f.id_fator} className="border-t border-gray-100 p-0.5 text-center">
                      <SimNao sim={!!l.fatores[f.id_fator]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </Secao>
    </div>
  );
}
