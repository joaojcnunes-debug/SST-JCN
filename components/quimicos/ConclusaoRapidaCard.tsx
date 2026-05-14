"use client";

import {
  AlertTriangle,
  ShieldCheck,
  Skull,
  Stethoscope,
  Activity,
  HardHat,
  Factory,
  Settings,
  Siren,
  Microscope,
  Ruler,
} from "lucide-react";
import type { ConclusaoRapidaQuimico } from "@/lib/supabase/types";

function badgeColor(val: string | undefined): {
  bg: string;
  color: string;
  border: string;
} {
  const v = (val ?? "").toUpperCase();
  if (v.startsWith("SIM"))
    return { bg: "#dcfce7", color: "#15803d", border: "#86efac" };
  if (v.startsWith("NÃO") || v.startsWith("NAO"))
    return { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" };
  return { bg: "#fef9c3", color: "#854d0e", border: "#fde68a" };
}

/**
 * Converte os tokens-sentinela usados pela IA (ex: "CONSULTAR_TABELA_OFICIAL")
 * em texto legível pro usuário final. Mantém a semântica de "não sei, vai na
 * tabela oficial" mas remove o visual de placeholder técnico.
 */
function humanize(value: string | undefined): string {
  if (!value) return "—";
  return value
    .replace(/CONSULTAR_TABELA_OFICIAL/gi, "Consultar tabela oficial")
    .replace(/CONSULTAR_DECRETO_VIGENTE/gi, "Consultar decreto vigente")
    .replace(/CONSULTAR_TABELA_GFIP/gi, "Consultar tabela GFIP")
    .replace(/\bINCONCLUSIVO\b/g, "Inconclusivo")
    .replace(/\bN\/A\b/g, "N/A");
}

function Badge({ label, value }: { label: string; value: string | undefined }) {
  const c = badgeColor(value);
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider opacity-70"
        style={{ color: c.color }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 break-words text-sm font-semibold leading-tight"
        style={{ color: c.color }}
      >
        {humanize(value)}
      </p>
    </div>
  );
}

function Card({
  icon,
  title,
  content,
  accent = "#0EA5E9",
}: {
  icon: React.ReactNode;
  title: string;
  content: string | undefined;
  accent?: string;
}) {
  if (!content || content.trim().length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className="mb-2 flex items-center gap-2 text-sm font-bold"
        style={{ color: accent }}
      >
        {icon}
        {title}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
        {humanize(content)}
      </p>
    </div>
  );
}

export default function ConclusaoRapidaCard({
  conclusao,
}: {
  conclusao: ConclusaoRapidaQuimico | null;
}) {
  if (!conclusao) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4" />
          Conclusão Rápida não pôde ser extraída
        </div>
        <p className="mt-1">
          A IA não devolveu o bloco estruturado. Consulte o relatório completo abaixo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso anti-alucinação */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">
            Resultado gerado por IA — revisão obrigatória antes de uso oficial
          </p>
          <p className="mt-0.5">
            Códigos eSocial, Decreto 3.048, GFIP e classificações IARC devem
            ser confirmados nas tabelas oficiais vigentes antes de emissão de
            PPP/LTCAT/eSocial S-2240. A IA pode marcar como{" "}
            <em>CONSULTAR_TABELA_OFICIAL</em> quando não tiver certeza.
          </p>
        </div>
      </div>

      {/* Grid de badges */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        <Badge label="Insalubridade NR-15" value={conclusao.insalubridade_nr15} />
        <Badge label="Grau" value={conclusao.insalubridade_grau} />
        <Badge label="Aposentadoria Especial" value={conclusao.aposentadoria_especial} />
        <Badge label="Decreto 3.048" value={conclusao.decreto_3048} />
        <Badge label="Código GFIP" value={conclusao.codigo_gfip} />
        <Badge label="eSocial Tab.24" value={conclusao.esocial_tab24} />
        <Badge label="Carcinogênico" value={conclusao.carcinogenico} />
        <Badge label="Óleo Mineral" value={conclusao.oleo_mineral} />
        <Badge label="Medição Necessária" value={conclusao.medicao_necessaria} />
        <Badge label="Tempo Aposentadoria" value={conclusao.aposentadoria_tempo} />
      </div>

      {/* Fundamentação curta */}
      {conclusao.insalubridade_fundamentacao && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
            Fundamentação (Insalubridade)
          </p>
          <p className="mt-1">{conclusao.insalubridade_fundamentacao}</p>
          {conclusao.insalubridade_anexo && (
            <p className="mt-1 text-xs italic">
              Anexo: {conclusao.insalubridade_anexo}
            </p>
          )}
        </div>
      )}

      {/* Cards expandidos */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card
          icon={<HardHat className="size-4" />}
          title="🧤 EPIs Necessários"
          content={conclusao.epi_necessarios}
          accent="#0EA5E9"
        />
        <Card
          icon={<Factory className="size-4" />}
          title="🏭 EPCs Necessários"
          content={conclusao.epc_necessarios}
          accent="#0EA5E9"
        />
        <Card
          icon={<Settings className="size-4" />}
          title="⚙️ Medidas de Controle"
          content={conclusao.medidas_controle}
          accent="#0EA5E9"
        />
        <Card
          icon={<Siren className="size-4" />}
          title="🚨 Emergência / Acidente"
          content={conclusao.emergencia_acidente}
          accent="#dc2626"
        />
        <Card
          icon={<Microscope className="size-4" />}
          title="🔬 Metodologia"
          content={conclusao.metodologia}
          accent="#0EA5E9"
        />
        <Card
          icon={<Ruler className="size-4" />}
          title="📐 Como Medir"
          content={conclusao.como_medir}
          accent="#0EA5E9"
        />
      </div>
    </div>
  );
}
