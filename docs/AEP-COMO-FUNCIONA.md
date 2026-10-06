# AEP no Painel SST (JCN) — como funciona hoje

> Retrato do sistema em **2026-10-06**, tirado do código e do banco em produção
> (`sst-jcn`). Serve para conferir o funcionamento com outras orientações
> (normas, documentos do RT, procedimentos internos). Descreve o que o sistema
> **faz**, não o que deveria fazer; os pontos que merecem conferência estão
> no fim (seção 13).

---

## 1. O que é a AEP no sistema

- **AEP = Análise Ergonômica Preliminar** (NR-17, itens 17.3.1 e 17.3.1.1),
  integrada ao GRO/PGR (NR-01).
- Funciona como **triagem**: identifica e prioriza fatores e setores que pedem
  mais atenção e indica quando aprofundar com:
  - **AET** (Análise Ergonômica do Trabalho, NR-17 17.3.2);
  - **DRPS/Questionário Psicossocial**, de caráter complementar.
- **Premissas oficiais do RT** (aparecem na página Matriz AIHA, no Texto Padrão e orientam a IA):
  1. A AEP constitui uma triagem preliminar, voltada à identificação e
     priorização de fatores e setores que demandam maior atenção. Seu resultado
     não substitui a AET e deve ser compreendido a partir das condições
     observadas no ambiente de trabalho.
  2. O DRPS/Questionário Psicossocial possui caráter complementar, contribuindo
     para ampliar a compreensão dos riscos psicossociais a partir de uma
     perspectiva mais personalizada, considerando como os próprios trabalhadores
     percebem e vivenciam suas condições de trabalho.
  3. Os resultados da AEP dependem da qualidade das observações registradas e
     devem ser revistos sempre que houver mudanças nas condições de trabalho,
     conforme previsto na NR-01 e na revisão do inventário de riscos.

## 2. Onde a AEP é criada

Uma AEP é **um documento por empresa**, com vários setores dentro. Há três
formas de criá-la:

| Origem | Como | Observação |
|---|---|---|
| **Módulo AEP → Nova Análise** | escolhe a empresa e decide **"Registrar em inspeção"**: inspeção existente, nova inspeção ou **sem inspeção** | o vínculo pode ser trocado depois ("Alterar inspeção") |
| **Aba AEP dentro da inspeção** | "Iniciar AEP desta inspeção" | já nasce com os setores e cargos da inspeção e **já cadastrada no módulo AEP** (desde 2026-10-05). É o mesmo registro nos dois lugares |
| **Formulário em Branco** | impressão do questionário completo para preencher à mão em campo | não cria registro; serve para coleta |

- **Uma inspeção tem no máximo uma AEP.**
- **Sugestões de setores e cargos:** se a empresa já tem setores e cargos
  cadastrados (de inspeções), o editor sugere esses nomes. O técnico também pode
  digitar à mão.

## 3. Status e ciclo de vida

| Status | Significado |
|---|---|
| **Rascunho** | criada, em preenchimento |
| **Em andamento** | em elaboração (status intermediário, para controle no dashboard) |
| **Concluído** | finalizada; grava a data de conclusão (`concluido_em`) automaticamente. Se voltar de Concluído, a data é limpa |

- **Validade do documento:** campo informado pelo usuário (gera alerta de
  vencimento e entra no texto das Considerações Finais: "e no máximo até
  dd/mm/aaaa").
- **Exclusão:** só **Admin**. Vai para a **Lixeira** e pode ser restaurada.
  Também dá para excluir pela aba da inspeção.

## 4. Dados gerais do documento ("Dados / Conclusão")

- Empresa, status, responsável pela elaboração, título profissional e registro
  (CREA/CRM/MTE etc.).
- Data de elaboração, validade do documento e endereço da empresa.
- **Considerações finais:** texto livre. Se ficar em branco, o sistema gera a
  conclusão automática (seção 9).

## 5. Estrutura de cada setor (triagem por setor)

**Identificação do setor**
- Setor, unidade, GHE, cargo, função, jornada e quantidade de expostos.
- Descrição da atividade.
- **Cargos do setor:** cargo, descrição e quantidade.

**Participação dos trabalhadores (NR-01)**
- **Método de coleta**, entre:
  - observação direta;
  - entrevista com trabalhadores;
  - entrevista com gestores;
  - análise documental;
  - questionário aplicado.
- Trabalhadores consultados.
- **Condições da coleta** (desde 2026-10-06): trabalhadores abordados,
  participantes (não pode passar dos abordados), recusas/respostas evasivas
  (só o número), liderança presente e **sinais de inibição**:
  - respostas padronizadas/ensaiadas, sem exemplos concretos;
  - silêncio ou mudança de comportamento com a aproximação da liderança;
  - trabalhadores olham para a liderança antes de responder;
  - recusa em participar ou pedido para "não se envolver".

  Com sinal de inibição, o editor **sugere** (não marca) os sinais "Falta de
  abertura para escuta" e "Ambiente de tensão ou silêncio excessivo" no
  Assédio e recomenda instrumento anônimo. No laudo vira a linha "Condições da
  coleta".

**Três checklists** (seção 6), cada item com observação de campo opcional.

**Riscos identificados (lista livre)**
- Tipo: Acidentes, Ergonômico, Físico, Químico ou Biológico.
- Descrição.
- Classificação: Trivial, De Atenção, Moderado, Alto ou Crítico.
- Medida preventiva.

**Fechamento**
- **Parecer Técnico Preliminar** e **Recomendações Ergonômicas**, em texto,
  com botão "Gerar com IA" (seção 10).
- **Necessita AET:** calculado pelo sistema (seção 8).

## 6. Os três checklists

Respostas aceitas:

| Resposta | Significado |
|---|---|
| **Sim** | fator de risco identificado |
| **Não** | fator avaliado e ausente |
| **N/A** | não se aplica |
| **N/I** | não identificável: não foi possível verificar. Só existe na Ergonomia Organizacional |

**Motivo do N/I (obrigatório desde 2026-10-06):** receio dos trabalhadores em
se manifestar; trabalhadores ausentes; atividade não observada; outro (com
texto). O Salvar recusa N/I sem motivo. N/I continua fora da matriz e do
"Necessita AET"; no laudo aparece no quadro **"Limitações da avaliação"**.

**Roteiro de campo:** cada fator organizacional tem perguntas indiretas e o
que observar (recolhido no editor e impresso no Formulário em Branco).

**Evidência por fator "Sim" (desde 2026-10-06):**
- **Origem da evidência**, marcada por fator: observação direta, relato
  individual, relato em grupo, documental, questionário anônimo.
- **Confiança:** 1 tipo de origem = Baixa; 2 = Média; 3 ou mais = Alta. Lacuna
  do checklist de gestão ligada ao fator conta como "documental". Não muda o
  nível AIHA.
- **Fontes geradoras:** as lacunas do checklist de gestão aparecem sozinhas; o
  técnico marca outras da biblioteca psicossocial.

**Questionário anônimo por QR Code (desde 2026-10-06):** no bloco Participação
dos trabalhadores, "Gerar link anônimo" cria um link e um QR Code por setor
(válido 15 dias, prorrogável), para imprimir e colar no setor. O trabalhador
responde no celular, sem login, 13 afirmações (uma por fator) de Nunca a
Sempre e um comentário opcional. Nada identifica quem responde (sem IP, sem
horário). O resultado só aparece com **5 ou mais respostas**; fator com 30% ou
mais de "Frequentemente/Sempre" é sugerido, e o técnico decide se registra a
origem "questionário anônimo". É triagem complementar e não substitui o DRPS;
o questionário fica no QPS (tipo "Triagem anônima AEP").

**Checklist de gestão (uma vez por AEP):** 26 itens (G01–G26: política de
assédio, canal de denúncia, descrição de cargos, controle de jornada…),
respondidos com gestor/RH, por observação ou documento. "Não existe" e
"Existe, sem evidência" viram fonte geradora dos fatores ligados ao item;
"Existe e evidenciado" vira medida de controle existente.

**Biblioteca psicossocial:** descrição do risco, danos à saúde, fontes
geradoras codificadas, meio de propagação, situação e tempo de exposição,
sugestões e ações de cada fator. Só o Admin edita.

### 6.1 Ergonomia Física (9 itens)
1. Posturas inadequadas / forçadas
2. Movimentos repetitivos
3. Levantamento / transporte de cargas
4. Mobiliário inadequado
5. Esforço físico elevado
6. Iluminação inadequada
7. Ruído / ambiente sonoro adverso
8. Vibração (corpo inteiro / mãos e braços)
9. Desconforto térmico

### 6.2 Ergonomia Cognitiva (5 itens)
1. Atenção contínua / concentração elevada
2. Sobrecarga mental / complexidade da tarefa
3. Pressão psicológica / cobrança excessiva
4. Excesso de informações simultâneas
5. Ritmo mental acelerado

### 6.3 Ergonomia Organizacional — fatores psicossociais (13 fatores × 5 sinais)

Quando o fator é marcado **Sim**, abrem os **sinais observados** (lista do RT
de 2026-10-06). O técnico marca os que viu em campo.

**1. Assédio de qualquer natureza no trabalho**
- Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras
- Falta de abertura para escuta
- Cobranças em público
- Ambiente de tensão ou silêncio excessivo
- Naturalização de gritos, pressão ou desrespeito ("aqui sempre foi assim")

**2. Falta de suporte / apoio no trabalho**
- Líder ausente ou pouco acessível no dia a dia
- RH apenas burocrático, mas inacessível
- Pouca interação e/ou ausência de direcionamento técnico
- Dificuldade de levar problemas e questões para a liderança
- Erros sendo punidos, mas não trabalhados

**3. Má gestão de mudanças organizacionais**
- Comunicação informal das mudanças (boatos e conversas informais)
- Comentários sobre instabilidade
- Insegurança sobre a função
- Sensação de improviso na gestão
- Relatos de dúvidas e retrabalho

**4. Baixa clareza de papel / função**
- Colaborador recebe orientações de mais de uma pessoa
- Dúvidas sobre "quem manda"
- Falta de padrão na comunicação
- Instruções vagas ou incompletas (ou informações que não chegam a todos)
- Instruções diferentes para uma mesma atividade

**5. Baixas recompensas e reconhecimento**
- Falta de plano de carreira e possibilidade de crescimento
- Indiferença com relação a resultados (ausência de conversas de desenvolvimento, feedback somente quando há erro)
- Desmotivação aparente
- Ausência de retorno sobre desempenho
- Cobrança intensa por resultado, sem reconhecimento por esforço

**6. Baixo controle no trabalho / Falta de autonomia**
- Pouca margem para iniciativa
- Muito controle em cima das atividades (controle detalhado e constante, revisões excessivas)
- Falta de confiança explícita ou implícita
- Decisões concentradas em poucas pessoas
- Dificuldade da equipe em resolver problemas sozinha e/ou medo de errar e evitação de iniciativa ("melhor perguntar tudo")

**7. Baixa justiça organizacional**
- Colaboradores não sabem como as decisões são tomadas
- Comentários informais sobre preferências
- Decisões percebidas como pessoais, não técnicas *(visão do técnico)*
- Desmotivação ou descrédito na liderança e/ou comentários sobre injustiça ou favoritismo *(relato do colaborador)*
- Conflitos interpessoais

**8. Eventos violentos ou traumáticos**
- Atividades com contato com o público (especialmente situações de conflito)
- Trabalho em áreas com risco de violência
- Falta de protocolos de segurança
- Falta de treinamento para lidar com situações de risco
- Histórico de incidentes (mesmo que informais)

**9. Baixa demanda no trabalho (Subcarga)**
- Períodos frequentes sem atividades
- Falta de desafios compatíveis com a função (profissionais qualificados realizando tarefas simples ou repetitivas)
- Concentração de demandas
- Conversas sobre "não ter o que fazer"
- Baixa exigência cognitiva, monotonia

**10. Excesso de demandas no trabalho (Sobrecarga)**
- Acúmulo de atividades simultâneas e/ou funções
- Clima laboral onde se percebe sensação de urgência permanente
- Equipe reduzida para o volume de trabalho
- Metas percebidas como difíceis de atingir
- Cansaço aparente, irritabilidade, dificuldade de concentração

**11. Maus relacionamentos no local de trabalho**
- Resistência ao trabalho em equipe e à colaboração
- Conflitos ignorados ou minimizados
- Evitação entre colegas
- Falta de respeito em interações
- Comunicação indireta (recados, indiretas…)

**12. Trabalho em condições de difícil comunicação**
- Erros frequentes
- Colaboradores sem referência de quem procurar
- Informações divergentes entre pessoas
- Dependência de comunicação informal e/ou ausência de canais formais de comunicação
- Interrupção das atividades por falta de informação

**13. Trabalho remoto e isolado**
- Baixo senso de pertencimento
- Equipe pouco conectada
- Falta de ações de integração
- Falta de alinhamento nas informações
- Comunicação restrita a mensagens objetivas (sem troca real)

## 7. Matriz de risco AIHA (só Ergonomia Organizacional)

- **Matriz usada:** a mesma matriz ativa do inventário de riscos da inspeção
  (hoje a **AIHA 5×5**).
- **Escopo:** só os fatores organizacionais marcados **Sim**. Física e
  cognitiva **não** passam pela matriz.
- **Cálculo:** nível = peso da probabilidade × peso da severidade (pesos de 0 a 4).

**Faixas**

| Pontos | Nível |
|---|---|
| 0 | Trivial |
| 1–2 | Baixo |
| 3–6 | Moderado |
| 7–10 | Alto |
| ≥ 11 | Muito Alto |

**Probabilidade sugerida: 1 sinal = 1 nível** (desde 2026-10-06)

| Sinais marcados | Probabilidade | Peso |
|---|---|---|
| 0 | Não há exposição (campos travados) | 0 |
| 1 | Exposição a níveis baixos | 1 |
| 2 | Exposição moderada | 2 |
| 3 | Exposição elevada | 3 |
| 4 ou 5 | Exposição elevadíssima | 4 |

- **Fator Sim sem nenhum sinal marcado:** fica em "Não há exposição" ×
  "Pouca importância" = **Trivial**, travado. Não conta para a AET.
- Antes de 2026-10-06 a regra era a proporção de sinais: até 1/3 → moderada,
  até 2/3 → elevada, acima → elevadíssima.

**Severidade padrão por fator**

| Severidade (peso) | Fatores |
|---|---|
| **Irreversíveis (3)** | Assédio; Eventos violentos ou traumáticos |
| **Severos (2)** | Falta de suporte; Baixo controle; Baixa justiça organizacional; Sobrecarga; Maus relacionamentos |
| **Preocupantes (1)** | Gestão de mudanças; Clareza de papel; Recompensas; Subcarga; Difícil comunicação; Trabalho remoto |

As severidades "Pouca importância (0)" e "Ameaça (4)" existem na escala, mas
nenhum fator parte delas.

**Exemplos de resultado com a sugestão padrão**

| Fator (severidade) | 1 sinal | 2 | 3 | 4–5 |
|---|---|---|---|---|
| Assédio (Irreversíveis, 3) | Moderado (3) | Moderado (6) | Alto (9) | Muito Alto (12) |
| Falta de suporte (Severos, 2) | Baixo (2) | Moderado (4) | Moderado (6) | Alto (8) |
| Subcarga (Preocupantes, 1) | Baixo (1) | Baixo (2) | Moderado (3) | Moderado (4) |

- **Julgamento do técnico:** probabilidade e severidade são sugestões. O
  técnico pode trocar qualquer uma; a troca fica marcada como manual e pode
  voltar à sugestão.
- **Gravação:** o resultado fica gravado em cada setor. Laudo, PDF,
  Sinalização e Comercial leem o valor gravado.

## 8. Critério "Necessita AET" (calculado por setor)

O setor **necessita AET** quando, na matriz AIHA da Ergonomia Organizacional,
há:

- **pelo menos 1 fator Alto ou Muito Alto**, ou
- **2 ou mais fatores Moderados**.

Esse critério aparece:
- no editor, com um selo no setor;
- no capítulo "Indicadores de Necessidade de AET" do laudo;
- nas Considerações Finais;
- no texto da IA;
- na Sinalização e no Comercial.

### DRPS/Questionário Psicossocial (recomendação por documento)
- **Regra:** recomendado quando a AEP soma **3 ou mais fatores organizacionais
  "Sim"** (alertas), somando todos os setores, **ou** (desde 2026-10-06)
  quando algum setor tem N/I por **receio de manifestação** ou **sinal de
  inibição** na coleta.
- **No editor:** aparece um aviso citando a NR-01 e a Fundacentro.
- **Situação na Sinalização:** é lida a partir do que a empresa já tem:
  - **Necessário:** não tem DRPS nem Questionário;
  - **Revisão recomendada:** tem, mas foi concluído antes desta AEP;
  - **Atendido:** concluído depois.

## 9. Laudo (tela e PDF)

**Capítulos, na ordem do Texto Padrão do módulo AEP**

| Ordem | Capítulo | Tipo |
|---|---|---|
| 1 | 1. Introdução | editável |
| 2 | 2. Metodologia | editável |
| 3 | Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA | editável (explicação técnica e normativa da matriz, as tabelas acima e as 3 premissas) |
| 4 | Indicadores de Necessidade de AET | fixo (gerado) |
| 5 | Triagem Ergonômica por Setor | fixo (gerado: identificação, checklists, sinais, níveis AIHA, riscos, parecer, recomendações) |
| 6 | 3. Considerações Finais | editável |
| 7 | Considerações Finais e Encaminhamentos | fixo (gerado) |
| 8 | Assinatura do Responsável Técnico | fixo |

**Considerações Finais e Encaminhamentos (automático)**
- **Com texto do técnico:** se o campo "Considerações finais" estiver
  preenchido, o capítulo usa esse texto.
- **Sem texto:** o sistema gera os parágrafos abaixo, só com o que já está no laudo.
  1. **Escopo:** quantos setores e trabalhadores foram avaliados, nas
     dimensões física, cognitiva e organizacional (NR-17 e NR-01).
  2. **Riscos registrados:** contagem por classificação (lista livre de
     riscos).
  3. **Desfecho:** setores que necessitam AET (com nomes), ou a frase "nenhum
     setor apresentou indicadores que justifiquem AET".
  4. **Encaminhamentos:**
     - (i) levar as recomendações ao Plano de Ação do PGR;
     - (ii) dar ciência a trabalhadores e lideranças;
     - (iii) acompanhar a eficácia;
     - (iv) revisar quando mudar processo, layout, mobiliário, ritmo ou
       jornada, ou surgirem queixas, e no máximo até a validade.

**Detalhamento por fator (desde 2026-10-06):** dentro da Triagem por Setor, cada
fator "Sim" traz descrição do risco, danos à saúde, fontes geradoras, medidas
de controle existentes, origem das evidências e confiança.

**Inventário psicossocial:** botões "Inventário (Excel)" e "CSV" no laudo; uma
linha por setor × fator "Sim", para lançamento no SGG.

**Variáveis do Texto Padrão:** nome da empresa, validade e outras são preenchidas
automaticamente.

## 10. IA (Parecer Técnico Preliminar e Recomendações)

Botão "Gerar com IA" por setor (modelo via Groq).

**O que a IA recebe**
- Empresa, setor, cargos e jornada.
- Itens "Sim" dos três checklists.
- Fatores organizacionais com o nível AIHA, probabilidade × severidade e
  sinais marcados.
- O "Necessita AET" calculado e as observações de campo.
- Limitações da avaliação (N/I com motivo), condições da coleta e se houve
  receio de manifestação (desde 2026-10-06).

**Regras do prompt**
- Tratar como **triagem**: "identificou-se", "foram observados indícios". Nunca
  como diagnóstico conclusivo ou substituto da AET.
- Citar o nível AIHA e os sinais que o sustentam, do mais grave ao menos grave.
- Recomendar AET **só** se "Necessita AET = sim".
- Citar o DRPS/Questionário como **complementar** quando houver 3+ alertas
  organizacionais ou algum fator Alto/Muito Alto.
- N/I não é achado: registrar a limitação com o motivo.
- Com receio de manifestação: registrar a participação limitada e indicar o
  DRPS/Questionário (resposta sem exposição) como complemento.
- Uma frase curta sobre revisão quando as condições mudarem (NR-01).
- **Parecer:** 2–3 parágrafos (140–240 palavras), **sem lista de ações nem
  prazos**.
- **Recomendações:** 1–2 parágrafos (90–180 palavras), com ações classificadas
  como imediatas (<30 dias), preventivas (30–90 dias) ou estruturais
  (>90 dias). Incluem AET, DRPS e revisão quando cabíveis.
- Não inventar dados, medições nem números. Sem bullets.
- **Desde 2026-10-06:** recebe também fontes geradoras, medidas existentes,
  origem e confiança de cada fator e a lista de sugestões/ações da biblioteca;
  nas Recomendações só escolhe ações dessa lista (além de AET, DRPS e revisão).
  Com confiança Baixa, registra a limitação.

## 11. AEP e inspeção

**Vínculo (opcional)**
- A AEP pode estar ligada a uma inspeção.
- "Registrada na inspeção INS-…" aparece no editor, com o botão "Alterar inspeção".

**Na inspeção**
- As abas **AEP** e **AET** usam os mesmos editores do módulo; é o mesmo laudo.
- Botões da aba:
  - "Laudo / Imprimir";
  - "Excluir" (vai para a Lixeira);
  - "Enviar para o módulo", que só aparece para laudo antigo; os novos já
    nascem no módulo.
- O quadro **"Documentos da empresa"** (na inspeção e no relatório, junto ao
  Resumo Geral) mostra DRPS, QPS, AEP e AET da empresa com contagem por
  situação.

## 12. Para onde a AEP leva a informação

### 12.1 Sinalização de Fatores Psicossociais

Telas: módulo AEP → "Sinalização Psicoss."; módulo Sinalização.

**Quais AEPs entram:** só as **entregues ao cliente**.
- **Com inspeção:** quando o associado conclui o documento da inspeção.
- **Sem inspeção:** quando a AEP fica **Concluída**.

**O que mostra**
- **Por empresa:** unidade, região, município, nº de setores, alertas, fatores
  Alto/Muito Alto e pior nível.
- **Situação:**
  - **DRPS/Questionário:** Necessário / Revisão recomendada / Atendido, com datas;
  - **AET:** necessária ou não.
- **Responsáveis:** quem realizou a AEP e quem enviou (associado).
- **Por setor:** fatores "Sim", com nível AIHA, probabilidade, severidade,
  sinais e observação. Ordenados do mais grave.
- **Filtros e contadores.** A tela não tem link para o editor, de propósito.

A página **Matriz AIHA** (módulos AEP e Sinalização) traz a explicação técnica
e normativa, com:
- NR-01: 1.5.3.1.4, 1.5.4.4.2 e 1.5.4.4.3;
- NR-17: 17.3.1, 17.3.1.1 e 17.3.2;
- Guia MTE de fatores psicossociais, ISO 45003 e ISO 31000;
- as tabelas da seção 7;
- as 3 premissas.

### 12.2 Comercial (oportunidades de venda)

**Liberação:** a AEP só entra depois que a equipe clica em **"Liberar para o
Comercial"**.
- O botão aparece depois que a AEP é entregue.
- Quem pode clicar: quem edita.
- "Retirar do Comercial" desfaz.
- Para a AEP sem inspeção que volta de Concluída para outro status, a retirada
  é automática.

**O que a AEP liberada indica**
- **AET:** setores com Necessita AET, com os expostos.
- **DRPS/Questionário:** quando há 3+ alertas organizacionais.

**Situação de cada oportunidade**

| Situação | Quando |
|---|---|
| **Aberta** | a empresa não tem o serviço |
| **Revisão recomendada** | tem o serviço, mas concluído antes desta AEP |
| **Em andamento** | tem rascunho ou andamento editado depois da indicação. Rascunho parado desde antes da indicação **não conta** |
| **Realizada** | o serviço foi feito depois da indicação |

**A AEP não é produto vendido no Comercial:** ela só indica AET e DRPS.

### 12.3 Dashboard e lista do módulo AEP

- **Status:** cartões por Rascunho, Em andamento e Concluído.
- **Filtros:**
  - status;
  - AET (necessita ou não);
  - nível AIHA organizacional;
  - com ou sem inspeção;
  - quem realizou;
  - período de elaboração;
  - busca por empresa, CNPJ ou responsável.

## 13. Pontos para conferir com outras orientações

1. **"Necessita AET" só olha a Ergonomia Organizacional.** Itens "Sim" da
   ergonomia física ou cognitiva, e riscos da lista livre classificados
   Alto ou Crítico, **não** disparam AET sozinhos. Confirmar se a orientação
   pede AET também por critério físico/biomecânico (NR-17 17.3.2).
2. **Duas escalas de risco convivem no mesmo laudo:**
   - matriz AIHA dos fatores organizacionais: Trivial, Baixo, Moderado, Alto,
     Muito Alto;
   - lista livre de riscos: Trivial, De Atenção, Moderado, Alto, Crítico.

   Confirmar se isso é desejado ou se a lista livre deveria usar a mesma
   matriz.
3. **Física e cognitiva não têm gradação** (só Sim/Não/N/A), nem sinais
   observáveis. Só a organizacional tem sinais e matriz.
4. **Probabilidade "1 sinal = 1 nível":** com 5 sinais e 5 níveis (o 1º
   reservado para "sem evidência"), 4 e 5 sinais dão o mesmo resultado.
5. **Severidade padrão fixa por fator** (seção 7). Confirmar com o RT se
   algum fator deveria partir de outra severidade.
6. **DRPS por contagem simples:** 3+ fatores "Sim" somando todos os setores,
   independentemente do nível AIHA (um setor grande e vários pequenos contam
   igual). A IA, por sua vez, também cita DRPS quando há algum fator
   Alto/Muito Alto.
7. **"N/I" (não identificável)** existe só na organizacional e não entra na
   matriz nem no Necessita AET. Desde 2026-10-06 exige motivo, e o N/I por
   receio de manifestação recomenda DRPS/Questionário.
8. **Dois capítulos de conclusão:** "3. Considerações Finais" (editável, do
   Texto Padrão) e "Considerações Finais e Encaminhamentos" (gerado).
   Conferir se os dois devem aparecer no laudo.
9. **Entrega ao cliente** é o gatilho da Sinalização. Para AEP com inspeção, depende
   de o **associado concluir o documento da inspeção**, não do status da AEP.
10. **Validade** é digitada pelo usuário; o sistema não calcula prazo padrão
    (ex.: 2 anos).
