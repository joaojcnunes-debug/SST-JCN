"use client";

// Painel de tempo do documento (v0.3.186, 30/10/2026) — o card Documento (SGG) do relatório
// ganha um quadro em destaque com o apontamento de tempo (v311):
//  • faixa principal com a situação, colorida (verde: o meu tempo correndo, com cronômetro em
//    segundos; azul: outra pessoa trabalhando; âmbar: aguardando cliente; cinza: pausado ou não
//    iniciado; índigo: entregue) e o botão Iniciar/Retomar ou Pausar;
//  • indicadores: trabalhado, eu hoje, aguardando cliente, sessões e pessoas;
//  • linha do tempo: as sessões de cada pessoa (na cor dela) e as esperas do cliente;
//  • barras por pessoa e a lista das sessões (com a correção do supervisor).
// As contas são as de lib/inspecoes/sessoes.ts.

import { CalendarClock, CheckCircle2, Hourglass, Loader2, PauseCircle, Play, Timer, Users } from "lucide-react";
import { BotaoPausar, ListaSessoes } from "@/components/inspecoes/SessaoDocumento";
import { useAgora, useIniciarSessao } from "@/lib/hooks/useDocumentoSessoes";
import { corAvatar } from "@/lib/hooks/useGestao";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import {
  MINUTOS_INATIVIDADE,
  ROTULO_MOTIVO,
  esperasDoCliente,
  estaAberta,
  fimEfetivo,
  fmtCronometro,
  fmtDuracao,
  minhaSessaoAberta,
  resumirSessoes,
  type SessaoDocumento,
} from "@/lib/inspecoes/sessoes";
import { cn } from "@/lib/utils";

type Estado = "minha" | "outros" | "cliente" | "pausado" | "novo" | "entregue";

const FAIXA: Record<Estado, string> = {
  minha: "from-emerald-600 via-emerald-500 to-teal-500",
  outros: "from-sky-600 via-sky-500 to-cyan-500",
  cliente: "from-amber-500 via-amber-400 to-orange-400",
  pausado: "from-slate-600 via-slate-500 to-slate-400",
  novo: "from-slate-500 via-slate-400 to-slate-300",
  entregue: "from-indigo-600 via-indigo-500 to-violet-500",
};

const ms = (iso: string) => new Date(iso).getTime();
const hora = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const diaHora = (t: number) =>
  new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function PainelTempoDocumento({
  idInspecao,
  sessoes,
  idUsuario,
  podeApontar,
  podeCorrigir,
  concluidaEm,
  entregue,
}: {
  idInspecao: string;
  sessoes: readonly SessaoDocumento[];
  idUsuario: string | null | undefined;
  /** Associado do documento e documento não entregue. */
  podeApontar: boolean;
  podeCorrigir: boolean;
  concluidaEm: string | null | undefined;
  entregue: boolean;
}) {
  // O cronômetro anda de segundo em segundo só enquanto há alguém trabalhando.
  const algumAberto = sessoes.some((s) => !s.fim);
  const agora = useAgora(algumAberto ? 1000 : 30_000);
  const iniciar = useIniciarSessao();

  const ate = entregue && concluidaEm ? ms(concluidaEm) : undefined;
  const r = resumirSessoes(sessoes, agora, ate);
  const minha = minhaSessaoAberta(sessoes, idUsuario, agora);
  const outras = sessoes.filter((s) => estaAberta(s, agora) && s.id_usuario !== idUsuario);
  const fechadas = sessoes.filter((s) => s.fim).sort((a, b) => ms(b.fim!) - ms(a.fim!));
  const ultima = fechadas[0];
  const jaTrabalhei = sessoes.some((s) => s.id_usuario === idUsuario);

  const inicioDoDia = new Date(`${hojeSP()}T03:00:00Z`).getTime();
  const euHojeMs = sessoes
    .filter((s) => s.id_usuario === idUsuario)
    .reduce((t, s) => t + Math.max(0, fimEfetivo(s, agora) - Math.max(ms(s.inicio), inicioDoDia)), 0);

  const estado: Estado = entregue
    ? "entregue"
    : minha
      ? "minha"
      : outras.length > 0
        ? "outros"
        : r.aguardandoClienteAgora
          ? "cliente"
          : sessoes.length > 0
            ? "pausado"
            : "novo";

  // ── Faixa principal ────────────────────────────────────────────────────────
  let titulo = "";
  let grande = "";
  let sub = "";
  let Icone = Timer;
  if (estado === "minha") {
    titulo = "Seu tempo está correndo";
    grande = fmtCronometro(agora - ms(minha!.inicio));
    sub = `Iniciado às ${hora(ms(minha!.inicio))} · pausa sozinho com ${MINUTOS_INATIVIDADE} min sem atividade`;
  } else if (estado === "outros") {
    const mais = [...outras].sort((a, b) => ms(a.inicio) - ms(b.inicio))[0];
    titulo = `${outras.map((s) => s.nome.split(" ")[0]).join(", ")} trabalhando agora`;
    grande = fmtCronometro(agora - ms(mais.inicio));
    sub = `Desde ${hora(ms(mais.inicio))}`;
    Icone = Users;
  } else if (estado === "cliente") {
    const desde = ultima?.fim ? ms(ultima.fim) : agora;
    titulo = "Aguardando o cliente";
    grande = fmtDuracao(agora - desde);
    sub = `Pausado em ${diaHora(desde)} · esse tempo não conta como trabalhado`;
    Icone = Hourglass;
  } else if (estado === "pausado") {
    titulo = "Pausado";
    grande = fmtDuracao(r.trabalhadoMs);
    sub = ultima?.fim
      ? `Última atividade em ${diaHora(ms(ultima.fim))}${ultima.motivo_fim ? ` · ${ROTULO_MOTIVO[ultima.motivo_fim]}` : ""}`
      : "Sem sessão aberta";
    Icone = PauseCircle;
  } else if (estado === "novo") {
    titulo = "Ainda não iniciado";
    grande = "00:00:00";
    sub = podeApontar ? "Aperte Iniciar para começar a contar o seu tempo" : "Nenhuma sessão de trabalho ainda";
    Icone = CalendarClock;
  } else {
    titulo = "Documento entregue";
    grande = fmtDuracao(r.trabalhadoMs);
    sub = `${concluidaEm ? `Concluído em ${diaHora(ms(concluidaEm))}` : "Concluído"} · tempo trabalhado no total`;
    Icone = CheckCircle2;
  }

  // ── Linha do tempo ─────────────────────────────────────────────────────────
  const inicioLinha = sessoes.length ? Math.min(...sessoes.map((s) => ms(s.inicio))) : 0;
  const fimLinha = Math.max(ate ?? agora, ...sessoes.map((s) => fimEfetivo(s, agora)), inicioLinha + 1);
  const pct = (t: number) => ((t - inicioLinha) / (fimLinha - inicioLinha)) * 100;
  const esperas = esperasDoCliente(sessoes, agora, ate).intervalos;
  const maxPessoa = Math.max(1, ...r.porPessoa.map((p) => p.ms));

  return (
    <div className="mt-3 rounded-xl border border-gray-200 shadow-sm">
      {/* Faixa principal (o corte fica só nos círculos — o menu do Pausar precisa sair da faixa) */}
      <div className={cn("relative rounded-t-xl bg-gradient-to-r p-4 text-white transition-colors duration-500 sm:p-5", FAIXA[estado])}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-xl">
          <div className="absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-24 size-32 rounded-full bg-white/10" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
              {(estado === "minha" || estado === "outros") && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/30" />
              )}
              <Icone className="relative size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{titulo}</p>
              <p className="font-mono text-3xl font-bold tabular-nums leading-tight sm:text-4xl">{grande}</p>
              <p className="truncate text-xs text-white/85">{sub}</p>
            </div>
          </div>
          {podeApontar &&
            (minha ? (
              <BotaoPausar idInspecao={idInspecao} destaque />
            ) : (
              <button
                type="button"
                disabled={iniciar.isPending}
                onClick={() => iniciar.mutate(idInspecao)}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-gray-800 shadow-md transition hover:scale-[1.02] hover:shadow-lg disabled:opacity-60"
              >
                {iniciar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                {jaTrabalhei ? "Retomar" : "Iniciar"}
              </button>
            ))}
        </div>
      </div>

      {/* Indicadores */}
      <div
        className={cn(
          "grid grid-cols-2 divide-gray-100 bg-white sm:grid-cols-4 sm:divide-x",
          sessoes.length > 0 ? "border-b border-gray-100" : "rounded-b-xl",
        )}
      >
        <Indicador rotulo="Trabalhado" valor={fmtDuracao(r.trabalhadoMs)} destaque />
        <Indicador rotulo="Você hoje" valor={idUsuario && euHojeMs > 0 ? fmtDuracao(euHojeMs) : "—"} />
        <Indicador
          rotulo="Aguardando cliente"
          valor={r.aguardandoClienteMs > 0 ? fmtDuracao(r.aguardandoClienteMs) : "—"}
          alerta={r.aguardandoClienteAgora}
          dica="Fora do tempo trabalhado"
        />
        <Indicador
          rotulo="Sessões · pessoas"
          valor={`${sessoes.length} · ${r.porPessoa.length}`}
        />
      </div>

      {sessoes.length > 0 && (
        <div className="space-y-4 rounded-b-xl bg-white p-4">
          {/* Linha do tempo */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-semibold uppercase tracking-wider">Linha do tempo</span>
              <span>
                {diaHora(inicioLinha)} → {ate ? diaHora(ate) : "agora"}
              </span>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-gray-100">
              {esperas.map(([de, a]) => (
                <span
                  key={`e${de}`}
                  title={`Aguardando cliente: ${fmtDuracao(a - de)}`}
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,#fbbf24_0,#fbbf24_4px,#fde68a_4px,#fde68a_8px)]"
                  style={{ left: `${pct(de)}%`, width: `${Math.max(0.5, pct(a) - pct(de))}%` }}
                />
              ))}
              {sessoes.map((s) => {
                const fim = fimEfetivo(s, agora);
                return (
                  <span
                    key={s.id_sessao}
                    title={`${s.nome}: ${diaHora(ms(s.inicio))} → ${s.fim ? diaHora(fim) : "agora"} (${fmtDuracao(fim - ms(s.inicio))})`}
                    className={cn("absolute inset-y-0 rounded-sm", estaAberta(s, agora) && "animate-pulse")}
                    style={{ left: `${pct(ms(s.inicio))}%`, width: `max(4px, ${pct(fim) - pct(ms(s.inicio))}%)`, backgroundColor: corAvatar(s.nome) }}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-gray-500">
              {r.porPessoa.map((p) => (
                <span key={p.idUsuario} className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: corAvatar(p.nome) }} /> {p.nome.split(" ")[0]}
                </span>
              ))}
              {esperas.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,#fbbf24_0,#fbbf24_2px,#fde68a_2px,#fde68a_4px)]" /> Aguardando cliente
                </span>
              )}
            </div>
          </div>

          {/* Por pessoa */}
          <div className="space-y-1.5">
            {r.porPessoa.map((p) => (
              <div key={p.idUsuario} className="flex items-center gap-2 text-xs">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: corAvatar(p.nome) }}
                >
                  {p.nome
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((x) => x[0]?.toUpperCase())
                    .join("")}
                </span>
                <span className="w-28 shrink-0 truncate text-gray-700">{p.nome}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(p.ms / maxPessoa) * 100}%`, backgroundColor: corAvatar(p.nome) }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-gray-800">{fmtDuracao(p.ms)}</span>
                {p.aberta && <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" title="Trabalhando agora" />}
              </div>
            ))}
          </div>

          <ListaSessoes idInspecao={idInspecao} sessoes={sessoes} agora={agora} podeCorrigir={podeCorrigir} />
        </div>
      )}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  destaque,
  alerta,
  dica,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  alerta?: boolean;
  dica?: string;
}) {
  return (
    <div className="px-4 py-3" title={dica}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{rotulo}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          alerta ? "text-amber-600" : destaque ? "text-gray-900" : "text-gray-700",
        )}
      >
        {valor}
      </p>
    </div>
  );
}
