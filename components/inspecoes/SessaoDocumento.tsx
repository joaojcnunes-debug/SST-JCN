"use client";

// Apontamento de tempo do documento (v311, 30/10/2026): Iniciar/Retomar, o cronômetro da minha
// sessão, Pausar com motivo e os totais (trabalhado, aguardando cliente, por pessoa).
// Usado em Minhas inspeções (compacto) e no card "Documento (SGG)" do relatório.
// v312: a lista das sessões e a correção pelo supervisor (com justificativa e histórico).

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Loader2, Pause, Play } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useCorrecoesSessoes, useCorrigirSessao, useIniciarSessao, usePausarSessao } from "@/lib/hooks/useDocumentoSessoes";
import {
  MOTIVOS_PAUSA,
  ROTULO_MOTIVO,
  duracao,
  estaAberta,
  fimEfetivo,
  fmtDuracao,
  minhaSessaoAberta,
  resumirSessoes,
  type SessaoDocumento,
} from "@/lib/inspecoes/sessoes";
import { cn } from "@/lib/utils";

export function ControleSessao({
  idInspecao,
  sessoes,
  idUsuario,
  agora,
  podeApontar,
  onIniciou,
}: {
  idInspecao: string;
  sessoes: readonly SessaoDocumento[];
  idUsuario: string | null | undefined;
  agora: number;
  /** Associado do documento e documento não entregue. */
  podeApontar: boolean;
  /** Depois de iniciar (ex.: abrir o documento). */
  onIniciou?: () => void;
}) {
  const iniciar = useIniciarSessao();
  const minha = minhaSessaoAberta(sessoes, idUsuario, agora);
  if (!podeApontar) return null;
  if (minha) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200" title="Sua sessão está contando">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          {fmtDuracao(agora - new Date(minha.inicio).getTime())}
        </span>
        <BotaoPausar idInspecao={idInspecao} />
      </span>
    );
  }
  const jaTrabalhei = sessoes.some((s) => s.id_usuario === idUsuario);
  return (
    <button
      type="button"
      disabled={iniciar.isPending}
      onClick={() => iniciar.mutate(idInspecao, { onSuccess: () => onIniciou?.() })}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-verde-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
      title="Começa a contar o seu tempo neste documento"
    >
      {iniciar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
      {jaTrabalhei ? "Retomar" : "Iniciar"}
    </button>
  );
}

/** `variante`: "lista" (Minhas inspeções), "faixa" (painel do documento) ou "mini" (janelinha flutuante). */
export function BotaoPausar({ idInspecao, variante = "lista" }: { idInspecao: string; variante?: "lista" | "faixa" | "mini" }) {
  const pausar = usePausarSessao();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  return (
    <span ref={raiz} className="relative">
      <button
        type="button"
        disabled={pausar.isPending}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap font-medium disabled:opacity-50",
          variante === "faixa"
            ? "rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-white"
            : variante === "mini"
              ? "rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-white"
              : "rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50",
        )}
      >
        {pausar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Pause className="size-3" />} Pausar
        <ChevronDown className="size-3" />
      </button>
      {aberto && (
        <span className="absolute right-0 z-20 mt-1 block w-60 rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg">
          {MOTIVOS_PAUSA.map((m) => (
            <button
              key={m.valor}
              type="button"
              onClick={() => {
                setAberto(false);
                pausar.mutate({ idInspecao, motivo: m.valor });
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              {m.rotulo}
              {m.valor === "AGUARDANDO_CLIENTE" && <span className="block text-[10px] text-gray-400">conta à parte, fora do tempo trabalhado</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** "2026-10-30T14:05" (horário local) para o <input type="datetime-local">. */
function paraInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * As sessões do documento, uma por linha (v312): quem, início, fim, duração, motivo e os selos
 * "automática" e "corrigida". O supervisor corrige início/fim com justificativa — o antes/depois
 * fica no histórico (documento_sessoes_correcoes).
 */
export function ListaSessoes({
  idInspecao,
  sessoes,
  agora,
  podeCorrigir,
}: {
  idInspecao: string;
  sessoes: readonly SessaoDocumento[];
  agora: number;
  podeCorrigir: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [corrigindo, setCorrigindo] = useState<SessaoDocumento | null>(null);
  const correcoes = useCorrecoesSessoes(idInspecao, aberta);
  if (sessoes.length === 0) return null;
  const ordem = [...sessoes].sort((a, b) => b.inicio.localeCompare(a.inicio));
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setAberta((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-verde-primary">
        {aberta ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />} Sessões de trabalho ({sessoes.length})
      </button>
      {aberta && (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
                <th className="py-1 pr-3">Pessoa</th>
                <th className="py-1 pr-3">Início</th>
                <th className="py-1 pr-3">Fim</th>
                <th className="py-1 pr-3">Duração</th>
                <th className="py-1 pr-3">Motivo</th>
                {podeCorrigir && <th className="py-1" />}
              </tr>
            </thead>
            <tbody>
              {ordem.map((s) => {
                const hist = (correcoes.data ?? []).filter((c) => c.id_sessao === s.id_sessao);
                return (
                  <tr key={s.id_sessao} className="border-t border-gray-50 align-top">
                    <td className="py-1 pr-3 text-gray-700">{s.nome}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{dataHora(s.inicio)}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">
                      {s.fim ? dataHora(s.fim) : estaAberta(s, agora) ? <span className="font-medium text-emerald-700">correndo</span> : dataHora(s.ultima_atividade)}
                    </td>
                    <td className="py-1 pr-3 font-medium text-gray-700">{fmtDuracao(duracao(s, agora))}</td>
                    <td className="py-1 pr-3 text-gray-500">
                      {s.motivo_fim ? ROTULO_MOTIVO[s.motivo_fim] : "—"}
                      {s.corrigida && (
                        <span
                          className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-700"
                          title={hist.map((c) => `${dataHora(c.corrigido_em)} · ${c.corrigido_por}: ${c.justificativa}`).join("\n") || "Corrigida pelo supervisor"}
                        >
                          corrigida
                        </span>
                      )}
                    </td>
                    {podeCorrigir && (
                      <td className="py-1 text-right">
                        <button type="button" onClick={() => setCorrigindo(s)} className="text-[11px] text-gray-400 hover:text-verde-primary hover:underline">
                          Corrigir
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {corrigindo && <CorrigirSessaoModal sessao={corrigindo} agora={agora} onClose={() => setCorrigindo(null)} />}
    </div>
  );
}

function CorrigirSessaoModal({ sessao, agora, onClose }: { sessao: SessaoDocumento; agora: number; onClose: () => void }) {
  const corrigir = useCorrigirSessao();
  const [inicio, setInicio] = useState(paraInput(sessao.inicio));
  const [fim, setFim] = useState(paraInput(new Date(fimEfetivo(sessao, agora)).toISOString()));
  const [justificativa, setJustificativa] = useState("");
  const iniIso = inicio ? new Date(inicio).toISOString() : "";
  const fimIso = fim ? new Date(fim).toISOString() : "";
  const erro = !inicio || !fim
    ? "Informe início e fim."
    : fimIso < iniIso
      ? "O fim vem antes do início."
      : new Date(fim).getTime() > Date.now() + 60_000
        ? "O fim não pode estar no futuro."
        : justificativa.trim().length < 5
          ? "Escreva a justificativa (5 letras ou mais)."
          : null;
  const campo = "mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";
  return (
    <Modal
      open
      onClose={onClose}
      title={`Corrigir sessão — ${sessao.nome}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-amber-700">{erro}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!!erro || corrigir.isPending}
              onClick={() => corrigir.mutate({ idSessao: sessao.id_sessao, inicio: iniIso, fim: fimIso, justificativa: justificativa.trim() }, { onSuccess: onClose })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {corrigir.isPending && <Loader2 className="size-3.5 animate-spin" />} Salvar correção
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-gray-500">
          Hoje: {dataHora(sessao.inicio)} → {sessao.fim ? dataHora(sessao.fim) : "correndo"} ({fmtDuracao(duracao(sessao, agora))}). Fim igual ao
          início zera a sessão. O horário de antes fica no histórico.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Início</span>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Fim</span>
            <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Justificativa (obrigatória)</span>
          <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3} placeholder="Ex.: esqueceu o cronômetro ligado no almoço" className={campo} />
        </label>
      </div>
    </Modal>
  );
}

/** "Trabalhado 3h20 · Aguardando cliente 2d 1h" (e, no detalhe, por pessoa). */
export function TotaisSessao({
  sessoes,
  agora,
  ate,
  detalhado,
}: {
  sessoes: readonly SessaoDocumento[];
  agora: number;
  /** Documento concluído: a espera sem retorno para aqui. */
  ate?: number;
  detalhado?: boolean;
}) {
  if (sessoes.length === 0) return null;
  const r = resumirSessoes(sessoes, agora, ate);
  return (
    <div className={cn("text-[11px] text-gray-500", detalhado && "text-xs")}>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3" /> Trabalhado <b className="text-gray-700">{fmtDuracao(r.trabalhadoMs)}</b>
      </span>
      {r.aguardandoClienteMs > 0 && (
        <span className={cn("ml-2", r.aguardandoClienteAgora && "font-medium text-amber-700")}>
          · {r.aguardandoClienteAgora ? "Aguardando cliente há" : "Aguardou cliente"} {fmtDuracao(r.aguardandoClienteMs)}
        </span>
      )}
      {detalhado && r.porPessoa.length > 0 && (
        <span className="mt-1 block">
          {r.porPessoa.map((p) => (
            <span key={p.idUsuario} className="mr-3 inline-flex items-center gap-1">
              {p.aberta && <span className="size-1.5 rounded-full bg-emerald-500" title="Trabalhando agora" />}
              {p.nome}: <b className="text-gray-700">{fmtDuracao(p.ms)}</b>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
