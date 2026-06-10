"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileText,
  HelpCircle,
  Info,
  Lightbulb,
  ListChecks,
  MapPin,
  Printer,
  RefreshCw,
  Settings,
  Shield,
  Wrench,
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

// ─── Dados — Itens Expandíveis ────────────────────────────────────────────────

const ITENS_INVENTARIO: ItemData[] = [
  {
    label: "Categorias de risco NR-12",
    conceito: `A NR-12 usa o conceito de categoria de máquina para definir o nível de requisitos de segurança. A categorização da Diretiva de Máquinas Europeia (EN ISO 13849-1) — adotada como referência técnica no Brasil — classifica os sistemas de controle de segurança de Categoria B (básico, sem requisito especial) a Categoria 4 (redundância total, tolerância a falha única). Identificar corretamente a categoria da máquina é o ponto de partida para avaliar se os dispositivos de segurança instalados são adequados para o nível de risco.`,
    como: [
      "Categoria B: aplicável a máquinas de baixo risco onde uma falha no sistema de controle não expõe o operador a perigo imediato. Exemplos: impressoras, tornos de precisão de baixa velocidade com proteções mecânicas.",
      "Categoria 1: sistema de controle usando componentes de comprovada confiabilidade. Para falhas de baixa frequência com baixa severidade.",
      "Categoria 2: sistema com teste periódico da função de segurança. Para frequência de exposição maior.",
      "Categoria 3: sistema com arquitetura redundante — falha única não resulta em perda da função de segurança. Para falhas com severidade alta.",
      "Categoria 4: sistema com redundância total e monitoramento contínuo — falha única e acumulação de falhas não resultam em perda da função de segurança. Para prensas, puncionadeiras, dobradeiras e máquinas de alto risco.",
    ],
    atencao:
      "Instalar dispositivo de parada de emergência ou intertravamento de Categoria 1 em máquina que exige Categoria 3 ou 4 cria uma falsa sensação de segurança — o dispositivo falha na situação mais crítica exatamente quando a proteção é mais necessária.",
    marque_sim:
      "Máquinas com zona de prensagem, cisalhamento, esmagamento, corte ou alta temperatura acessível durante operação — investigar a categoria de segurança dos sistemas de controle instalados.",
  },
  {
    label: "Documentação obrigatória por NR-12",
    conceito: `A NR-12 exige um conjunto específico de documentação para cada máquina e para o programa geral de gestão de máquinas da empresa. A ausência de documentação não é uma não conformidade "burocrática" — ela é a evidência de que a gestão de segurança não foi realizada, o que tem consequências legais em caso de acidente. O inventário é o repositório central dessa documentação — cada máquina deve ter seu "dossiê" técnico acessível.`,
    como: [
      "Manual de operação e manutenção em português (ou tradução técnica providenciada pelo importador): obrigatório para TODA máquina. Manual em idioma estrangeiro sem tradução = não conforme.",
      "Programa de manutenção preventiva com periodicidade definida, responsáveis e registros de execução. Não basta o programa existir — precisa ter registros de execução datados.",
      "Registro de treinamento NR-12 dos operadores: lista de presença com data, conteúdo e carga horária, assinatura do instrutor com qualificação. Treinamento sem registro = treinamento não aconteceu legalmente.",
      "Análise de Risco ou Apreciação de Risco da máquina: para máquinas projetadas antes de 2010 (anteriores à última revisão da NR-12), o empregador é responsável por elaborar a apreciação se o fabricante não forneceu.",
      "Procedimento operacional seguro (POS): para operações com risco específico (setup, limpeza, manutenção). O POS não substitui o manual — complementa com o contexto específico do uso na empresa.",
    ],
    atencao:
      "Em caso de acidente, a ausência de documentação NR-12 é fator agravante na responsabilização do empregador — tanto na esfera trabalhista quanto na criminal. A documentação não protege o trabalhador diretamente, mas protege juridicamente quem investiu em segurança real.",
    marque_sim:
      "Máquina em operação sem manual em português, sem registro de treinamento dos operadores, ou sem apreciação de risco documentada.",
  },
  {
    label: "Integração com Apreciação de Máquinas",
    conceito: `O Inventário e o módulo de Apreciação de Máquinas são complementares: o inventário é o cadastro (quem é a máquina, onde está, o que faz), a apreciação é o diagnóstico técnico de risco (quais são os perigos, qual é o nível de risco, quais são as medidas de controle). Manter os dois sincronizados é o que garante que cada máquina tenha uma apreciação atual e que novas máquinas não "escapem" do processo de avaliação de risco.`,
    como: [
      "Ao cadastrar uma nova máquina no inventário, crie imediatamente uma apreciação de risco — mesmo que preliminar. Máquina sem apreciação é máquina cujos riscos são desconhecidos pelo sistema de gestão.",
      "Use o campo \"Última Apreciação\" no inventário para identificar máquinas com apreciação vencida ou nunca realizada. A periodicidade recomendada é anual ou sempre que houver modificação no processo ou na máquina.",
      "Quando uma apreciação identifica não conformidades, o inventário deve registrar o status: \"Em regularização — prazo X\" ou \"Regularizado em data Y\". Isso mantém a visibilidade do status de cada ativo.",
      "Para máquinas idênticas em série (ex: 5 prensas do mesmo modelo na mesma configuração): uma apreciação de risco serve para o grupo, mas a inspeção de cada máquina individualmente ainda é necessária — desgaste e modificações são individuais.",
      "Integre com o plano de manutenção: máquinas com risco alto identificado na apreciação devem ter frequência de manutenção preventiva aumentada — o risco não espera pelo próximo ciclo programado.",
    ],
    atencao:
      "Inventário com máquinas cadastradas como \"sem apreciação\" não é um sistema de gestão — é uma lista de pendências. A razão de ser do inventário é garantir que NENHUMA máquina opere sem avaliação de risco documentada.",
    marque_sim:
      "Máquina em operação há mais de 12 meses sem apreciação de risco atualizada, ou máquina modificada sem reavaliação após a modificação.",
  },
];

// ─── Passos ───────────────────────────────────────────────────────────────────

const PASSOS = [
  {
    n: "01",
    titulo: "Cadastrar a máquina",
    icone: ClipboardList,
    cor: "emerald",
    descricao:
      "Registre os dados básicos: denominação, fabricante, modelo, número de série, ano de fabricação, potência nominal e localização física.",
    dicas: [
      "Use a plaqueta de identificação da máquina como fonte primária. Se ausente, consulte a documentação do fabricante.",
      "A localização física deve ser específica o suficiente para encontrar a máquina sem ambiguidade: \"Galpão A, linha 3, posição 7\" é melhor que \"Produção\".",
    ],
  },
  {
    n: "02",
    titulo: "Registrar dados técnicos e de risco",
    icone: Settings,
    cor: "blue",
    descricao:
      "Complete: tipo de energia (elétrica, pneumática, hidráulica, térmica), potência, velocidade máxima, dimensões relevantes, peso e identificação de riscos conhecidos.",
    dicas: [
      "Máquinas com múltiplas fontes de energia precisam ter todas listadas — impacta diretamente o procedimento de LOTO.",
      "O campo de riscos conhecidos alimenta a priorização das apreciações de risco.",
    ],
  },
  {
    n: "03",
    titulo: "Registrar documentação técnica",
    icone: FileText,
    cor: "orange",
    descricao:
      "Vincule os documentos disponíveis: manual do fabricante, certificados, laudos anteriores, ASO de operadores, registros de manutenção relevantes.",
    dicas: [
      "Manual em português é obrigatório pela NR-12. Se ausente, registre como pendência.",
      "Laudos de apreciação de risco anteriores fornecem histórico — mantenha todos, mesmo os desatualizados.",
    ],
  },
  {
    n: "04",
    titulo: "Definir responsável e periodicidade",
    icone: Shield,
    cor: "violet",
    descricao:
      "Registre quem é o responsável pela operação, pelo treinamento de operadores e pela manutenção preventiva. Defina a periodicidade de inspeção/manutenção.",
    dicas: [
      "O responsável pelo treinamento de operadores NR-12 deve ter qualificação técnica específica.",
      "A periodicidade de manutenção deve seguir o manual do fabricante e as exigências da NR-12.",
    ],
  },
  {
    n: "05",
    titulo: "Manter o inventário atualizado",
    icone: RefreshCw,
    cor: "gray",
    descricao:
      "Atualize sempre que: uma máquina nova chega, uma é desativada, há reforma relevante ou mudança de localização. Inventário estático não é inventário — é uma lista desatualizada.",
    dicas: [
      "Realize uma verificação de inventário semestral, comparando o sistema com o campo.",
      "Máquinas desativadas devem ser marcadas como tal, não excluídas — mantém o histórico técnico.",
    ],
  },
];

// ─── Boas Práticas ────────────────────────────────────────────────────────────

const BOAS_PRATICAS = [
  "Realize um levantamento físico semestral: compare o inventário do sistema com o campo. Máquinas movidas, desativadas ou instaladas sem registro são garantia de gaps no sistema de gestão.",
  "Inclua máquinas de terceiros operando nas dependências: contratados que trazem equipamentos próprios para trabalho temporário são responsabilidade do empregador contratante quanto à segurança no ambiente.",
  "Máquina desativada mas ainda no local deve permanecer no inventário com status \"desativada\" — não pode ser operada, mas ainda representa risco de acidente se alguém tentar usá-la ou fizer manutenção sem saber que está desativada.",
  "Para máquinas antigas sem documentação de origem: solicite ao fabricante (se ainda ativo) ou elabore internamente com base em inspeção técnica. A ausência de documentação original não desobriga o empregador.",
  "O inventário é um documento vivo — atribuir um responsável nominado pela sua manutenção é a única forma de garantir que permaneça atualizado.",
];

// ─── Helpers de cor ───────────────────────────────────────────────────────────

const COR_BG: Record<string, string> = {
  emerald: "bg-emerald-50 border-emerald-200",
  blue: "bg-blue-50 border-blue-200",
  orange: "bg-orange-50 border-orange-200",
  violet: "bg-violet-50 border-violet-200",
  gray: "bg-gray-50 border-gray-200",
};

const COR_ICON: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-100",
  blue: "text-blue-600 bg-blue-100",
  orange: "text-orange-600 bg-orange-100",
  violet: "text-violet-600 bg-violet-100",
  gray: "text-gray-600 bg-gray-100",
};

const COR_NUM: Record<string, string> = {
  emerald: "text-emerald-700",
  blue: "text-blue-700",
  orange: "text-orange-700",
  violet: "text-violet-700",
  gray: "text-gray-600",
};

// ─── ItemChecklist com expansão ───────────────────────────────────────────────

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
          {/* Por que é importante */}
          <div className="pt-3 space-y-1">
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              Por que é importante?
            </p>
            <p className="text-xs text-gray-700 leading-relaxed">{conceito}</p>
          </div>

          {/* Como aplicar na prática */}
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

          {/* Atenção */}
          {atencao && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-xs text-amber-800">
                <span className="font-bold">Atenção: </span>
                {atencao}
              </p>
            </div>
          )}

          {/* Critério de uso */}
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

// ─── Página ───────────────────────────────────────────────────────────────────

export default function InventarioMaquinasAjudaPage() {
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
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-100">
            <HelpCircle className="size-6 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Guia Técnico — Inventário de Máquinas e Equipamentos
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manual de instrução para cadastro, manutenção e gestão do inventário patrimonial e técnico de máquinas — base para apreciações de risco NR-12.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="print:hidden shrink-0 flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          <Printer className="size-4" />
          Exportar PDF
        </button>
      </div>

      {/* O que é */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="size-5 shrink-0 text-violet-700 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-violet-900">O que é o Inventário de Máquinas?</p>
            <p className="text-sm text-violet-800 leading-relaxed">
              O <strong>Inventário de Máquinas</strong> é o registro patrimonial e técnico de todos os equipamentos da empresa.
              Ele é o ponto de partida para a gestão de SST relacionada a máquinas: sem saber o que existe, não é possível
              planejar apreciações de risco, manutenção preventiva ou treinamento de operadores. A{" "}
              <strong>NR-12</strong> exige que as máquinas sejam identificadas e que as informações técnicas relevantes estejam
              disponíveis — o inventário é a materialização dessa exigência. Para a Chabra, o inventário também alimenta
              diretamente o módulo de <strong>Apreciação de Máquinas</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Fluxo de trabalho */}
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
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl ${COR_ICON[p.cor]}`}
                    >
                      <Ic className="size-4" />
                    </div>
                    {i < PASSOS.length - 1 && (
                      <ChevronRight className="size-3.5 text-gray-300 rotate-90" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span
                        className={`text-xs font-bold tabular-nums ${COR_NUM[p.cor]}`}
                      >
                        {p.n}
                      </span>
                      <p className="font-semibold text-gray-900 text-sm">{p.titulo}</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{p.descricao}</p>
                    {p.dicas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.dicas.map((d, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-xs text-gray-600"
                          >
                            <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-gray-400" />
                            {d}
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
      </div>

      {/* Campos importantes do cadastro */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
            <Info className="size-4 text-blue-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Campos importantes do cadastro</h2>
            <p className="text-xs text-gray-500">
              Entenda o propósito de cada grupo de informações e como preenchê-los corretamente.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          {[
            {
              titulo: "Identificação básica",
              icone: ClipboardList,
              cor: "text-blue-700",
              campos: [
                ["Denominação", "Nome técnico da máquina conforme o fabricante ou o manual. Evite apelidos internos como \"a prensa velha\" — use o nome formal para rastreabilidade."],
                ["Fabricante / Modelo", "Dados da plaqueta de identificação. Essenciais para buscar informações técnicas, peças de reposição e laudos do fabricante."],
                ["Número de série", "Identificador único que vincula o equipamento físico ao registro no sistema. Nunca deixe em branco se disponível — é o campo que evita confusão entre máquinas idênticas."],
                ["Ano de fabricação", "Determina qual versão da NR-12 se aplica (pré ou pós 2010) e influencia a abordagem de apreciação de risco."],
              ],
            },
            {
              titulo: "Localização e responsável",
              icone: MapPin,
              cor: "text-emerald-700",
              campos: [
                ["Localização física", "Especifique: setor, linha, posição ou número de patrimônio físico afixado na máquina. Granularidade suficiente para um técnico novo encontrar a máquina sem orientação."],
                ["Responsável operacional", "Quem supervisiona o uso diário. Não confundir com responsável pela manutenção — podem ser pessoas diferentes."],
                ["Responsável pela manutenção", "Nome e qualificação de quem executa ou coordena a manutenção preventiva e corretiva."],
              ],
            },
            {
              titulo: "Dados técnicos e energia",
              icone: Settings,
              cor: "text-orange-700",
              campos: [
                ["Tipo de energia", "Liste TODAS as fontes: elétrica (tensão e fase), pneumática (pressão máxima), hidráulica, térmica, gravitacional. A completude deste campo define o procedimento de LOTO (Lockout/Tagout) — omitir uma fonte de energia é criar um ponto cego no bloqueio de energia."],
                ["Potência nominal", "Em kW ou CV. Junto ao tipo de energia, dimensiona o risco elétrico e define exigências de proteção contra contatos acidentais (NR-10)."],
                ["Velocidade máxima", "RPM ou m/s para partes móveis. Impacta diretamente o tempo de parada e o dimensionamento de distâncias de segurança (NR-12 Anexo I)."],
              ],
            },
            {
              titulo: "Status e apreciação de risco",
              icone: Shield,
              cor: "text-violet-700",
              campos: [
                ["Status da máquina", "Ativo, Desativado ou Em manutenção. Máquinas desativadas devem ser mantidas no cadastro — não excluídas. Equipamento desativado sem sinalização clara ainda representa risco de operação acidental."],
                ["Data da última apreciação", "Campo crítico para gestão de conformidade. Máquinas sem apreciação ou com apreciação > 12 meses devem ser priorizadas no planejamento do módulo de Apreciação de Máquinas."],
                ["Riscos conhecidos", "Pré-identificação dos perigos principais. Alimenta a priorização e permite que o técnico de apreciação chegue com contexto ao invés de começar do zero."],
              ],
            },
          ].map((grupo, gi) => {
            const Ic = grupo.icone;
            return (
              <div key={gi} className="rounded-lg border border-blue-100 bg-white overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50/70 border-b border-blue-100">
                  <Ic className={`size-4 shrink-0 ${grupo.cor}`} />
                  <p className="text-sm font-semibold text-gray-800">{grupo.titulo}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {grupo.campos.map(([campo, desc], ci) => (
                    <div key={ci} className="px-4 py-3 flex items-start gap-3">
                      <span className="mt-0.5 size-1.5 rounded-full bg-blue-300 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-gray-800">{campo}: </span>
                        <span className="text-xs text-gray-600">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Documentação obrigatória NR-12 */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100">
            <FileText className="size-4 text-orange-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Documentação obrigatória vinculada</h2>
            <p className="text-xs text-gray-500">
              Cada máquina deve ter um &ldquo;dossiê&rdquo; técnico acessível pelo inventário — NR-12 item 12.130 e seguintes.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            A NR-12 exige documentação específica para cada máquina em operação. A ausência de documentação
            não é uma não conformidade burocrática — ela é a evidência de que a gestão de segurança não foi
            realizada, o que tem consequências legais em caso de acidente. Use o inventário para rastrear
            o status documental de cada ativo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                doc: "Manual em português",
                obrig: "Obrigatório (NR-12 item 12.130)",
                cor: "border-red-200 bg-red-50",
                tc: "text-red-700",
                desc: "Manual de operação e manutenção em português ou com tradução técnica. Manual apenas em idioma estrangeiro = não conforme. Se ausente, registre como pendência com prazo de resolução.",
              },
              {
                doc: "Programa de manutenção preventiva",
                obrig: "Obrigatório com registros",
                cor: "border-red-200 bg-red-50",
                tc: "text-red-700",
                desc: "Não basta o programa existir — precisa ter registros de execução datados, assinados pelo executor. Programa sem registros = programa não executado para fins legais.",
              },
              {
                doc: "Registros de treinamento NR-12",
                obrig: "Obrigatório por operador",
                cor: "border-amber-200 bg-amber-50",
                tc: "text-amber-700",
                desc: "Lista de presença com data, conteúdo programático, carga horária e qualificação do instrutor. Treinamento não documentado = treinamento que não ocorreu legalmente.",
              },
              {
                doc: "Apreciação / Análise de Risco",
                obrig: "Obrigatório (NR-12 item 12.128)",
                cor: "border-amber-200 bg-amber-50",
                tc: "text-amber-700",
                desc: "Para máquinas pré-2010 sem documentação do fabricante: o empregador é responsável por elaborar. Deve ser atualizada após modificações e com periodicidade máxima de 12 meses.",
              },
              {
                doc: "Procedimento Operacional Seguro (POS)",
                obrig: "Recomendado / exigível",
                cor: "border-blue-200 bg-blue-50",
                tc: "text-blue-700",
                desc: "Documento específico para operações de risco: setup, limpeza, desobstrução, manutenção com energia presente. Complementa o manual com o contexto de uso real na empresa.",
              },
              {
                doc: "Certificados e ASO dos operadores",
                obrig: "Obrigatório por função",
                cor: "border-blue-200 bg-blue-50",
                tc: "text-blue-700",
                desc: "Atestado de Saúde Ocupacional dos operadores com aptidão documentada para a função. Operador sem ASO válido operando máquina de risco é irregularidade trabalhista.",
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-lg border p-3.5 space-y-1.5 ${item.cor}`}>
                <p className={`text-sm font-semibold ${item.tc}`}>{item.doc}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {item.obrig}
                </p>
                <p className="text-xs text-gray-700">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seções expandíveis — tópicos técnicos */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100">
            <Wrench className="size-4 text-violet-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Conceitos técnicos e referências NR-12</h2>
            <p className="text-xs text-gray-500">
              Clique em cada tópico para ver a explicação detalhada, como aplicar e os critérios de uso.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
          <div className="rounded-lg border border-violet-100 bg-white/70 px-4 py-3">
            <p className="text-xs text-gray-700 leading-relaxed">
              Os tópicos abaixo aprofundam conceitos fundamentais para o correto preenchimento do inventário e para a tomada de
              decisão sobre quais máquinas precisam de atenção prioritária. Utilize-os como referência antes de realizar um
              levantamento de campo ou revisar o status do inventário.
            </p>
          </div>
          {ITENS_INVENTARIO.map((item, i) => (
            <ItemChecklist key={i} {...item} forceOpen={printMode} />
          ))}
        </div>
      </div>

      {/* LOTO — contexto rápido */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle className="size-4 text-red-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">LOTO — Bloqueio e Etiquetagem de Energia</h2>
            <p className="text-xs text-gray-500">
              Por que o inventário é o fundamento do procedimento LOTO (Lockout / Tagout).
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            O LOTO (Lockout / Tagout) — bloqueio e etiquetagem de fontes de energia para manutenção segura — é um dos
            procedimentos de maior impacto na prevenção de acidentes fatais em máquinas. Ele é impossível de executar corretamente
            sem um inventário técnico preciso: é preciso saber <strong>todas</strong> as fontes de energia de cada máquina para
            bloqueá-las antes de qualquer intervenção de manutenção ou limpeza.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                titulo: "Por que o inventário é o pré-requisito",
                items: [
                  "A identificação de fontes de energia no inventário (campo obrigatório) é o insumo primário do procedimento de LOTO de cada máquina.",
                  "Máquina com múltiplas fontes de energia (ex: elétrica + pneumática) sem todas documentadas = LOTO incompleto = manutentor exposto ao risco residual da fonte não identificada.",
                  "Manutenção por empresa terceirizada: o contratado opera com as informações fornecidas pelo contratante — se o inventário está incompleto, o procedimento do terceiro será incompleto.",
                ],
              },
              {
                titulo: "O que documentar para suportar LOTO",
                items: [
                  "Lista completa de fontes de energia com localização física dos pontos de bloqueio (disjuntores, válvulas de fechamento, pinos de bloqueio gravitacional).",
                  "Procedimento de esvaziamento de energia residual (descarga de capacitores, alívio de pressão hidráulica/pneumática, contenção de partes sob gravidade).",
                  "Verificação zero-energia: como confirmar que toda energia foi bloqueada antes de iniciar a intervenção (teste com multímetro, verificação visual de manômetro, tentativa controlada de acionamento).",
                ],
              },
            ].map((grupo, gi) => (
              <div
                key={gi}
                className="rounded-lg border border-red-100 bg-white p-4 space-y-2"
              >
                <p className="text-sm font-semibold text-gray-800">{grupo.titulo}</p>
                <ul className="space-y-2">
                  {grupo.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="mt-1.5 size-1.5 rounded-full bg-red-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 rounded-md border border-red-300 bg-red-100 px-3 py-2.5">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-red-700" />
            <p className="text-xs text-red-900">
              <span className="font-bold">Atenção: </span>
              Acidentes durante manutenção por energização inesperada são responsáveis por uma parcela desproporcional das
              fatalidades em ambiente industrial. O investimento de tempo no preenchimento correto das fontes de energia no
              inventário tem impacto direto na vida dos manutentores.
            </p>
          </div>
        </div>
      </div>

      {/* Boas práticas */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <Lightbulb className="size-5 shrink-0 text-amber-700 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 mb-3">
              Boas práticas para manutenção do inventário
            </p>
            <ul className="space-y-2 text-sm text-amber-800">
              {BOAS_PRATICAS.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 rounded-full bg-amber-500 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
