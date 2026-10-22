"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { resolverFator, type OrigemFonte, type PsicoFator, type PsicoFatorDepara } from "@/lib/psico-consolidacao/fatores";
import type { LinhaFonte } from "@/lib/psico-consolidacao/fontes";
import { useSalvarFatorDepara, useSalvarFatoresIgnorados } from "@/lib/hooks/usePsicoConsolidacao";

const ROTULO_AEP = new Map(ITENS_ORGANIZACIONAL.map((i) => [i.key as string, i.label]));

/**
 * Os 13 fatores do catálogo (o grupo pode deixar algum de fora) e de onde vem cada
 * nome de fator dos documentos. AEP e DRPS têm catálogo fixo; a categoria do QPS é
 * sugerida pelo nome e o Admin confirma.
 */
export default function AbaFatores({
  idGrupo,
  ignorados,
  linhas,
  fatores,
  depara,
  podeEditar,
  ehAdmin,
}: {
  idGrupo: string;
  ignorados: string[];
  linhas: LinhaFonte[];
  fatores: PsicoFator[];
  depara: PsicoFatorDepara[];
  podeEditar: boolean;
  ehAdmin: boolean;
}) {
  const salvarIgnorados = useSalvarFatoresIgnorados();
  const salvarDepara = useSalvarFatorDepara();

  const nomes = useMemo(() => {
    const m = new Map<string, { origem: OrigemFonte; nome: string; linhas: number }>();
    for (const l of linhas) {
      const k = `${l.origem}|${l.fatorOriginal}`;
      const x = m.get(k) ?? { origem: l.origem, nome: l.fatorOriginal, linhas: 0 };
      x.linhas++;
      m.set(k, x);
    }
    return [...m.values()]
      .map((x) => {
        const rotulo = x.origem === "AEP" ? ROTULO_AEP.get(x.nome) ?? x.nome : x.nome;
        return { ...x, rotulo, ...resolverFator(x.origem, x.nome, fatores, depara) };
      })
      .sort((a, b) => a.origem.localeCompare(b.origem) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [linhas, fatores, depara]);

  const semFator = nomes.filter((n) => !n.id_fator);
  const nomeFator = new Map(fatores.map((f) => [f.id_fator, f.nome]));

  const alternarFator = (id: string, considerar: boolean) => {
    const novo = considerar ? ignorados.filter((x) => x !== id) : [...ignorados, id];
    salvarIgnorados.mutate({ id_grupo: idGrupo, ignorados: novo });
  };

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Fatores considerados neste grupo</h3>
        <p className="mb-2 text-xs text-gray-500">Desmarcado = o fator não entra na consolidação deste grupo.</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {fatores.map((f) => (
            <li key={f.id_fator}>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={!ignorados.includes(f.id_fator)}
                  disabled={!podeEditar || salvarIgnorados.isPending}
                  onChange={(e) => alternarFator(f.id_fator, e.target.checked)}
                  className="size-3.5"
                />
                <span className="text-gray-400">{f.ordem}.</span> {f.nome}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Fatores encontrados nos documentos</h3>
        {semFator.length > 0 && (
          <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {semFator.length} nome(s) sem fator correspondente — ficam fora da consolidação até alguém escolher o fator
            {ehAdmin ? "." : " (só Admin escolhe)."}
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Nome no documento</th>
                <th className="px-3 py-2">Fator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {nomes.map((n) => (
                <tr key={`${n.origem}|${n.nome}`}>
                  <td className="px-3 py-1.5 text-xs text-gray-500">{n.origem}</td>
                  <td className="px-3 py-1.5 text-gray-800">
                    {n.rotulo}
                    <span className="ml-1 text-[11px] text-gray-400">({n.linhas})</span>
                  </td>
                  <td className="px-3 py-1.5">
                    {n.origem === "QPS" && ehAdmin ? (
                      <select
                        value={n.id_fator ?? ""}
                        disabled={salvarDepara.isPending}
                        onChange={(e) =>
                          salvarDepara.mutate({ origem: "QPS", valor_origem: n.nome, id_fator: e.target.value || null })
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="">— sem fator —</option>
                        {fatores.map((f) => (
                          <option key={f.id_fator} value={f.id_fator}>{f.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={n.id_fator ? "text-gray-800" : "text-amber-700"}>
                        {n.id_fator ? nomeFator.get(n.id_fator) : "sem correspondência"}
                      </span>
                    )}
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px]">
                      {n.como === "sugestao" ? (
                        <span className="text-amber-700"><Sparkles className="inline size-3" /> sugestão</span>
                      ) : n.como ? (
                        <span className="text-green-700"><CheckCircle2 className="inline size-3" /> catálogo</span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
