import type { MelhoriasInternas, Novidade } from "@/lib/novidades/tipos";

/**
 * O CATÁLOGO — as novidades que sobem junto com o código.
 *
 * POR QUE AQUI E NÃO NO BANCO. A nota e a funcionalidade viajam no mesmo
 * commit e no mesmo deploy. Isso torna impossível as duas coisas que mais
 * estragam um changelog: anunciar o que ainda não subiu, e subir sem anunciar.
 * O banco (`novidades_avisos`) fica com o que não é versão — parada
 * programada, recado de operação — que não pode esperar deploy.
 *
 * A REGRA DE OURO: a entrada entra NO MESMO COMMIT da mudança, nunca depois.
 * Changelog que se escreve "na sexta" morre em três semanas. Se a mudança não
 * merece uma frase agora, provavelmente ela não merece estar nesta tela.
 *
 * UMA ENTRADA POR ASSUNTO, NÃO POR VERSÃO. As v0.3.546 e v0.3.547 eram a mesma
 * história contada em dois deploys; viram um item só, com as duas versões em
 * `versoes`. A pessoa quer saber o que mudou, não quantas vezes subiu.
 *
 * O histórico começa em 01/09/2026, por decisão do Sanmyo. Nada do que subiu
 * antes disso é importado: ninguém está esperando por aquilo, e texto velho
 * escrito de memória sai impreciso.
 *
 * ─── Modelo para copiar ─────────────────────────────────────────────────────
 *
 *   {
 *     id: "inspecao-quem-vai-a-campo",     // estável para sempre
 *     data: "2026-08-26",
 *     tipo: "novidade",
 *     titulo: "A nova inspeção pergunta quem vai a campo",
 *     texto:
 *       "Ao abrir uma inspeção, o painel já sugere o técnico responsável e " +
 *       "deixa você trocar. Dá para indicar um segundo técnico quando a " +
 *       "visita for em dupla.",
 *     onde: "Inspeções › Nova Inspeção",
 *     impacto: "Você não precisa fazer nada nas inspeções que já existem.",
 *     versoes: ["0.3.544"],
 *   },
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
export const CATALOGO: Novidade[] = [
  {
    id: "inspecoes-concluir-como-renovacao",
    data: "2026-09-23",
    tipo: "novidade",
    titulo: "Inspeções: “Concluir como renovação” não conta nos gráficos",
    texto:
      "Quando o registro serve só para cadastrar a empresa ou atualizar a data " +
      "dos documentos dela, sem visita a campo, agora dá para concluí-lo como " +
      "renovação. Ele fica salvo como sempre — na lista, com o selo " +
      "“Renovação”, e na ficha da empresa —, mas não entra nos gráficos de " +
      "inspeções por mês, na contagem por técnico nem na produtividade. Também " +
      "dá para já começar assim, pelo cartão “Renovação de documento” em Nova " +
      "Inspeção.",
    onde:
      "Inspeções › abrir uma inspeção › Concluir como renovação (ou, se já " +
      "estiver concluída, Marcar como renovação)",
    impacto:
      "Marcou errado? Na própria inspeção, “Voltar a contar como inspeção” " +
      "desfaz. As inspeções já concluídas antes de hoje não foram alteradas.",
    versoes: ["0.3.648", "0.3.649"],
  },
  {
    id: "aet-observacao-ia-sem-numero",
    data: "2026-09-22",
    tipo: "melhoria",
    titulo: "A observação gerada por IA no AET não repete mais o número da média",
    texto:
      "No AET, ao gerar a observação de um fator psicossocial, o texto vinha " +
      "com a média escrita por extenso (“apresentou média de 2,00…”). Como o " +
      "laudo recalcula a média das respostas toda vez que é aberto, bastava " +
      "corrigir uma resposta depois para o parágrafo passar a contradizer a " +
      "tabela logo acima dele. Agora a IA comenta a zona de risco em palavras " +
      "e deixa o número para a tabela.",
    onde: "AET › Psicossocial e Setores › botão de gerar observação",
    impacto:
      "As observações já escritas não mudam — são seu texto. Se alguma citar " +
      "um número antigo, basta gerar de novo ou apagar o trecho.",
    versoes: ["0.3.647"],
  },
  {
    id: "aet-fator-psi-sem-resposta",
    data: "2026-09-22",
    tipo: "correcao",
    titulo: "No laudo do AET, fator sem resposta agora sai como “—”",
    texto:
      "No quadro geral dos fatores psicossociais, um fator que ninguém " +
      "respondeu ainda mostrava a última média salva, com tarja de zona e " +
      "Nível PGR — mesmo sem nenhuma resposta por trás. E como esse quadro " +
      "apresenta o pior caso entre os setores, esse número podia puxar o " +
      "laudo inteiro para um nível mais grave do que o real. Agora ele sai " +
      "como “—”, igual à tabela por setor logo acima, que já fazia isso.",
    onde: "AET › Laudo › Avaliação dos Fatores Psicossociais",
    impacto:
      "Nenhum laudo em uso muda: conferimos os 11 da base e só um rascunho de " +
      "teste era afetado. Documento já assinado não é alterado.",
    versoes: ["0.3.645"],
  },
  {
    id: "qap-menu-configuracao-sumido",
    data: "2026-09-22",
    tipo: "correcao",
    titulo: "O menu de Configuração da QAP não aparecia",
    texto:
      "Na área de Questionários Psicossociais, o bloco \"Configuração\" " +
      "(Tipos e Perguntas, Metodologia, Texto Padrão) não chegava a aparecer " +
      "na barra lateral: o menu era montado antes de o painel saber quem " +
      "estava logado e não era refeito depois. Só dava para chegar nessas " +
      "três telas digitando o endereço.",
    onde: "Questionários Psicossociais › barra lateral",
    impacto: "Nada muda no que já estava salvo. É só o menu voltando a aparecer.",
    versoes: ["0.3.638"],
  },
  {
    id: "qap-capa-metodologia-sem-plano-acao",
    data: "2026-09-22",
    tipo: "novidade",
    titulo: "O laudo da QAP ganhou capa e metodologia, e o plano de ação saiu",
    texto:
      "O laudo dos Questionários Psicossociais nascia sem capa e sem texto " +
      "nenhum de abertura. Agora ele abre com a mesma capa do DRPS (empresa, " +
      "CNPJ e data de elaboração impressos por cima da arte) e traz um " +
      "capítulo de Metodologia. Os dois são editáveis em Texto Padrão " +
      "(laudo) — o texto da Metodologia veio do DRPS e precisa ser reescrito " +
      "para a QAP. Existe também um capítulo \"Resumo\", ainda desligado, " +
      "esperando alguém escrever. O Plano de Ação 5W2H deixou de fazer parte " +
      "da QAP: saiu do laudo, do menu e dos alertas.",
    onde: "Questionários Psicossociais › Laudo / Imprimir e Configuração › Texto Padrão (laudo)",
    impacto:
      "Nenhum laudo já assinado muda — PDF congelado não recebe alteração de " +
      "modelo. As aplicações em aberto passam a sair com capa na próxima " +
      "geração. Quem precisar do plano de ação de volta, fale com o suporte " +
      "de TI: é um clique em Texto Padrão para o laudo.",
    versoes: ["0.3.637"],
  },
  {
    id: "permissoes-por-funcao",
    data: "2026-09-18",
    tipo: "novidade",
    titulo: "Cada conta passa a ter uma função, e o painel mostra só os módulos dela",
    texto:
      "As 58 contas foram classificadas em 10 funções (técnico de campo, " +
      "administrativo, psicossocial, supervisão, engenharia, gerência, TI, RH, " +
      "comercial). A tela de Módulos passa a mostrar os módulos da sua função " +
      "mais os que você já usava de fato — o que nunca foi aberto some. " +
      "Supervisores e psicólogos deixam de precisar do perfil Admin: reabrir " +
      "elaboração, trocar o técnico responsável e configurar o módulo agora " +
      "vêm do nível Aprovação.",
    onde: "Módulos (o hub) e a barra lateral de cada módulo",
    impacto:
      "Se um módulo que você usa sumiu, fale com o suporte de TI: liberar de " +
      "volta é um clique em Usuários. Nenhum documento foi alterado.",
    versoes: ["0.3.619"],
  },
  {
    id: "equipamentos-card-com-quem-esta",
    data: "2026-09-17",
    tipo: "melhoria",
    titulo: "O card de cada equipamento diz com quem ele está",
    texto:
      "Na lista de Equipamentos JCN Consultoria, cada card ganhou uma linha com o nome de " +
      "quem está com o item: quem retirou pelo termo, com a data, ou o responsável " +
      "digitado no cadastro. A busca também acha pelo nome da pessoa.",
    onde: "Equipamentos JCN Consultoria",
    impacto: "Item sem ninguém não mostra a linha — está na base.",
    versoes: ["0.3.618"],
  },
  {
    id: "presenca-relatorio-trilha-encerrar",
    data: "2026-09-16",
    tipo: "melhoria",
    titulo: "Presença ganha o relatório de uso mensal, a trilha da Auditoria e o botão de encerrar sessão",
    texto:
      "No topo da tela Presença, um gráfico com as horas ativas no painel por dia " +
      "ou por semana — da equipe inteira, ou de uma pessoa ao clicar nela. No " +
      "detalhe de cada dia, os 2 últimos registros da Auditoria (o que a pessoa " +
      "criou, editou ou excluiu) com atalho para ver tudo. E um botão para o " +
      "administrador encerrar a sessão de alguém: a pessoa é deslogada em até " +
      "1 minuto e vê o aviso na tela de login.",
    onde: "Módulos › Presença no painel (só administradores)",
    impacto:
      "Nada muda para quem usa o painel no dia a dia. O registro de presença " +
      "passa a ser guardado por 6 meses. Encerrar a sessão não impede a pessoa " +
      "de entrar de novo — para isso existe o desativar em Usuários.",
    versoes: ["0.3.607"],
  },
  {
    id: "presenca-no-painel",
    data: "2026-09-16",
    tipo: "novidade",
    titulo: "O painel passa a registrar quando você entra e enquanto está mexendo nele",
    texto:
      "Enquanto o painel está aberto e você usa o mouse ou o teclado, ele anota " +
      "que você está ativo — em blocos de 5 minutos, sem gravar o que você fez " +
      "(isso é a Auditoria). Aba parada não conta. Com isso o administrador vê, " +
      "no cartão Presença no painel da tela Módulos, quem entrou, a que horas " +
      "parou de mexer e quanto tempo ficou ativo no painel em cada dia.",
    onde: "Módulos › Presença no painel (só administradores)",
    impacto:
      "Você não precisa fazer nada. O registro mede atividade no painel, não " +
      "trabalho: quem está em campo com o app sem internet não aparece, e isso " +
      "não é falta. Só administradores veem os registros; ninguém edita.",
    versoes: ["0.3.604", "0.3.606"],
  },
  {
    id: "inspecoes-por-dia-util-por-unidade",
    data: "2026-09-16",
    tipo: "novidade",
    titulo: "Controle Mensal mostra quantas inspeções cada técnico faz por dia útil, por unidade",
    texto:
      "Um quadro novo, abaixo da tabela do mês, medido nas inspeções do painel: " +
      "as visitas do mês de cada unidade divididas pela equipe de campo cadastrada " +
      "em Unidades e Equipe e pelos dias úteis do mês (segunda a sexta, menos os " +
      "feriados e pontos facultativos da Escala de Supervisores). Ao lado, quantos " +
      "dias alguém saiu a campo e quantas visitas rendem esses dias. Unidade que " +
      "compartilha equipe aparece junto com a dona; cópia e revisão de inspeção " +
      "não contam como visita.",
    onde: "Produtividade › Controle Mensal",
    impacto:
      "Nada muda no que você digita. Se aparecer um aviso na linha, é porque mais " +
      "pessoas fizeram inspeção do que há técnicos cadastrados na unidade — " +
      "cadastrar a equipe corrige o número. Feriados municipais ainda não estão " +
      "cadastrados na Escala; até lá, os dias úteis descontam só os nacionais e " +
      "estaduais.",
    versoes: ["0.3.603"],
  },
  {
    id: "documentos-por-associado-so-o-total",
    data: "2026-09-15",
    tipo: "melhoria",
    titulo: "Documentos por Associado mostra um número só — e o dashboard bate com a tela",
    texto:
      "O donut do dashboard contava documentos entregues, somando todos os meses; " +
      "a tela Por Associado abria no mês corrente e também contava entregues, com " +
      "um balão de quatro números (entregues, está elaborando, voltou para a fila, " +
      "passou pelas mãos dela). Agora os dois mostram a mesma coisa, no mesmo " +
      "recorte: quantos documentos cada pessoa foi associada no mês corrente. A " +
      "barra, o número no fim dela e o balão do mouse são esse total. O gráfico " +
      "mensal passou a contar os documentos que ganharam associado em cada mês.",
    onde: "Dashboard › Documentos por Associado e Documentos Associados por Mês",
    impacto:
      "A regra de quem conta continua a mesma: o documento é de quem está com ele " +
      "agora. Quem quiser o acumulado de todos os meses tem o botão na tela.",
    versoes: ["0.3.601"],
  },
  {
    id: "inspecoes-mes-so-concluidas",
    data: "2026-09-15",
    tipo: "melhoria",
    titulo: "Inspeções por Mês passa a contar só as concluídas — e bate com o detalhe",
    texto:
      "O cartão do dashboard contava as visitas feitas no mês e o botão Ver " +
      "detalhe contava as inspeções finalizadas no mês — dois números certos para " +
      "duas perguntas diferentes, mas lado a lado pareciam um erro (agosto: 140 " +
      "num, 153 no outro). Agora os dois contam a mesma coisa: quantas inspeções " +
      "foram concluídas em cada mês. O balão do mouse mostra só esse número, no " +
      "cartão e na tela de detalhe. O mini-gráfico Inspeções por mês da tela " +
      "Início, que ainda contava as visitas, passou a mostrar o mesmo número.",
    onde: "Dashboard › Inspeções por Mês e Inspeções Concluídas; Início › Inspeções por mês",
    impacto:
      "Meses anteriores a agosto de 2026 aparecem menores: o painel só passou a " +
      "registrar o momento da conclusão em 04/08, e o que veio antes tem data " +
      "estimada. A linha de apoio do cartão avisa enquanto isso estiver na janela.",
    versoes: ["0.3.600", "0.3.602"],
  },
  {
    id: "dashboard-eixo-cortado-e-total-sumido",
    data: "2026-09-15",
    tipo: "correcao",
    titulo: "Números cortados no eixo dos gráficos e total que faltava por pessoa",
    texto:
      "Nos gráficos de barras do dashboard os números da escala da esquerda " +
      "apareciam pela metade. E em Inspeções Concluídas › Por pessoa o total no " +
      "fim da barra só aparecia para quem tinha cópia ou revisão no mês — os " +
      "outros ficavam sem número.",
    onde: "Dashboard e as telas de detalhe dele",
    impacto: "Só a aparência mudou — os números são os mesmos.",
    versoes: ["0.3.600"],
  },
  {
    id: "aet-plano-de-acao-para-o-pgr",
    data: "2026-09-11",
    tipo: "novidade",
    titulo: "As ações do AET agora vão para o Plano de Ação do PGR",
    texto:
      "Na tela Plano de Ação do laudo AET apareceu o botão Enviar para o Plano de " +
      "Ação do PGR. Ele copia as ações do laudo para o plano de ação central da " +
      "empresa — o mesmo que alimenta o PGR e o Portal do Cliente — como a " +
      "Apreciação NR-12 e a Inspeção já faziam. Canceladas não vão, e o que já " +
      "foi enviado não duplica: cada ação ganha a marca PGR na lista. Prazos " +
      "escritos como \"30 dias\" viram data contada do dia do envio; os outros " +
      "(\"imediato\", \"na próxima parada\") ficam registrados nas observações. " +
      "O laudo impresso também ganhou a frase de abertura do capítulo, citando " +
      "a NR-17, item 17.3.6, alínea \"b\".",
    onde: "AET › abrir um laudo › Plano de Ação",
    impacto:
      "A partir do envio as cópias vivem separadas: mudar a ação no AET não muda " +
      "a que está no plano do PGR, e vice-versa.",
    versoes: ["0.3.582"],
  },
  {
    id: "aet-plano-de-acao",
    data: "2026-09-11",
    tipo: "novidade",
    titulo: "O laudo AET ganhou Plano de Ação (5W2H)",
    texto:
      "Dentro de cada laudo AET agora existe a tela Plano de Ação: uma linha por " +
      "ação, com o quê, por quê, onde, quem, quando, como e quanto, mais " +
      "prioridade e situação. As ações ficam agrupadas pelos setores do laudo, e " +
      "as recomendações que você escreveu em cada setor ficam à mão como " +
      "referência. O botão Gerar com IA rascunha os campos vazios a partir dessa " +
      "recomendação — revise antes de usar. O prazo é texto livre, como na " +
      "Investigação de Acidente: \"imediato\", \"na próxima parada\", \"30 dias\".",
    onde: "AET › abrir um laudo › Plano de Ação",
    impacto:
      "O plano entra no laudo impresso como o capítulo \"Plano de Ação (5W2H)\", " +
      "só quando tem pelo menos uma ação — laudos sem ação saem exatamente como " +
      "antes. Posição e título do capítulo se ajustam em AET › Texto Padrão.",
    versoes: ["0.3.581"],
  },
  {
    id: "balao-grafico-desenho-unico",
    data: "2026-09-08",
    tipo: "melhoria",
    titulo: "O balão dos gráficos ficou legível",
    texto:
      "Ao parar o mouse num gráfico, o balão vinha escrito \": 16 documentos\", " +
      "com esses dois pontos soltos na frente e sem dizer do que era o número. " +
      "Agora ele mostra o mês em cima e, embaixo, uma linha por medida: uma " +
      "bolinha da cor da barra, o nome da medida e o número. É o mesmo desenho " +
      "em todos os gráficos do dashboard e das telas de detalhe.",
    onde: "Dashboard e as telas de detalhe dele",
    impacto: "Só a aparência mudou — os números são os mesmos.",
    versoes: ["0.3.572"],
  },
  {
    id: "inspecoes-mes-concluidas-e-em-aberto",
    data: "2026-09-08",
    tipo: "melhoria",
    titulo: "O gráfico de Inspeções por Mês mostra o que ficou em aberto",
    texto:
      "O cartão tinha duas barras que pareciam comparáveis e não eram: uma " +
      "contava pela data da visita e a outra pela data em que a inspeção foi " +
      "finalizada, então uma visita de maio fechada em agosto aparecia nas duas, " +
      "em meses diferentes. Agora a barra é uma só e responde direto: das visitas " +
      "feitas naquele mês, quantas já foram concluídas e quantas ainda estão em " +
      "aberto — rascunho ou em andamento.",
    onde: "Dashboard › Inspeções por Mês",
    impacto:
      "A leitura antiga não se perdeu: quantas inspeções foram finalizadas em cada " +
      "mês é o que a tela Inspeções Concluídas mostra, no botão Ver detalhe ao lado.",
    versoes: ["0.3.571"],
  },
  {
    id: "graficos-balao-numero-ilegivel",
    data: "2026-09-08",
    tipo: "correcao",
    titulo: "Números que sumiam no balão dos gráficos",
    texto:
      "Ao parar o mouse num gráfico do dashboard, algumas linhas do balão vinham " +
      "quase apagadas: o painel pintava o texto com a mesma cor da barra, e barra " +
      "clara some no fundo branco. No modo noturno era o nome do mês que sumia, " +
      "preto sobre o fundo escuro. Agora o texto do balão e os números na ponta " +
      "das barras acompanham o tema.",
    onde: "Dashboard e as telas de detalhe dele",
    impacto: "Só a cor mudou — os números são os mesmos.",
    versoes: ["0.3.571"],
  },
  {
    id: "documentos-mes-so-entregues",
    data: "2026-09-08",
    tipo: "melhoria",
    titulo: "No gráfico por mês, o balão mostra só o que foi entregue",
    texto:
      "Em Documentos por Associado, parar o mouse num mês abria quatro números " +
      "— entregues, em elaboração, sem dono e o total pego no mês — e era fácil " +
      "ler o total como se fosse produção. Agora o balão traz um número só: " +
      "quantos documentos daquele mês já foram entregues, que é o que a barra desenha.",
    onde: "Dashboard › Documentos por Associado › Por mês",
    impacto:
      "O que ainda está em elaboração não sumiu: continua no balão por pessoa, " +
      "logo abaixo, e no aviso cinza do recorte.",
    versoes: ["0.3.570"],
  },
  {
    id: "qps-participacao-e-unidade-cliente",
    data: "2026-09-04",
    tipo: "novidade",
    titulo: "Os questionários passaram a mostrar a taxa de participação",
    texto:
      "A Nova aplicação agora pergunta duas coisas: quantos trabalhadores " +
      "deveriam responder e qual a filial do cliente. Com o primeiro, o Resumo " +
      "calcula sozinho a taxa de participação — antes dava para ver quantos " +
      "responderam, mas não se isso era muito ou pouco. O segundo resolve o caso " +
      "de uma mesma empresa com várias lojas, que até agora só dava para " +
      "diferenciar escrevendo no título da aplicação.",
    onde: "Questionários Psicossociais › Nova aplicação e Resumo",
    impacto:
      "As aplicações que já existem continuam funcionando. Para elas aparecerem na " +
      "taxa, basta preencher os trabalhadores previstos na tela da aplicação, no lápis.",
    versoes: ["0.3.569"],
  },
  {
    id: "noturno-texto-ilegivel",
    data: "2026-09-03",
    tipo: "correcao",
    titulo: "Textos que sumiam no modo noturno",
    texto:
      "No escuro, alguns textos apareciam quase pretos sobre o fundo preto e " +
      "não dava para ler: o título da tela de laudos AET, a fundamentação da " +
      "insalubridade nos Químicos, os blocos coloridos do Relatório de " +
      "Conformidade e da Apreciação de Máquinas, e o texto da Ajuda do " +
      "Inventário. Agora todos clareiam junto com o tema.",
    onde: "Qualquer tela, com o modo noturno ligado",
    impacto: "Os PDFs e a impressão não mudam — eles sempre saem no tema claro.",
    versoes: ["0.3.566"],
  },
  {
    id: "menu-lateral-nao-some",
    data: "2026-09-03",
    tipo: "correcao",
    titulo: "O menu lateral parou de sumir",
    texto:
      "Em três lugares. Na Visão geral, rolar a página deixava uma faixa verde " +
      "vazia, porque o menu subia junto e saía da tela; agora ele fica parado. " +
      "Nessa mesma tela, no celular, não havia menu nenhum — apareceu o botão de " +
      "três risquinhos no canto, e com ele o Sair, que não dava para alcançar " +
      "pelo telefone. E na Gestão JCN Consultoria o menu sumia por completo em janelas " +
      "de tamanho médio, levando junto Espaços, pastas e a Caixa de entrada.",
    onde: "Visão geral e Gestão JCN Consultoria",
    versoes: ["0.3.565"],
  },
  {
    id: "voltar-tem-destino",
    data: "2026-09-03",
    tipo: "correcao",
    titulo: "O botão Voltar deixou de ficar parado",
    texto:
      "Quem abria uma tela por link, favorito ou aba nova não tinha para onde " +
      "voltar, e o botão simplesmente não fazia nada. Agora ele leva para a " +
      "tela inicial do próprio módulo — e, estando já nela, para os Módulos.",
    onde: "Menu lateral, em qualquer módulo",
    versoes: ["0.3.565"],
  },
  {
    id: "validades-em-lotes",
    data: "2026-09-03",
    tipo: "melhoria",
    titulo: "A tela de Validades abre sem travar",
    texto:
      "Ela desenhava os mais de mil laudos de uma vez e o navegador engasgava " +
      "ao rolar. Passa a mostrar 100 por vez, com um botão Mostrar mais no pé " +
      "da lista.",
    onde: "Validades de Documentos",
    impacto:
      "A busca por empresa e os filtros de tipo e de status continuam " +
      "procurando na lista inteira, e não só no que está à vista. O que muda é " +
      "o Ctrl+F do navegador, que passa a achar apenas as linhas já mostradas.",
    versoes: ["0.3.565"],
  },
  {
    id: "quadro-colunas-sem-tampao",
    data: "2026-09-03",
    tipo: "melhoria",
    titulo: "As colunas do quadro não carregam mais um tampão de vazio",
    texto:
      "Cada coluna tinha uma altura mínima fixa e ficava com um bloco de " +
      "espaço em branco embaixo dos cartões — quanto menor a janela, maior o " +
      "bloco. Agora a coluna acompanha o que tem dentro dela.",
    onde: "Gestão JCN Consultoria › Quadro",
    versoes: ["0.3.565"],
  },
  {
    id: "impressao-sem-deslocamento",
    data: "2026-09-03",
    tipo: "correcao",
    titulo: "A impressão parou de sair deslocada",
    texto:
      "Em sete telas o menu lateral desaparecia no papel, mas o espaço dele " +
      "ficava, empurrando o conteúdo para a direita. Vale para Escala, Frota, " +
      "EPI, Equipamentos, Inventário de Máquinas, Gestão Gerencial e as telas " +
      "de Sistema.",
    onde: "Ao imprimir ou gerar PDF dessas telas",
    versoes: ["0.3.565"],
  },
  {
    id: "registro-profissional-automatico",
    data: "2026-09-02",
    tipo: "atencao",
    titulo: "O registro profissional entra sozinho nos laudos",
    texto:
      "Ao escolher o profissional numa análise AEP ou AET, o registro (MTE, " +
      "CREA) passa a vir preenchido junto com o nome e o cargo. Antes só o " +
      "título vinha e o registro ficava por sua conta — em análise nova e " +
      "também na tela de dados.",
    onde: "AEP e AET › dados do profissional",
    impacto:
      "Em documento já criado com o campo em branco, o painel SUGERE o " +
      "registro do profissional. Ele só é gravado se você salvar, nunca por " +
      "cima do que já estiver preenchido, e só quando o nome bate exatamente " +
      "com o do cadastro. Confira antes de salvar laudo antigo.",
    versoes: ["0.3.562"],
  },
  {
    id: "modal-cursor-nao-pula-mais",
    data: "2026-09-02",
    tipo: "correcao",
    titulo: "O cursor não pula mais para o primeiro campo",
    texto:
      "Em qualquer janela de cadastro do painel, digitar no segundo campo " +
      "aceitava só uma letra e jogava o cursor de volta para o primeiro. " +
      "Acontecia em todas as janelas, não só nas novas — dava para contornar " +
      "digitando um campo por vez e clicando de novo. Agora o cursor fica " +
      "onde você o colocou.",
    onde: "Qualquer janela de cadastro",
    versoes: ["0.3.563"],
  },
  {
    id: "modo-noturno-lista-de-opcoes",
    data: "2026-09-02",
    tipo: "correcao",
    titulo: "As listas de opção voltaram a aparecer no modo noturno",
    texto:
      "No modo noturno, abrir uma caixa de seleção mostrava uma lista em " +
      "branco: as opções estavam lá, mas escritas em branco sobre branco. " +
      "Valia para as caixas de seleção do painel inteiro.",
    onde: "Modo noturno, em qualquer tela",
    versoes: ["0.3.563"],
  },
  {
    id: "escala-supervisores",
    data: "2026-09-01",
    tipo: "novidade",
    titulo: "A escala dos supervisores saiu da planilha",
    texto:
      "Dá para montar o padrão de cada semana uma vez e o mês inteiro nasce " +
      "pronto a partir dele — e o que você mudar à mão num dia específico não " +
      "é sobrescrito quando a grade é gerada de novo. Tem calendário do ano, " +
      "uma tela de conferência que aponta os furos antes de a escala valer, e " +
      "exportação em PDF e XLSX.",
    onde: "Gestão Gerencial › Escala de Supervisores",
    impacto:
      "A planilha antiga não foi importada: o cadastro começa vazio, com os " +
      "supervisores e as unidades que você lançar.",
    versoes: ["0.3.551", "0.3.552", "0.3.553", "0.3.554", "0.3.555", "0.3.556", "0.3.557", "0.3.558", "0.3.559"],
  },
  {
    id: "tela-de-atualizacoes",
    data: "2026-09-01",
    tipo: "novidade",
    titulo: "O painel agora conta o que mudou",
    texto:
      "Toda vez que o painel receber uma mudança que você percebe — tela nova, " +
      "campo novo, algo que mudou de lugar ou um erro corrigido — ela aparece " +
      "aqui assim que você entrar. Depois de fechar, a lista completa continua " +
      "disponível na Ajuda de qualquer módulo, na aba Atualizações.",
    onde: "Ajuda › Atualizações",
    impacto:
      "Nada muda no seu trabalho. O aviso só aparece quando existe coisa nova, " +
      "e some depois que você fecha.",
    versoes: ["0.3.560", "0.3.561", "0.3.564"],
    destaque: true,
  },
];

/**
 * O trabalho invisível, agrupado por mês. Sem detalhe e sem versão: quem lê
 * isto não ganha nada sabendo qual índice foi criado. Serve para que um mês
 * inteiro de base não pareça um mês parado.
 *
 * Só entra aqui o que NÃO cabe no catálogo: migration, refactor, ajuste de
 * infra, correção de bug que nunca chegou a produção.
 */
export const MELHORIAS_INTERNAS: MelhoriasInternas[] = [];
