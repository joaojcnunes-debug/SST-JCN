# Fase 0 — Auditoria: AEP com menos dependência de entrevistas

> Resposta à Fase 0 do prompt `prompt_aep_reducao_dependencia_entrevistas.md`.
> Levantado no código e no banco de produção do `sst-jcn` em 2026-10-06.
> **Nenhum código foi alterado.** Aguardando "aprovado, fase N".

## Resumo

| Fase | Faz sentido? | Esforço | Risco | Recomendação |
|---|---|---|---|---|
| **1** Motivo do N/I, condições da coleta, roteiro de campo | **Sim, muito** | baixo | baixo (tudo no jsonb do setor, sem migration) | fazer já |
| **2** Biblioteca, checklist de gestão, confiança | Sim, com ajustes | alto | médio | fazer, mas **reaproveitando o que o DRPS/QPS já tem** e simplificando a "origem por sinal" |
| **3** Questionário anônimo por QR | A ideia sim; o desenho não | alto | **alto** (1ª rota pública com gravação anônima) | **não** criar um questionário só da AEP; construir a coleta anônima **dentro do QPS** e a AEP ler o resultado |

## 1. Onde ficam os dados da AEP

- **Uma tabela só:** `aep_relatorios`, com PK `id_relatorio` **uuid**. Não
  segue o padrão `PREFIXO-XXXXXXXX`; é uuid desde a origem do módulo.
- **Setores, checklists, sinais, matriz, riscos e textos:** tudo em
  **`aep_relatorios.setores` (jsonb, array)**, campo a campo:

  | Campo do setor | O que guarda |
  |---|---|
  | `checklist_fisica` / `checklist_cognitiva` / `checklist_organizacional` | `{item: "sim"\|"nao"\|"nao_aplica"\|"nao_identificado"}` |
  | `observacoes_checklist` | `{item: texto}` |
  | `sinais_organizacional` | `{fator: [chave_sinal…]}` |
  | `aiha_organizacional` | `{fator: {probabilidade, severidade, nivel, prob_manual, sev_manual}}` (gravado) |
  | `riscos` | lista livre `{tipo, risco, classificacao_risco, medida_preventiva}` |
  | `metodo_coleta`, `trabalhadores_consultados` | texto |
  | `parecer_tecnico`, `recomendacoes`, `necessita_aet` | — |

- **Colunas do documento:**
  - `status` (RASCUNHO/EM_ANDAMENTO/CONCLUIDO), `concluido_em`, `data_validade`;
  - `id_inspecao`, `enviado_modulo_em`;
  - `liberado_comercial_em/_por`;
  - `responsavel_elaboracao` etc.
- **Consequência boa:** campos novos **por setor** (motivo do N/I, condições
  da coleta, origem das evidências) entram no jsonb **sem migration**. Só
  precisam entrar no normalizador `normalizarSetor` (`lib/hooks/useAep.ts`), que
  descarta todo campo que não conhece.

## 2. Onde ficam as listas (fatores, sinais, itens)

| Lista | Onde |
|---|---|
| 13 fatores, itens física/cognitiva, respostas, métodos de coleta | `lib/aep/checklist-itens.ts` (constante TS) |
| 65 sinais (5 × 13) | `lib/aep/sinais-organizacional.ts` (constante TS, fonte única) |
| Severidade padrão, regra 1 sinal = 1 nível, Necessita AET | `lib/aep/aiha-organizacional.ts` + `calcNecessitaAet` em `lib/hooks/useAep.ts` |
| Regra DRPS (3+ "Sim") | `MIN_ALERTAS_QUESTIONARIO` em `lib/aep/sinalizacao.ts` |

**Divergências do Anexo A** (prevalece o sistema, como o prompt pede):

| Fator | Anexo A | Sistema |
|---|---|---|
| 6, sinal 2 | "Muito controle **sobre** as atividades…" | "Muito controle **em cima** das atividades…" (texto que o RT mandou em 2026-10-06) |
| 10, sinal 2 | "Clima laboral **com** sensação de urgência permanente" | "Clima laboral **onde se percebe** sensação de urgência permanente" |
| 7, sinais 3 e 4 | "(técnico)" / "(colaborador)" no texto | etiqueta `fonte` separada; o texto não leva o parêntese |

## 3. Arquivos envolvidos

| Peça | Arquivo |
|---|---|
| Editor do setor (checklists, sinais, matriz, riscos, IA) | `components/aep/AepSetoresEditor.tsx` (1.342 linhas) |
| Normalizador do setor | `lib/hooks/useAep.ts` (`normalizarSetor`) |
| Cálculo AIHA | `lib/aep/aiha-organizacional.ts` (+ teste) |
| Necessita AET | `calcNecessitaAet` em `lib/hooks/useAep.ts` |
| Regra DRPS | `lib/aep/sinalizacao.ts` (`recomendaQuestionario`) |
| Prompt da IA | `supabase/functions/gerar-parecer-aep-ia/index.ts`; contexto montado em `AepSetoresEditor.tsx` (~linha 675) |
| Laudo na tela | `app/(aep)/aep/[idRelatorio]/laudo/page.tsx` |
| PDF | `app/api/pdf/aep/[id]/route.ts` (Puppeteer + `@sparticuz/chromium`, `@signpdf`, `FolhaAssinaturas`) + `components/pdf/templates/AepTemplate.tsx` |
| Formulário em Branco | `app/(aep)/aep/formulario-branco/page.tsx` |
| Sinalização | `lib/aep/sinalizacao.ts` + `app/(sinalizacao-psicossocial)/…` |
| Comercial | `lib/comercial/oportunidades.ts` + RPC `comercial_dados()` |
| Envio de riscos ao SGG (já existe, para a inspeção) | `app/api/sgg/enviar-riscos/route.ts` + `components/inspecoes/EnviarRiscosSgg.tsx` |
| Auditoria (já existe) | `lib/auditoria/registrar.ts` (`registrarAuditoria`) |

## 4. RLS das tabelas

- **`aep_relatorios`:**
  - SELECT, INSERT e UPDATE para **qualquer autenticado**;
  - DELETE só Admin (`caller_eh_admin()`, corrigido na v271);
  - policy **restritiva** `rls_modulo_ok('aep', …)`: quem não tem o módulo AEP não acessa.
- **O sistema não usa RLS multitenant por `empresa_id`.** O controle é por
  módulo (e por empresas vinculadas, para o perfil cliente). O item do
  "contrato de não regressão" que fala em "RLS multitenant por `empresa_id`
  com cast `::text`" **não se aplica**; tabelas novas devem seguir o padrão
  real:
  - policy permissiva para autenticado;
  - `rls_modulo_ok(<módulo>, <tabela>)` restritiva.
- **IDs:** o padrão do sistema é `PREFIXO-XXXXXXXX` para cadastros e uuid
  para alguns documentos (a AEP é uuid). Tabelas novas: `PREFIXO-XXXXXXXX`,
  como o prompt pede.
- **"Entrega de arquivos completos, nunca diffs":** não se aplica ao nosso
  fluxo. Edito direto no repositório, com commit, PR e deploy; os MDs para o
  painel continuam com arquivos completos ou diffs, como hoje.

## 5. O que já existe e se sobrepõe ao prompt

1. **DRPS (`lib/drps/topicos.ts`):** tem os **mesmos 13 fatores** como
   "Tópico 01…13", cada um com uma **fonte geradora padrão**. Tem ainda:
   - catálogos `drps_agravos` (≈ "danos à saúde");
   - `drps_medidas_recomendadas` e `drps_acao_oque/como` (≈ "sugestões e
     ações");
   - `psi_fontes_geradoras` (fontes digitadas, hoje com 1 registro).

   A biblioteca da Fase 2 **duplicaria** isso. Recomendo uma **biblioteca
   única dos 13 fatores**, usada pela AEP e, no futuro, alinhada ao DRPS/QPS.
2. **QPS (Questionários Psicossociais):**
   - questionários **configuráveis** (tipos → categorias → perguntas);
   - escala própria e régua do DRPS;
   - análise por setor e laudo.

   Hoje a coleta é por **importação de CSV do Google Forms** ou digitação: **não
   há rota pública de resposta**. O questionário anônimo da Fase 3 é, na
   prática, um QPS de 13 perguntas com coleta por QR.
3. **Envio ao SGG:** já existe para os riscos da inspeção, via webhook
   assinado (HMAC). A "exportação XLSX para lançamento no SGG" da Fase 2 pode
   virar **envio direto**, ou pelo menos usar as mesmas colunas, em vez de
   planilha manual.
4. **Auditoria:** `registrarAuditoria` já registra quem fez o quê e quando. O
   "log append-only de evidências" pode usar ela em vez de uma tabela nova.
5. **Rota pública:** só `/login` e `/f/[token]` (formulário público de
   solicitação da Gestão) passam sem login no `middleware.ts`. A Fase 3
   seria a primeira rota pública que **grava respostas anônimas**.

## 6. Avaliação por fase e onde encaixar

### Fase 1 — recomendo fazer como está, com 2 ajustes

**Motivo do N/I**
- Fica em `setor.motivo_ni = {fator: {motivo, texto?}}` (jsonb, sem migration).
- No editor, aparece ao marcar N/I.
- No laudo, entra na linha "Limitações da avaliação" da Triagem por Setor.
- Também vai para a IA.
- Não toca na matriz nem no Necessita AET.

**Condições da coleta**
- Fica em `setor.condicoes_coleta = {abordados, participantes, recusas,
  lideranca_presente, sinais_inibicao[], obs}`, no bloco "Participação dos
  trabalhadores".
- Validação: participantes ≤ abordados.
- **Ajuste 1:** o aviso de sugestão (marcar "Falta de abertura para escuta" e
  "Ambiente de tensão…" no Assédio) só aparece se o fator Assédio estiver
  **Sim**, porque os sinais só abrem com Sim. Senão o aviso sugere primeiro
  avaliar o fator.

**Roteiro de campo (Anexo B)**
- Fica numa constante TS ao lado dos sinais (`lib/aep/roteiro-campo.ts`).
- Painel recolhível por fator no editor.
- Impresso no Formulário em Branco.

**Regra DRPS ampliada (3.4)**
- Constante `DRPS_POR_RECEIO` em `sinalizacao.ts`.
- **Ajuste 2:** a regra é lida em 4 lugares, que devem continuar iguais entre
  si (aviso do editor, Sinalização, Comercial e IA). O Comercial é calculado no
  cliente a partir do jsonb, então funciona sem mexer na RPC.

**Risco de regressão:** baixo.
- A matriz e o Necessita AET não mudam.
- PDF e laudo ganham linhas novas.
- Pontos de atenção: o template do Puppeteer (`AepTemplate.tsx`) tem cópia
  própria do setor (`AepSetorLocal`), e os campos novos precisam entrar
  nele também.

### Fase 2 — recomendo com 3 simplificações

**Biblioteca**
- Fica numa **tabela catálogo** `psi_biblioteca_fatores` (chave = os 13
  fatores do sistema), com seed do Anexo A, leitura para autenticados e
  escrita só Admin, mais a tela de manutenção.
- Fica fora da AEP de propósito, para o DRPS/QPS poderem usar depois.

**Checklist de gestão**
- Fica numa **coluna jsonb nova** em `aep_relatorios` (`checklist_gestao`), com
  a migration v272.
- O anexo opcional vai para o bucket privado.

**Simplificação 1 — origem por FATOR, não por sinal**
- Marcar a origem em cada um dos até 5 sinais de cada fator multiplica os
  cliques (até 65 escolhas por setor).
- Proposta: um multiselect de origem **por fator "Sim"**. A confiança
  (Baixa/Média/Alta pelo nº de tipos distintos) sai igual.
- Se o RT exigir por sinal, dá para fazer, mas o editor fica bem mais pesado.

**Simplificação 2 — sem tabela nova de log**
- Usar `registrarAuditoria` para o rastro (quem marcou, quando, origem).

**Simplificação 3 — inventário no formato do SGG**
- Gerar o inventário nas **mesmas colunas do envio ao SGG** que já existe.
- Primeiro em XLSX (`xlsx` já está no projeto); depois avaliar envio direto.

**IA:** a instrução "selecione e adapte ações desta lista" encaixa bem no
prompt atual, sem quebrar as regras existentes.

### Fase 3 — recomendo redesenhar dentro do QPS

**Motivos**
- O QPS já tem tipos de questionário, perguntas, escala, análise por setor,
  laudo e régua do DRPS. Um questionário só da AEP criaria um segundo motor
  de questionário, com outra régua.
- A parte que falta é a **coleta anônima pública**:
  - token;
  - QR;
  - rota sem login;
  - gravação via servidor;
  - sem IP e sem horário;
  - k-anonimato ≥ 5;
  - prazo do link.

  Ela serve aos dois: o QPS ganha coleta própria (hoje depende do Google
  Forms), e a AEP usa um **tipo QPS "Triagem anônima AEP"** com as 13
  afirmações do Anexo D.

**Na AEP**
- O setor mostra o resultado (% "Frequentemente/Sempre" por fator, só com
  ≥ 5 respostas).
- Acima do limiar, o resultado sugere o fator com origem `questionario_anonimo`.

**Risco**
- É a primeira rota pública que grava dados. Precisa de:
  - service role só no servidor;
  - limitação de taxa;
  - prazo de validade;
  - anonimato real (nada de IP, user-agent nem horário).

  Merece revisão de segurança antes de ir ao ar.

## 7. Plano de migrations (a partir da v271)

| Versão | Fase | Conteúdo |
|---|---|---|
| — | 1 | nenhuma (tudo no jsonb do setor) |
| v272 | 2 | `psi_biblioteca_fatores` (catálogo + seed do Anexo A, RLS leitura autenticado / escrita Admin) |
| v273 | 2 | `aep_relatorios.checklist_gestao jsonb` + bucket privado de anexos de evidência (se aprovado) |
| v274 | 3 | coleta anônima do QPS: `qps_coletas` (token, setor, validade) + `qps_respostas_anonimas` (append-only: só INSERT via servidor, SELECT para o módulo) |

Todas idempotentes, com rollback em `scripts/sql/`.

## 8. Decisões pendentes (minha recomendação entre parênteses)

1. Ativar a regra de DRPS por receio/inibição (3.4)? *(sim)*
2. Origem da evidência por **fator** em vez de por sinal? *(sim, por fator)*
3. Biblioteca única dos 13 fatores, preparada para o DRPS/QPS usarem depois? *(sim)*
4. Fase 3 dentro do QPS, em vez de questionário próprio da AEP? *(sim)*
5. Limiar do questionário anônimo *(30%)* e prazo do link *(15 dias)*.
6. Confiança da evidência visível ao cliente na Sinalização? *(não, só interna, pelo menos no início)*
7. Quem edita a biblioteca: só Admin ou também o RT? *(Admin; o RT pede a alteração)*

**Próximo passo:** responder "aprovado, fase 1", com as decisões 1 e 2 se
quiser já deixá-las definidas.
