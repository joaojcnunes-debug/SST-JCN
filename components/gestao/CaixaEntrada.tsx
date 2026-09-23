"use client";

import { useMemo, useState } from "react";
import { Bell, UserPlus, ArrowRightLeft, MessageSquare, AtSign, Check, CheckCheck, CalendarClock, AlertTriangle, ShieldQuestion, X, ChevronDown, ChevronRight } from "lucide-react";
import { PRIORIDADES, useAprovacoesPendentes, useDecidirAprovacao, type GestaoAprovacao, type GestaoNotificacao, type GestaoTarefa, type GestaoStatus, type GestaoQuadro } from "@/lib/hooks/useGestao";
import { useUserStore } from "@/lib/store";

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000);
}
const fmtPrazo = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const corPrioridade = (p: string) => PRIORIDADES.find((x) => x.value === p)?.cor ?? "#94a3b8";

function IconeNotif({ tipo }: { tipo: string }) {
  if (tipo === "atribuicao") return <UserPlus className="size-4 text-verde-primary" />;
  if (tipo === "status") return <ArrowRightLeft className="size-4 text-indigo-500" />;
  if (tipo === "comentario") return <MessageSquare className="size-4 text-amber-500" />;
  if (tipo === "mencao") return <AtSign className="size-4 text-pink-500" />;
  return <Bell className="size-4 text-gray-400" />;
}

export default function CaixaEntrada({
  notificacoes,
  tarefas,
  quadros,
  statusMap,
  onAbrirNotif,
  onMarcarLida,
  onAbrirTarefa,
}: {
  notificacoes: GestaoNotificacao[];
  tarefas: GestaoTarefa[];
  quadros: GestaoQuadro[];
  statusMap: Map<string, GestaoStatus>;
  onAbrirNotif: (n: GestaoNotificacao) => void;
  onMarcarLida: (id: string) => void;
  onAbrirTarefa: (t: GestaoTarefa) => void;
}) {
  const naoLidas = useMemo(() => notificacoes.filter((n) => !n.lida), [notificacoes]);
  // Lidas ficam recolhidas: são o histórico que "Marcar todas como lidas" produz e que
  // "Limpar notificações" apaga — sem esta seção o Limpar não teria efeito visível.
  const lidas = useMemo(() => notificacoes.filter((n) => n.lida), [notificacoes]);
  const [mostrarLidas, setMostrarLidas] = useState(false);
  const nomeQuadro = useMemo(() => new Map(quadros.map((q) => [q.id_quadro, q.nome])), [quadros]);

  const meuEmail = useUserStore((s) => s.user?.email ?? null);
  const { data: aprovacoes = [] } = useAprovacoesPendentes();
  const tituloTarefa = useMemo(() => new Map(tarefas.map((t) => [t.id_tarefa, t.titulo])), [tarefas]);
  // Mostra as pendências que ESTE usuário decide: designadas a ele ou sem aprovador fixo
  // (gestor decide as sem dono). As demais visíveis (só por ver a tarefa) não poluem a caixa.
  const pendencias = useMemo(() => {
    const e = (meuEmail ?? "").toLowerCase();
    return aprovacoes.filter((a) => !a.aprovador_email || a.aprovador_email.toLowerCase() === e);
  }, [aprovacoes, meuEmail]);

  const atencao = useMemo(() => {
    return tarefas
      .filter((t) => {
        if (!t.prazo) return false;
        const st = statusMap.get(`${t.id_quadro}|${t.status}`);
        if (st?.tipo === "concluido") return false;
        return diasAte(t.prazo) <= 7;
      })
      .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));
  }, [tarefas, statusMap]);

  const vazio = naoLidas.length === 0 && atencao.length === 0 && pendencias.length === 0;

  return (
    <div className="mt-5 space-y-6">
      {pendencias.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <ShieldQuestion className="size-4 text-amber-600" />
            Aprovações pendentes <span className="text-gray-400">({pendencias.length})</span>
          </h2>
          <ul className="space-y-1.5">
            {pendencias.map((a) => (
              <AprovacaoLinha
                key={a.id}
                aprovacao={a}
                titulo={tituloTarefa.get(a.id_tarefa) ?? a.id_tarefa}
                onAbrir={() => {
                  const t = tarefas.find((x) => x.id_tarefa === a.id_tarefa);
                  if (t) onAbrirTarefa(t);
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {vazio && (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <CheckCheck className="mx-auto size-10 text-green-500" />
          <p className="mt-2 text-sm font-medium text-gray-700">Tudo em dia!</p>
          <p className="text-xs text-gray-400">Sem notificações novas nem prazos próximos.</p>
        </div>
      )}

      {naoLidas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Não lidas <span className="text-gray-400">({naoLidas.length})</span></h2>
          <ul className="space-y-1.5">
            {naoLidas.map((n) => (
              <li key={n.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <IconeNotif tipo={n.tipo} />
                <button type="button" onClick={() => onAbrirNotif(n)} className="flex-1 truncate text-left text-sm text-gray-700 hover:text-verde-primary" title={n.titulo}>
                  {n.titulo}
                </button>
                <span className="shrink-0 text-[11px] text-gray-400">{quando(n.created_at)}</span>
                <button type="button" onClick={() => onMarcarLida(n.id)} title="Marcar como lida" className="shrink-0 rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600">
                  <Check className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lidas.length > 0 && (
        <section>
          <button type="button" onClick={() => setMostrarLidas((v) => !v)} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
            {mostrarLidas ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Lidas <span className="font-normal text-gray-400">({lidas.length})</span>
          </button>
          {mostrarLidas && (
            <ul className="space-y-1.5">
              {lidas.map((n) => (
                <li key={n.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                  <IconeNotif tipo={n.tipo} />
                  <button type="button" onClick={() => onAbrirNotif(n)} className="flex-1 truncate text-left text-sm text-gray-500 hover:text-verde-primary" title={n.titulo}>
                    {n.titulo}
                  </button>
                  <span className="shrink-0 text-[11px] text-gray-400">{quando(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {atencao.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Precisam de atenção <span className="text-gray-400">({atencao.length})</span></h2>
          <ul className="space-y-1.5">
            {atencao.map((t) => {
              const d = diasAte(t.prazo!);
              const atrasada = d < 0;
              return (
                <li key={t.id_tarefa}>
                  <button type="button" onClick={() => onAbrirTarefa(t)} className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-gray-300 hover:shadow-sm">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: corPrioridade(t.prioridade) }} />
                    <span className="flex-1 truncate text-sm text-gray-700" title={t.titulo}>{t.titulo}</span>
                    <span className="shrink-0 text-[11px] text-gray-400">{nomeQuadro.get(t.id_quadro) ?? ""}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${atrasada ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                      {atrasada ? <AlertTriangle className="size-3" /> : <CalendarClock className="size-3" />}
                      {atrasada ? `${Math.abs(d)}d atrás` : d === 0 ? "hoje" : `${fmtPrazo(t.prazo!)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function AprovacaoLinha({ aprovacao, titulo, onAbrir }: { aprovacao: GestaoAprovacao; titulo: string; onAbrir: () => void }) {
  const [motivo, setMotivo] = useState("");
  const decidir = useDecidirAprovacao();
  const ocupado = decidir.isPending;

  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="size-4 shrink-0 text-amber-600" />
        <button type="button" onClick={onAbrir} className="flex-1 truncate text-left text-sm font-medium text-gray-700 hover:text-verde-primary" title={titulo}>
          {titulo}
        </button>
        <span className="shrink-0 text-[11px] text-gray-400">{quando(aprovacao.created_at)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          disabled={ocupado}
          className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-verde-primary focus:outline-none"
        />
        <button
          type="button"
          disabled={ocupado}
          onClick={() => decidir.mutate({ id: aprovacao.id, decisao: "aprovada", motivo: motivo || null })}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="size-3.5" /> Aprovar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => decidir.mutate({ id: aprovacao.id, decisao: "rejeitada", motivo: motivo || null })}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          <X className="size-3.5" /> Rejeitar
        </button>
      </div>
    </li>
  );
}
