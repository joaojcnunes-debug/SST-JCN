"use client";

// Lista das empresas com fatores organizacionais marcados "Sim" nas triagens
// AEP. Mesma organização da página Riscos Psicossociais (2026-10-02): clicar
// abre a página da empresa, com os setores e o nível de cada fator na matriz
// AIHA. Sem link para o editor da AEP. Usada em /sinalizacao-psicossocial
// (módulo AEP) e em /aep-psicossocial (menu do Painel SST); `basePath` diz
// para onde vai o clique na empresa.
//
// 2026-10-05: cada empresa vira um cartão com as informações em destaque
// (DRPS/Questionário, AET, quem realizou, quem enviou, alertas, setores,
// entrega); contadores clicáveis no topo e filtros embaixo da busca.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Brain, Building2, ChevronRight, FilterX, MapPin, Search } from "lucide-react";
import { useAepsEntregues, useSituacaoQuestionarioEmpresas } from "@/lib/hooks/useAep";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { montarSinalizacao, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
import {
  FILTROS_VAZIOS,
  filtrarSinalizacao,
  filtrosAtivos,
  opcoesDistintas,
  questionarioPendente,
  type FiltrosSinalizacao,
} from "@/lib/aep/sinalizacao-filtros";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";
const selectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

/** Bloco de informação do cartão: rótulo pequeno + valor em destaque. */
function Bloco({
  rotulo,
  destaque = false,
  title,
  children,
}: {
  rotulo: string;
  destaque?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      title={title}
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2",
        destaque ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{rotulo}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900">{children}</div>
    </div>
  );
}

function Necessario({ sim }: { sim: boolean }) {
  return sim ? <span className="text-amber-800">Necessário</span> : <span className="font-normal text-gray-500">Não</span>;
}

/** O que a empresa já tem de DRPS/Questionário. */
function JaTem({ s }: { s: SituacaoQuestionario | undefined }) {
  if (!s) return null;
  if (s.fase === "concluido") return <div className="text-[11px] font-medium text-emerald-700">{s.doc} concluído</div>;
  if (s.fase === "andamento") return <div className="text-[11px] font-medium text-sky-700">{s.doc} em andamento</div>;
  return <div className="text-[11px] font-medium text-red-600">Nenhum feito</div>;
}

/** Contador do topo; clicar aplica o filtro correspondente. */
function Contador({
  rotulo,
  valor,
  cor,
  ativo,
  onClick,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition hover:shadow-sm",
        cor,
        ativo && "ring-2 ring-verde-primary ring-offset-1"
      )}
    >
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs font-medium">{rotulo}</div>
    </button>
  );
}

export default function SinalizacaoEmpresasLista({
  basePath,
  titulo = "Sinalização de Fatores Psicossociais",
  extra,
}: {
  basePath: string;
  titulo?: string;
  /** Bloco opcional entre o cabeçalho e a busca (ex.: explicação da matriz). */
  extra?: ReactNode;
}) {
  const { data: relatorios = [], isLoading, error } = useAepsEntregues(null);
  const [busca, setBusca] = useState("");
  const [f, setF] = useState<FiltrosSinalizacao>(FILTROS_VAZIOS);
  const set = (patch: Partial<FiltrosSinalizacao>) => setF((atual) => ({ ...atual, ...patch }));

  const empresas = useMemo(() => montarSinalizacao(relatorios), [relatorios]);
  const { data: unidades = [] } = useUnidades();
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [u.id_unidade, u.nome])), [unidades]);
  const { data: questionarios } = useSituacaoQuestionarioEmpresas(empresas.map((e) => e.idEmpresa));
  const regiao = (e: { municipio: string | null; uf: string | null }) =>
    [e.municipio, e.uf].filter(Boolean).join("/") || null;

  // Opções dos filtros: só o que existe na lista.
  const opcoesUnidade = useMemo(
    () =>
      opcoesDistintas(empresas.map((e) => e.idUnidade))
        .map((id) => ({ id, nome: nomeUnidade.get(id) ?? id }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [empresas, nomeUnidade]
  );
  const opcoesRealizada = useMemo(() => opcoesDistintas(empresas.map((e) => e.realizadaPor)), [empresas]);
  const opcoesEnviada = useMemo(() => opcoesDistintas(empresas.map((e) => e.enviadoPor)), [empresas]);

  const filtradas = useMemo(() => {
    const porBusca = busca.trim()
      ? buscar(empresas, busca, (e) => [
          e.nome,
          e.cnpj ?? "",
          (e.idUnidade && nomeUnidade.get(e.idUnidade)) || "",
          e.municipio ?? "",
          e.uf ?? "",
        ]).itens
      : empresas;
    return filtrarSinalizacao(porBusca, f, questionarios);
  }, [empresas, busca, nomeUnidade, f, questionarios]);

  const kpi = {
    altos: empresas.filter((e) => e.pior === "Alto" || e.pior === "Muito Alto").length,
    pendentes: empresas.filter((e) => questionarioPendente(e, questionarios?.[e.idEmpresa])).length,
    aet: empresas.filter((e) => e.precisaAet).length,
  };
  const nAtivos = filtrosAtivos(f) + (busca.trim() ? 1 : 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          {titulo}
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com fatores organizacionais identificados nas AEPs já entregues ao cliente, com o nível na matriz
          AIHA. Clique na empresa para ver os fatores por setor.
        </p>
      </div>

      {extra}

      {/* Contadores — clicar filtra a lista */}
      {empresas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Contador
            rotulo="Empresas sinalizadas"
            valor={empresas.length}
            cor="border-emerald-200 bg-emerald-50 text-emerald-800"
            ativo={false}
            onClick={() => {
              setF(FILTROS_VAZIOS);
              setBusca("");
            }}
          />
          <Contador
            rotulo="Nível Alto / Muito Alto"
            valor={kpi.altos}
            cor="border-red-200 bg-red-50 text-red-800"
            ativo={f.nivel === "altos"}
            onClick={() => set({ nivel: f.nivel === "altos" ? "" : "altos" })}
          />
          <Contador
            rotulo="DRPS/Questionário pendente"
            valor={kpi.pendentes}
            cor="border-amber-200 bg-amber-50 text-amber-800"
            ativo={f.questionario === "pendente"}
            onClick={() => set({ questionario: f.questionario === "pendente" ? "" : "pendente" })}
          />
          <Contador
            rotulo="AET necessária"
            valor={kpi.aet}
            cor="border-orange-200 bg-orange-50 text-orange-800"
            ativo={f.aet === "sim"}
            onClick={() => set({ aet: f.aet === "sim" ? "" : "sim" })}
          />
        </div>
      )}

      {/* Busca + filtros */}
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, unidade ou município..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="text-[11px] font-medium text-gray-500">
            Unidade
            <select value={f.unidade} onChange={(e) => set({ unidade: e.target.value })} className={selectCls}>
              <option value="">Todas</option>
              {opcoesUnidade.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Nível AIHA
            <select value={f.nivel} onChange={(e) => set({ nivel: e.target.value })} className={selectCls}>
              <option value="">Todos</option>
              <option value="altos">Alto ou Muito Alto</option>
              {["Muito Alto", "Alto", "Moderado", "Baixo", "Trivial"].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            DRPS/Questionário
            <select
              value={f.questionario}
              onChange={(e) => set({ questionario: e.target.value as FiltrosSinalizacao["questionario"] })}
              className={selectCls}
            >
              <option value="">Todos</option>
              <option value="necessario">Necessário</option>
              <option value="pendente">Necessário e ainda não concluído</option>
              <option value="nao">Não necessário</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            AET
            <select
              value={f.aet}
              onChange={(e) => set({ aet: e.target.value as FiltrosSinalizacao["aet"] })}
              className={selectCls}
            >
              <option value="">Todas</option>
              <option value="sim">Necessária</option>
              <option value="nao">Não necessária</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Entrega
            <select
              value={f.entrega}
              onChange={(e) => set({ entrega: e.target.value as FiltrosSinalizacao["entrega"] })}
              className={selectCls}
            >
              <option value="">Todas</option>
              <option value="com">Com inspeção</option>
              <option value="sem">Sem inspeção</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Realizada por
            <select value={f.realizadaPor} onChange={(e) => set({ realizadaPor: e.target.value })} className={selectCls}>
              <option value="">Todos</option>
              {opcoesRealizada.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Enviada por
            <select value={f.enviadaPor} onChange={(e) => set({ enviadaPor: e.target.value })} className={selectCls}>
              <option value="">Todos</option>
              {opcoesEnviada.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtradas.length} de {empresas.length} empresa{empresas.length !== 1 ? "s" : ""}
          </span>
          {nAtivos > 0 && (
            <button
              type="button"
              onClick={() => {
                setF(FILTROS_VAZIOS);
                setBusca("");
              }}
              className="inline-flex items-center gap-1 font-semibold text-verde-primary hover:underline"
            >
              <FilterX className="size-3.5" /> Limpar filtros ({nAtivos})
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as análises: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado em AEP entregue ao cliente." : "Nenhuma empresa encontrada com esses filtros."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((e) => {
            const quest = questionarios?.[e.idEmpresa];
            return (
              <li key={e.idEmpresa}>
                <Link
                  href={`${basePath}/${encodeURIComponent(e.idEmpresa)}`}
                  className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-verde-primary/40 hover:shadow-md"
                >
                  {/* Linha 1: empresa, unidade/região, nível */}
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 size-5 shrink-0 text-verde-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-gray-900">{e.nome}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span>{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          <span className="font-medium text-gray-700">
                            {(e.idUnidade && nomeUnidade.get(e.idUnidade)) || "Sem unidade"}
                          </span>
                          <span className="text-gray-400">· {regiao(e) ?? "região não informada"}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" title="Maior nível AIHA entre os fatores da empresa">
                      <SeloNivelAiha nivel={e.pior} />
                      <ChevronRight className="size-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Linha 2: blocos em destaque */}
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                    <Bloco
                      rotulo="DRPS/Questionário"
                      destaque={questionarioPendente(e, quest)}
                      title="3+ alertas organizacionais na AEP recomendam DRPS/Questionário Psicossocial (NR-01)"
                    >
                      <Necessario sim={e.precisaQuestionario} />
                      <JaTem s={quest} />
                    </Bloco>
                    <Bloco rotulo="AET" destaque={e.precisaAet} title="Algum setor com indicação de Análise Ergonômica do Trabalho">
                      <Necessario sim={e.precisaAet} />
                    </Bloco>
                    <Bloco rotulo="Realizada por">
                      <div className="truncate" title={e.realizadaPor ?? undefined}>
                        {e.realizadaPor ?? "—"}
                      </div>
                    </Bloco>
                    <Bloco rotulo="Enviada por">
                      <div className="truncate" title={e.enviadoPor ?? undefined}>
                        {e.temInspecao ? (e.enviadoPor ?? "—") : <span className="font-normal text-gray-500">Sem inspeção</span>}
                      </div>
                    </Bloco>
                    <Bloco rotulo="Alertas">{e.totalAlertas}</Bloco>
                    <Bloco rotulo="Setores">{e.totalSetores}</Bloco>
                    <Bloco rotulo="Entregue em">{e.ultimaData ? fmtData(e.ultimaData) : "—"}</Bloco>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
