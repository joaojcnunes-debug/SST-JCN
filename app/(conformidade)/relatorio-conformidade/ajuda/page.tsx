"use client";

import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Info,
  Lightbulb,
  ListChecks,
  Printer,
  ShieldCheck,
  Star,
  TrendingUp,
} from "lucide-react";
import { useState, useCallback } from "react";

interface ItemData {
  label: string;
  conceito: string;
  como: string[];
  atencao?: string;
  marque_sim: string;
}

const ITENS_EXPANDIVEIS: ItemData[] = [
  {
    label: "Como classificar um item",
    conceito:
      "A classificação correta é o coração do relatório de conformidade. A regra básica é: Conforme = o requisito normativo está integralmente atendido, com evidência observável; Não Conforme = o requisito não está atendido no todo ou em parte relevante, com evidência documentada; Não Aplicável = o requisito não tem fundamento fático para aplicação neste estabelecimento. A tentação é sempre classificar como \"N/A\" itens que são difíceis de acessar ou avaliar — resista: em caso de auditoria externa, a classificação N/A sem justificativa vira passivo técnico.",
    como: [
      "Para Conforme: exija evidência positiva (documento, equipamento funcionando, treinamento registrado, procedimento implantado). Ausência de não conformidade visível não é evidência de conformidade.",
      "Para Não Conforme: cite o item normativo específico e registre o que foi encontrado vs. o que é exigido. \"Extintor vencido\" → \"NR-23, Anexo A: extintor de pó químico com validade expirada em 03/2024, no corredor do almoxarifado\".",
      "Para N/A: registre brevemente o fundamento. \"N/A — empresa não possui processos com agentes químicos acima dos limites de tolerância\" é uma justificativa; \"N/A\" isolado não é.",
      "Dúvida entre Conforme e Não Conforme: classifique como Não Conforme e explique. É melhor ter uma não conformidade documentada que um Conforme questionável.",
      "Para requisitos com gradação: itens onde o cumprimento parcial é possível (ex: CIPA constituída mas com membros em número inferior ao previsto) — classifique como Não Conforme e descreva o grau de atendimento.",
    ],
    atencao:
      "Não classifique como Conforme com base no que o gestor afirma oralmente sem evidência. \"A gente tem esse procedimento\" sem documento é Não Conforme até prova em contrário.",
    marque_sim:
      "Use Não Conforme sempre que o requisito não estiver integralmente atendido com evidência verificável — parcialmente atendido = não atendido.",
  },
  {
    label: "NRs com maior impacto no diagnóstico",
    conceito:
      "Diferentes NRs têm diferentes pesos no risco ao trabalhador. NRs que envolvem risco de morte imediata (NR-10 elétrica, NR-12 máquinas, NR-33 espaço confinado, NR-35 trabalho em altura) têm prioridade absoluta: uma não conformidade nesses grupos pode matar. NRs de processo (NR-5 CIPA, NR-7 PCMSO, NR-9 PPRA/PGR, NR-15 insalubridade) têm impacto mais difuso mas igualmente real a longo prazo.",
    como: [
      "NR-12 (Máquinas): foco em proteções de partes móveis, paradas de emergência, bloqueio de energias (LOTO), manutenção preventiva e treinamento de operadores. Uma máquina sem proteção em zona de esmagamento é risco grave e iminente — recomende paralisação.",
      "NR-33 (Espaço Confinado): foco em identificação de espaços confinados, programa de entrada, equipe treinada, equipamentos de monitoramento de atmosfera. Um espaço confinado sem gestão é potencialmente fatal.",
      "NR-35 (Trabalho em Altura): foco em plano de trabalho, sistema contra quedas, âncoras certificadas, treinamento. Queda de altura é a principal causa de morte no trabalho no Brasil.",
      "NR-7 e NR-15: PCMSO com exames corretos para os agentes identificados no GRO? Insalubridade reconhecida formalmente quando cabível? Esses itens têm impacto direto em perícias e litígios trabalhistas.",
      "NR-5 (CIPA): constituição, treinamento, ACT/convenção setorial sobre CIPA, atas de reuniões, gestão de acidentes. A CIPA é o órgão interno de fiscalização — sua ausência ou funcionamento precário priva a empresa de um mecanismo importante de identificação de riscos.",
    ],
    atencao:
      "Nunca encerre uma visita de auditoria com risco grave e iminente não comunicado formalmente ao responsável da empresa. Registre a comunicação verbal e formalize no relatório.",
    marque_sim:
      "Não conformidade que expõe trabalhador a risco de morte, lesão grave ou doença com nexo causal direto — independentemente de ser uma única não conformidade.",
  },
  {
    label: "Evidências técnicas adequadas",
    conceito:
      "Uma não conformidade sem evidência é uma opinião. Uma não conformidade com evidência é um fato técnico. A qualidade das evidências é o que diferencia um relatório de conformidade útil — que serve como base para ação e para defesa legal — de um relatório decorativo que não suporta contestações. A evidência não precisa ser elaborada: uma foto com hora e local, um extrato de documento, um registro observacional com data e horário são suficientes quando precisos.",
    como: [
      "Para documentos: registre número do documento, data de emissão/validade, e o item de não conformidade específico. \"ASO vencido em 02/2025 para funcionário X\" é evidência precisa.",
      "Para equipamentos: foto com foco no problema, de ângulo que mostre claramente a não conformidade e a localização. Se possível, inclua elemento de escala.",
      "Para procedimentos: a evidência pode ser a ausência de registro (o treinamento não aconteceu porque não há lista de presença) — documente a ausência com a data da verificação.",
      "Para entrevistas: quando a evidência é um relato de trabalhador, documente como \"relato de trabalhador entrevistado durante a visita\" sem identificar o trabalhador — preserve o anonimato.",
      "Organize as evidências pelo número do item no checklist. Um relatório onde a evidência está claramente vinculada ao item normativo específico é muito mais útil e defensável do que evidências em formato livre.",
    ],
    atencao:
      "Não documente o nome de trabalhadores que relataram não conformidades ou situações de risco — o trabalhador não pode se tornar o nexo causal de uma ação disciplinar por ter colaborado com a auditoria.",
    marque_sim:
      "Registre evidência para TODA não conformidade — sem exceção. Não conformidade sem evidência não deve constar no relatório.",
  },
];

const PASSOS = [
  {
    n: "01",
    titulo: "Criar novo relatório",
    icone: FileText,
    cor: "emerald",
    descricao:
      "Defina empresa, data, NRs a avaliar e responsável técnico. Cada relatório representa uma auditoria em um momento específico.",
    dicas: [
      "Um relatório por visita de auditoria. Não acumule diferentes visitas no mesmo relatório.",
      "Selecione apenas as NRs efetivamente aplicáveis ao estabelecimento.",
    ],
  },
  {
    n: "02",
    titulo: "Aplicar o checklist por NR",
    icone: ListChecks,
    cor: "blue",
    descricao:
      "Para cada NR selecionada, avalie item a item: Conforme / Não Conforme / Não Aplicável. Para cada Não Conforme, registre a evidência observada.",
    dicas: [
      "Avalie durante a visita, não depois. Detalhes técnicos relevantes se perdem em horas.",
      "Para itens com subdivisões complexas (ex: NR-12 máquinas vs. NR-12 organização), avalie o conjunto e classifique o item principal com base no pior sub-item.",
    ],
  },
  {
    n: "03",
    titulo: "Registrar evidências e fotos",
    icone: Camera,
    cor: "purple",
    descricao:
      "Para cada não conformidade, registre: o que foi encontrado, onde, em qual item normativo, e anexe foto quando possível.",
    dicas: [
      "A evidência é o que transforma a classificação em fato técnico.",
      "Cite o artigo ou item da NR diretamente na evidência: \"NR-5, item 5.6.4 — CIPA não constituída no prazo previsto\".",
    ],
  },
  {
    n: "04",
    titulo: "Calcular o índice de conformidade",
    icone: TrendingUp,
    cor: "orange",
    descricao:
      "O sistema calcula automaticamente o percentual de conformidade por NR e global. Itens N/A não entram no denominador.",
    dicas: [
      "Compare com auditorias anteriores para medir evolução.",
      "Índice < 60% em qualquer NR crítica (NR-12, NR-33, NR-35) exige atenção prioritária.",
    ],
  },
  {
    n: "05",
    titulo: "Gerar o relatório e plano de ação",
    icone: ClipboardList,
    cor: "red",
    descricao:
      "Gere o PDF do relatório completo e exporte a lista de não conformidades para o Plano de Ação 5W2H.",
    dicas: [
      "O plano de ação deve ter responsável, prazo e critério de verificação para cada não conformidade.",
      "Priorize não conformidades que envolvam risco grave e iminente para trabalhadores.",
    ],
  },
];

const BOAS_PRATICAS = [
  "Prepare o roteiro de auditoria com antecedência: revise a NR, identifique os itens que se aplicam ao setor auditado, prepare as perguntas-chave. Chegar sem preparação resulta em auditorias superficiais.",
  "Não avise com antecedência detalhada o que vai verificar — ambientes \"preparados\" para auditoria escondem os problemas reais. Uma comunicação de \"haverá auditoria de SST na semana X\" é diferente de revelar o roteiro.",
  "Compare com o histórico: se a empresa já teve auditoria anterior, comece pelas não conformidades registradas e verifique se foram tratadas. Reincidência é mais grave que a não conformidade original.",
  "Mantenha uma postura técnica neutra — você está avaliando condições, não julgando pessoas. Uma não conformidade documentada é uma oportunidade de melhoria, não uma acusação.",
  "Encerre sempre com uma reunião de fechamento: apresente os principais achados ao responsável da empresa antes de sair. Não conformidades graves não devem ser uma surpresa quando o relatório chegar.",
];

const corMap: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100",
    badgeText: "text-emerald-800",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100",
    badgeText: "text-blue-800",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100",
    badgeText: "text-purple-800",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100",
    badgeText: "text-orange-800",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100",
    badgeText: "text-red-800",
  },
};

function ItemChecklist({ label, conceito, como, atencao, marque_sim, forceOpen }: ItemData & { forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const isOpen = open || !!forceOpen;

  return (
    <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        {isOpen ? (
          <ChevronUp className="size-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-gray-400 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          <div className="pt-3 space-y-1">
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              Por que é importante?
            </p>
            <p className="text-xs text-gray-700 leading-relaxed">{conceito}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Como aplicar na prática
            </p>
            <ul className="space-y-2">
              {como.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="mt-1.5 size-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          {atencao && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-xs text-amber-800">
                <span className="font-bold">Atenção: </span>
                {atencao}
              </p>
            </div>
          )}
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2.5">
            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">
              Critério de uso
            </p>
            <p className="text-xs text-red-800">{marque_sim}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AjudaRelatorioConformidade() {
  const [printMode, setPrintMode] = useState(false);

  const handlePrint = useCallback(() => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      const reset = () => { setPrintMode(false); window.removeEventListener("afterprint", reset); };
      window.addEventListener("afterprint", reset);
    }, 200);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-emerald-100 p-3">
              <ShieldCheck className="size-7 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="size-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manual de uso
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                Relatório de Conformidade (RNC)
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Como usar o módulo de auditoria normativa do Painel SST
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="print:hidden shrink-0 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <Printer className="size-4" />
            Exportar PDF
          </button>
        </div>

        {/* Box "O que é" */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-emerald-700 shrink-0" />
            <p className="text-sm font-bold text-emerald-800">O que é o Relatório de Conformidade?</p>
          </div>
          <p className="text-sm text-emerald-900 leading-relaxed">
            O Relatório de Conformidade é o instrumento de auditoria que verifica a adequação da empresa
            às Normas Regulamentadoras aplicáveis. Cada item inspecionado é classificado como{" "}
            <span className="font-semibold">Conforme</span>,{" "}
            <span className="font-semibold">Não Conforme</span> ou{" "}
            <span className="font-semibold">Não Aplicável</span>, gerando um diagnóstico normativo
            completo. O relatório fundamenta o Plano de Ação do PGR/PPRA e documenta o nível de
            conformidade legal da empresa em um momento específico — é evidência técnica de due
            diligence do empregador.
          </p>
        </div>

        {/* Fluxo de trabalho */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Fluxo de trabalho</h2>
          </div>
          <div className="space-y-3">
            {PASSOS.map((passo) => {
              const Icone = passo.icone;
              const cores = corMap[passo.cor];
              return (
                <div
                  key={passo.n}
                  className={`rounded-xl border ${cores.border} ${cores.bg} px-4 py-4`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 rounded-lg ${cores.badge} p-2`}
                    >
                      <Icone className={`size-4 ${cores.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold ${cores.text} uppercase tracking-widest`}
                        >
                          Passo {passo.n}
                        </span>
                      </div>
                      <p className={`text-sm font-bold ${cores.text} mb-1`}>{passo.titulo}</p>
                      <p className="text-xs text-gray-700 leading-relaxed mb-2">
                        {passo.descricao}
                      </p>
                      {passo.dicas.length > 0 && (
                        <ul className="space-y-1.5">
                          {passo.dicas.map((dica, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                              <CheckCircle2
                                className={`size-3.5 shrink-0 mt-0.5 ${cores.text}`}
                              />
                              <span>{dica}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Seções expandíveis */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Conceitos e critérios técnicos</h2>
          </div>
          <div className="space-y-2">
            {ITENS_EXPANDIVEIS.map((item) => (
              <ItemChecklist key={item.label} {...item} forceOpen={printMode} />
            ))}
          </div>
        </section>

        {/* Boas práticas */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Star className="size-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Boas práticas de auditoria</h2>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-50">
            {BOAS_PRATICAS.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Lightbulb className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rodapé informativo */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-800">
              O relatório é evidência técnica e legal
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              O Relatório de Conformidade é um documento técnico que pode ser usado em defesa em
              fiscalizações do Ministério do Trabalho, ações trabalhistas e processos de due
              diligence. Mantenha o histórico de relatórios — a evolução temporal do índice de
              conformidade demonstra o comprometimento do empregador com a melhoria contínua das
              condições de trabalho.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
