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
    id: "documento-apontamento-tempo",
    data: "2026-10-30",
    tipo: "novidade",
    titulo: "Documento: controle do tempo trabalhado (Iniciar, Pausar, Retomar)",
    texto:
      "O Iniciar do documento agora conta o tempo de trabalho de cada associado. Iniciar ou Retomar abre o documento com o " +
      "cronômetro correndo, e Pausar pede o motivo: pausa, aguardando cliente, aguardando informação do técnico, outra " +
      "prioridade ou fim do expediente. Com 30 minutos sem atividade, a sessão pausa sozinha. O tempo \"aguardando cliente\" " +
      "aparece à parte e não entra no tempo trabalhado. Minhas inspeções mostra o trabalhado de cada documento e o total de " +
      "hoje; o card Documento (SGG) mostra o tempo de cada pessoa. O associado abre o documento com o tempo contando.",
    onde: "Minhas inspeções (aba Como associado) e o relatório da inspeção",
    impacto: "Supervisores e administradores abrem o documento direto. Documento entregue abre para leitura.",
    versoes: ["0.3.182"],
  },
  {
    id: "inspecoes-acoes-supervisor-iniciar",
    data: "2026-10-30",
    tipo: "melhoria",
    titulo: "Inspeções: ações só para supervisores; associado abre o documento depois de Iniciar",
    texto:
      "Na lista de Inspeções, a coluna Ações (Editar, Relatório e Excluir) e a troca de prioridade e complexidade ficam só " +
      "para supervisores e administradores. Técnicos e associados consultam a lista e trabalham pela tela Minhas inspeções. " +
      "O associado só abre o documento (relatório e Versão PGR) depois de apertar Iniciar: em Minhas inspeções o botão " +
      "Abrir documento aparece depois do Iniciar, e quem chega ao documento por outro caminho vê o aviso com o botão Iniciar. " +
      "O botão Nova Inspeção fica nas duas telas, Inspeções e Minhas inspeções, para quem pode criar inspeção.",
    onde: "Inspeções e Minhas inspeções",
    impacto: "Supervisores e administradores continuam com tudo como antes.",
    versoes: ["0.3.180", "0.3.181"],
  },
  {
    id: "inspecoes-acoes-fixas",
    data: "2026-10-30",
    tipo: "melhoria",
    titulo: "Inspeções: botões de ação sempre à vista na lista",
    texto:
      "Na lista de Inspeções, a coluna Ações (Editar, Relatório e Excluir) agora fica presa à direita. Com nome de empresa " +
      "longo, zoom no navegador ou tela menor, a tabela rola de lado e os botões continuam à vista. As colunas ficaram um " +
      "pouco mais próximas, e a tabela cabe sem rolagem em mais telas.",
    onde: "Inspeções",
    versoes: ["0.3.179"],
  },
  {
    id: "conciliacao-pdf-revisao",
    data: "2026-10-29",
    tipo: "melhoria",
    titulo: "Conciliação DRPS/QPS × AEP: PDF para o PGR e avisos de revisão",
    texto:
      "Cada conciliação fechada tem agora o seu PDF, para anexar ao PGR: documentos comparados, método, resumo, os pareceres " +
      "setor por setor e as ações do Plano de Ação com responsável, prazo e situação. A página também avisa quando é hora de " +
      "revisar: documento com 2 anos ou mais (NR-01, 1.5.4.4.6), AEP e questionário com 1 ano ou mais de diferença, e documento " +
      "mais recente que os do último fechamento. Na lista, a coluna Revisão e o filtro Precisa revisar.",
    onde: "Consolidação › Conciliação DRPS/QPS × AEP (botão PDF em Conciliações fechadas)",
    impacto: "Só leitura: o PDF sai da foto gravada no fechamento. Nada muda na AEP, no DRPS ou no QPS.",
    versoes: ["0.3.178"],
  },
  {
    id: "conciliacao-parecer-nr01-nr17",
    data: "2026-10-29",
    tipo: "melhoria",
    titulo: "Conciliação DRPS/QPS × AEP: parecer, ação no plano e histórico (NR-01 e NR-17)",
    texto:
      "Cada divergência entre o questionário e a AEP agora recebe um parecer: Confirmar no inventário do PGR, Aprofundar com AET " +
      "ou Descartar com justificativa, e Confirmar ou AET podem criar a ação 5W2H no Plano de Ação. A tabela abre pelo que mais " +
      "pede atenção, mostra quantos responderam frente aos expostos do setor (com aviso de baixa representatividade) e indica quando " +
      "a divergência sugere AET (NR-17). Setores escritos de outro jeito podem ser ligados na própria página, com sugestão de pares " +
      "parecidos. Fechar a conciliação guarda uma foto com documentos, régua, resultados e pareceres, que fica no histórico. Na lista, " +
      "as colunas Pareceres e Fechada em e o filtro Falta parecer ou ação.",
    onde: "Consolidação › Conciliação DRPS/QPS × AEP",
    impacto: "Qualquer pessoa que edita a empresa dá parecer, liga setores e fecha a conciliação. Nada muda na AEP, no DRPS ou no QPS.",
    versoes: ["0.3.176", "0.3.177"],
  },
  {
    id: "conciliacao-drps-qps-aep",
    data: "2026-10-29",
    tipo: "novidade",
    titulo: "Consolidação: Conciliação DRPS/QPS × AEP",
    texto:
      "Nova página no módulo Consolidação, abaixo de Por empresa. Ela lista as empresas com AEP ou questionário concluído e " +
      "compara, setor por setor e fator por fator, o que o DRPS e o QPS (a percepção de quem trabalha) apontam com o que a AEP " +
      "(a observação do técnico) viu. Cada cruzamento sai como Convergente, Nível divergente, Só questionário, Só AEP ou Sem " +
      "indicação, com DRPS e QPS em colunas separadas. A página abre nas divergências e mostra os setores que aparecem numa fonte só.",
    onde: "Consolidação › Conciliação DRPS/QPS × AEP",
    versoes: ["0.3.174", "0.3.175"],
  },
  {
    id: "dashboard-revisao-colaborador",
    data: "2026-10-28",
    tipo: "melhoria",
    titulo: "Dashboard: números por unidade e a situação de cada colaborador",
    texto:
      "A tela principal do Dashboard agora tem o filtro de Unidade, como as telas de detalhe, e todos os cartões seguem a unidade escolhida. " +
      "O novo quadro Situação por colaborador mostra, para cada pessoa, o que está aberto em campo, o que está parado há mais de 30 dias, " +
      "os documentos não iniciados e em elaboração, o que foi entregue no mês, os itens críticos e os prazos vencidos. " +
      "Em Documentos por Situação há a fatia Aguardando campo, para o documento cuja inspeção ainda não terminou. " +
      "A Atividade recente mostra as inspeções alteradas por último, com o técnico de campo e os associados do documento. " +
      "Os cartões de KPI abrem a lista de Inspeções já filtrada, e o botão Atualizar recarrega a tela inteira.",
    onde: "Painel › Dashboard",
    impacto:
      "Os números da tela principal passam a ser da unidade ativa (como no detalhe). O aviso de Em Andamento só aparece quando há inspeção parada há mais de 30 dias.",
    versoes: ["0.3.173"],
  },
  {
    id: "documento-atribuido-x-em-elaboracao",
    data: "2026-10-28",
    tipo: "melhoria",
    titulo: "Documento: \"Atribuído\" separado de \"Em elaboração\"",
    texto:
      "Ter um associado no documento não quer dizer que o trabalho começou. Agora o documento com associado aparece como " +
      "Atribuído (não iniciado) e só passa para Em elaboração quando o associado clica em Iniciar elaboração ou faz a primeira " +
      "edição no documento, com a inspeção já concluída em campo. Fica registrado quando e por quem o trabalho começou. Em Minhas " +
      "inspeções › Como associado há o botão Iniciar, o filtro Documento e há quantos dias cada documento espera para começar.",
    onde: "Painel › Inspeções · Minhas inspeções · Dashboard › Documentos por Situação",
    impacto: "Os documentos com associado que ninguém começou deixam de contar como Em elaboração e passam para Atribuídos.",
    versoes: ["0.3.172"],
  },
  {
    id: "gestao-acessos-no-menu",
    data: "2026-10-28",
    tipo: "melhoria",
    titulo: "Gestão: Membros e acessos agora fica no menu lateral",
    texto:
      "O botão Membros e acessos saiu da barra de cima da lista e foi para o menu lateral da Gestão, logo abaixo de " +
      "Colaboradores. Ele abre a mesma tela de antes. O Compartilhar de cada lista continua na barra.",
    onde: "Gestão › menu lateral › Membros e acessos",
    versoes: ["0.3.168"],
  },
  {
    id: "inspecoes-visoes-complexidade",
    data: "2026-10-28",
    tipo: "melhoria",
    titulo: "Inspeções: filtros por Técnicos ou Associados e a coluna Complexidade",
    texto:
      "A lista de Inspeções ganhou três visões: Todas, Técnicos (campo) e Associados (documento). Cada uma mostra " +
      "só os filtros que fazem sentido para ela. A busca do topo saiu: escolha a empresa no seletor. Ao lado da " +
      "Prioridade há a coluna Complexidade (Baixa, Média, Alta, Muito alta), marcada na própria linha e com filtro. " +
      "Em Minhas inspeções, os filtros ganharam títulos e a busca é pelo nome da empresa. Nas duas telas, Status, " +
      "Documento, Prioridade e Complexidade viraram listas suspensas, como o Tempo de espera; dá para marcar mais de uma opção em cada.",
    onde: "Painel › Inspeções · Painel › Minhas inspeções",
    versoes: ["0.3.166", "0.3.167", "0.3.169", "0.3.170", "0.3.171"],
  },
  {
    id: "inspecoes-minhas-e-filtros",
    data: "2026-10-28",
    tipo: "novidade",
    titulo: "Inspeções: Minhas inspeções, prioridade e filtros que não se perdem",
    texto:
      "Nova página Minhas inspeções: o técnico vê as inspeções em que foi a campo e o associado os documentos em que " +
      "está, o mais urgente primeiro, com há quantos dias cada uma espera e o prazo. A prioridade (Baixa, Média, " +
      "Urgente, Crítica) é marcada direto na lista por quem edita a inspeção, junto com um prazo; quando o prazo, a " +
      "validade do documento ou o tempo parado pedem mais, o sistema sobe a prioridade sozinho e mostra o motivo. Na " +
      "lista de Inspeções: busca por ID ou empresa, técnico e associado numa lista, \"Só as minhas\", atalhos de " +
      "período, filtros de Documento e Prioridade, e os filtros ficam no link.",
    onde: "Painel › Minhas inspeções · Painel › Inspeções",
    versoes: ["0.3.164", "0.3.165"],
  },
  {
    id: "gestao-acessos-reorganizado",
    data: "2026-10-28",
    tipo: "melhoria",
    titulo: "Gestão: dar acesso a espaços e pastas, a várias pessoas de uma vez, e ver quem acessa o quê",
    texto:
      "Membros e acessos foi reorganizado. Dá para dar acesso a um espaço ou pasta inteiros (vale também para as " +
      "listas criadas depois), escolher várias pessoas de uma vez e copiar os acessos de outra pessoa. As abas Por " +
      "pessoa e Por lista mostram o acesso que vale de fato e de onde ele vem, e o botão Compartilhar da lista abre " +
      "direto em quem acessa aquela lista. O motivo é pedido só na hora de confirmar, e a aba Histórico mostra as " +
      "alterações feitas.",
    onde: "Gestão › Membros e acessos · Gestão › lista › Compartilhar",
    versoes: ["0.3.163"],
  },
  {
    id: "gestao-niveis-claros",
    data: "2026-10-28",
    tipo: "melhoria",
    titulo: "Gestão: níveis de acesso com nomes que dizem o que a pessoa vê e faz",
    texto:
      "Em Membros e acessos, o nível agora diz o que a pessoa vê (todas as tarefas do quadro ou só as próprias) e o que " +
      "faz (só ver, ver e comentar, ou ver e editar). O antigo \"Visualizador total\" é \"Todas as tarefas · ver e " +
      "editar\" — ele sempre permitiu editar. E existem dois níveis novos: ver todas as tarefas só lendo, ou lendo e " +
      "comentando. Os acessos já dados continuam iguais.",
    onde: "Gestão › Membros e acessos",
    versoes: ["0.3.162"],
  },
  {
    id: "consolidacao-por-empresa-completa",
    data: "2026-10-27",
    tipo: "melhoria",
    titulo: "Consolidação por empresa agora faz tudo o que a de grupo faz",
    texto:
      "Em Consolidação › Por empresa, crie uma consolidação com um nome e as empresas que quiser: ela tem as mesmas " +
      "abas da de grupo — inclusive Setores, Fatores e Validação — e o relatório ao cliente em PDF. A seleção fica " +
      "salva para você voltar a ela, dá para editar as empresas depois, e nenhuma empresa muda de grupo.",
    onde: "Consolidação › Por empresa",
    versoes: ["0.3.161"],
  },
  {
    id: "consolidacao-por-empresa",
    data: "2026-10-27",
    tipo: "novidade",
    titulo: "Consolidação: consolidar várias empresas sem montar um grupo",
    texto:
      "Nova página \"Por empresa\" no menu da Consolidação: escolha as empresas na hora (dá para marcar " +
      "todas as de uma busca) e veja as mesmas análises da consolidação de grupo — Comparativo AEP, Visões, Confronto, " +
      "Harmonização e Sim/Não — com as planilhas e a apresentação. Os setores são casados pelo nome e nada fica " +
      "gravado; para validar com o cliente e gerar o PDF, use um grupo.",
    onde: "Consolidação › Por empresa",
    versoes: ["0.3.159", "0.3.160"],
  },
  {
    id: "dimensionamento-desligados-quadro",
    data: "2026-10-27",
    tipo: "correcao",
    titulo: "Dimensionamento: quem saiu da empresa não conta mais no quadro necessário",
    texto:
      "No Headcount, quem tem desligamento no mês escolhido continua na produção desse mês, mas o déficit para " +
      "eliminar o vencido agora desconta só a equipe que continua. A equipe mostra \"saiu em dd/mm\" e a tabela do " +
      "quadro necessário ganhou a coluna \"Equipe que continua\".",
    onde: "Dimensionamento › Headcount",
    versoes: ["0.3.158"],
  },
  {
    id: "gestao-criar-tarefa-etapa",
    data: "2026-10-26",
    tipo: "melhoria",
    titulo: "Gestão: criar tarefa em outro quadro escolhe a etapa e os responsáveis",
    texto:
      "Na automação que cria (ou move) tarefa em outro quadro, agora dá para escolher a etapa de destino, os " +
      "responsáveis da tarefa nova e mandar para o quadro da unidade da tarefa. Também entrou o gatilho " +
      "\"Quando a aprovação é recusada\".",
    onde: "Gestão › quadro › Automações",
    versoes: ["0.3.157"],
  },
  {
    id: "gestao-automacoes-pacote-d",
    data: "2026-10-26",
    tipo: "novidade",
    titulo: "Gestão: automações ligadas às inspeções e aos vencimentos",
    texto:
      "As automações da Gestão agora reagem ao SST: quando uma inspeção ou um documento é concluído pela primeira vez, " +
      "e quando um documento ou extintor está para vencer, uma tarefa é criada no quadro escolhido, já com empresa, " +
      "unidade, técnico e validade. Há receitas prontas para elaboração, recarga de extintor e renovação de documento.",
    onde: "Gestão › quadro › Automações (grupo SST)",
    versoes: ["0.3.156"],
  },
  {
    id: "gestao-automacoes-pacote-c",
    data: "2026-10-26",
    tipo: "novidade",
    titulo: "Gestão: receitas prontas, botão ⚡ e distribuição em rodízio",
    texto:
      "No modal de automações há receitas prontas para começar em um clique (aviso ao concluir, cobrança de tarefa " +
      "parada, e-mail na véspera do prazo, pauta semanal e outras). A nova ação distribui tarefas em rodízio ou para quem " +
      "tem menos tarefas abertas. Automações do tipo manual aparecem no botão ⚡ da tarefa e das ações em massa.",
    onde: "Gestão › quadro › Automações; tarefa › ⚡",
    versoes: ["0.3.155"],
  },
  {
    id: "gestao-automacoes-pacote-b",
    data: "2026-10-26",
    tipo: "novidade",
    titulo: "Gestão: automações por agenda, cobrança de tarefa parada e espera",
    texto:
      "As automações agora podem rodar num horário (todo dia, dias úteis, dias da semana ou dia do mês), agindo nas " +
      "tarefas do quadro ou criando uma tarefa a partir de um modelo. Também cobram tarefas paradas há N horas ou dias " +
      "(ou no mesmo status), avisam quando a data de início chega e quando as tarefas que bloqueavam outra são " +
      "concluídas. A nova ação Aguardar faz o resto da automação rodar depois de um tempo.",
    onde: "Gestão › quadro › Automações",
    versoes: ["0.3.154"],
  },
  {
    id: "gestao-automacoes-pacote-a",
    data: "2026-10-26",
    tipo: "novidade",
    titulo: "Gestão: automações com várias ações, novos gatilhos e histórico",
    texto:
      "Cada automação agora executa várias ações em sequência, e cada ação pode ter a sua própria condição. Novos " +
      "gatilhos: prioridade, campo ou etiqueta alterados, responsável adicionado e comentário. Novas ações: comentar, " +
      "enviar e-mail, definir prazo relativo (dias úteis), adicionar ou remover etiqueta, concluir e duplicar. Os textos " +
      "aceitam variáveis como {titulo}, {responsavel} e {prazo}. A aba Histórico mostra o que cada automação fez.",
    onde: "Gestão › quadro › Automações",
    versoes: ["0.3.153"],
  },
  {
    id: "dashboard-filtro-unidade",
    data: "2026-10-26",
    tipo: "melhoria",
    titulo: "Dashboard: filtro por unidade nas telas de inspeções, documentos e associados",
    texto:
      "As telas Inspeções realizadas por TST, Documentos concluídos (ADM) e Documentos associados ganharam o filtro " +
      "Unidade no topo. Ele começa na unidade ativa do sistema e vale também para a página da pessoa, aberta ao clicar " +
      "num nome.",
    onde: "Painel SST › Dashboard › Inspeções / Documentos concluídos / Documentos associados",
    versoes: ["0.3.152"],
  },
  {
    id: "dashboard-tst-primeira-conclusao",
    data: "2026-10-26",
    tipo: "novidade",
    titulo: "Dashboard: Inspeções realizadas por TST, reaberturas e a página de cada pessoa",
    texto:
      "O gráfico de inspeções passa a se chamar Inspeções realizadas por TST: cada inspeção conta para o técnico que foi a " +
      "campo, no mês em que foi concluída pela primeira vez — reabrir e concluir de novo não muda a contagem, e um aviso " +
      "mostra quem reabriu e a lista dos campos alterados. Documentos concluídos seguem a mesma regra. Documentos " +
      "associados contam empresas por pessoa em cada mês, com um gráfico acumulado. Clicar no nome de alguém abre a " +
      "relação das empresas em que a pessoa atuou.",
    onde: "Painel SST › Dashboard",
    impacto:
      "Inspeção sem técnico na aba Responsáveis conta para quem abriu; um supervisor (Admin ou nível Aprovação) escolhe o " +
      "técnico na nota que aparece na tela de inspeções. Quem reabre e se inclui na aba Responsáveis não leva o crédito: " +
      "vale quem estava lá na primeira conclusão.",
    versoes: ["0.3.149", "0.3.150", "0.3.151"],
  },
  {
    id: "usuarios-modulos-por-categoria",
    data: "2026-10-23",
    tipo: "melhoria",
    titulo: "Usuários: módulos separados por categoria e botão Marcar todos",
    texto:
      "Na janela do usuário, o Acesso aos módulos aparece nas mesmas três categorias da tela Módulos (Segurança do " +
      "Trabalho, Fatores Psicossociais e JCN Sistema Interno), com o botão Marcar todos e a opção de marcar uma " +
      "categoria inteira.",
    onde: "Sistema › Usuários › editar usuário",
    versoes: ["0.3.148"],
  },
  {
    id: "ia-limite-tente-de-novo",
    data: "2026-10-23",
    tipo: "melhoria",
    titulo: "IA: quando o limite de uso é atingido, a tela diz quanto esperar",
    texto:
      "Se muita gente usar a IA ao mesmo tempo, o serviço recusa por alguns segundos. Em vez de \"Erro ao gerar com " +
      "IA\", a tela agora mostra \"Limite de uso da IA atingido. Tente de novo em N segundos\". A análise da foto da " +
      "plaqueta (Máquinas, na inspeção) passou a tentar outros modelos quando um não está disponível.",
    onde: "Todos os botões de IA",
    versoes: ["0.3.148"],
  },
  {
    id: "gestao-meu-quadro-dono-responsavel",
    data: "2026-10-23",
    tipo: "melhoria",
    titulo: "Gestão: tarefa do Meu Quadro já nasce com você como responsável",
    texto:
      "Ao criar uma tarefa no seu Meu Quadro, você entra como responsável automaticamente (a janela da tarefa já " +
      "vem preenchida e dá para trocar). Assim a tarefa com prazo vai para a sua Google Agenda e aparece no Meu Espaço.",
    onde: "Gestão › Meu Espaço › Meu Quadro",
    impacto: "As tarefas que já estavam no Meu Quadro sem responsável receberam o dono do quadro.",
    versoes: ["0.3.146"],
  },
  {
    id: "gestao-varios-responsaveis-avisos-email",
    data: "2026-10-23",
    tipo: "novidade",
    titulo: "Gestão: vários responsáveis por tarefa e avisos também por e-mail",
    texto:
      "O botão \"+\" inclui mais de um responsável na tarefa. Quem é responsável ou seguidor recebe aviso no sino e " +
      "por e-mail quando é incluído, quando o status muda, quando há comentário e quando é mencionado com @nome. " +
      "Os membros do quadro são avisados de tarefa nova nele, e a tarefa que vence hoje também gera e-mail.",
    onde: "Módulos › Gestão JCN Consultoria",
    impacto:
      "Quem fez a ação não é avisado. Avisos antigos não geram e-mail. Os e-mails saem quando alguém abre a Gestão.",
    versoes: ["0.3.142"],
  },
  {
    id: "gestao-google-agenda-completa",
    data: "2026-10-23",
    tipo: "novidade",
    titulo: "Gestão: Google Agenda com hora, evento que vira tarefa e foto da conta",
    texto:
      "A tarefa ganha Hora de início e Hora fim e vai para a agenda com horário. Ao conectar, as tarefas abertas que " +
      "já existem vão para a agenda. O evento que você cria no Google Agenda vira tarefa no seu Meu Quadro, e os " +
      "convidados entram como responsáveis. O card Google Agenda mostra o status e tem o botão Desconectar, e a foto " +
      "da conta Google aparece no lugar das iniciais.",
    onde: "Gestão › Meu Espaço › Google Agenda",
    impacto: "Quem já estava conectado precisa reconectar uma vez para a foto aparecer.",
    versoes: ["0.3.142"],
  },
  {
    id: "gestao-acesso-por-unidade",
    data: "2026-10-23",
    tipo: "novidade",
    titulo: "Gestão: acesso por unidade",
    texto:
      "Em Usuários, o acesso à Gestão ganhou as colunas Unidades e Setores. Quem tem unidades marcadas vê, nos quadros " +
      "de setor, só as tarefas dessas unidades; continua vendo as tarefas em que é responsável, seguidor ou criador.",
    onde: "Usuários › Acesso ao módulo Gestão",
    impacto: "Ninguém tem unidade marcada: todos continuam vendo o que já viam.",
    versoes: ["0.3.142"],
  },
  {
    id: "gestao-subtarefa-janela-formulario-anexos",
    data: "2026-10-23",
    tipo: "melhoria",
    titulo: "Gestão: subtarefa abre como tarefa, formulário com anexos e novas vistas",
    texto:
      "Duplo clique na subtarefa abre a janela completa (descrição, datas, responsáveis, comentários, anexos). O " +
      "formulário público aceita fotos, vídeos e documentos (até 10 arquivos de 50 MB) e múltipla escolha em lista " +
      "fechada. O Meu Espaço ganhou a Agenda, o calendário do Meu Quadro mostra os outros quadros, e as listas têm " +
      "Mostrar/Agrupar. A recorrência cria as repetições que ficaram para trás, e uma automação incompleta não fica mais " +
      "ativa (antes, uma delas podia apagar o responsável).",
    onde: "Módulos › Gestão JCN Consultoria",
    versoes: ["0.3.142"],
  },
  {
    id: "psicossocial-consolidacao-grupo",
    data: "2026-10-22",
    tipo: "novidade",
    titulo: "Novo módulo: Consolidação Psicossocial de Grupo",
    texto:
      "Junta a AEP e o DRPS/Questionário concluídos das empresas de um grupo (Empresas › Grupos). Abas Fontes, " +
      "Setores (sugere um nome padronizado para cada setor, para o técnico confirmar) e Fatores; depois as análises: " +
      "Comparativo AEP, Visões, Confronto AEP × DRPS, Harmonização (o que cada empresa precisa incluir ou revisar) e " +
      "Sim/Não por empresa e setor. Exporta três planilhas coloridas, o relatório ao cliente em PDF e uma " +
      "apresentação em PowerPoint. A aba Validação registra a versão enviada ao cliente e a validação de cada " +
      "empresa, e gera a lista para lançar no PGR.",
    onde: "Módulos › Segurança do Trabalho › Consolidação Psicossocial de Grupo",
    impacto:
      "Ninguém tem o módulo marcado ainda: o Admin libera a caixa \"Consolidação Psicossocial de Grupo\" em Usuários. " +
      "A tela só lê a AEP e o DRPS/Questionário; registros e validações não podem ser editados nem apagados, e nada é " +
      "lançado no PGR sozinho.",
    versoes: ["0.3.141"],
  },
  {
    id: "exportar-excel-pdf-psicossocial-aep-empresa",
    data: "2026-10-22",
    tipo: "novidade",
    titulo: "Exportar Excel e PDF em Riscos Psicossociais e AEP",
    texto:
      "Na página de cada empresa, em Riscos Psicossociais e em AEP, há os botões Exportar Excel (uma linha por risco, " +
      "pronta para filtrar, com os dados da empresa numa aba própria) e Exportar PDF (a mesma tabela da tela, numa " +
      "aba nova).",
    onde: "Painel SST › Riscos Psicossociais / AEP › empresa",
    versoes: ["0.3.141"],
  },
  {
    id: "qps-aplicacao-salvar-e-responsavel",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Questionários: salvar a aplicação avisa quando não gravou, e o Responsável vira lista da equipe",
    texto:
      "Ao editar uma aplicação, se nada for gravado (por exemplo, por falta de permissão), a tela agora avisa " +
      "em vez de dizer que salvou. O Responsável passa a ser escolhido numa lista com a equipe psicossocial. " +
      "O card de detalhe deixou de vazar da tela e o lápis da Unidade voltou a funcionar.",
    onde: "Questionários Psicossociais › Aplicação",
    versoes: ["0.3.140"],
  },
  {
    id: "aet-ia-direcao-da-escala",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "AET: a IA da observação psicossocial entende que nota alta é condição boa",
    texto:
      "Na escala de 1 a 5 dos fatores psicossociais da AET, nota alta é a condição favorável (zona verde). " +
      "A IA que redige a observação passa a saber disso e não chama mais de \"baixa\" ou \"preocupante\" " +
      "uma média em zona verde.",
    onde: "AET › Psicossocial › Gerar com IA",
    versoes: ["0.3.140"],
  },
  {
    id: "aep-formulario-branco-sem-matriz-riscos",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Formulário em Branco da AEP sem a Matriz de Riscos",
    texto:
      "A seção \"Matriz de Riscos\" saiu do Formulário em Branco da AEP, como já tinha saído da tela de " +
      "Setores. As seções seguintes foram renumeradas: 4. Indicador de AET, 5. Parecer Técnico Preliminar, " +
      "6. Recomendações e 7. Considerações finais.",
    onde: "AEP › Formulário em Branco",
    impacto: "Folhas impressas antes desta versão ainda trazem a matriz; basta deixá-la em branco.",
    versoes: ["0.3.140"],
  },
  {
    id: "aep-formulario-branco-so-triagem",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Formulário em Branco da AEP: imprimir só a Triagem Ergonômica",
    texto:
      "Para levar a campo só o que vai ser marcado lá, o Formulário em Branco da AEP ganhou a opção " +
      "\"Só a Triagem (item 3)\": sai apenas a triagem física, cognitiva e organizacional (com os sinais, " +
      "o roteiro de campo e o motivo do N/I), um bloco por setor, com espaço para empresa, técnico e data. " +
      "\"Formulário completo\" continua imprimindo tudo, como antes.",
    onde: "AEP › Formulário em Branco",
    impacto: "Nada muda no que já existe; a escolha vale só para a impressão do formulário.",
    versoes: ["0.3.140"],
  },
  {
    id: "drps-alinhar-agravos-medidas",
    data: "2026-10-22",
    tipo: "novidade",
    titulo: "DRPS: botões de alinhar nos Agravos e nas Medidas",
    texto:
      "Na Análise do DRPS, os quadros Possíveis Agravos à Saúde Mental e Medidas de controle recomendadas " +
      "ganharam os mesmos 4 botões do Word que a Conclusão já tem: alinhar à esquerda, centralizar, alinhar " +
      "à direita e justificar. Um clique já salva, e o laudo, o PDF e a impressão saem com o alinhamento " +
      "escolhido. Cada setor (e cada unidade) tem o seu.",
    onde: "Psicossocial › Análise e Avaliação",
    impacto:
      "Quem não mexer continua com o texto justificado. Laudos já congelados ou assinados continuam como estão.",
    versoes: ["0.3.140"],
  },
  {
    id: "drps-agravos-medidas-justificados",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Laudo do DRPS: Agravos e Medidas saem justificados",
    texto:
      "No laudo, os Possíveis Agravos à Saúde Mental e as Medidas de Controle recomendadas agora saem " +
      "justificados, como a Conclusão. Cada item vira um parágrafo, com inicial maiúscula e ponto final, " +
      "igual ao laudo dos Questionários. Não é preciso fazer nada na hora de preencher.",
    onde: "Psicossocial › Laudo (PDF e tela)",
    impacto: "Laudos já congelados ou assinados continuam como estão até se congelar uma nova versão.",
    versoes: ["0.3.140"],
  },
  {
    id: "qps-analise-agravos-medidas-por-setor",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Questionários: agravos e medidas de cada setor voltam a aparecer e a salvar",
    texto:
      "Na Análise (régua do DRPS), os agravos e as medidas de controle de cada setor abriam vazios, mesmo " +
      "salvos — só o consolidado aparecia preenchido, e quem salvava de novo substituía o que estava gravado. " +
      "Agora cada setor abre com o que foi salvo. E o texto digitado na caixa sem apertar Enter também é " +
      "salvo ao clicar em \"Salvar agravos e medidas\".",
    onde: "Questionários Psicossociais › aplicação › Análise",
    impacto:
      "Medidas digitadas antes desta correção sem Enter não chegaram a ser salvas: confira os setores e " +
      "preencha de novo o que estiver faltando.",
    versoes: ["0.3.140"],
  },
  {
    id: "psicossocial-5w2h-folha-deitada",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Laudos psicossociais: plano de ação 5W2H na folha deitada",
    texto:
      "No PDF do DRPS e dos Questionários Psicossociais, a seção \"Plano de Ação 5W2H\" sai sempre na folha " +
      "deitada (paisagem), com as 8 colunas lado a lado. Tabelas coladas nas conclusões com 5 colunas ou " +
      "mais também vão para a folha deitada — antes só a partir de 6, e um plano de 5 colunas saía em pé com " +
      "o texto espremido. O texto em volta da tabela continua em pé.",
    onde: "DRPS › Laudo (PDF) · Questionários Psicossociais › Laudo (PDF)",
    impacto: "Basta gerar o PDF de novo. Tabelas de até 4 colunas continuam em pé.",
    versoes: ["0.3.140"],
  },
  {
    id: "aep-ia-criterio-drps-e-recomendacoes",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "IA da AEP: DRPS/Questionário pelo critério do sistema e Recomendações só com ações",
    texto:
      "O \"Gerar IA\" do Parecer e das Recomendações da AEP passa a receber pronto se o " +
      "DRPS/Questionário é recomendado — 3 ou mais alertas organizacionais na AEP ou algum fator Alto " +
      "ou Muito Alto no setor — em vez de o modelo decidir sozinho (ele chegou a recomendar DRPS com um " +
      "único fator Baixo). As Recomendações ganharam um lembrete para trazer só ações por prazo " +
      "(imediatas, preventivas, estruturais), sem repetir o diagnóstico do Parecer.",
    onde: "AEP › Setores › Gerar IA (Parecer e Recomendações)",
    impacto: "Textos já gerados não mudam; vale para os próximos cliques em Gerar IA.",
    versoes: ["0.3.140"],
  },
  {
    id: "aet-checklist-texto-unico",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "AET: as perguntas do checklist têm o mesmo texto na tela e no PDF",
    texto:
      "O PDF do AET tinha a sua própria cópia dos textos padrão do checklist, e " +
      "três deles não batiam com a tela. Agora os dois leem a mesma lista. Na " +
      "prática muda só a pontuação da pergunta do monitor; as perguntas com texto " +
      "editado na configuração continuam como estão.",
    onde: "AET › Setores, Análise e PDF",
    impacto: "Laudo já assinado não muda.",
    versoes: ["0.3.140"],
  },
  {
    id: "qap-crp-do-cadastro",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Laudo da QAP mostra o CRP do psicólogo",
    texto:
      "O CRP ao lado do Responsável Técnico, na Análise por Setor do laudo, " +
      "saía em branco na prévia. Agora ele vem sozinho do cadastro do " +
      "psicólogo, o mesmo que a assinatura usa, na prévia e no PDF. O cartão " +
      "\"CRP do responsável (laudo)\" da aplicação mostra qual número vai sair.",
    onde: "Questionários Psicossociais › Aplicação › Laudo",
    impacto:
      "O nome do Responsável precisa estar igual ao do cadastro do psicólogo. " +
      "PDF já assinado não muda: gere de novo.",
    versoes: ["0.3.140"],
  },
  {
    id: "laudo-qps-igual-ao-drps-checklist",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Laudo QPS: sumário com páginas, 11 seções e sem folha em branco",
    texto:
      "No laudo do QPS — Questionário Psicossocial, o Sumário agora mostra a página de cada seção. A capa sai " +
      "com a data da conclusão, que o sistema grava sozinho ao concluir; ao " +
      "reconcluir, ele pergunta se mantém a data antiga ou usa a de hoje. Os " +
      "setores seguem na mesma folha quando cabem, agravos e medidas saem em " +
      "parágrafos, tabela larga da conclusão vai para a folha deitada sem " +
      "partir palavra e acabou a folha em branco antes da assinatura. A tela " +
      "do Laudo lista o que ainda falta preencher.",
    onde: "Questionários Psicossociais › Aplicação › Laudo",
    impacto:
      "O Período Início/Fim da aplicação agora pode ser editado — é ele que " +
      "sai na Metodologia quando a planilha importada não trouxe a data das " +
      "respostas. Laudos já assinados não mudam.",
    versoes: ["0.3.140"],
  },
  {
    id: "questionarios-psicossociais-sigla-qps",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Questionários Psicossociais: a sigla agora é QPS",
    texto:
      "O laudo dos Questionários Psicossociais deixou de se chamar “QAP — " +
      "Questionário de Avaliação Psicossocial” e passou a ser “QPS — " +
      "Questionários Psicossociais”: na capa, no texto do laudo, no título " +
      "do PDF, no código do documento e nos textos de Gestão, Monitoramento " +
      "e Revisão. A capa também deixou de dizer “Diagnóstico de Riscos " +
      "Psicossociais”, frase herdada do DRPS.",
    onde: "Questionários Psicossociais › Laudo",
    impacto:
      "Laudos já assinados não mudam. O DRPS continua como estava.",
    versoes: ["0.3.140"],
  },
  {
    id: "qps-importacao-coluna-extra",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Importar respondentes: planilha com coluna a mais não desloca mais as respostas",
    texto:
      "Se a planilha do formulário trazia uma coluna de identificação a mais " +
      "antes do setor ou da função — como “Qual sua unidade de trabalho?” —, " +
      "o painel a lia como a primeira pergunta: todas as respostas iam para a " +
      "pergunta seguinte e a última se perdia. Agora essa coluna é lida como " +
      "dado do respondente, e o diagnóstico da importação avisa qual foi.",
    onde: "Questionários Psicossociais › Aplicação › Importar respondentes",
    impacto:
      "Nenhuma importação feita até hoje tinha essa coluna a mais; nada do que " +
      "já está gravado muda.",
    versoes: ["0.3.140"],
  },
  {
    id: "pdf-aet-aep-gestao-com-empresa",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "PDFs de AET, AEP e Gestão do DRPS passam a sair ligados à empresa",
    texto:
      "Esses três documentos eram registrados sem a empresa, e por isso não " +
      "apareciam na lista de PDFs da unidade nem na área do cliente. Os " +
      "gerados a partir de agora já saem com a empresa.",
    onde: "AET › Laudo, AEP › Laudo e Psicossocial › Gestão (botão Gerar PDF)",
    impacto:
      "Os PDFs gerados antes continuam sem a empresa; se precisar de um deles " +
      "na área do cliente, gere de novo.",
    versoes: ["0.3.140"],
  },
  {
    id: "aet-plano-paisagem-e-introducao-dos-capitulos",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "AET: Plano de Ação deitado no PDF e introdução editável nos capítulos do sistema",
    texto:
      "No PDF do AET, o capítulo Plano de Ação (5W2H) agora sai em folha deitada, " +
      "e a coluna “Quem” não quebra mais o cargo em várias linhas. O botão " +
      "Retrato/Paisagem do Texto Padrão do AET passou a valer de verdade — antes " +
      "tudo saía em pé. Os capítulos Agentes Ambientais, Análise Ergonômica, " +
      "Fatores Psicossociais e Plano de Ação ganharam um campo “Texto de " +
      "introdução”, que sai logo abaixo do título no laudo.",
    onde: "AET › Texto Padrão (o campo) e AET › Laudo › Imprimir (o PDF)",
    impacto:
      "Os demais capítulos continuam em pé, como sempre saíram. Laudo sem ações " +
      "no plano não muda nada.",
    versoes: ["0.3.140"],
  },
  {
    id: "empresas-fantasia-abaixo-do-nome",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Empresas: o nome fantasia aparece abaixo do nome",
    texto:
      "No card da empresa, nos campos de escolher empresa e na ficha, o nome fantasia aparece em letra menor " +
      "abaixo do nome quando for diferente dele. A busca de empresa também acha pelo nome fantasia.",
    onde: "Empresas e campos de escolher empresa",
    versoes: ["0.3.139"],
  },
  {
    id: "conformidade-fotos-inteiras-pdf",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Relatório de Conformidade: fotos inteiras no PDF",
    texto:
      "As fotos dos tópicos não são mais cortadas para caber na moldura. Todas saem com a mesma altura e " +
      "a largura acompanha a foto, então aparece a imagem inteira (do teto ao chão) e as fotos de cada " +
      "tópico ficam alinhadas. Vale para o PDF do cliente e para o laudo na tela.",
    onde: "Relatório de Conformidade › PDF e laudo",
    impacto: "PDFs já congelados ou assinados continuam como estão; gere de novo para pegar o novo formato.",
    versoes: ["0.3.139"],
  },
  {
    id: "conformidade-ocultar-topico-pdf",
    data: "2026-10-22",
    tipo: "novidade",
    titulo: "Relatório de Conformidade: ocultar um tópico do PDF do cliente",
    texto:
      "Cada tópico do checklist tem o botão Ocultar do PDF. O tópico continua no relatório, com fotos e " +
      "observação, mas não sai no PDF nem no laudo, e deixa de contar no resumo. O botão Mostrar no PDF " +
      "traz o tópico de volta. Funciona também com o relatório finalizado.",
    onde: "Relatório de Conformidade › tópicos do checklist",
    impacto: "Os relatórios existentes continuam com todos os tópicos no PDF até alguém ocultar.",
    versoes: ["0.3.139"],
  },
  {
    id: "conformidade-trocar-responsavel-tecnico",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Relatório de Conformidade: dá para trocar o responsável técnico",
    texto:
      "Ao lado do nome do Responsável técnico (JCN Consultoria) há um botão Trocar, no relatório e na tela do laudo. " +
      "Ele funciona também com o relatório finalizado. O novo nome vai para a folha de assinaturas e para o PDF. " +
      "Se o laudo já tiver sido congelado ou assinado, congele uma nova versão e assine de novo.",
    onde: "Relatório de Conformidade › relatório e laudo",
    impacto: "Os relatórios existentes continuam com o responsável que já tinham até alguém trocar.",
    versoes: ["0.3.139"],
  },
  {
    id: "empresas-lista-abre-rapido",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "A lista de Empresas abre mais rápido",
    texto:
      "A tela Empresas mostra os primeiros cards logo ao abrir e carrega os outros conforme você rola. " +
      "A busca e os filtros continuam procurando em todas as empresas. Nos campos de escolher empresa, " +
      "a lista mostra as 50 primeiras; para achar uma empresa que não aparece, digite parte do nome, " +
      "o CNPJ ou o CPF.",
    onde: "Empresas e campos de escolher empresa",
    impacto: "Nada muda nos cadastros.",
    versoes: ["0.3.139"],
  },
  {
    id: "empresa-card-clicavel",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Clicar no card da empresa abre a ficha",
    texto:
      "Na lista de Empresas, clicar em qualquer parte do card abre a ficha da empresa na Visão geral. " +
      "Os botões do card continuam fazendo o de sempre: Documentos abre a aba Documentos & Laudos, " +
      "o lápis edita e a lixeira exclui. Pelo teclado, o Tab chega ao card e o Enter abre a ficha.",
    onde: "Empresas › card da empresa",
    versoes: ["0.3.139"],
  },
  {
    id: "empresa-pagina-documentos",
    data: "2026-10-22",
    tipo: "novidade",
    titulo: "Todos os documentos de uma empresa num lugar só",
    texto:
      "A aba Documentos & Laudos da empresa passa a listar tudo o que a empresa tem no sistema, " +
      "do mais recente para o mais antigo: Inspeções, AEP, AET, DRPS, Questionários, Conformidade, " +
      "Não Conformidade, Análise de Químicos, Apreciação NR-12 e Investigação de Acidente — " +
      "inclusive os que ainda não têm PDF. Cada linha abre o documento e, quando existe, o PDF. " +
      "No card da empresa, o botão Inspeções virou Documentos e leva direto para essa aba; a ficha " +
      "mostra o ID da empresa com botão para copiar.",
    onde: "Empresas › card da empresa › Documentos (ou a aba Documentos & Laudos da ficha)",
    impacto:
      "Os documentos dos módulos que a sua conta não acessa não aparecem: a aba avisa quais são. " +
      "PDFs de documentos já excluídos ficam no fim da aba, recolhidos.",
    versoes: ["0.3.139"],
  },
  {
    id: "grupo-empresas-varias-matrizes",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Grupo de empresas aceita mais de uma matriz, e o campo Grupo aceita digitação",
    texto:
      "Um grupo pode ter várias empresas com CNPJ de matriz, como condomínios administrados pela " +
      "mesma imobiliária ou contabilidade. Marcar uma empresa como matriz não rebaixa mais as " +
      "outras, e cada matriz ganhou o botão Tornar filial. O campo Grupo, no cadastro e no filtro " +
      "de Empresas, aceita digitação direto no campo: clique para ver a lista ou digite para filtrar.",
    onde: "Empresas › Grupos e cadastro da empresa",
    impacto: "Nada muda nos grupos que já existem.",
    versoes: ["0.3.139"],
  },
  {
    id: "conformidade-checklist-nr24-21-itens",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Relatório de Conformidade: checklist da NR-24 com 21 perguntas",
    texto:
      "O checklist da NR-24 passou a ter as 21 perguntas do Checklist Completo de " +
      "Conformidade da equipe, em cinco grupos: instalações sanitárias, vestiários e " +
      "armários, locais para refeições, água potável e higiene/acessibilidade. Cada item " +
      "traz a fundamentação conferida com o texto vigente da norma. Onde o modelo original " +
      "divergia da NR-24 (chuveiros, lixeiras, refeições até 30 trabalhadores, " +
      "higienização), o texto segue a norma.",
    onde: "Relatório de Conformidade › Novo relatório › NR-24 · Relatório de Não Conformidade",
    impacto: "Relatórios já criados mantêm os itens antigos; a lista nova vale para os próximos.",
    versoes: ["0.3.139"],
  },
  {
    id: "empresa-troca-unidade-avisa-quem-perde-acesso",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Trocar a unidade de uma empresa agora avisa quem deixa de vê-la",
    texto:
      "Ao editar uma empresa e mudar a unidade, o sistema lista os técnicos que fizeram " +
      "inspeções nela e não têm acesso à unidade nova — para eles, a empresa e as " +
      "inspeções sumiriam da tela. O Salvar só libera depois de marcar “Entendi, trocar " +
      "a unidade mesmo assim”. Se ninguém perde acesso, nada muda.",
    onde: "Empresas › Editar empresa › Unidade",
    impacto:
      "Se o técnico precisa continuar vendo a empresa, libere a unidade nova para ele em Usuários.",
    versoes: ["0.3.139"],
  },
  {
    id: "inspecoes-pilulas-varias",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Inspeções: marque mais de uma pílula ao mesmo tempo",
    texto:
      "As pílulas da lista agora combinam. Status somam (Em Andamento + Concluídas traz as duas) e se cruzam " +
      "com Associados/Não associados (Não associados + Em Andamento traz só as em andamento sem ninguém no " +
      "documento). Embaixo aparece o que está marcado e quantas inspeções a lista tem; Todos limpa tudo.",
    onde: "Inspeções › lista",
    versoes: ["0.3.138"],
  },
  {
    id: "inspecoes-filtro-nao-associados",
    data: "2026-10-22",
    tipo: "novidade",
    titulo: "Inspeções: filtro \"Não associados\"",
    texto:
      "Ao lado de Associados entrou a pílula Não associados: um clique e a lista mostra só as inspeções sem " +
      "ninguém no documento (SGG). Os dois números somados dão o total de Todos.",
    onde: "Inspeções › lista",
    versoes: ["0.3.138"],
  },
  {
    id: "inspecoes-coluna-status-associados",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Inspeções: coluna \"Status Assoc.\" mostra se o documento foi concluído",
    texto:
      "A lista de inspeções ganhou a coluna Status Assoc., ao lado de Associados. Ela mostra a situação do " +
      "documento (SGG): Concluído, com a data da entrega; Em elaboração, com quem está nele; ou Pendente, " +
      "quando a inspeção já terminou e ninguém assumiu.",
    onde: "Inspeções › lista",
    versoes: ["0.3.138"],
  },
  {
    id: "dashboard-documentos-por-situacao-regra-lista",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Dashboard: Documentos por Situação igual à lista de Inspeções",
    texto:
      "O gráfico Documentos por Situação agora segue a mesma regra da lista de Inspeções: documento com " +
      "alguém associado conta como Assumido, mesmo que ninguém tenha clicado em \"Assumir elaboração\". " +
      "Antes ele aparecia como Pendente no gráfico e como \"Em elaboração\" na lista.",
    onde: "Dashboard › Documentos por Situação",
    impacto: "Documentos com associado que apareciam como Pendentes passam para Assumidos. Os Concluídos não mudam.",
    versoes: ["0.3.138"],
  },
  {
    id: "dashboard-documentos-adm-conta-unica",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Documentos por Mês (ADM): o card e o detalhe fazem a mesma conta",
    texto:
      "O gráfico Documentos por Mês (ADM) do dashboard e a tela Ver por ADM passam a ler os mesmos dados. " +
      "O card se atualiza logo que um documento é concluído, sem esperar alguns minutos. Documento de " +
      "inspeção excluída não conta, e o mesmo nome escrito com maiúscula, acento ou espaço diferente vira " +
      "uma barra só.",
    onde: "Dashboard › Documentos por Mês (ADM) › Ver por ADM",
    impacto: "Nada a fazer.",
    versoes: ["0.3.138"],
  },
  {
    id: "inspecoes-periodo-pela-conclusao-e-filtro-tecnico",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Lista de Inspeções e dashboard passam a dar o mesmo número",
    texto:
      "No filtro De/Até, a inspeção concluída agora entra pela data em que foi concluída " +
      "(as que ainda não foram concluídas seguem pela data da visita). Antes, uma visita de " +
      "agosto concluída em setembro não aparecia em mês nenhum. O filtro Técnico passou a " +
      "achar quem foi a campo, não só quem lançou, ignora acento (\"ledimo\" acha " +
      "\"Lédimo\") e funciona também com uma empresa escolhida. Na coluna Data aparece o dia " +
      "da conclusão e, na coluna Responsável, quem foi a campo quando é outra pessoa.",
    onde: "Inspeções",
    impacto: "Nada a fazer: vale também para as inspeções que já existem.",
    versoes: ["0.3.138"],
  },
  {
    id: "dashboard-quem-concluiu",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Inspeções Concluídas: cada inspeção conta para quem a lançou",
    texto:
      "O gráfico por pessoa da tela de Inspeções Concluídas conta cada inspeção concluída para " +
      "quem a lançou — o mesmo nome da coluna Responsável da lista de Inspeções —, e não mais " +
      "para quem foi a campo. Reabrir e concluir de novo não muda a contagem. Clique na barra " +
      "de uma pessoa para ver a lista das inspeções dela; quando outra pessoa clicou em " +
      "Concluir, a lista mostra quem foi.",
    onde: "Dashboard › Inspeções Concluídas (Ver detalhe)",
    impacto: "Os números por pessoa passam a bater com a lista de Inspeções.",
    versoes: ["0.3.138"],
  },
  {
    id: "tecnico-de-campo-por-selecao",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "O técnico de campo é escolhido da lista, não digitado",
    texto:
      "Em \"Quem vai a campo?\" (Nova Inspeção) e no Técnico SST da aba Responsáveis, digite " +
      "parte do nome e escolha a pessoa na lista do cadastro. Acaba o mesmo técnico escrito de " +
      "jeitos diferentes. Sem conexão, a aba Responsáveis continua aceitando o nome digitado.",
    onde: "Inspeções › Nova Inspeção e aba Responsáveis",
    impacto:
      "Nos registros antigos digitados à mão, abrir para editar já mostra a pessoa " +
      "reconhecida; salvar padroniza o nome.",
    versoes: ["0.3.138"],
  },
  {
    id: "ficha-inspecao-seletor-secoes",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Ficha em Branco: veja só a parte que interessa",
    texto:
      "A Ficha em Branco da inspeção ganhou dois leques. Em Mostrar você marca as seções " +
      "que quer ver na tela (Setores, Cargos, Riscos…); o atalho só esta deixa uma sozinha. " +
      "Em Gerar PDF você escolhe o que sai na impressão, independente da tela: uma seção, " +
      "várias ou a ficha inteira. Para assinar, deixe a ficha inteira na tela e no PDF.",
    onde: "Inspeções › abrir a inspeção › Ficha em Branco",
    versoes: ["0.3.138"],
  },
  {
    id: "documentos-por-associado-diferenca",
    data: "2026-10-22",
    tipo: "melhoria",
    titulo: "Documentos por Associado explica por que as barras não somam o total",
    texto:
      "Embaixo do gráfico por mês, uma linha diz quantos documentos do total não " +
      "aparecem nas barras e por quê: foram assumidos pelo botão Assumir " +
      "elaboração, sem registro de associação (é ele que dá o mês), ou ganharam " +
      "associado antes dos últimos 12 meses. Nenhum número mudou.",
    onde: "Dashboard › Documentos por Associado",
    versoes: ["0.3.138"],
  },
  {
    id: "janelas-enter-e-esc-funcionam",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Enter e Esc dentro das janelas fazem o que prometem",
    texto:
      "Dentro das janelas do sistema, o Enter de alguns campos era ignorado. No Editar Empresa, Enter no CNPJ " +
      "salvava a empresa em vez de buscar na Receita — agora busca. Também voltaram a funcionar: Enter em " +
      "\"Adicionar…\" adiciona o item, Enter na subtarefa da Gestão adiciona a subtarefa, Enter na senha da " +
      "assinatura assina, e Esc numa edição em linha cancela só a edição, sem fechar a janela.",
    onde: "Janelas de cadastro e edição em todo o sistema",
    impacto: "Nada muda no que já está salvo. Esc fora de um campo continua fechando a janela.",
    versoes: ["0.3.137"],
  },
  {
    id: "buscar-cnpj-http-502",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Buscar CNPJ voltou a preencher a empresa",
    texto:
      "O botão Buscar do cadastro de empresa podia falhar com “Falha na consulta (HTTP 502)”: o serviço " +
      "principal da Receita passou a recusar consultas sem identificação, e o serviço reserva, mais lento e " +
      "limitado, nem sempre respondia. A consulta agora se identifica e volta a ser atendida na hora.",
    onde: "Empresas › Nova Empresa › CNPJ › Buscar",
    impacto: "Nada a fazer: é só buscar de novo.",
    versoes: ["0.3.137"],
  },
  {
    id: "devolucao-periferico-serie",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Devolução de periférico guarda o número de série",
    texto:
      "Ao devolver um periférico (headset, mouse, teclado), o campo Nº de série já vem preenchido com a " +
      "série anotada na retirada, e ela sai no termo de devolução. Antes o termo saía com a série em branco.",
    onde: "Equipamentos › Movimentação › Devolução",
    impacto: "Se voltar só parte dos itens, apague do campo as séries que ficaram com a pessoa.",
    versoes: ["0.3.137"],
  },
  {
    id: "inicio-visao-geral-so-modulos-da-conta",
    data: "2026-10-22",
    tipo: "correcao",
    titulo: "Início: a Visão geral por unidade conta só os módulos que você usa",
    texto:
      "Os números de laudos e inspeções de cada unidade, no alto do Início, somavam os documentos de todos " +
      "os módulos — inclusive dos que a sua conta não abre. Agora eles contam só os módulos liberados para " +
      "você, como os outros quadros do Início já faziam.",
    onde: "Início › Visão geral por unidade",
    impacto:
      "Quem não tem todos os módulos vai ver números menores nas unidades — é o esperado. Nada foi apagado; " +
      "quem tem o módulo continua vendo tudo.",
    versoes: ["0.3.137"],
  },
  {
    id: "empresas-grupos-matriz-filial",
    data: "2026-10-07",
    tipo: "novidade",
    titulo: "Grupos de empresas: matriz e filiais juntas",
    texto:
      "Empresas com mais de um CNPJ agora podem ficar juntas num grupo, com a matriz como principal e as " +
      "demais como filiais. O grupo se escolhe (ou se cria) no cadastro da empresa, novo ou existente, e há " +
      "uma tela própria de Grupos para adicionar empresas, trocar a matriz e ver quem está em cada grupo. O " +
      "painel sugere grupos pelas empresas que dividem a mesma raiz de CNPJ. Em todo o painel, digitar o " +
      "nome do grupo na busca de empresa traz todas as empresas dele.",
    onde: "Empresas › Grupos · cadastro da empresa (campo Grupo de empresas) · buscas de empresa",
    impacto:
      "Nenhuma empresa entra em grupo sozinha. Empresa de outra unidade aparece no grupo com nome, CNPJ e " +
      "unidade, mas sem acesso aos documentos dela.",
  },
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
