"use client";

// Faixa do editor da AEP (2026-10-05): diz se a AEP já está na Sinalização
// Psicossocial e, se não, o que falta. A AEP só aparece lá quando está numa
// inspeção cujo documento o associado concluiu (entregue ao cliente).

import Link from "next/link";
import { CheckCircle2, Clock, Info } from "lucide-react";
import { useSituacaoSinalizacaoAep } from "@/lib/hooks/useAep";
import { fmtData } from "@/lib/utils";

export default function SituacaoSinalizacaoAep({ idRelatorio }: { idRelatorio: string }) {
  const { data } = useSituacaoSinalizacaoAep(idRelatorio);
  if (!data) return null;

  if (!data.idInspecao) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Esta AEP não está registrada em nenhuma inspeção, por isso <strong>não aparece na Sinalização Psicossocial</strong>.
          Novas AEPs são criadas já registradas numa inspeção.
        </span>
      </div>
    );
  }

  const link = (
    <Link href={`/inspecoes/${data.idInspecao}`} className="font-semibold underline">
      {data.idInspecao}
    </Link>
  );

  if (data.entregue) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>Na Sinalização Psicossocial</strong>
          {data.entregueEm ? ` desde ${fmtData(data.entregueEm)}` : ""}: o documento da inspeção {link} foi entregue
          ao cliente.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
      <Clock className="mt-0.5 size-4 shrink-0" />
      <span>
        Registrada na inspeção {link}. Aparece na <strong>Sinalização Psicossocial</strong> quando o documento dessa
        inspeção for concluído pelo associado (entregue ao cliente).
      </span>
    </div>
  );
}
