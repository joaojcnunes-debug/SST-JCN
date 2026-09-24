"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscalaFeriados } from "@/lib/hooks/useEscalaFeriados";
import { useEscalaStore } from "@/lib/escala/store";
import { MESES_PT, dataPura, diaSemanaIso, diasNoMes, paraDataLocal } from "@/lib/escala/datas";
import type { EscalaFeriado } from "@/lib/escala/tipos";

/**
 * Calendário anual (Fase 6) — a aba "Calendário" da planilha.
 *
 * Doze meses de uma vez, com os feriados destacados e listados ao lado. Serve
 * para uma coisa que a grade mensal não faz: enxergar o ano inteiro e achar os
 * buracos antes de montar o mês.
 *
 * Clicar num mês leva à grade daquele mês — o calendário é ponto de partida,
 * não destino.
 */

const CABECALHO = ["S", "T", "Q", "Q", "S", "S", "D"];

function corDoFeriado(f: EscalaFeriado): string {
  if (f.abrangencia === "municipal") return "bg-amber-100 text-amber-900 ring-amber-300";
  if (f.tipo === "facultativo") return "bg-slate-200 text-slate-700 ring-slate-300";
  return "bg-red-100 text-red-800 ring-red-300";
}

export default function CalendarioAnual() {
  const anoDaGrade = useEscalaStore((s) => s.ano);
  const irPara = useEscalaStore((s) => s.irPara);
  const router = useRouter();

  const [ano, setAno] = useState(anoDaGrade);
  const { data: feriados = [], isLoading } = useEscalaFeriados(ano);

  const porData = useMemo(() => {
    const m = new Map<string, EscalaFeriado>();
    for (const f of feriados) {
      const atual = m.get(f.data);
      // Se dois feriados caírem no mesmo dia, o de alcance MAIOR manda na cor:
      // um aniversário de cidade não deve esconder um feriado nacional. Escrito
      // como condição, e não como ordenação, porque a regra é essa — ordenar
      // para depois sobrescrever esconde a intenção e depende da estabilidade
      // do sort.
      if (!atual || (atual.abrangencia === "municipal" && f.abrangencia !== "municipal")) {
        m.set(f.data, f);
      }
    }
    return m;
  }, [feriados]);

  function abrirMes(mes: number) {
    irPara(ano, mes);
    router.push("/escala");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAno((a) => a - 1)}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="w-20 text-center text-lg font-bold tabular-nums text-gray-900">
            {ano}
          </span>
          <button
            type="button"
            onClick={() => setAno((a) => a + 1)}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Próximo ano"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-red-100 ring-1 ring-red-300" />
            feriado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-slate-200 ring-1 ring-slate-300" />
            ponto facultativo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-amber-100 ring-1 ring-amber-300" />
            municipal
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando o calendário...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MESES_PT.map((nome, i) => {
            const mes = i + 1;
            const total = diasNoMes(ano, mes);
            const primeiro = diaSemanaIso(dataPura(ano, mes, 1)); // 1 = segunda
            const vazias = primeiro - 1;

            return (
              <div key={nome} className="rounded-lg border border-gray-200 bg-white p-3">
                <button
                  type="button"
                  onClick={() => abrirMes(mes)}
                  className="mb-2 text-sm font-semibold text-gray-900 capitalize hover:text-[#0E7490] hover:underline"
                  title={`Abrir a grade de ${nome} de ${ano}`}
                >
                  {nome}
                </button>

                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {CABECALHO.map((c, idx) => (
                    <span
                      key={`${c}-${idx}`}
                      className={cn(
                        "py-0.5 text-[10px] font-semibold",
                        idx >= 5 ? "text-gray-300" : "text-gray-400"
                      )}
                    >
                      {c}
                    </span>
                  ))}

                  {Array.from({ length: vazias }, (_, k) => (
                    <span key={`v${k}`} />
                  ))}

                  {Array.from({ length: total }, (_, k) => {
                    const dia = k + 1;
                    const data = dataPura(ano, mes, dia);
                    const iso = diaSemanaIso(data);
                    const fds = iso > 5;
                    const f = porData.get(data);

                    return (
                      <span
                        key={dia}
                        title={f ? `${f.descricao}${f.municipio ? ` — ${f.municipio}` : ""}` : undefined}
                        className={cn(
                          "rounded py-0.5 text-[11px] tabular-nums",
                          f
                            ? `font-semibold ring-1 ${corDoFeriado(f)}`
                            : fds
                              ? "text-gray-300"
                              : "text-gray-700"
                        )}
                      >
                        {dia}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── A relação ao lado, como na planilha ──────────── */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Feriados de {ano}{" "}
          <span className="font-normal text-gray-500">({feriados.length})</span>
        </h2>
        {feriados.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            Nenhum feriado cadastrado em {ano}. Use &ldquo;Semear oficiais&rdquo; na aba
            Feriados da Configuração.
          </p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {feriados.map((f) => {
              const d = paraDataLocal(f.data);
              return (
                <li
                  key={f.id_feriado}
                  className="flex items-baseline gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                >
                  <span className="shrink-0 font-mono tabular-nums text-gray-500">
                    {String(d.getDate()).padStart(2, "0")}/
                    {String(d.getMonth() + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-800" title={f.descricao}>
                    {f.descricao}
                  </span>
                  {f.municipio && (
                    <span className="shrink-0 text-[10px] text-amber-700">{f.municipio}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
