"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Database, Search, ArrowLeft, AlertTriangle, Skull } from "lucide-react";
import {
  BASE_REFERENCIA,
  type AgenteReferencia,
  type AnexoNR15,
} from "@/lib/quimicos/base_referencia";

const ANEXOS: Array<{ value: "todos" | AnexoNR15; label: string }> = [
  { value: "todos", label: "Todos os anexos" },
  { value: "Anexo 11", label: "Anexo 11" },
  { value: "Anexo 12", label: "Anexo 12" },
  { value: "Anexo 13", label: "Anexo 13" },
  { value: "Anexo 13-A", label: "Anexo 13-A (cancerígenos)" },
];

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function GrauBadge({ grau }: { grau: AgenteReferencia["grau_nr15"] }) {
  if (!grau) return <span className="text-gray-400">—</span>;
  const cores: Record<string, string> = {
    Máximo: "bg-red-100 text-red-700",
    Médio: "bg-orange-100 text-orange-700",
    Mínimo: "bg-yellow-100 text-yellow-800",
    "Asfixiante simples": "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
        cores[grau] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {grau}
    </span>
  );
}

export default function BaseReferenciaPage() {
  const [q, setQ] = useState("");
  const [anexo, setAnexo] = useState<"todos" | AnexoNR15>("todos");
  const [soCancerigeno, setSoCancerigeno] = useState(false);
  const [soPele, setSoPele] = useState(false);

  const itens = useMemo(() => BASE_REFERENCIA.filter((a) => !a.is_alias), []);

  const filtrados = useMemo(() => {
    const termo = normalizar(q);
    return itens.filter((a) => {
      if (anexo !== "todos" && a.anexo !== anexo) return false;
      if (soCancerigeno && !(a.cancerigeno_13a || a.iarc === "Grupo 1" || a.iarc === "Grupo 2A")) {
        return false;
      }
      if (soPele && !a.pele) return false;
      if (!termo) return true;
      return (
        normalizar(a.agente).includes(termo) ||
        (a.cas ?? "").toLowerCase().includes(termo) ||
        (a.esocial_tab24 ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, q, anexo, soCancerigeno, soPele]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/analise-quimicos"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Database className="size-5 text-sky-500" />
          Base de Referência Chabra — Químicos NR-15
        </h1>
        <p className="text-sm text-gray-600">
          {itens.length} agentes catalogados · NR-15 (Anexos 11, 12, 13, 13-A) +
          ACGIH + IARC + eSocial Tab.24 + Decreto 3.048 Anexo IV
        </p>
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CAS ou código eSocial..."
            className="w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
          />
        </div>
        <select
          value={anexo}
          onChange={(e) => setAnexo(e.target.value as "todos" | AnexoNR15)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
        >
          {ANEXOS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <label className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={soCancerigeno}
            onChange={(e) => setSoCancerigeno(e.target.checked)}
            className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
          />
          Cancerígenos
        </label>
        <label className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={soPele}
            onChange={(e) => setSoPele(e.target.checked)}
            className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
          />
          Absorção pele
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Mostrando {filtrados.length} de {itens.length}
      </p>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          Nenhum agente encontrado com esses filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Agente</th>
                <th className="px-3 py-2 text-left font-semibold">CAS</th>
                <th className="px-3 py-2 text-left font-semibold">
                  LT (mg/m³ · ppm)
                </th>
                <th className="px-3 py-2 text-left font-semibold">Grau</th>
                <th className="px-3 py-2 text-left font-semibold">Anexo</th>
                <th className="px-3 py-2 text-left font-semibold">eSocial</th>
                <th className="px-3 py-2 text-left font-semibold">IARC</th>
                <th className="px-3 py-2 text-left font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((a, idx) => (
                <tr key={`${a.agente}-${a.cas ?? idx}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {a.agente}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.cas ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.lt_mg_m3 != null || a.lt_ppm != null ? (
                      <>
                        {a.lt_mg_m3 ?? "—"}
                        {" · "}
                        {a.lt_ppm ?? "—"}
                        {a.teto && (
                          <span className="ml-1 rounded bg-gray-200 px-1 text-[10px] font-bold">
                            TETO
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <GrauBadge grau={a.grau_nr15} />
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.anexo ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">
                    {a.esocial_tab24 ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {a.iarc ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {a.cancerigeno_13a && (
                        <span
                          title="Cancerígeno NR-15 Anexo 13-A"
                          className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                        >
                          <Skull className="size-3" /> CANC
                        </span>
                      )}
                      {a.pele && (
                        <span
                          title="Absorvido por pele"
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                        >
                          PELE
                        </span>
                      )}
                      {a.inflamavel && (
                        <span
                          title="Inflamável"
                          className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700"
                        >
                          <AlertTriangle className="size-3" /> INFL
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Dados de referência para análise NR-15. Esta tabela é consultada
        automaticamente quando você cria uma nova análise — se o CAS ou nome do
        produto bater com algum agente aqui, os valores oficiais são usados sem
        precisar de IA.
      </p>
    </div>
  );
}
