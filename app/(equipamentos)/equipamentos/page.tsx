"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, ImageOff, X, HardDrive, User } from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import { useEquipamentosLista, type EquipamentoLista } from "@/lib/hooks/useEquipamentos";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useListaProgressiva } from "@/lib/hooks/useListaProgressiva";
import { TIPOS_EQUIPAMENTO, TIPOS_PLANOS, grupoDoTipo } from "@/lib/equipamentos/tipos";
import { STATUS_MAQUINA_LABELS, type StatusMaquina } from "@/lib/supabase/types";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import EstoquePorQuantidade from "@/components/equipamentos/EstoquePorQuantidade";
import { cn } from "@/lib/utils";

const STATUS_CORES: Record<StatusMaquina, string> = {
  OPERANTE: "bg-emerald-100 text-emerald-700",
  MANUTENCAO: "bg-amber-100 text-amber-700",
  INATIVA: "bg-gray-100 text-gray-600",
  BAIXADA: "bg-red-100 text-red-700",
  RESERVA: "bg-blue-100 text-blue-700",
};

export default function EquipamentosPage() {
  // useSearchParams() exige limite de Suspense para o build do Next não falhar.
  return (
    <Suspense fallback={null}>
      <EquipamentosConteudo />
    </Suspense>
  );
}

function EquipamentosConteudo() {
  const params = useSearchParams();
  const unidadeFiltro = params.get("unidade");

  const { data: equipamentos = [], isLoading } = useEquipamentosLista();
  const { data: unidades = [] } = useUnidades();

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("TODOS");
  const [statusFiltro, setStatusFiltro] = useState<string>("TODOS");

  const nomeUnidade = useMemo(
    () => new Map(unidades.map((u) => [u.id_unidade, u.nome])),
    [unidades]
  );

  const { itens: filtrados, aproximado } = useMemo(() => {
    const dosFiltros = equipamentos.filter((e) => {
      if (unidadeFiltro && e.id_unidade !== unidadeFiltro) return false;
      if (tipoFiltro !== "TODOS" && (e.tipo ?? "") !== tipoFiltro) return false;
      if (statusFiltro !== "TODOS" && e.status !== statusFiltro) return false;
      return true;
    });
    // A busca cobre os campos que a pessoa tem na mão ao procurar um item:
    // a plaqueta, a etiqueta e o número de série — nenhum deles aparece no card.
    // E com quem está: "o que está com a Daniele?" é pergunta de balcão.
    // Tolerante a acento, ordem das palavras e erro de digitação; mantém a ordem.
    return buscar(
      dosFiltros,
      busca,
      (e) => [
        e.nome, e.tipo, e.fabricante, e.modelo, e.setor, e.localizacao,
        e.numero_serie, e.numero_patrimonio, e.codigo_interno, e.tag,
        e.colaborador?.nome, e.responsavel,
      ],
      { manterOrdem: true },
    );
  }, [equipamentos, unidadeFiltro, tipoFiltro, statusFiltro, busca]);

  // Monta a lista aos poucos: cada card dispara uma assinatura de URL por foto,
  // e montar 99 de uma vez é o que fazia a tela do inventário demorar a aparecer.
  const { visiveis, sentinela, mostrandoTudo } = useListaProgressiva(filtrados);

  // Contagem por tipo, do conjunto JÁ filtrado por base e situação — é o número
  // que a pessoa espera ver ao lado do filtro, não o total da tabela.
  const contagemPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of equipamentos) {
      if (unidadeFiltro && e.id_unidade !== unidadeFiltro) continue;
      if (statusFiltro !== "TODOS" && e.status !== statusFiltro) continue;
      const t = (e.tipo ?? "").trim();
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [equipamentos, unidadeFiltro, statusFiltro]);

  const tiposForaDaLista = useMemo(
    () =>
      [...contagemPorTipo.entries()]
        .filter(([t]) => t && !TIPOS_PLANOS.includes(t))
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR")),
    [contagemPorTipo],
  );

  const temFiltro =
    !!unidadeFiltro || tipoFiltro !== "TODOS" || statusFiltro !== "TODOS" || !!busca.trim();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Equipamentos JCN Consultoria</h1>
          <p className="text-sm text-gray-500">
            {unidadeFiltro
              ? nomeUnidade.get(unidadeFiltro) ?? "Base"
              : "Todas as bases"}
            {" · "}
            {filtrados.length} {filtrados.length === 1 ? "item" : "itens"}
            {temFiltro && equipamentos.length !== filtrados.length && (
              <span className="text-gray-400"> de {equipamentos.length}</span>
            )}
          </p>
        </div>
        <Link
          href="/equipamentos/novo"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="size-4" />
          Novo equipamento
        </Link>
      </div>

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, patrimônio, série, etiqueta…"
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="TODOS">Todos os tipos</option>
          {TIPOS_EQUIPAMENTO.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                  {contagemPorTipo.get(t) ? ` (${contagemPorTipo.get(t)})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
          {/* Tipo digitado à mão (fora da lista fixa) também precisa ser filtrável —
              senão 7 TVs gravadas como "Tv"/"TV" ficam invisíveis para o filtro. */}
          {tiposForaDaLista.length > 0 && (
            <optgroup label="Fora da lista (digitados à mão)">
              {tiposForaDaLista.map(([t, n]) => (
                <option key={t} value={t}>
                  {t} ({n})
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="TODOS">Todas as situações</option>
          {(Object.keys(STATUS_MAQUINA_LABELS) as StatusMaquina[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_MAQUINA_LABELS[s]}
            </option>
          ))}
        </select>

        {unidadeFiltro && (
          <Link
            href="/equipamentos"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X className="size-3.5" />
            {nomeUnidade.get(unidadeFiltro) ?? "base"}
          </Link>
        )}
      </div>

      {/* ── Estoque por quantidade (periféricos) ───────────
          Respeita os mesmos filtros de base, tipo e busca. Situação não se
          aplica: saldo não tem status. */}
      <EstoquePorQuantidade
        unidadeFiltro={unidadeFiltro}
        tipoFiltro={tipoFiltro}
        busca={busca}
        nomeUnidade={nomeUnidade}
      />

      {/* ── Lista ─────────────────────────────────────────── */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <HardDrive className="mx-auto size-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {temFiltro ? "Nenhum equipamento com esses filtros" : "Nenhum equipamento cadastrado"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {temFiltro ? "Tente afrouxar a busca ou os filtros." : "Comece cadastrando o primeiro."}
          </p>
        </div>
      ) : (
        <>
          <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={filtrados.length} className="mb-2" />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((e) => (
              <li key={e.id_equipamento}>
                <Card equipamento={e} base={nomeUnidade.get(e.id_unidade) ?? null} />
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
  equipamento: e,
  base,
}: {
  equipamento: EquipamentoLista;
  base: string | null;
}) {
  const linha2 = [e.fabricante, e.modelo].filter(Boolean).join(" · ");
  const linha3 = [base, e.setor ?? e.localizacao].filter(Boolean).join(" · ");
  // Com quem está. A retirada (termo assinado) manda; sem retirada em aberto
  // vale o "Responsável" digitado no cadastro — é o que os itens herdados do
  // inventário têm. Nada preenchido = está na base, e o card não diz nada.
  const comQuem = e.colaborador?.nome ?? (e.responsavel ?? "").trim();
  const desde = e.colaborador && e.entregue_em
    ? new Date(e.entregue_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  return (
    <Link
      href={`/equipamentos/${e.id_equipamento}`}
      className="flex h-full gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
        {e.foto_url ? (
          <StorageImg
            // Miniatura (~25 kB). Os 99 itens migrados já vêm com ela: a v163
            // copia `foto_thumb_path` junto, então a lista não baixa original.
            stored={e.foto_thumb_path ?? e.foto_url}
            alt={e.nome}
            className="size-full object-cover"
            loading="lazy"
            width={64}
            height={64}
          />
        ) : (
          <ImageOff className="size-6 text-gray-300" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{e.nome}</p>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
              STATUS_CORES[e.status]
            )}
          >
            {STATUS_MAQUINA_LABELS[e.status]}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-gray-500">
          {e.tipo ? (
            <span className="text-gray-600">
              {e.tipo}
              <span className="text-gray-400"> · {grupoDoTipo(e.tipo)}</span>
            </span>
          ) : (
            <span className="text-gray-400">sem tipo</span>
          )}
        </p>

        {linha2 && <p className="truncate text-xs text-gray-500">{linha2}</p>}
        {linha3 && <p className="truncate text-xs text-gray-400">{linha3}</p>}

        {comQuem && (
          <p
            className="mt-0.5 flex items-center gap-1 text-xs text-gray-600"
            title={desde ? `Retirado por ${comQuem} em ${desde}` : `Responsável: ${comQuem}`}
          >
            <User className="size-3 shrink-0 text-gray-400" />
            <span className="truncate">
              com <span className="font-medium text-gray-800">{comQuem}</span>
              {desde && <span className="text-gray-400"> · desde {desde}</span>}
            </span>
          </p>
        )}

        {e.numero_patrimonio && (
          <p className="mt-1 font-mono text-[11px] text-gray-500">
            patrimônio {e.numero_patrimonio}
          </p>
        )}
      </div>
    </Link>
  );
}
