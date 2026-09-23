"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Fuel,
  History,
  MapPin,
  TriangleAlert,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react";
import { useChecklistsDoVeiculo, useRotasDeChecklists } from "@/lib/hooks/useFrotaChecklists";
import { useAbastecimentosDoVeiculo } from "@/lib/hooks/useFrotaAbastecimentos";
import { useSinistrosDoVeiculo } from "@/lib/hooks/useFrotaSinistros";
import { useManutencoesDoVeiculo } from "@/lib/hooks/useFrotaManutencoes";
import { useLotacoesDoVeiculo } from "@/lib/hooks/useFrotaLotacoes";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { formatarKm } from "@/lib/frota/km";
import { dataHoraBr } from "@/lib/frota/painel";
import {
  contarPorTipo,
  montarHistorico,
  ROTULO_TIPO_EVENTO,
  TIPOS_EVENTO,
  type EventoHistorico,
  type TipoEvento,
} from "@/lib/frota/historico";
import type { FrotaVeiculo } from "@/lib/frota/tipos";
import { cn } from "@/lib/utils";

/**
 * A aba HISTÓRICO da ficha do veículo.
 *
 * Uma linha do tempo só, com tudo que aconteceu com o carro: cadastro, saídas,
 * retornos, percurso de cada viagem, abastecimentos, sinistros, manutenções e
 * mudanças de base. As outras abas continuam existindo para quem quer trabalhar
 * dentro de um assunto; esta existe para quem quer entender o carro.
 *
 * OS FILTROS SÃO POR TIPO, e não por data, porque a pergunta real quase nunca é
 * "o que houve em julho" — é "onde este carro já se meteu" ou "quanto já se
 * gastou com ele". Data a lista já traz agrupada, de graça.
 */

const ICONE: Record<TipoEvento, typeof Truck> = {
  CADASTRO: Truck,
  SAIDA: MapPin,
  RETORNO: Undo2,
  ABASTECIMENTO: Fuel,
  SINISTRO: TriangleAlert,
  MANUTENCAO: Wrench,
  LOTACAO: Building2,
};

const COR: Record<TipoEvento, string> = {
  CADASTRO: "bg-gray-100 text-gray-600 ring-gray-200",
  SAIDA: "bg-blue-50 text-blue-700 ring-blue-200",
  RETORNO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ABASTECIMENTO: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  SINISTRO: "bg-red-50 text-red-700 ring-red-200",
  MANUTENCAO: "bg-amber-50 text-amber-700 ring-amber-200",
  LOTACAO: "bg-violet-50 text-violet-700 ring-violet-200",
};

const MES_ANO = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sem data";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function HistoricoTab({ veiculo }: { veiculo: FrotaVeiculo }) {
  const id = veiculo.id_veiculo;

  const { data: saidas = [], isLoading: carregandoSaidas } = useChecklistsDoVeiculo(id);
  const { data: abastecimentos = [] } = useAbastecimentosDoVeiculo(id);
  const { data: sinistros = [] } = useSinistrosDoVeiculo(id);
  const { data: manutencoes = [] } = useManutencoesDoVeiculo(id);
  const { data: lotacoes = [] } = useLotacoesDoVeiculo(id);
  const { data: unidades = [] } = useUnidades();

  // As rotas dependem das saídas: a consulta só dispara quando a lista chega.
  const idsSaida = useMemo(() => saidas.map((s) => s.id_checklist), [saidas]);
  const { data: rotas = [] } = useRotasDeChecklists(idsSaida);

  const nomeBase = useMemo(() => {
    const m = new Map(unidades.map((u) => [u.id_unidade, u.nome]));
    return (idUnidade: string | null) =>
      idUnidade ? m.get(idUnidade) ?? "base desconhecida" : "primeira lotação";
  }, [unidades]);

  const eventos = useMemo(
    () =>
      montarHistorico({
        veiculo, saidas, rotas, abastecimentos, sinistros, manutencoes, lotacoes, nomeBase,
      }),
    [veiculo, saidas, rotas, abastecimentos, sinistros, manutencoes, lotacoes, nomeBase],
  );

  const contagem = useMemo(() => contarPorTipo(eventos), [eventos]);
  const [tipos, setTipos] = useState<Set<TipoEvento>>(new Set());
  const [soProblemas, setSoProblemas] = useState(false);

  const visiveis = useMemo(
    () =>
      eventos.filter((e) => {
        if (tipos.size > 0 && !tipos.has(e.tipo)) return false;
        if (soProblemas && !e.problema) return false;
        return true;
      }),
    [eventos, tipos, soProblemas],
  );

  const alternar = (t: TipoEvento) =>
    setTipos((atual) => {
      const novo = new Set(atual);
      if (novo.has(t)) novo.delete(t);
      else novo.add(t);
      return novo;
    });

  // Agrupamento por mês, preservando a ordem já resolvida em montarHistorico.
  const grupos = useMemo(() => {
    const mapa = new Map<string, EventoHistorico[]>();
    for (const e of visiveis) {
      const chave = MES_ANO(e.quando);
      const atual = mapa.get(chave) ?? [];
      atual.push(e);
      mapa.set(chave, atual);
    }
    return [...mapa.entries()];
  }, [visiveis]);

  const totalProblemas = eventos.filter((e) => e.problema).length;

  if (carregandoSaidas) {
    return <p className="py-10 text-center text-sm text-gray-500">Carregando o histórico…</p>;
  }

  return (
    <div className="space-y-3">
      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2.5">
        {TIPOS_EVENTO.filter((t) => contagem[t] > 0).map((t) => {
          const Icone = ICONE[t];
          const ativo = tipos.has(t);
          return (
            <button key={t} type="button" onClick={() => alternar(t)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                ativo
                  ? "border-blue-500 bg-blue-600 font-semibold text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
              )}>
              <Icone className="size-3" />
              {ROTULO_TIPO_EVENTO[t]}
              <span className={cn("tabular-nums", ativo ? "text-blue-100" : "text-gray-400")}>
                {contagem[t]}
              </span>
            </button>
          );
        })}

        {totalProblemas > 0 && (
          <button type="button" onClick={() => setSoProblemas((v) => !v)}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              soProblemas
                ? "border-red-500 bg-red-600 font-semibold text-white"
                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
            )}>
            <TriangleAlert className="size-3" />
            Só o que deu problema
            <span className={cn("tabular-nums", soProblemas ? "text-red-100" : "text-red-400")}>
              {totalProblemas}
            </span>
          </button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
          <History className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nada com esses filtros</p>
          <p className="mt-1 text-sm text-gray-500">Tire um filtro para ver o resto da história.</p>
        </div>
      ) : (
        grupos.map(([mes, doMes]) => (
          <section key={mes}>
            <h3 className="sticky top-0 z-10 bg-gray-50/95 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 backdrop-blur">
              {mes}
            </h3>
            <ol className="relative space-y-2 border-l border-gray-200 pl-4">
              {doMes.map((e) => (
                <Linha key={e.id} evento={e} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

function Linha({ evento: e }: { evento: EventoHistorico }) {
  const Icone = ICONE[e.tipo];

  const corpo = (
    <div className="rounded-lg border border-gray-200 bg-white p-3 transition-colors group-hover:border-blue-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{e.titulo}</p>
          {e.detalhe && <p className="mt-0.5 text-xs text-gray-500">{e.detalhe}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[11px] tabular-nums text-gray-400">{dataHoraBr(e.quando)}</p>
          {e.km != null && (
            <p className="font-mono text-[11px] tabular-nums text-gray-400">
              {formatarKm(e.km)} km
            </p>
          )}
        </div>
      </div>

      {/* O PERCURSO. Ele existia no banco desde a v177 e só aparecia dentro da
          saída — nunca na história do carro, que é onde ele conta algo. */}
      {e.trechos.length > 0 && (
        <ol className="mt-2 space-y-0.5 rounded-md bg-gray-50 px-2.5 py-1.5">
          {e.trechos.map((t, i) => (
            <li key={i} className="flex items-baseline gap-1.5 text-xs text-gray-600">
              <span className="font-mono text-[10px] text-gray-400">{i + 1}.</span>
              {t}
            </li>
          ))}
        </ol>
      )}

      {e.problema && (
        <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          {e.problema}
        </p>
      )}
    </div>
  );

  return (
    <li className="group relative">
      <span className={cn(
        "absolute -left-[1.4rem] top-3 flex size-5 items-center justify-center rounded-full ring-2",
        COR[e.tipo],
      )}>
        <Icone className="size-3" />
      </span>
      {e.href ? (
        <Link href={e.href} className="block">
          {corpo}
          <ChevronRight className="pointer-events-none absolute right-2 top-3.5 size-4 text-gray-300 group-hover:text-blue-500" />
        </Link>
      ) : (
        corpo
      )}
    </li>
  );
}
