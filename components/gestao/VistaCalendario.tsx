"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Filter, Loader2 } from "lucide-react";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSalvarTarefa, PRIORIDADES, type GestaoTarefa, type GestaoStatus } from "@/lib/hooks/useGestao";
import {
  COR_SITUACAO, ROTULO_SITUACAO, cruzaPeriodo, intervaloDa, moverTarefa, situacaoDa,
  type CorPor, type Situacao, type VistaCal,
} from "@/lib/gestao/calendario";
import { nomesResponsaveis } from "@/lib/gestao/responsaveis";
import CalMes from "@/components/gestao/calendario/CalMes";
import CalSemana from "@/components/gestao/calendario/CalSemana";
import CalAgenda from "@/components/gestao/calendario/CalAgenda";
import { DicaTarefa, type ItemCal, type Mostrar, type PropsVisao } from "@/components/gestao/calendario/comum";
import { cn } from "@/lib/utils";

const VISOES: { id: VistaCal; label: string }[] = [
  { id: "mes", label: "Mês" },
  { id: "semana", label: "Semana" },
  { id: "dia", label: "Dia" },
  { id: "agenda", label: "Agenda" },
];
const SITUACOES: Situacao[] = ["atrasada", "hoje", "no_prazo", "concluida"];

interface Prefs { vista: VistaCal; cor: CorPor; mostrar: Mostrar; /** lateral de filtros aberta */ lateral: boolean }
const CHAVE_PREFS = "gestao-calendario";
const PREFS_PADRAO: Prefs = { vista: "mes", cor: "prioridade", mostrar: { resp: true, hora: true, lista: true }, lateral: true };

function lerPrefs(): Prefs | null {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PREFS) ?? "null") as Partial<Prefs> | null;
    if (!p) return null;
    // Preferência gravada antes da lateral existir (v0.3.921): abre a lateral só em tela grande.
    const lateral = typeof p.lateral === "boolean" ? p.lateral : window.innerWidth >= 1024;
    return { ...PREFS_PADRAO, ...p, lateral, mostrar: { ...PREFS_PADRAO.mostrar, ...(p.mostrar ?? {}) } };
  } catch {
    return null;
  }
}

/**
 * Calendário da Gestão (v0.3.914, como o do Runrun): Mês, Semana, Dia e Agenda; tarefas de vários
 * dias em barra; horário na Semana/Dia; dica ao passar o mouse; cor por prioridade, status ou
 * situação; arrastar muda o dia (e a hora, na grade); clicar num dia vazio cria a tarefa nele.
 * Quem usa já entrega `tarefas` filtradas; `lateral` (etapa 2) é a coluna de filtros à esquerda, como no Runrun,
 * e `onPeriodo` avisa o período desenhado (o calendário de uma pessoa/equipe busca só ele).
 */
export default function VistaCalendario({
  tarefas,
  statuses,
  podeEditar,
  onAbrir,
  concluida,
  rotulo,
  inicioSemPrazo = false,
  statusDe,
  onCriarNoDia,
  lateral,
  nFiltros = 0,
  onPeriodo,
  carregando = false,
}: {
  tarefas: GestaoTarefa[];
  statuses: GestaoStatus[];
  /** Booleano (um quadro) ou por tarefa (Agenda do Meu Espaço: o nível de edição é POR QUADRO). */
  podeEditar: boolean | ((t: GestaoTarefa) => boolean);
  onAbrir: (t: GestaoTarefa) => void;
  /** Agenda do Meu Espaço: tarefas de vários quadros — o status se resolve por quadro, não só pelo slug. */
  concluida?: (t: GestaoTarefa) => boolean;
  /** Nome da lista de cada tarefa (Agenda com várias listas): aparece na dica e na Agenda. */
  rotulo?: (t: GestaoTarefa) => string;
  /** Agenda do Meu Espaço: tarefa sem prazo aparece (e arrasta) pela data de início. */
  inicioSemPrazo?: boolean;
  /** Status de tarefas de vários quadros (cor por status); sem isto usa `statuses` pelo slug. */
  statusDe?: (t: GestaoTarefa) => GestaoStatus | undefined;
  /** Clicar num dia (ou horário) vazio cria uma tarefa nele. Sem isto, o clique não faz nada. */
  onCriarNoDia?: (dia: string, hora?: string) => void;
  /** Coluna de filtros (abre/fecha pelo botão "Filtros" da barra). */
  lateral?: React.ReactNode;
  /** Quantos filtros estão ligados (no botão "Filtros"). */
  nFiltros?: number;
  /** Período desenhado na tela (yyyy-MM-dd), a cada mudança de visão ou de mês/semana/dia. */
  onPeriodo?: (ini: string, fim: string) => void;
  /** Buscando as tarefas do período. */
  carregando?: boolean;
}) {
  const salvar = useSalvarTarefa();
  const [prefs, setPrefs] = useState<Prefs>(PREFS_PADRAO);
  const [ref, setRef] = useState(() => new Date());
  const [arrastando, setArrastando] = useState<ItemCal | null>(null);
  const [dica, setDica] = useState<{ i: ItemCal; x: number; y: number } | null>(null);
  const [menuMostrar, setMenuMostrar] = useState(false);
  const timerDica = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Preferências da pessoa neste navegador (sem nada salvo: no celular abre na Agenda).
  useEffect(() => {
    const p = lerPrefs();
    if (p) setPrefs(p);
    else if (window.innerWidth < 1024) setPrefs((x) => ({ ...x, vista: window.innerWidth < 640 ? "agenda" : x.vista, lateral: false }));
  }, []);
  const mudar = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const novo = { ...p, ...patch };
      try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(novo)); } catch { /* sem armazenamento: vale só agora */ }
      return novo;
    });

  useEffect(() => {
    if (!menuMostrar) return;
    const fora = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuMostrar(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuMostrar]);
  useEffect(() => () => { if (timerDica.current) clearTimeout(timerDica.current); }, []);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const statusPorSlug = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);
  const temStatus = !!statusDe || statuses.length > 0;
  const corPor: CorPor = prefs.cor === "status" && !temStatus ? "prioridade" : prefs.cor;

  const itens = useMemo<ItemCal[]>(() => {
    const out: ItemCal[] = [];
    for (const t of tarefas) {
      const iv = intervaloDa(t, inicioSemPrazo);
      if (!iv) continue;
      const st = statusDe ? statusDe(t) : statusPorSlug.get(t.status);
      const feita = concluida ? concluida(t) : st?.tipo === "concluido";
      const situacao = situacaoDa(iv, feita, hoje);
      const cor =
        corPor === "status" ? st?.cor ?? "#94a3b8"
          : corPor === "situacao" ? COR_SITUACAO[situacao]
            : PRIORIDADES.find((x) => x.value === t.prioridade)?.cor ?? "#94a3b8";
      out.push({
        id: t.id_tarefa,
        t,
        iv,
        cor,
        feita,
        situacao,
        editavel: typeof podeEditar === "function" ? podeEditar(t) : podeEditar,
        rotulo: rotulo?.(t),
        resp: nomesResponsaveis(t.responsavel),
        statusNome: st?.nome,
      });
    }
    return out;
  }, [tarefas, inicioSemPrazo, statusDe, statusPorSlug, concluida, corPor, hoje, podeEditar, rotulo]);

  const semPrazo = tarefas.length - itens.length;
  const algumEditavel = itens.some((i) => i.editavel);

  // Período na tela e o que conta no "N tarefas" (no Mês e na Agenda, o mês; não as pontas das semanas).
  const vista = prefs.vista;
  const semana = useMemo(() => {
    const ini = startOfWeek(ref, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  }, [ref]);
  const umDia = useMemo(() => [ref], [ref]);
  const [perIni, perFim] = useMemo(() => {
    const f = (d: Date) => format(d, "yyyy-MM-dd");
    if (vista === "semana") return [f(semana[0]), f(semana[6])];
    if (vista === "dia") return [f(ref), f(ref)];
    return [f(startOfMonth(ref)), f(endOfMonth(ref))];
  }, [vista, ref, semana]);
  // o Mês desenha também as pontas das semanas; as outras visões, só o período
  const [desIni, desFim] = useMemo(
    () => vista === "mes"
      ? [format(startOfWeek(startOfMonth(ref), { weekStartsOn: 1 }), "yyyy-MM-dd"), format(endOfWeek(endOfMonth(ref), { weekStartsOn: 1 }), "yyyy-MM-dd")]
      : [perIni, perFim],
    [vista, ref, perIni, perFim],
  );
  const doPeriodo = useMemo(() => itens.filter((i) => cruzaPeriodo(i.iv, desIni, desFim)), [itens, desIni, desFim]);
  useEffect(() => { onPeriodo?.(desIni, desFim); }, [onPeriodo, desIni, desFim]);
  const nNoPeriodo = useMemo(() => itens.filter((i) => cruzaPeriodo(i.iv, perIni, perFim)).length, [itens, perIni, perFim]);

  function andar(passo: number) {
    setRef((r) => (vista === "semana" ? addDays(r, 7 * passo) : vista === "dia" ? addDays(r, passo) : addMonths(startOfMonth(r), passo)));
  }

  const titulo =
    vista === "semana"
      ? semana[0].getMonth() === semana[6].getMonth()
        ? `${format(semana[0], "d")} a ${format(semana[6], "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
        : `${format(semana[0], "d 'de' MMM", { locale: ptBR })} a ${format(semana[6], "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
      : vista === "dia"
        ? format(ref, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
        : format(ref, "MMMM 'de' yyyy", { locale: ptBR });

  function onDica(i: ItemCal | null, e?: React.MouseEvent) {
    if (timerDica.current) clearTimeout(timerDica.current);
    if (!i || !e || arrastando) { setDica(null); return; }
    const { clientX: x, clientY: y } = e;
    timerDica.current = setTimeout(() => setDica({ i, x, y }), 350);
  }

  function onSoltar(dia: string, hora?: string) {
    const i = arrastando;
    setArrastando(null);
    if (!i || !i.editavel) return;
    const patch = moverTarefa(i.t, i.iv, dia, hora);
    if (patch) salvar.mutate({ id_tarefa: i.t.id_tarefa, id_quadro: i.t.id_quadro, ...patch });
  }

  const p: PropsVisao = {
    itens: doPeriodo,
    mostrar: { ...prefs.mostrar, lista: prefs.mostrar.lista && !!rotulo },
    hoje,
    onAbrir: (t) => { setDica(null); onAbrir(t); },
    onDica,
    arrastando,
    setArrastando: (i) => { setDica(null); setArrastando(i); },
    onSoltar,
    onCriar: onCriarNoDia,
  };

  const legenda =
    corPor === "prioridade" ? PRIORIDADES.map((x) => ({ nome: x.label, cor: x.cor }))
      : corPor === "situacao" ? SITUACOES.map((s) => ({ nome: ROTULO_SITUACAO[s], cor: COR_SITUACAO[s] }))
        : statuses.map((s) => ({ nome: s.nome, cor: s.cor }));

  const opcoesMostrar: { k: keyof Mostrar; label: string }[] = [
    { k: "resp", label: "Responsáveis" },
    { k: "hora", label: "Horário" },
    ...(rotulo ? [{ k: "lista" as const, label: "Lista" }] : []),
  ];

  const comLateral = !!lateral && prefs.lateral;

  return (
    <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-start">
      {comLateral && (
        <aside aria-label="Filtros do calendário" className="w-full shrink-0 rounded-xl border border-gray-200 bg-white p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-64 lg:overflow-y-auto">
          {lateral}
        </aside>
      )}
      <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-3">
        {/* Barra */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {lateral && (
            <button
              type="button"
              onClick={() => mudar({ lateral: !prefs.lateral })}
              aria-expanded={comLateral}
              title={comLateral ? "Esconder os filtros" : "Mostrar os filtros"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                comLateral || nFiltros > 0 ? "border-marca-primary bg-marca-light/60 text-marca-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              <Filter className="size-3.5" /> Filtros
              {nFiltros > 0 && <span className="rounded-full bg-marca-primary px-1.5 text-[10px] font-bold text-white">{nFiltros}</span>}
            </button>
          )}
          <button type="button" onClick={() => setRef(new Date())} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Hoje</button>
          <div className="flex items-center">
            <button type="button" onClick={() => andar(-1)} aria-label="Anterior" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ChevronLeft className="size-4" /></button>
            <button type="button" onClick={() => andar(1)} aria-label="Próximo" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ChevronRight className="size-4" /></button>
          </div>
          <h3 className="mr-auto text-base font-semibold first-letter:uppercase text-gray-800">{titulo}</h3>

          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            {carregando && <Loader2 className="size-3 animate-spin" aria-label="Carregando" />}
            {nNoPeriodo} {nNoPeriodo === 1 ? "tarefa" : "tarefas"}
          </span>

          <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium">
            {VISOES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => mudar({ vista: v.id })}
                className={cn("rounded-md px-2.5 py-1", vista === v.id ? "bg-marca-primary text-white" : "text-gray-600 hover:bg-gray-100")}
              >
                {v.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1 text-xs text-gray-500">
            Cor por
            <select value={corPor} onChange={(e) => mudar({ cor: e.target.value as CorPor })} className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700">
              <option value="prioridade">Prioridade</option>
              {temStatus && <option value="status">Status</option>}
              <option value="situacao">Situação</option>
            </select>
          </label>

          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenuMostrar((v) => !v)} aria-expanded={menuMostrar} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
              <Eye className="size-3.5" /> Mostrar
            </button>
            {menuMostrar && (
              <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
                {opcoesMostrar.map((o) => (
                  <label key={o.k} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={prefs.mostrar[o.k]}
                      onChange={(e) => mudar({ mostrar: { ...prefs.mostrar, [o.k]: e.target.checked } })}
                      className="size-3.5 accent-marca-primary"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {legenda.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            {legenda.map((l) => (
              <span key={l.nome} className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: l.cor }} />{l.nome}</span>
            ))}
          </div>
        )}

        {vista === "mes" && <CalMes p={p} mes={ref} onVerDia={(d) => { setRef(d); mudar({ vista: "dia" }); }} />}
        {vista === "semana" && <CalSemana p={p} dias={semana} />}
        {vista === "dia" && <CalSemana p={p} dias={umDia} />}
        {vista === "agenda" && <CalAgenda p={p} mes={ref} />}

        <div className="mt-2 space-y-0.5 text-xs text-gray-400">
          {semPrazo > 0 && <p>{semPrazo} tarefa(s) sem {inicioSemPrazo ? "data" : "prazo"} não aparecem no calendário.</p>}
          {algumEditavel && vista !== "agenda" && (
            <p>
              Arraste uma tarefa para outro dia para mudar a data{vista === "mes" ? "" : " (na grade, também o horário)"}.
              {onCriarNoDia ? " Clique num dia vazio para criar uma tarefa nele." : ""}
            </p>
          )}
        </div>

        {dica && !arrastando && <DicaTarefa i={dica.i} x={dica.x} y={dica.y} />}
      </div>
    </div>
  );
}
