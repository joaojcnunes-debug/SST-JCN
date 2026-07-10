"use client";

import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, UserX } from "lucide-react";
import { useGGProjecaoMensal, useGGSubsSalvas, chaveSlot, rotuloTipoAusencia, type GGProjecaoRow } from "@/lib/hooks/useGestaoGerencial";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import SlotSubstitutos from "@/components/gestao-gerencial/SlotSubstitutos";

const mesAtual = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 7); // YYYY-MM
};
const DIAS_CAB = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const fmtDiaLista = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dia = dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

interface Slot {
  chave: string; id_ausente: string; id_turno: string;
  turno_nome: string; categoria_nome: string | null;
  ausente_nome: string; tipo_ausencia: string; substitutos: { id: string; nome: string }[];
}

function agruparPorDia(rows: GGProjecaoRow[]): Map<string, Slot[]> {
  const dias = new Map<string, Map<string, Slot>>();
  for (const r of rows) {
    let sm = dias.get(r.data);
    if (!sm) { sm = new Map(); dias.set(r.data, sm); }
    const chave = `${r.id_ausente}|${r.id_turno}`;
    let s = sm.get(chave);
    if (!s) { s = { chave, id_ausente: r.id_ausente, id_turno: r.id_turno, turno_nome: r.turno_nome, categoria_nome: r.categoria_nome, ausente_nome: r.ausente_nome, tipo_ausencia: r.tipo_ausencia, substitutos: [] }; sm.set(chave, s); }
    if (r.id_substituto && r.substituto_nome) s.substitutos.push({ id: r.id_substituto, nome: r.substituto_nome });
  }
  const out = new Map<string, Slot[]>();
  for (const [d, m] of dias) out.set(d, Array.from(m.values()));
  return out;
}

/** Projeção mensal das substituições: resumo + calendário + lista dos dias com pendência. */
export default function ProjecaoMensal({ idUnidade }: { idUnidade: string }) {
  const [mes, setMes] = useState<string>(mesAtual());
  const [ano, mesNum] = mes.split("-").map(Number);
  const [selDia, setSelDia] = useState<string | null>(null);
  const q = useGGProjecaoMensal(idUnidade, ano, mesNum);
  const porDia = useMemo(() => agruparPorDia(q.data ?? []), [q.data]);
  const podeEditar = useCanEdit();

  // substituições já escolhidas no mês
  const nDiasMes = ano && mesNum ? new Date(ano, mesNum, 0).getDate() : 0;
  const iniMes = ano ? `${ano}-${String(mesNum).padStart(2, "0")}-01` : "";
  const fimMes = ano ? `${ano}-${String(mesNum).padStart(2, "0")}-${String(nDiasMes).padStart(2, "0")}` : "";
  const salvas = useGGSubsSalvas(idUnidade, iniMes, fimMes);
  const escolhidos = useMemo(() => {
    const m = new Map<string, { id: string; nome: string | null }>();
    for (const s of salvas.data ?? []) m.set(chaveSlot(s.data, s.id_turno, s.id_ausente), { id: s.id_substituto, nome: s.substituto?.nome ?? null });
    return m;
  }, [salvas.data]);

  // resumo
  const resumo = useMemo(() => {
    let total = 0, cobertos = 0, sem = 0;
    const porTipo = new Map<string, number>();
    for (const slots of porDia.values()) {
      for (const s of slots) {
        total++;
        if (s.substitutos.length > 0) cobertos++; else sem++;
        porTipo.set(s.tipo_ausencia, (porTipo.get(s.tipo_ausencia) ?? 0) + 1);
      }
    }
    return { total, cobertos, sem, porTipo: Array.from(porTipo.entries()) };
  }, [porDia]);

  // grade do calendário
  const grade = useMemo(() => {
    if (!ano || !mesNum) return { celulas: [] as (number | null)[] };
    const nDias = new Date(ano, mesNum, 0).getDate();
    const js = new Date(ano, mesNum - 1, 1).getDay(); // 0=Dom
    const offset = (js === 0 ? 7 : js) - 1;            // Seg=0
    const celulas: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= nDias; d++) celulas.push(d);
    return { celulas };
  }, [ano, mesNum]);

  const dataStr = (d: number) => `${ano}-${String(mesNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const statusDia = (d: number): "sem" | "coberto" | null => {
    const slots = porDia.get(dataStr(d));
    if (!slots || slots.length === 0) return null;
    return slots.some((s) => s.substitutos.length === 0) ? "sem" : "coberto";
  };

  const diasComPendencia = useMemo(
    () => Array.from(porDia.keys()).sort().filter((d) => !selDia || d === selDia),
    [porDia, selDia],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Mês:</label>
        <input
          type="month"
          value={mes}
          onChange={(e) => { setMes(e.target.value); setSelDia(null); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
        {q.isFetching && <Loader2 className="size-4 animate-spin text-verde-primary" />}
      </div>

      {/* 1) RESUMO */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{resumo.total}</div>
          <div className="text-xs text-gray-500">Slots descobertos</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{resumo.cobertos}</div>
          <div className="text-xs text-emerald-700">Com substituto</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
          <div className="text-2xl font-bold text-red-alert">{resumo.sem}</div>
          <div className="text-xs text-red-alert">Sem substituto</div>
        </div>
      </div>
      {resumo.porTipo.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <span>Por tipo:</span>
          {resumo.porTipo.map(([t, n]) => (
            <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              {rotuloTipoAusencia(t)} · {n}
            </span>
          ))}
        </div>
      )}

      {/* 2) CALENDÁRIO */}
      {q.isLoading ? (
        <p className="text-sm text-gray-500">Carregando projeção…</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400">
            {DIAS_CAB.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grade.celulas.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const st = statusDia(d);
              const iso = dataStr(d);
              const sel = selDia === iso;
              const nSlots = porDia.get(iso)?.length ?? 0;
              const cls =
                st === "sem" ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                : st === "coberto" ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50";
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => st && setSelDia(sel ? null : iso)}
                  disabled={!st}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-md border text-sm transition-colors ${cls} ${sel ? "ring-2 ring-verde-primary" : ""} ${st ? "cursor-pointer" : "cursor-default"}`}
                  title={st === "sem" ? "Há slot sem substituto" : st === "coberto" ? "Coberto por substituto" : "Sem pendência"}
                >
                  {d}
                  {nSlots > 0 && (
                    <span className={`absolute right-1 top-0.5 text-[9px] font-bold ${st === "sem" ? "text-red-alert" : "text-amber-600"}`}>{nSlots}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm border border-red-300 bg-red-50" /> sem substituto</span>
            <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm border border-amber-300 bg-amber-50" /> coberto</span>
            {selDia && <button type="button" onClick={() => setSelDia(null)} className="ml-auto text-verde-primary hover:underline">ver todos os dias</button>}
          </div>
        </div>
      )}

      {/* 3) LISTA */}
      {!q.isLoading && (
        resumo.total === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" /> Nenhuma substituição prevista neste mês — a escala está coberta.
          </div>
        ) : (
          <ul className="space-y-3">
            {diasComPendencia.map((iso) => (
              <li key={iso} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-2 text-sm font-semibold capitalize text-gray-900">{fmtDiaLista(iso)}</div>
                <ul className="space-y-2">
                  {(porDia.get(iso) ?? []).map((s) => (
                    <li key={s.chave} className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-alert">
                          <UserX className="size-3.5" /> {s.ausente_nome}
                        </span>
                        <span className="text-xs text-gray-500">{s.turno_nome}{s.categoria_nome ? ` · ${s.categoria_nome}` : ""}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.tipo_ausencia === "in_loco" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                          {rotuloTipoAusencia(s.tipo_ausencia)}
                        </span>
                      </div>
                      <SlotSubstitutos
                        idUnidade={idUnidade}
                        data={iso}
                        idTurno={s.id_turno}
                        idAusente={s.id_ausente}
                        sugeridos={s.substitutos}
                        chosen={escolhidos.get(chaveSlot(iso, s.id_turno, s.id_ausente)) ?? null}
                        podeEditar={podeEditar}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
