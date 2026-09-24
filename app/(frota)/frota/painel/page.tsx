"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  Fuel,
  MapPin,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react";
import RegistrarRetornoModal from "@/components/frota/RegistrarRetornoModal";
import { usePainelFrota } from "@/lib/hooks/useFrotaPainel";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { formatarPlaca } from "@/lib/frota/placa";
import { formatarKm } from "@/lib/frota/km";
import { enderecoEmLinha } from "@/lib/frota/maps";
import {
  alertasDaFrota,
  dataBr,
  dataHoraBr,
  manutencaoEstaAberta,
  mesAnterior,
  mesCorrente,
  moeda,
  numero,
  resumoDoPeriodo,
  ROTULO_SITUACAO_FROTA,
  situacaoDaFrota,
  SITUACOES_FROTA,
  type LinhaSituacao,
  type ResumoPeriodo,
  type SituacaoFrota,
} from "@/lib/frota/painel";
import { ROTULO_TIPO_MANUTENCAO } from "@/lib/frota/tipos";
import type { FrotaChecklist } from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

/**
 * O PAINEL DA FROTA — a tela que faltava.
 *
 * Antes dela, quem responde pelo setor abria uma lista de cards de veículos e
 * tinha de deduzir tudo: quem está com o carro, o que está parado, o que está
 * caro, o que venceu. A informação existia espalhada em cinco abas e não se
 * juntava em lugar nenhum.
 *
 * A tela responde quatro perguntas, nesta ordem, porque é a ordem em que elas
 * atrapalham o dia:
 *   1. O que precisa de mim agora?      → alertas
 *   2. Onde está cada carro?            → situação da frota
 *   3. Quem está na rua, e há quanto?   → quadro de viagens abertas
 *   4. Quanto isto está custando?       → mês corrente contra o anterior
 *
 * Nada aqui é calculado na tela: as contas moram em lib/frota/painel.ts, pelo
 * mesmo motivo que a matriz do QPS mora em lib/qps/matriz.ts — conta copiada em
 * telas diferentes vira contas diferentes.
 */

const CORES_SITUACAO: Record<SituacaoFrota, { chip: string; ponto: string }> = {
  FORA: { chip: "border-blue-200 bg-blue-50 text-blue-800", ponto: "bg-blue-500" },
  MANUTENCAO: { chip: "border-amber-200 bg-amber-50 text-amber-800", ponto: "bg-amber-500" },
  DISPONIVEL: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", ponto: "bg-emerald-500" },
  INATIVO: { chip: "border-gray-200 bg-gray-50 text-gray-600", ponto: "bg-gray-400" },
};

const ICONE_SITUACAO: Record<SituacaoFrota, typeof Truck> = {
  FORA: MapPin,
  MANUTENCAO: Wrench,
  DISPONIVEL: CircleCheck,
  INATIVO: Truck,
};

export default function PainelFrotaPage() {
  // useSearchParams() exige limite de Suspense para o build do Next não falhar.
  return (
    <Suspense fallback={null}>
      <PainelConteudo />
    </Suspense>
  );
}

function PainelConteudo() {
  const params = useSearchParams();
  const unidadeFiltro = params.get("unidade");

  // Uma referência de tempo para a tela inteira. Chamar `new Date()` dentro de
  // cada conta faria dois blocos discordarem sobre "hoje" quando a página
  // atravessasse a virada da meia-noite aberta — e é justamente à noite que
  // alguém deixa o painel aberto.
  const [hoje] = useState(() => new Date());

  const dados = usePainelFrota(hoje);
  const { data: unidades = [] } = useUnidades();

  const nomeUnidade = useMemo(
    () => new Map(unidades.map((u) => [u.id_unidade, u.nome])),
    [unidades],
  );

  // O filtro de base recorta o VEÍCULO, e tudo mais o acompanha. Filtrar cada
  // lista pelo seu próprio campo de unidade daria números que não fecham: a
  // saída guarda a base do dia em que aconteceu, e o veículo pode ter mudado
  // de base desde então.
  const veiculos = useMemo(
    () =>
      unidadeFiltro
        ? dados.veiculos.filter((v) => v.id_unidade === unidadeFiltro)
        : dados.veiculos,
    [dados.veiculos, unidadeFiltro],
  );

  const idsVisiveis = useMemo(
    () => new Set(veiculos.map((v) => v.id_veiculo)),
    [veiculos],
  );
  const meu = <T extends { id_veiculo: string }>(linhas: T[]) =>
    unidadeFiltro ? linhas.filter((l) => idsVisiveis.has(l.id_veiculo)) : linhas;

  const placaPorId = useMemo(
    () => new Map(dados.veiculos.map((v) => [v.id_veiculo, v.placa])),
    [dados.veiculos],
  );
  const placaDe = (id: string) => formatarPlaca(placaPorId.get(id) ?? "—");

  const situacao = useMemo(
    () =>
      situacaoDaFrota({
        veiculos,
        saidasEmAberto: meu(dados.saidasEmAberto),
        manutencoes: meu(dados.manutencoes),
        hoje,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [veiculos, dados.saidasEmAberto, dados.manutencoes, hoje, unidadeFiltro],
  );

  const alertas = useMemo(
    () =>
      alertasDaFrota({
        situacao,
        rascunhos: meu(dados.rascunhos),
        sinistros: meu(dados.sinistros),
        manutencoes: meu(dados.manutencoes),
        placaDe,
        hoje,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [situacao, dados.rascunhos, dados.sinistros, dados.manutencoes, hoje, unidadeFiltro],
  );

  const [mes, mesPassado] = useMemo(() => {
    const comum = {
      saidas: meu(dados.saidasFechadas),
      abastecimentos: meu(dados.abastecimentos),
      manutencoes: meu(dados.manutencoes),
      lotacoes: meu(dados.lotacoes),
    };
    return [
      resumoDoPeriodo({ periodo: mesCorrente(hoje), ...comum }),
      resumoDoPeriodo({ periodo: mesAnterior(hoje), ...comum }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, hoje, unidadeFiltro]);

  const naRua = situacao.filter((l) => l.situacao === "FORA");
  const contagem = (s: SituacaoFrota) => situacao.filter((l) => l.situacao === s).length;

  if (dados.isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Carregando o painel…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel da frota</h1>
          <p className="text-sm text-gray-500">
            {unidadeFiltro ? nomeUnidade.get(unidadeFiltro) ?? "Base" : "Todas as bases"}
            {" · "}
            {veiculos.length} {veiculos.length === 1 ? "veículo" : "veículos"}
            {" · "}
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/frota/movimentacoes"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ArrowRight className="size-4" />
            Movimentações
          </Link>
          <Link href="/frota"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Truck className="size-4" />
            Veículos
          </Link>
        </div>
      </div>

      {/* ── 1. Situação da frota ──────────────────────────── */}
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {SITUACOES_FROTA.map((s) => {
          const Icone = ICONE_SITUACAO[s];
          const n = contagem(s);
          return (
            <li key={s}
              className={cn("rounded-lg border p-3", CORES_SITUACAO[s].chip, n === 0 && "opacity-60")}>
              <div className="flex items-center gap-2">
                <Icone className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {ROTULO_SITUACAO_FROTA[s]}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{n}</p>
            </li>
          );
        })}
      </ul>

      {/* ── 2. O que precisa de alguém ────────────────────── */}
      <BlocoAlertas alertas={alertas} />

      {/* ── 3. Quem está na rua ───────────────────────────── */}
      <QuadroNaRua linhas={naRua} placaDe={placaDe} />

      {/* ── 4. Custo e consumo ────────────────────────────── */}
      <BlocoCustos mes={mes} anterior={mesPassado} />

      {/* ── 5. Oficina ────────────────────────────────────── */}
      <BlocoManutencao
        manutencoes={meu(dados.manutencoes).filter(manutencaoEstaAberta)}
        placaDe={placaDe}
      />
    </div>
  );
}

// ─── Alertas ────────────────────────────────────────────────────────────────

function BlocoAlertas({ alertas }: { alertas: ReturnType<typeof alertasDaFrota> }) {
  const [tudo, setTudo] = useState(false);
  const MAX = 5;
  const visiveis = tudo ? alertas : alertas.slice(0, MAX);

  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CircleCheck className="size-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">Nada pendente</p>
          <p className="text-xs text-emerald-800">
            Sem viagem parada, rascunho esquecido, sinistro sem desfecho ou revisão vencida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <AlertTriangle className="size-4 text-amber-600" />
          Precisa de alguém
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-gray-500">
            {alertas.length}
          </span>
        </h2>
        {alertas.length > MAX && (
          <button type="button" onClick={() => setTudo((v) => !v)}
            className="text-xs font-medium text-blue-600 hover:underline">
            {tudo ? "mostrar menos" : `ver os outros ${alertas.length - MAX}`}
          </button>
        )}
      </div>
      <ul className="divide-y divide-gray-100">
        {visiveis.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
              <span className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                a.nivel === "URGENTE" ? "bg-red-500" : "bg-amber-400",
              )} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{a.titulo}</span>
                <span className="block text-xs text-gray-500">{a.detalhe}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Quem está na rua ───────────────────────────────────────────────────────

function QuadroNaRua({
  linhas,
  placaDe,
}: {
  linhas: LinhaSituacao[];
  placaDe: (id: string) => string;
}) {
  const [fechando, setFechando] = useState<FrotaChecklist | null>(null);

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <MapPin className="size-4 text-blue-600" />
          Na rua agora
        </h2>
        <Link href="/frota/movimentacoes" className="text-xs font-medium text-blue-600 hover:underline">
          todas as viagens
        </Link>
      </div>

      {linhas.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          Nenhum veículo fora. Toda viagem registrada já voltou.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {linhas.map((l) => {
            const s = l.saidaAberta!;
            return (
              <li key={s.id_checklist} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/frota/${l.veiculo.id_veiculo}`}
                      className="font-mono text-sm font-bold tracking-wider text-gray-900 hover:text-blue-700">
                      {placaDe(l.veiculo.id_veiculo)}
                    </Link>
                    <span className="text-sm text-gray-700">{s.condutor_nome}</span>
                    {(l.diasFora ?? 0) >= 1 && (
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        (l.diasFora ?? 0) >= 3
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700",
                      )}>
                        {l.diasFora} {l.diasFora === 1 ? "dia" : "dias"} fora
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {enderecoEmLinha(s) || "sem destino registrado"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Saiu em {dataHoraBr(s.data_saida)} · {formatarKm(s.km_saida)} km ·{" "}
                    {l.veiculo.modelo}
                  </p>
                </div>
                <button type="button" onClick={() => setFechando(s)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                  <Undo2 className="size-4" />
                  Registrar retorno
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {fechando && (
        <RegistrarRetornoModal
          saida={fechando}
          placa={placaDe(fechando.id_veiculo)}
          aberto
          onFechar={() => setFechando(null)}
        />
      )}
    </section>
  );
}

// ─── Custo e consumo ────────────────────────────────────────────────────────

function BlocoCustos({ mes, anterior }: { mes: ResumoPeriodo; anterior: ResumoPeriodo }) {
  const total = mes.valorCombustivel + mes.valorManutencao;
  const totalAnterior = anterior.valorCombustivel + anterior.valorManutencao;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Fuel className="size-4 text-blue-600" />
          Custo e consumo em {mes.periodo.rotulo}
        </h2>
        <p className="text-xs text-gray-500">
          <strong className="text-sm tabular-nums text-gray-900">{moeda(total)}</strong> no mês
          <span className="text-gray-400">
            {" · "}
            {anterior.periodo.rotulo} fechou em {moeda(totalAnterior)}
          </span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Numero titulo="Km rodado" valor={`${formatarKm(mes.kmRodado)}`} unidade="km"
          rodape={
            mes.viagensSemKm > 0
              ? `${mes.viagensComKm} viagens contadas · ${mes.viagensSemKm} sem km`
              : `${mes.viagensComKm} ${mes.viagensComKm === 1 ? "viagem" : "viagens"} fechadas`
          } />
        <Numero titulo="Combustível" valor={moeda(mes.valorCombustivel)}
          rodape={`${numero(mes.litros)} litros`} />
        <Numero titulo="Manutenção" valor={moeda(mes.valorManutencao)} rodape="serviços do mês" />
        <Numero titulo="Consumo" valor={mes.consumoMedio ? numero(mes.consumoMedio, 1) : "—"}
          unidade="km/l"
          rodape={
            mes.consumoMedio == null
              ? "falta km fechado ou litro lançado"
              : mes.temTanqueParcial
                ? "aproximado — houve tanque parcial"
                : "aproximado"
          } />
        <Numero titulo="Custo por km" valor={mes.custoPorKm ? moeda(mes.custoPorKm) : "—"}
          rodape="combustível + oficina" destaque />
      </div>

      {/* O número só é honesto se a tela disser de onde ele veio. */}
      <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
        O km rodado vem das <strong>viagens fechadas</strong> (retorno com odômetro) e das mudanças
        de base com km informado. Viagem sem retorno registrado não entra em nenhuma destas contas —
        é por isso que fechar a viagem importa.
        {mes.viagensSemKm > 0 && (
          <>
            {" "}
            Neste mês, <strong className="text-amber-700">{mes.viagensSemKm}</strong>{" "}
            {mes.viagensSemKm === 1 ? "viagem voltou" : "viagens voltaram"} sem o km.
          </>
        )}
      </p>
    </section>
  );
}

function Numero({
  titulo, valor, unidade, rodape, destaque,
}: {
  titulo: string; valor: string; unidade?: string; rodape?: string; destaque?: boolean;
}) {
  return (
    <div className={cn("rounded-md p-3", destaque ? "bg-blue-50" : "bg-gray-50")}>
      <p className={cn(
        "font-mono text-[10px] uppercase tracking-wider",
        destaque ? "text-blue-700" : "text-gray-500",
      )}>
        {titulo}
      </p>
      <p className={cn(
        "mt-0.5 text-lg font-bold tabular-nums",
        destaque ? "text-blue-900" : "text-gray-900",
      )}>
        {valor}
        {unidade && <span className="ml-1 text-xs font-normal text-gray-400">{unidade}</span>}
      </p>
      {rodape && <p className="text-[11px] leading-tight text-gray-400">{rodape}</p>}
    </div>
  );
}

// ─── Oficina ────────────────────────────────────────────────────────────────

function BlocoManutencao({
  manutencoes,
  placaDe,
}: {
  manutencoes: ReturnType<typeof usePainelFrota>["manutencoes"];
  placaDe: (id: string) => string;
}) {
  if (manutencoes.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Wrench className="size-4 text-gray-400" />
          Oficina
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Nenhuma manutenção agendada ou em andamento.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <h2 className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900">
        <Wrench className="size-4 text-amber-600" />
        Na oficina ou agendado
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-gray-500">
          {manutencoes.length}
        </span>
      </h2>
      <ul className="divide-y divide-gray-100">
        {manutencoes.map((m) => (
          <li key={m.id_manutencao} className="px-4 py-2.5">
            <Link href={`/frota/${m.id_veiculo}`} className="block hover:opacity-80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-gray-900">
                  {placaDe(m.id_veiculo)}
                </span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  {ROTULO_TIPO_MANUTENCAO[m.tipo]}
                </span>
                <span className="text-sm text-gray-600">{m.descricao}</span>
              </div>
              <p className="text-xs text-gray-400">
                {[
                  `entrada ${dataBr(m.data_entrada)}`,
                  m.oficina,
                  m.valor != null ? moeda(m.valor) : null,
                  m.proxima_revisao_km != null
                    ? `próxima aos ${formatarKm(m.proxima_revisao_km)} km`
                    : null,
                  m.proxima_revisao_data ? `próxima em ${dataBr(m.proxima_revisao_data)}` : null,
                ].filter(Boolean).join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
