"use client";

// QPS — tela de Resumo da área de Questionários Psicossociais.
//
// É a ÚNICA tela da área que enxerga a carteira inteira: todas as outras exigem
// escolher uma empresa antes de mostrar qualquer coisa (decisão do usuário em
// 2026-08-10). Por isso não há seletor de empresa aqui.
//
// Estrutura, de cima para baixo: o QUADRO DE STATUS da carteira → o que
// precisa de atenção → onde o trabalho está parado → o retrato clínico.
//
// O quadro subiu para o topo em 10/09, a pedido dele ("pode colocar ele a
// frente dos riscos"). Antes ficava abaixo dos alertas, e nesta base isso
// significava duas telas de rolagem antes de ver a carteira: são 13 alertas.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  ClipboardCheck,
  Grid3x3,
  Loader2,
  Percent,
  Users,
} from "lucide-react";
import { useQpsResumo, type AplicacaoResumo, type EtapaQps } from "@/lib/hooks/useQpsResumo";
import QuadroStatusQps from "@/components/questionarios/QuadroStatusQps";
import { cn } from "@/lib/utils";

const ETAPAS: { chave: EtapaQps; nome: string; sub: string }[] = [
  { chave: "COLETA", nome: "Coleta", sub: "sem respondente" },
  { chave: "ANALISE", nome: "Análise", sub: "sem plano de ação" },
  { chave: "PLANO", nome: "Plano de ação", sub: "em tratamento" },
  { chave: "CONCLUIDO", nome: "Concluído", sub: "encerrada" },
];

export default function QpsResumoPage() {
  const { data, isLoading, isError } = useQpsResumo();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" /> Carregando resumo...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="py-24 text-center text-sm text-red-600">
        Erro ao carregar o resumo.
      </p>
    );
  }

  const { totais, aplicacoes, dimensoes, tipos } = data;

  const tiposVazios = tipos.filter((t) => t.nPerguntas === 0);
  const paradasAntigas = aplicacoes
    .filter((a) => a.etapa !== "CONCLUIDO" && a.diasParado >= 30)
    .sort((a, b) => b.diasParado - a.diasParado);
  const semRespondente = aplicacoes.filter((a) => a.nRespondentes === 0);

  const temAlerta =
    semRespondente.length > 0 ||
    paradasAntigas.length > 0 ||
    tiposVazios.length > 0;

  const maxAlto = Math.max(1, ...dimensoes.map((d) => d.alto + d.moderado));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BarChart2 className="size-5 text-indigo-600" />
          Resumo
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Todas as aplicações, de todas as empresas
        </p>
      </div>

      {/* ── Quadro de status (v206) ─────────────────────────────────────
          PRIMEIRO elemento da tela por decisão dele em 10/09: é a visão da
          carteira, igual à do Dashboard Geral do DRPS. Os alertas vêm logo
          abaixo — continuam existindo e nenhum foi tirado. */}
      <QuadroStatusQps linhas={aplicacoes} />

      {/* ── Precisa de atenção ───────────────────────────────────────────
          v0.3.637 — saiu daqui o alerta "N riscos Altos sem plano de ação":
          a QAP deixou de usar o plano de ação (pedido do João Marcos em
          18/09), e um alerta que aponta para uma tela sem porta de entrada só
          cobra o que ninguém vai fazer. A tarja equivalente no bloco da matriz saiu
          pelo mesmo motivo. */}
      {temAlerta ? (
        <div className="space-y-2">
          {semRespondente.length > 0 && (
            <Alerta
              tom="alto"
              titulo={`${semRespondente.length} ${semRespondente.length === 1 ? "aplicação sem nenhum respondente" : "aplicações sem nenhum respondente"}`}
              detalhe={
                paradasAntigas.length > 0
                  ? `a mais antiga parada há ${paradasAntigas[0].diasParado} dias`
                  : "coleta ainda não começou"
              }
            />
          )}

          {paradasAntigas.length > 0 && (
            <Alerta
              tom="medio"
              titulo={`${paradasAntigas.length} ${paradasAntigas.length === 1 ? "aplicação parada" : "aplicações paradas"} há mais de 30 dias`}
              detalhe={paradasAntigas
                .slice(0, 3)
                .map((a) => `${a.aplicacao.titulo} (${a.diasParado} d)`)
                .join(" · ")}
            />
          )}

          {totais.semPrevistos > 0 && (
            <Alerta
              tom="medio"
              titulo={`${totais.semPrevistos} ${totais.semPrevistos === 1 ? "aplicação com respondentes e sem trabalhadores previstos" : "aplicações com respondentes e sem trabalhadores previstos"}`}
              detalhe="Sem esse número não dá para saber se a participação foi boa. Dá para preencher na tela da aplicação."
            />
          )}

          {/* A taxa da carteira é média, e média esconde caso ruim — por isso a
              PIOR aplicação aparece sozinha quando fica abaixo de 50%. */}
          {totais.piorParticipacao && totais.piorParticipacao.taxa < 0.5 && (
            <Alerta
              tom="medio"
              titulo={`Participação de ${Math.round(totais.piorParticipacao.taxa * 100)}% na aplicação mais fraca`}
              detalhe={totais.piorParticipacao.titulo}
            />
          )}

          {tiposVazios.length > 0 && (
            <Alerta
              tom="medio"
              titulo={`${tiposVazios.length} ${tiposVazios.length === 1 ? "modelo de questionário sem perguntas" : "modelos de questionário sem perguntas"}`}
              detalhe={tiposVazios.map((t) => t.tipo.nome).join(" · ")}
              href="/questionarios-psicossociais/tipos"
            />
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Nada pendente de atenção.{" "}
          {totais.concluido + totais.enviado > 0 &&
            `${totais.concluido + totais.enviado} aplicação(ões) encerrada(s).`}
        </div>
      )}

      {/* ── Onde o trabalho está ───────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Onde o trabalho está
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ETAPAS.map((e) => {
            const n = aplicacoes.filter((a) => a.etapa === e.chave).length;
            const gargalo = n > 0 && n === Math.max(...ETAPAS.map((x) => aplicacoes.filter((a) => a.etapa === x.chave).length)) && e.chave !== "CONCLUIDO";
            return (
              <div
                key={e.chave}
                className={cn(
                  "rounded-xl border bg-white p-4 shadow-sm",
                  gargalo ? "border-red-200" : "border-gray-200"
                )}
              >
                <p className="text-2xl font-bold text-gray-900">{n}</p>
                <p className="mt-0.5 text-sm font-medium text-gray-700">{e.nome}</p>
                <p className="text-xs text-gray-500">{e.sub}</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          A etapa vem do que já existe na aplicação — respondente importado, ação
          de plano —, não do status escolhido à mão no quadro acima. Quando as
          duas leituras discordam, é porque o trabalho andou e ninguém mexeu no
          status.
        </p>
      </section>

      {/* ── Alcance da coleta ──────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Indicador icone={Users} valor={totais.respondentes} label="Respondentes" />
        {/* A taxa só conta aplicações que TÊM denominador — o rodapé diz quantas
            são, para o número não parecer valer pela carteira inteira. */}
        <Indicador
          icone={Percent}
          valor={
            totais.taxaParticipacao === null
              ? "—"
              : `${Math.round(totais.taxaParticipacao * 100)}%`
          }
          label="Participação"
          rodape={
            totais.taxaParticipacao === null
              ? "falta informar os previstos"
              : `em ${totais.aplicacoesComPrevistos} de ${totais.aplicacoes} aplicações`
          }
        />
        <Indicador icone={Grid3x3} valor={totais.setores} label="Setores alcançados" />
        <Indicador icone={ClipboardCheck} valor={totais.cargos} label="Cargos alcançados" />
        <Indicador
          icone={BarChart2}
          valor={totais.celulasRevisadas}
          label="Células revisadas"
          rodape={totais.celulas > 0 ? `de ${totais.celulas} da matriz` : "matriz ainda vazia"}
        />
      </section>

      {/* ── Retrato clínico ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Dimensões mais críticas da carteira
          </h2>
          {dimensoes.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Nenhuma dimensão avaliada ainda — depende de respondentes importados.
            </p>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {dimensoes.slice(0, 8).map((d) => (
                  <div key={d.idCategoria} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-xs text-gray-700" title={d.nome}>
                      {d.nome}
                    </span>
                    <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block bg-red-500"
                        style={{ width: `${(d.alto / maxAlto) * 100}%` }}
                      />
                      <span
                        className="block bg-yellow-400"
                        style={{ width: `${(d.moderado / maxAlto) * 100}%` }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-gray-500">
                      {d.alto} / {d.moderado}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Células classificadas <span className="font-medium text-red-600">Alto</span> /{" "}
                <span className="font-medium text-yellow-600">Moderado</span>, somando todas as
                aplicações. Só é possível ver isto aqui — a tela de uma aplicação não cruza as outras.
              </p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Distribuição dos níveis de risco
          </h2>
          {totais.alto + totais.moderado + totais.baixo === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Nenhuma célula com base de resposta ainda.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <NivelCard n={totais.alto} label="Alto" classe="border-red-200 bg-red-50 text-red-700" />
              <NivelCard n={totais.moderado} label="Moderado" classe="border-yellow-200 bg-yellow-50 text-yellow-700" />
              <NivelCard n={totais.baixo} label="Baixo" classe="border-green-200 bg-green-50 text-green-700" />
            </div>
          )}
          {totais.celulasSemBase > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mr-1 inline size-3.5 align-text-top" />
              {totais.celulasSemBase} célula(s) da matriz não têm nenhuma resposta por trás e saem
              como <strong>Baixo</strong> por padrão. Não estão contadas acima.
            </p>
          )}
          {/* v0.3.637 — saiu a tarja "N célula(s) Alto sem nenhuma ação":
              cobrava plano de ação, que a QAP deixou de usar. `altosSemPlano`
              segue calculado em useQpsResumo, pronto para voltar. */}
        </section>
      </div>

      {/* ── Carteira ───────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Carteira · {totais.aplicacoes} aplicação(ões)
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {aplicacoes.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              Nenhuma aplicação cadastrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Aplicação</th>
                    <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Empresa</th>
                    <th className="px-4 py-3 text-left font-semibold">Etapa</th>
                    <th className="px-4 py-3 text-right font-semibold">Resp.</th>
                    <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Altos</th>
                    <th className="hidden px-4 py-3 text-right font-semibold lg:table-cell">Parada</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aplicacoes.map((a) => (
                    <Linha key={a.aplicacao.id_aplicacao} a={a} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Linha({ a }: { a: AplicacaoResumo }) {
  const altos = a.celulas.filter((c) => c.risco === "ALTO").length;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{a.aplicacao.titulo}</span>
        <span className="block text-xs text-gray-500">{a.tipoNome}</span>
      </td>
      <td className="hidden max-w-[16rem] truncate px-4 py-3 text-gray-600 md:table-cell">
        {a.empresaNome}
      </td>
      <td className="px-4 py-3">
        <EtapaChip etapa={a.etapa} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
        {a.nRespondentes}
        {a.taxaParticipacao !== null && (
          <span
            className={cn(
              "block text-xs",
              a.taxaParticipacao < 0.5 ? "font-medium text-amber-700" : "text-gray-500"
            )}
          >
            {Math.round(a.taxaParticipacao * 100)}% de {a.previstos}
          </span>
        )}
      </td>
      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
        {altos > 0 ? (
          <span className="font-semibold text-red-600">{altos}</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
        <span className={cn(a.diasParado >= 30 ? "font-medium text-amber-700" : "text-gray-500")}>
          {a.diasParado} d
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/questionarios-psicossociais/${a.aplicacao.id_aplicacao}`}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Abrir <ArrowRight className="size-3" />
        </Link>
      </td>
    </tr>
  );
}

const ETAPA_COR: Record<EtapaQps, string> = {
  COLETA: "bg-gray-100 text-gray-600",
  ANALISE: "bg-blue-100 text-blue-700",
  PLANO: "bg-indigo-100 text-indigo-700",
  CONCLUIDO: "bg-green-100 text-green-700",
};

const ETAPA_LABEL: Record<EtapaQps, string> = {
  COLETA: "Coleta",
  ANALISE: "Análise",
  PLANO: "Plano de ação",
  CONCLUIDO: "Concluído",
};

function EtapaChip({ etapa }: { etapa: EtapaQps }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ETAPA_COR[etapa])}>
      {ETAPA_LABEL[etapa]}
    </span>
  );
}

function Alerta({
  tom,
  titulo,
  detalhe,
  href,
}: {
  tom: "alto" | "medio";
  titulo: string;
  detalhe: string;
  href?: string;
}) {
  const corpo = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm",
        tom === "alto" ? "border-l-4 border-l-red-500 border-gray-200" : "border-l-4 border-l-amber-400 border-gray-200",
        href && "hover:bg-gray-50"
      )}
    >
      <AlertTriangle
        className={cn("mt-0.5 size-4 shrink-0", tom === "alto" ? "text-red-500" : "text-amber-500")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{titulo}</p>
        <p className="truncate text-xs text-gray-500">{detalhe}</p>
      </div>
      {href && <ArrowRight className="mt-1 size-3.5 shrink-0 text-gray-400" />}
    </div>
  );
  return href ? <Link href={href} className="block">{corpo}</Link> : corpo;
}

function Indicador({
  icone: Icone,
  valor,
  label,
  rodape,
}: {
  icone: typeof Users;
  valor: number | string;
  label: string;
  rodape?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <Icone className="size-4 text-gray-400" />
      <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{valor}</p>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      {rodape && <p className="text-xs text-gray-500">{rodape}</p>}
    </div>
  );
}

function NivelCard({ n, label, classe }: { n: number; label: string; classe: string }) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", classe)}>
      <p className="text-xl font-bold tabular-nums">{n}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
