"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Radio, Search, Loader2, RefreshCw, X, ChevronRight, ExternalLink, LogOut } from "lucide-react";
import {
  useLimpezaPresenca,
  usePresencaBlocos,
  usePresencaEncerrarSessao,
  usePresencaResumo,
  usePresencaTrilha,
  type TrilhaDiaRow,
} from "@/lib/hooks/usePresenca";
import {
  agruparPorDia,
  classificar,
  contarPorStatus,
  diaLocal,
  formatarMinutos,
  haQuantoTempo,
  horaLocal,
  type DiaPresenca,
  type PresencaBloco,
  type PresencaPessoa,
  type StatusPresenca,
} from "@/lib/presenca/regras";
import { descreverEvento, rotaDoRegistro } from "@/lib/auditoria/eventos";
import { TarjaStatus } from "@/components/presenca/StatusPresenca";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import RelatorioUso from "@/components/presenca/RelatorioUso";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { useAgora } from "@/lib/hooks/useAgora";
import { useUserStore } from "@/lib/store";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { cn } from "@/lib/utils";

/**
 * Sistema › Presença (v218/v219). A lista inteira do dia, com filtro por status
 * e nome, e o detalhe de uma pessoa: os últimos 14 dias, cada um com a hora que
 * entrou, a que parou, quanto ficou ativa, a linha do dia (blocos de 5 min) e a
 * trilha da Auditoria (os 2 últimos registros do dia). No topo, o relatório de
 * uso mensal — da equipe, ou da pessoa selecionada.
 *
 * O que mede: atividade NO PAINEL. Está escrito na tela de propósito — técnico
 * em campo com o app offline não aparece aqui, e isso não é falta.
 *
 * "Encerrar sessão" (v219): Admin derruba alguém; o navegador da pessoa obedece
 * no próximo ping (≤ 1 min se ativa, na volta se parada).
 */

type FiltroStatus = "todos" | StatusPresenca | "semEntrar";

const DIAS_DETALHE = 14;

/** YYYY-MM-DD de N dias atrás, no fuso do RJ. */
function diaRJ(diasAtras = 0): string {
  return diaLocal(new Date(Date.now() - diasAtras * 86_400_000));
}

/** Meia-noite do dia civil do RJ (sem horário de verão desde 2019: −03:00 fixo). */
function inicioDoDiaIso(dia: string): string {
  return new Date(`${dia}T00:00:00-03:00`).toISOString();
}

function dataExtenso(dia: string): string {
  return new Date(`${dia}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function PresencaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Carregando…</div>}>
      <PresencaConteudo />
    </Suspense>
  );
}

function PresencaConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const pessoaSel = params.get("pessoa");

  const [dia, setDia] = useState<string>(diaRJ(0));
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");

  const ehHoje = dia === diaRJ(0);
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = usePresencaResumo(ehHoje ? undefined : dia);
  const agora = useAgora();
  // Retenção de 6 meses (v219): quem apaga é o Admin que abre a tela, 1×/dia.
  // v231: a gerência abre a tela, mas a limpeza de retenção é RPC só-Admin.
  const isAdmin = useUserStore((s) => s.user?.perfil === "Admin");
  useLimpezaPresenca(isAdmin);

  const pessoas = useMemo(() => classificar(data ?? [], agora), [data, agora]);
  const contagem = useMemo(() => contarPorStatus(pessoas), [pessoas]);

  const { itens: filtradas, aproximado } = useMemo(() => {
    const doFiltro = pessoas.filter((p) =>
      filtro === "semEntrar" ? !p.entrou_em : filtro === "todos" || p.status === filtro,
    );
    // Busca tolerante a acento e erro de digitação; mantém a ordem da lista.
    return buscar(doFiltro, busca, (p) => [p.nome, p.usuario_email], { manterOrdem: true });
  }, [pessoas, filtro, busca]);

  const selecionada = pessoaSel ? pessoas.find((p) => p.usuario_email === pessoaSel) ?? null : null;

  const selecionar = (email: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (email) sp.set("pessoa", email);
    else sp.delete("pessoa");
    router.replace(`/presenca${sp.size ? `?${sp}` : ""}`);
  };

  const chips: { rotulo: string; valor: FiltroStatus; n: number }[] = [
    { rotulo: "Todos", valor: "todos", n: pessoas.length },
    { rotulo: "Ativos", valor: "ativo", n: contagem.ativo },
    { rotulo: "Ausentes", valor: "ausente", n: contagem.ausente },
    { rotulo: "Fora", valor: "fora", n: contagem.fora - contagem.semEntrar },
    { rotulo: ehHoje ? "Sem entrar hoje" : "Não entrou", valor: "semEntrar", n: contagem.semEntrar },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Radio className="mt-0.5 size-5 text-gray-600" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Presença no painel</h1>
          <p className="text-sm text-gray-500">
            Quem entrou, quando parou de mexer e quanto tempo ficou ativo no painel. Mede mouse e
            teclado com a aba aberta — <strong className="font-medium text-gray-700">não mede trabalho em campo</strong>:
            o técnico com o app offline não aparece aqui. Só administradores e a gerência veem esta tela.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dia</span>
          {[
            { rotulo: "Hoje", d: diaRJ(0) },
            { rotulo: "Ontem", d: diaRJ(1) },
          ].map((p) => (
            <button
              key={p.rotulo}
              type="button"
              onClick={() => setDia(p.d)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                dia === p.d
                  ? "border-verde-primary bg-verde-primary/10 text-verde-primary"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              {p.rotulo}
            </button>
          ))}
          <input
            type="date"
            value={dia}
            max={diaRJ(0)}
            onChange={(e) => e.target.value && setDia(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700"
          />
          <span className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            {dataUpdatedAt > 0 && <span>atualizado {horaLocal(new Date(dataUpdatedAt).toISOString())}</span>}
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50"
              title="Atualizar agora"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} /> Atualizar
            </button>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
          {chips.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filtro === c.valor
                  ? "border-verde-primary bg-verde-primary/10 text-verde-primary"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              {c.rotulo} <span className="tabular-nums opacity-70">{c.n}</span>
            </button>
          ))}
          <label className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou e-mail"
              className="w-56 rounded-lg border border-gray-200 py-1 pl-7 pr-7 text-xs text-gray-700"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Limpar busca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>

      {/* Relatório de uso mensal (v219): segue a pessoa selecionada, ou a equipe. */}
      <RelatorioUso
        email={selecionada?.usuario_email ?? null}
        nome={selecionada?.nome ?? null}
        onVerEquipe={() => selecionar(null)}
      />

      <ConfirmHost />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não deu para ler a presença. {error.message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-4", selecionada && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]")}>
          <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={filtradas.length} className="xl:col-span-full" />
          <TabelaPessoas
            pessoas={filtradas}
            agora={agora}
            ehHoje={ehHoje}
            selecionada={selecionada?.usuario_email ?? null}
            onSelecionar={selecionar}
          />
          {selecionada && (
            <DetalhePessoa pessoa={selecionada} agora={agora} onFechar={() => selecionar(null)} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Lista ────────────────────────────────────────────────────────────────────

function TabelaPessoas({
  pessoas,
  agora,
  ehHoje,
  selecionada,
  onSelecionar,
}: {
  pessoas: PresencaPessoa[];
  agora: number;
  ehHoje: boolean;
  selecionada: string | null;
  onSelecionar: (email: string) => void;
}) {
  if (pessoas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
        Ninguém neste filtro.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2">Nome</th>
            <th className="px-2 py-2">Entrou</th>
            <th className="whitespace-nowrap px-2 py-2">{ehHoje ? "Última atividade" : "Parou"}</th>
            <th className="px-2 py-2 text-right">Ativo</th>
            {ehHoje && <th className="px-4 py-2 text-right">Status</th>}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pessoas.map((p) => (
            <tr
              key={p.usuario_email}
              onClick={() => onSelecionar(p.usuario_email)}
              className={cn(
                "cursor-pointer hover:bg-gray-50/70",
                selecionada === p.usuario_email && "bg-verde-primary/5",
              )}
            >
              <td className="px-4 py-2">
                <div className="font-medium text-gray-900">{p.nome}</div>
                <div className="text-[11px] text-gray-400">
                  {p.cargo ?? p.perfil}
                </div>
              </td>
              <td className="whitespace-nowrap px-2 py-2 tabular-nums text-gray-700">{horaLocal(p.entrou_em)}</td>
              <td className="px-2 py-2 text-gray-700">
                {p.ultima_atividade ? (
                  <>
                    <span className="tabular-nums">{horaLocal(p.ultima_atividade)}</span>
                    {ehHoje && p.status !== "ativo" && (
                      <span className="ml-1.5 text-xs text-gray-400">({haQuantoTempo(p.ultima_atividade, agora)})</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-400">
                    {p.ultima_atividade_geral
                      ? `última vez ${haQuantoTempo(p.ultima_atividade_geral, agora)}`
                      : "nunca entrou"}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-700">{formatarMinutos(p.minutos_ativos)}</td>
              {ehHoje && (
                <td className="px-4 py-2 text-right">
                  <TarjaStatus status={p.status} />
                </td>
              )}
              <td className="pr-2 text-gray-300">
                <ChevronRight className="size-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Detalhe ──────────────────────────────────────────────────────────────────

function DetalhePessoa({
  pessoa,
  agora,
  onFechar,
}: {
  pessoa: PresencaPessoa;
  agora: number;
  onFechar: () => void;
}) {
  const diaDe = diaRJ(DIAS_DETALHE - 1);
  const diaAte = diaRJ(0);
  const de = inicioDoDiaIso(diaDe);
  const ate = inicioDoDiaIso(diaRJ(-1));
  const { data: blocos = [], isLoading } = usePresencaBlocos(pessoa.usuario_email, de, ate);
  const { data: trilha = [] } = usePresencaTrilha(pessoa.usuario_email, diaDe, diaAte);
  // Nome da empresa pelo id_empresa do evento (v220), como a tela Auditoria faz.
  const { data: empresas = [] } = useEmpresas();
  const nomesEmpresas = useMemo(() => new Map(empresas.map((e) => [e.id_empresa, e.nome_empresa])), [empresas]);

  const dias = useMemo(() => agruparPorDia(blocos), [blocos]);
  const totalMin = dias.reduce((s, d) => s + d.minutos, 0);
  const diasComUso = dias.length;

  // A lista do detalhe é a UNIÃO: dias com presença gravada + dias em que a
  // Auditoria tem registro mas a presença não (antes de 16/09, ou app de
  // campo). Sem isso, quem não entrou desde que a presença começou aparecia
  // sem trilha nenhuma, mesmo com dezenas de registros na Auditoria.
  const linhas = useMemo(() => {
    const porDia = new Map<string, { dia: string; presenca?: DiaPresenca; trilha?: TrilhaDiaRow }>();
    for (const d of dias) porDia.set(d.dia, { dia: d.dia, presenca: d });
    for (const t of trilha) {
      const atual = porDia.get(t.dia);
      if (atual) atual.trilha = t;
      else porDia.set(t.dia, { dia: t.dia, trilha: t });
    }
    return [...porDia.values()].sort((a, b) => b.dia.localeCompare(a.dia));
  }, [dias, trilha]);

  const meuEmail = useUserStore((s) => s.user?.email?.toLowerCase() ?? null);
  const souEu = meuEmail === pessoa.usuario_email;
  // v231: gerência vê a linha; derrubar sessão continua só Admin (a RPC também recusa).
  const podeEncerrar = useUserStore((s) => s.user?.perfil === "Admin");
  const encerrar = usePresencaEncerrarSessao();

  async function aoEncerrar() {
    const ok = await confirmar({
      title: `Encerrar a sessão de ${pessoa.nome}?`,
      description:
        "A pessoa é deslogada em até 1 minuto se estiver com o painel aberto — ou assim que voltar, se a aba estiver parada. " +
        "Ela pode entrar de novo com a senha. Para impedir isso, desative a conta em Usuários.",
      confirmLabel: "Encerrar sessão",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const n = await encerrar.mutateAsync(pessoa.usuario_email);
      toast.success(
        n > 0
          ? `Sessão de ${pessoa.nome} encerrada (${n} ${n === 1 ? "sessão apagada" : "sessões apagadas"}). O painel dela sai no próximo minuto.`
          : `${pessoa.nome} não tinha sessão aberta. Se abrir o painel, sai no próximo minuto.`,
        { duration: 7000 },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para encerrar a sessão");
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{pessoa.nome}</h2>
          <p className="text-xs text-gray-500">
            {pessoa.usuario_email}
            {pessoa.cargo && ` · ${pessoa.cargo}`}
            {" · "}
            {pessoa.ultima_atividade_geral
              ? `última atividade ${haQuantoTempo(pessoa.ultima_atividade_geral, agora)}`
              : "nunca entrou no painel"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {podeEncerrar && (
          <button
            type="button"
            onClick={aoEncerrar}
            disabled={souEu || encerrar.isPending}
            title={souEu ? "Para sair da sua própria sessão, use Sair" : "Desloga esta pessoa do painel"}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {encerrar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
            Encerrar sessão
          </button>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar detalhe"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-xs text-gray-600">
        <span>
          Últimos {DIAS_DETALHE} dias:{" "}
          <strong className="font-semibold text-gray-900">{diasComUso}</strong>{" "}
          {diasComUso === 1 ? "dia" : "dias"} com uso
        </span>
        <span>
          Total ativo: <strong className="font-semibold text-gray-900">{formatarMinutos(totalMin)}</strong>
        </span>
        {diasComUso > 0 && (
          <span>
            Média por dia com uso:{" "}
            <strong className="font-semibold text-gray-900">{formatarMinutos(Math.round(totalMin / diasComUso))}</strong>
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : linhas.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-500">
          Nenhuma atividade no painel nem registro na Auditoria nos últimos {DIAS_DETALHE} dias.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {linhas.map((l) =>
            l.presenca ? (
              <LinhaDia key={l.dia} d={l.presenca} blocos={blocos} trilha={l.trilha} email={pessoa.usuario_email} nomesEmpresas={nomesEmpresas} />
            ) : (
              <LinhaDiaSoTrilha key={l.dia} dia={l.dia} trilha={l.trilha!} email={pessoa.usuario_email} nomesEmpresas={nomesEmpresas} />
            ),
          )}
        </ul>
      )}

      <footer className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
        Linha do dia de 06h às 22h; cada traço é um bloco de 5 min com atividade. Dois blocos a mais de
        30 min um do outro contam como períodos separados. Abaixo de cada dia, os 2 últimos registros
        da Auditoria (o que a pessoa criou, editou ou excluiu). Dias com registro na Auditoria mas sem
        presença gravada (antes de 16/09, ou pelo app de campo) aparecem só com a trilha.
      </footer>
    </section>
  );
}

const LINHA_INICIO_H = 6;
const LINHA_FIM_H = 22;

function LinhaDia({
  d,
  blocos,
  trilha,
  email,
  nomesEmpresas,
}: {
  d: DiaPresenca;
  blocos: PresencaBloco[];
  trilha?: TrilhaDiaRow;
  email: string;
  nomesEmpresas: Map<string, string>;
}) {
  const doDia = blocos.filter((b) => diaLocal(b.bloco) === d.dia);
  const largura = (LINHA_FIM_H - LINHA_INICIO_H) * 60; // minutos
  const hrefAuditoria = `/auditoria?email=${encodeURIComponent(email)}&de=${d.dia}&ate=${d.dia}`;
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-xs">
        <span className="font-medium capitalize text-gray-900">{dataExtenso(d.dia)}</span>
        <span className="text-gray-600">
          <span className="tabular-nums">{horaLocal(d.entrou)}</span> → <span className="tabular-nums">{horaLocal(d.saiu)}</span>
          <span className="mx-2 text-gray-300">·</span>
          ativo <strong className="font-semibold text-gray-900">{formatarMinutos(d.minutos)}</strong>
          {d.sessoes.length > 1 && (
            <span className="ml-1 text-gray-400">em {d.sessoes.length} períodos</span>
          )}
        </span>
      </div>
      <div className="relative mt-1.5 h-3 w-full overflow-hidden rounded bg-gray-100" title={d.sessoes.map((s) => `${horaLocal(s.inicio)}–${horaLocal(s.fim)}`).join(" · ")}>
        {doDia.map((b) => {
          const ini = new Date(b.bloco);
          const minutoRJ = minutoDoDiaRJ(ini) - LINHA_INICIO_H * 60;
          if (minutoRJ < 0 || minutoRJ >= largura) return null;
          return (
            <span
              key={b.bloco}
              className="absolute top-0 h-full bg-emerald-500"
              style={{ left: `${(minutoRJ / largura) * 100}%`, width: `${(5 / largura) * 100}%` }}
            />
          );
        })}
        {/* marcas de hora: 8, 12, 18 */}
        {[8, 12, 18].map((h) => (
          <span
            key={h}
            className="absolute top-0 h-full w-px bg-gray-300/70"
            style={{ left: `${(((h - LINHA_INICIO_H) * 60) / largura) * 100}%` }}
          />
        ))}
      </div>

      <TrilhaDoDia trilha={trilha} hrefAuditoria={hrefAuditoria} nomesEmpresas={nomesEmpresas} />
    </li>
  );
}

/** Dia em que a Auditoria tem registro mas a presença não gravou nada. */
function LinhaDiaSoTrilha({
  dia,
  trilha,
  email,
  nomesEmpresas,
}: {
  dia: string;
  trilha: TrilhaDiaRow;
  email: string;
  nomesEmpresas: Map<string, string>;
}) {
  const hrefAuditoria = `/auditoria?email=${encodeURIComponent(email)}&de=${dia}&ate=${dia}`;
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-xs">
        <span className="font-medium capitalize text-gray-900">{dataExtenso(dia)}</span>
        <span className="text-gray-400">sem registro de presença neste dia</span>
      </div>
      <TrilhaDoDia trilha={trilha} hrefAuditoria={hrefAuditoria} nomesEmpresas={nomesEmpresas} />
    </li>
  );
}

/** Trilha da Auditoria (v219/v220): os 2 últimos registros do dia + o total. */
function TrilhaDoDia({
  trilha,
  hrefAuditoria,
  nomesEmpresas,
}: {
  trilha?: TrilhaDiaRow;
  hrefAuditoria: string;
  nomesEmpresas: Map<string, string>;
}) {
  if (!trilha || trilha.total === 0) {
    return (
      <p className="mt-2 text-[11px] text-gray-400">Nenhum registro na Auditoria neste dia (só leitura, ou trabalho fora do painel).</p>
    );
  }
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {trilha.ultimos.map((ev) => {
        const rota = rotaDoRegistro(ev);
        const empresa = ev.id_empresa ? nomesEmpresas.get(ev.id_empresa) : null;
        const texto = empresa ? `${descreverEvento(ev)} — ${empresa}` : descreverEvento(ev);
        return (
          <li key={ev.id} className="flex items-baseline gap-2 text-gray-600">
            <span className="shrink-0 tabular-nums text-gray-400">{horaLocal(ev.ocorrido_em)}</span>
            {rota ? (
              <Link href={rota} className="inline-flex min-w-0 items-center gap-1 hover:underline">
                <span className="truncate">{texto}</span>
                <ExternalLink className="size-3 shrink-0 text-gray-400" />
              </Link>
            ) : (
              <span className="truncate">{texto}</span>
            )}
          </li>
        );
      })}
      <li className="text-[11px] text-gray-400">
        {trilha.total} {trilha.total === 1 ? "registro" : "registros"} no dia
        {trilha.total > trilha.ultimos.length && (
          <>
            {" · "}
            <Link href={hrefAuditoria} className="font-medium text-gray-500 hover:underline">
              ver tudo na Auditoria ›
            </Link>
          </>
        )}
      </li>
    </ul>
  );
}

/** Minuto do dia (0–1439) no fuso do RJ. */
function minutoDoDiaRJ(d: Date): number {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

