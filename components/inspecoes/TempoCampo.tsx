"use client";

// Tempo de campo no cabeçalho da inspeção (0.3.314, banco v364, 19/11/2026 — pedido do João). O técnico de campo vê
// o próprio cronômetro, com Iniciar/Retomar e Pausar (com motivo); a primeira alteração na inspeção abre a sessão
// sozinha. A supervisão vê o total de todos e, clicando, por pessoa. Regras em lib/inspecoes/campo.ts.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Loader2, Pause, Play } from "lucide-react";
import { useAgora } from "@/lib/hooks/useDocumentoSessoes";
import { useAtividadeCampo, useIniciarCampo, usePausarCampo, useSessoesCampo } from "@/lib/hooks/useCampoSessoes";
import { MOTIVOS_PAUSA_CAMPO, deveIniciarSozinho, ehTecnicoDeCampo, resumirCampo } from "@/lib/inspecoes/campo";
import { fmtCronometro, fmtDuracao, minhaSessaoAberta, duracao } from "@/lib/inspecoes/sessoes";
import { cn } from "@/lib/utils";

export default function TempoCampo({
  idInspecao,
  inspecao,
  responsaveis,
  usuario,
  supervisor,
  podeEditar,
}: {
  idInspecao: string;
  inspecao: { status?: string | null; responsavel?: string | null; usuario?: string | null };
  responsaveis: readonly { id_usuario?: string | null; tecnico_responsavel?: string | null }[];
  usuario: { id_usuario?: string | null; nome?: string | null; email?: string | null } | null | undefined;
  supervisor: boolean;
  podeEditar: boolean;
}) {
  const agoraLento = useAgora();
  const { data: sessoes = [], isLoading } = useSessoesCampo(idInspecao);
  const iniciar = useIniciarCampo();
  const pausar = usePausarCampo();
  const [menu, setMenu] = useState(false);
  const [detalhe, setDetalhe] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const tecnico = ehTecnicoDeCampo(inspecao, responsaveis, usuario);
  const concluida = inspecao.status === "CONCLUIDA";
  const minha = minhaSessaoAberta(sessoes, usuario?.id_usuario, agoraLento);
  // Cronômetro de segundos só com a minha sessão correndo; senão o relógio de 30 s basta.
  const [agoraRapido, setAgoraRapido] = useState(() => Date.now());
  useEffect(() => {
    if (!minha) return;
    const t = setInterval(() => setAgoraRapido(Date.now()), 1000);
    return () => clearInterval(t);
  }, [minha]);
  const agora = minha ? agoraRapido : agoraLento;

  useAtividadeCampo(idInspecao, {
    ativa: !!minha,
    podeIniciarSozinho: tecnico && podeEditar && !concluida && !isLoading && deveIniciarSozinho(sessoes, usuario?.id_usuario),
  });

  useEffect(() => {
    if (!menu && !detalhe) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) {
        setMenu(false);
        setDetalhe(false);
      }
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menu, detalhe]);

  if (isLoading || (!tecnico && !supervisor)) return null;
  // Concluída e sem nenhuma sessão: nada a mostrar.
  if (concluida && sessoes.length === 0) return null;

  const meu = resumirCampo(sessoes, agora, usuario?.id_usuario);
  const todos = resumirCampo(sessoes, agora);
  const total = supervisor ? todos : meu;
  const jaContou = sessoes.some((s) => s.id_usuario === usuario?.id_usuario);

  return (
    <div ref={caixa} className="relative mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1",
          minha ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-gray-50 text-gray-700 ring-gray-200",
        )}
        title="Tempo de campo: o trabalho do técnico nesta inspeção (pausa sozinho com 30 min sem atividade)"
      >
        <Clock className="size-3.5" />
        Campo:{" "}
        {minha ? (
          <span className="font-mono">{fmtCronometro(duracao(minha, agora))}</span>
        ) : (
          <span>{fmtDuracao(total.trabalhadoMs)}</span>
        )}
        {minha && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-label="em andamento" />}
      </span>

      {minha && (
        <span className="text-gray-500" title={supervisor ? "Total de todos os técnicos" : "Seu total nesta inspeção"}>
          total {fmtDuracao(total.trabalhadoMs)}
        </span>
      )}
      {total.deslocamentoMs > 0 && (
        <span className={cn("text-gray-500", total.deslocandoAgora && "font-medium text-sky-700")}>
          · deslocamento {fmtDuracao(total.deslocamentoMs)}{total.deslocandoAgora ? " (agora)" : ""}
        </span>
      )}
      {total.aguardandoClienteMs > 0 && <span className="text-gray-500">· aguardando cliente {fmtDuracao(total.aguardandoClienteMs)}</span>}

      {tecnico && podeEditar && !concluida && (
        minha ? (
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            disabled={pausar.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {pausar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />} Pausar
            <ChevronDown className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => iniciar.mutate({ idInspecao })}
            disabled={iniciar.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {iniciar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {jaContou ? "Retomar campo" : "Iniciar campo"}
          </button>
        )
      )}

      {supervisor && todos.porPessoa.length > 0 && (
        <button type="button" onClick={() => setDetalhe((v) => !v)} className="text-sky-700 hover:underline">
          por pessoa
        </button>
      )}

      {menu && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Motivo da pausa</p>
          {MOTIVOS_PAUSA_CAMPO.map((m) => (
            <button
              key={m.valor}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                pausar.mutate({ idInspecao, motivo: m.valor });
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {m.rotulo}
            </button>
          ))}
          <p className="px-2 pb-1 pt-1.5 text-[11px] text-gray-400">Deslocamento e aguardando cliente contam à parte, até você retomar.</p>
        </div>
      )}

      {detalhe && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Tempo de campo por pessoa</p>
          <ul className="space-y-1">
            {todos.porPessoa.map((p) => (
              <li key={p.idUsuario} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-800">
                  {p.nome}
                  {p.aberta && <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-500 align-middle" />}
                </span>
                <span className="font-medium text-gray-900">{fmtDuracao(p.ms)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
