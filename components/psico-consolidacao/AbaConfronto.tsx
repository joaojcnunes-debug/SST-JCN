"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClasseConfronto } from "@/lib/psico-consolidacao/motor";
import { Cartao, passa, Secao, Tabela, TD_1A, TH, type Analise } from "./comum";

const CLASSES: Array<{ c: ClasseConfronto; cor: string; sigla: string; regra: string }> = [
  { c: "Convergente", cor: "bg-red-500 text-white", sigla: "C", regra: "AEP apontou e o DRPS teve Médio ou pior em ao menos uma avaliação" },
  { c: "Divergente", cor: "bg-violet-500 text-white", sigla: "D", regra: "AEP apontou, mas o setor só teve Baixo no DRPS" },
  { c: "Só AEP", cor: "bg-indigo-200 text-indigo-900", sigla: "A", regra: "AEP apontou e o setor não foi avaliado no DRPS" },
  { c: "Só DRPS", cor: "bg-amber-300 text-amber-950", sigla: "Q", regra: "DRPS teve Médio ou pior e a AEP não apontou (ou não avaliou o setor)" },
  { c: "Sem indicação", cor: "bg-gray-100 text-gray-400", sigla: "·", regra: "Nenhuma das duas fontes aponta" },
];
const COR = Object.fromEntries(CLASSES.map((x) => [x.c, x])) as Record<ClasseConfronto, (typeof CLASSES)[number]>;

/** Fator que só existe na AEP (o 13º): sem correspondência no DRPS. */
const SO_NA_AEP = new Set(["trabalho_remoto"]);

/** 5.3 — Confronto AEP × DRPS no nível do grupo (fator × setor padronizado). */
export default function AbaConfronto({ a }: { a: Analise }) {
  const { r, nomeFator, filtro } = a;
  const setores = r.setores.map((s) => s.setor).filter((s) => passa(filtro, { setor: s }));
  const fatores = r.fatores.filter((f) => passa(filtro, { idFator: f.id_fator }));
  const celula = new Map(r.confronto.celulas.map((c) => [`${c.idFator}|${c.setor}`, c.classe]));

  const totais = { Convergente: 0, Divergente: 0, "Só AEP": 0, "Só DRPS": 0, "Sem indicação": 0 } as Record<ClasseConfronto, number>;
  for (const f of fatores) for (const s of setores) totais[celula.get(`${f.id_fator}|${s}`) ?? "Sem indicação"]++;

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        A AEP e o DRPS podem ser de empresas diferentes do grupo. O confronto mede a coerência <strong>no grupo</strong>, não na
        mesma empresa.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CLASSES.map((x) => (
          <Cartao key={x.c} titulo={x.c} valor={totais[x.c]} detalhe={`de ${fatores.length * setores.length} células`} />
        ))}
      </div>

      <Secao titulo="Matriz fator × setor" descricao="Passe o mouse na célula para ver a classificação.">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
          {CLASSES.map((x) => (
            <span key={x.c} className="inline-flex items-center gap-1" title={x.regra}>
              <span className={cn("inline-flex size-4 items-center justify-center rounded text-[10px] font-bold", x.cor)}>{x.sigla}</span>
              {x.c}
            </span>
          ))}
        </div>
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={cn(TH, "left-0 z-20")}>Fator</th>
              {setores.map((s) => (
                <th key={s} className={cn(TH, "px-1 text-center text-[11px] leading-tight")}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fatores.map((f) => (
              <tr key={f.id_fator}>
                <td className={cn(TD_1A, "whitespace-nowrap text-xs")}>{nomeFator(f.id_fator)}</td>
                {setores.map((s) => {
                  const c = celula.get(`${f.id_fator}|${s}`) ?? "Sem indicação";
                  return (
                    <td key={s} className="border-t border-gray-100 p-0.5 text-center">
                      <span
                        title={`${nomeFator(f.id_fator)} · ${s}: ${c} — ${COR[c].regra}`}
                        className={cn("inline-flex size-6 items-center justify-center rounded text-[11px] font-bold", COR[c].cor)}
                      >
                        {COR[c].sigla}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Secao>

      <Secao titulo="Por fator: em qual fonte aparece">
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {r.confronto.porFator
            .filter((p) => passa(filtro, { idFator: p.idFator }))
            .map((p) => (
              <li key={p.idFator} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
                <span>{nomeFator(p.idFator)}</span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                    p.presenca === "Nas duas fontes"
                      ? "bg-red-100 text-red-800"
                      : p.presenca === "Só no DRPS"
                        ? "bg-amber-100 text-amber-800"
                        : p.presenca === "Só na AEP"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-gray-100 text-gray-500",
                  )}
                >
                  {SO_NA_AEP.has(p.idFator) ? "Sem correspondência no DRPS" : p.presenca}
                </span>
              </li>
            ))}
        </ul>
      </Secao>
    </div>
  );
}
