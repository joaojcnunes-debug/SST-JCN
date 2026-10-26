"use client";

import { X } from "lucide-react";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import { PRIORIDADES, type CondicaoAutomacao, type GestaoEtiqueta, type ModeloTarefa } from "@/lib/hooks/useGestao";

// v299 (Pacote B): configuração dos gatilhos que rodam no relógio (a cada 10 min) — agenda, tarefa
// parada/SLA e data de início — e o modelo de tarefa usado quando a agenda CRIA uma tarefa (o mesmo
// modelo serve aos gatilhos do SST, v300).

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none";
const DIAS = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["7", "Dom"]] as const;

export function AgendaEditor({
  condicao, onChange, disabled,
}: {
  condicao: CondicaoAutomacao;
  onChange: (patch: Partial<CondicaoAutomacao>) => void;
  disabled: boolean;
}) {
  const ag = condicao.agenda ?? {};
  const setAg = (p: Partial<NonNullable<CondicaoAutomacao["agenda"]>>) => onChange({ agenda: { ...ag, ...p } });
  const dias = ag.dias_semana ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select value={ag.freq ?? ""} disabled={disabled} onChange={(e) => setAg({ freq: (e.target.value || undefined) as never })} className={sel}>
        <option value="">frequência…</option>
        <option value="diaria">todo dia</option>
        <option value="dias_uteis">todo dia útil (seg–sex)</option>
        <option value="semanal">nos dias da semana…</option>
        <option value="mensal">todo mês, no dia…</option>
      </select>
      {ag.freq === "semanal" && (
        <span className="inline-flex flex-wrap gap-1">
          {DIAS.map(([v, r]) => {
            const n = Number(v);
            const on = dias.includes(n);
            return (
              <button key={v} type="button" disabled={disabled}
                onClick={() => setAg({ dias_semana: on ? dias.filter((d) => d !== n) : [...dias, n].sort() })}
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${on ? "bg-verde-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {r}
              </button>
            );
          })}
        </span>
      )}
      {ag.freq === "mensal" && (
        <select value={ag.dia_mes ?? ""} disabled={disabled} onChange={(e) => setAg({ dia_mes: e.target.value || undefined })} className={sel}>
          <option value="">dia…</option>
          {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => <option key={d} value={d}>{d}</option>)}
          <option value="ultimo">último dia</option>
        </select>
      )}
      <span className="text-gray-400">a partir das</span>
      <input type="time" value={ag.hora ?? ""} disabled={disabled} onChange={(e) => setAg({ hora: e.target.value || undefined })} className={sel} />
      <select value={condicao.modo ?? "cada_tarefa"} disabled={disabled} onChange={(e) => onChange({ modo: e.target.value as CondicaoAutomacao["modo"] })} className={sel}>
        <option value="cada_tarefa">agir em cada tarefa do quadro (que casar a condição)</option>
        <option value="criar_tarefa">criar uma tarefa do modelo</option>
      </select>
    </div>
  );
}

export function ModeloTarefaEditor({
  modelo, onChange, etiquetas, usuariosFull, disabled, variaveis,
}: {
  modelo: ModeloTarefa;
  onChange: (m: ModeloTarefa) => void;
  etiquetas: GestaoEtiqueta[];
  usuariosFull: { nome: string; email: string }[];
  disabled: boolean;
  variaveis: string;
}) {
  const set = (p: Partial<ModeloTarefa>) => onChange({ ...modelo, ...p });
  const resp = modelo.responsaveis ?? [];
  const etq = modelo.etiquetas ?? [];
  return (
    <div className="space-y-1.5 rounded-md border border-sky-100 bg-sky-50/40 p-2 text-sm">
      <p className="text-[11px] font-semibold uppercase text-sky-700">Tarefa que será criada</p>
      <input defaultValue={modelo.titulo ?? ""} disabled={disabled} onBlur={(e) => set({ titulo: e.target.value.trim() })}
        placeholder={`Título — ex.: Rotina de {data}`} className={`${sel} w-full`} />
      <textarea defaultValue={modelo.descricao ?? ""} disabled={disabled} onBlur={(e) => set({ descricao: e.target.value })} rows={2}
        placeholder="Descrição (opcional)" className={`${sel} w-full`} />
      <div className="flex flex-wrap items-center gap-2">
        <select value={modelo.prioridade ?? "Media"} disabled={disabled} onChange={(e) => set({ prioridade: e.target.value })} className={sel}>
          {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span className="text-gray-400">prazo: hoje +</span>
        <input type="number" defaultValue={modelo.prazo_dias ?? ""} disabled={disabled} onBlur={(e) => set({ prazo_dias: e.target.value.trim() || undefined })} placeholder="dias" className={`${sel} w-20`} />
        <label className="inline-flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" disabled={disabled} checked={modelo.prazo_uteis === "true"} onChange={(e) => set({ prazo_uteis: e.target.checked ? "true" : undefined })} className="size-3.5 rounded accent-verde-primary" /> úteis
        </label>
        <input list="modelo-etiquetas" disabled={disabled} placeholder="+ etiqueta" className={`${sel} w-32`}
          onKeyDown={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            if (e.key === "Enter" && v) { e.preventDefault(); if (!etq.includes(v)) set({ etiquetas: [...etq, v] }); (e.target as HTMLInputElement).value = ""; }
          }} />
        <datalist id="modelo-etiquetas">{etiquetas.map((x) => <option key={x.id} value={x.nome} />)}</datalist>
        {etq.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
            {x}{!disabled && <button type="button" onClick={() => set({ etiquetas: etq.filter((y) => y !== x) })}><X className="size-3" /></button>}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase text-gray-400">Responsáveis</span>
        {resp.map((em) => (
          <span key={em} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-xs font-medium text-verde-primary">
            {em}{!disabled && <button type="button" onClick={() => set({ responsaveis: resp.filter((x) => x !== em) })}><X className="size-3" /></button>}
          </span>
        ))}
        {!disabled && (
          <div className="w-56">
            <UsuarioCombobox usuarios={usuariosFull} value="" placeholder="Adicionar…" className={`${sel} w-full`}
              onChange={(email) => { if (email && !resp.includes(email)) set({ responsaveis: [...resp, email] }); }} />
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-400">Variáveis no título e na descrição: {variaveis}. As ações abaixo (opcionais) rodam na tarefa criada.</p>
    </div>
  );
}

export function ParadaEditor({
  condicao, onChange, disabled,
}: {
  condicao: CondicaoAutomacao;
  onChange: (patch: Partial<CondicaoAutomacao>) => void;
  disabled: boolean;
}) {
  const p = condicao.parada ?? {};
  const setP = (x: Partial<NonNullable<CondicaoAutomacao["parada"]>>) => onChange({ parada: { ...p, ...x } });
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-gray-400">há</span>
      <input type="number" min={1} defaultValue={p.quantidade ?? ""} disabled={disabled} onBlur={(e) => setP({ quantidade: e.target.value.trim() || undefined })} className={`${sel} w-20`} />
      <select value={p.unidade ?? "dias"} disabled={disabled} onChange={(e) => setP({ unidade: e.target.value as "horas" | "dias" })} className={sel}>
        <option value="dias">dias</option>
        <option value="horas">horas</option>
      </select>
      <select value={p.base ?? "atualizacao"} disabled={disabled} onChange={(e) => setP({ base: e.target.value as "atualizacao" | "status" })} className={sel}>
        <option value="atualizacao">sem nenhuma atividade</option>
        <option value="status">no mesmo status (SLA)</option>
      </select>
    </span>
  );
}
