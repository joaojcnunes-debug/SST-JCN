"use client";

import { use } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  LineChart,
  ListTodo,
  Printer,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import {
  useDrpsMonitoramento,
  useDrpsPlanoMedidas,
  useDrpsRevisao,
} from "@/lib/hooks/useDrps";
import {
  calcularResumoGestao,
  corPercentual,
  formatarDataBR,
} from "@/lib/drps/gestao";
import DrpsGestaoResumoPrint from "@/components/drps/DrpsGestaoResumoPrint";

export default function GestaoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const ano = new Date().getFullYear();
  const { data: planoDB } = useDrpsPlanoMedidas(idRelatorio, ano);
  const { data: monitoramentos = [] } = useDrpsMonitoramento(idRelatorio);
  const { data: revisao } = useDrpsRevisao(idRelatorio);

  const resumo = calcularResumoGestao({
    planoDB,
    monitoramentos,
    revisaoDB: revisao,
  });
  const corSaude = corPercentual(resumo.saudeGeral);
  const base = `/psicossocial/${idRelatorio}`;

  return (
    <>
      <div className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Painel de Gestão
            </h1>
            <p className="text-sm text-gray-600">
              Visão executiva consolidada das 3 frentes de gestão do programa
              psicossocial.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Printer className="size-4" />
            Imprimir Resumo
          </button>
        </div>

        {/* Saúde geral */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-verde-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Saúde da Gestão
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Média ponderada das 3 frentes — quanto mais alto, mais maduro
                está o programa.
              </p>
            </div>
            <div
              className="text-3xl font-bold leading-none"
              style={{ color: corSaude }}
            >
              {resumo.saudeGeral}%
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full transition-all"
              style={{
                width: `${resumo.saudeGeral}%`,
                backgroundColor: corSaude,
              }}
            />
          </div>
        </div>

        {/* 3 cards */}
        <div className="grid gap-3 md:grid-cols-3">
          {/* MEDIDAS */}
          <CardFrente
            icone={<ClipboardCheck className="size-5" />}
            titulo="Medidas de Controle"
            subtitulo="Plano Anual"
            percentual={resumo.medidas.percentual}
            href={`${base}/medidas`}
            metricas={[
              {
                label: "Ações configuradas",
                valor: `${resumo.medidas.totalConfiguradas} / ${resumo.medidas.totalCatalogadas}`,
              },
              {
                label: "Marcações no ano",
                valor: `${resumo.medidas.totalMarcacoes}`,
              },
              {
                label: "Previstas neste mês",
                valor: `${resumo.medidas.acoesNoMesAtual}`,
                destacar: resumo.medidas.acoesNoMesAtual > 0,
              },
            ]}
          />

          {/* MONITORAMENTO */}
          <CardFrente
            icone={<LineChart className="size-5" />}
            titulo="Monitoramento"
            subtitulo="Acompanhamento por tópico"
            percentual={resumo.monitoramento.percentual}
            href={`${base}/monitoramento`}
            metricas={[
              {
                label: "Tópicos acompanhados",
                valor: `${resumo.monitoramento.total}`,
              },
              {
                label: "Concluídos",
                valor: `${resumo.monitoramento.concluidos}`,
              },
              {
                label: "Em andamento",
                valor: `${resumo.monitoramento.emAndamento}`,
              },
              {
                label: "Pendentes",
                valor: `${resumo.monitoramento.pendentes}`,
                destacar: resumo.monitoramento.pendentes > 0,
              },
              {
                label: "Próxima reavaliação",
                valor: formatarDataBR(resumo.monitoramento.proximaAvaliacao),
              },
            ]}
          />

          {/* REVISÃO */}
          <CardFrente
            icone={<ListTodo className="size-5" />}
            titulo="Revisão e Melhoria"
            subtitulo="Ciclo PDCA"
            percentual={resumo.revisao.percentual}
            href={`${base}/revisao`}
            metricas={[
              {
                label: "Checklist obrigatório",
                valor: `${resumo.revisao.checklistMarcados} / ${resumo.revisao.checklistTotal}`,
              },
              {
                label: "Equipe definida",
                valor: `${resumo.revisao.equipeMarcados} / ${resumo.revisao.equipeTotal}`,
              },
              {
                label: "Anotações",
                valor: resumo.revisao.temAnotacoes ? "Sim" : "Não",
              },
              {
                label: "Última edição",
                valor: formatarDataBR(resumo.revisao.ultimaEdicao),
              },
            ]}
          />
        </div>

        <p className="text-xs text-gray-400">
          Os percentuais são recalculados conforme você preenche cada frente.
          Use o botão acima para imprimir um resumo executivo só desta página, ou
          gere o PDF completo na tela de Análise.
        </p>
      </div>

      {/* Versão print do quadro — mesma usada no PDF completo do relatório */}
      <DrpsGestaoResumoPrint idRelatorio={idRelatorio} />

      <AssinaturaRelatorio />
    </>
  );
}

interface MetricaItem {
  label: string;
  valor: string;
  destacar?: boolean;
}

function CardFrente({
  icone,
  titulo,
  subtitulo,
  percentual,
  href,
  metricas,
}: {
  icone: React.ReactNode;
  titulo: string;
  subtitulo: string;
  percentual: number;
  href: string;
  metricas: MetricaItem[];
}) {
  const cor = corPercentual(percentual);
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-verde-primary">
          {icone}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
            <p className="text-[11px] text-gray-500">{subtitulo}</p>
          </div>
        </div>
        <div
          className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: cor }}
        >
          {percentual}%
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full transition-all"
          style={{ width: `${percentual}%`, backgroundColor: cor }}
        />
      </div>

      <ul className="mt-3 flex-1 space-y-1.5 text-xs">
        {metricas.map((m) => (
          <li
            key={m.label}
            className="flex items-baseline justify-between gap-2 border-b border-gray-50 pb-1 last:border-0"
          >
            <span className="text-gray-600">{m.label}</span>
            <span
              className={
                m.destacar
                  ? "font-bold text-verde-primary"
                  : "font-semibold text-gray-800"
              }
            >
              {m.valor}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className="mt-3 inline-flex items-center justify-center gap-1 rounded-md border border-verde-primary/30 bg-verde-primary/5 px-3 py-1.5 text-xs font-semibold text-verde-primary hover:bg-verde-primary/10"
      >
        Abrir frente <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
