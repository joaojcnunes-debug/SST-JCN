"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Truck,
  X,
  ImageOff,
  ClipboardCheck,
  LayoutDashboard,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import { useExcluirVeiculo, useFrotaVeiculosLista } from "@/lib/hooks/useFrotaVeiculos";
import { useSaidasEmAberto } from "@/lib/hooks/useFrotaChecklists";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useListaProgressiva } from "@/lib/hooks/useListaProgressiva";
import { formatarPlaca } from "@/lib/frota/placa";
import { formatarKm, kmEfetivo, kmRodadoDesdeCadastro } from "@/lib/frota/km";
import type { FrotaChecklist } from "@/lib/frota/tipos";
import {
  ROTULO_STATUS_VEICULO,
  ROTULO_TIPO_VEICULO,
  STATUS_VEICULO,
  TIPOS_VEICULO,
  type FrotaVeiculoLista,
  type StatusVeiculo,
} from "@/lib/frota/tipos";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { cn } from "@/lib/utils";

/**
 * Visão geral da frota. Espelha a tela de Equipamentos: mesmos filtros, mesma
 * grade, mesma lista progressiva — quem usa um módulo interno já sabe usar este.
 *
 * O que é próprio daqui: a PLACA é o identificador que a pessoa tem na mão, então
 * ela é o título do card, em fonte monoespaçada e no formato com hífen. E o card
 * mostra os DOIS registros de km (cadastro e atual), porque o rodado é a
 * informação que o gerente abre a tela para ver.
 */

const STATUS_CORES: Record<StatusVeiculo, string> = {
  ATIVO: "bg-emerald-100 text-emerald-700",
  MANUTENCAO: "bg-amber-100 text-amber-700",
  INATIVO: "bg-gray-100 text-gray-600",
  VENDIDO: "bg-red-100 text-red-700",
};

export default function FrotaPage() {
  // useSearchParams() exige limite de Suspense para o build do Next não falhar.
  return (
    <Suspense fallback={null}>
      <FrotaConteudo />
    </Suspense>
  );
}

function FrotaConteudo() {
  const params = useSearchParams();
  const unidadeFiltro = params.get("unidade");

  const { data: veiculos = [], isLoading } = useFrotaVeiculosLista();
  const { data: unidades = [] } = useUnidades();
  const { data: saidasEmAberto = [] } = useSaidasEmAberto();

  // Quem está na rua, por veículo. Sem isto a lista mostra um card idêntico
  // para o carro parado no pátio e para o que está a 200 km daqui — que era
  // exatamente a queixa sobre esta tela.
  const naRuaPorVeiculo = useMemo(() => {
    const m = new Map<string, FrotaChecklist>();
    for (const s of saidasEmAberto) {
      const atual = m.get(s.id_veiculo);
      if (!atual || new Date(s.data_saida) < new Date(atual.data_saida)) m.set(s.id_veiculo, s);
    }
    return m;
  }, [saidasEmAberto]);

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("TODOS");
  const [statusFiltro, setStatusFiltro] = useState<string>("TODOS");

  const nomeUnidade = useMemo(
    () => new Map(unidades.map((u) => [u.id_unidade, u.nome])),
    [unidades],
  );

  const { itens: filtrados, aproximado } = useMemo(() => {
    const dosFiltros = veiculos.filter((v) => {
      if (unidadeFiltro && v.id_unidade !== unidadeFiltro) return false;
      if (tipoFiltro !== "TODOS" && (v.tipo ?? "") !== tipoFiltro) return false;
      if (statusFiltro !== "TODOS" && v.status !== statusFiltro) return false;
      return true;
    });
    // A placa entra SEM separador: quem digita "rjp2a45" tem de achar a placa
    // gravada como "RJP-2A45" (e "rjp-2a45" também acha, por pedaço).
    // Tolerante a acento e erro de digitação no modelo/marca/cor; mantém a ordem.
    return buscar(
      dosFiltros,
      busca,
      (v) => [v.placa.replace(/[^a-z0-9]/gi, ""), v.modelo, v.marca, v.cor],
      { manterOrdem: true },
    );
  }, [veiculos, unidadeFiltro, tipoFiltro, statusFiltro, busca]);

  const { visiveis, sentinela, mostrandoTudo } = useListaProgressiva(filtrados);

  const contagemPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of veiculos) {
      if (unidadeFiltro && v.id_unidade !== unidadeFiltro) continue;
      if (statusFiltro !== "TODOS" && v.status !== statusFiltro) continue;
      const t = (v.tipo ?? "").trim();
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [veiculos, unidadeFiltro, statusFiltro]);

  const temFiltro =
    !!unidadeFiltro || tipoFiltro !== "TODOS" || statusFiltro !== "TODOS" || !!busca.trim();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Frota JCN Consultoria</h1>
          <p className="text-sm text-gray-500">
            {unidadeFiltro ? nomeUnidade.get(unidadeFiltro) ?? "Base" : "Todas as bases"}
            {" · "}
            {filtrados.length} {filtrados.length === 1 ? "veículo" : "veículos"}
            {temFiltro && veiculos.length !== filtrados.length && (
              <span className="text-gray-400"> de {veiculos.length}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/frota/painel"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <LayoutDashboard className="size-4" />
            Painel
          </Link>
          <Link
            href="/frota/novo"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="size-4" />
            Novo veículo
          </Link>
        </div>
      </div>

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Placa, modelo, marca, cor…"
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="TODOS">Todos os tipos</option>
          {TIPOS_VEICULO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_VEICULO[t]}
              {contagemPorTipo.get(t) ? ` (${contagemPorTipo.get(t)})` : ""}
            </option>
          ))}
        </select>

        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="TODOS">Todas as situações</option>
          {STATUS_VEICULO.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS_VEICULO[s]}
            </option>
          ))}
        </select>

        {unidadeFiltro && (
          <Link
            href="/frota"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X className="size-3.5" />
            {nomeUnidade.get(unidadeFiltro) ?? "base"}
          </Link>
        )}
      </div>

      {/* ── Lista ─────────────────────────────────────────── */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <Truck className="mx-auto size-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {temFiltro ? "Nenhum veículo com esses filtros" : "Nenhum veículo cadastrado"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {temFiltro
              ? "Tente afrouxar a busca ou os filtros."
              : "Comece cadastrando o primeiro — placa, modelo e o km de hoje."}
          </p>
        </div>
      ) : (
        <>
          <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={filtrados.length} className="mb-2" />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((v) => (
              <li key={v.id_veiculo}>
                <Card
                  veiculo={v}
                  base={nomeUnidade.get(v.id_unidade) ?? null}
                  naRua={naRuaPorVeiculo.get(v.id_veiculo) ?? null}
                />
              </li>
            ))}
          </ul>
          {/* Sentinela: entra em cena antes do fim e puxa a próxima leva. */}
          {!mostrandoTudo && (
            <div ref={sentinela} className="py-6 text-center text-sm text-gray-400">
              carregando mais…
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({
  veiculo: v,
  base,
  naRua,
}: {
  veiculo: FrotaVeiculoLista;
  base: string | null;
  naRua: FrotaChecklist | null;
}) {
  const rodado = kmRodadoDesdeCadastro(v);
  const excluir = useExcluirVeiculo();

  return (
    <div className="group relative flex h-full gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-blue-300 focus-within:border-blue-400">
      {/*
        O CARD INTEIRO ABRE A FICHA (pedido dele, 2026-08-18).
        Antes só a foto e a placa levavam para lá: o resto do cartão — modelo,
        km, "na rua com fulano", base — parecia clicável e não era, e a ficha
        acabava sendo alcançada por acaso, voltando de "Registrar saída".

        POR QUE UM LINK SOBREPOSTO E NÃO UM LINK EM VOLTA DE TUDO
          O cartão já carrega três controles próprios (Editar, Excluir, Saída).
          Envolver tudo num <Link> aninharia link dentro de link e botão dentro
          de link — HTML inválido, que os navegadores "consertam" cada um do seu
          jeito. Aqui o link cobre o cartão por baixo, e os três controles sobem
          com `relative z-10`: clicar neles faz o que eles fazem, clicar em
          qualquer outro lugar abre a ficha.

        O preço, sabido: não dá para selecionar o texto do cartão com o mouse.
        Num cartão de lista isso não é o que ninguém veio fazer.
      */}
      <Link
        href={`/frota/${v.id_veiculo}`}
        aria-label={`Abrir a ficha de ${formatarPlaca(v.placa)}`}
        className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      />

      {/* Miniatura 320 px — a lista NUNCA baixa a original. É o que faz a aba
          abrir com ~840 kB em vez de dezenas de MB. */}
      <div className="shrink-0">
        {v.foto_capa_thumb_path ? (
          <StorageImg
            stored={v.foto_capa_thumb_path}
            alt={`Veículo ${v.placa}`}
            className="size-16 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-md bg-gray-50 text-gray-300">
            <ImageOff className="size-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* A placa é o título: é o que a pessoa tem na mão ao procurar. */}
            <p className="truncate font-mono text-sm font-bold tracking-wider text-gray-900 group-hover:text-blue-700">
              {formatarPlaca(v.placa)}
            </p>
            <p className="truncate text-sm text-gray-600">{v.modelo}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
              STATUS_CORES[v.status],
            )}
          >
            {ROTULO_STATUS_VEICULO[v.status]}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-gray-500">
          {[v.marca, v.ano_modelo, v.cor, v.tipo ? ROTULO_TIPO_VEICULO[v.tipo] : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* Os dois registros de km, lado a lado. O rodado é derivado, não coluna. */}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
          <span className="tabular-nums font-medium text-gray-700">
            {formatarKm(kmEfetivo(v))} km
          </span>
          {rodado > 0 && (
            <span className="tabular-nums text-gray-400">
              +{formatarKm(rodado)} desde o cadastro
            </span>
          )}
        </div>

        {/* Está na rua? A lista tinha de dizer isso antes de qualquer outra
            coisa: é a diferença entre pegar a chave e procurar o carro no pátio. */}
        {naRua && (
          <p className="mt-1 flex items-center gap-1 truncate rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800">
            <MapPin className="size-3 shrink-0" />
            Na rua com {naRua.condutor_nome}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-gray-400">{base ?? "—"}</span>

          {/* `relative z-10`: estes três ficam ACIMA do link que cobre o
              cartão. Sem isso, clicar em Excluir abriria a ficha. */}
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            {/* Editar e Excluir também AQUI, não só na ficha. Estavam a dois
                cliques de distância e por isso pareciam não existir. */}
            <Link
              href={`/frota/${v.id_veiculo}/editar`}
              aria-label={`Editar ${formatarPlaca(v.placa)}`}
              className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-blue-600"
            >
              <Pencil className="size-3.5" />
            </Link>
            <button
              type="button"
              aria-label={`Excluir ${formatarPlaca(v.placa)}`}
              disabled={excluir.isPending}
              onClick={() => {
                // A verificação de histórico vive no hook, não aqui: ela precisa
                // valer para qualquer caminho que chame a exclusão, e consultar
                // as contagens de todos os cards da lista seria uma consulta por
                // veículo só para desenhar um botão. Se houver histórico, o hook
                // recusa e o aviso chega com o motivo.
                if (
                  confirm(
                    `Excluir o veículo ${formatarPlaca(v.placa)}?\n\n` +
                      `Se ele já tiver saídas, abastecimentos ou manutenções registradas, a ` +
                      `exclusão será recusada — o histórico não se apaga.`,
                  )
                ) {
                  excluir.mutate(v.id_veiculo);
                }
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
            <Link
              href={`/frota/${v.id_veiculo}/saida`}
              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
            >
              <ClipboardCheck className="size-3" />
              Saída
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
