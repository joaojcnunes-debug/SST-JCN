"use client";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  FlaskConical,
  Info,
  Layers,
  ListChecks,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import { useState, useCallback } from "react";

interface ItemData {
  label: string;
  conceito: string;
  como: string[];
  atencao?: string;
  marque_sim: string;
}

const ITENS_ANALISE: ItemData[] = [
  {
    label: "FISPQ — como ler e usar",
    conceito:
      "A FISPQ (NBR 14725 / GHS) é o documento de informação de segurança padronizado internacionalmente para produtos químicos. Suas 16 seções cobrem desde identificação do produto até disposição de resíduos. Para a análise de exposição, as seções mais relevantes são: Seção 8 (Controles de Exposição / EPI), Seção 2 (Identificação de Perigos — pictogramas GHS) e Seção 11 (Informações Toxicológicas). A FISPQ deve ser o ponto de partida de qualquer análise — sem ela, a análise começa sem o mapa do risco.",
    como: [
      "Seção 8 — procure TLV-TWA (média ponderada de 8h), TLV-STEL (limite de curta duração, 15 min) e TLV-C (limite de teto, não pode ser excedido em hipótese alguma). Se a FISPQ cita valores da NR-15, eles são os limites legais; se cita ACGIH, são os de referência técnica.",
      "Seção 2 — os pictogramas GHS informam a classe de perigo: crânio = toxicidade aguda; exclamação = irritante; chama = inflamável; saúde = carcinogênico/mutagênico. Produtos com \"saúde\" (ghs08) exigem especial atenção para exposição crônica.",
      "Seção 11 — informações sobre toxicocinética (absorção, distribuição, metabolismo, excreção) ajudam a entender se o risco é por inalação, contato dérmico ou ingestão — o que define os controles mais eficazes.",
      "Verifique a data de emissão: FISPQ deve ser atualizada pelo fabricante sempre que há novos dados de segurança. FISPQ com > 5 anos pode ter limites defasados — consulte fontes primárias (ACGIH TLVs anuais).",
      "Para produtos nacionais: exija FISPQ em português. Para importados sem FISPQ em português: o importador é responsável por providenciar — documente como não conformidade.",
    ],
    atencao:
      "FISPQ não substitui a medição ambiental. Ela informa o potencial de risco do produto puro; a exposição real depende da concentração no ar, do tempo de exposição e dos controles existentes — fatores que só a medição ambiental quantifica.",
    marque_sim:
      "Agente com TLV-TWA ou limite NR-15 definido, presente em quantidade e forma que gere aerossol, vapor ou fumo durante o processo, com trabalhadores em exposição regular.",
  },
  {
    label: "Limites de exposição — NR-15 vs ACGIH",
    conceito:
      "Existem dois conjuntos principais de limites de exposição usados no Brasil: os Limites de Tolerância (LT) da NR-15 (Anexos 11 e 12), de caráter legal, e os Threshold Limit Values (TLVs) da ACGIH (American Conference of Governmental Industrial Hygienists), de caráter técnico-científico. Os TLVs são atualizados anualmente pela ACGIH com base na literatura científica mais recente; a NR-15 tem atualização menos frequente. Para agentes sem limite na NR-15, os TLVs são a referência técnica padrão no Brasil.",
    como: [
      "Para cada agente, verifique primeiro se há limite na NR-15 (Anexo 11 para substâncias químicas). Se houver, é o limite legal — mas compare com o TLV atual. Se o TLV for mais restritivo, adote-o como referência técnica adicional.",
      "TLV-TWA (Time Weighted Average): concentração média ponderada no tempo para 8h/dia, 40h/semana, de forma contínua sem efeito adverso para a maioria dos trabalhadores. É o limite principal para exposição crônica.",
      "TLV-STEL (Short Term Exposure Limit): concentração máxima por até 15 min, máximo 4 vezes por dia, com intervalo mínimo de 1h entre os períodos. Não substitui o TWA — é um complemento para picos de exposição.",
      "TLV-C (Ceiling): concentração que nunca deve ser excedida, nem instantaneamente. Usado para agentes de toxicidade aguda imediata (ex: HCN, Cl₂).",
      "Valor de Referência Tecnológico (VRT): para agentes carcinogênicos ou sem limite seguro estabelecido, o VRT não é um \"limite seguro\" — é o mínimo alcançável com as tecnologias disponíveis. Exposição abaixo do VRT reduz o risco, mas não o elimina.",
    ],
    atencao:
      "Estar dentro do limite não significa que o trabalhador está seguro de forma absoluta — os limites são baseados em probabilidade de efeito em população trabalhadora \"padrão\" e não protegem 100% dos indivíduos, especialmente os mais sensíveis (alérgicos, gestantes, imunocomprometidos).",
    marque_sim:
      "IE > 0,5 (50% do limite) em qualquer amostra, ou concentração medida acima de qualquer TLV-C definido para o agente.",
  },
  {
    label: "Controles de exposição — hierarquia",
    conceito:
      "A hierarquia de controles (NR-09, ISO 45001) define a ordem de eficácia das medidas de controle de exposição química: 1ª eliminação do agente; 2ª substituição por agente menos tóxico; 3ª controles de engenharia (enclausuramento, ventilação localizada exaustora — VLE); 4ª controles administrativos (rodízio, redução de jornada, procedimentos); 5ª EPI (respiradores). Não existe boa prática que inverta essa hierarquia — fornecer respirador sem investigar VLE é gestão de risco inadequada.",
    como: [
      "Avalie a eliminação: é possível reformular o processo sem o agente químico? Muitas soluções de limpeza industrial tóxicas têm substitutos mais seguros igualmente eficazes.",
      "Para VLE (Ventilação Local Exaustora): verifique se está instalada no ponto de geração do agente (não no ambiente geral). Mede a velocidade de captura — referência: ao menos 0,25–0,5 m/s no ponto de geração para a maioria dos vapores e fumos.",
      "Avalie a efetividade dos controles instalados: se há controles de engenharia mas a concentração ainda está acima do limite, os controles não estão funcionando adequadamente — identifique o ponto de falha.",
      "Para seleção de respirador: identifique a classe de risco (particulado, vapor orgânico, ácido, base). Um respirador de meia-face com filtro P2 protege de poeiras e fumos sólidos mas NÃO de vapores orgânicos — a seleção errada é tão perigosa quanto a ausência de EPI.",
      "Documente a razão de proteção atribuída (RPA) do respirador selecionado e verifique se é suficiente para a concentração encontrada: RPA = concentração ambiente ÷ concentração no interior da máscara. RPA necessária = concentração medida ÷ TLV.",
    ],
    atencao:
      "Usar respirador de carvão ativado para vapores de isocianatos, ácidos ou compostos altamente tóxicos (com IDLH baixo) sem monitoramento de breakthrough é inseguro — esses agentes não têm aviso sensorial adequado e o filtro esgotado não é perceptível.",
    marque_sim:
      "Concentração > 50% do TLV-TWA sem controles de engenharia instalados, ou controles instalados que não reduzem a exposição abaixo do limite, ou seleção de respirador inadequada para a classe de agente.",
  },
  {
    label: "Poeiras e material particulado",
    conceito:
      "As poeiras ocupacionais são uma das causas mais importantes de doença pulmonar ocupacional no mundo: silicose (poeira de sílica cristalina), asbestose (fibras de amianto, proibido no Brasil desde 2017 mas ainda presente em instalações antigas), pneumoconioses (poeira de carvão, minerais) e doença pulmonar obstrutiva crônica (DPOC). A fração respirável (< 10 μm aerodinâmico) é a única relevante para efeitos pulmonares — partículas maiores são retidas nas vias aéreas superiores. Para sílica cristalina (quartzo), o TLV-TWA da ACGIH é 0,025 mg/m³ — extremamente restritivo por ser carcinogênico.",
    como: [
      "Identifique a granulometria do processo: operações de corte, lixamento, polimento, jateamento, ensacamento de pó fino geram fração respirável em abundância. Mistura úmida ou peletização reduzem a geração de fração respirável.",
      "Para silica: identifique se o material contém sílica cristalina livre (quartzo) — areia, pedra, cerâmica, cimento, vidro. Solicite análise de composição do material ou consulte literatura técnica (NIOSH Pocket Guide).",
      "Método de coleta: cassete com ciclone para fração respirável (4L/min), cassete sem ciclone para poeira total (2L/min). O laboratório precisa saber qual fração está sendo coletada para usar o filtro e o método analítico corretos.",
      "Para poeiras insolúveis sem toxicidade específica: TLV-TWA geral é 3 mg/m³ (fração respirável) e 10 mg/m³ (poeira total) — mas verifique se há mineral específico presente que tenha TLV mais restritivo.",
      "Avalie o tempo de geração: poeira de lixamento intermitente por 30 min/turno é muito diferente de poeira de moagem contínua por 8h — a estratégia de amostragem deve refletir o perfil temporal real da exposição.",
    ],
    atencao:
      "Limite de NR-15 para \"poeiras insolúveis\" (8 mg/m³) está desatualizado e muito acima do TLV-TWA da ACGIH (3 mg/m³ para fração respirável). Para avaliação técnica contemporânea, use o TLV-ACGIH como referência — não o limite NR-15 defasado.",
    marque_sim:
      "Atividades geradoras de poeiras respiráveis (corte, lixamento, jateamento, ensacamento) sem controle de ventilação por exaustão, ou concentração medida > 50% do TLV da fração relevante.",
  },
];

const BOAS_PRATICAS = [
  "Comece sempre pela FISPQ antes da medição. A FISPQ diz para onde olhar; a medição confirma o que você encontrou.",
  "Registre o contexto da medição: velocidade do vento, temperatura, estado da ventilação, ritmo de trabalho durante a amostragem. Medições idênticas em contextos diferentes têm interpretações diferentes.",
  "Amostras abaixo do limite de detecção do método devem ser registradas como \"< LOD\" (limite de detecção), não como \"zero\" — a diferença é técnica e estatisticamente relevante.",
  "Para LTCAT (aposentadoria especial): a análise qualitativa (FISPQ + processo) pode ser suficiente para concluir pela exposição mesmo sem medição, quando a literatura técnica e as condições de uso indicam exposição acima dos limites.",
  "Reavalie sempre que houver mudança de processo, de matéria-prima ou de layout — uma análise química não tem validade permanente.",
];

const PASSOS = [
  {
    n: "01",
    titulo: "Identificar os agentes químicos",
    icone: Search,
    cor: "emerald",
    descricao:
      "Liste todos os agentes químicos presentes no ambiente: matérias-primas, produtos intermediários, produtos finais, subprodutos de processo (fumos, névoas, poeiras, vapores) e produtos de limpeza e manutenção.",
    dicas: [
      "Solicite o inventário de produtos químicos da empresa — é obrigatório pelo decreto 2.657/1998 (FISPQ).",
      "Não limite a busca aos produtos intencionalmente usados: fumos de solda, poeira de madeira e névoas de óleo de corte são agentes que emergem do processo.",
    ],
  },
  {
    n: "02",
    titulo: "Consultar as FISPQs",
    icone: FileText,
    cor: "blue",
    descricao:
      "Para cada agente identificado, consulte a FISPQ (seção 8 — Controles de Exposição) para identificar: TLV-TWA, TLV-STEL, TLV-C e VRT (Valor de Referência Tecnológico, quando aplicável).",
    dicas: [
      "FISPQ desatualizada (> 5 anos) pode ter limites defasados. Consulte sempre a fonte mais atual (ACGIH TLVs® Booklet ou NR-15).",
      "Se a FISPQ não fornece limite, consulte ACGIH, NIOSH REL ou OSHA PEL diretamente.",
    ],
  },
  {
    n: "03",
    titulo: "Definir a estratégia de amostragem",
    icone: Layers,
    cor: "purple",
    descricao:
      "Defina quais trabalhadores amostrar (GHE — Grupos Homogêneos de Exposição), o método de coleta (gravimétrico, colorimétrico, cromatográfico) e a duração da amostragem (8h ou fração).",
    dicas: [
      "O GHE agrupa trabalhadores com exposição similar. Basta amostrar os de maior exposição no grupo.",
      "Amostras de curta duração (15 min) são usadas para TLV-STEL. Amostras de jornada completa para TLV-TWA.",
    ],
  },
  {
    n: "04",
    titulo: "Registrar os resultados analíticos",
    icone: ClipboardList,
    cor: "orange",
    descricao:
      "No sistema, registre para cada agente: concentração medida, limite de referência (TLV-TWA ou NR-15), método analítico, laboratório/responsável e data da coleta.",
    dicas: [
      "Registre TODAS as amostras — incluindo as dentro do limite. A tendência histórica (série de análises ao longo do tempo) é tão importante quanto o resultado pontual.",
      "Para poeiras: distinga poeira total de fração respirável — os limites são diferentes e a fração respirável é a relevante para efeitos pulmonares.",
    ],
  },
  {
    n: "05",
    titulo: "Calcular e interpretar",
    icone: FlaskConical,
    cor: "red",
    descricao:
      "O sistema calcula automaticamente o Índice de Exposição (IE = concentração medida ÷ limite de referência). IE < 0,5 = baixo; 0,5–1,0 = atenção; > 1,0 = acima do limite.",
    dicas: [
      "IE > 1,0 exige medida de controle imediata e comunicação ao SESMT/médico do trabalho.",
      "Para misturas de agentes de mesma ação: some os IEs individuais — a mistura é considerada no limite se a soma ≥ 1,0.",
    ],
  },
  {
    n: "06",
    titulo: "Gerar o laudo e o relatório",
    icone: BookOpen,
    cor: "emerald",
    descricao:
      "O relatório final inclui metodologia, resultados tabelados, comparação com limites, conclusão técnica e recomendações de controle.",
    dicas: [
      "O laudo de análise química, quando embasando aposentadoria especial, deve seguir o modelo do LTCAT (NR-15 e Decreto 3.048/1999).",
      "Indique o prazo de validade da avaliação: NR-15 e boas práticas recomendam reavaliação anual ou sempre que houver mudança no processo.",
    ],
  },
];

const COR_MAP: Record<
  string,
  { bg: string; border: string; text: string; badge: string; dot: string }
> = {
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-400",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-400",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-800",
    dot: "bg-purple-400",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-800",
    dot: "bg-orange-400",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-400",
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

interface PassoCardProps {
  n: string;
  titulo: string;
  icone: React.ElementType;
  cor: string;
  descricao: string;
  dicas: string[];
}

function PassoCard({ n, titulo, icone: Icone, cor, descricao, dicas }: PassoCardProps) {
  const c = COR_MAP[cor] ?? COR_MAP["emerald"];
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 size-8 rounded-full flex items-center justify-center ${c.badge}`}
        >
          <Icone className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold ${c.text} uppercase tracking-widest`}>
              Passo {n}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{titulo}</p>
        </div>
      </div>
      <p className="text-xs text-gray-700 leading-relaxed">{descricao}</p>
      {dicas.length > 0 && (
        <ul className="space-y-1.5">
          {dicas.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className={`mt-1.5 size-1.5 rounded-full ${c.dot} shrink-0`} />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AjudaAnaliseQuimicosPage() {
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 size-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <FlaskConical className="size-6 text-emerald-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="size-3.5 text-emerald-600" />
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    Manual de Instrução
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  Análise de Agentes Químicos
                </h1>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Guia técnico completo para quantificação da exposição a substâncias químicas,
                  interpretação de limites de tolerância e embasamento do LTCAT no Painel SST.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="print:hidden shrink-0 flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              <Printer className="size-4" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* O que é */}
        <div className="rounded-xl border border-emerald-200 bg-white p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              O que é este módulo?
            </h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            A <strong>Análise de Agentes Químicos</strong> quantifica a exposição dos trabalhadores
            a substâncias químicas no ambiente de trabalho e compara com os limites de tolerância
            estabelecidos pelas normas (NR-15, ACGIH, NIOSH, OSHA). É obrigatória para empresas
            com exposição identificada no GRO/PGR e fundamenta o{" "}
            <strong>LTCAT</strong> (Laudo Técnico das Condições Ambientais do Trabalho) para fins
            previdenciários e de aposentadoria especial.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            A <strong>FISPQ</strong> (Ficha de Informação de Segurança de Produtos Químicos) é o
            documento-base de toda análise — ela fornece o mapa de perigos do agente e os limites
            de referência antes mesmo de qualquer medição ambiental ser realizada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                Base normativa
              </p>
              <p className="text-xs text-gray-700">NR-15, NR-09, NHO-01 a NHO-11 (Fundacentro)</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
                Referência técnica
              </p>
              <p className="text-xs text-gray-700">ACGIH TLVs, NIOSH REL, OSHA PEL</p>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5">
                Finalidade legal
              </p>
              <p className="text-xs text-gray-700">LTCAT — Decreto 3.048/1999, art. 58</p>
            </div>
          </div>
        </div>

        {/* Fluxo de trabalho */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Fluxo de trabalho
            </h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed -mt-2">
            Seis passos sequenciais para uma análise completa e tecnicamente defensável.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PASSOS.map((p) => (
              <PassoCard
                key={p.n}
                n={p.n}
                titulo={p.titulo}
                icone={p.icone}
                cor={p.cor}
                descricao={p.descricao}
                dicas={p.dicas}
              />
            ))}
          </div>
        </div>

        {/* Índice de Exposição — legenda rápida */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Índice de Exposição (IE) — como interpretar
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            IE = Concentração medida ÷ Limite de referência (TLV-TWA ou NR-15)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-lg font-black text-emerald-700 mb-0.5">IE &lt; 0,5</p>
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                Baixo
              </p>
              <p className="text-xs text-gray-600">
                Exposição abaixo de 50% do limite. Manter controles existentes e monitorar.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-lg font-black text-amber-700 mb-0.5">0,5 – 1,0</p>
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                Atenção
              </p>
              <p className="text-xs text-gray-600">
                Zona de vigilância. Reforçar controles e aumentar frequência de monitoramento.
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
              <p className="text-lg font-black text-red-700 mb-0.5">IE &gt; 1,0</p>
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">
                Acima do limite
              </p>
              <p className="text-xs text-gray-600">
                Medida de controle imediata. Comunicar SESMT/médico do trabalho. Reavaliação urgente.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5 flex items-start gap-2.5">
            <AlertTriangle className="size-3.5 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800">
              <span className="font-bold">Misturas de agentes de mesma ação: </span>
              some os IEs individuais. A mistura está no limite quando a soma dos IEs ≥ 1,0, mesmo
              que cada agente individualmente esteja abaixo.
            </p>
          </div>
        </div>

        {/* Seções expandíveis */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Conceitos técnicos essenciais
            </h2>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Clique em cada item para expandir o conceito, orientações práticas e critério de uso.
          </p>
          <div className="space-y-2">
            {ITENS_ANALISE.map((item) => (
              <ItemChecklist key={item.label} {...item} forceOpen={printMode} />
            ))}
          </div>
        </div>

        {/* Ventilação e controles adicionais */}
        <div className="rounded-xl border border-blue-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wind className="size-4 text-blue-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Ventilação local exaustora (VLE) — referências rápidas
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Velocidade de captura mínima
              </p>
              <ul className="space-y-1">
                {[
                  "Vapores e gases em repouso: 0,25–0,5 m/s",
                  "Névoas e fumos de baixa toxicidade: 0,5–1,0 m/s",
                  "Fumos e vapores tóxicos: 1,0–2,5 m/s",
                  "Poeiras pesadas / jateamento: 2,5–10 m/s",
                ].map((v, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                    <span className="mt-1.5 size-1 rounded-full bg-blue-400 shrink-0" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                Seleção de filtro respirador
              </p>
              <ul className="space-y-1">
                {[
                  "PFF1/P1: poeiras inativas, < 4× TLV",
                  "PFF2/P2: poeiras tóxicas, fumos metálicos, < 10× TLV",
                  "PFF3/P3: agentes altamente tóxicos, < 50× TLV",
                  "Carvão ativado (OV): vapores orgânicos — NÃO para ácidos/isocianatos",
                  "Combinado OV/P100: vapores orgânicos + particulados",
                ].map((v, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                    <span className="mt-1.5 size-1 rounded-full bg-purple-400 shrink-0" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* LTCAT e aposentadoria especial */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              LTCAT e aposentadoria especial — o que documentar
            </h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            O LTCAT (Laudo Técnico das Condições Ambientais do Trabalho) é o documento pericial
            que fundamenta o reconhecimento de agentes nocivos para fins de aposentadoria especial
            (Decreto 3.048/1999, art. 58). Para agentes químicos, deve conter obrigatoriamente:
          </p>
          <div className="space-y-2">
            {[
              {
                titulo: "Identificação do agente nocivo",
                desc: "Nome técnico, CAS, número de registro, forma física (vapor, névoa, fumo, poeira) e vias de absorção (inalação, pele, ingestão).",
              },
              {
                titulo: "Metodologia de avaliação",
                desc: "Norma de referência (NHO, NIOSH, OSHA), equipamento de amostragem, laboratório analítico credenciado (INMETRO/ISO 17025), data e condições da amostragem.",
              },
              {
                titulo: "Resultado e comparação com limites",
                desc: "Concentração medida, limite de referência adotado (NR-15 Anexo 11 ou ACGIH TLV-TWA), Índice de Exposição calculado, conclusão sobre habitualidade e permanência.",
              },
              {
                titulo: "Habitualidade e permanência",
                desc: "O agente deve estar presente de forma habitual e permanente (não eventual). Documente a frequência, duração por turno e continuidade histórica da exposição.",
              },
              {
                titulo: "Assinatura de responsável técnico",
                desc: "Médico do trabalho ou engenheiro de segurança do trabalho (CRM/CREA), conforme NR-15 e orientações do INSS.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{item.titulo}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Boas práticas */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Boas práticas
            </h2>
          </div>
          <ul className="space-y-2.5">
            {BOAS_PRATICAS.map((bp, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 size-5 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">{bp}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Rodapé */}
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 flex items-center gap-2.5">
          <Info className="size-3.5 text-gray-400 shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Este manual é um guia de apoio técnico. As normas regulamentadoras (NR-15, NR-09) e
            as publicações anuais da ACGIH são as fontes primárias obrigatórias. Em caso de dúvida
            interpretativa, consulte o SESMT ou o médico coordenador do PCMSO.
          </p>
        </div>
      </div>
    </div>
  );
}
