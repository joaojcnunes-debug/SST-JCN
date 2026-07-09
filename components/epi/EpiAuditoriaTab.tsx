"use client";

import { useMemo, useState } from "react";
import { Download, ShieldCheck, Fingerprint, PenLine } from "lucide-react";
import { inputCls, labelCls } from "./EpiModal";
import {
  useEpiAuditoriaAssinaturas,
  type EpiAuditoriaAssinatura,
} from "@/lib/hooks/useEpi";
import { fmtDataHora, fmtData } from "@/lib/utils";

/**
 * Trilha de auditoria das assinaturas de entrega (só contexto interno).
 * Atende à NT 162/2017 (extração de relatório para fiscalização): lista todas
 * as evidências e exporta em CSV. Somente leitura.
 */
export default function EpiAuditoriaTab({ empresaId }: { empresaId: string }) {
  const { data: linhas = [], isLoading } = useEpiAuditoriaAssinaturas(empresaId);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      const dia = (l.assinado_em ?? "").slice(0, 10);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      return true;
    });
  }, [linhas, de, ate]);

  function exportarCsv() {
    const headers = [
      "Data/hora assinatura",
      "Assinante",
      "Data da entrega",
      "Método",
      "Hash do documento (SHA-256)",
      "Hash biométrico (SHA-256)",
      "Dispositivo",
      "Qualidade",
      "IP",
      "Consentimento em",
      "User-Agent",
      "ID assinatura",
      "ID entrega",
    ];
    const esc = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linha = (l: EpiAuditoriaAssinatura) =>
      [
        fmtDataHora(l.assinado_em),
        l.assinante_nome,
        l.entrega?.data_entrega ? fmtData(l.entrega.data_entrega) : "",
        l.metodo === "digital" ? "Biométrica (digital)" : "Desenhada",
        l.pdf_sha256,
        l.finger_hash,
        l.device_info,
        l.qualidade,
        l.ip,
        l.consentimento_em ? fmtDataHora(l.consentimento_em) : "",
        l.user_agent,
        l.id,
        l.id_entrega,
      ]
        .map(esc)
        .join(";");

    // BOM (﻿) para o Excel abrir com acentuação correta; separador ";".
    const csv = "﻿" + [headers.map(esc).join(";"), ...filtradas.map(linha)].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-assinaturas-epi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>De</label>
            <input
              type="date"
              className={inputCls}
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Até</label>
            <input
              type="date"
              className={inputCls}
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <span className="pb-2 text-xs text-gray-500">
            {filtradas.length} de {linhas.length} assinatura(s)
          </span>
        </div>
        <button
          type="button"
          onClick={exportarCsv}
          disabled={filtradas.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          <Download className="size-4" /> Exportar CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <ShieldCheck className="size-3.5 text-verde-primary" /> Trilha de
          assinaturas (auditoria)
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Nenhuma assinatura no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Data/hora</th>
                  <th className="px-3 py-2 font-semibold">Assinante</th>
                  <th className="px-3 py-2 font-semibold">Método</th>
                  <th className="px-3 py-2 font-semibold">Hash doc.</th>
                  <th className="px-3 py-2 font-semibold">Hash bio.</th>
                  <th className="px-3 py-2 font-semibold">IP</th>
                  <th className="px-3 py-2 font-semibold">Consent.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtradas.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                      {fmtDataHora(l.assinado_em)}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {l.assinante_nome ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          l.metodo === "digital"
                            ? "bg-sky-50 text-verde-accent"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {l.metodo === "digital" ? (
                          <>
                            <Fingerprint className="size-3" /> Digital
                          </>
                        ) : (
                          <>
                            <PenLine className="size-3" /> Desenho
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-500">
                      {l.pdf_sha256 ? l.pdf_sha256.slice(0, 12) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-500">
                      {l.finger_hash ? l.finger_hash.slice(0, 12) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">
                      {l.ip ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">
                      {l.consentimento_em ? "✓" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          A trilha é imutável (append-only). O CSV inclui os hashes completos,
          dispositivo e user-agent para fiscalização.
        </div>
      </div>
    </div>
  );
}
