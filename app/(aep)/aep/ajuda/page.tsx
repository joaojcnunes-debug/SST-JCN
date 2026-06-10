"use client";

import {
  AlertTriangle,
  BookOpen,
  Brain,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  TriangleAlert,
  User,
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

// ─── Dados — Ergonomia Física ─────────────────────────────────────────────────

const FISICA_INTRO = `A Ergonomia Física estuda a relação entre o corpo humano e as demandas mecânicas do trabalho.
Quando o trabalhador é obrigado a manter posições que afastam as articulações da posição neutra, realizar movimentos
de alta frequência ou exercer força acima da capacidade sustentável, o sistema musculoesquelético entra em sobrecarga.
O resultado são as LER/DORT — Lesões por Esforços Repetitivos e Distúrbios Osteomusculares Relacionados ao Trabalho —
que representam a principal causa de afastamento por doença ocupacional no Brasil. A grande armadilha é que o dano
se acumula silenciosamente por meses ou anos antes de o trabalhador sentir dor, o que torna a triagem preventiva
fundamental. A sua função aqui é identificar os fatores de risco antes que o dano aconteça.`;

const FISICA_ITENS: ItemData[] = [
  {
    label: "Posturas inadequadas / forçadas",
    conceito: `Postura inadequada é qualquer posição que afasta uma ou mais articulações do chamado "envelope neutro" — a faixa em que os músculos e tendões trabalham com menor tensão interna. Fora desse envelope, os músculos precisam de mais força para sustentar a mesma carga, os tendões ficam comprimidos em suas bainhas e os nervos podem ser pressionados. Quanto maior o ângulo de desvio e maior o tempo de manutenção, maior o risco. A combinação de ângulo acentuado + manutenção estática + força é a mais perigosa de todas — é o que acontece, por exemplo, com um montador que segura uma peça pesada com os braços estendidos acima da cabeça.`,
    como: [
      "Observe o trabalhador executando a tarefa real, no ritmo real. Nunca peça que 'demonstre devagar' — o corpo adota posturas de compensação quando está consciente de ser observado.",
      "Avalie cada segmento separadamente: pescoço, tronco, ombros, cotovelos, punhos. Um trabalhador pode ter postura de tronco adequada e postura cervical crítica ao mesmo tempo.",
      "Ângulos de referência — VERMELHO acima disso: pescoço flexão > 20°; tronco flexão > 45°; tronco rotação > 30°; ombro elevação > 60°; punho desvio > 15° em qualquer plano.",
      "Método RULA (membros superiores e pescoço): escore 1–2 = aceitável; 3–4 = investigar; 5–6 = mudança em breve; 7 = mudança imediata. Para o corpo todo, use REBA com a mesma escala.",
      "Postura estática também é risco: ficar parado na mesma posição por > 4 minutos sem se mover — mesmo em posição neutra — reduz o fluxo sanguíneo muscular e causa fadiga precoce. Pergunte: 'Você consegue mudar de posição durante o trabalho ou fica parado a maior parte do tempo?'",
    ],
    atencao: "Erro comum: avaliar só o tronco e ignorar pescoço e punhos. Digitadores com tronco reto e punho em extensão de 30° estão em risco alto para síndrome do túnel do carpo — e o técnico que olhar só a cadeira vai embora sem identificar o problema.",
    marque_sim: "Se qualquer articulação supera os ângulos de referência por > 30% do ciclo de trabalho, ou se há postura estática sem alternância por > 4 minutos de forma habitual.",
  },
  {
    label: "Movimentos repetitivos",
    conceito: `O problema da repetitividade não é o movimento em si — é o acúmulo de microtraumas nos tendões, bainhas tendíneas e nervos quando o mesmo padrão é repetido centenas ou milhares de vezes por turno. O tendão suporta bem cargas ocasionais, mas não se recupera completamente entre ciclos curtos. Com o tempo, a inflamação crônica instala a tendinite ou a tenossinovite. A frequência crítica identificada pela literatura é de 2 repetições por minuto do mesmo padrão de movimento para um mesmo grupo muscular — abaixo disso, o tecido tem tempo de se recuperar; acima, a recuperação fica incompleta. Uma digitadora que pressiona teclas 8.000 vezes por hora está 66 vezes acima desse limite para os flexores dos dedos.`,
    como: [
      "Cronometre o ciclo de trabalho: o tempo do início de uma unidade de trabalho até o início da próxima idêntica. Ciclos < 30 segundos são automaticamente classificados como alta repetição.",
      "Conte as repetições do padrão dominante por minuto. Para montagem manual, costura, embalagem, caixa de supermercado: frequências > 5–10 ciclos/min em punho/ombro são comuns e problemáticas.",
      "Calcule a dose diária: frequência × duração. Uma tarefa com repetição moderada (3 ciclos/min) feita por 7h contínuas é mais lesiva do que alta repetição (10 ciclos/min) por 1h.",
      "Verifique a combinação com força: digitar sem força é diferente de aparafusar manualmente sem ferramenta. Força + repetição multiplica o risco — esta combinação é o perfil clássico de LER/DORT.",
      "Identifique a dominância manual: trabalhadores destros usando apenas a mão direita durante todo o turno acumulam carga unilateral. Verifique se o posto permite troca de mãos.",
    ],
    atencao: "Erro comum: considerar apenas tarefas manuais. Trabalhadores de telemarketing repetem padrões vocais e cognitivos de forma intensa, e operadores de pedal repetem movimentos de tornozelo/joelho que raramente são avaliados.",
    marque_sim: "Se o ciclo de trabalho é < 30 segundos, ou se há > 2 repetições/min do mesmo padrão por ≥ 2 horas contínuas, ou > 4 horas/turno mesmo com pausas intermediárias.",
  },
  {
    label: "Levantamento / transporte de cargas",
    conceito: `A coluna lombar é a estrutura mais lesionada no trabalho manual pesado. Os discos intervertebrais funcionam como amortecedores hidráulicos — suportam bem cargas axiais (peso direto sobre a coluna ereta), mas são altamente vulneráveis à combinação de compressão + torção que ocorre quando levantamos uma carga curvados e rodando o tronco. A pressão intradiscal nessa posição pode superar 10 vezes o peso da carga. A hérnia de disco lombar em trabalhadores jovens é quase sempre de origem ocupacional. O método NIOSH quantifica o Limite de Peso Recomendado (LPR) para cada situação específica — o mesmo trabalhador pode levantar 23 kg com segurança em uma situação e apenas 8 kg em outra, dependendo de altura, distância, frequência e assimetria.`,
    como: [
      "Observe a postura durante o levantamento: curvatura lombar durante a fase de pega, rotação do tronco enquanto carrega, distância horizontal da carga ao corpo. A carga a 60 cm à frente do corpo exerce o triplo do torque na coluna em relação à carga encostada ao abdômen.",
      "Equação de NIOSH simplificada para triagem: peso recomendado base = 23 kg. Reduza conforme: pega baixa (abaixo do joelho) → × 0,6; pega alta (acima dos ombros) → × 0,6; distância > 40 cm do corpo → × 0,5; rotação > 30° → × 0,7. Multiplique os fatores — em más condições, o limite real pode ser < 7 kg.",
      "Para transporte horizontal: avalie distância, frequência e terreno. Carregar 15 kg por 100 metros em piso liso é muito diferente de carregar pelo mesmo peso por escadas ou piso irregular.",
      "Empurrar e puxar: a força inicial de partida é geralmente 2–3× maior que a força de manutenção. Para carrinhos manuais, a força de partida não deve exceder 20 kgf para homens e 15 kgf para mulheres. Verifique o estado das rodas — rodas travadas ou danificadas multiplicam a força necessária.",
      "Entreviste trabalhadores sobre dor lombar: dor que piora durante a jornada e melhora no fim de semana é sinal clássico de origem mecânico-ocupacional.",
    ],
    atencao: "Erro comum: avaliar o peso isoladamente. Um técnico que vê '10 kg' e considera aceitável pode estar ignorando que a pega é feita abaixo do joelho, com rotação de 45° e 15 vezes por hora — situação de risco alto mesmo com carga aparentemente razoável.",
    marque_sim: "Se o Índice de Levantamento NIOSH estimado é > 1,0 para a situação observada, ou se há cargas > 12 kg com frequência ou > 25 kg em qualquer frequência, ou levantamento habitual fora da zona entre joelho e cotovelo.",
  },
  {
    label: "Mobiliário inadequado",
    conceito: `O mobiliário é o principal mediador da postura no trabalho sedentário. Uma cadeira sem regulagem de altura obriga o trabalhador baixo a sentar com os pés suspensos (comprimindo a face posterior das coxas e reduzindo a circulação) e o trabalhador alto a sentar com os joelhos elevados acima do quadril (invertendo a lordose lombar). Uma mesa muito alta obriga elevação dos ombros; muito baixa, flexão excessiva de tronco. O ponto-chave é que o trabalhador se adapta ao mobiliário inadequado — adota uma postura de sobrevivência, não uma postura saudável. Essa adaptação é o que o técnico precisa identificar.`,
    como: [
      "Avalie a cadeira com o trabalhador sentado na sua posição real de trabalho, não na posição 'correta' que ele adota quando sabe que está sendo observado. Verifique: pés apoiados no chão (ou em apoio de pés)? Ângulo quadril-tronco ≥ 90°? Apoio lombar posicionado na região L2–L5? Cotovelos próximos ao ângulo de 90° com o plano de trabalho?",
      "Para monitor: topo da tela ao nível dos olhos ± 5 cm. Monitor muito baixo força flexão cervical; muito alto força extensão. Distância ideal: 50–70 cm. Monitores laterais forçam rotação cervical mantida — verifique a posição relativa à visão principal do trabalhador.",
      "Para trabalho em pé: bancada na altura do cotovelo fletido a 90° para tarefas de precisão; 10–15 cm abaixo do cotovelo para tarefas que exigem força; possibilidade de alternar sentado/em pé é fortemente recomendada pela NR-17.",
      "Medidas de referência para cadeira: altura do assento 40–52 cm (regulável); profundidade do assento que permita apoio de 2/3 da coxa sem pressionar o oco poplíteo; apoio lombar regulável em altura; apoio de braços na altura dos cotovelos.",
      "Verifique também o piso: trabalho em pé por > 4 horas em piso rígido sem tapete antifadiga causa sobrecarga vascular nos membros inferiores e dor nos pés/tornozelos — condição frequentemente subnotificada.",
    ],
    atencao: "Erro comum: ver uma cadeira ergonômica de marca renomada e assumir que está adequada. Cadeira de qualidade com regulagem errada (ou sem regulagem feita pelo trabalhador por falta de treinamento) não protege. Sempre verifique a regulagem real, não o modelo do equipamento.",
    marque_sim: "Se o mobiliário é fixo sem regulagem, se a regulagem existente não é utilizada por falta de conhecimento, ou se > 20% dos trabalhadores do setor não conseguem adotar postura próxima ao neutro com o mobiliário disponível.",
  },
  {
    label: "Esforço físico elevado",
    conceito: `O esforço físico elevado vai além do levantamento de cargas — inclui qualquer atividade que exija mobilização significativa da musculatura esquelética ou do sistema cardiovascular de forma sustentada. O critério fisiológico é simples: quando o trabalhador consome mais energia do que consegue repor durante a jornada, instala-se a fadiga acumulada. A longo prazo, a fadiga crônica aumenta o risco de erro, acidente e lesão musculoesquelética, além de contribuir para doenças cardiovasculares em trabalhadores expostos por anos. O problema é que os trabalhadores frequentemente normalizam o esforço excessivo — "é assim mesmo nesse trabalho" é uma resposta que o técnico precisa saber interpretar como um sinal de alerta, não como tranquilidade.`,
    como: [
      "Escala de Borg CR-10: mostre a escala ao trabalhador e pergunte 'durante a maior parte do turno, quanto esforço físico você sente?' Referência: 0 = nenhum esforço; 3 = moderado (conversação normal possível); 5 = forte (fala entrecortada); 7 = muito forte (difícil falar); 10 = esforço máximo. Borg ≥ 5 de forma habitual é significativo.",
      "Sinais observáveis: sudorese intensa mesmo em ambiente termicamente adequado, rubor facial persistente, respiração ofegante durante a tarefa, tremor muscular ao final de ciclos, pausas espontâneas frequentes não previstas.",
      "Frequência cardíaca como indicador: em adultos saudáveis, FC de trabalho sustentada > (FC máxima × 0,33) indica sobrecarga cardiovascular. FC máxima estimada = 220 − idade. Um trabalhador de 40 anos com FC de trabalho > 59 bpm acima do repouso pode estar em sobrecarga.",
      "Avalie a combinação: esforço moderado isolado raramente é problema. A combinação de esforço físico + postura inadequada + calor + turno de 12h é crítica mesmo que cada fator individualmente seja tolerável.",
      "Pergunte sobre recuperação: 'Ao acordar na manhã seguinte ao trabalho, você se sente descansado ou ainda cansado?' Fadiga que não se dissipa com o sono é fadiga crônica — indicador de sobrecarga sistemática.",
    ],
    atencao: "Erro comum: normalizar esforço elevado em setores historicamente pesados (construção, frigoríficos, fundições). 'Sempre foi assim' não é critério técnico — é normalização do risco.",
    marque_sim: "Se Borg ≥ 5 de forma rotineira, há sinais visíveis de fadiga física antes do final do turno, ou o trabalhador relata não se recuperar completamente com o descanso noturno.",
  },
  {
    label: "Iluminação inadequada",
    conceito: `A iluminação inadequada causa dois problemas distintos e opostos: insuficiência, quando o trabalhador força a visão para enxergar detalhes, causando fadiga dos músculos ciliares (que controlam o foco), dor de cabeça e erros; e excesso ou ofuscamento, quando a luz incide diretamente nos olhos ou em superfícies reflexivas, causando contração pupilar intensa e fadiga visual. Os dois podem coexistir: um monitor exibindo conteúdo escuro em sala muito iluminada cria ofuscamento periférico enquanto exige esforço para ler a tela. A NR-17 não especifica valores de lux diretamente — a referência técnica brasileira é a NBR ISO/CIE 8995-1, que substitui a antiga NBR 5413.`,
    como: [
      "Com luxímetro (ideal): meça no plano de trabalho, na direção da tarefa. Valores mínimos por tipo de tarefa: circulação geral 100–200 lux; escritório geral (leitura, digitação) 500 lux; leitura de manuscritos/documentos 750 lux; inspeção visual fina / montagem eletrônica 1.000–1.500 lux; trabalhos de altíssima precisão (cirurgia, gravação) > 2.000 lux.",
      "Sem luxímetro: teste de leitura — coloque um texto impresso em fonte 10 no plano de trabalho. Se o trabalhador precisar se aproximar ou franzir os olhos para ler confortavelmente, a iluminação está abaixo do necessário.",
      "Ofuscamento direto: verifique se luminárias estão no campo visual do trabalhador (entre 45° e 90° da linha de visão horizontal). Luminárias sem difusor acima da linha de visão em ângulo < 45° causam ofuscamento.",
      "Ofuscamento por reflexo: em monitores, superfícies de trabalho polidas, instrumentos com vidro — posicione-se na cadeira do trabalhador e observe se há reflexo de janelas, luminárias ou outras fontes. O uso de telas foscase o posicionamento a 90° das janelas são as soluções mais simples.",
      "Contraste e adaptação: diferença de iluminação entre o posto e a área ao redor > 10:1 obriga os olhos a adaptarem constantemente (escotopio ↔ fotópico), causando fadiga mesmo que cada zona individualmente esteja adequada.",
    ],
    atencao: "Erro comum: avaliar a iluminação geral da sala sem medir no plano de trabalho. Uma sala com 300 lux médios pode ter 150 lux no posto de trabalho específico se a luminária estiver posicionada atrás do trabalhador.",
    marque_sim: "Se a iluminação no plano de trabalho está abaixo do mínimo para a tarefa (estimado ou medido), há fontes de ofuscamento direto ou reflexo não controladas, ou trabalhadores relatam dor de cabeça, lacrimejamento ou visão turva ao final do turno.",
  },
  {
    label: "Ruído / ambiente sonoro adverso",
    conceito: `O ruído age no organismo em dois níveis. No nível fisiológico direto, sons acima de 85 dB(A) danificam progressiva e irreversivelmente as células ciliadas da cóclea — as células responsáveis por converter vibração sonora em sinal nervoso. Não existe reparação: a célula destruída pelo ruído não se regenera. A PAIR (Perda Auditiva Induzida por Ruído) é a doença ocupacional mais prevalente no mundo e a segunda causa de surdez depois da genética. No nível fisiológico indireto, mesmo ruídos abaixo do limite de dano auditivo (60–75 dB) elevam cortisol, aumentam frequência cardíaca e prejudicam a concentração e a qualidade do sono — especialmente ruídos imprevisíveis e incontroláveis pelo trabalhador.`,
    como: [
      "Teste de conversação a 1 metro: fique a 1 metro do trabalhador e tente conversar em volume normal. Se precisar elevar o tom, o ruído provavelmente supera 80 dB(A). Se precisar gritar, provavelmente supera 85 dB(A). Se precisar falar no ouvido, provavelmente supera 90 dB(A).",
      "Referências NR-15 Anexo 1: 85 dB(A) por 8h = limite máximo de tolerância. A cada 5 dB(A) de aumento, o tempo permitido cai pela metade: 90 dB → 4h; 95 dB → 2h; 100 dB → 1h; 105 dB → 30 min; 115 dB → 7 min.",
      "Ruído de impacto: prensas, marteletes, disparos de grampeadores pneumáticos — picos acima de 130 dB(C) são imediatamente lesivos independentemente da duração. Identifique fontes de impacto no setor.",
      "Verifique o uso de protetores auditivos: se são fornecidos e obrigatórios, isso indica exposição confirmada acima de 85 dB(A). A simples existência de EPI auditivo no setor já é um indicador que justifica Sim no checklist.",
      "Pergunte sobre sintomas: zumbido transitório após o turno (que passa nas horas seguintes), dificuldade de entender conversas em ambientes barulhentos, necessidade de aumentar o volume da TV são sinais iniciais de PAIR.",
    ],
    atencao: "Erro comum: avaliar apenas o ruído contínuo e ignorar impactos. Uma prensa que bate 20 vezes por turno pode ser mais lesiva auditivarmente que uma linha de produção barulhenta que o trabalhador usa protetor — porque os impactos costumam ser ignorados.",
    marque_sim: "Se comunicação verbal a 1 m exige voz elevada, há uso obrigatório de protetor auricular, trabalhadores relatam zumbido pós-turno, ou há fontes de impacto sonoro identificadas sem proteção adequada.",
  },
  {
    label: "Vibração (corpo inteiro / mãos e braços)",
    conceito: `A vibração transfere energia mecânica para os tecidos vivos em frequências que o corpo não consegue amortecer adequadamente. Para mãos e braços (HAV — Hand-Arm Vibration), as frequências mais lesivas estão entre 8 e 16 Hz — exatamente a faixa de muitas ferramentas pneumáticas e elétricas. O dano acumula-se nos vasos sanguíneos (síndrome de Raynaud / dedo branco), nos nervos periféricos (neuropatia vibratória) e nas articulações (artrose precoce de punho e cotovelo). Para o corpo inteiro (WBV — Whole-Body Vibration), as frequências lesivas ficam entre 0,5 e 80 Hz, e o alvo principal é a coluna lombar — hernias e artrose lombar precoce são achados frequentes em operadores de veículos pesados.`,
    como: [
      "HAV — identifique ferramentas vibratórias no setor: esmerilhadeiras angulares, furadeiras de impacto, marteletes demolidores, compactadores de solo, serras circulares, pistolas de parafusos pneumáticas. Pergunte ao trabalhador há quanto tempo usa cada uma e por quantas horas/dia.",
      "Limite de ação ISO 5349-1 para HAV: 2,5 m/s² (8h equivalente). Limite de exposição: 5,0 m/s². Na prática, para triagem sem medição: uso de martelete demolidor ou esmerilhadora > 30 min/dia → Sim. Uso de furadeira de impacto > 2h/dia → Sim.",
      "WBV — identifique veículos operados no setor: empilhadeiras, tratores, caminhões, plataformas vibratórias, veículos todo terreno. Verifique o estado do assento: assento sem amortecimento ou amortecimento estourado multiplica a vibração transmitida.",
      "Limite de ação ISO 2631-1 para WBV: 0,5 m/s² (8h). Limite de exposição: 1,15 m/s². Para triagem: operação de empilhadeira em piso irregular > 4h/turno → Sim. Operação de trator agrícola > 2h/turno → Sim.",
      "Sintomas de HAV: pergunte se os dedos ficam brancos ou dormentes no frio ou após o uso das ferramentas (síndrome de Raynaud), se há formigamento nas mãos ao acordar, dor nos punhos. Esses sintomas em trabalhadores jovens são fortemente sugestivos de neuropatia vibratória.",
    ],
    atencao: "Erro comum: ignorar a vibração de veículos por considerar que 'andar de empilhadeira não é um trabalho tão pesado'. Operadores de empilhadeira em piso de concreto rugoso podem receber doses de WBV equivalentes às de motoristas de caminhão fora de estrada.",
    marque_sim: "Se há uso diário de ferramentas vibratórias por > 2h, operação de veículos com WBV por > 4h/turno, ou relatos de sintomas de HAV (branqueamento dos dedos, formigamento) ou dor lombar crônica em operadores de veículos.",
  },
  {
    label: "Desconforto térmico",
    conceito: `O corpo humano funciona dentro de uma faixa muito estreita de temperatura interna (36,5–37,5°C). Para manter essa homeotermia, o organismo usa mecanismos que têm custo fisiológico: vasodilatação periférica, sudorese e taquicardia no calor; vasoconstrição e tremor no frio. Quando esses mecanismos são sobrecarregados pelo ambiente, a capacidade cognitiva e física cai significativamente. Estudos mostram queda de 2% na produtividade para cada grau Celsius acima de 25°C em trabalhos que exigem atenção. No calor intenso, o risco vai além da queda de desempenho: a exaustão por calor e a insolação são emergências médicas. No frio, a hipotermia localizada reduz a destreza manual — o trabalhador torna-se mais propenso a acidentes mesmo antes de sentir frio intenso.`,
    como: [
      "Calor — IBUTG (Índice de Bulbo Úmido e Termômetro de Globo): mede a combinação de temperatura, umidade e radiação. Sem equipamento, sinais práticos: trabalhadores suando intensamente mesmo em atividade leve; relatos de tontura, mal-estar ou náusea; necessidade de beber > 1 litro de água por hora.",
      "Limites NR-15 Anexo 3 por tipo de atividade: atividade leve sentado → IBUTG ≤ 30°C; trabalho moderado em pé → ≤ 26,7°C; trabalho pesado → ≤ 25°C. Em ambientes externos com carga solar, adicione 1°C ao IBUTG medido.",
      "Frio — frigoríficos e câmaras: temperatura < 5°C exige EPIs de proteção térmica (luvas, jaqueta, bota isolante), limite de exposição contínua (NR-29 e literatura: máximo 1–2h contínuos em câmaras frias abaixo de 0°C) e aquecimento periódico.",
      "Correntes de ar: NR-17 7.1.3 limita a velocidade do ar no posto de trabalho a 0,75 m/s. Ar-condicionado direcionado diretamente sobre o trabalhador mesmo a temperatura amena causa desconforto músculo-esquelético (contratura muscular cervical é queixa frequente).",
      "EPIs que retêm calor: macacões impermeáveis, aventais de chumbo, máscaras integrais — avaliem se há medidas de controle da temperatura interna (intervalos, hidratação, monitoramento de FC) quando esses EPIs são obrigatórios.",
    ],
    atencao: "Erro comum: avaliar o desconforto térmico apenas em ambientes extremos (fundições, frigoríficos). Escritórios com ar-condicionado mal direcionado, galpões com telhado de metal sem isolamento e trabalhos ao ar livre no verão brasileiro são fontes frequentes e subavaliadas.",
    marque_sim: "Se o IBUTG estimado supera os limites NR-15 para a atividade, temperatura < 5°C sem proteção adequada, ar-condicionado com fluxo direto sobre trabalhadores, ou relatos de tontura/mal-estar por calor ou dor muscular por frio.",
  },
];

// ─── Dados — Ergonomia Cognitiva ─────────────────────────────────────────────

const COGNITIVA_INTRO = `A Ergonomia Cognitiva estuda como o trabalho demanda os recursos mentais do ser humano: atenção, memória de trabalho, tomada de decisão, processamento de informações. O cérebro humano tem capacidade cognitiva limitada — não é multitarefa real, é um processador serial de alta velocidade que alterna rapidamente entre tarefas, pagando um 'custo de troca' a cada alternância. Quando a demanda cognitiva do trabalho supera consistentemente a capacidade do trabalhador, instala-se a sobrecarga mental. O resultado imediato é a queda de desempenho e o aumento de erros; a longo prazo, são os transtornos mentais relacionados ao trabalho — ansiedade, burnout, depressão. No Brasil, os transtornos mentais são a terceira causa de afastamento previdenciário. A sua avaliação aqui pode identificar o problema antes da crise.`;

const COGNITIVA_ITENS: ItemData[] = [
  {
    label: "Atenção contínua / concentração elevada",
    conceito: `A atenção sustentada — manter o foco em um estímulo específico por períodos prolongados à espera de eventos raros — é uma das tarefas mais desgastantes que o cérebro humano pode realizar. Estudos clássicos de vigilância mostram que o desempenho cai significativamente após 20–30 minutos de monitoramento contínuo, mesmo em sujeitos treinados. Operadores de salas de controle, inspetores de qualidade em linha de produção, controladores de tráfego aéreo, motoristas de longa distância — todos compartilham esse perfil de demanda. A particularidade é que o trabalhador muitas vezes não percebe sua própria queda de desempenho: o sinal de perigo é justamente o que eles deixam de detectar.`,
    como: [
      "Classifique a tarefa: é de vigilância (monitoramento passivo esperando eventos raros) ou de execução ativa (tomada de decisão constante)? As duas são desgastantes, mas por mecanismos diferentes.",
      "Para vigilância: avalie o tempo de exposição sem pausa. Pesquisas indicam que após 20 min de vigilância intensa, a taxa de detecção de sinais anômalos já começa a cair. Após 45–60 min, pode estar 30–50% abaixo do nível inicial.",
      "NASA-TLX (se disponível): escala de 6 dimensões (Demanda Mental, Demanda Física, Demanda Temporal, Desempenho, Esforço, Frustração). Peça ao trabalhador que avalie de 0 a 100. Pontuação geral > 60 ou Demanda Mental isolada > 70 indica sobrecarga.",
      "Pergunte sobre erros e quase-acidentes: 'Já deixou passar algum defeito que só percebeu depois?' ou 'Já se pegou 'viajando' durante o trabalho?' Respostas afirmativas frequentes indicam vigilância comprometida.",
      "Avalie as pausas cognitivas: NR-17 7.4 orienta pausas para trabalhos repetitivos, mas o mesmo princípio se aplica à vigilância. O ideal é 10 min de pausa a cada 50 min de trabalho de alta atenção, com estímulo diferente (pausa ativa, não ficar olhando para a mesma tela).",
    ],
    atencao: "Erro comum: confundir 'não tem muito o que fazer' com 'trabalho tranquilo'. Um vigilante de monitoramento de câmeras pode parecer ocioso, mas a exigência de manter a atenção pronta para detectar o evento raro é cognitivamente exaustiva.",
    marque_sim: "Se a tarefa exige vigilância ininterrupta por > 2h sem pausa cognitiva, o custo do erro é grave (acidente, produto crítico, dado irreversível), ou o trabalhador relata lapsos de atenção frequentes ou exaustão mental ao final do turno mesmo sem carga física.",
  },
  {
    label: "Sobrecarga mental / complexidade da tarefa",
    conceito: `A memória de trabalho humana consegue manipular simultaneamente apenas 4 ± 1 'chunks' de informação. Quando a tarefa exige gerenciar mais itens simultaneamente, o sistema entra em sobrecarga e começa a descartar informações — é o que chamamos de erro por sobrecarga (overload error), diferente do erro por lapso de atenção. Trabalhos complexos como gestão de equipes, análise de dados em tempo real, atendimento técnico especializado e gestão de projetos simultâneos são alvos clássicos. A sobrecarga cognitiva também interrompe a 'consolidação' de tarefas — o trabalhador perde o 'fio' do que estava fazendo quando interrompido e precisa reconstruir o contexto, o que custa tempo e energia mental.`,
    como: [
      "Observe e anote quantas tarefas distintas o trabalhador gerencia simultaneamente: quantos sistemas abertos, quantas demandas em paralelo, quantas exceções precisa tratar enquanto executa o fluxo principal.",
      "Peça ao trabalhador que descreva o que faz: se a descrição der mais de 3 camadas simultâneas ('enquanto atendo o cliente, preciso checar o estoque no sistema A, registrar no sistema B e verificar o prazo no sistema C'), a complexidade é alta.",
      "Avalie o índice de erros documentados: retrabalho frequente, reclamações de clientes por erros operacionais simples, correções frequentes de registros — são manifestações de sobrecarga cognitiva.",
      "Pergunte sobre estratégias de compensação: o trabalhador criou post-its, listas paralelas, alarmes, planilhas próprias para 'não esquecer'? Isso revela que a demanda mental superou a capacidade sem auxílios, obrigando o trabalhador a criar sistemas de suporte informais.",
      "Avalie o impacto das interrupções: pesquisas em engenharia de software mostram que após uma interrupção, o trabalhador leva em média 23 minutos para retomar o nível de foco anterior à interrupção em tarefas complexas.",
    ],
    atencao: "Erro comum: avaliar a complexidade da tarefa pelo nível de instrução exigido. Um operador de caixa pode ter sobrecarga cognitiva não pela complexidade técnica, mas pelo volume de transações, multitarefa (atendimento + caixa + fidelidade + vouchers) e ritmo acelerado.",
    marque_sim: "Se há > 3 fluxos simultâneos com decisões independentes, múltiplos sistemas com interfaces distintas, índice elevado de erros documentados, ou o trabalhador criou sistemas de compensação informal (listas, alarmes) para não esquecer tarefas rotineiras.",
  },
  {
    label: "Pressão psicológica / cobrança excessiva",
    conceito: `A cobrança é inerente ao trabalho — metas e responsabilidades são necessárias para o funcionamento das organizações. O problema começa quando a cobrança excede os limites da capacidade real do trabalhador e é exercida por meio de mecanismos que ativam a resposta de ameaça do sistema nervoso autônomo. Quando o trabalhador percebe o ambiente de trabalho como cronicamente ameaçador, o eixo hipotálamo-hipófise-adrenal mantém níveis elevados de cortisol de forma permanente. O cortisol cronicamente elevado está associado a imunossupressão, distúrbios do sono, hipertensão, ansiedade e depressão. O burnout é o extremo desse processo — não é fraqueza individual, é o resultado previsível de demanda crônica acima da capacidade com controle insuficiente sobre o próprio trabalho.`,
    como: [
      "Realize entrevistas individuais e confidenciais, idealmente fora do local de trabalho direto (sala separada, corredor afastado). Nunca pergunte sobre pressão hierárquica com o gestor presente.",
      "Perguntas abertas e diagnósticas: 'Como você descreveria o clima de trabalho aqui?' / 'O que acontece quando você não consegue cumprir uma meta?' / 'Você consegue desligar do trabalho quando está em casa?' / 'Você acha que poderia cumprir suas responsabilidades com o tempo e recursos disponíveis?'",
      "Sinais observáveis durante a visita: trabalhadores que param de falar imediatamente quando o gestor se aproxima; linguagem corporal fechada ao falar sobre gestão; respostas muito 'politicamente corretas' que parecem ensaiadas.",
      "Dados quantitativos correlacionados: absenteísmo por transtornos mentais (CID F) > 5% do quadro em 12 meses; rotatividade > 20%/ano; apresentação de atestados médicos por diagnósticos vagos (cefaleia recorrente, distúrbios do sono) — podem mascarar sofrimento psíquico real.",
      "Modelo de Karasek (Demanda-Controle): o risco psicossocial é máximo quando há alta demanda E baixo controle sobre o próprio trabalho. Verifique: o trabalhador tem alguma autonomia sobre como executa sua tarefa, ou tudo é prescrito e monitorado?",
    ],
    atencao: "Erro comum: considerar que a ausência de conflitos declarados significa que está tudo bem. Ambientes com pressão hierárquica intensa frequentemente têm aparência superficial de harmonia — os trabalhadores aprenderam que reclamar é perigoso.",
    marque_sim: "Se há relatos independentes de pressão excessiva por ≥ 2 trabalhadores, absenteísmo por transtornos mentais acima de 5%, rotatividade > 20%/ano, ou observação direta de tratamento desrespeitoso durante a visita.",
  },
  {
    label: "Excesso de informações simultâneas",
    conceito: `Vivemos na era da hiperinformação — e o ambiente de trabalho moderno é um amplificador de interrupções. Cada notificação de aplicativo, cada mensagem de WhatsApp corporativo, cada alerta de sistema ERP é uma interrupção cognitiva que obriga o cérebro a interromper o processamento atual, avaliar a nova informação e decidir o que fazer com ela. Pesquisas da Microsoft Research mostraram que trabalhadores em ambientes de escritório são interrompidos, em média, a cada 3–5 minutos. O custo cumulativo dessas micro-interrupções em termos de produtividade e saúde mental é enorme. A fragmentação da atenção está associada a aumento de erros, aumento de estresse percebido e sensação de 'trabalhar o dia inteiro sem terminar nada' — uma das queixas mais comuns no burnout moderno.`,
    como: [
      "Observe o posto de trabalho por 15 minutos sem interagir: conte quantas notificações, mensagens, alertas ou interrupções chegam ao trabalhador. > 5 interrupções em 15 minutos = 20 por hora = 160 por turno de 8h.",
      "Identifique os canais ativos simultâneos: e-mail; WhatsApp corporativo; Teams/Slack; alertas de sistema (ERP, WMS, CRM); telefone; demandas presenciais de colegas. Cada canal adicional aumenta a carga cognitiva de gerenciamento.",
      "Avalie a expectativa de resposta: há resposta imediata esperada para as mensagens? Se o trabalhador sente que não pode ignorar nenhuma notificação, o estado de vigilância permanece ativo continuamente — mesmo que as mensagens em si sejam triviais.",
      "Pergunte: 'Você consegue trabalhar por 30 minutos sem ser interrompido quando precisa se concentrar?' Se a resposta for raramente ou nunca, o ambiente é fragmentador.",
      "Avalie as 'reuniões desnecessárias': agenda com > 3h de reuniões/dia em funções que também têm demandas operacionais fragmenta profundamente o tempo disponível para trabalho focado.",
    ],
    atencao: "Erro comum: considerar que alta conectividade é sinal de modernidade e eficiência. Ambientes com notificações contínuas e expectativa de resposta imediata estão sistematicamente destruindo a capacidade de trabalho profundo (deep work) que gera os resultados mais valiosos.",
    marque_sim: "Se o trabalhador recebe > 5 interrupções/15 min de forma habitual, opera > 3 canais de comunicação com expectativa de resposta imediata, ou relata que raramente consegue concluir uma tarefa sem ser interrompido.",
  },
  {
    label: "Ritmo mental acelerado",
    conceito: `Existe uma diferença fundamental entre trabalho rápido autônomo e trabalho acelerado imposto. No primeiro, o trabalhador regula seu próprio ritmo conforme sua capacidade e estado — pode acelerar quando está descansado e desacelerar quando precisa. No ritmo imposto (máquina, sistema, cliente, meta de TMA), o trabalhador não tem esse controle. A ausência de controle sobre o próprio ritmo é, por si só, um fator estressor independente do volume de trabalho — é o que o modelo de Karasek chama de 'trabalho de alta demanda / baixo controle', associado ao dobro do risco cardiovascular em relação a trabalhadores com controle sobre seu ritmo. O ritmo imposto também amplifica o impacto de cada erro: se a esteira não para e você comete um defeito, a fila se acumula e a pressão aumenta.`,
    como: [
      "Identifique se o ritmo é imposto externamente: esteira de produção com velocidade fixa; sistema de call center com tela que avança automaticamente; operação de caixa com fila visível; takt time de linha definido pelo planejamento de produção.",
      "Calcule o takt time disponível: divida o tempo total disponível pelo número de unidades a produzir/atender. Compare com o tempo real necessário para executar a tarefa com qualidade. Se o takt disponível é < 80% do tempo real necessário, há risco.",
      "Para call center / atendimento: investigue a meta de TMA (Tempo Médio de Atendimento). Pergunte ao trabalhador: 'Você consegue resolver a maioria das chamadas dentro do tempo meta sem se apressar de forma que compromete a qualidade?' Se não, o TMA está abaixo da realidade operacional.",
      "Avalie a capacidade de recuperação: se o trabalhador 'perde o ritmo' por um evento (pausa no banheiro, dúvida de um colega, consulta ao manual), consegue retomar sem pressão? Em ritmos impostos por máquina, a perda de ritmo cria imediatamente acúmulo visível — o que gera ansiedade imediata.",
      "Pergunte: 'Você se sente pressionado pelo tempo durante a maior parte do turno?' / 'Tem tempo para verificar seu trabalho antes de passar para o próximo?' Respostas consistentemente negativas indicam ritmo além da capacidade.",
    ],
    atencao: "Erro comum: confundir eficiência com ritmo acelerado insustentável. Um posto de trabalho calibrado no limite máximo da capacidade humana não tem margem para variações — qualquer imprevisto vira gargalo e fonte de estresse.",
    marque_sim: "Se o ritmo é imposto por máquina ou sistema sem possibilidade de ajuste, o takt disponível é < 80% do tempo necessário para execução confortável, ou trabalhadores relatam que raramente têm tempo de verificar o próprio trabalho.",
  },
];

// ─── Dados — Ergonomia Organizacional ────────────────────────────────────────

const ORGANIZACIONAL_INTRO = `A Ergonomia Organizacional — também chamada de macroergonomia ou ergonomia do trabalho — examina como a estrutura, os processos e as relações da organização afetam a saúde e o desempenho dos trabalhadores. É a dimensão mais difícil de avaliar porque os fatores são menos visíveis que uma bancada alta ou um ruído estridente. Mas é também onde os riscos psicossociais têm seu maior impacto: transtornos mentais, burnout, doenças cardiovasculares relacionadas ao trabalho e acidentes causados por fadiga organizacional são, em grande parte, resultados de problemas organizacionais não tratados. A resistência mais comum que o técnico vai encontrar aqui é: 'Isso não é ergonomia, isso é RH.' Não é verdade — a NR-17 revisada e a NR-01 GRO/PGR incluem explicitamente os fatores psicossociais e organizacionais no escopo da avaliação ergonômica.`;

const ORGANIZACIONAL_ITENS: ItemData[] = [
  {
    label: "Assédio de qualquer natureza no trabalho",
    conceito: `O assédio no trabalho — moral, sexual ou discriminatório — é qualquer conduta abusiva que viola a dignidade ou integridade do trabalhador. O assédio moral (mobbing) foi sistematizado por Leymann como conduta negativa, repetida, que atenta contra o trabalhador e deteriora suas condições de trabalho. O assédio sexual envolve conduta de natureza sexual indesejada — verbal, não verbal ou física. O assédio discriminatório engloba tratamentos injustos baseados em gênero, raça, orientação sexual, religião ou deficiência. Todos têm em comum o efeito de degradar o ambiente de trabalho e causar sofrimento real. Estudos mostram que trabalhadores assediados têm 2–3 vezes mais probabilidade de desenvolver depressão e transtornos ansiosos. A Lei 14.457/2022 (CIPA) exige de empresas com CIPA canais de denúncia sigilosos e política de prevenção ao assédio.`,
    como: [
      "Realize entrevistas individuais em local privado, garantindo confidencialidade. Diga explicitamente: 'O que você me contar aqui não será divulgado com seu nome'. Trabalhadores sob assédio raramente falam espontaneamente — precisam se sentir seguros.",
      "Perguntas diagnósticas: 'Como é a sua relação com a liderança direta?' / 'Já se sentiu tratado de forma injusta ou desrespeitosa aqui?' / 'Existe alguém no trabalho que te faz se sentir mal com frequência?'",
      "Critérios de Leymann para identificar mobbing: isolamento social; atribuição de tarefas humilhantes; crítica constante sem fundamento; ridicularização pública; negação de informação necessária para o trabalho.",
      "Indicadores indiretos: absenteísmo elevado em um trabalhador específico, rotatividade concentrada num setor com o mesmo gestor, solicitações frequentes de transferência.",
      "Observe a dinâmica durante a visita: gestores que interrompem trabalhadores para 'corrigir' o que está sendo dito ao técnico, ou insistem em estar presentes em todas as conversas, estão sinalizando controle sobre o discurso da equipe.",
    ],
    atencao: "Erro comum: confundir exigência de desempenho com assédio. Gestão firme que estabelece padrões claros e dá feedback técnico objetivo não é assédio. Assédio é a conduta repetida que visa humilhar, desestabilizar ou excluir — independente do resultado de trabalho do alvo.",
    marque_sim: "Se há relatos independentes de ≥ 2 trabalhadores sobre condutas abusivas repetidas, observação direta de tratamento desrespeitoso durante a visita, ou ausência de canal de denúncia sigiloso.",
  },
  {
    label: "Falta de suporte / apoio no trabalho",
    conceito: `A falta de suporte é a percepção de que não há a quem recorrer — liderança ausente, RH pouco atuante, colegas sem solidariedade. O modelo JD-R (Job Demands-Resources) de Bakker e Demerouti demonstra que o suporte do supervisor e dos colegas é um dos recursos de trabalho mais protetores: amortece o impacto das demandas sobre o bem-estar. A ausência de suporte é preditor independente de burnout mesmo quando o volume de trabalho é aceitável. Trabalhadores que percebem falta de apoio têm menor engajamento, mais absenteísmo e maior risco de adoecimento mental — não por fraqueza pessoal, mas porque enfrentam as demandas do trabalho sem a rede de amparo que torna as dificuldades manejáveis.`,
    como: [
      "Avalie o suporte percebido: 'Quando você tem um problema que não consegue resolver sozinho, o que você faz?' / 'Você sente que pode ir ao seu gestor quando tem uma dificuldade?' Trabalhadores que respondem 'resolvo sozinho sempre' ou 'prefiro não incomodar' estão sinalizando ausência de suporte.",
      "Observe a taxa de turnover segmentada: rotatividade alta em setor específico com o mesmo gestor, enquanto setores similares têm turnover baixo, é forte indicador de liderança que não apoia.",
      "Avalie os canais formais de comunicação ascendente: há mecanismo confiável para o trabalhador expressar preocupações? A ausência de canais confiáveis significa que os problemas acumulam nos trabalhadores.",
      "Pergunte sobre acesso ao RH: 'Já precisou do RH para resolver alguma dificuldade no trabalho? Como foi?' Avalie se o RH é percebido como parceiro ou como instrumento da empresa.",
      "Identifique o estigma sobre saúde mental: em culturas onde 'pedir ajuda é fraqueza', o suporte formal pode existir mas ser inacessível na prática — trabalhadores não o usam por medo de estigma ou consequências.",
    ],
    atencao: "Erro comum: avaliar suporte verificando apenas se existe um programa formal (PAE, RH disponível). O que importa é o suporte percebido — se os trabalhadores não se sentem seguros para usá-lo, o programa existe apenas no papel.",
    marque_sim: "Se ≥ 2 trabalhadores relatam ausência de apoio da liderança ou colegas, há turnover elevado concentrado em setores específicos, ausência de canais de comunicação ascendente confiáveis, ou trabalhadores relatam resolver todos os problemas sozinhos.",
  },
  {
    label: "Má gestão de mudanças organizacionais",
    conceito: `Mudanças organizacionais — reestruturações, implantação de novos sistemas, alteração de processos, mudança de gestão — são eventos de alta demanda psicossocial porque combinam incerteza, perda de controle e frequentemente sobrecarga durante a transição. A NR-01 revisada (GRO/PGR) reconhece explicitamente a gestão de mudanças como elemento do gerenciamento de riscos ocupacionais. Mudanças mal comunicadas ou impostas sem participação geram ansiedade crônica e insegurança quanto à continuidade do emprego — mesmo quando a mudança em si não representa ameaça real. A participação dos trabalhadores não é apenas eticamente desejável: é tecnicamente mais eficaz, pois trabalhadores que conhecem o processo real identificam problemas de implementação que gestores externos não percebem.`,
    como: [
      "Identifique mudanças relevantes nos últimos 12 meses: novos sistemas ERP/CRM, mudanças de processo, reestruturação de equipes, digitalização de tarefas manuais. Avalie cada uma.",
      "Avalie como a mudança foi comunicada: os trabalhadores foram consultados antes da decisão? Foram informados com antecedência suficiente? Ou descobriram a mudança no dia em que entrou em vigor?",
      "Investigue o impacto percebido: 'Como foi a adaptação? As preocupações dos trabalhadores foram ouvidas?' Mudanças com dificuldades conhecidas mas não resolvidas indicam desconexão entre gestão e operação.",
      "Verifique se há estrutura de participação: há CIPA ativa? Há pesquisa de clima? Há mecanismo para trabalhadores proporem melhorias? A ausência dessas estruturas torna a participação estruturalmente impossível.",
      "Avalie o impacto na carga durante transições: mudanças de sistema criam sobrecarga enquanto o trabalhador aprende a nova ferramenta. Verificar se houve ajuste de carga ou suporte adicional durante a transição.",
    ],
    atencao: "Erro comum: tratar comunicação unilateral como participação. 'Avisamos com 2 semanas de antecedência' não é participação — é notificação. Participação real envolve consulta antes da decisão e canal para reportar dificuldades durante a implementação.",
    marque_sim: "Se mudanças relevantes foram implementadas sem consulta prévia, trabalhadores relatam dificuldades não resolvidas de mudanças recentes, não há estrutura formal de participação, ou houve sobrecarga durante transição sem suporte adicional.",
  },
  {
    label: "Baixa clareza de papel / função",
    conceito: `A ambiguidade de papel existe quando o trabalhador não tem clareza sobre suas responsabilidades, critérios de avaliação, nível de autoridade e a quem reportar. O conflito de papel ocorre quando recebe demandas contraditórias de fontes diferentes. Ambos são estressores comprovados que aumentam a ansiedade, reduzem o comprometimento e pioram o desempenho. A ambiguidade é especialmente comum em organizações que cresceram rápido sem formalizar processos, em cargos recém-criados e em transições organizacionais. A clareza de papel é um recurso de trabalho fundamental no modelo JD-R — sua ausência amplifica o impacto de qualquer demanda.`,
    como: [
      "Peça ao trabalhador que descreva suas 3 principais responsabilidades em 2 minutos. Resposta vaga, hesitante ou que lista 8 responsabilidades igualmente prioritárias indica ambiguidade. Pergunte também: 'Como você sabe se fez um bom trabalho?'",
      "Verifique se existe descrição de cargo escrita e atualizada: solicite ao RH. Ausência de job description é indicador estrutural de ambiguidade de papel.",
      "Investigue situações de conflito de demandas: 'Já aconteceu de você receber instruções diferentes de pessoas diferentes sobre a mesma tarefa? O que você faz nesses casos?'",
      "Mapeie a cadeia de reporte: o trabalhador reporta para um gestor ou para múltiplos? Em estruturas matriciais, o conflito de papel é endêmico — verifique se há protocolo claro de priorização.",
      "Avalie novos trabalhadores: ambiguidade é mais intensa no primeiro ano. Se após > 6 meses ainda há dificuldade em entender o que é esperado, há problema estrutural de onboarding.",
    ],
    atencao: "Erro comum: interpretar trabalhadores proativos que 'resolvem tudo' como organização saudável. Podem estar sofrendo acúmulo de papel não formalizado — fazem o trabalho de vários sem reconhecimento.",
    marque_sim: "Se o trabalhador não descreve claramente responsabilidades e critérios de avaliação, há relatos de instruções contraditórias, ausência de descrição de cargo formalizada, ou acúmulo de funções não previsto na contratação.",
  },
  {
    label: "Baixas recompensas e reconhecimento",
    conceito: `O modelo do Desequilíbrio Esforço-Recompensa (ERI) de Siegrist demonstra que o estresse ocupacional surge quando o esforço investido é sistematicamente desproporcional à recompensa — e a recompensa não é apenas financeira. Inclui reconhecimento (feedback positivo, respeito), oportunidade de desenvolvimento (promoção, aprendizado) e segurança. Trabalhadores em alto desequilíbrio ERI têm 2–3 vezes mais risco de depressão e doenças cardiovasculares. A privação de reconhecimento ativa circuitos neurais de rejeição social com efeito devastador na motivação: o trabalhador para de se engajar porque o engajamento não produz retorno.`,
    como: [
      "Pergunte diretamente: 'Quando você faz um bom trabalho, você recebe algum feedback? De quem e com que frequência?' Respostas como 'só ouço quando erro' são indicadores fortes.",
      "Explore o reconhecimento não financeiro: há reuniões de feedback estruturadas? O gestor agradece ou parabeniza? A ausência total de reconhecimento simbólico é um indicador mesmo quando o salário é adequado.",
      "Avalie o equilíbrio esforço-recompensa: compare exigência da função (responsabilidade, riscos) com posição salarial no mercado, benefícios e perspectiva de desenvolvimento.",
      "Identifique assimetria de feedback: em muitos ambientes, erros são documentados formalmente enquanto acertos são ignorados. Sistema de gestão que só registra falhas cria reconhecimento exclusivamente negativo.",
      "Verifique o histórico de promoções: quantos trabalhadores foram promovidos nos últimos 2 anos? Estagnação percebida em trabalhadores de bom desempenho é indicador de risco ERI.",
    ],
    atencao: "Erro comum: assumir que bom salário substitui reconhecimento. Herzberg distingue fatores higiênicos (salário — cuja ausência gera insatisfação, mas cuja presença não gera motivação) dos fatores motivadores (reconhecimento, realização). Os dois são necessários.",
    marque_sim: "Se ≥ 2 trabalhadores relatam ausência de feedback positivo, há desequilíbrio evidente entre exigência da função e recompensa, ou o sistema de gestão registra apenas falhas sem documentar conquistas.",
  },
  {
    label: "Baixo controle no trabalho / Falta de autonomia",
    conceito: `A autonomia — grau em que o trabalhador controla como, quando e com que métodos executa seu trabalho — é um dos recursos de trabalho mais protetores. No modelo de Karasek (Demanda-Controle), a combinação de alta demanda com baixo controle é chamada de "trabalho de alto risco" e está associada ao dobro do risco cardiovascular. A autonomia não é apenas conforto: é um mecanismo fisiológico de regulação do estresse — quando o trabalhador percebe controle sobre sua situação, a resposta de ameaça do sistema nervoso autônomo é atenuada. A ausência completa de controle sobre o próprio trabalho é, em si, um estressor independente do volume de tarefas.`,
    como: [
      "Mapeie as decisões autônomas: pode ajustar a sequência de tarefas? Adaptar o método? Decidir quando fazer pausas? Resolver problemas rotineiros sem aprovação? Quanto mais 'nãos', menor a autonomia.",
      "Escala de Karasek simplificada: 'Você tem liberdade para decidir como fazer seu trabalho?' e 'Você pode influenciar a quantidade de trabalho?' (1–4 cada). Score total ≤ 4 indica baixo controle.",
      "Observe o grau de prescrição: call center com scripts obrigatórios, linhas com takt time rigidamente cronometrado — ambos tendem a autonomia próxima de zero.",
      "Investigue penalização por adaptações: 'Se você encontrar um jeito melhor de fazer algo, pode mudar?' Organizações que punem iniciativa bem-intencionada destroem a autonomia mesmo quando o procedimento formal prevê abertura.",
      "Avalie o microgerenciamento: gestores que verificam cada tarefa, aprovam cada e-mail ou perguntam constantemente sobre o andamento produzem o mesmo efeito de excesso de controle sem sistema eletrônico.",
    ],
    atencao: "Erro comum: confundir padronização necessária com ausência de autonomia. Procedimentos claros são recursos positivos (reduzem incerteza); o problema é a padronização sem qualquer margem para adaptar o método às variações reais da tarefa.",
    marque_sim: "Se o trabalhador não pode ajustar sequência ou método, não resolve problemas rotineiros sem autorização, o trabalho é inteiramente prescrito por sistema, ou há relatos de punição por iniciativas adaptativas.",
  },
  {
    label: "Baixa justiça organizacional",
    conceito: `A justiça organizacional refere-se à percepção de equidade e transparência nas práticas da organização — avaliações, promoções, desligamentos, distribuição de recursos, acesso a benefícios. A pesquisa distingue três dimensões: justiça distributiva (os resultados são equitativos?), justiça procedimental (os critérios são transparentes e aplicados igualmente?) e justiça interacional (as pessoas são tratadas com respeito e recebem as informações que merecem?). A injustiça organizacional é um estressor potente associado a ressentimento coletivo, desmotivação, conflitos e síndrome de burnout. Critérios opacos de promoção, favorecimento e tratamento desigual entre grupos destroem a confiança institucional.`,
    como: [
      "Pergunte sobre critérios de avaliação e promoção: 'Você sabe por que critérios as promoções são definidas aqui?' Resposta 'não sei' ou 'depende de quem te conhece' indica baixa transparência.",
      "Investigue percepção de equidade: 'Você sente que áreas ou pessoas diferentes recebem tratamento igual da empresa?' Percepção de favoritismo é um indicador mesmo que não haja evidência objetiva.",
      "Avalie a comunicação sobre desligamentos: quando alguém é demitido, os critérios são comunicados? Demissões percebidas como arbitrárias ou injustificadas geram insegurança generalizada, não apenas no demitido.",
      "Observe a consistência de aplicação de regras: as mesmas políticas se aplicam a todos os níveis hierárquicos? Regras que valem para operadores mas não para gestores são percebidas como injustas.",
      "Verifique o histórico de reclamações trabalhistas: número elevado de ações trabalhistas em relação ao setor pode indicar percepção generalizada de tratamento injusto.",
    ],
    atencao: "Erro comum: avaliar justiça organizacional apenas com base em políticas formais. O que importa é a percepção dos trabalhadores — uma política justa aplicada de forma inconsistente é percebida como injusta.",
    marque_sim: "Se trabalhadores relatam critérios opacos ou variáveis para avaliação/promoção, há percepção de favoritismo ou tratamento desigual entre grupos, desligamentos são percebidos como arbitrários, ou regras são aplicadas de forma diferente por nível hierárquico.",
  },
  {
    label: "Eventos violentos ou traumáticos",
    conceito: `A exposição a violência física ou psicológica grave, acidentes com vítimas, ameaças sérias ou eventos com alto impacto emocional são estressores agudos que podem causar TEPT (Transtorno de Estresse Pós-Traumático), depressão grave e afastamentos prolongados. A violência de Tipo II (por clientes, usuários ou terceiros) é a modalidade mais comum e mais subestimada — a violência verbal crônica de clientes tem impacto comparável a um incidente físico por ser cumulativa e raramente reconhecida. O silêncio institucional sobre violência é um fator agravante: quando a empresa trata como 'parte do trabalho', o trabalhador não processa o impacto e não acessa suporte.`,
    como: [
      "Pergunte diretamente: 'Você já sofreu ou presenciou agressão verbal — xingamento, humilhação, ameaça — de cliente, colega ou gestor durante o trabalho? Com que frequência?' A normalização é alta — só relatam se perguntado diretamente.",
      "Verifique registros: há livro de ocorrências, SIPAT com registros de violência, BO registrado? Ausência de registros em atendimento ao público não significa ausência de eventos — significa ausência de cultura de registro.",
      "Avalie medidas de proteção: há protocolo para agir em caso de agressão? Treinamento para conflitos com clientes? Suporte psicológico pós-incidente? Ausência de todas é lacuna técnica.",
      "Identifique fatores de risco: atendimento ao público vulnerável, pessoas sob efeito de álcool/drogas, cobranças ou execução de regras impopulares, trabalho noturno isolado.",
      "Avalie ansiedade antecipatória: 'Você se sente ansioso antes de começar o turno por medo de situações difíceis?' Pensamentos intrusivos sobre incidentes passados são sinais de resposta traumática.",
    ],
    atencao: "Erro comum: limitar a avaliação a agressões físicas formalmente registradas. A agressão verbal crônica e o assédio de clientes têm impacto de saúde mental comparável ou superior a um incidente físico único — por ser cumulativo e constante.",
    marque_sim: "Se há relatos de agressão verbal ou física por clientes, colegas ou gestores, o setor tem características de alto risco, ausência de protocolo de proteção e suporte pós-incidente, ou trabalhadores relatam ansiedade antecipatória.",
  },
  {
    label: "Baixa demanda no trabalho (Subcarga)",
    conceito: `A subcarga de trabalho — quando o volume e a complexidade das tarefas ficam sistematicamente abaixo da capacidade do trabalhador — é um fator de risco psicossocial frequentemente negligenciado. A ociosidade crônica e a subutilização de competências geram desmotivação, perda de sentido e ansiedade por inutilidade. O modelo de Enriquecimento do Trabalho (Hackman e Oldham) demonstra que tarefas significativas, com variedade de habilidades e autonomia, são prerequisitos para motivação e bem-estar. Trabalho repetitivo sem desafio, ou com excesso de tempo ocioso, deteriora o engajamento e pode levar ao turnover de trabalhadores qualificados.`,
    como: [
      "Pergunte: 'Você costuma ter tempo ocioso no trabalho por falta de tarefas?' e 'Sente que suas habilidades são bem utilizadas?' Respostas afirmativas à primeira e negativas à segunda indicam subcarga.",
      "Observe a dinâmica do setor: trabalhadores com tempo ocioso visível (aguardando demandas, aparentando falta de ocupação) em sistema de trabalho que deveria mantê-los ocupados indicam má distribuição de carga.",
      "Avalie a correspondência entre formação/competência e função: trabalhador com formação técnica ou superior em função que exige apenas tarefas simples repetitivas tende a subcarga cognitiva.",
      "Verifique a rotatividade de trabalhadores qualificados: saídas voluntárias de bons profissionais podem indicar falta de desafio e desenvolvimento — pergunte nas entrevistas de desligamento.",
      "Avalie o histórico de solicitações de transferência ou promoção: trabalhadores que pedem mudança com frequência sem relato de problemas interpessoais podem estar buscando maior demanda.",
    ],
    atencao: "Erro comum: interpretar baixa demanda como 'bom para o trabalhador'. Ociosidade crônica não é descanso — é estressor. A privação de trabalho significativo tem impacto negativo comprovado na saúde mental.",
    marque_sim: "Se trabalhadores relatam tempo ocioso habitual, sentem que habilidades são pouco utilizadas, há turnover voluntário de bons profissionais sem razões evidentes, ou o trabalho é percebido como repetitivo a ponto de gerar desânimo.",
  },
  {
    label: "Excesso de demandas no trabalho (Sobrecarga)",
    conceito: `A sobrecarga é a condição em que o volume de demandas excede regularmente a capacidade disponível de tempo e recursos para atendê-las com qualidade. O problema é a sobrecarga crônica: quando o backlog nunca diminui, quando o padrão é trabalhar sob pressão constante. A CLT limita a jornada a 8h/dia e 44h/semana (Art. 59) — jornadas de 10–12h/dia comprimem o tempo de recuperação fisiológica. Estudos mostram que > 55h/semana aumenta em 33% o risco de AVC e em 13% o risco de cardiopatia coronariana. A sobrecarga crônica ativa mecanismos de coping que a curto prazo parecem soluções (trabalhar mais rápido, pular etapas) mas a longo prazo levam ao burnout.`,
    como: [
      "Mapeie a carga: liste entregas esperadas por turno e estime o tempo necessário com qualidade. Se a soma excede 80–85% da jornada, não há margem para imprevistos.",
      "Pergunte: 'Você consegue fazer tudo que precisa durante o turno?' e 'Quando sai, fica com a sensação de que ficaram coisas pendentes?' Respostas consistentemente afirmativas ao segundo indicam sobrecarga estrutural.",
      "Verifique acúmulo de funções: compare a descrição formal do cargo com o que o trabalhador realmente faz. Acúmulo sem formalização é sobrecarga mascarada de polivalência.",
      "Analise os registros de ponto: jornada média > 50h/semana nos últimos 3 meses é preocupante; > 55h é alto risco cardiovascular. Banco de horas com saldo crescente sem compensação indica horas extras estruturais.",
      "Observe o absenteísmo: taxas > 4% mensais estão associadas a sobrecarga operacional. O trabalhador que falta frequentemente pode estar usando a ausência como válvula de escape.",
    ],
    atencao: "Erro comum: responsabilizar o trabalhador pela sobrecarga. Frases como 'precisa se organizar melhor' frequentemente mascaram problema de dimensionamento ou processo que é responsabilidade da organização.",
    marque_sim: "Se carga excede 85% da jornada habitualmente, acúmulo de funções sem compensação, jornada média > 50h/semana, backlog permanente, ou absenteísmo > 4% mensalmente.",
  },
  {
    label: "Maus relacionamentos no local de trabalho",
    conceito: `Padrões disfuncionais de interação — conflitos crônicos não resolvidos, rivalidade excessiva, comunicação agressiva, hostilidade entre colegas ou com a liderança — são estressores psicossociais que consomem energia mental e emocional mesmo de quem não está diretamente envolvido. O ambiente de trabalho hostil ativa a resposta de ameaça do sistema nervoso autônomo de forma contínua, com os mesmos efeitos fisiológicos que outras formas de estresse crônico. A qualidade das relações interpessoais é um recurso de trabalho fundamental: suporte dos colegas amortece o impacto das demandas. Sua ausência ou deterioração amplifica qualquer dificuldade.`,
    como: [
      "Avalie o clima relacional: 'Como é o relacionamento entre as pessoas da sua equipe?' / 'Você se sente confortável no convívio diário com seus colegas?' Respostas vagas ou evasivas são indicadores.",
      "Identifique conflitos crônicos: 'Há alguma situação de conflito recorrente entre pessoas ou áreas que ainda não foi resolvida?' Conflitos entre TI e Operações, Comercial e Produção são comuns — verificar se são gerenciados.",
      "Observe o comportamento durante a visita: trabalhadores que evitam contato visual entre si, respostas tensas em presença de determinadas pessoas, grupinhos isolados sem interação.",
      "Verifique o protocolo de mediação de conflitos: a empresa tem processo formal? O RH atua como mediador? Ausência de protocolo significa que conflitos se resolvem por força ou se cronificam.",
      "Avalie a liderança como modelo: líderes que competem publicamente, contradizem gestores de outras áreas ou demonstram rivalidade modelam comportamento para a equipe.",
    ],
    atencao: "Erro comum: interpretar ausência de conflito declarado como bom relacionamento. Em culturas de alta hierarquia, os trabalhadores raramente expressam conflito abertamente — silêncio pode mascarar hostilidade passiva.",
    marque_sim: "Se há relatos de conflitos interpessoais crônicos não resolvidos, trabalhadores relatam evitar colegas ou superiores, há rivalidade percebida entre áreas sem mediação, ou o clima geral é descrito como tenso ou hostil.",
  },
  {
    label: "Trabalho em condições de difícil comunicação",
    conceito: `Algumas condições estruturais de trabalho dificultam inerentemente a comunicação: turnos diferentes que impedem comunicação direta entre equipes, distância física entre trabalhadores e lideranças, ambientes com ruído elevado que inviabiliza conversa, trabalho externo ou em campo com acesso limitado aos meios de comunicação. Essas condições criam barreiras para o fluxo de informação essencial à segurança e qualidade do trabalho, além de alimentar sentimento de isolamento e desinformação. São diferentes de comunicação organizacional deficiente por origem estrutural — o problema não é falta de vontade de comunicar, mas limitação física, técnica ou organizacional.`,
    como: [
      "Mapeie as condições que dificultam comunicação: há trabalhadores em turnos distintos sem sobreposição? Há equipes em locais físicos diferentes sem ferramenta de comunicação adequada? Há ambientes com ruído que impede conversa?",
      "Avalie a troca de informação entre turnos: como se dá a passagem de turno? Há registro formal? Trabalhadores do turno noturno ficam desatualizados de decisões tomadas durante o dia?",
      "Identifique trabalhadores em campo ou externos: motoristas, técnicos de campo, vendedores externos, trabalhadores em obras — qual o protocolo de comunicação e com que frequência há contato com a base?",
      "Verifique os meios de comunicação disponíveis: rádio, celular corporativo, aplicativo de equipe, murais — são adequados para o contexto? São utilizados?",
      "Avalie o impacto na segurança: ausência de comunicação em trabalhos de risco (turno noturno, trabalho isolado, área confinada) é um risco de segurança direto, não apenas psicossocial.",
    ],
    atencao: "Erro comum: confundir comunicação organizacional deficiente com trabalho em condições de difícil comunicação. O primeiro é um problema de gestão (cultura, prioridade, canais); o segundo é uma condição estrutural (física, de turno ou de distância) que requer solução técnica.",
    marque_sim: "Se turnos distintos impedem comunicação direta, há trabalhadores em campo sem protocolo de contato regular, ambientes com ruído que inviabiliza conversa, passagem de turno sem registro formal, ou trabalhadores relatam receber informações importantes com atraso.",
  },
  {
    label: "Trabalho remoto e isolado",
    conceito: `O trabalho remoto e o trabalho fisicamente isolado (operador de máquina solitário, vigia, trabalhador em campo rural, técnico externo) compartilham o risco psicossocial do isolamento social. O contato presencial com colegas não é apenas conforto — é uma fonte de suporte, reconhecimento, alinhamento e amortecimento do estresse. Trabalhadores remotos têm maior dificuldade de separar trabalho e vida pessoal, tendem a trabalhar mais horas e relatam sentimento de invisibilidade — a percepção de que seu trabalho não é visto, reconhecido ou valorizado. O trabalho isolado fisicamente adiciona riscos de segurança diretos: sem socorro imediato em caso de acidente.`,
    como: [
      "Identifique trabalhadores em regime remoto total ou parcial e trabalhadores fisicamente isolados (postos solitários, campo, áreas sem colegas próximos).",
      "Avalie o protocolo de check-in: há contato regular programado entre líder e trabalhador remoto/isolado? Com que frequência? Por qual meio?",
      "Pergunte sobre pertencimento: 'Você se sente parte da equipe mesmo trabalhando remoto/isolado?' / 'Você fica sabendo das novidades da empresa no mesmo tempo que os colegas presenciais?'",
      "Avalie equidade de tratamento entre presenciais e remotos: há percepção de que remotos têm menos acesso a promoções, projetos ou informações? Essa percepção alimenta isolamento psicossocial mesmo com comunicação digital.",
      "Para trabalho isolado com risco físico: verificar se há protocolo de segurança para trabalho solitário — check-ins de segurança, sistema de vigilância, acesso a emergência.",
    ],
    atencao: "Erro comum: avaliar trabalho remoto apenas pelo critério de produtividade. Trabalhadores remotos produtivos podem estar em sofrimento psicossocial significativo — isolamento, invisibilidade e falta de pertencimento não aparecem nos indicadores de entrega.",
    marque_sim: "Se trabalhadores trabalham predominantemente remotos ou isolados sem protocolo regular de contato com a liderança, relatam sentimento de distância ou invisibilidade, não há encontros presenciais periódicos, ou trabalhadores isolados não têm protocolo de segurança.",
  },
];

// ─── Passos ───────────────────────────────────────────────────────────────────

const PASSOS = [
  { numero: "01", titulo: "Criar Nova Análise",             icone: Plus,          cor: "emerald",
    descricao: "Clique em \"Nova Análise\" no menu lateral. Selecione a empresa, data de elaboração e responsável técnico. A análise é salva como Rascunho — você pode interromper e retomar a qualquer momento.",
    dicas: ["Use uma análise por empresa ou por grupo homogêneo de setores.", "O status muda para Concluído automaticamente quando todos os campos obrigatórios são preenchidos."] },
  { numero: "02", titulo: "Cadastrar Setores",               icone: Layers,        cor: "blue",
    descricao: "Na aba Setores / Triagem, adicione cada setor ou posto de trabalho. Nomes específicos facilitam a comunicação com o cliente — prefira \"Linha de Montagem 01\" a \"Produção\".",
    dicas: ["Setores com tarefas muito distintas devem ser separados mesmo se fisicamente próximos.", "Setores idênticos (3 linhas com a mesma tarefa) podem ser avaliados um e replicado com nota explicativa."] },
  { numero: "03", titulo: "Aplicar a Triagem Ergonômica",    icone: ClipboardCheck, cor: "orange",
    descricao: "Para cada setor, responda os checklists de Ergonomia Física, Cognitiva e Organizacional com Sim / Não / N/A. Cada Sim gera um alerta e deve embasar um risco na Matriz.",
    dicas: ["Responda durante a observação in loco — não depois, de memória.", "Leia as orientações de cada item nesta página de Ajuda antes da visita para saber o que observar."] },
  { numero: "04", titulo: "Registrar Riscos na Matriz",       icone: TriangleAlert,  cor: "yellow",
    descricao: "Clique em \"+ Risco\" para registrar cada risco formalmente: tipo, descrição, probabilidade e severidade. O sistema calcula o Nível: Trivial, De Atenção, Moderado, Alto ou Crítico.",
    dicas: ["Agrupe itens relacionados do checklist em um único risco quando tiver mesma origem.", "Riscos Altos e Críticos devem indicar necessidade de AET completa no campo de observações."] },
  { numero: "05", titulo: "Redigir Parecer e Recomendações",  icone: Pencil,        cor: "purple",
    descricao: "Preencha o Parecer Técnico e as Recomendações ao final de cada setor. O parecer resume o diagnóstico; as recomendações orientam as ações prioritárias.",
    dicas: ["Cite dados observados: ângulos, frequências, durações — não apenas 'há risco de postura'.", "Divida as recomendações em: imediatas (< 30 dias), preventivas (30–90 dias) e estruturais (> 90 dias)."] },
  { numero: "06", titulo: "Preencher Dados e Conclusão",      icone: Info,          cor: "blue",
    descricao: "Na aba Dados / Conclusão, informe os dados gerais da empresa e redija a conclusão técnica consolidando os achados de todos os setores.",
    dicas: ["A conclusão deve identificar os setores prioritários e as ações globais recomendadas.", "Use os Textos Padrão do sistema para acelerar a redação sem perder a personalização."] },
  { numero: "07", titulo: "Gerar e Imprimir o Laudo",         icone: Printer,       cor: "gray",
    descricao: "Na aba Laudo / Imprimir, visualize o relatório final e exporte o PDF. Revise cuidadosamente antes de entregar ao cliente.",
    dicas: ["O PDF tem formatação otimizada para A4.", "O laudo inclui todos os setores, checklists, riscos classificados e recomendações."] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COR_BG: Record<string, string> = {
  emerald: "bg-emerald-50 border-emerald-200", blue: "bg-blue-50 border-blue-200",
  orange: "bg-orange-50 border-orange-200",   yellow: "bg-yellow-50 border-yellow-200",
  purple: "bg-purple-50 border-purple-200",   gray: "bg-gray-50 border-gray-200",
};
const COR_ICON: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-100", blue: "text-blue-600 bg-blue-100",
  orange: "text-orange-600 bg-orange-100",   yellow: "text-yellow-700 bg-yellow-100",
  purple: "text-purple-600 bg-purple-100",   gray: "text-gray-600 bg-gray-100",
};
const COR_NUM: Record<string, string> = {
  emerald: "text-emerald-700", blue: "text-blue-700", orange: "text-orange-700",
  yellow: "text-yellow-700",  purple: "text-purple-700", gray: "text-gray-600",
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
        {isOpen ? <ChevronUp className="size-4 text-gray-400 shrink-0" /> : <ChevronDown className="size-4 text-gray-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* Conceito */}
          <div className="pt-3 space-y-1">
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Por que é um risco?</p>
            <p className="text-xs text-gray-700 leading-relaxed">{conceito}</p>
          </div>

          {/* Como avaliar */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Como avaliar na prática</p>
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
              <p className="text-xs text-amber-800"><span className="font-bold">Erro comum: </span>{atencao.replace("Erro comum: ", "")}</p>
            </div>
          )}

          {/* Critério */}
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2.5">
            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">Marque Sim se:</p>
            <p className="text-xs text-red-800">{marque_sim}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Seção de categoria ───────────────────────────────────────────────────────

function CategoriaChecklist({
  icon: Ic, iconCor, titulo, subtitulo, intro, itens, bg, border, forceOpen,
}: {
  icon: React.ElementType; iconCor: string; titulo: string; subtitulo: string;
  intro: string; itens: ItemData[]; bg: string; border: string; forceOpen?: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex size-9 items-center justify-center rounded-lg ${iconCor}`}>
          <Ic className="size-4" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800">{titulo}</h2>
          <p className="text-xs text-gray-500">{subtitulo}</p>
        </div>
      </div>
      <div className={`rounded-xl border ${border} ${bg} p-4 space-y-3`}>
        <div className={`rounded-lg border ${border} bg-white/70 px-4 py-3`}>
          <p className="text-xs text-gray-700 leading-relaxed">{intro}</p>
        </div>
        {itens.map((item, i) => <ItemChecklist key={i} {...item} forceOpen={forceOpen} />)}
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AepAjudaPage() {
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
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <HelpCircle className="size-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Guia Técnico da AEP</h1>
            <p className="mt-1 text-sm text-gray-500">
              Material de referência para técnicos e engenheiros de segurança do trabalho — triagem ergonômica, checklists, parecer e recomendações.
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

      {/* O que é */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="size-5 shrink-0 text-emerald-700 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-emerald-900">O que é a AEP e qual é o seu papel?</p>
            <p className="text-sm text-emerald-800 leading-relaxed">
              A <strong>Análise Ergonômica Preliminar</strong> é a triagem do GRO/PGR para riscos ergonômicos, prevista na NR-01.
              Ela mapeia todos os setores da empresa de forma qualitativa, identificando onde há fatores de risco e qual é o nível de
              urgência de cada um. Quando a AEP identifica riscos Altos ou Críticos, esses setores devem evoluir para a
              <strong> AET (Análise Ergonômica do Trabalho)</strong> — uma análise aprofundada com medições instrumentais, prevista
              na NR-17. O papel do técnico na AEP é o de um investigador clínico: observar, perguntar, medir quando possível e,
              principalmente, saber o que procurar e por que é importante encontrá-lo antes que cause dano.
            </p>
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
                    {p.dicas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.dicas.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                            <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-gray-400" />{d}
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
          <h2 className="font-semibold text-gray-800">Botões Sim / Não / N/A — critério técnico de uso</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { btn: "Sim", bc: "bg-red-500", titulo: "Fator presente e confirmado", cor: "border-red-200 bg-red-50", tc: "text-red-700",
              desc: "O fator de risco foi identificado durante a visita ou entrevista com evidência suficiente. Gera um alerta e DEVE embasar um risco na Matriz de Riscos. Não marque Sim por precaução — marque quando há evidência." },
            { btn: "Não", bc: "bg-green-500", titulo: "Fator avaliado e ausente", cor: "border-green-200 bg-green-50", tc: "text-green-700",
              desc: "O fator foi especificamente avaliado in loco (não apenas suposto) e não foi identificado. Registra que a condição foi verificada. 'Não' é um resultado técnico válido e importante — indica que você avaliou." },
            { btn: "N/A", bc: "bg-gray-400", titulo: "Genuinamente inaplicável", cor: "border-gray-200 bg-gray-50", tc: "text-gray-700",
              desc: "O item não existe no contexto do setor — não pela ausência do risco, mas pela ausência da condição que o geraria. Ex.: vibração de ferramentas em setor 100% administrativo. Em dúvida entre N/A e Não, sempre prefira Não." },
          ].map((c, i) => (
            <div key={i} className={`rounded-xl border p-4 ${c.cor}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${c.bc}`}>{c.btn}</span>
                <span className={`text-sm font-semibold ${c.tc}`}>{c.titulo}</span>
              </div>
              <p className="text-xs text-gray-700">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ergonomia Física */}
      <CategoriaChecklist
        icon={User} iconCor="text-blue-700 bg-blue-100"
        titulo="Ergonomia Física"
        subtitulo="Clique em cada item para ver a explicação completa, como avaliar e o critério de Sim. Referências: NR-17, NR-15, NIOSH, ISO 5349-1, ISO 2631-1, NBR ISO/CIE 8995-1."
        intro={FISICA_INTRO} itens={FISICA_ITENS}
        bg="bg-blue-50" border="border-blue-200"
        forceOpen={printMode}
      />

      {/* Ergonomia Cognitiva */}
      <CategoriaChecklist
        icon={Brain} iconCor="text-purple-700 bg-purple-100"
        titulo="Ergonomia Cognitiva"
        subtitulo="Clique em cada item para ver a explicação completa. Referências: NR-17 7.4, NASA-TLX, modelo de Karasek, JD-R, literatura de ergonomia cognitiva."
        intro={COGNITIVA_INTRO} itens={COGNITIVA_ITENS}
        bg="bg-purple-50" border="border-purple-200"
        forceOpen={printMode}
      />

      {/* Ergonomia Organizacional */}
      <CategoriaChecklist
        icon={Building2} iconCor="text-orange-700 bg-orange-100"
        titulo="Ergonomia Organizacional"
        subtitulo="Clique em cada item para ver a explicação completa. Referências: NR-17, NR-01 GRO/PGR, CLT, critérios de Leymann, modelo de Karasek, JD-R."
        intro={ORGANIZACIONAL_INTRO} itens={ORGANIZACIONAL_ITENS}
        bg="bg-orange-50" border="border-orange-200"
        forceOpen={printMode}
      />

      {/* Parecer */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
            <FileText className="size-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Como redigir o Parecer Técnico Preliminar</h2>
            <p className="text-xs text-gray-500">Campo por setor — o seu diagnóstico técnico das condições ergonômicas da área avaliada.</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            O Parecer é o texto onde você, como profissional, assume a responsabilidade técnica pelo diagnóstico. Não é um resumo dos
            checklists — é a sua interpretação do que foi encontrado. Um parecer fraco diz &ldquo;há riscos ergonômicos no setor&rdquo;. Um parecer
            forte diz &ldquo;o setor apresenta risco Alto, caracterizado por movimentos repetitivos de membros superiores com frequência
            estimada de 8 ciclos/min, durante 6h por turno, em trabalhadores que não realizam pausas além do horário de almoço&rdquo;.
            A diferença é a especificidade — ela é o que transforma um formulário preenchido em um documento técnico com valor real.
          </p>
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Estrutura recomendada (4 elementos)</p>
            {[
              ["1. Fatores identificados",       "Cite os principais itens marcados como Sim, com dados observados: ângulos, frequências, durações, temperaturas, nível de ruído estimado."],
              ["2. Nível de risco predominante",  "Declare explicitamente: Trivial / De Atenção / Moderado / Alto / Crítico, com base na Matriz de Riscos. O leitor do laudo precisa entender o grau de urgência sem consultar os dados brutos."],
              ["3. Contexto do setor",            "Número de trabalhadores expostos, turnos, regime de trabalho, tempo de exposição diário, e qualquer condicionante relevante (trabalhadores com restrições, gestantes, trabalhadores novos)."],
              ["4. Indicação de aprofundamento",  "Se identificou risco Alto ou Crítico, indique expressamente: 'Recomenda-se elaboração de AET completa para este posto'. Sem essa indicação, o gestor pode interpretar que a AEP é suficiente."],
            ].map(([t, d], i) => (
              <div key={i} className="rounded-lg border border-emerald-200 bg-white p-3.5 flex items-start gap-3">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                <div><p className="text-sm font-semibold text-gray-800">{t}</p><p className="text-xs text-gray-600 mt-0.5">{d}</p></div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-emerald-300 bg-white p-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Exemplo de parecer — Linha de Montagem</p>
            <p className="text-sm text-gray-700 leading-relaxed italic">
              &ldquo;O setor de Produção — Linha de Montagem 01 apresenta risco ergonômico de nível Alto. Foram identificados movimentos
              repetitivos de membros superiores com frequência estimada de 8–10 ciclos/min (pega e encaixe de componentes) durante
              aproximadamente 6h do turno de 8h, com ciclo de trabalho de 25 segundos. Identificou-se também flexão de tronco
              recorrente entre 30–45° durante a pega de componentes na parte inferior da esteira (30–40% do ciclo), e ausência de
              pausas programadas além do intervalo de almoço. O mobiliário é fixo sem regulagem de altura — trabalhadores com
              estatura ≥ 1,78 m (aproximadamente 4 dos 12 trabalhadores observados) adotam flexão cervical compensatória para
              visualizar a esteira. Os trabalhadores relatam dor em punhos e ombros ao final do turno de forma consistente.
              Recomenda-se elaboração de AET completa para este posto, com aplicação de RULA e OCRA index para quantificação
              das exposições.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Recomendações */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
            <Zap className="size-4 text-amber-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Como redigir as Recomendações</h2>
            <p className="text-xs text-gray-500">Campo por setor — orientações acionáveis para eliminar ou controlar os riscos identificados.</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Uma recomendação técnica ruim diz &ldquo;melhorar as condições ergonômicas do posto&rdquo;. Uma recomendação técnica boa diz
            exatamente o quê fazer, com que referência técnica, em quanto tempo e com que resultado esperado. A priorização
            por urgência não é opcional — é o que permite ao gestor alocar recursos de forma racional: o que precisa ser feito
            esta semana versus o que pode entrar no orçamento do próximo trimestre.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { titulo: "Imediatas", prazo: "até 30 dias", cor: "bg-red-50 border-red-200", tc: "text-red-700",
                icon: AlertTriangle, ic: "text-red-500",
                desc: "Para riscos Altos e Críticos com potencial de dano imediato. Não podem aguardar planejamento orçamentário. Se necessário, a medida imediata pode ser temporária enquanto a estrutural é planejada.",
                ex: "[Imediata] Suspender levantamento manual > 20 kg no setor de Expedição até realização de avaliação NIOSH e treinamento de movimentação de cargas (NR-11)." },
              { titulo: "Preventivas", prazo: "30–90 dias", cor: "bg-yellow-50 border-yellow-200", tc: "text-yellow-700",
                icon: Info, ic: "text-yellow-500",
                desc: "Ações que reduzem a probabilidade de agravamento, exigem planejamento mas têm impacto antes do próximo ciclo de avaliação. Frequentemente envolvem treinamento, reorganização ou aquisição de baixo custo.",
                ex: "[Preventiva] Implantar pausas de 10 min a cada 50 min de trabalho para operadores de caixa conforme NR-17 7.4.3, com escalonamento por grupo para não interromper operação." },
              { titulo: "Estruturais", prazo: "> 90 dias", cor: "bg-blue-50 border-blue-200", tc: "text-blue-700",
                icon: Building2, ic: "text-blue-500",
                desc: "Mudanças que modificam o processo, o ambiente ou a organização do trabalho. Exigem investimento, projeto ou reestruturação. Devem entrar no planejamento orçamentário com prazo definido.",
                ex: "[Estrutural] Substituir as 18 bancadas fixas da Linha de Montagem 01 por bancadas com regulagem elétrica de altura (800–1.100 mm) e possibilidade de trabalho sentado/em pé — orçar para próximo exercício." },
            ].map((c, i) => {
              const Ic = c.icon;
              return (
                <div key={i} className={`rounded-lg border p-4 space-y-2 ${c.cor}`}>
                  <div className="flex items-center gap-2">
                    <Ic className={`size-4 shrink-0 ${c.ic}`} />
                    <p className={`text-sm font-semibold ${c.tc}`}>{c.titulo}</p>
                  </div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Prazo sugerido: {c.prazo}</p>
                  <p className="text-xs text-gray-700">{c.desc}</p>
                  <div className="rounded border border-white/80 bg-white/60 p-2">
                    <p className="text-xs text-gray-500 mb-0.5 font-semibold">Exemplo:</p>
                    <p className="text-xs text-gray-700 italic">{c.ex}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg border border-amber-300 bg-white p-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Exemplo de conjunto de recomendações — Linha de Montagem 01</p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {[
                "[Imediata] Fornecer e exigir o uso de suporte de punho para os operadores que realizam montagem de precisão com punho em desvio — medida temporária até reestruturação do posto.",
                "[Imediata] Proibir levantamento manual de caixas > 15 kg abaixo do nível do joelho até rearranjo da estação de pega — uso de plataforma elevatória provisória.",
                "[Preventiva] Implementar rodízio de funções entre as 4 estações da linha a cada 2h para reduzir a exposição cumulativa de membros superiores por estação.",
                "[Preventiva] Incluir pausa obrigatória de 10 min após as primeiras 2h de trabalho e após as primeiras 2h do período da tarde (NR-17 7.4).",
                "[Estrutural] Adquirir bancadas com regulagem de altura elétrica (800–1.100 mm) para as 12 estações da Linha 01 — orçamento previsto para Q1 do próximo exercício.",
                "[Estrutural] Elaborar AET completa com aplicação de RULA e OCRA index para quantificação das exposições e dimensionamento preciso das intervenções.",
              ].map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 rounded-full bg-amber-500 shrink-0" />{r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* AEP vs AET */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="size-5 text-gray-600" />
          <h2 className="font-semibold text-gray-800">AEP × AET — quando cada uma se aplica?</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Critério</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-600 uppercase tracking-wider">AEP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wider">AET</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["Tipo",           "Triagem qualitativa por checklist",     "Análise aprofundada com medições instrumentais"],
                ["Abrangência",    "Toda a empresa / todos os setores",     "Posto ou função específica"],
                ["Tempo médio",    "Horas a 1 dia por empresa",             "Dias a semanas por posto"],
                ["Instrumentos",   "Não obrigatórios (observação + entrevista)", "RULA, REBA, NIOSH, OCRA, sonômetro, luxímetro, acelerômetro"],
                ["Base normativa", "NR-01 GRO/PGR — item 1.5.7",           "NR-17 + Portaria MTE 1.121/2023"],
                ["Resultado",      "Mapa de riscos + priorização de setores",   "Laudo com nexo causal + plano de intervenção detalhado"],
                ["Quando usar",    "Início do GRO/PGR, visita inicial, reavaliação periódica", "Sempre que AEP identificar risco Alto ou Crítico"],
                ["Substitui a AET?", "Não — é a triagem que a precede",    "—"],
              ].map(([c, a, b], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3 font-medium text-gray-700">{c}</td>
                  <td className="px-4 py-3 text-gray-600">{a}</td>
                  <td className="px-4 py-3 text-gray-600">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boas práticas */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <Lightbulb className="size-5 shrink-0 text-amber-700 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 mb-3">Boas práticas de campo — o que os técnicos experientes fazem diferente</p>
            <ul className="space-y-2 text-sm text-amber-800">
              {[
                "Chegue antes do início do turno para observar a preparação do posto e os primeiros 30 minutos de trabalho — é quando surgem compensações posturais que desaparecem quando o trabalhador está 'quente'.",
                "Nunca anuncie com antecedência o que vai avaliar — ambientes 'preparados' para a visita técnica escondem os problemas reais.",
                "Entreviste trabalhadores longe do posto de trabalho e longe dos gestores. Uma conversa de 5 minutos no corredor afastado vale mais que 30 minutos de entrevista formal na presença da chefia.",
                "Quando o trabalhador diz 'aqui é assim mesmo' ou 'sempre foi desse jeito' — esse é exatamente o momento de perguntar mais. Normalização do risco é um sinal de alerta, não de que está tudo bem.",
                "Documente com fotos e vídeos curtos (com autorização) — ângulos posturais, layout do posto, posição relativa dos componentes. Sem evidência visual, é difícil comunicar o risco ao cliente com a mesma clareza que você viu.",
                "Avalie setores em diferentes momentos: um posto de trabalho no início do turno pode parecer adequado; no final, com fadiga acumulada, o trabalhador adota posturas completamente diferentes.",
                "Para fatores organizacionais, compare as respostas de trabalhadores de turnos diferentes sobre o mesmo setor e gestor. Consistência entre relatos independentes é o critério mais forte de diagnóstico.",
                "Seu laudo vai para a gestão e pode ser lido por trabalhadores — escreva como se fosse apresentar para os dois ao mesmo tempo. Técnico e compreensível não são opostos.",
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
