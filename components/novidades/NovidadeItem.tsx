"use client";

import { CircleAlert, MapPin, TriangleAlert, Sparkles, Wrench } from "lucide-react";
import { COR_TIPO, ROTULO_TIPO, type ItemNovidade, type TipoNovidade } from "@/lib/novidades/tipos";
import { cn } from "@/lib/utils";

/**
 * Uma novidade, desenhada uma vez so.
 *
 * O modal e a aba de Atualizacoes usam este mesmo componente. Sao dois lugares
 * mostrando a mesma coisa, e a licao do AET (a previa e o PDF desenhando o
 * mesmo capitulo em dois arquivos, que divergiram quatro vezes) e que dois
 * desenhos da mesma coisa divergem -- nao "podem divergir", divergem.
 */

const ICONE: Record<TipoNovidade, typeof Sparkles> = {
  novidade: Sparkles,
  melhoria: Wrench,
  correcao: CircleAlert,
  atencao: TriangleAlert,
};

/** "2026-09-01" → "1 de setembro". Sem `new Date(iso)`: em fuso negativo ele
 *  volta o dia anterior, e a novidade apareceria datada de ontem. */
function dataPorExtenso(iso: string): string {
  const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const [, mes, dia] = iso.split("-");
  const m = MESES[Number(mes) - 1];
  if (!m || !dia) return iso;
  return `${Number(dia)} de ${m}`;
}

export default function NovidadeItem({
  item,
  compacto = false,
}: {
  item: ItemNovidade;
  /** No modal o espaço é curto: esconde a versão e aperta o respiro. */
  compacto?: boolean;
}) {
  const Icone = ICONE[item.tipo];

  return (
    <article
      className={cn(
        "rounded-lg border border-gray-200 bg-white",
        compacto ? "p-3.5" : "p-4",
        item.destaque && "ring-1 ring-blue-600/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            COR_TIPO[item.tipo],
          )}
        >
          <Icone className="size-3" />
          {ROTULO_TIPO[item.tipo]}
        </span>
        <span className="text-xs text-gray-500">{dataPorExtenso(item.data)}</span>
        {!compacto && item.versoes?.length ? (
          <span className="text-xs text-gray-400">
            v{item.versoes.join(", v")}
          </span>
        ) : null}
      </div>

      <h3 className={cn("mt-2 font-semibold text-gray-900", compacto ? "text-sm" : "text-[15px]")}>
        {item.titulo}
      </h3>

      <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.texto}</p>

      {item.onde && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin className="size-3.5 shrink-0" />
          {item.onde}
        </p>
      )}

      {item.impacto && (
        <p className="mt-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs leading-relaxed text-gray-600">
          {item.impacto}
        </p>
      )}
    </article>
  );
}
