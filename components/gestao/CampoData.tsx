"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { atalhosData, isoLocal, rotuloData } from "@/lib/gestao/datas-rapidas";

const fmt = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Data da tarefa num campo só (item 3 da comparação, como no ClickUp/Notion): mostra "12/11/2026 (amanhã) · 14:00"
 * e, ao clicar, abre os atalhos (Hoje, Amanhã, +3 dias, Próx. semana), o calendário e a hora opcional.
 * Continua gravando nas mesmas colunas (data + hora separadas); o "Salvar" da janela é que grava.
 */
export default function CampoData({ data, hora, onChange, min, max, ro, rotulo, atrasada = false, abrirAoMontar = false, caixaCls }: {
  data: string;
  hora: string;
  onChange: (data: string, hora: string) => void;
  min?: string;
  max?: string;
  ro: boolean;
  /** "Início" / "Término": nos avisos e na leitura de tela. */
  rotulo: string;
  /** Término vencido e a tarefa não está concluída: fica em vermelho. */
  atrasada?: boolean;
  /** Veio do "Adicionar": já abre escolhendo. */
  abrirAoMontar?: boolean;
  caixaCls: string;
}) {
  const [aberto, setAberto] = useState(abrirAoMontar);
  const [pedirHora, setPedirHora] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoje = isoLocal(new Date());
  const mostrarHora = pedirHora || !!hora;

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function atalho(d: string) {
    if (min && d < min) { toast.error(`${rotulo}: escolha a partir de ${fmt(min)}.`); return; }
    if (max && d > max) { toast.error(`${rotulo}: escolha até ${fmt(max)}.`); return; }
    onChange(d, hora);
  }

  const resumo = `${data ? rotuloData(data, hoje) : "Sem data"}${hora ? ` · ${hora}` : ""}`;
  if (ro) return <span className="inline-block py-1.5 text-sm text-gray-800">{resumo}</span>;

  return (
    <div
      ref={wrapRef}
      className="relative"
      // Esc fecha só a caixinha (o preventDefault impede a janela da tarefa de fechar junto).
      onKeyDown={(e) => { if (e.key === "Escape" && aberto) { e.preventDefault(); setAberto(false); } }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${resumo}. Alterar`}
        className={`-ml-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-gray-100 ${atrasada ? "text-red-600" : "text-gray-800"}`}
      >
        {resumo}
        {atrasada && <span className="ml-1.5 rounded bg-red-50 px-1 text-[11px] font-semibold text-red-600">atrasada</span>}
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex flex-wrap gap-1.5">
            {atalhosData(hoje).map((a) => (
              <button
                key={a.rotulo}
                type="button"
                onClick={() => atalho(a.data)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  data === a.data ? "border-marca-primary bg-marca-light text-marca-primary" : "border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <input type="date" value={data} min={min} max={max} onChange={(e) => onChange(e.target.value, hora)} aria-label={`Data (${rotulo})`} className={`${caixaCls} w-full`} />
          {mostrarHora ? (
            <div className="flex items-center gap-2">
              <input type="time" value={hora} onChange={(e) => onChange(data, e.target.value)} aria-label={`Hora (${rotulo})`} className={`${caixaCls} w-32`} />
              <button type="button" onClick={() => { setPedirHora(false); onChange(data, ""); }} className="text-xs text-gray-500 hover:text-red-600">Tirar horário</button>
            </div>
          ) : (
            <button type="button" onClick={() => setPedirHora(true)} className="text-xs font-semibold text-marca-primary hover:underline">+ Adicionar horário</button>
          )}
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <button type="button" onClick={() => { setPedirHora(false); onChange("", ""); setAberto(false); }} className="text-xs text-gray-500 hover:text-red-600">Limpar</button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-md bg-marca-primary px-3 py-1 text-xs font-semibold text-white hover:bg-marca-accent">Pronto</button>
          </div>
        </div>
      )}
    </div>
  );
}
