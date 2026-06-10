"use client";

import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Printer,
  Settings,
  Shield,
  TriangleAlert,
  Wrench,
  Zap,
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

// ─── Dados — Itens do Checklist ───────────────────────────────────────────────

const ITENS_CHECKLIST: ItemData[] = [
  {
    label: "Proteções fixas e móveis",
    conceito: `As proteções físicas são a primeira e mais eficaz barreira entre o trabalhador e a zona de perigo da máquina. A NR-12 classifica-as em fixas (não requerem atuação do operador) e móveis (com intertravamento — a máquina para quando a proteção é aberta). A lógica da hierarquia de controles é clara: uma proteção física bem projetada elimina o risco independentemente do comportamento do operador — uma instrução de procedimento depende do comportamento humano, que é sempre variável.

A zona de perigo compreende o ponto de operação (onde o trabalho é feito), a transmissão de energia (polias, correias, engrenagens, correntes) e a área de saída do material. Uma proteção é eficaz quando cobre toda essa zona de perigo sem criar novos riscos, como pontos de aprisionamento entre a própria proteção e a máquina.

Para proteções com intertravamento, a NR-12 exige que o dispositivo de intertravamento seja monitorado — ou seja, a máquina deve detectar a falha do intertravamento e parar com segurança. Sistemas de intertravamento não monitorados podem falhar silenciosamente, tornando a proteção ineficaz sem que ninguém perceba até a ocorrência do acidente.`,
    como: [
      "Verifique se as proteções cobrem TODA a zona de perigo: ponto de operação (onde o trabalho é feito), transmissão de energia (polias, correias, engrenagens), área de saída do material.",
      "Para proteções com intertravamento: teste o funcionamento — abra a proteção com a máquina em operação lenta e verifique se a máquina para imediatamente. Documente o resultado do teste.",
      "Avalie se a proteção impede ou dificulta a operação: proteções que os trabalhadores removem 'para facilitar' indicam que a proteção está mal projetada para o fluxo real de trabalho — a solução não é disciplinar o trabalhador, é redesenhar a proteção.",
      "Verifique o estado físico: proteções corroídas, frouxas, improvisadas com material inadequado (madeira, fita adesiva) não cumprem sua função protetora mesmo que cubram a zona de perigo.",
      "Para prensas e similares: verifique se há dispositivo de segurança (cortina de luz, duplo comando, válvula de segurança) além da proteção física — NR-12 exige combinação para prensas acima de determinado risco.",
    ],
    atencao:
      "Proteção removida 'temporariamente para manutenção' que permanece removida em operação é uma não conformidade grave — não é uma observação. Documente e recomende paralisação até regularização.",
    marque_sim:
      "Ausência de proteção em zona de perigo acessível durante operação, proteção sem intertravamento funcional onde exigido, ou proteção removida em operação regular.",
  },
  {
    label: "Dispositivos de parada de emergência",
    conceito: `O botão de parada de emergência (cogumelo vermelho com fundo amarelo, auto-retentivo) é exigido pela NR-12 em posição acessível ao operador e, quando necessário, em pontos adicionais da máquina. A Norma ABNT NBR ISO 13850 define os requisitos técnicos. O dispositivo deve ser acionado por qualquer trabalhador em situação de emergência — sem necessidade de treinamento específico para isso, apenas presença e alcance.

O rearme após o acionamento é tão importante quanto o acionamento em si: a retomada da operação deve ser intencional e deliberada, exigindo que alguém gire o botão de cogumelo para destravá-lo e pressione separadamente o botão de rearme. Isso garante que a máquina não reinicie acidentalmente após uma emergência, o que poderia causar um segundo acidente.

A NR-12 distingue categorias de parada: a Categoria 0 (parada imediata pelo corte de energia, sem desaceleração controlada) e a Categoria 1 (desaceleração controlada antes do corte de energia). Máquinas com inércia alta precisam de análise cuidadosa sobre qual categoria é mais segura — o corte imediato pode gerar riscos adicionais de projeção de material em processo.`,
    como: [
      "Verifique a posição: acessível ao operador na posição normal de trabalho sem precisar desviar o olhar das mãos. Em máquinas grandes, verifique pontos adicionais na entrada de material, saída e posições de manutenção.",
      "Teste o funcionamento: acione a parada de emergência com a máquina em operação (com autorização e segurança) e verifique se a máquina para completamente. Cronometre o tempo de parada em máquinas com inércia alta.",
      "Verifique o rearme: a retomada da operação após acionamento da parada de emergência deve ser intencional e deliberada (botão de rearme separado, não apenas soltar o botão) — para evitar reinicialização acidental.",
      "Quantidade e distribuição: NR-12 não define número exato, mas exige que a parada de emergência seja atingível de qualquer posição de operação em tempo útil. Para máquinas > 3 m de comprimento, verifique se um único botão é suficiente.",
      "Estado físico: botão preso, fundo amarelo ausente, sem identificação — mesmo que funcione, a não conformidade de sinalização deve ser registrada.",
    ],
    atencao:
      "Nunca teste a parada de emergência sem informar previamente a todos na área e garantir que não há material ou ferramenta na zona de trabalho que possa gerar projétil no acionamento brusco.",
    marque_sim:
      "Ausência de botão de parada de emergência, botão não funcional, não acessível da posição de operação, ou sem sinalização conforme ABNT NBR ISO 13850.",
  },
  {
    label: "Sinalização e identificação de riscos",
    conceito: `A sinalização de riscos em máquinas cumpre uma função específica diferente da sinalização de segurança geral: ela informa sobre riscos que persistem mesmo com as proteções instaladas, sobre zonas de perigo que não podem ser completamente protegidas, e sobre procedimentos obrigatórios de segurança na operação e manutenção. Não substitui a proteção física — complementa-a onde a eliminação do risco não é tecnicamente possível.

A NR-12 exige, além dos pictogramas de risco, que as máquinas disponham de manual de operação e manutenção em português, permanentemente acessível aos operadores. Esse requisito é frequentemente descumprido em máquinas importadas, onde o empregador recebe o manual em outra língua e não providencia a tradução técnica — a responsabilidade é do empregador, não do fabricante estrangeiro.

A sinalização de sentido de rotação de partes móveis tem valor especial: um trabalhador que conhece o sentido de rotação de uma polia ou eixo pode se afastar do lado correto em caso de risco. Em máquinas antigas e reformadas, essa informação frequentemente se perde com as repinturas.`,
    como: [
      "Verifique se estão presentes: símbolos de riscos (choque elétrico, esmagamento, corte, temperatura) nas zonas pertinentes; indicações de sentido de rotação em partes móveis; instruções de uso do EPI necessário; identificação da máquina com número de patrimônio/série.",
      "Avalie a localização: a sinalização deve estar no campo visual do operador na posição de trabalho, não em local que exija desviar o olhar da tarefa para lê-la.",
      "Verifique a durabilidade: sinalizações com adesivo descascando, texto apagado, cor desbotada não cumprem sua função — precisam de substituição.",
      "Para máquinas com múltiplos pontos de operação ou de acesso para manutenção: verifique se cada ponto tem a sinalização relevante para aquela posição.",
      "Documentação obrigatória pela NR-12: as máquinas devem ter manual de operação e manutenção em português, acessível aos operadores. Verifique se existe e se está disponível no setor.",
    ],
    atencao:
      "Ausência de manual em português em máquina importada é não conformidade NR-12 — a responsabilidade é do empregador, não do fabricante.",
    marque_sim:
      "Ausência de sinalização de risco em zona de perigo identificada, sinalização danificada ou ilegível, ou ausência de manual de operação/manutenção em português.",
  },
  {
    label: "Manutenção e inspeção periódica",
    conceito: `A NR-12 exige que as máquinas sejam mantidas em condições seguras de operação por meio de programa de manutenção preventiva documentado. Mais do que um requisito legal, a manutenção regular é o que sustenta as proteções ao longo do tempo: uma proteção com intertravamento bem calibrada hoje pode falhar em 6 meses sem manutenção. O programa de manutenção é o que garante que a apreciação de riscos feita hoje continue válida no próximo ciclo de avaliação.

O procedimento LOTO (Lock Out Tag Out — Bloqueio e Etiquetagem) é um dos requisitos mais frequentemente não conformes identificados em inspeções de NR-12. Ele determina que toda máquina deve ser desenergizada e bloqueada antes de qualquer intervenção de manutenção, e que o bloqueio deve ser feito por cada trabalhador envolvido com seu próprio cadeado — garantindo que ninguém possa energizar a máquina enquanto outra pessoa ainda está trabalhando nela.

A NR-12 também exige registros de inspeção de segurança em periodicidade definida pelo fabricante ou por análise de risco. Máquinas com funções de segurança (intertravamentos, paradas de emergência, relés de segurança) precisam de inspeção periódica específica para verificar que essas funções continuam operando corretamente — inspeção diferente da manutenção produtiva regular.`,
    como: [
      "Solicite o programa de manutenção preventiva: deve ter periodicidade definida, responsáveis, registros de execução. Programa sem registro de execução é programa não implementado.",
      "Verifique os registros de manutenção recentes: as intervenções dos últimos 6 meses estão documentadas? Há pendências abertas? Há histórico de falhas recorrentes no mesmo componente?",
      "Avalie a LOTO (Lock Out Tag Out): para manutenção em máquinas energizadas, existe e é seguido o procedimento de bloqueio de energia? NR-12 item 12.10 — é um dos requisitos mais frequentemente não conformes.",
      "Para máquinas críticas ou com histórico de falhas: verifique se há inspeção adicional além da preventiva programada, especialmente em componentes relacionados a funções de segurança (intertravamentos, parada de emergência).",
      "Peça evidência de treinamento dos manutentores: quem faz manutenção em máquinas NR-12 deve ter treinamento específico em segurança — sem registro de treinamento, a manutenção feita é um risco adicional.",
    ],
    atencao:
      "Manutenção feita pelo operador sem LOTO e sem proteção individual adequada é um dos principais causadores de acidentes fatais em máquinas — documente como não conformidade grave se identificada.",
    marque_sim:
      "Ausência de programa de manutenção preventiva, registros de execução desatualizados > 6 meses, ausência de procedimento LOTO, ou manutenção realizada com máquina energizada sem dispositivos de bloqueio.",
  },
];

// ─── Passos ───────────────────────────────────────────────────────────────────

const PASSOS = [
  {
    n: "01",
    titulo: "Identificar a máquina",
    icone: Settings,
    cor: "emerald",
    descricao:
      "Cadastre os dados de identificação: fabricante, modelo, ano, número de série, localização e responsável pela operação.",
    dicas: [
      "Consulte a Relação de Máquinas do módulo Inventário para importar dados já cadastrados.",
      "Registre o estado de conservação geral na observação inicial.",
    ],
  },
  {
    n: "02",
    titulo: "Aplicar o checklist por categoria",
    icone: ClipboardCheck,
    cor: "blue",
    descricao:
      "O checklist é organizado por categorias NR-12: Instalação, Proteções e Dispositivos, Operação e Manutenção, Sinalização e Documentação. Para cada item: Conforme / Não Conforme / Não Aplicável.",
    dicas: [
      "Avalie cada item com a máquina em operação quando seguro fazê-lo — alguns não conformes só aparecem em ciclo real.",
      "Para itens 'Não Aplicável', registre brevemente o motivo — evita questionamentos futuros.",
    ],
  },
  {
    n: "03",
    titulo: "Registrar fotos por item",
    icone: Camera,
    cor: "orange",
    descricao:
      "Para cada não conformidade, anexe pelo menos uma foto que evidencie o problema. Fotos comparativas (antes/depois) têm valor especial na validação das correções.",
    dicas: [
      "Foto em ângulo que mostre claramente o risco, com escala de referência quando possível (fita métrica, objeto de tamanho conhecido).",
      "Etiquete cada foto com o número do item no checklist.",
    ],
  },
  {
    n: "04",
    titulo: "Registrar riscos identificados",
    icone: TriangleAlert,
    cor: "yellow",
    descricao:
      "Cada não conformidade relevante deve originar um registro de risco: tipo, descrição, probabilidade, severidade e medidas de controle recomendadas.",
    dicas: [
      "Use a hierarquia de controles NR-12: eliminação > proteção coletiva > sinalização > procedimentos > EPI.",
      "Riscos Graves e Iminentes devem ter recomendação de paralisação imediata da máquina.",
    ],
  },
  {
    n: "05",
    titulo: "Redigir a conclusão técnica",
    icone: FileText,
    cor: "purple",
    descricao:
      "Redija a conclusão consolidando os achados: número de não conformidades por categoria, nível de risco predominante e recomendações por urgência.",
    dicas: [
      "A conclusão é o elemento mais lido do laudo — seja claro e objetivo.",
      "Cite explicitamente o art. e anexo da NR-12 aplicável a cada não conformidade principal.",
    ],
  },
  {
    n: "06",
    titulo: "Gerar o laudo",
    icone: Zap,
    cor: "slate",
    descricao:
      "Gere o PDF com todos os itens avaliados, fotos anexadas e conclusão técnica. O laudo é o documento entregue ao cliente e mantido como evidência técnica.",
    dicas: [
      "Assine o laudo com suas credenciais completas (nome, CREA/CFT, ART quando aplicável).",
      "Estabeleça o prazo de vigência da apreciação — NR-12 exige reavaliação após alterações na máquina ou no processo.",
    ],
  },
];

// ─── Helpers de cor ───────────────────────────────────────────────────────────

const COR_BG: Record<string, string> = {
  emerald: "bg-emerald-50 border-emerald-200",
  blue: "bg-blue-50 border-blue-200",
  orange: "bg-orange-50 border-orange-200",
  yellow: "bg-yellow-50 border-yellow-200",
  purple: "bg-purple-50 border-purple-200",
  slate: "bg-slate-50 border-slate-200",
};
const COR_ICON: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-100",
  blue: "text-blue-600 bg-blue-100",
  orange: "text-orange-600 bg-orange-100",
  yellow: "text-yellow-700 bg-yellow-100",
  purple: "text-purple-600 bg-purple-100",
  slate: "text-slate-600 bg-slate-100",
};
const COR_NUM: Record<string, string> = {
  emerald: "text-emerald-700",
  blue: "text-blue-700",
  orange: "text-orange-700",
  yellow: "text-yellow-700",
  purple: "text-purple-700",
  slate: "text-slate-600",
};

// ─── Componente ItemChecklist ─────────────────────────────────────────────────

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
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{conceito}</p>
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

export default function ApreciacaoMaquinasAjudaPage() {
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
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <HelpCircle className="size-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Guia Técnico — Apreciação de Riscos em Máquinas (NR-12)
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Material de referência para técnicos e engenheiros de segurança do trabalho — checklist NR-12, registro de riscos, conclusão técnica e geração do laudo.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="print:hidden shrink-0 flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition-colors"
        >
          <Printer className="size-4" />
          Exportar PDF
        </button>
      </div>

      {/* O que é */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="size-5 shrink-0 text-slate-700 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">
              O que é a Apreciação de Riscos em Máquinas e qual é o seu papel?
            </p>
            <p className="text-sm text-slate-800 leading-relaxed">
              A <strong>Apreciação de Riscos de Máquinas</strong> é o instrumento técnico principal da
              <strong> NR-12 — Segurança no Trabalho em Máquinas e Equipamentos</strong>. Ela identifica e
              qualifica os riscos em cada máquina, fundamentando as medidas de proteção e as intervenções
              necessárias. Documentar corretamente a apreciação é tanto uma exigência legal (NR-12) quanto
              uma proteção técnica do profissional: é ela que comprova que a análise foi feita e que as
              recomendações foram baseadas em critérios técnicos.
            </p>
            <p className="text-sm text-slate-800 leading-relaxed">
              A NR-12 exige que a apreciação seja realizada por profissional legalmente habilitado
              (engenheiro ou técnico de segurança do trabalho) e que seja atualizada sempre que houver
              modificação na máquina, no processo produtivo ou na organização do trabalho. O laudo gerado
              é o documento formal que fundamenta exigências de adequação e embasa laudos periciais,
              ações fiscais e defesas em ações trabalhistas.
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
                      <span className={`text-xs font-bold tabular-nums ${COR_NUM[p.cor]}`}>
                        {p.n}
                      </span>
                      <p className="font-semibold text-gray-900 text-sm">{p.titulo}</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{p.descricao}</p>
                    {p.dicas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.dicas.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
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

      {/* Legenda tristate */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="size-5 text-gray-600" />
          <h2 className="font-semibold text-gray-800">
            Conforme / Não Conforme / N/A — critério técnico de uso
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              btn: "Conforme",
              bc: "bg-emerald-500",
              titulo: "Requisito atendido",
              cor: "border-emerald-200 bg-emerald-50",
              tc: "text-emerald-700",
              desc: "O item foi verificado in loco e está em conformidade com a NR-12. Registrar 'Conforme' é um resultado técnico tão válido quanto 'Não Conforme' — indica que o item foi avaliado, não apenas ignorado.",
            },
            {
              btn: "Não Conforme",
              bc: "bg-red-500",
              titulo: "Requisito não atendido",
              cor: "border-red-200 bg-red-50",
              tc: "text-red-700",
              desc: "O item foi avaliado e apresenta não conformidade com a NR-12. Deve originar um registro de risco com medida de controle recomendada. Não marque por precaução — marque apenas com evidência.",
            },
            {
              btn: "N/A",
              bc: "bg-gray-400",
              titulo: "Genuinamente inaplicável",
              cor: "border-gray-200 bg-gray-50",
              tc: "text-gray-700",
              desc: "O item não se aplica a esta máquina por suas características construtivas ou operacionais. Ex.: dispositivo de duplo comando em máquina que não tem operação manual de ciclo. Em dúvida entre N/A e Conforme, prefira Conforme e justifique.",
            },
          ].map((c, i) => (
            <div key={i} className={`rounded-xl border p-4 ${c.cor}`}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${c.bc}`}
                >
                  {c.btn}
                </span>
                <span className={`text-sm font-semibold ${c.tc}`}>{c.titulo}</span>
              </div>
              <p className="text-xs text-gray-700">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Itens principais do checklist */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
            <Shield className="size-4 text-slate-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">
              Itens principais do checklist NR-12
            </h2>
            <p className="text-xs text-gray-500">
              Clique em cada item para ver a explicação completa, como aplicar na prática e o critério de uso. Referências: NR-12, ABNT NBR ISO 12100, ABNT NBR ISO 13850, ABNT NBR ISO 13857.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-3">
            <p className="text-xs text-gray-700 leading-relaxed">
              O checklist NR-12 é organizado por categorias: <strong>Instalação e Arranjo Físico</strong> (espaço, iluminação, acesso),{" "}
              <strong>Proteções e Dispositivos de Segurança</strong> (proteções físicas, intertravamentos, dispositivos de parada),{" "}
              <strong>Operação e Manutenção</strong> (procedimentos, LOTO, treinamento), e{" "}
              <strong>Sinalização e Documentação</strong> (pictogramas, manual, ART). Para cada item não conforme, um registro de risco deve ser gerado com a medida de controle recomendada seguindo a hierarquia de controles da NR-12.
            </p>
          </div>
          {ITENS_CHECKLIST.map((item, i) => (
            <ItemChecklist key={i} {...item} forceOpen={printMode} />
          ))}
        </div>
      </div>

      {/* Hierarquia de controles */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
            <Wrench className="size-4 text-blue-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">
              Hierarquia de controles NR-12
            </h2>
            <p className="text-xs text-gray-500">
              Aplique sempre na ordem — controles superiores são mais eficazes e menos dependentes do comportamento humano.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          {[
            {
              nivel: "1",
              titulo: "Eliminação do risco",
              cor: "bg-emerald-50 border-emerald-200",
              tc: "text-emerald-700",
              nc: "text-emerald-600",
              desc: "Modificar o projeto da máquina ou o processo para eliminar completamente o perigo. É a medida mais eficaz — o risco deixa de existir. Ex.: automatizar completamente a alimentação de material, eliminando a exposição do operador à zona de perigo.",
            },
            {
              nivel: "2",
              titulo: "Proteção coletiva (engenharia)",
              cor: "bg-blue-50 border-blue-200",
              tc: "text-blue-700",
              nc: "text-blue-600",
              desc: "Instalar proteções físicas fixas ou com intertravamento, dispositivos de segurança (cortinas de luz, tapetes de segurança, duplo comando) que protegem independentemente do comportamento do operador.",
            },
            {
              nivel: "3",
              titulo: "Sinalização e procedimentos administrativos",
              cor: "bg-yellow-50 border-yellow-200",
              tc: "text-yellow-700",
              nc: "text-yellow-600",
              desc: "Instalar sinalização de riscos, estabelecer e treinar procedimentos operacionais seguros, definir permissões de trabalho (LOTO). Dependem do comportamento humano — menos confiáveis que controles de engenharia.",
            },
            {
              nivel: "4",
              titulo: "EPI (Equipamento de Proteção Individual)",
              cor: "bg-orange-50 border-orange-200",
              tc: "text-orange-700",
              nc: "text-orange-600",
              desc: "Fornecer e exigir o uso de EPI adequado ao risco residual. É sempre a última medida, aplicada ao risco que não pôde ser eliminado ou suficientemente reduzido pelas medidas anteriores. EPI não elimina o risco — apenas reduz a exposição do trabalhador.",
            },
          ].map((h, i) => (
            <div key={i} className={`rounded-lg border p-4 ${h.cor}`}>
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full bg-white border text-xs font-bold ${h.tc} border-current`}
                >
                  {h.nivel}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${h.tc}`}>{h.titulo}</p>
                  <p className="text-xs text-gray-700 mt-1 leading-relaxed">{h.desc}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-blue-200 bg-white p-3.5">
            <p className="text-xs text-gray-700 leading-relaxed">
              <span className="font-semibold text-blue-700">Regra prática:</span> nas recomendações do laudo, classifique cada medida segundo a hierarquia. Recomendações que ficam apenas no nível 3 e 4 (procedimentos e EPI) para riscos que poderiam ser resolvidos por proteção de engenharia serão questionadas por fiscais do trabalho e peritos — e com razão.
            </p>
          </div>
        </div>
      </div>

      {/* Como redigir a conclusão técnica */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
            <FileText className="size-4 text-slate-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Como redigir a conclusão técnica</h2>
            <p className="text-xs text-gray-500">
              A conclusão é o elemento mais lido do laudo — deve ser clara, objetiva e tecnicamente fundamentada.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Uma conclusão fraca diz &ldquo;a máquina apresenta não conformidades com a NR-12&rdquo;. Uma conclusão forte diz quantas
            não conformidades foram encontradas por categoria, qual é o nível de risco predominante, quais itens exigem ação
            imediata e quais podem aguardar planejamento. A diferença é a especificidade — ela é o que transforma um checklist
            preenchido em um documento técnico com valor real para o cliente e para a defesa técnica do profissional.
          </p>
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Estrutura recomendada (4 elementos)
            </p>
            {[
              [
                "1. Sumário de não conformidades",
                "Cite o total de não conformidades por categoria (ex.: 3 em Proteções e Dispositivos, 2 em Sinalização). Isso permite ao cliente entender a distribuição do problema e priorizar recursos.",
              ],
              [
                "2. Nível de risco predominante",
                "Declare explicitamente o risco mais crítico identificado: Grave e Iminente, Alto, Moderado ou Baixo. Se houver risco Grave e Iminente, mencione explicitamente a recomendação de paralisação.",
              ],
              [
                "3. Contexto da máquina",
                "Tipo de operação, tempo de exposição diário dos operadores, número de trabalhadores envolvidos, tempo de uso da máquina e histórico de manutenção — o contexto determina a urgência das intervenções.",
              ],
              [
                "4. Recomendações por urgência",
                "Organize as recomendações em: imediatas (Grave e Iminente — paralisar), urgentes (< 30 dias), planejadas (30–90 dias) e estruturais (> 90 dias — projeto, orçamento). Cite o artigo da NR-12 aplicável a cada não conformidade principal.",
              ],
            ].map(([t, d], i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-start gap-3"
              >
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
              Exemplo de conclusão — Prensa Excêntrica P-03
            </p>
            <p className="text-sm text-gray-700 leading-relaxed italic">
              &ldquo;A apreciação da Prensa Excêntrica P-03 (fabricante: X, ano: 2012, patrimônio: 0034) identificou 7 não
              conformidades com a NR-12: 2 em Proteções e Dispositivos, 2 em Instalação e Arranjo Físico, 2 em Operação e
              Manutenção e 1 em Sinalização e Documentação. O nível de risco predominante é <strong>Alto</strong>, com
              identificação de risco Grave e Iminente pela ausência de proteção no ponto de operação (NR-12 Anexo VII,
              item 2.1) — recomenda-se paralisação imediata da operação até instalação de dispositivo de duplo comando
              ou cortina de luz conforme NR-12 item 12.38. As demais não conformidades podem ser tratadas em prazo de
              30 a 90 dias conforme detalhado nas recomendações. A vigência desta apreciação é de 12 meses ou até a
              ocorrência de modificação na máquina ou no processo.&rdquo;
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
              Boas práticas de campo — o que os técnicos experientes fazem diferente
            </p>
            <ul className="space-y-2 text-sm text-amber-800">
              {[
                "Nunca entre na zona de perigo de uma máquina durante a apreciação sem ter verificado pessoalmente o estado das proteções e a possibilidade de acionamento acidental.",
                "Documente tudo com fotos numeradas referenciando o item do checklist — em uma eventual ação de fiscalização ou jurídica, a evidência visual é muito mais forte que a descrição textual.",
                "Quando identificar risco grave e iminente (ex: proteção totalmente ausente em zona de esmagamento), informe imediatamente o responsável da área e registre a notificação por escrito — não aguarde a entrega do laudo.",
                "Compare o estado atual com a última apreciação quando disponível. Não conformidades que persistem entre ciclos indicam que as recomendações não estão sendo implementadas — documente a reincidência.",
                "Para máquinas importadas sem documentação em português, o empregador é responsável por providenciar a tradução técnica — registre como não conformidade e informe o prazo razoável para regularização.",
              ].map((d, i) => (
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
