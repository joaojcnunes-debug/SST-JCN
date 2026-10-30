"use client";

// Painel de tempo do documento (v0.3.186, 30/10/2026) — o card Documento (SGG) do relatório
// ganha um quadro em destaque com o apontamento de tempo (v311):
//  • faixa principal com a situação, colorida (verde: o meu tempo correndo, com cronômetro em
//    segundos; azul: outra pessoa trabalhando; âmbar: aguardando cliente; cinza: pausado ou não
//    iniciado; índigo: entregue) e o botão Iniciar/Retomar ou Pausar;
//  • indicadores: trabalhado, eu hoje, aguardando cliente, sessões e pessoas;
//  • linha do tempo: as sessões de cada pessoa (na cor dela) e as esperas do cliente;
//  • barras por pessoa e a lista das sessões (com a correção do supervisor).
// v0.3.187 (pedido de 30/10: "menor, ou uma janelinha no canto que não atrapalhe"):
//  • mais compacto; linha do tempo, pessoas e sessões recolhidas em "Detalhes";
//  • botão "Levar para o canto": vira uma janelinha flutuante no canto superior direito
//    (cronômetro, Pausar/Retomar, voltar) e no card fica uma linha fina;
//  • com o painel no lugar, a janelinha aparece sozinha quando o MEU tempo está correndo e o
//    painel saiu da tela (rolagem) — o cronômetro e o Pausar ficam sempre à vista.
//  • a janelinha se arrasta pelo ícone/cronômetro (começa abaixo dos botões da página).
//  A escolha (painel/canto), a posição e o "Detalhes" aberto ficam guardados no navegador.
// As contas são as de lib/inspecoes/sessoes.ts.

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Hourglass,
  Loader2,
  Maximize2,
  PauseCircle,
  PictureInPicture2,
  Play,
  Timer,
  Users,
} from "lucide-react";
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
type Modo = "painel" | "canto";

const FAIXA: Record<Estado, string> = {
  minha: "from-emerald-600 via-emerald-500 to-teal-500",
  outros: "from-sky-600 via-sky-500 to-cyan-500",
  cliente: "from-amber-500 via-amber-400 to-orange-400",
  pausado: "from-slate-600 via-slate-500 to-slate-400",
  novo: "from-slate-500 via-slate-400 to-slate-300",
  entregue: "from-indigo-600 via-indigo-500 to-violet-500",
};
/** Rótulo curto da janelinha do canto. */
const CURTO: Record<Estado, string> = {
  minha: "Seu tempo",
  outros: "Trabalhando agora",
  cliente: "Aguardando cliente",
  pausado: "Pausado",
  novo: "Não iniciado",
  entregue: "Entregue",
};

const CHAVE_MODO = "jcn.painelTempo.modo";
const CHAVE_DETALHES = "jcn.painelTempo.detalhes";
const CHAVE_POSICAO = "jcn.painelTempo.posicao";
/** Abaixo da barra do topo e dos botões da página (Gerar PDF etc.), no canto direito. */
const POSICAO_PADRAO = { top: 124, right: 16 };
const ler = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const gravar = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
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

  // Painel no card ou janelinha no canto; "Detalhes" aberto ou não (guardados no navegador).
  const [modo, setModo] = useState<Modo>("painel");
  const [detalhes, setDetalhes] = useState(false);
  const [posicao, setPosicao] = useState(POSICAO_PADRAO);
  useEffect(() => {
    if (ler(CHAVE_MODO) === "canto") setModo("canto");
    if (ler(CHAVE_DETALHES) === "1") setDetalhes(true);
    try {
      const p = JSON.parse(ler(CHAVE_POSICAO) ?? "null");
      if (p && Number.isFinite(p.top) && Number.isFinite(p.right)) setPosicao(p);
    } catch {
      /* posição salva inválida: fica a padrão */
    }
  }, []);

  // Arrastar a janelinha pelo ícone/cronômetro; a posição fica guardada (dentro da tela).
  const arrasto = useRef<{ x: number; y: number; top: number; right: number } | null>(null);
  const comecarArrasto = (e: React.PointerEvent) => {
    arrasto.current = { x: e.clientX, y: e.clientY, ...posicao };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const arrastar = (e: React.PointerEvent) => {
    const a = arrasto.current;
    if (!a) return;
    const top = Math.min(Math.max(8, a.top + (e.clientY - a.y)), window.innerHeight - 56);
    const right = Math.min(Math.max(8, a.right - (e.clientX - a.x)), window.innerWidth - 120);
    setPosicao({ top, right });
  };
  const soltar = () => {
    if (!arrasto.current) return;
    arrasto.current = null;
    setPosicao((p) => {
      gravar(CHAVE_POSICAO, JSON.stringify(p));
      return p;
    });
  };
  const mudarModo = (m: Modo) => {
    setModo(m);
    gravar(CHAVE_MODO, m);
  };
  const alternarDetalhes = () =>
    setDetalhes((v) => {
      gravar(CHAVE_DETALHES, v ? "0" : "1");
      return !v;
    });

  // O painel está na tela? (com o meu tempo correndo e o painel fora da tela, a janelinha aparece)
  const raiz = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [modo]);

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

  // ── Situação ───────────────────────────────────────────────────────────────
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

  const correndo = estado === "minha" || estado === "outros";
  const botaoIniciar = (mini: boolean) => (
    <button
      type="button"
      disabled={iniciar.isPending}
      onClick={() => iniciar.mutate(idInspecao)}
      className={cn(
        "inline-flex items-center gap-1.5 bg-white font-bold text-gray-800 shadow-sm transition hover:shadow-md disabled:opacity-60",
        mini ? "rounded-full px-2.5 py-1 text-xs" : "rounded-lg px-4 py-1.5 text-sm",
      )}
    >
      {iniciar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
      {jaTrabalhei ? "Retomar" : "Iniciar"}
    </button>
  );

  // ── Janelinha do canto ─────────────────────────────────────────────────────
  // No modo "canto", sempre que houver o que mostrar; no modo "painel", só com o MEU tempo
  // correndo e o painel fora da tela.
  const temOQueMostrar = podeApontar || sessoes.length > 0;
  const mostrarCanto = temOQueMostrar && (modo === "canto" || (estado === "minha" && !visivel));
  const janelinha = mostrarCanto && (
    <div
      className={cn(
        "no-print fixed z-40 flex items-center gap-2 rounded-full bg-gradient-to-r py-1.5 pl-2 pr-1.5 text-white shadow-xl ring-1 ring-black/10",
        FAIXA[estado],
      )}
      style={{ top: posicao.top, right: posicao.right }}
      role="status"
      aria-label={`${titulo}: ${grande}`}
    >
      {/* Alça de arrastar: o ícone e o cronômetro */}
      <div
        className="flex cursor-grab touch-none select-none items-center gap-2 active:cursor-grabbing"
        onPointerDown={comecarArrasto}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        title="Arraste para mudar de lugar"
      >
        <span className="relative flex size-7 items-center justify-center rounded-full bg-white/20">
          {correndo && <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/30" />}
          <Icone className="relative size-3.5" />
        </span>
        <div className="leading-tight">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/80">{CURTO[estado]}</p>
          <p className="font-mono text-sm font-bold tabular-nums">{grande}</p>
        </div>
      </div>
      {podeApontar && (minha ? <BotaoPausar idInspecao={idInspecao} variante="mini" /> : botaoIniciar(true))}
      <button
        type="button"
        onClick={() => {
          mudarModo("painel");
          setTimeout(() => raiz.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }}
        title="Mostrar o painel de tempo no documento"
        className="flex size-7 items-center justify-center rounded-full text-white/90 hover:bg-white/20"
      >
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  );

  if (modo === "canto") {
    return (
      <>
        <div
          ref={raiz}
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
        >
          <span className="inline-flex items-center gap-1.5">
            <PictureInPicture2 className="size-3.5 text-gray-400" />
            Tempo do documento no canto da tela · {titulo.toLowerCase()} · trabalhado {fmtDuracao(r.trabalhadoMs)}
          </span>
          <button type="button" onClick={() => mudarModo("painel")} className="font-medium text-verde-primary hover:underline">
            Mostrar aqui
          </button>
        </div>
        {janelinha}
      </>
    );
  }

  // ── Linha do tempo ─────────────────────────────────────────────────────────
  const inicioLinha = sessoes.length ? Math.min(...sessoes.map((s) => ms(s.inicio))) : 0;
  const fimLinha = Math.max(ate ?? agora, ...sessoes.map((s) => fimEfetivo(s, agora)), inicioLinha + 1);
  const pct = (t: number) => ((t - inicioLinha) / (fimLinha - inicioLinha)) * 100;
  const esperas = esperasDoCliente(sessoes, agora, ate).intervalos;
  const maxPessoa = Math.max(1, ...r.porPessoa.map((p) => p.ms));

  return (
    <>
      <div ref={raiz} className="mt-3 rounded-xl border border-gray-200 shadow-sm">
        {/* Faixa principal (o corte fica só nos círculos — o menu do Pausar precisa sair da faixa) */}
        <div className={cn("relative rounded-t-xl bg-gradient-to-r px-4 py-3 text-white transition-colors duration-500", FAIXA[estado])}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-xl">
            <div className="absolute -right-8 -top-10 size-28 rounded-full bg-white/10" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                {correndo && <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/30" />}
                <Icone className="relative size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">{titulo}</p>
                <p className="font-mono text-2xl font-bold tabular-nums leading-tight">{grande}</p>
                <p className="truncate text-[11px] text-white/85">{sub}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {podeApontar && (minha ? <BotaoPausar idInspecao={idInspecao} variante="faixa" /> : botaoIniciar(false))}
              {temOQueMostrar && (
                <button
                  type="button"
                  onClick={() => mudarModo("canto")}
                  title="Levar para o canto da tela (janelinha que não cobre o documento)"
                  className="flex size-8 items-center justify-center rounded-lg text-white/90 hover:bg-white/20"
                >
                  <PictureInPicture2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Indicadores + Detalhes */}
        <div className={cn("flex flex-wrap items-stretch bg-white", detalhes && sessoes.length > 0 ? "border-b border-gray-100" : "rounded-b-xl")}>
          <div className="grid flex-1 grid-cols-2 divide-gray-100 sm:grid-cols-4 sm:divide-x">
            <Indicador rotulo="Trabalhado" valor={fmtDuracao(r.trabalhadoMs)} destaque />
            <Indicador rotulo="Você hoje" valor={idUsuario && euHojeMs > 0 ? fmtDuracao(euHojeMs) : "—"} />
            <Indicador
              rotulo="Aguardando cliente"
              valor={r.aguardandoClienteMs > 0 ? fmtDuracao(r.aguardandoClienteMs) : "—"}
              alerta={r.aguardandoClienteAgora}
              dica="Fora do tempo trabalhado"
            />
            <Indicador rotulo="Sessões · pessoas" valor={`${sessoes.length} · ${r.porPessoa.length}`} />
          </div>
          {sessoes.length > 0 && (
            <button
              type="button"
              onClick={alternarDetalhes}
              className="flex items-center gap-1 border-l border-gray-100 px-3 text-[11px] font-medium text-gray-500 hover:bg-gray-50 hover:text-verde-primary"
              title="Linha do tempo, tempo por pessoa e sessões"
            >
              {detalhes ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Detalhes
            </button>
          )}
        </div>

        {detalhes && sessoes.length > 0 && (
          <div className="space-y-3 rounded-b-xl bg-white p-3">
            {/* Linha do tempo */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                <span className="font-semibold uppercase tracking-wider">Linha do tempo</span>
                <span>
                  {diaHora(inicioLinha)} → {ate ? diaHora(ate) : "agora"}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
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
              {esperas.length > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="size-2 rounded-sm bg-[repeating-linear-gradient(45deg,#fbbf24_0,#fbbf24_2px,#fde68a_2px,#fde68a_4px)]" /> Aguardando cliente
                </p>
              )}
            </div>

            {/* Por pessoa (a cor da barra é a da pessoa na linha do tempo) */}
            <div className="space-y-1">
              {r.porPessoa.map((p) => (
                <div key={p.idUsuario} className="flex items-center gap-2 text-xs">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
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
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(p.ms / maxPessoa) * 100}%`, backgroundColor: corAvatar(p.nome) }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-gray-800">{fmtDuracao(p.ms)}</span>
                  {p.aberta && <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" title="Trabalhando agora" />}
                </div>
              ))}
            </div>

            <ListaSessoes idInspecao={idInspecao} sessoes={sessoes} agora={agora} podeCorrigir={podeCorrigir} />
          </div>
        )}
      </div>
      {janelinha}
    </>
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
    <div className="px-4 py-2" title={dica}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{rotulo}</p>
      <p
        className={cn(
          "text-base font-bold tabular-nums",
          alerta ? "text-amber-600" : destaque ? "text-gray-900" : "text-gray-700",
        )}
      >
        {valor}
      </p>
    </div>
  );
}
