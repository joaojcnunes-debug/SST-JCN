"use client";

import { useMemo, useState } from "react";
import { Loader2, CalendarSearch, UserX, CheckCircle2, CalendarDays, CalendarClock } from "lucide-react";
import { useGGSubstituicoes, useGGSubsSalvas, chaveSlot, rotuloTipoAusencia, type GGSubstituicaoRow } from "@/lib/hooks/useGestaoGerencial";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import ProjecaoMensal from "@/components/gestao-gerencial/ProjecaoMensal";
import SlotSubstitutos from "@/components/gestao-gerencial/SlotSubstitutos";

const hoje = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const fmtLongo = (iso: string) => {
  if (!iso) return "";
  const [y, m, dia] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, dia);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
};

interface Grupo {
  chave: string;
  id_ausente: string;
  id_turno: string;
  turno_nome: string;
  categoria_nome: string | null;
  ausente_nome: string;
  tipo_ausencia: string;
  substitutos: { id: string; nome: string }[];
}

function agrupar(rows: GGSubstituicaoRow[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const r of rows) {
    const chave = `${r.id_ausente}|${r.id_turno}`;
    let g = map.get(chave);
    if (!g) {
      g = { chave, id_ausente: r.id_ausente, id_turno: r.id_turno, turno_nome: r.turno_nome, categoria_nome: r.categoria_nome, ausente_nome: r.ausente_nome, tipo_ausencia: r.tipo_ausencia, substitutos: [] };
      map.set(chave, g);
    }
    if (r.id_substituto && r.substituto_nome) g.substitutos.push({ id: r.id_substituto, nome: r.substituto_nome });
  }
  return Array.from(map.values());
}

/** Aba de substituições: alterna entre verificação por dia e projeção do mês inteiro. */
export default function SubstituicoesTab({ idUnidade }: { idUnidade: string }) {
  const [modo, setModo] = useState<"dia" | "mes">("dia");
  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setModo("dia")}
          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium ${modo === "dia" ? "bg-verde-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <CalendarDays className="size-3.5" /> Por dia
        </button>
        <button
          type="button"
          onClick={() => setModo("mes")}
          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium ${modo === "mes" ? "bg-verde-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <CalendarClock className="size-3.5" /> Projeção mensal
        </button>
      </div>
      {modo === "dia" ? <VisaoDiaria idUnidade={idUnidade} /> : <ProjecaoMensal idUnidade={idUnidade} />}
    </section>
  );
}

/**
 * Verificação de substituição: escolhida uma DATA, mostra quem está ausente naquele
 * dia (por turno) e sugere substitutos da mesma unidade/categoria, ativos e sem conflito.
 */
function VisaoDiaria({ idUnidade }: { idUnidade: string }) {
  const podeEditar = useCanEdit();
  const [data, setData] = useState<string>(hoje());
  const q = useGGSubstituicoes(idUnidade, data);
  const grupos = useMemo(() => agrupar(q.data ?? []), [q.data]);
  const salvas = useGGSubsSalvas(idUnidade, data, data);
  const escolhidos = useMemo(() => {
    const m = new Map<string, { id: string; nome: string | null }>();
    for (const s of salvas.data ?? []) m.set(chaveSlot(s.data, s.id_turno, s.id_ausente), { id: s.id_substituto, nome: s.substituto?.nome ?? null });
    return m;
  }, [salvas.data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Data:</label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
        {data && <span className="text-sm capitalize text-gray-500">{fmtLongo(data)}</span>}
        {q.isFetching && <Loader2 className="size-4 animate-spin text-verde-primary" />}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-gray-500">Verificando…</p>
      ) : grupos.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="size-5 shrink-0" />
          Ninguém precisa de substituição nesta data — a escala está coberta.
        </div>
      ) : (
        <ul className="space-y-3">
          {grupos.map((g) => (
            <li key={g.chave} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-alert">
                  <UserX className="size-3.5" /> {g.ausente_nome}
                </span>
                <span className="text-xs text-gray-500">
                  {g.turno_nome}{g.categoria_nome ? ` · ${g.categoria_nome}` : ""}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.tipo_ausencia === "in_loco" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                  {rotuloTipoAusencia(g.tipo_ausencia)}
                </span>
              </div>

              <SlotSubstitutos
                idUnidade={idUnidade}
                data={data}
                idTurno={g.id_turno}
                idAusente={g.id_ausente}
                sugeridos={g.substitutos}
                chosen={escolhidos.get(chaveSlot(data, g.id_turno, g.id_ausente)) ?? null}
                podeEditar={podeEditar}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <CalendarSearch className="mt-0.5 size-3.5 shrink-0" />
        A sugestão considera a escala padrão daquele dia da semana e as ausências registradas. Um substituto só aparece se
        for da mesma unidade e categoria, estiver ativo e não estiver escalado no mesmo turno (em qualquer unidade).
      </p>
    </section>
  );
}
