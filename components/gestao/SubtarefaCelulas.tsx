"use client";

// Células editáveis da lista de subtarefas (11/11/2026): "editar os itens sem precisar abrir a subtarefa".
// Cada uma guarda o que a pessoa está digitando e só grava ao sair do campo (ou Enter); Esc desfaz sem fechar a janela.
// Assim a data digitada aos poucos (2-0-2-6) não vira uma gravação por tecla.

import { useState, type KeyboardEvent } from "react";
import { PRIORIDADES, type GestaoStatus } from "@/lib/hooks/useGestao";

const fmtDia = (iso: string) => iso.split("-").reverse().join("/");

/** Enter grava (sai do campo); Esc volta ao valor gravado — o preventDefault impede a janela da tarefa de fechar. */
function teclas(e: KeyboardEvent<HTMLInputElement>, desfazer: () => void) {
  if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
  if (e.key === "Escape") { e.preventDefault(); desfazer(); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()); }
}

const caixaLinha =
  "rounded border border-transparent bg-transparent px-1.5 py-1 text-xs tabular-nums hover:border-gray-200 focus:border-marca-primary focus:bg-white focus:outline-none disabled:hover:border-transparent";

export function TituloSubtarefa({ valor, feito, ro, onSalvar, rotulo }: {
  valor: string;
  feito: boolean;
  ro: boolean;
  onSalvar: (texto: string) => void;
  rotulo: string;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  function gravar() {
    if (rascunho === null) return;
    const t = rascunho.trim();
    setRascunho(null);
    if (t && t !== valor) onSalvar(t);   // vazio volta ao título gravado
  }
  return (
    <input
      value={rascunho ?? valor}
      disabled={ro}
      aria-label={rotulo}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={gravar}
      onKeyDown={(e) => teclas(e, () => setRascunho(null))}
      className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-gray-200 focus:border-marca-primary focus:outline-none ${feito ? "text-gray-400 line-through" : "text-gray-700"}`}
    />
  );
}

/** Status da janela da subtarefa, entre os status do quadro da tarefa (o mesmo campo "Status" da janela). */
export function StatusSubtarefa({ valor, statuses, ro, onMudar, rotulo }: {
  valor: string | null;
  statuses: GestaoStatus[];
  ro: boolean;
  onMudar: (slug: string) => void;
  rotulo: string;
}) {
  const st = statuses.find((s) => s.slug === valor);
  if (ro || !statuses.length) {
    if (!st) return <span className="text-gray-300">—</span>;
    return (
      <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${st.tipo === "concluido" ? "bg-green-600 text-white" : "border border-gray-300 bg-gray-100 text-gray-700"}`}>
        {st.nome}
      </span>
    );
  }
  return (
    // Duplo clique na linha abre a janela da subtarefa; aqui dentro é para escolher, não para abrir.
    <div className="flex items-center gap-1.5" onDoubleClick={(e) => e.stopPropagation()}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: st?.cor ?? "#94a3b8" }} aria-hidden />
      <select
        value={valor ?? ""}
        onChange={(e) => { if (e.target.value && e.target.value !== valor) onMudar(e.target.value); }}
        aria-label={rotulo}
        className="max-w-[11rem] rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700 focus:border-marca-primary focus:outline-none"
      >
        {!st && <option value="">—</option>}
        {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
      </select>
    </div>
  );
}

/** Data + hora (opcional) num lugar só da linha: Início (data_inicio/hora_inicio) ou Entrega (prazo/hora_fim). */
export function DataSubtarefa({ data, hora, ro, atrasada = false, onSalvar, rotulo }: {
  data: string;
  hora: string;
  ro: boolean;
  atrasada?: boolean;
  /** Grava; devolve false quando não gravou (aviso de data inválida ou erro), para a célula voltar ao valor de antes. */
  onSalvar: (data: string, hora: string) => Promise<boolean> | boolean;
  /** "Início" / "Entrega" + título da subtarefa, para a leitura de tela. */
  rotulo: string;
}) {
  const [dia, setDia] = useState<string | null>(null);
  const [hr, setHr] = useState<string | null>(null);
  // O que acabou de ser gravado fica na tela até a lista voltar do banco com o valor novo (a linha que ainda não tinha
  // janela só ganha a data depois da releitura). Vale enquanto data/hora recebidas forem as de antes de gravar.
  const [gravado, setGravado] = useState<{ data: string; hora: string; antes: string } | null>(null);
  const cor = atrasada ? "font-medium text-red-700" : "text-gray-700";

  if (ro) {
    if (!data) return <span className="text-gray-300">—</span>;
    return <span className={`whitespace-nowrap text-xs tabular-nums ${cor}`}>{fmtDia(data)}{hora ? ` ${hora}` : ""}</span>;
  }

  const pendente = gravado && gravado.antes === `${data}|${hora}` ? gravado : null;
  const base = pendente ?? { data, hora };
  function salvar(d: string, h: string) {
    const marca = { data: d, hora: h, antes: `${data}|${hora}` };
    setGravado(marca);
    void Promise.resolve(onSalvar(d, h)).then((ok) => { if (!ok) setGravado((g) => (g === marca ? null : g)); });
  }

  const diaAtual = dia ?? base.data;
  return (
    <div className="flex items-center gap-0.5" onDoubleClick={(e) => e.stopPropagation()}>
      <input
        type="date"
        value={diaAtual}
        aria-label={`${rotulo}: data`}
        onChange={(e) => setDia(e.target.value)}
        onBlur={() => {
          if (dia === null) return;
          const d = dia;
          setDia(null);
          // Sem data a hora não fica sozinha (como o "Limpar" da janela).
          if (d !== base.data) salvar(d, d ? base.hora : "");
        }}
        onKeyDown={(e) => teclas(e, () => setDia(null))}
        className={`${caixaLinha} w-[8.25rem] ${cor}`}
      />
      <input
        type="time"
        value={hr ?? base.hora}
        disabled={!diaAtual}
        title={diaAtual ? undefined : "Escolha a data primeiro"}
        aria-label={`${rotulo}: hora`}
        onChange={(e) => setHr(e.target.value)}
        onBlur={() => {
          if (hr === null) return;
          const h = hr;
          setHr(null);
          if (h !== base.hora) salvar(base.data, h);
        }}
        onKeyDown={(e) => teclas(e, () => setHr(null))}
        className={`${caixaLinha} w-[5.5rem] ${cor} disabled:opacity-40`}
      />
    </div>
  );
}

/** Prioridade da janela da subtarefa (Baixa, Média, Alta, Urgente). Sem janela ainda: "—" até alguém escolher. */
export function PrioridadeSubtarefa({ valor, ro, onMudar, rotulo }: {
  valor: string | null;
  ro: boolean;
  onMudar: (prioridade: string) => void;
  rotulo: string;
}) {
  const p = PRIORIDADES.find((x) => x.value === valor);
  if (ro) {
    if (!p) return <span className="text-gray-300">—</span>;
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-700">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.cor }} aria-hidden />
        {p.label}
      </span>
    );
  }
  return (
    // Duplo clique na linha abre a janela da subtarefa; aqui dentro é para escolher, não para abrir.
    <div className="flex items-center gap-1.5" onDoubleClick={(e) => e.stopPropagation()}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p?.cor ?? "#cbd5e1" }} aria-hidden />
      <select
        value={valor ?? ""}
        onChange={(e) => { if (e.target.value && e.target.value !== valor) onMudar(e.target.value); }}
        aria-label={rotulo}
        className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700 focus:border-marca-primary focus:outline-none"
      >
        {!p && <option value="">—</option>}
        {PRIORIDADES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
      </select>
    </div>
  );
}
