"use client";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Lightbulb,
  Printer,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useState, useCallback } from "react";

interface ItemData {
  label: string;
  conceito: string;
  como: string[];
  atencao?: string;
  marque_sim: string;
}

const ITENS_TECNICOS: ItemData[] = [
  {
    label: "Análise de causa raiz — 5 Porquês",
    conceito:
      "O método dos 5 Porquês (Toyota Production System) é o mais acessível para análise de causa raiz em campo. A lógica é simples: cada \"Por quê?\" busca a causa da causa anterior, até chegar a uma causa que, se tratada, elimine ou reduza significativamente a probabilidade de recorrência. O número 5 é uma heurística — pode ser menos para problemas simples ou mais para problemas complexos. O critério de parada é chegar a uma causa sobre a qual a organização tem controle real para agir.",
    como: [
      "Comece com a descrição precisa da NC como primeiro \"O quê aconteceu?\". Exemplos: \"O operador da prensa X sofreu esmagamento de dedos\".",
      "1º Por quê: \"Por que o operador sofreu esmagamento?\" → \"Porque tocou a zona de prensagem durante o ciclo\". 2º Por quê: \"Por que tocou a zona?\" → \"Porque a proteção estava removida\". 3º Por quê: \"Por que a proteção estava removida?\" → \"Porque ela impedia a limpeza rápida de sobras de material\". 4º Por quê: \"Por que a proteção impedia a limpeza?\" → \"Porque foi projetada sem abertura de serviço\". 5º Por quê: \"Por que foi instalada sem abertura de serviço?\" → \"Porque o processo de aprovação de proteções não inclui verificação com operadores\". → CAUSA RAIZ: ausência de participação dos operadores no processo de aprovação de proteções.",
      "A causa raiz deve ser uma condição sistêmica (processo, procedimento, cultura, recurso) — não um comportamento humano pontual.",
      "Verifique se a causa raiz é \"controlável\": se a organização não pode agir sobre ela diretamente, continue os Porquês até chegar a algo acionável.",
      "Documente toda a cadeia — não apenas a causa raiz. A cadeia revela fatores contribuintes que também podem ser tratados como ações preventivas adicionais.",
    ],
    atencao:
      "Parar nos Porquês no primeiro comportamento humano identificado (\"o trabalhador não seguiu o procedimento\") é o erro mais comum. Comportamentos humanos são sintomas, não causas raiz — sempre pergunte por que o comportamento ocorreu.",
    marque_sim:
      "Use 5 Porquês para toda NC Grave ou Crítica. Para NCs Moderadas com padrão de recorrência (mesma NC em inspeções sucessivas), o 5 Porquês é obrigatório.",
  },
  {
    label: "Ação corretiva vs. ação preventiva",
    conceito:
      "Ação corretiva elimina a causa de uma não conformidade identificada — é reativa. Ação preventiva elimina a causa de uma não conformidade potencial — é proativa. A distinção importa porque os critérios de seleção são diferentes: a corretiva precisa ser proporcional à NC identificada e resolver a causa raiz; a preventiva precisa ser proporcional ao risco de ocorrência e ao impacto potencial se ocorrer. Na prática da SST, a maioria das ações é corretiva — o ideal é que o sistema amadureça para gerar cada vez mais ações preventivas (identificação de quase-acidentes, análise de tendências).",
    como: [
      "Para ação corretiva: verifique se ela trata a causa raiz identificada (não apenas o sintoma). \"Trocar o extintor vencido\" trata o sintoma; \"implementar controle mensal de validade de extintores com responsável designado\" trata a causa raiz.",
      "Para ação preventiva: baseie-se em dados reais — quase-acidentes registrados, tendências de inspeção, benchmarks de setor, análise de APR para atividades novas. Não invente ações preventivas genéricas sem base em risco real.",
      "Distingua também ação de contenção (imediata, elimina o perigo agudo mas não a causa) de ação corretiva (elimina a causa raiz): a contenção é necessária em NCs Críticas mas não substitui a ação corretiva.",
      "Avalie a eficácia da ação: após implementação e prazo razoável, verifique se a NC recorreu ou se a causa raiz foi realmente eliminada. Eficácia não verificada = plano de ação sem fechamento real.",
      "Documente o critério de eficácia antes de implementar: \"como saberemos que a ação funcionou?\" — ex: \"zero recorrência desta NC na próxima auditoria\".",
    ],
    atencao:
      "Ação corretiva que trata apenas o sintoma sem atacar a causa raiz resulta invariavelmente em reincidência da NC — frequentemente em prazo ainda menor que o original, pois a causa raiz ficou intocada enquanto o \"problema\" foi marcado como resolvido.",
    marque_sim:
      "Toda NC Grave ou Crítica exige análise de causa raiz documentada e ação corretiva que trata a causa raiz identificada — não apenas o sintoma visível.",
  },
  {
    label: "Priorização e SLA de resposta",
    conceito:
      "Nem todas as não conformidades têm o mesmo prazo de resposta. A gestão eficaz de NCs exige priorização explícita com SLA (Service Level Agreement) de resposta diferenciado por severidade. Sem priorização formal, as NCs de menor impacto (mas mais fáceis de resolver) tendem a ser resolvidas primeiro — enquanto as mais críticas aguardam na fila por meses. A priorização por severidade é o mecanismo que garante que os recursos limitados de gestão sejam alocados onde o risco é maior.",
    como: [
      "Defina SLAs claros e formais: NC Crítica → ação imediata (paralisação se necessário) e plano de contenção em 24h; NC Grave → contenção em 48h, ação corretiva em 15 dias; NC Moderada → ação corretiva em 30 dias; NC Leve → ação corretiva em 90 dias.",
      "Revise NCs abertas semanalmente para NCs Críticas e Graves: um sistema de acompanhamento que é revisado mensalmente permite que NCs críticas fiquem abertas por um mês inteiro sem escalada.",
      "Escalada automática: defina quem é notificado quando uma NC Crítica ou Grave passa do prazo de contenção sem ação registrada. A escalada automática impede que problemas sérios fiquem \"invisíveis\" na operação.",
      "Para NCs com ação dependente de orçamento: a dependência de recurso financeiro não elimina o risco — registre a ação de contenção (medida temporária) enquanto a ação corretiva definitiva aguarda aprovação orçamentária.",
      "Relatório de aging: quantas NCs estão abertas por faixa de prazo (0–15d, 15–30d, 30–60d, > 60d)? Um relatório de aging mensal entregue à gestão cria visibilidade e accountability.",
    ],
    atencao:
      "NC Crítica com contenção mas sem ação corretiva documentada é um risco gerenciado parcialmente — a contenção pode falhar e o acidente ocorre sob a responsabilidade de quem sabia do risco e não o eliminou.",
    marque_sim:
      "Toda NC que supera o SLA definido para sua severidade sem justificativa e escalada documentada.",
  },
];

const PASSOS = [
  {
    n: "01",
    titulo: "Registrar a não conformidade",
    descricao:
      "Documente cada NC com: fonte (auditoria, inspeção, acidente, reclamação), descrição objetiva do desvio, evidência e classificação de severidade.",
    dicas: [
      "Use linguagem factual: \"proteção ausente na prensa X\" — não \"situação de risco na área de produção\".",
      "Registre a data da identificação — determina o prazo para ação imediata em NCs graves.",
    ],
    icone: ClipboardList,
    cor: "red",
  },
  {
    n: "02",
    titulo: "Classificar a severidade",
    descricao:
      "Classifique: Leve (sem risco direto imediato), Moderada (risco presente mas controlável), Grave (risco de lesão significativa) ou Crítica (risco de morte ou lesão grave irreversível).",
    dicas: [
      "NCs Críticas exigem comunicação imediata ao responsável e podem justificar paralisação de atividade.",
      "Use o Nível de Risco da Matriz P×S quando disponível como base para a classificação de severidade.",
    ],
    icone: ShieldAlert,
    cor: "orange",
  },
  {
    n: "03",
    titulo: "Investigar a causa raiz",
    descricao:
      "Para NCs Graves e Críticas, registre a análise de causa raiz (5 Porquês ou Espinha de Peixe/Ishikawa). Isso evita reincidência.",
    dicas: [
      "A causa raiz raramente é \"o trabalhador não usou EPI\" — investigue por que ele não usou.",
      "Causas raiz sistêmicas (falta de procedimento, falta de treinamento, pressão de produção) exigem ações sistêmicas.",
    ],
    icone: Search,
    cor: "purple",
  },
  {
    n: "04",
    titulo: "Definir ação corretiva (5W2H)",
    descricao:
      "Para cada NC, defina: O QUE será feito (What), POR QUE (Why), ONDE (Where), QUANDO (When), QUEM (Who), COMO (How) e QUANTO CUSTA (How Much).",
    dicas: [
      "Ações vagas como \"melhorar a conscientização\" raramente funcionam. Seja específico: \"realizar treinamento de NR-12 para 100% dos operadores da Linha 1 até 30/06\".",
      "Prazo deve ser realista mas urgente para NCs graves.",
    ],
    icone: Target,
    cor: "blue",
  },
  {
    n: "05",
    titulo: "Acompanhar e fechar",
    descricao:
      "Registre o status: Aberta / Em Tratamento / Concluída. Ao concluir, registre a evidência de implementação da ação corretiva.",
    dicas: [
      "NCs \"Em Tratamento\" por > 30 dias para NCs Graves sem justificativa devem gerar escalada para a gestão.",
      "A evidência de encerramento é tão importante quanto a NC em si — um plano de ação que \"foi feito\" sem evidência não existe tecnicamente.",
    ],
    icone: CheckCircle2,
    cor: "emerald",
  },
];

const BOAS_PRATICAS = [
  "Registre quase-acidentes com o mesmo rigor que acidentes — eles têm a mesma causa raiz, apenas sorte diferente. Um sistema que só registra acidentes está descartando 95% das oportunidades de prevenção.",
  "Apresente o painel de NCs abertas em reuniões de gestão mensais. Visibilidade para a gestão é o que move recursos para resolução.",
  "NCs que se repetem em ciclos de auditoria sem resolução indicam que o plano de ação não está funcionando — revise a causa raiz, não apenas o prazo.",
  "Proteja a identidade de quem reporta NCs — especialmente em ambientes com histórico de retaliação. Se o sistema não é seguro para quem reporta, os problemas desaparecem do sistema (não da realidade).",
  "Feche formalmente: uma NC marcada como \"concluída\" sem evidência de verificação de eficácia é um falso fechamento. O sistema deve exigir evidência antes de permitir o fechamento.",
];

const corMap: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100",
    badgeText: "text-red-700",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100",
    badgeText: "text-orange-700",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100",
    badgeText: "text-purple-700",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100",
    badgeText: "text-blue-700",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100",
    badgeText: "text-emerald-700",
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

function PassoCard({
  n,
  titulo,
  descricao,
  dicas,
  icone: Icone,
  cor,
}: {
  n: string;
  titulo: string;
  descricao: string;
  dicas: string[];
  icone: React.ElementType;
  cor: string;
}) {
  const c = corMap[cor] ?? corMap.blue;
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center size-9 rounded-lg ${c.badge} shrink-0`}>
          <Icone className={`size-4 ${c.badgeText}`} />
        </div>
        <div className="space-y-0.5">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>
            Passo {n}
          </p>
          <p className="text-sm font-semibold text-gray-900">{titulo}</p>
        </div>
      </div>
      <p className="text-xs text-gray-700 leading-relaxed">{descricao}</p>
      {dicas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Dicas práticas</p>
          <ul className="space-y-1.5">
            {dicas.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="mt-1.5 size-1.5 rounded-full bg-gray-400 shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AjudaRNCPage() {
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Cabeçalho */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-11 rounded-xl bg-red-100">
                <XCircle className="size-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                  Manual de Instrução
                </p>
                <h1 className="text-xl font-bold text-gray-900">
                  Relatório de Não Conformidades (RNC)
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="print:hidden shrink-0 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              <Printer className="size-4" />
              Exportar PDF
            </button>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Este manual orienta o preenchimento correto e completo do Relatório de Não Conformidades
            no SST JCN Consultoria. Leia cada seção antes de registrar, classificar ou fechar uma NC.
          </p>
        </div>

        {/* O que é */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-red-600" />
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">O que é este módulo?</p>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">
            O Relatório de Não Conformidades (RNC) é o instrumento de gestão que documenta, prioriza
            e acompanha a resolução de desvios identificados nas auditorias de conformidade ou em
            inspeções de campo. Enquanto o Relatório de Conformidade fotografa o estado atual, o RNC
            é o motor da melhoria: registra o que está errado, por quê, o que será feito, por quem e
            até quando. A rastreabilidade das ações corretivas é uma exigência das normas de gestão
            (ISO 45001) e fundamenta a evidência de PGR em implementação.
          </p>
        </div>

        {/* Severidade — referência rápida */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-gray-600" />
            <h2 className="text-sm font-bold text-gray-900">Níveis de severidade — referência rápida</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-0.5">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leve</p>
              <p className="text-xs text-gray-700">Sem risco direto imediato. Ação corretiva em até 90 dias.</p>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5 space-y-0.5">
              <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Moderada</p>
              <p className="text-xs text-gray-700">Risco presente mas controlável. Ação corretiva em até 30 dias.</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 space-y-0.5">
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Grave</p>
              <p className="text-xs text-gray-700">Risco de lesão significativa. Contenção em 48h, ação corretiva em 15 dias.</p>
            </div>
            <div className="rounded-lg border border-red-400 bg-red-100 px-3 py-2.5 space-y-0.5">
              <p className="text-[11px] font-bold text-red-800 uppercase tracking-wider">Crítica</p>
              <p className="text-xs text-gray-800 font-medium">Risco de morte ou lesão grave irreversível. Ação imediata — pode exigir paralisação. Contenção em 24h.</p>
            </div>
          </div>
        </div>

        {/* Fluxo de trabalho */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900">Fluxo de trabalho</h2>
          </div>
          <p className="text-xs text-gray-500">
            Siga os passos abaixo na ordem indicada para cada não conformidade registrada.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PASSOS.map((p) => (
              <PassoCard
                key={p.n}
                n={p.n}
                titulo={p.titulo}
                descricao={p.descricao}
                dicas={p.dicas}
                icone={p.icone}
                cor={p.cor}
              />
            ))}
          </div>
        </div>

        {/* Conceitos técnicos expandíveis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900">Conceitos técnicos</h2>
          </div>
          <p className="text-xs text-gray-500">
            Clique em cada tópico para expandir orientações detalhadas sobre como aplicar o conceito
            no preenchimento do RNC.
          </p>
          <div className="space-y-2">
            {ITENS_TECNICOS.map((item) => (
              <ItemChecklist key={item.label} {...item} forceOpen={printMode} />
            ))}
          </div>
        </div>

        {/* Status das NCs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-gray-600" />
            <h2 className="text-sm font-bold text-gray-900">Status de acompanhamento</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
              <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700">Aberta</p>
                <p className="text-xs text-gray-700">NC identificada mas sem ação corretiva definida ou iniciada. Exige atenção imediata para NCs Graves e Críticas.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5">
              <Clock className="size-4 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-orange-700">Em Tratamento</p>
                <p className="text-xs text-gray-700">Ação corretiva definida e em execução. Registre o responsável, prazo e progresso. Monitore ativamente o SLA.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-700">Concluída</p>
                <p className="text-xs text-gray-700">Ação corretiva implementada COM evidência registrada E verificação de eficácia documentada. Sem evidência, o fechamento não é válido.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 5W2H — estrutura mínima */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-gray-600" />
            <h2 className="text-sm font-bold text-gray-900">5W2H — estrutura mínima do plano de ação</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { sigla: "What", pt: "O quê", desc: "Descreva a ação de forma específica e mensurável." },
              { sigla: "Why", pt: "Por quê", desc: "Justifique a ação com base na causa raiz identificada." },
              { sigla: "Where", pt: "Onde", desc: "Local exato onde a ação será executada." },
              { sigla: "When", pt: "Quando", desc: "Data limite para conclusão da ação corretiva." },
              { sigla: "Who", pt: "Quem", desc: "Nome do responsável pela execução — não um cargo genérico." },
              { sigla: "How", pt: "Como", desc: "Método ou procedimento que será utilizado para executar a ação." },
              { sigla: "How Much", pt: "Quanto custa", desc: "Estimativa de recursos financeiros necessários, se aplicável." },
            ].map((item) => (
              <div key={item.sigla} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-blue-600 uppercase">{item.sigla}</span>
                  <span className="text-[11px] text-gray-400">({item.pt})</span>
                </div>
                <p className="text-xs text-gray-700">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Boas práticas */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900">Boas práticas</h2>
          </div>
          <div className="space-y-2">
            {BOAS_PRATICAS.map((bp, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3"
              >
                <Lightbulb className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-800 leading-relaxed">{bp}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ISO 45001 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-blue-600" />
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Requisito normativo — ISO 45001
            </p>
          </div>
          <p className="text-xs text-blue-900 leading-relaxed">
            A cláusula 10.2 da ISO 45001 exige que a organização reaja às não conformidades,
            investigue a causa raiz, implemente ações corretivas, revise a eficácia das ações e
            mantenha informação documentada de todo o processo. O RNC do SST JCN Consultoria é o registro
            que evidencia o cumprimento desse requisito. NCs sem causa raiz documentada ou sem
            evidência de fechamento constituem lacuna auditável.
          </p>
        </div>

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-[11px] text-gray-400">
            SST JCN Consultoria — Módulo RNC · Para dúvidas, contate o suporte técnico JCN Consultoria TI.
          </p>
        </div>
      </div>
    </div>
  );
}
