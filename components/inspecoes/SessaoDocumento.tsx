"use client";

// Apontamento de tempo do documento (v311, 30/10/2026): Iniciar/Retomar, o cronômetro da minha
// sessão, Pausar com motivo e os totais (trabalhado, aguardando cliente, por pessoa).
// Usado em Minhas inspeções (compacto) e no card "Documento (SGG)" do relatório.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Loader2, Pause, Play } from "lucide-react";
import { useIniciarSessao, usePausarSessao } from "@/lib/hooks/useDocumentoSessoes";
import {
  MOTIVOS_PAUSA,
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

function BotaoPausar({ idInspecao }: { idInspecao: string }) {
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
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
