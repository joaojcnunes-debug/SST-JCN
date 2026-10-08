# Treinamento: Inspeção de Segurança

> Registro do treinamento produzido em **2026-10-08** pela skill `/treinamento`
> (`.claude/skills/treinamento/SKILL.md`). Use este registro para refazer o treinamento quando a tela mudar.

## Entregas

| O quê | Onde |
|---|---|
| Deck (29 slides, com notas) | https://claude.ai/artifact/FpyWg2L65DArz1oKwgDya8 (privado: compartilhar pelo menu) |
| Vídeos por módulo + completo (9:08) | `Downloads/Treinamento-Inspecao/modulos/` no computador do autor |
| Prints (29) | `Downloads/Treinamento-Inspecao/prints/` |
| Trilha original | `Downloads/Treinamento-Inspecao/trilha-motivacional-original.wav` |
| Inspeção de exemplo | empresa Teste, `INS-2B5E6274` |

## Módulos

| Módulo | Tema | Falas | Duração |
|---|---|---|---|
| 1 | Criar a inspeção | q01–q05 | 1:30 |
| 2 | Setores e cargos | q06–q09 | 1:05 |
| 3 | Riscos | q10–q21 | 2:46 |
| 4 | Responsáveis e treinamentos | q22–q24 | 0:51 |
| 5 | Extintores e máquinas | q25–q29 | 1:08 |
| 6 | Fotos, EPIs, PAE e observações | q30–q33 | 0:47 |
| 7 | Concluir, relatório e PGR | q34–q37 | 1:02 |

## Caso de exemplo

- **Setor:** Produção, com conformidades e não conformidades; cargo Operador de Prensa.
- **Risco:** Físico, agente Ruído contínuo ou intermitente, fonte prensa hidráulica;
  exposição elevada × irreversíveis = 9, **Alto**; com medição, EPIs, EPCs e medidas; enviado ao Plano de Ação.
- **Demais abas:** responsável da empresa, treinamento NR, extintor, máquina (NR-12), observações.
- **Resultado:** inspeção concluída, relatório e PGR gerados.

## Pontos de atenção da gravação

- **Matriz AIHA:** escolher sempre Probabilidade e Severidade. Sem escolher, o risco é gravado com os
  padrões "Ocasional"/"Marginal", que não são valores da matriz, e o nível sai Baixo.
- **Fonte geradora:** Enter no campo envia o formulário e salva o risco sem a fonte. Usar o botão Adicionar.
- **Automação:** os modais são `[role=dialog]` (não achados por `getByRole('dialog')`); botões por texto;
  o formulário de máquina é inline no `main`; o campo de agente é lento para digitar (usar `fill`);
  a sessão copiada expira em ~1 h.

## Pronúncia

| Escrito | Na fala |
|---|---|
| AIHA | aiá |
| NR-09 · NR-12 | NR zero nove · NR doze |

## Falas (`narr-insp.json`)

- **q01** — Vamos fazer uma inspeção de segurança do começo ao fim. Na lista de inspeções você acompanha tudo o que está em rascunho, em andamento e concluído. Para começar, clique em Nova Inspeção.
- **q02** — O assistente tem três passos. No primeiro, escolha a empresa onde a inspeção será feita. Digite parte do nome ou o CNPJ e clique em Próximo.
- **q03** — No segundo passo, diga como criar. Em branco começa do zero. Nova revisão e cópia aproveitam setores, cargos e riscos de uma inspeção anterior, o que economiza muito tempo na visita seguinte.
- **q04** — No terceiro passo, confira a data e quem vai a campo. O seu nome já vem preenchido e dá para incluir um segundo técnico. A revisão é numerada automaticamente. Use as observações iniciais para registrar o contexto da visita.
- **q05** — Inspeção criada. As abas seguem a ordem do trabalho em campo: setores, cargos, riscos, EPIs, fotos, responsáveis, plano de emergência, treinamentos, extintores e máquinas.
- **q06** — Comece pelos setores. Cada setor, ou grupo homogêneo de exposição, é a base de tudo: cargos, riscos e máquinas ficam ligados a ele.
- **q07** — O nome do setor é obrigatório. Na descrição, conte o que é feito ali. Em conformidade, registre o que está correto, e em não conformidade, o que precisa ser corrigido. Clique em Adicionar.
- **q08** — Agora os cargos. Dentro de cada setor, clique em mais Cargo.
- **q09** — O setor já vem selecionado. Informe o nome do cargo e uma descrição curta das atividades. Isso aparece no inventário de riscos do PGR.
- **q10** — Chegamos aos riscos, o coração da inspeção. Clique em Adicionar Risco.
- **q11** — Primeiro, o tipo de risco, com a cor da NR zero nove: físico, químico, biológico, ergonômico, acidente ou psicossocial. Aqui, um risco físico.
- **q12** — Escolha o setor. Dá para marcar mais de um: o sistema cria um risco para cada setor marcado.
- **q13** — No agente, escolha um modelo da lista ou digite. Quando o texto bate com um modelo do catálogo, o sistema aplica as sugestões cadastradas, como EPIs e medidas.
- **q14** — Fonte geradora é o que produz o risco, como uma máquina ou um processo. Digite e clique em Adicionar. Atenção: use o botão, porque o Enter salva o risco inteiro.
- **q15** — Na caracterização da exposição, informe o meio de propagação, a situação, o tempo de exposição e a técnica utilizada na avaliação.
- **q16** — Agora a matriz aiá. Escolha sempre a probabilidade e a severidade, de acordo com o que você observou. O nível é calculado na hora.
- **q17** — Exposição elevada vezes irreversível resulta em nível Alto. Riscos Alto e Muito Alto entram no plano de ação com prioridade.
- **q18** — No risco físico, informe se é preciso medição e qual. Isso indica a necessidade de avaliação quantitativa, como uma dosimetria de ruído.
- **q19** — Em EPIs e EPCs, registre o que já é usado e o que é recomendado. Digite, informe o CA quando houver e clique em Adicionar.
- **q20** — Depois, as medidas já adotadas e as medidas recomendadas. As recomendadas alimentam o PGR e o plano de ação. Clique em Adicionar para salvar o risco.
- **q21** — Risco salvo. Riscos Alto e Muito Alto podem ser enviados ao plano de ação central da empresa, com um clique.
- **q22** — Em responsáveis, o técnico informado na criação já aparece. Clique em Adicionar e registre quem recebeu a visita na empresa, com o cargo.
- **q23** — Em treinamentos, registre as NRs que os trabalhadores precisam fazer. O botão Sugerir com IA analisa os riscos cadastrados e propõe uma lista.
- **q24** — Informe a NR, o título, a carga horária e a periodicidade, e clique em Criar.
- **q25** — Em extintores, cadastre cada extintor: setor, tipo de agente, capacidade, identificação, localização e validade.
- **q26** — Marque a situação: conforme, não conforme ou não avaliado. Se não estiver conforme, marque cada não conformidade encontrada.
- **q27** — Em máquinas, toda máquina pertence a um setor. Escolha o setor primeiro: os demais campos aparecem em seguida.
- **q28** — Informe o nome, os dados do equipamento, as proteções da NR doze e o grau de risco.
- **q29** — Máquinas que precisam de adequação podem seguir direto para a Apreciação de risco da NR doze.
- **q30** — Na aba fotos, envie as fotos por categoria e setor, com legenda. Elas ilustram o relatório.
- **q31** — Em EPIs e EPCs, você vê tudo o que foi vinculado aos riscos, com o certificado de aprovação e fotos.
- **q32** — No PAE, monte a árvore de contatos de emergência. Cada campo é salvo assim que você sai dele.
- **q33** — Por fim, as observações gerais da inspeção. Elas também são salvas sozinhas ao sair do campo.
- **q34** — Terminou o trabalho de campo? Clique em Concluir. Se precisar corrigir algo, a inspeção pode ser reaberta depois.
- **q35** — Com a inspeção concluída, aparecem os botões Reabrir e Liberar para o Comercial. Liberar mostra ao comercial os serviços que a inspeção indicou, depois de uma confirmação.
- **q36** — No relatório estão a assinatura, a geração do PDF e o card do documento no SGG, onde o associado assume e conclui a elaboração.
- **q37** — E o PGR traz o inventário de riscos por setor, cargo e tipo, e o plano de ação a partir das medidas recomendadas. Fim da demonstração.
