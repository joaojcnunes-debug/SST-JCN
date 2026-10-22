"use client";

import { AlertTriangle, Building2, EyeOff, FileText } from "lucide-react";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";
import type { FontesDoGrupo } from "@/lib/psico-consolidacao/carregar-grupo";
import type { MembroGrupo, PapelEconomico } from "@/lib/supabase/types";
import { usePapeisEconomicos, useSalvarPapelEconomico } from "@/lib/hooks/usePsicoConsolidacao";

const PAPEIS: Array<{ value: PapelEconomico; label: string }> = [
  { value: "SPE", label: "SPE (empreendimento)" },
  { value: "EXECUTORA", label: "Executora" },
  { value: "INCORPORADORA", label: "Incorporadora" },
  { value: "OUTRA", label: "Outra" },
];

const COR_ORIGEM: Record<string, string> = {
  AEP: "bg-sky-100 text-sky-800",
  DRPS: "bg-violet-100 text-violet-800",
  QPS: "bg-fuchsia-100 text-fuchsia-800",
};

/**
 * Empresas do grupo e os documentos achados de cada uma (AEP concluída, DRPS/QPS
 * concluído). O técnico marca quais entram; por padrão, o mais recente de cada tipo.
 */
export default function AbaFontes({
  membros,
  fontes,
  escolhidos,
  onAlternar,
  podeEditar,
}: {
  membros: MembroGrupo[];
  fontes: FontesDoGrupo;
  escolhidos: Set<string>;
  onAlternar: (idDocumento: string) => void;
  podeEditar: boolean;
}) {
  const visiveis = membros.filter((m) => m.visivel);
  const { data: papeis } = usePapeisEconomicos(visiveis.map((m) => m.id_empresa));
  const salvarPapel = useSalvarPapelEconomico();
  const empresaPorId = new Map(fontes.empresas.map((e) => [e.idEmpresa, e]));

  return (
    <div className="space-y-3">
      {membros.some((m) => !m.visivel) && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" />
          Há empresas do grupo em unidades que você não acessa — os documentos delas não entram
          nesta consolidação. Peça a alguém com acesso às duas unidades.
        </p>
      )}

      <ul className="space-y-2">
        {membros.map((m) => {
          const docs = fontes.documentos.filter((d) => d.idEmpresa === m.id_empresa);
          const e = empresaPorId.get(m.id_empresa);
          const local = [e?.municipio, e?.uf].filter(Boolean).join("/");
          return (
            <li key={m.id_empresa} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Building2 className="size-4 shrink-0 text-gray-400" />
                    <span className="truncate">{m.nome_empresa}</span>
                    {m.papel_grupo === "MATRIZ" && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">MATRIZ</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {m.cnpj ? formatCNPJ(m.cnpj) : "sem CNPJ"}
                    {local && ` · ${local}`}
                    {m.unidade_nome && ` · ${m.unidade_nome}`}
                  </p>
                </div>
                {m.visivel ? (
                  <select
                    value={papeis?.get(m.id_empresa) ?? ""}
                    disabled={!podeEditar || salvarPapel.isPending}
                    onChange={(ev) =>
                      salvarPapel.mutate({
                        id_empresa: m.id_empresa,
                        papel: (ev.target.value || null) as PapelEconomico | null,
                      })
                    }
                    aria-label="Papel no grupo econômico"
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-60"
                  >
                    <option value="">Papel no grupo…</option>
                    {PAPEIS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-400">outra unidade — sem acesso</span>
                )}
              </div>

              {m.visivel && (
                docs.length === 0 ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="size-3.5" />
                    Nenhuma AEP concluída nem DRPS/QPS concluído.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={escolhidos.has(d.id)}
                            onChange={() => onAlternar(d.id)}
                            className="size-3.5 rounded border-gray-300 text-verde-primary"
                          />
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", COR_ORIGEM[d.origem])}>
                            {d.origem}
                          </span>
                          <FileText className="size-3.5 text-gray-400" />
                          <span className="text-gray-800">{d.titulo}</span>
                          <span className="text-gray-500">
                            {d.data ? fmtData(d.data) : "sem data"} · {d.setores} setor(es)
                            {d.responsavel && ` · ${d.responsavel}`}
                            {d.necessitaAet && " · indica AET"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
