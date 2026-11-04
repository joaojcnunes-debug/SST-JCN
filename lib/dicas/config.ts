/**
 * Dicas de preenchimento das Configurações do Sistema (Etapa 7, lote 7.10a, do
 * docs/plano-skin-viva-jcn.md): Usuários, Funções, Tipos de risco, Catálogo, Triagem, Perguntas,
 * Matrizes, Portal SST e o editor de capítulo do Texto padrão. Mesmas regras de
 * lib/dicas/empresas.ts; cada afirmação conferida no código. Aprovadas pelo João em 04/11/2026.
 * Lote 7.10b (0.3.226): Config. OWAS, Config. 13 Fatores e Biblioteca psicossocial da AEP. Onde a
 * dica diz "hoje fica só nesta tela", o valor é gravado e nada o lê (registrado para o PR de correções).
 */

export const DICAS_USUARIO = {
  nome: "Nome completo como deve sair nos laudos. A folha de assinaturas acha a assinatura do profissional por este nome.",
  email: "É o login da conta. Na criação, a pessoa recebe o e-mail de boas-vindas; na edição, trocar aqui muda o login.",
  cargo: "Escolha da lista fixa. O cargo sai nos laudos e decide qual registro pedir ao lado: CRP, CRM ou Registro MTE.",
  registro: "Só o número, sem prefixo: a folha de assinaturas acrescenta Reg. MTE, CRP ou CRM conforme o campo.",
  pode_criar: "Mostra o botão de novo documento. Só vale para Técnico: o banco não aceita criação de Visualizador.",
  pode_editar: "Libera editar documentos. Em vários módulos, o banco também exige esta marca para criar.",
  pode_excluir: "Libera excluir laudos e análises inteiros. Admin sempre pode, com ou sem a marca.",
  empresas: "Técnico: vê só as empresas marcadas; vazio, todas as das unidades dele. Cliente: a empresa do portal.",
  modulos: "Módulos que a conta abre. Trocar a função ou aplicar o padrão em Funções reescreve esta lista.",
  ativo: "Desmarcado, a pessoa não consegue mais entrar. Os documentos dela continuam.",
} as const;

export const DICAS_FUNCAO = {
  nome: "Nome da função, como aparece em Usuários. Depois de criada não muda: é a chave que liga as contas.",
  ordem: "Posição da função nesta tela e na lista Função no painel de Usuários. Menor vem primeiro.",
  descricao: "Uma frase sobre a função. Aparece em Usuários, logo abaixo da escolha da função.",
  nivel: "Trocar o nível já muda o perfil e as marcas criar/editar/excluir para o sugerido. Revise antes de salvar.",
  perfil: "Perfil gravado na conta ao aplicar o padrão. O perfil Admin abre toda a área Sistema, inclusive esta tela.",
  unidades: "Todas: a conta recebe todas as unidades ao escolher a função em Usuários ou ao aplicar o padrão.",
  presenca: "Vale na hora para todas as contas desta função, sem precisar aplicar o padrão.",
  marcas: "Marcas gravadas nas contas ao aplicar o padrão. Salvar a função não muda nenhuma conta.",
  modulos: "Gravados na conta ao aplicar o padrão; o que ela tiver a mais sai. Salvar a função não muda nenhuma conta.",
} as const;

export const DICAS_TIPO_RISCO = {
  nome: "Nome do tipo no formulário de risco. Ao renomear, os riscos já gravados passam para o nome novo.",
  icone: "Emoji mostrado antes do nome no formulário de risco e nos grupos da aba Riscos. Clique num sugerido ou cole outro.",
  ordem: "Posição na lista de tipos do formulário de risco e na ordem dos grupos da aba Riscos.",
} as const;

export const DICAS_CATALOGO = {
  agente: "Nome do agente. No formulário de risco, digitar exatamente este nome aplica o modelo e traz fontes, EPIs e medidas.",
  ordem: "Posição do modelo na lista do tipo e no catálogo. Menor vem primeiro.",
  triagem_ordem: "Posição da triagem no formulário de risco, acima do agente. Menor vem primeiro.",
} as const;

export const DICAS_PERGUNTA = {
  tipo: "Como responder no formulário de risco: lista de opções, texto curto ou texto longo.",
  texto_tipo: "Pergunta mostrada no formulário de risco deste tipo. No relatório da inspeção sai junto com a resposta.",
  texto_modelo: "Pergunta mostrada no formulário de risco quando ele usa este modelo. No relatório sai junto com a resposta.",
  opcoes: "Cada linha vira uma opção da lista. Mudar uma opção não altera respostas já gravadas nos riscos.",
  obrigatoria: "Só põe um asterisco na pergunta. O formulário de risco salva mesmo sem a resposta.",
  ordem_tipo: "Posição no formulário de risco. As perguntas do tipo vêm antes das do modelo.",
  ordem_modelo: "Posição entre as perguntas deste modelo. Elas aparecem depois das perguntas do tipo.",
} as const;

export const DICAS_MATRIZ = {
  nome: "Nome da matriz. Aparece na escolha de matriz do risco e no cabeçalho da avaliação na AEP e na Apreciação NR-12.",
  descricao: "Nota sobre a matriz. Hoje aparece só nesta lista de Configurações.",
  nivel: "Nível dado às células cujo score cai nesta faixa. Score fora de todas as faixas vira Baixo.",
  score_min: "Menor score da faixa, incluído. Score da célula = peso da probabilidade × peso da severidade.",
  score_max: "Maior score da faixa, incluído. Evite faixas que se sobrepõem: vale a primeira da lista.",
  editor: "Dá para trocar uma célula à mão. Mudar um peso ou uma faixa recalcula a matriz e o ajuste manual se perde.",
  nomes: "Clique para renomear. Viram as opções do risco; ao salvar, os riscos já gravados passam para o nome novo.",
  peso: "Peso usado no score das células. Mudar o peso recalcula a matriz inteira na hora.",
} as const;

export const DICAS_PORTAL_SST = {
  empresa: "Empresa que recebe a pendência. Ela aparece no portal para os usuários Cliente ligados a essa empresa.",
  prioridade: "Baixa, Média ou Alta. Sai como etiqueta na pendência, aqui e no portal do cliente.",
  titulo: "O que o cliente precisa fazer, em poucas palavras. É o nome da pendência na lista do portal.",
  descricao: "Detalhes e orientações para o cliente. Aparecem ao abrir a pendência no portal.",
  prazo: "Data limite para o cliente. Aparece como Prazo na pendência, aqui e no portal.",
} as const;

export const DICAS_CAPITULO = {
  orientacao: "Folha em pé (Retrato) ou deitada (Paisagem) para este capítulo no PDF. Grava ao clicar, sem o Salvar.",
  inicio: "Nova página ou na mesma folha do capítulo anterior. O primeiro capítulo e os com capa sempre abrem folha nova.",
  posicao: "Em que ponto do PDF o capítulo entra: antes do sumário, após setores, no fim etc. Grava ao clicar.",
  imagem: "Com imagem, o capítulo vira página inteira de capa e o texto dá lugar a caixas sobre a imagem.",
} as const;

export const DICAS_OWAS_CONFIG = {
  opcoes: "Número e nome de cada postura. O setor guarda só o número: trocar ou apagar um número tira a marcação dos laudos já feitos.",
  imagem: "Figura ao lado das opções na análise do setor, nos Perfis OWAS e no PDF. Sem imagem enviada, vale o desenho padrão.",
  opcoes_lista: "Cada linha vira uma opção da lista no setor. O setor grava o texto: renomear não muda os setores já preenchidos.",
} as const;

export const DICAS_13FATORES_CONFIG = {
  nome: "Sai nas telas de preenchimento, no formulário em branco e nos quadros de fatores do laudo e do PDF.",
  descricao: "Aparece sob o fator nas telas de preenchimento e vai para a IA da observação. Não sai no laudo nem no PDF.",
  perigos: "Só leitura: não sai no laudo, no PDF, na IA nem no plano de ação.",
  danos: "Só leitura: não sai no laudo, no PDF, na IA nem no plano de ação.",
  categoria: "Fator a que a pergunta pertence. A média do fator é feita só com as perguntas dele.",
  pergunta: "Texto lido nas telas de preenchimento e no formulário em branco. Não sai no laudo nem no PDF.",
  logica: "Direta: a conta usa 6 − nota, pois concordar é ruim. Invertida: a nota entra como está. Média alta é condição boa.",
  plano: "Só leitura: o plano de ação do laudo é feito no próprio laudo e não usa este valor.",
  minimo: "Só leitura. Aparece na legenda do formulário em branco. A zona no laudo usa faixas fixas: 4,0, 3,0 e 2,0.",
  maximo: "Só leitura. Aparece na legenda do formulário em branco, lá com ≤. A zona no laudo usa faixas fixas: 4,0, 3,0 e 2,0.",
  nivel_pgr: "Só leitura. No laudo e no PDF o nível vem fixo da zona: Crítico, Alto, Moderado ou Trivial.",
  prazo: "Prazo mostrado ao lado da zona nas telas de preenchimento e no formulário em branco. Não sai no laudo nem no PDF.",
} as const;

export const DICAS_BIBLIOTECA_AEP = {
  padrao: "Já vem marcada no setor que ainda não escolheu opções neste tópico. Depois que o técnico marca, vale a escolha dele.",
  padrao_fator: "Opção que já vem marcada neste fator. Precisa ter o mesmo texto de uma opção da lista comum acima.",
} as const;
