"use client";

import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Info,
  Lightbulb,
  ListChecks,
  Plus,
  Printer,
  Users,
} from "lucide-react";
import { useState, useCallback } from "react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemData {
  label: string;
  conceito: string;
  como: string[];
  atencao?: string;
  marque_sim: string;
}

// ─── Itens expandíveis ────────────────────────────────────────────────────────

const ITENS: ItemData[] = [
  {
    label: "Organização do trabalho",
    conceito: `A dimensão "Organização do trabalho" avalia como as tarefas são estruturadas, distribuídas e gerenciadas: clareza de funções, autonomia, ritmo, sobrecarga e previsibilidade. É a dimensão de maior peso no modelo de Karasek (Demanda-Controle): alta demanda + baixo controle sobre o próprio trabalho = quadrante de alto risco cardiovascular e psíquico. Estudos longitudinais mostram que este padrão dobra o risco de infarto do miocárdio em comparação com trabalhadores com demanda equivalente mas alto controle.

O resultado desta dimensão é o ponto de partida para entender se os problemas psicossociais têm origem na forma como o trabalho está organizado — e esta é sempre a hipótese principal a ser investigada antes de qualquer hipótese individual.`,
    como: [
      "Scores baixos (≤ 2,5 em escala 0–5) indicam alta sobrecarga percebida, baixa autonomia ou ritmo excessivo. Cruce com dados de produção: metas, cadência, horas extras.",
      "Se sobrecarga no questionário coincide com jornada média > 50h/semana, a causa é estrutural — não uma percepção distorcida.",
      "Entreviste sobre autonomia: 'Você pode decidir como executa sua tarefa, ou tudo é prescrito?' Trabalhadores com zero autonomia em tarefas cognitivamente exigentes têm risco psicossocial muito elevado.",
      "Compare entre turnos: sobrecarga alta no turno A e baixa no B, com o mesmo processo, indica problema de dimensionamento ou gestão do turno A — não do processo em si.",
      "Não confunda resultado individual com resultado de grupo: um score baixo de 2,0 com baixa variância (todos respondem parecido) é mais confiável do que um score médio de 2,5 com variância alta.",
    ],
    atencao: `Score baixo em Organização do trabalho NÃO significa que os trabalhadores estão "resistindo a mudanças". É o sistema informando que a carga está acima da capacidade com o controle disponível — a solução é reequilibrar a equação, não aumentar a cobrança.`,
    marque_sim: "Score médio ≤ 2,5 ou > 30% de respostas nos dois extremos negativos da escala (muito raramente / nunca para itens positivos sobre autonomia e carga).",
  },
  {
    label: "Relações interpessoais e suporte",
    conceito: `A qualidade das relações interpessoais — com colegas, gestores e clientes — é um dos mais potentes recursos protetores contra o estresse ocupacional no modelo JD-R (Job Demands-Resources, Bakker & Demerouti). Quando o suporte social está ausente, as mesmas demandas que seriam manejáveis tornam-se esmagadoras. Esta dimensão captura suporte do supervisor, coesão de equipe e qualidade do relacionamento com a liderança.

Score baixo em suporte do supervisor é um dos preditores mais fortes de burnout. A neurociência confirmou que a exclusão social ativa as mesmas áreas cerebrais que a dor física — o sofrimento é literal, não metafórico.`,
    como: [
      "Combine o score desta dimensão com dados de rotatividade: turnover > 20%/ano em setores específicos com o mesmo gestor confirma o padrão.",
      "Entrevistas individuais são essenciais: 'Quando você tem um problema técnico que não consegue resolver sozinho, o que você faz?' Quem responde 'resolvo sozinho, prefiro não perguntar' está sinalizando falta de suporte percebido.",
      "Avalie a assimetria entre hierarquias: equipes com bom suporte de pares mas péssimo suporte de gestores têm problema de liderança — não de clima geral.",
      "Identifique isolamento estrutural: trabalhadores que operam majoritariamente sozinhos (rotas, postos isolados, trabalho noturno) têm menor suporte social estrutural — o questionário captura a percepção, mas a intervenção precisa mudar a estrutura.",
      "Para gestores com score baixo nesta dimensão em todo o setor: a intervenção não é treinamento comportamental genérico — é investigação de práticas de gestão específicas.",
    ],
    atencao: `Ambiente com aparência superficial de harmonia e scores baixos em "relações interpessoais" indica que os trabalhadores aprenderam que expressar conflito é perigoso — a harmonia é forçada, não real.`,
    marque_sim: "Score médio ≤ 2,5 em suporte do supervisor, ou ≤ 3,0 em coesão de equipe, combinado com relatos de isolamento ou ausência de suporte técnico acessível.",
  },
  {
    label: "Reconhecimento e recompensa",
    conceito: `A percepção de reconhecimento — ser valorizado pelo esforço, receber feedback positivo, sentir que o trabalho tem sentido — é um recurso de trabalho fundamental no modelo JD-R. Sua ausência prediz independentemente burnout, mesmo quando outros recursos estão presentes. O modelo de Siegrist (Esforço-Recompensa Desequilibrado) mostra que a combinação de muito esforço + pouca recompensa percebida dobra o risco de doenças cardiovasculares.

Reconhecimento não é apenas remuneração: o feedback interpessoal positivo ativa circuitos de recompensa no cérebro e sustenta a motivação intrínseca. Uma empresa com bons benefícios mas zero feedback de qualidade terá scores baixos aqui mesmo assim.`,
    como: [
      "Score baixo aqui com score alto em sobrecarga (organização do trabalho) forma o padrão mais prevalente de esgotamento: muito esforço, pouco retorno.",
      "Entreviste sobre feedback: 'Com que frequência você recebe retorno sobre a qualidade do seu trabalho?' e 'Quando recebe, é construtivo ou apenas crítico?'",
      "Avalie a estabilidade percebida: insegurança no emprego (medo de demissão, contratos temporários, ameaças veladas) é o componente que mais pesa negativamente nesta dimensão.",
      "Compare entre funções: scores baixos apenas em funções operacionais com scores altos em funções gerenciais é padrão de empresa que reconhece quem 'aparece' mas não quem 'entrega'.",
      "Score baixo aqui também pode indicar falta de sentido no trabalho: 'Você sente que o que você faz aqui importa para algo?' Trabalho percebido como sem sentido é um preditor independente de sofrimento.",
    ],
    atencao: `Não confunda pacote de benefícios com reconhecimento. Uma empresa com ótimo plano de saúde e zero feedback de qualidade terá scores baixos nesta dimensão — os trabalhadores distinguem recompensa financeira de reconhecimento interpessoal.`,
    marque_sim: "Score médio ≤ 2,5 ou > 40% de trabalhadores relatando raramente ou nunca receber reconhecimento pelo trabalho bem feito.",
  },
  {
    label: "Saúde e bem-estar geral",
    conceito: `Esta dimensão captura a autopercepção de bem-estar físico e mental dos trabalhadores no contexto do trabalho. É a dimensão de resultado: as outras dimensões são condições de trabalho que geram risco; esta mede se o dano já está ocorrendo na percepção dos trabalhadores. Scores baixos aqui são um sinal de alerta de que as condições organizacionais identificadas nas outras dimensões já estão impactando a saúde — e que a intervenção não pode aguardar o próximo ciclo de revisão do PGR.

Scores muito baixos (< 2,0) nesta dimensão, especialmente combinados com evidências de fatores de risco severos nas demais, justificam escalada imediata para a gestão: o adoecimento já está em curso.`,
    como: [
      "Score médio abaixo de 2,5 em bem-estar geral, associado a scores baixos em Organização do Trabalho ou Reconhecimento, confirma nexo causal entre condição de trabalho e impacto na saúde.",
      "Triangule com dados de saúde: absenteísmo por transtornos mentais (CID F30-F99), uso de ansiolíticos/antidepressivos informado voluntariamente, consultas por queixas psicossomáticas.",
      "Cuidado com viés de resposta: trabalhadores em culturas que valorizam resistência tendem a subreportar mal-estar. Verifique a distribuição — não só a média.",
      "Compare bem-estar entre grupos: diferença de > 0,8 pontos entre setores com o mesmo processo indica problema localizado de gestão ou organização — não fator individual.",
      "Score baixo em bem-estar + score normal em organização do trabalho: investigar fatores externos ao trabalho que podem estar interagindo (mas atenção — a responsabilidade do PGR é sobre o que a empresa pode controlar).",
    ],
    atencao: `Score baixo em bem-estar não significa que os trabalhadores são "frágeis". Significa que o ambiente está produzindo adoecimento de forma sistemática — a intervenção precisa ser no ambiente, não no trabalhador.`,
    marque_sim: "Score médio ≤ 2,5 ou absenteísmo por transtornos mentais > 5% do quadro em 12 meses, combinados com fatores de risco identificados nas demais dimensões.",
  },
];

// ─── Passos ───────────────────────────────────────────────────────────────────

const PASSOS = [
  {
    numero: "01", titulo: "Criar nova aplicação", icone: Plus, cor: "emerald",
    descricao: "Em 'Nova Aplicação', defina o tipo de questionário, a empresa, o título da pesquisa, o período de coleta e o responsável técnico.",
    dicas: [
      "Dê um título que os trabalhadores entendam: 'Pesquisa sobre Condições de Trabalho — Jun/2025' é melhor que 'Aplicação #47'.",
      "Defina o período com folga: pesquisas com prazo muito curto têm taxa de resposta baixa e dados não representativos.",
    ],
  },
  {
    numero: "02", titulo: "Convidar respondentes", icone: Users, cor: "blue",
    descricao: "Na aba Respondentes, adicione os trabalhadores que receberão o questionário. Cada respondente recebe um link único para acesso anônimo.",
    dicas: [
      "O link não exige login — qualquer trabalhador com o link pode responder.",
      "Explique que as respostas são anônimas e os resultados serão apresentados apenas em grupos, nunca individualmente.",
    ],
  },
  {
    numero: "03", titulo: "Acompanhar o progresso", icone: ListChecks, cor: "orange",
    descricao: "A aba Resumo mostra quantos responderam e o percentual de conclusão em tempo real. Taxa abaixo de 70% compromete a representatividade.",
    dicas: [
      "Envie lembretes para não-respondentes após metade do período — aumenta significativamente a taxa de resposta.",
      "Setores com < 5 respondentes não devem ter resultados apresentados por setor para preservar o anonimato.",
    ],
  },
  {
    numero: "04", titulo: "Analisar os resultados", icone: BarChart2, cor: "purple",
    descricao: "A aba Resultados / Matriz mostra a Matriz de Risco P×S por dimensão, os escores médios e as distribuições de resposta.",
    dicas: [
      "Foco inicial nas dimensões com Risco Alto ou Crítico — são as que exigem ação imediata no PGR.",
      "Compare os resultados entre setores para identificar onde o problema é organizacional específico vs. generalizado.",
    ],
  },
  {
    numero: "05", titulo: "Registrar análise qualitativa", icone: FileText, cor: "indigo",
    descricao: "Para cada dimensão crítica, registre as condições organizacionais observadas que explicam os resultados. Este campo é exigido pela NR-1 / Fundacentro 2026.",
    dicas: [
      "A análise qualitativa conecta o dado numérico à realidade organizacional — sem ela, o relatório mostra o problema mas não explica por quê existe.",
      "Use dados da visita de campo, entrevistas e observação direta para embasar a análise.",
    ],
  },
  {
    numero: "06", titulo: "Criar planos de ação", icone: ClipboardCheck, cor: "teal",
    descricao: "Na aba Planos de Ação, registre medidas de controle para cada dimensão crítica, com responsável, prazo e indicador.",
    dicas: [
      "Priorize medidas organizacionais (mudança de processo, de gestão) sobre medidas individuais (treinamento de resiliência).",
      "O plano de ação é a evidência que o PGR está em implementação — sem ele, o questionário é pesquisa sem consequência.",
    ],
  },
];

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const COR_BG: Record<string, string> = {
  emerald: "bg-emerald-50 border-emerald-200", blue: "bg-blue-50 border-blue-200",
  orange: "bg-orange-50 border-orange-200",   purple: "bg-purple-50 border-purple-200",
  indigo: "bg-indigo-50 border-indigo-200",   teal: "bg-teal-50 border-teal-200",
};
const COR_ICON: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-100", blue: "text-blue-600 bg-blue-100",
  orange: "text-orange-600 bg-orange-100",   purple: "text-purple-600 bg-purple-100",
  indigo: "text-indigo-600 bg-indigo-100",   teal: "text-teal-600 bg-teal-100",
};
const COR_NUM: Record<string, string> = {
  emerald: "text-emerald-700", blue: "text-blue-700", orange: "text-orange-700",
  purple: "text-purple-700", indigo: "text-indigo-700", teal: "text-teal-700",
};

// ─── Componente de item expandível ────────────────────────────────────────────

function ItemExpandivel({ label, conceito, como, atencao, marque_sim, forceOpen }: ItemData & { forceOpen?: boolean }) {
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
        {isOpen ? <ChevronUp className="size-4 text-gray-400 shrink-0" /> : <ChevronDown className="size-4 text-gray-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          <div className="pt-3 space-y-1">
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Por que esta dimensão importa?</p>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{conceito}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Como interpretar e agir</p>
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
              <p className="text-xs text-amber-800"><span className="font-bold">Atenção: </span>{atencao}</p>
            </div>
          )}
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2.5">
            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">Quando priorizar esta dimensão</p>
            <p className="text-xs text-red-800">{marque_sim}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function QpsAjudaPage() {
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
    <div className="space-y-10 max-w-4xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <HelpCircle className="size-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Guia Técnico — Questionários Psicossociais</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manual de referência para aplicar, interpretar e agir sobre os resultados dos questionários de risco psicossocial (QPS/DRPS) conforme NR-1 e Fundacentro 2026.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="print:hidden shrink-0 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Printer className="size-4" />
          Exportar PDF
        </button>
      </div>

      {/* O que é */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="size-5 shrink-0 text-indigo-700 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-indigo-900">O que são questionários psicossociais e por que aplicar?</p>
            <p className="text-sm text-indigo-800 leading-relaxed">
              Os <strong>Questionários Psicossociais (QPS)</strong> são instrumentos estruturados de avaliação que coletam,
              de forma anônima e padronizada, a percepção dos trabalhadores sobre as condições organizacionais do trabalho.
              Eles operacionalizam a exigência da <strong>NR-1 (GRO/PGR)</strong> de identificar e gerenciar riscos psicossociais —
              riscos que surgem da organização do trabalho, das relações interpessoais e das condições de gestão,
              e que estão associados a transtornos mentais, burnout e doenças cardiovasculares relacionadas ao trabalho.
            </p>
            <p className="text-sm text-indigo-800 leading-relaxed">
              O sistema suporta questionários DRPS, Copsoq e formatos personalizados, organizados em <strong>dimensões temáticas</strong> com
              escala Likert. Os resultados geram uma <strong>Matriz de Risco P×S</strong> por dimensão, que orienta o plano de ação
              e compõe a evidência de PGR em implementação. A abordagem correta, conforme Fundacentro (2026), é sempre
              <strong> organizacional</strong>: o foco está nas condições e processos que geram risco — não nas características individuais dos trabalhadores.
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de abordagem */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-700 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-amber-900">Abordagem correta: organizacional, não individual</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Pergunta incorreta</p>
                <p className="text-sm text-red-800 italic">&ldquo;Quem está adoecendo? Esses trabalhadores precisam de resiliência?&rdquo;</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Pergunta correta</p>
                <p className="text-sm text-green-800 italic">&ldquo;O que na organização está gerando este risco? O que pode ser mudado?&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fluxo */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="size-5 text-gray-600" />
          <h2 className="font-semibold text-gray-800">Fluxo de trabalho no sistema</h2>
        </div>
        <div className="space-y-3">
          {PASSOS.map((p, i) => {
            const Ic = p.icone;
            return (
              <div key={i} className={`rounded-xl border p-4 ${COR_BG[p.cor]}`}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`flex size-9 items-center justify-center rounded-xl ${COR_ICON[p.cor]}`}>
                      <Ic className="size-4" />
                    </div>
                    {i < PASSOS.length - 1 && <ChevronRight className="size-3.5 text-gray-300 rotate-90" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-xs font-bold tabular-nums ${COR_NUM[p.cor]}`}>{p.numero}</span>
                      <p className="font-semibold text-gray-900 text-sm">{p.titulo}</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{p.descricao}</p>
                    <ul className="mt-2 space-y-1">
                      {p.dicas.map((d, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-gray-400" />{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Taxa de resposta */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
            <Users className="size-4 text-blue-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Taxa de resposta — o que é aceitável?</h2>
            <p className="text-xs text-gray-500">A representatividade dos resultados depende diretamente de quantos responderam.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { faixa: "≥ 80%", label: "Excelente", cor: "border-green-200 bg-green-50", tc: "text-green-700",
              desc: "Alta representatividade. Os resultados refletem com confiança a percepção do grupo. Adequado para análise por subgrupos." },
            { faixa: "70–79%", label: "Aceitável", cor: "border-yellow-200 bg-yellow-50", tc: "text-yellow-700",
              desc: "Representatividade suficiente para conclusões gerais. Cuidado com análises de subgrupos pequenos." },
            { faixa: "< 70%", label: "Insuficiente", cor: "border-red-200 bg-red-50", tc: "text-red-700",
              desc: "Os resultados podem não representar o grupo. Estenda o prazo, envie lembretes ou investigue a baixa adesão antes de analisar." },
          ].map((c, i) => (
            <div key={i} className={`rounded-xl border p-4 ${c.cor}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg font-bold ${c.tc}`}>{c.faixa}</span>
                <span className={`text-xs font-semibold ${c.tc}`}>{c.label}</span>
              </div>
              <p className="text-xs text-gray-700">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dimensões */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100">
            <BarChart2 className="size-4 text-indigo-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Guia de interpretação por dimensão</h2>
            <p className="text-xs text-gray-500">Clique em cada dimensão para ver como interpretar os resultados e o que fazer quando o score é crítico.</p>
          </div>
        </div>
        <div className={`rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3`}>
          <div className="rounded-lg border border-indigo-200 bg-white/70 px-4 py-3">
            <p className="text-xs text-gray-700 leading-relaxed">
              Os questionários psicossociais são organizados em <strong>dimensões temáticas</strong> — cada uma avalia um aspecto
              específico das condições organizacionais. Um score baixo em uma dimensão indica que os trabalhadores percebem
              aquela condição como deficiente ou adversa. A análise correta combina o score quantitativo com observação de campo
              e entrevistas — o número aponta onde está o problema, a análise qualitativa explica por quê.
            </p>
          </div>
          {ITENS.map((item, i) => <ItemExpandivel key={i} {...item} forceOpen={printMode} />)}
        </div>
      </div>

      {/* Matriz de risco */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-red-100">
            <Info className="size-4 text-red-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Lendo a Matriz de Risco P×S</h2>
            <p className="text-xs text-gray-500">Como interpretar a classificação de risco por dimensão.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nível</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Score típico</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ação recomendada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["Baixo",    "≥ 4,0", "Manter as condições. Monitorar no próximo ciclo."],
                ["Moderado", "3,0–3,9", "Investigar causas. Plano de melhoria no PGR."],
                ["Alto",     "2,0–2,9", "Ação corretiva prioritária. Análise qualitativa obrigatória."],
                ["Crítico",  "< 2,0",  "Intervenção imediata. Escalada para gestão. Comunicar ao SESMT e médico do trabalho."],
              ].map(([nivel, score, acao], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className={`px-4 py-3 font-semibold ${["text-green-600","text-yellow-600","text-orange-600","text-red-600"][i]}`}>{nivel}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{score}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{acao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Análise qualitativa */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-purple-100">
            <FileText className="size-4 text-purple-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Como redigir a análise qualitativa</h2>
            <p className="text-xs text-gray-500">Exigência NR-1 / Fundacentro 2026 — o número mostra onde está o problema, o texto explica por quê.</p>
          </div>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Para cada dimensão com risco Alto ou Crítico, a análise qualitativa deve responder:
            <strong> quais condições organizacionais específicas estão causando este score?</strong>
            Não é uma interpretação do número — é a descrição das condições de trabalho observadas que geram aquele resultado.
          </p>
          <div className="space-y-2">
            {[
              ["Dimensão", "Cite a dimensão e o score: 'Organização do Trabalho — score 2,1 (Alto Risco)'"],
              ["Evidências observadas", "Descreva o que você viu e ouviu: jornadas, metas, autonomia real, práticas de gestão."],
              ["Nexo causal", "Conecte a condição ao score: 'A ausência de pausas programadas + ritmo imposto pela esteira explica o score baixo em autonomia.'"],
              ["Recomendação organizacional", "Proponha mudança na condição: horário de pausa obrigatória, revisão de metas, rodízio de funções — não treinamento de resiliência."],
            ].map(([t, d], i) => (
              <div key={i} className="rounded-lg border border-purple-200 bg-white p-3.5 flex items-start gap-3">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-purple-500" />
                <div><p className="text-sm font-semibold text-gray-800">{t}</p><p className="text-xs text-gray-600 mt-0.5">{d}</p></div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-purple-300 bg-white p-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Exemplo — dimensão Organização do Trabalho</p>
            <p className="text-sm text-gray-700 leading-relaxed italic">
              &ldquo;Score 2,1 (Alto Risco) em Organização do Trabalho. Observação de campo identificou: jornada média de 10,5h/dia
              nos últimos 3 meses (confirmada com registros de ponto); meta de produção aumentada em 25% no último trimestre
              sem aumento de pessoal; ausência de pausas programadas além do intervalo de almoço; ritmo de trabalho ditado
              pela velocidade da esteira, sem possibilidade de ajuste pelo operador. O conjunto de alta demanda e ausência de
              controle sobre o próprio ritmo configura o quadrante de &apos;trabalho de alto risco&apos; no modelo Karasek.
              Recomendação: revisão da meta de produção com base em capacidade real; implantação de pausas de 10 min a cada
              50 min conforme NR-17 7.4; avaliação de possibilidade de ajuste de velocidade da esteira por setor.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Plano de ação */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal-100">
            <ClipboardCheck className="size-4 text-teal-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Planos de ação — o que funciona</h2>
            <p className="text-xs text-gray-500">Medidas que mudam condições organizacionais vs. medidas que responsabilizam o indivíduo.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">Medidas eficazes (organizacionais)</p>
            <ul className="space-y-1.5 text-xs text-green-800">
              {[
                "Redimensionamento de carga: ajustar metas e quadro de pessoal à capacidade real",
                "Autonomia: permitir que o trabalhador organize seu fluxo de trabalho dentro de parâmetros",
                "Pausas: implantar pausas cognitivas obrigatórias, especialmente em trabalho de alta atenção",
                "Comunicação: criar canais seguros de feedback ascendente",
                "Reconhecimento: estruturar processos regulares de feedback positivo e desenvolvimento",
                "Rodízio: alternar postos e funções para reduzir exposição cumulativa",
              ].map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-green-600" />{m}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-800">Medidas ineficazes (individualizantes)</p>
            <ul className="space-y-1.5 text-xs text-red-800">
              {[
                "Treinamento de resiliência ou mindfulness sem mudança das condições",
                "Orientação para os trabalhadores 'gerenciarem melhor o estresse'",
                "Psicoterapia individual como resposta a problema organizacional",
                "Ginástica laboral sem redução da sobrecarga",
                "'Conscientização' sem ação sobre as causas identificadas",
                "Benefícios de bem-estar (academia, meditação) sem mudança organizacional",
              ].map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-red-500" />{m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Integração com PGR */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
            <Building2 className="size-4 text-blue-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Integração com o PGR</h2>
            <p className="text-xs text-gray-500">Como os resultados do QPS alimentam o Programa de Gerenciamento de Riscos.</p>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <ul className="space-y-3 text-sm text-blue-900">
            {[
              "O QPS é o instrumento de mensuração dos riscos psicossociais no GRO/PGR — não substitui a observação de campo, complementa-a com dados sistemáticos de percepção dos trabalhadores.",
              "Dimensões com Risco Alto ou Crítico devem figurar como riscos formais na Matriz de Riscos do PGR, com medidas de controle, responsável e prazo.",
              "O plano de ação do QPS é parte do Plano de Ação do PGR — deve usar os mesmos campos: O quê, Quem, Quando, Como e Critério de verificação.",
              "A periodicidade de reaplicação recomendada é anual — permite medir a evolução dos scores e a eficácia das intervenções.",
              "Os resultados do QPS, a análise qualitativa e o plano de ação compõem a documentação do PGR exigida pela NR-1 item 1.5.7.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-blue-500 shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Boas práticas */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <Lightbulb className="size-5 shrink-0 text-amber-700 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 mb-3">Boas práticas — o que diferencia uma aplicação de qualidade</p>
            <ul className="space-y-2 text-sm text-amber-800">
              {[
                "Apresente a pesquisa para os trabalhadores antes de começar: explique o que é, como as respostas serão usadas e que nenhum resultado individual será divulgado. A taxa de resposta honesta depende da confiança.",
                "Taxa de resposta < 70% = dados não representativos. Antes de analisar, verifique se há setores com sub-representação que distorçam a média geral.",
                "Setores com < 5 respondentes: nunca apresente resultados desagregados por setor — a preservação do anonimato é inegociável e, uma vez violada, destrói a confiabilidade de todas as pesquisas futuras.",
                "A análise qualitativa (campo 'Análise das Dimensões Críticas') é exigida pela NR-1 — o dado quantitativo mostra onde está o problema, a análise qualitativa explica por quê.",
                "Nunca use os resultados para identificar, monitorar ou punir trabalhadores individualmente. O instrumento perde a credibilidade permanentemente na empresa se isso acontecer uma vez.",
                "Apresente os resultados para os trabalhadores: eles participaram da pesquisa e merecem saber o que ela encontrou e o que será feito. Essa devolutiva é parte essencial da abordagem participativa exigida pela NR-1.",
              ].map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 rounded-full bg-amber-500 shrink-0" />{d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
