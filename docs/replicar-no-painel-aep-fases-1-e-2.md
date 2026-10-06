# Replicar no Painel SST: AEP com menos dependência de entrevistas — Fases 1 e 2

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-fases-1-e-2.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `5359be3` (Fase 1) e `4a0a1c6` (Fase 2) de 2026-10-06, já em produção lá.
> **Tem 1 migration** (v272, Passo 2) e **1 edge function** (`gerar-parecer-aep-ia`, Passo 4).

## Pré-requisitos

Aplique antes, se o painel ainda não tiver:

1. `replicar-no-painel-aep-sinais-e-matriz.md` (65 sinais, matriz 1 sinal = 1 nível)
2. `replicar-no-painel-aep-exclusao-e-comercial.md` (usa `caller_eh_admin()`, que a v272 também usa)

## O que faz

O problema: quando o trabalhador não fala (medo de represália), o técnico
marcava "Não" ou "N/I" e o fator sumia da matriz — o setor com mais medo saía
com menos risco. **Nada aqui muda a matriz AIHA, o "Necessita AET", a
Sinalização ou o Comercial** (eles leem os mesmos valores gravados).

### Fase 1 (sem migration — tudo no jsonb `setores`)

- **Motivo do N/I obrigatório**:
  - opções: receio de manifestação, trabalhadores ausentes, atividade não
    observada, outro (com texto);
  - o Salvar recusa N/I sem motivo;
  - no laudo/PDF vira o quadro "Limitações da avaliação".
- **Condições da coleta**:
  - abordados, participantes (≤ abordados), recusas (só número), liderança
    presente, 4 sinais de inibição e observação;
  - no laudo vira uma frase;
  - com inibição, o editor **sugere** (não marca) dois sinais do Assédio.
- **Roteiro de campo** por fator (perguntas indiretas + o que observar), no
  editor e no Formulário em Branco.
- **DRPS por receio** (`DRPS_POR_RECEIO = true`): recomenda DRPS/Questionário
  também quando há N/I por receio ou sinal de inibição.
- **IA** recebe limitações, condições e receio.

### Fase 2 (v272)

- **Biblioteca psicossocial** (`psi_biblioteca_fatores`):
  - 13 fatores, com seed do Anexo A;
  - leitura para todos, edição **só Admin** em `/aep/biblioteca`.
- **Checklist de gestão** (`aep_relatorios.checklist_gestao`, `/aep/[id]/gestao`):
  - G01–G26, respondido uma vez por AEP;
  - lacunas viram fonte geradora; itens evidenciados viram medida existente.
- **Origem da evidência por fator** e **confiança** Baixa/Média/Alta:
  - lacuna de gestão conta como documental;
  - aparece no editor, no laudo/PDF e na Sinalização.
- **Fontes geradoras** por fator: lacunas de gestão + marcadas da biblioteca.
- **Laudo/PDF**: detalhamento de cada fator "Sim".
- **Inventário psicossocial** XLSX/CSV (17 colunas) para o SGG.
- **IA** escolhe ações só da biblioteca (além de AET, DRPS e revisão).
- Trilha na **auditoria** (`registrarAuditoria`): checklist de gestão e origem da evidência.

## Passo 1: conferir o painel

| Usado | Conferir no painel |
|---|---|
| `normalizarSetor` em `lib/hooks/useAep.ts` **e** em `app/api/pdf/aep/[id]/route.ts` | os dois reconstroem o setor campo a campo — campo novo fora deles some |
| `AepSetorLocal` / `AepRelatorioLocal` em `components/pdf/templates/AepTemplate.tsx` | cópia própria do setor para o PDF |
| `recomendaQuestionario` em `lib/aep/sinalizacao.ts` | regra única do DRPS (editor, Sinalização, Comercial) |
| `caller_eh_admin()` no banco | a policy de escrita da biblioteca usa |
| `registrarAuditoria` em `lib/auditoria/registrar.ts`, `useIsAdmin` em `lib/hooks/useUsuario.ts` | mesmos nomes |
| `xlsx` no `package.json` | exportação do inventário |
| Laudos com N/I hoje | `select count(*) from aep_relatorios a, jsonb_array_elements(a.setores) st, jsonb_each_text(coalesce(st->'checklist_organizacional','{}'::jsonb)) f where f.value='nao_identificado';` — se houver, eles precisarão do motivo no próximo Salvar |

## Passo 2: migration v272 (banco do painel, nunca no do JCN)

Rollback no fim do bloco.

```sql
-- v272 (2026-10-06): Fase 2 da AEP com menos dependência de entrevistas.
--   • psi_biblioteca_fatores — biblioteca única dos 13 fatores psicossociais
--     (chave = a do sistema: assedio, falta_suporte…), com descrição do risco,
--     danos à saúde, fontes geradoras codificadas, meio de propagação,
--     situação/tempo de exposição padrão, sugestões iniciais e ações. Seed do
--     Anexo A do plano. Leitura para autenticados; escrita só Admin.
--     Preparada para o DRPS/QPS usarem depois (sem empresa_id).
--   • aep_relatorios.checklist_gestao — checklist de gestão por AEP
--     (G01–G26, catálogo em lib/aep/checklist-gestao.ts).
-- Idempotente: o seed não sobrescreve o que o Admin já editou.
-- Já aplicada via MCP. Rollback: scripts/sql/v272_rollback_biblioteca_psi_checklist_gestao.sql

create table if not exists public.psi_biblioteca_fatores (
  fator text primary key,
  ordem int not null,
  descricao_risco text not null default '',
  danos_saude text not null default '',
  meio_propagacao text not null default '',
  situacao_padrao text not null default '',
  tempo_exposicao_padrao text not null default '',
  medidas_controle_verificar text not null default '',
  fontes_geradoras jsonb not null default '[]'::jsonb,
  sugestoes_iniciais jsonb not null default '[]'::jsonb,
  acoes jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

alter table public.psi_biblioteca_fatores enable row level security;

drop policy if exists "autenticado le psi_biblioteca_fatores" on public.psi_biblioteca_fatores;
create policy "autenticado le psi_biblioteca_fatores" on public.psi_biblioteca_fatores
  for select to authenticated using (true);

drop policy if exists "admin grava psi_biblioteca_fatores" on public.psi_biblioteca_fatores;
create policy "admin grava psi_biblioteca_fatores" on public.psi_biblioteca_fatores
  for all to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());

alter table public.aep_relatorios add column if not exists checklist_gestao jsonb not null default '{}'::jsonb;

insert into public.psi_biblioteca_fatores
  (fator, ordem, descricao_risco, danos_saude, meio_propagacao, situacao_padrao, tempo_exposicao_padrao,
   medidas_controle_verificar, fontes_geradoras, sugestoes_iniciais, acoes)
values
  ('assedio', 1, 'Exposição a condutas abusivas, repetitivas ou pontuais, praticadas por superiores, colegas ou terceiros, como humilhações, constrangimentos, intimidações, cobranças vexatórias e desrespeito, que atentam contra a dignidade e a integridade psíquica do trabalhador e degradam o ambiente de trabalho.', 'Estresse, ansiedade, depressão, síndrome de burnout, transtorno de estresse pós-traumático, distúrbios do sono, queda da autoestima, sintomas psicossomáticos (cefaleia, distúrbios gastrointestinais) e, em casos graves, ideação suicida.', 'Relações interpessoais e práticas de gestão', 'Normal', 'Habitual e permanente',
   'A verificar em campo: política de prevenção ao assédio; canal de denúncia sigiloso; procedimento de apuração; capacitação de lideranças; ações da CIPA sobre prevenção ao assédio (NR-05 / Lei 14.457/2022).',
   '[{"codigo": "1.1", "texto": "Ausência de política formal de prevenção e enfrentamento ao assédio e às demais formas de violência no trabalho"}, {"codigo": "1.2", "texto": "Inexistência ou ineficácia de canal de denúncia com sigilo e garantia de não retaliação"}, {"codigo": "1.3", "texto": "Ausência de procedimento de apuração de denúncias e de aplicação de medidas"}, {"codigo": "1.4", "texto": "Estilo de gestão autoritário ou baseado em intimidação"}, {"codigo": "1.5", "texto": "Lideranças sem capacitação em gestão de pessoas, comunicação e feedback"}, {"codigo": "1.6", "texto": "Cultura organizacional que tolera ou naturaliza condutas desrespeitosas"}, {"codigo": "1.7", "texto": "Gestão de desempenho com exposição pública de resultados individuais"}]'::jsonb,
   '["Elaborar e divulgar política de prevenção e enfrentamento ao assédio", "Implantar canal de denúncia com sigilo e garantia de não retaliação", "Orientar as lideranças sobre condutas vedadas e cobranças adequadas", "Incluir o tema nas ações da CIPA"]'::jsonb,
   '["Formalizar procedimento de recebimento, apuração e resposta a denúncias", "Capacitar periodicamente as lideranças em gestão de pessoas, feedback e comunicação não violenta", "Realizar ações anuais de capacitação sobre assédio para todos os empregados", "Instituir código de conduta", "Monitorar indicadores (denúncias, afastamentos, rotatividade)"]'::jsonb),
  ('falta_suporte', 2, 'Insuficiência de apoio técnico, emocional e organizacional da liderança, do RH e dos colegas para a realização do trabalho e o enfrentamento de dificuldades, deixando o trabalhador sem orientação, acolhimento ou recursos para resolver problemas.', 'Estresse, ansiedade, sentimento de desamparo e insegurança, desmotivação, síndrome de burnout e aumento de erros e acidentes.', 'Organização do trabalho e práticas de gestão', 'Normal', 'Habitual e permanente',
   'A verificar em campo: rotinas de acompanhamento pela liderança; canal para reporte de dificuldades; programa de integração; atuação do RH em relações de trabalho.',
   '[{"codigo": "2.1", "texto": "Liderança com número excessivo de subordinados ou acúmulo de funções, o que limita sua disponibilidade"}, {"codigo": "2.2", "texto": "Ausência de rotinas estruturadas de acompanhamento (reuniões de alinhamento, conversas individuais)"}, {"codigo": "2.3", "texto": "RH com atuação restrita a processos administrativos, sem atuação em desenvolvimento e relações de trabalho"}, {"codigo": "2.4", "texto": "Ausência de canal formal para reporte de dificuldades e problemas operacionais"}, {"codigo": "2.5", "texto": "Ausência de referência técnica definida para as atividades"}, {"codigo": "2.6", "texto": "Tratamento de erros com foco punitivo, sem análise de causa e orientação"}, {"codigo": "2.7", "texto": "Ausência de programa de integração e acompanhamento de novos colaboradores"}]'::jsonb,
   '["Instituir reuniões periódicas de alinhamento com a equipe", "Definir referência técnica para cada atividade", "Divulgar formas de acesso ao RH e à liderança"]'::jsonb,
   '["Implantar rotina de conversas individuais periódicas entre líder e liderado", "Revisar o número de subordinados e as atribuições das lideranças", "Estruturar programa de integração e acompanhamento de novos colaboradores", "Adotar análise de causa dos erros, com abordagem orientativa e não punitiva", "Ampliar a atuação do RH em desenvolvimento e relações de trabalho"]'::jsonb),
  ('gestao_mudancas', 3, 'Implantação de mudanças organizacionais (estrutura, processos, tecnologias, quadro de pessoal ou lideranças) sem planejamento, comunicação adequada e participação dos trabalhadores, gerando incerteza, insegurança e retrabalho.', 'Estresse, ansiedade, insegurança quanto ao emprego, distúrbios do sono, desmotivação e síndrome de burnout.', 'Processos de gestão e comunicação organizacional', 'Normal', 'Intermitente (durante processos de mudança)',
   'A verificar em campo: procedimento de gestão de mudanças; registros de comunicação formal das mudanças; capacitações associadas.',
   '[{"codigo": "3.1", "texto": "Ausência de procedimento formal de gestão de mudanças"}, {"codigo": "3.2", "texto": "Comunicação das mudanças não planejada, tardia ou restrita a parte da equipe"}, {"codigo": "3.3", "texto": "Ausência de consulta ou participação dos trabalhadores afetados"}, {"codigo": "3.4", "texto": "Mudanças implementadas sem cronograma, responsáveis e período de transição definidos"}, {"codigo": "3.5", "texto": "Ausência de capacitação para novos processos, sistemas ou funções"}, {"codigo": "3.6", "texto": "Reestruturações sem redefinição formal de funções e responsabilidades"}, {"codigo": "3.7", "texto": "Ausência de canal para esclarecimento de dúvidas durante a transição"}]'::jsonb,
   '["Comunicar formalmente as mudanças antes da implantação", "Disponibilizar canal para esclarecimento de dúvidas", "Envolver os trabalhadores afetados no planejamento"]'::jsonb,
   '["Estabelecer procedimento de gestão de mudanças com avaliação prévia dos impactos em SST, com reavaliação dos riscos conforme a NR-01", "Definir cronograma, responsáveis e período de transição para cada mudança", "Capacitar os trabalhadores antes da implantação de novos processos ou sistemas", "Revisar descrições de cargo após reestruturações"]'::jsonb),
  ('clareza_papel', 4, 'Indefinição ou ambiguidade quanto às atribuições, responsabilidades, autoridade e resultados esperados, incluindo instruções conflitantes e subordinação a mais de uma chefia.', 'Estresse, ansiedade, frustração, conflitos interpessoais, retrabalho, aumento de erros e síndrome de burnout.', 'Organização do trabalho', 'Normal', 'Habitual e permanente',
   'A verificar em campo: descrição de cargos; organograma divulgado; POPs/ITs; fluxo de repasse de instruções.',
   '[{"codigo": "4.1", "texto": "Ausência de descrição formal de cargos e atribuições"}, {"codigo": "4.2", "texto": "Estrutura hierárquica não definida ou não divulgada (organograma)"}, {"codigo": "4.3", "texto": "Sobreposição de chefias (duplo comando)"}, {"codigo": "4.4", "texto": "Ausência de procedimentos operacionais padronizados (POP/IT)"}, {"codigo": "4.5", "texto": "Ausência de fluxo formal para repasse de instruções"}, {"codigo": "4.6", "texto": "Integração inicial insuficiente quanto às atribuições do cargo"}, {"codigo": "4.7", "texto": "Acúmulo ou desvio de funções não formalizado"}]'::jsonb,
   '["Divulgar o organograma às equipes", "Definir uma única chefia de referência para cada trabalhador", "Padronizar o repasse de instruções"]'::jsonb,
   '["Elaborar ou revisar as descrições de cargo e entregá-las formalmente", "Elaborar POPs/ITs para as atividades críticas", "Formalizar o fluxo de repasse de instruções", "Revisar o conteúdo da integração quanto às atribuições do cargo", "Formalizar ou eliminar acúmulos e desvios de função"]'::jsonb),
  ('recompensas', 5, 'Desequilíbrio entre o esforço exigido do trabalhador e as recompensas recebidas, como remuneração, reconhecimento, feedback e oportunidades de desenvolvimento e crescimento.', 'Desmotivação, estresse, ansiedade, depressão, insatisfação com o trabalho e síndrome de burnout.', 'Políticas de gestão de pessoas', 'Normal', 'Habitual e permanente',
   'A verificar em campo: plano de cargos e salários; avaliação de desempenho; práticas de reconhecimento; plano de capacitação.',
   '[{"codigo": "5.1", "texto": "Ausência de plano de cargos, carreira e salários"}, {"codigo": "5.2", "texto": "Ausência de processo estruturado de avaliação de desempenho e feedback"}, {"codigo": "5.3", "texto": "Inexistência de práticas de reconhecimento, formais ou informais"}, {"codigo": "5.4", "texto": "Critérios de promoção e remuneração variável não definidos ou não divulgados"}, {"codigo": "5.5", "texto": "Metas focadas exclusivamente em resultado, sem considerar esforço e condições de trabalho"}, {"codigo": "5.6", "texto": "Ausência de programa de desenvolvimento e capacitação profissional"}]'::jsonb,
   '["Instituir feedback periódico, e não apenas diante de erros", "Reconhecer formalmente bons resultados e esforços", "Divulgar os critérios de promoção existentes"]'::jsonb,
   '["Implantar processo estruturado de avaliação de desempenho", "Elaborar plano de cargos, carreira e salários", "Instituir programa de reconhecimento", "Elaborar plano anual de capacitação e desenvolvimento", "Revisar as metas, considerando esforço e condições de trabalho"]'::jsonb),
  ('baixo_controle', 6, 'Pouca possibilidade de o trabalhador influenciar o modo, o ritmo, a ordem e os métodos de execução das tarefas e de participar das decisões relacionadas ao próprio trabalho.', 'Estresse, ansiedade, desmotivação, sentimento de desvalorização, síndrome de burnout e maior risco de doenças cardiovasculares quando associado a altas demandas.', 'Organização do trabalho e modelo de gestão', 'Normal', 'Habitual e permanente',
   'A verificar em campo: alçadas de decisão definidas; mecanismos de participação dos trabalhadores; tratamento dado aos erros.',
   '[{"codigo": "6.1", "texto": "Centralização das decisões em poucos níveis hierárquicos"}, {"codigo": "6.2", "texto": "Modelo de gestão baseado em controle detalhado (microgerenciamento)"}, {"codigo": "6.3", "texto": "Ausência de delegação formal e de alçadas de decisão definidas"}, {"codigo": "6.4", "texto": "Métodos e ritmo de trabalho impostos sem participação dos trabalhadores"}, {"codigo": "6.5", "texto": "Ausência de participação dos trabalhadores no planejamento das atividades"}, {"codigo": "6.6", "texto": "Cultura punitiva em relação ao erro"}, {"codigo": "6.7", "texto": "Ausência de capacitação para atuação autônoma"}]'::jsonb,
   '["Definir o que cada função pode decidir sem consulta prévia", "Ouvir a equipe antes de decisões que afetam o trabalho"]'::jsonb,
   '["Formalizar delegação e alçadas de decisão", "Implementar mecanismos de participação (reuniões de equipe, programa de sugestões)", "Capacitar as equipes para atuação autônoma", "Revisar o modelo de supervisão, reduzindo controles e revisões excessivos", "Tratar os erros como oportunidade de aprendizado"]'::jsonb),
  ('justica_organizacional', 7, 'Percepção de falta de imparcialidade, transparência e coerência nas decisões, na distribuição de tarefas, recursos e benefícios e na aplicação de regras e punições.', 'Estresse, ansiedade, depressão, desmotivação, sentimento de injustiça, conflitos interpessoais e síndrome de burnout.', 'Processos decisórios e práticas de gestão', 'Normal', 'Habitual e permanente',
   'A verificar em campo: critérios formais de decisão; transparência na comunicação; canal de contestação.',
   '[{"codigo": "7.1", "texto": "Critérios de decisão não definidos ou não divulgados (escalas, folgas, distribuição de tarefas, promoções, punições)"}, {"codigo": "7.2", "texto": "Ausência de transparência na comunicação das decisões"}, {"codigo": "7.3", "texto": "Aplicação desigual de regras e políticas internas"}, {"codigo": "7.4", "texto": "Ausência de canal para contestação ou revisão de decisões"}, {"codigo": "7.5", "texto": "Relações pessoais influenciando decisões de gestão"}, {"codigo": "7.6", "texto": "Ausência de procedimento para gestão de conflitos"}]'::jsonb,
   '["Comunicar os critérios utilizados nas decisões", "Aplicar as regras de forma uniforme a todos"]'::jsonb,
   '["Formalizar e divulgar critérios para escalas, folgas, distribuição de tarefas, promoções e punições", "Implantar canal para contestação ou revisão de decisões", "Estabelecer procedimento de gestão de conflitos", "Capacitar as lideranças em tomada de decisão imparcial"]'::jsonb),
  ('eventos_traumaticos', 8, 'Possibilidade de exposição a agressões verbais ou físicas, ameaças, assaltos ou outros eventos traumáticos, praticados por clientes, público ou terceiros, ou presenciados durante o trabalho.', 'Transtorno de estresse agudo, transtorno de estresse pós-traumático, ansiedade, depressão, fobias, distúrbios do sono e lesões físicas em caso de agressão.', 'Contato direto com público ou terceiros e ambiente externo', 'Normal e emergência', 'Eventual',
   'A verificar em campo: protocolos de segurança e de resposta a incidentes; treinamento em manejo de conflitos; medidas de segurança patrimonial; registro de ocorrências.',
   '[{"codigo": "8.1", "texto": "Atividade com atendimento ao público em situações potencialmente conflituosas (cobranças, reclamações, negativas)"}, {"codigo": "8.2", "texto": "Atividade com exposição a violência externa (manuseio de valores, trabalho noturno, locais com histórico de ocorrências)"}, {"codigo": "8.3", "texto": "Ausência de protocolos de segurança e de resposta a incidentes"}, {"codigo": "8.4", "texto": "Ausência de treinamento em manejo de conflitos e situações de risco"}, {"codigo": "8.5", "texto": "Medidas de segurança patrimonial inexistentes ou inadequadas"}, {"codigo": "8.6", "texto": "Ausência de registro e investigação de incidentes de violência"}, {"codigo": "8.7", "texto": "Ausência de suporte psicológico após eventos"}]'::jsonb,
   '["Elaborar protocolo de conduta para situações de conflito ou violência", "Registrar todas as ocorrências, inclusive as informais"]'::jsonb,
   '["Treinar os trabalhadores em manejo de conflitos e situações de risco", "Implantar medidas de segurança patrimonial (controle de acesso, CFTV, botão de pânico, conforme o caso)", "Estabelecer procedimento de resposta a incidentes, incluindo emissão de CAT quando aplicável", "Disponibilizar suporte psicológico após eventos", "Investigar os incidentes e revisar as medidas"]'::jsonb),
  ('subcarga', 9, 'Volume de trabalho, conteúdo das tarefas ou exigência cognitiva insuficientes ou incompatíveis com a qualificação do trabalhador, incluindo períodos ociosos frequentes e tarefas monótonas.', 'Tédio, desmotivação, ansiedade, sentimento de inutilidade, redução da atenção (com aumento de erros e acidentes) e depressão.', 'Organização do trabalho (conteúdo e distribuição das tarefas)', 'Normal', 'Habitual e intermitente',
   'A verificar em campo: planejamento e distribuição das demandas; rodízio de tarefas; adequação entre função e qualificação.',
   '[{"codigo": "9.1", "texto": "Planejamento e distribuição inadequados das demandas entre colaboradores e setores"}, {"codigo": "9.2", "texto": "Variação sazonal da produção sem realocação de pessoal"}, {"codigo": "9.3", "texto": "Dimensionamento de quadro acima da demanda"}, {"codigo": "9.4", "texto": "Alocação de profissionais em funções incompatíveis com sua qualificação"}, {"codigo": "9.5", "texto": "Tarefas fragmentadas, repetitivas e de baixo conteúdo"}, {"codigo": "9.6", "texto": "Ausência de rodízio ou de enriquecimento de tarefas"}, {"codigo": "9.7", "texto": "Tempos de espera por dependência de etapas anteriores, insumos ou sistemas"}]'::jsonb,
   '["Redistribuir as demandas entre trabalhadores e setores", "Aproveitar períodos ociosos para capacitação"]'::jsonb,
   '["Revisar o planejamento e a distribuição das demandas", "Implantar rodízio e enriquecimento de tarefas", "Adequar a alocação dos profissionais à sua qualificação", "Elaborar plano de ação para períodos de baixa produção", "Revisar o dimensionamento do quadro"]'::jsonb),
  ('sobrecarga', 10, 'Volume de trabalho, ritmo, prazos ou metas superiores à capacidade do trabalhador ou da equipe dentro da jornada, com acúmulo de atividades e sensação de urgência permanente.', 'Estresse, fadiga física e mental, ansiedade, distúrbios do sono, síndrome de burnout, LER/DORT associadas a ritmo intenso, hipertensão arterial e doenças cardiovasculares, além de aumento de acidentes.', 'Organização do trabalho (volume, ritmo, prazos e metas)', 'Normal', 'Habitual e permanente',
   'A verificar em campo: dimensionamento do quadro; controle de jornada e horas extras; critérios de definição de metas; cobertura de ausências.',
   '[{"codigo": "10.1", "texto": "Dimensionamento de quadro insuficiente para o volume de trabalho"}, {"codigo": "10.2", "texto": "Acúmulo de funções"}, {"codigo": "10.3", "texto": "Metas e prazos definidos sem considerar a capacidade produtiva"}, {"codigo": "10.4", "texto": "Planejamento deficiente, gerando urgências recorrentes"}, {"codigo": "10.5", "texto": "Ausência de cobertura para ausências (férias, afastamentos, desligamentos)"}, {"codigo": "10.6", "texto": "Jornadas prolongadas ou horas extras habituais"}, {"codigo": "10.7", "texto": "Interrupções frequentes durante a execução das tarefas"}]'::jsonb,
   '["Priorizar as demandas em conjunto com a liderança", "Acompanhar a realização de horas extras"]'::jsonb,
   '["Revisar o dimensionamento do quadro", "Definir metas e prazos com base na capacidade produtiva", "Estabelecer plano de cobertura para férias e afastamentos", "Controlar jornada e horas extras habituais", "Reduzir interrupções durante a execução das tarefas"]'::jsonb),
  ('maus_relacionamentos', 11, 'Relações interpessoais conflituosas, desrespeitosas ou distantes entre colegas e/ou com a liderança, com conflitos não tratados e baixa cooperação.', 'Estresse, ansiedade, irritabilidade, depressão, isolamento social e síndrome de burnout.', 'Relações interpessoais', 'Normal', 'Habitual e permanente',
   'A verificar em campo: procedimento de gestão de conflitos; código de conduta; ações de integração; atuação das lideranças diante de conflitos.',
   '[{"codigo": "11.1", "texto": "Ausência de procedimento para gestão de conflitos"}, {"codigo": "11.2", "texto": "Lideranças que não intervêm em conflitos ou não têm capacitação para isso"}, {"codigo": "11.3", "texto": "Ausência de código de conduta ou de normas de convivência"}, {"codigo": "11.4", "texto": "Organização do trabalho que estimula a competição entre colegas (metas individuais concorrentes)"}, {"codigo": "11.5", "texto": "Ausência de ações de integração entre equipes"}, {"codigo": "11.6", "texto": "Indefinição de responsabilidades, gerando atritos entre colegas"}]'::jsonb,
   '["Orientar as lideranças a intervir precocemente nos conflitos", "Estabelecer normas de convivência com as equipes"]'::jsonb,
   '["Estabelecer procedimento de gestão de conflitos", "Instituir código de conduta", "Capacitar as lideranças em mediação de conflitos", "Promover ações de integração entre equipes", "Revisar metas que estimulam competição entre colegas"]'::jsonb),
  ('comunicacao_dificil', 12, 'Fluxos de informação deficientes, informais ou inexistentes, com informações divergentes, incompletas ou que não chegam a todos, dificultando a execução segura e eficiente do trabalho.', 'Estresse, ansiedade, frustração, conflitos interpessoais e aumento de erros e acidentes.', 'Sistemas e fluxos de comunicação', 'Normal', 'Habitual e permanente',
   'A verificar em campo: canais formais de comunicação; registros de passagem de turno; reuniões de alinhamento; pontos focais definidos.',
   '[{"codigo": "12.1", "texto": "Ausência de canais formais de comunicação"}, {"codigo": "12.2", "texto": "Fluxo de informação não definido (quem informa, a quem e por qual meio)"}, {"codigo": "12.3", "texto": "Ausência de registros e documentação das informações operacionais"}, {"codigo": "12.4", "texto": "Ausência de reuniões de alinhamento ou de passagem de turno"}, {"codigo": "12.5", "texto": "Barreiras físicas ou organizacionais (ruído, distância entre setores, turnos distintos)"}, {"codigo": "12.6", "texto": "Ferramentas e sistemas de comunicação inadequados ou insuficientes"}]'::jsonb,
   '["Definir os canais oficiais de comunicação", "Realizar reuniões curtas de alinhamento ou de passagem de turno"]'::jsonb,
   '["Elaborar matriz de comunicação (quem informa, a quem, quando e por qual meio)", "Implantar registros formais (livro de passagem de turno, quadro de avisos)", "Adequar as ferramentas de comunicação", "Definir pontos focais por setor ou atividade"]'::jsonb),
  ('trabalho_remoto', 13, 'Realização do trabalho fora das instalações da empresa ou em local isolado, com contato reduzido com colegas e liderança, o que dificulta integração, suporte e alinhamento de informações e, no trabalho isolado, o socorro em emergências.', 'Isolamento social, solidão, ansiedade, depressão, estresse, dificuldade de desconexão com prolongamento da jornada e síndrome de burnout; no trabalho isolado, agravamento de lesões por demora no socorro.', 'Organização do trabalho e meios de comunicação à distância', 'Normal e emergência (trabalho isolado)', 'Habitual e permanente',
   'A verificar em campo: política de teletrabalho; rotinas de contato com a equipe; sistema de comunicação e monitoramento do trabalhador isolado; protocolo de emergência.',
   '[{"codigo": "13.1", "texto": "Ausência de política de teletrabalho (rotinas, disponibilidade, direito à desconexão)"}, {"codigo": "13.2", "texto": "Ausência de rotinas de contato síncrono com a equipe e a liderança"}, {"codigo": "13.3", "texto": "Ausência de ações de integração para trabalhadores remotos"}, {"codigo": "13.4", "texto": "Ferramentas de comunicação inadequadas"}, {"codigo": "13.5", "texto": "Trabalho em local fisicamente isolado, sem contato regular com outras pessoas"}, {"codigo": "13.6", "texto": "Ausência de sistema de comunicação e monitoramento para trabalhador isolado"}, {"codigo": "13.7", "texto": "Ausência de protocolo de emergência para trabalho isolado"}]'::jsonb,
   '["Estabelecer rotina de contato síncrono com a equipe", "Instituir check-in periódico para trabalhadores isolados"]'::jsonb,
   '["Elaborar política de teletrabalho (CLT, art. 75-A e seguintes), incluindo direito à desconexão", "Promover ações periódicas de integração", "Disponibilizar ferramentas de comunicação adequadas", "Implantar sistema de comunicação e monitoramento para trabalho isolado", "Estabelecer protocolo de emergência para trabalho isolado"]'::jsonb)
on conflict (fator) do nothing;
```

Rollback (⚠️ apaga edições da biblioteca e respostas do checklist de gestão):

```sql
-- Rollback da v272. ⚠️ Apaga as edições da biblioteca e as respostas do
-- checklist de gestão de todas as AEPs. Exporte antes se precisar guardar.
alter table public.aep_relatorios drop column if exists checklist_gestao;
drop table if exists public.psi_biblioteca_fatores;
```

## Passo 3: código

Arquivos **novos** (completos) primeiro, depois os **diffs** dos alterados
(já somando Fase 1 + Fase 2).

| Seção | Arquivo | O quê |
|---|---|---|
| A | `lib/aep/coleta.ts` | **novo**: motivo do N/I, condições da coleta, regra DRPS por receio |
| B | `lib/aep/coleta.test.ts` | **novo**: testes da Fase 1 |
| C | `lib/aep/roteiro-campo.ts` | **novo**: roteiro de campo (Anexo B) |
| D | `lib/aep/checklist-gestao.ts` | **novo**: checklist de gestão G01–G26 (Anexo C) |
| E | `lib/aep/evidencia.ts` | **novo**: origem da evidência e confiança |
| F | `lib/aep/biblioteca.ts` | **novo**: tipos e normalização da biblioteca |
| G | `lib/aep/inventario.ts` | **novo**: detalhe por fator e inventário (XLSX/CSV) |
| H | `lib/aep/inventario.test.ts` | **novo**: testes da Fase 2 |
| I | `lib/hooks/useBibliotecaPsi.ts` | **novo**: hook da biblioteca |
| J | `components/aep/AepChecklistGestao.tsx` | **novo**: tela do checklist de gestão |
| K | `app/(aep)/aep/[idRelatorio]/gestao/page.tsx` | **novo**: rota do checklist |
| L | `app/(aep)/aep/biblioteca/page.tsx` | **novo**: página da biblioteca (edição só Admin) |
| M | `lib/supabase/types.ts` | campos novos de AepSetor e AepRelatorio |
| N | `lib/hooks/useAep.ts` | normalizador conhece os campos novos |
| O | `lib/aep/sinalizacao.ts` | DRPS por receio + confiança na Sinalização |
| P | `components/aep/AepSetoresEditor.tsx` | editor: motivo do N/I, coleta, roteiro, evidência, IA, auditoria |
| Q | `components/aep/SinalizacaoEmpresaDetalhe.tsx` | confiança na Sinalização |
| R | `app/(aep)/aep/[idRelatorio]/laudo/page.tsx` | laudo: coleta, limitações, detalhamento, inventário |
| S | `app/api/pdf/aep/[id]/route.ts` | PDF: normalizador + biblioteca |
| T | `components/pdf/templates/AepTemplate.tsx` | PDF: coleta, limitações, detalhamento |
| U | `app/(aep)/aep/formulario-branco/page.tsx` | formulário em branco: coleta, roteiro, motivo do N/I |
| V | `components/formulario-branco/primitivos.tsx` | estilos do roteiro no formulário |
| W | `app/(aep)/layout.tsx` | menu: Checklist de gestão e Biblioteca |
| X | `components/inspecoes/editor/tabs/ErgonomiaTab.tsx` | sub-aba Checklist de gestão na inspeção |

### A: `lib/aep/coleta.ts` (novo, completo)

```ts
/**
 * Condições da coleta e motivo do N/I na triagem da AEP (Fase 1 do plano
 * "AEP com menos dependência de entrevistas", 2026-10-06).
 *
 * O problema: quando o trabalhador não fala (medo de represália), o técnico
 * marcava "Não" ou "N/I" e o fator sumia da matriz — o setor com mais medo
 * saía com menos risco. Aqui ficam:
 *   • o MOTIVO de cada N/I da Ergonomia Organizacional (obrigatório);
 *   • as CONDIÇÕES DA COLETA do setor (abordados, participantes, recusas,
 *     liderança presente, sinais de inibição);
 *   • as frases que o laudo e a IA usam;
 *   • a regra que faz o receio de manifestação recomendar DRPS/Questionário.
 *
 * Nada aqui mexe na matriz AIHA nem no "Necessita AET": N/I continua fora
 * deles. Módulo PURO (sem hook): roda na tela, no laudo e no PDF.
 *
 * ⚠️ As chaves (`receio_manifestacao`, `lideranca_olhar`…) ficam gravadas em
 * `aep_relatorios.setores` (jsonb). Mudar `label` é livre; mudar chave não.
 */

export type MotivoNi = "receio_manifestacao" | "ausencia_trabalhadores" | "atividade_nao_observada" | "outro";

export const MOTIVOS_NI: { key: MotivoNi; label: string }[] = [
  { key: "receio_manifestacao", label: "Receio dos trabalhadores em se manifestar" },
  { key: "ausencia_trabalhadores", label: "Trabalhadores ausentes no momento da avaliação" },
  { key: "atividade_nao_observada", label: "Atividade não realizada/observada durante a visita" },
  { key: "outro", label: "Outro" },
];

export interface MotivoNiFator {
  motivo: MotivoNi | "";
  /** Obrigatório quando o motivo é "outro"; opcional nos demais. */
  texto?: string;
}

export const SINAIS_INIBICAO: { key: string; label: string }[] = [
  { key: "respostas_padronizadas", label: "Respostas padronizadas/ensaiadas, sem exemplos concretos" },
  { key: "silencio_lideranca", label: "Silêncio ou mudança de comportamento com a aproximação da liderança" },
  { key: "lideranca_olhar", label: "Trabalhadores olham para a liderança antes de responder" },
  { key: "recusa_participar", label: "Recusa em participar ou pedido para “não se envolver”" },
];

export interface CondicoesColeta {
  trab_abordados?: number | null;
  trab_participantes?: number | null;
  /** Só o número — sem identificar ninguém. */
  recusas_evasivas?: number | null;
  lideranca_presente?: boolean | null;
  sinais_inibicao?: string[];
  obs_coleta?: string;
}

/** Sinais do fator Assédio que o aviso de inibição sugere (o técnico decide). */
export const SINAIS_SUGERIDOS_INIBICAO = ["sem_escuta", "tensao_silencio"] as const;

/**
 * Recomendar DRPS/Questionário também quando há receio de manifestação
 * (N/I com esse motivo) ou sinais de inibição na coleta, além dos 3+ "Sim".
 * Decisão do usuário em 2026-10-06 (aprovou a Fase 1 com esta regra).
 */
export const DRPS_POR_RECEIO = true;

const rotuloMotivo = (m: string) => MOTIVOS_NI.find((x) => x.key === m)?.label ?? null;

// ─── Normalização (lixo no jsonb não vira erro de tela) ──────────────────────

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

export function normalizarMotivoNi(raw: unknown): Record<string, MotivoNiFator> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, MotivoNiFator> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const m = (v as { motivo?: unknown }).motivo;
    const t = (v as { texto?: unknown }).texto;
    out[k] = {
      motivo: MOTIVOS_NI.some((x) => x.key === m) ? (m as MotivoNi) : "",
      ...(typeof t === "string" && t ? { texto: t } : {}),
    };
  }
  return out;
}

export function normalizarCondicoesColeta(raw: unknown): CondicoesColeta {
  if (typeof raw !== "object" || raw === null) return {};
  const c = raw as Record<string, unknown>;
  return {
    trab_abordados: num(c.trab_abordados),
    trab_participantes: num(c.trab_participantes),
    recusas_evasivas: num(c.recusas_evasivas),
    lideranca_presente: typeof c.lideranca_presente === "boolean" ? c.lideranca_presente : null,
    sinais_inibicao: Array.isArray(c.sinais_inibicao)
      ? c.sinais_inibicao.filter((x): x is string => typeof x === "string" && SINAIS_INIBICAO.some((s) => s.key === x))
      : [],
    obs_coleta: typeof c.obs_coleta === "string" ? c.obs_coleta : "",
  };
}

// ─── Regras ───────────────────────────────────────────────────────────────────

/** Recorte do setor que estas regras leem (casa com AepSetor e AepSetorLocal). */
export interface SetorColeta {
  nome_setor?: string | null;
  checklist_organizacional?: Record<string, string | null | undefined> | object | null;
  motivo_ni?: Record<string, MotivoNiFator> | null;
  condicoes_coleta?: CondicoesColeta | null;
}

const checklistOrg = (s: SetorColeta) => (s.checklist_organizacional ?? {}) as Record<string, string | null | undefined>;

/** Fatores marcados N/I sem motivo válido (ou "outro" sem texto). */
export function niSemMotivo(s: SetorColeta): string[] {
  return Object.entries(checklistOrg(s))
    .filter(([, v]) => v === "nao_identificado")
    .map(([k]) => k)
    .filter((k) => {
      const m = s.motivo_ni?.[k];
      if (!m?.motivo) return true;
      return m.motivo === "outro" && !(m.texto ?? "").trim();
    });
}

/** Participantes acima dos abordados — o editor avisa. */
export function participantesExcedem(c: CondicoesColeta | null | undefined): boolean {
  const a = c?.trab_abordados;
  const p = c?.trab_participantes;
  return typeof a === "number" && typeof p === "number" && p > a;
}

/** Algum N/I por receio de manifestação ou sinal de inibição na coleta. */
export function temReceioManifestacao(s: SetorColeta): boolean {
  const org = checklistOrg(s);
  const niReceio = Object.entries(s.motivo_ni ?? {}).some(
    ([k, m]) => org[k] === "nao_identificado" && m?.motivo === "receio_manifestacao",
  );
  return niReceio || (s.condicoes_coleta?.sinais_inibicao?.length ?? 0) > 0;
}

/**
 * Linhas "Limitações da avaliação" do setor: um item por fator N/I, com o
 * motivo. `rotuloFator` traduz a chave do fator para o nome do fator.
 */
export function limitacoesDaAvaliacao(s: SetorColeta, rotuloFator: (k: string) => string): string[] {
  return Object.entries(checklistOrg(s))
    .filter(([, v]) => v === "nao_identificado")
    .map(([k]) => {
      const m = s.motivo_ni?.[k];
      const motivo = m?.motivo === "outro" ? (m.texto ?? "").trim() || "Outro" : (m?.motivo && rotuloMotivo(m.motivo)) || "motivo não informado";
      const extra = m?.motivo && m.motivo !== "outro" && (m.texto ?? "").trim() ? ` (${(m.texto ?? "").trim()})` : "";
      return `${rotuloFator(k)}: não identificável — ${motivo}${extra}`;
    });
}

/**
 * Frase agregada das condições da coleta para o laudo. Sem nada preenchido,
 * devolve null (a linha não aparece).
 */
export function fraseCondicoesColeta(c: CondicoesColeta | null | undefined): string | null {
  if (!c) return null;
  const partes: string[] = [];
  const a = c.trab_abordados;
  const p = c.trab_participantes;
  if (typeof a === "number" && a > 0) {
    partes.push(
      typeof p === "number"
        ? `Foram abordados ${a} trabalhador${a === 1 ? "" : "es"}, dos quais ${p} participa${p === 1 ? "ou" : "ram"} da coleta`
        : `Foram abordados ${a} trabalhador${a === 1 ? "" : "es"}`,
    );
  } else if (typeof p === "number" && p > 0) {
    partes.push(`Participaram da coleta ${p} trabalhador${p === 1 ? "" : "es"}`);
  }
  const r = c.recusas_evasivas;
  if (typeof r === "number" && r > 0) {
    partes.push(`${r} recusa${r === 1 ? "" : "s"} ou resposta${r === 1 ? "" : "s"} evasiva${r === 1 ? "" : "s"}`);
  }
  if (c.lideranca_presente === true) partes.push("a coleta ocorreu com a liderança presente");

  const frases: string[] = [];
  if (partes.length) {
    const [primeira, ...resto] = partes;
    frases.push(`${resto.length ? `${primeira}; ${resto.join("; ")}` : primeira}.`);
  }
  if ((c.sinais_inibicao?.length ?? 0) > 0) {
    const sinais = SINAIS_INIBICAO.filter((s) => c.sinais_inibicao!.includes(s.key)).map((s) => s.label.toLowerCase());
    frases.push(
      `Durante a coleta, observou-se receio dos trabalhadores em se manifestar${
        c.lideranca_presente ? " na presença da liderança" : ""
      } (${sinais.join("; ")}).`,
    );
  }
  if ((c.obs_coleta ?? "").trim()) frases.push((c.obs_coleta ?? "").trim());
  return frases.length ? frases.join(" ") : null;
}
```

### B: `lib/aep/coleta.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fraseCondicoesColeta,
  limitacoesDaAvaliacao,
  niSemMotivo,
  normalizarCondicoesColeta,
  normalizarMotivoNi,
  participantesExcedem,
  temReceioManifestacao,
} from "./coleta";
import { recomendaQuestionario } from "./sinalizacao";
import { ROTEIRO_CAMPO } from "./roteiro-campo";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import type { AepRelatorio } from "@/lib/supabase/types";

const rot = (k: string) => ({ assedio: "Assédio", sobrecarga: "Sobrecarga" })[k] ?? k;

test("N/I sem motivo e 'outro' sem texto são cobrados; com motivo, não", () => {
  const s = {
    checklist_organizacional: { assedio: "nao_identificado", sobrecarga: "nao_identificado", subcarga: "nao_identificado", recompensas: "sim" },
    motivo_ni: {
      assedio: { motivo: "receio_manifestacao" as const },
      sobrecarga: { motivo: "outro" as const, texto: "  " },
    },
  };
  assert.deepEqual(niSemMotivo(s), ["sobrecarga", "subcarga"]);
});

test("receio: N/I com motivo de receio ou sinal de inibição; motivo de fator que não é mais N/I não conta", () => {
  assert.equal(
    temReceioManifestacao({ checklist_organizacional: { assedio: "nao_identificado" }, motivo_ni: { assedio: { motivo: "receio_manifestacao" } } }),
    true,
  );
  assert.equal(
    temReceioManifestacao({ checklist_organizacional: { assedio: "sim" }, motivo_ni: { assedio: { motivo: "receio_manifestacao" } } }),
    false,
  );
  assert.equal(temReceioManifestacao({ condicoes_coleta: { sinais_inibicao: ["lideranca_olhar"] } }), true);
  assert.equal(temReceioManifestacao({ condicoes_coleta: { sinais_inibicao: [] } }), false);
});

test("DRPS: 3+ 'Sim' como antes, ou receio de manifestação em algum setor", () => {
  const base = { checklist_organizacional: { assedio: "sim" } };
  const setores = (xs: object[]) => xs as unknown as AepRelatorio["setores"];
  assert.equal(recomendaQuestionario(setores([base])), false);
  assert.equal(recomendaQuestionario(setores([base, base, base])), true);
  assert.equal(recomendaQuestionario(setores([{ ...base, condicoes_coleta: { sinais_inibicao: ["recusa_participar"] } }])), true);
});

test("limitações da avaliação trazem o motivo de cada N/I", () => {
  const l = limitacoesDaAvaliacao(
    {
      checklist_organizacional: { assedio: "nao_identificado", sobrecarga: "nao_identificado", subcarga: "nao" },
      motivo_ni: { assedio: { motivo: "receio_manifestacao" }, sobrecarga: { motivo: "outro", texto: "turno noturno" } },
    },
    rot,
  );
  assert.deepEqual(l, [
    "Assédio: não identificável — Receio dos trabalhadores em se manifestar",
    "Sobrecarga: não identificável — turno noturno",
  ]);
});

test("frase das condições da coleta", () => {
  assert.equal(fraseCondicoesColeta({}), null);
  assert.equal(
    fraseCondicoesColeta({
      trab_abordados: 8,
      trab_participantes: 5,
      recusas_evasivas: 2,
      lideranca_presente: true,
      sinais_inibicao: ["lideranca_olhar"],
    }),
    "Foram abordados 8 trabalhadores, dos quais 5 participaram da coleta; 2 recusas ou respostas evasivas; a coleta ocorreu com a liderança presente. Durante a coleta, observou-se receio dos trabalhadores em se manifestar na presença da liderança (trabalhadores olham para a liderança antes de responder).",
  );
});

test("participantes acima dos abordados", () => {
  assert.equal(participantesExcedem({ trab_abordados: 3, trab_participantes: 4 }), true);
  assert.equal(participantesExcedem({ trab_abordados: 3, trab_participantes: 3 }), false);
  assert.equal(participantesExcedem({ trab_participantes: 4 }), false);
});

test("normalização descarta lixo do jsonb", () => {
  assert.deepEqual(normalizarMotivoNi({ assedio: { motivo: "xx" }, sobrecarga: 3 }), { assedio: { motivo: "" } });
  const c = normalizarCondicoesColeta({ trab_abordados: -1, trab_participantes: 2.7, sinais_inibicao: ["lideranca_olhar", "inventado", 4] });
  assert.equal(c.trab_abordados, null);
  assert.equal(c.trab_participantes, 2);
  assert.deepEqual(c.sinais_inibicao, ["lideranca_olhar"]);
});

test("roteiro de campo cobre os 13 fatores", () => {
  for (const f of ITENS_ORGANIZACIONAL) {
    const r = ROTEIRO_CAMPO[f.key];
    assert.ok(r && r.perguntas.length > 0 && r.observar.length > 0, f.key);
  }
});
```

### C: `lib/aep/roteiro-campo.ts` (novo, completo)

```ts
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Roteiro de campo por fator da Ergonomia Organizacional (2026-10-06):
 * perguntas INDIRETAS (que não pedem ao trabalhador para "denunciar" ninguém)
 * e o que OBSERVAR — para sustentar a triagem mesmo quando ninguém fala.
 *
 * Fonte: Anexo B do plano "AEP com menos dependência de entrevistas". Só
 * orientação: não grava nada. Aparece recolhido em cada fator do editor e
 * impresso no Formulário em Branco.
 */

export interface RoteiroFator {
  perguntas: string[];
  observar: string[];
}

export const ROTEIRO_CAMPO: Record<keyof AepChecklistOrganizacional, RoteiroFator> = {
  assedio: {
    perguntas: [
      "Quando a liderança precisa cobrar algo, como costuma fazer?",
      "Se um colega novo entrasse amanhã, o que você diria para ele tomar cuidado aqui?",
      "Já viu alguém ser chamado atenção na frente dos outros?",
    ],
    observar: [
      "Tom de voz e forma de cobrança da liderança",
      "Mudança de comportamento quando o líder se aproxima",
      "Brincadeiras constrangedoras ou apelidos",
      "Silêncio excessivo no setor",
    ],
  },
  falta_suporte: {
    perguntas: [
      "Quando aparece um problema que você não sabe resolver, a quem recorre?",
      "Quando alguém erra, o que costuma acontecer?",
    ],
    observar: [
      "Presença e acessibilidade do líder durante a visita",
      "Trabalhadores aguardando orientação para continuar",
      "Demora para obter respostas",
    ],
  },
  gestao_mudancas: {
    perguntas: [
      "Como vocês ficam sabendo das mudanças aqui?",
      "Teve alguma mudança recente? Como foi para o setor?",
    ],
    observar: [
      "Comentários sobre boatos ou instabilidade",
      "Processos ou ferramentas novos sem orientação",
      "Retrabalho e dúvidas sobre o novo modo de fazer",
    ],
  },
  clareza_papel: {
    perguntas: [
      "Se duas pessoas pedirem coisas diferentes, qual você faz?",
      "Como você aprendeu a fazer sua atividade?",
    ],
    observar: [
      "Instruções vindas de mais de uma pessoa",
      "Ausência de procedimento no posto",
      "Trabalhadores executando a mesma tarefa de formas diferentes",
    ],
  },
  recompensas: {
    perguntas: [
      "Quando o trabalho sai bem feito, alguém comenta?",
      "Quem trabalha aqui consegue crescer na empresa?",
    ],
    observar: [
      "Feedback apenas diante de erros",
      "Desânimo aparente",
      "Existência de ações visíveis de reconhecimento",
    ],
  },
  baixo_controle: {
    perguntas: [
      "Se você tiver uma ideia para melhorar o trabalho, o que acontece?",
      "Para quais decisões você precisa pedir autorização?",
    ],
    observar: [
      "Supervisão constante e revisões excessivas",
      "Trabalhadores parados aguardando autorização",
      "Receio de tomar iniciativa",
    ],
  },
  justica_organizacional: {
    perguntas: [
      "Como é decidido quem folga, faz hora extra ou é promovido?",
      "As regras valem igual para todo mundo aqui?",
    ],
    observar: [
      "Comentários sobre preferidos",
      "Tratamento diferente entre trabalhadores na mesma função",
      "Conflitos visíveis",
    ],
  },
  eventos_traumaticos: {
    perguntas: [
      "Já aconteceu alguma situação difícil com cliente ou público? Como foi resolvido?",
      "Se acontecer de novo, você sabe o que fazer?",
    ],
    observar: [
      "Exposição direta ao público e manuseio de valores",
      "Local e horário de trabalho",
      "Barreiras físicas, controle de acesso, CFTV ou botão de pânico",
    ],
  },
  subcarga: {
    perguntas: [
      "Como é o movimento do setor ao longo do dia ou do mês?",
      "O que vocês fazem quando não tem serviço?",
    ],
    observar: [
      "Ociosidade durante a visita",
      "Tarefas monótonas ou repetitivas",
      "Compatibilidade entre qualificação e tarefa",
    ],
  },
  sobrecarga: {
    perguntas: [
      "Dá para fazer tudo dentro do horário?",
      "Quando alguém falta, como fica o trabalho?",
    ],
    observar: [
      "Ritmo acelerado e pausas suprimidas",
      "Acúmulo de tarefas simultâneas",
      "Trabalhadores permanecendo após o horário",
    ],
  },
  maus_relacionamentos: {
    perguntas: [
      "Como é a convivência entre o pessoal do setor?",
      "Quando dois colegas se desentendem, o que acontece?",
    ],
    observar: [
      "Evitação ou isolamento entre colegas",
      "Recados indiretos",
      "Falta de cooperação nas tarefas",
    ],
  },
  comunicacao_dificil: {
    perguntas: [
      "Como a informação chega até você?",
      "Já teve que parar o serviço por falta de informação?",
    ],
    observar: [
      "Ausência de quadro de avisos ou registro de passagem de turno",
      "Informações divergentes entre pessoas",
      "Barreiras físicas à comunicação (ruído, distância)",
    ],
  },
  trabalho_remoto: {
    perguntas: [
      "Com que frequência você conversa com a equipe e a liderança?",
      "Se algo der errado quando está sozinho, como pede ajuda?",
    ],
    observar: [
      "Meios de comunicação disponíveis",
      "Existência de check-in ou monitoramento",
      "Contato real com a equipe",
    ],
  },
};
```

### D: `lib/aep/checklist-gestao.ts` (novo, completo)

```ts
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Checklist de gestão da AEP (Fase 2, 2026-10-06; Anexo C do plano).
 *
 * Respondido UMA VEZ por AEP (vale para todos os setores), com o gestor/RH,
 * por observação ou por documento — não depende dos trabalhadores nem de a
 * empresa repassar indicadores. Gestor que afirma que existe mas não mostra
 * comprovação = `existe_sem_evidencia`.
 *
 * Regras:
 *   • `nao_existe` e `existe_sem_evidencia` = FONTE GERADORA presente para os
 *     fatores mapeados (lacuna de gestão);
 *   • `existe_evidenciado` = MEDIDA DE CONTROLE existente para esses fatores;
 *   • não altera a probabilidade AIHA: alimenta fontes geradoras, medidas de
 *     controle existentes, confiança da evidência (conta como origem
 *     "documental") e a IA.
 *
 * Gravado em `aep_relatorios.checklist_gestao` (jsonb, v272).
 * ⚠️ `codigo` (G01…) fica gravado: mudar `label` é livre, mudar código não.
 */

export type FatorOrg = keyof AepChecklistOrganizacional;

export type RespostaGestao = "existe_evidenciado" | "existe_sem_evidencia" | "nao_existe" | "na";
export type OrigemGestao = "documento" | "entrevista_gestor" | "observacao";

export const RESPOSTAS_GESTAO: { key: RespostaGestao; label: string; curto: string }[] = [
  { key: "existe_evidenciado", label: "Existe e foi evidenciado", curto: "Evidenciado" },
  { key: "existe_sem_evidencia", label: "Existe, mas sem evidência", curto: "Sem evidência" },
  { key: "nao_existe", label: "Não existe", curto: "Não existe" },
  { key: "na", label: "Não se aplica", curto: "N/A" },
];

export const ORIGENS_GESTAO: { key: OrigemGestao; label: string }[] = [
  { key: "documento", label: "Documento" },
  { key: "entrevista_gestor", label: "Entrevista com gestor/RH" },
  { key: "observacao", label: "Observação" },
];

export interface ItemGestao {
  codigo: string;
  label: string;
  fatores: FatorOrg[];
}

// Anexo C. Os números de fator do anexo (1…13) seguem a ordem dos 13 fatores
// do sistema (assedio = 1 … trabalho_remoto = 13).
export const ITENS_GESTAO: ItemGestao[] = [
  { codigo: "G01", label: "Política de prevenção e enfrentamento ao assédio e demais formas de violência", fatores: ["assedio"] },
  { codigo: "G02", label: "Canal de denúncia com sigilo e garantia de não retaliação", fatores: ["assedio", "justica_organizacional", "maus_relacionamentos"] },
  { codigo: "G03", label: "Procedimento de apuração de denúncias e aplicação de medidas", fatores: ["assedio", "justica_organizacional"] },
  { codigo: "G04", label: "Capacitação das lideranças em gestão de pessoas, feedback e comunicação", fatores: ["assedio", "falta_suporte", "baixo_controle", "justica_organizacional", "maus_relacionamentos"] },
  { codigo: "G05", label: "Código de conduta ou normas de convivência", fatores: ["assedio", "maus_relacionamentos"] },
  { codigo: "G06", label: "Rotina de acompanhamento líder–liderado (reuniões, conversas individuais)", fatores: ["falta_suporte", "recompensas"] },
  { codigo: "G07", label: "Programa de integração e acompanhamento de novos colaboradores", fatores: ["falta_suporte", "clareza_papel"] },
  { codigo: "G08", label: "Procedimento formal de gestão de mudanças", fatores: ["gestao_mudancas"] },
  { codigo: "G09", label: "Descrição formal de cargos entregue aos trabalhadores", fatores: ["clareza_papel"] },
  { codigo: "G10", label: "Organograma definido e divulgado", fatores: ["clareza_papel", "comunicacao_dificil"] },
  { codigo: "G11", label: "POPs/ITs das atividades", fatores: ["clareza_papel", "comunicacao_dificil"] },
  { codigo: "G12", label: "Plano de cargos, carreira e salários", fatores: ["recompensas"] },
  { codigo: "G13", label: "Avaliação de desempenho com feedback periódico", fatores: ["recompensas"] },
  { codigo: "G14", label: "Programa ou práticas de reconhecimento", fatores: ["recompensas"] },
  { codigo: "G15", label: "Alçadas de decisão e delegação definidas", fatores: ["baixo_controle"] },
  { codigo: "G16", label: "Critérios formais e divulgados para escalas, folgas, tarefas, promoções e punições", fatores: ["justica_organizacional"] },
  { codigo: "G17", label: "Procedimento de gestão de conflitos", fatores: ["justica_organizacional", "maus_relacionamentos"] },
  { codigo: "G18", label: "Protocolo de segurança e resposta a incidentes de violência", fatores: ["eventos_traumaticos"] },
  { codigo: "G19", label: "Treinamento em manejo de conflitos e situações de risco", fatores: ["eventos_traumaticos"] },
  { codigo: "G20", label: "Suporte psicológico ou programa de apoio ao trabalhador", fatores: ["eventos_traumaticos"] },
  { codigo: "G21", label: "Planejamento e distribuição de demandas / dimensionamento do quadro revisado", fatores: ["subcarga", "sobrecarga"] },
  { codigo: "G22", label: "Plano de cobertura de ausências (férias, afastamentos)", fatores: ["sobrecarga"] },
  { codigo: "G23", label: "Controle de jornada e de horas extras habituais", fatores: ["sobrecarga"] },
  { codigo: "G24", label: "Canais formais de comunicação e registro de passagem de turno", fatores: ["comunicacao_dificil"] },
  { codigo: "G25", label: "Política de teletrabalho com direito à desconexão", fatores: ["trabalho_remoto"] },
  { codigo: "G26", label: "Sistema de comunicação/monitoramento e protocolo de emergência para trabalho isolado", fatores: ["trabalho_remoto"] },
];

export interface RespostaItemGestao {
  resposta: RespostaGestao | "";
  origem?: OrigemGestao | "";
  /** Nome do documento, data, responsável… */
  evidencia?: string;
}

export interface ChecklistGestao {
  itens?: Record<string, RespostaItemGestao>;
  /** Com quem/como foi respondido (gestor, RH…). */
  respondido_com?: string;
  atualizado_em?: string | null;
  atualizado_por?: string | null;
}

export function normalizarChecklistGestao(raw: unknown): ChecklistGestao {
  if (typeof raw !== "object" || raw === null) return { itens: {} };
  const r = raw as Record<string, unknown>;
  const itens: Record<string, RespostaItemGestao> = {};
  if (typeof r.itens === "object" && r.itens !== null) {
    for (const [cod, v] of Object.entries(r.itens as Record<string, unknown>)) {
      if (!ITENS_GESTAO.some((i) => i.codigo === cod) || typeof v !== "object" || v === null) continue;
      const x = v as Record<string, unknown>;
      itens[cod] = {
        resposta: RESPOSTAS_GESTAO.some((o) => o.key === x.resposta) ? (x.resposta as RespostaGestao) : "",
        origem: ORIGENS_GESTAO.some((o) => o.key === x.origem) ? (x.origem as OrigemGestao) : "",
        evidencia: typeof x.evidencia === "string" ? x.evidencia : "",
      };
    }
  }
  return {
    itens,
    respondido_com: typeof r.respondido_com === "string" ? r.respondido_com : "",
    atualizado_em: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    atualizado_por: typeof r.atualizado_por === "string" ? r.atualizado_por : null,
  };
}

/** Itens do checklist mapeados ao fator. */
export const itensDoFator = (fator: string) => ITENS_GESTAO.filter((i) => i.fatores.includes(fator as FatorOrg));

/** Lacunas de gestão do fator: não existe / existe sem evidência = fonte geradora presente. */
export function lacunasDoFator(g: ChecklistGestao | null | undefined, fator: string): (ItemGestao & { resposta: RespostaGestao })[] {
  return itensDoFator(fator)
    .map((i) => ({ ...i, resposta: g?.itens?.[i.codigo]?.resposta ?? "" }))
    .filter((i): i is ItemGestao & { resposta: RespostaGestao } => i.resposta === "nao_existe" || i.resposta === "existe_sem_evidencia");
}

/** Medidas de controle existentes do fator: itens evidenciados. */
export function medidasExistentesDoFator(g: ChecklistGestao | null | undefined, fator: string): ItemGestao[] {
  return itensDoFator(fator).filter((i) => g?.itens?.[i.codigo]?.resposta === "existe_evidenciado");
}

export const SEM_MEDIDAS = "Não evidenciadas medidas de controle específicas";

/** Texto de uma lacuna para laudo/inventário: "G01 — Política… (não existe)". */
export function rotuloLacuna(i: ItemGestao & { resposta: RespostaGestao }): string {
  return `${i.codigo} — ${i.label} (${i.resposta === "nao_existe" ? "não existe" : "existe, sem evidência"})`;
}

/** Quantos itens já foram respondidos. */
export function respondidosGestao(g: ChecklistGestao | null | undefined): number {
  return Object.values(g?.itens ?? {}).filter((x) => x?.resposta).length;
}
```

### E: `lib/aep/evidencia.ts` (novo, completo)

```ts
/**
 * Origem da evidência e confiança por fator organizacional (Fase 2,
 * 2026-10-06). Decisão do usuário: a origem é registrada POR FATOR (não por
 * sinal) — um multiselect em cada fator "Sim".
 *
 * Confiança (separada da matriz AIHA, não muda o nível):
 *   1 tipo de origem → Baixa · 2 tipos → Média · 3 ou mais → Alta.
 * Lacuna do checklist de gestão mapeada ao fator conta como origem
 * "documental".
 *
 * Gravado no setor em `origem_evidencia` `{fator: [origem…]}` (jsonb).
 * As fontes geradoras marcadas pelo técnico (códigos da biblioteca, ex.
 * "1.3") ficam em `fontes_geradoras` `{fator: [codigo…]}`.
 */

export type OrigemEvidencia =
  | "observacao_direta"
  | "relato_individual"
  | "relato_grupo"
  | "documental"
  | "questionario_anonimo";

export const ORIGENS_EVIDENCIA: { key: OrigemEvidencia; label: string }[] = [
  { key: "observacao_direta", label: "Observação direta" },
  { key: "relato_individual", label: "Relato individual" },
  { key: "relato_grupo", label: "Relato em grupo" },
  { key: "documental", label: "Documental" },
  { key: "questionario_anonimo", label: "Questionário anônimo" },
];

export type Confianca = "Baixa" | "Média" | "Alta";

export const COR_CONFIANCA: Record<Confianca, { bg: string; cor: string }> = {
  Baixa: { bg: "#fee2e2", cor: "#991b1b" },
  Média: { bg: "#fef3c7", cor: "#92400e" },
  Alta: { bg: "#dcfce7", cor: "#166534" },
};

/** Origens efetivas do fator (as marcadas + "documental" se houver lacuna de gestão). */
export function origensEfetivas(marcadas: readonly string[] | undefined, temLacunaGestao: boolean): OrigemEvidencia[] {
  const set = new Set((marcadas ?? []).filter((o): o is OrigemEvidencia => ORIGENS_EVIDENCIA.some((x) => x.key === o)));
  if (temLacunaGestao) set.add("documental");
  return ORIGENS_EVIDENCIA.map((x) => x.key).filter((k) => set.has(k));
}

/** Confiança do fator; null sem nenhuma origem. */
export function confiancaDoFator(marcadas: readonly string[] | undefined, temLacunaGestao: boolean): Confianca | null {
  const n = origensEfetivas(marcadas, temLacunaGestao).length;
  if (n === 0) return null;
  return n === 1 ? "Baixa" : n === 2 ? "Média" : "Alta";
}

export const rotuloOrigem = (k: string) => ORIGENS_EVIDENCIA.find((x) => x.key === k)?.label ?? k;

/** `{fator: [string…]}` limpo (jsonb pode trazer lixo). */
export function normalizarMapaLista(raw: unknown): Record<string, string[]> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = [...new Set(v.filter((x): x is string => typeof x === "string"))];
  }
  return out;
}
```

### F: `lib/aep/biblioteca.ts` (novo, completo)

```ts
/**
 * Biblioteca psicossocial — os 13 fatores com descrição do risco, danos à
 * saúde, fontes geradoras codificadas, meio de propagação, situação e tempo de
 * exposição padrão, sugestões iniciais e ações (Fase 2, 2026-10-06; tabela
 * `psi_biblioteca_fatores`, v272; seed do Anexo A).
 *
 * Única para o sistema (sem empresa): a AEP usa hoje, e foi feita para o
 * DRPS/QPS usarem depois. Leitura para todos; edição só Admin
 * (`/aep/biblioteca`). Módulo PURO: tipos e normalização, usados pela tela,
 * pelo laudo, pela rota do PDF e pelo inventário.
 */

export interface FonteGeradora {
  codigo: string;
  texto: string;
}

export interface FatorBiblioteca {
  fator: string;
  ordem: number;
  descricao_risco: string;
  danos_saude: string;
  meio_propagacao: string;
  situacao_padrao: string;
  tempo_exposicao_padrao: string;
  medidas_controle_verificar: string;
  fontes_geradoras: FonteGeradora[];
  sugestoes_iniciais: string[];
  acoes: string[];
  atualizado_em?: string | null;
  atualizado_por?: string | null;
}

export type Biblioteca = Record<string, FatorBiblioteca>;

const txt = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function normalizarFatorBiblioteca(raw: unknown): FatorBiblioteca | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.fator !== "string") return null;
  return {
    fator: r.fator,
    ordem: typeof r.ordem === "number" ? r.ordem : 0,
    descricao_risco: txt(r.descricao_risco),
    danos_saude: txt(r.danos_saude),
    meio_propagacao: txt(r.meio_propagacao),
    situacao_padrao: txt(r.situacao_padrao),
    tempo_exposicao_padrao: txt(r.tempo_exposicao_padrao),
    medidas_controle_verificar: txt(r.medidas_controle_verificar),
    fontes_geradoras: Array.isArray(r.fontes_geradoras)
      ? (r.fontes_geradoras as unknown[])
          .filter((f): f is FonteGeradora => typeof f === "object" && f !== null && typeof (f as FonteGeradora).codigo === "string")
          .map((f) => ({ codigo: f.codigo, texto: txt(f.texto) }))
      : [],
    sugestoes_iniciais: lista(r.sugestoes_iniciais),
    acoes: lista(r.acoes),
    atualizado_em: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    atualizado_por: typeof r.atualizado_por === "string" ? r.atualizado_por : null,
  };
}

export function montarBiblioteca(rows: unknown[] | null | undefined): Biblioteca {
  const out: Biblioteca = {};
  for (const r of rows ?? []) {
    const f = normalizarFatorBiblioteca(r);
    if (f) out[f.fator] = f;
  }
  return out;
}

/** Textos das fontes da biblioteca marcadas no fator ("1.3 — Ausência de…"). */
export function fontesMarcadas(b: Biblioteca | null | undefined, fator: string, codigos: readonly string[] | undefined): string[] {
  const doFator = b?.[fator]?.fontes_geradoras ?? [];
  return doFator.filter((f) => codigos?.includes(f.codigo)).map((f) => `${f.codigo} — ${f.texto}`);
}
```

### G: `lib/aep/inventario.ts` (novo, completo)

```ts
/**
 * Detalhe de cada fator organizacional "Sim" e o INVENTÁRIO PSICOSSOCIAL da
 * AEP (Fase 2, 2026-10-06). Uma linha por setor × fator "Sim", nas colunas do
 * plano — para lançamento no SGG (XLSX e CSV).
 *
 * Junta: matriz AIHA gravada, sinais, biblioteca (descrição, danos, meio,
 * situação, tempo, sugestões, ações), fontes geradoras (lacunas do checklist
 * de gestão + fontes da biblioteca marcadas pelo técnico), medidas de
 * controle existentes (itens evidenciados do checklist de gestão) e origem
 * da evidência / confiança. Módulo PURO: tela, laudo, PDF e IA usam o mesmo.
 */

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import { fontesMarcadas, type Biblioteca } from "@/lib/aep/biblioteca";
import {
  SEM_MEDIDAS,
  lacunasDoFator,
  medidasExistentesDoFator,
  rotuloLacuna,
  type ChecklistGestao,
} from "@/lib/aep/checklist-gestao";
import { confiancaDoFator, origensEfetivas, rotuloOrigem, type Confianca } from "@/lib/aep/evidencia";
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/** Recorte do setor lido aqui (casa com AepSetor e AepSetorLocal). */
export interface SetorInventario {
  nome_setor?: string | null;
  ghe?: string | null;
  checklist_organizacional?: object | null;
  sinais_organizacional?: Record<string, string[]> | null;
  aiha_organizacional?: Record<string, { probabilidade?: string; severidade?: string; nivel?: string | null } | undefined> | null;
  origem_evidencia?: Record<string, string[]> | null;
  fontes_geradoras?: Record<string, string[]> | null;
}

export interface DetalheFator {
  key: string;
  label: string;
  sinais: string[];
  descricao: string;
  danos: string;
  meio: string;
  situacao: string;
  tempo: string;
  /** Lacunas do checklist de gestão + fontes da biblioteca marcadas. */
  fontes: string[];
  medidasExistentes: string[];
  origens: string[];
  confianca: Confianca | null;
  probabilidade: string;
  severidade: string;
  nivel: string;
  sugestoes: string[];
  acoes: string[];
}

export function detalhesDoSetor(
  setor: SetorInventario,
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): DetalheFator[] {
  const cl = (setor.checklist_organizacional ?? {}) as Record<string, string>;
  return ITENS_ORGANIZACIONAL.filter(({ key }) => cl[key] === "sim").map(({ key, label }) => {
    const b = biblioteca?.[key];
    const lacunas = lacunasDoFator(gestao, key);
    const a = setor.aiha_organizacional?.[key];
    return {
      key,
      label,
      sinais: rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional ?? undefined),
      descricao: b?.descricao_risco ?? "",
      danos: b?.danos_saude ?? "",
      meio: b?.meio_propagacao ?? "",
      situacao: b?.situacao_padrao ?? "",
      tempo: b?.tempo_exposicao_padrao ?? "",
      fontes: [...lacunas.map(rotuloLacuna), ...fontesMarcadas(biblioteca, key, setor.fontes_geradoras?.[key])],
      medidasExistentes: medidasExistentesDoFator(gestao, key).map((i) => `${i.codigo} — ${i.label}`),
      origens: origensEfetivas(setor.origem_evidencia?.[key], lacunas.length > 0).map(rotuloOrigem),
      confianca: confiancaDoFator(setor.origem_evidencia?.[key], lacunas.length > 0),
      probabilidade: a?.nivel ? (a.probabilidade ?? "") : "",
      severidade: a?.nivel ? (a.severidade ?? "") : "",
      nivel: a?.nivel ?? "",
      sugestoes: b?.sugestoes_iniciais ?? [],
      acoes: b?.acoes ?? [],
    };
  });
}

export const COLUNAS_INVENTARIO = [
  "Setor",
  "GHE",
  "Perigo",
  "Fontes geradoras",
  "Evidências (sinais)",
  "Meio de propagação",
  "Situação",
  "Tempo de exposição",
  "Medidas de controle existentes",
  "Descrição do risco",
  "Danos à saúde",
  "Probabilidade",
  "Severidade",
  "Nível AIHA",
  "Confiança",
  "Sugestões iniciais",
  "Ações",
] as const;

export function linhasInventario(
  setores: SetorInventario[],
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): string[][] {
  const linhas: string[][] = [];
  for (const s of setores) {
    for (const d of detalhesDoSetor(s, gestao, biblioteca)) {
      linhas.push([
        s.nome_setor || "Setor sem nome",
        s.ghe ?? "",
        d.label,
        d.fontes.join("; "),
        d.sinais.join("; "),
        d.meio,
        d.situacao,
        d.tempo,
        d.medidasExistentes.length ? d.medidasExistentes.join("; ") : SEM_MEDIDAS,
        d.descricao,
        d.danos,
        d.probabilidade,
        d.severidade,
        d.nivel,
        d.confianca ?? "",
        d.sugestoes.join("; "),
        d.acoes.join("; "),
      ]);
    }
  }
  return linhas;
}

/** CSV com ";" (o Excel em pt-BR abre direto) e BOM para os acentos. */
export function csvInventario(linhas: string[][]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [COLUNAS_INVENTARIO as readonly string[], ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
}
```

### H: `lib/aep/inventario.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { COLUNAS_INVENTARIO, csvInventario, detalhesDoSetor, linhasInventario } from "./inventario";
import { confiancaDoFator, normalizarMapaLista, origensEfetivas } from "./evidencia";
import { ITENS_GESTAO, lacunasDoFator, medidasExistentesDoFator, normalizarChecklistGestao } from "./checklist-gestao";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import { montarBiblioteca } from "./biblioteca";

const BIB = montarBiblioteca([
  {
    fator: "assedio",
    ordem: 1,
    descricao_risco: "Condutas abusivas",
    danos_saude: "Estresse",
    meio_propagacao: "Relações interpessoais",
    situacao_padrao: "Normal",
    tempo_exposicao_padrao: "Habitual e permanente",
    fontes_geradoras: [{ codigo: "1.4", texto: "Gestão autoritária" }, { codigo: "1.5", texto: "Lideranças sem capacitação" }],
    sugestoes_iniciais: ["Política de prevenção"],
    acoes: ["Código de conduta"],
  },
]);

const GESTAO = normalizarChecklistGestao({
  itens: {
    G01: { resposta: "nao_existe" },
    G02: { resposta: "existe_evidenciado", origem: "documento", evidencia: "Canal X" },
    G03: { resposta: "existe_sem_evidencia" },
    G99: { resposta: "nao_existe" },
  },
});

test("confiança: 1 tipo baixa, 2 média, 3+ alta; lacuna de gestão conta como documental", () => {
  assert.equal(confiancaDoFator([], false), null);
  assert.equal(confiancaDoFator(["observacao_direta"], false), "Baixa");
  assert.equal(confiancaDoFator(["observacao_direta"], true), "Média");
  assert.equal(confiancaDoFator(["observacao_direta", "relato_grupo", "documental"], true), "Alta");
  assert.deepEqual(origensEfetivas(["documental", "xx"], true), ["documental"]);
});

test("checklist de gestão: lacunas e medidas por fator; código desconhecido descartado", () => {
  assert.equal(GESTAO.itens?.G99, undefined);
  assert.deepEqual(lacunasDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G01", "G03"]);
  assert.deepEqual(medidasExistentesDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G02"]);
  assert.deepEqual(lacunasDoFator(GESTAO, "sobrecarga"), []);
});

test("todo item de gestão aponta para fatores que existem", () => {
  const chaves = ITENS_ORGANIZACIONAL.map((i) => i.key as string);
  assert.equal(ITENS_GESTAO.length, 26);
  for (const i of ITENS_GESTAO) for (const f of i.fatores) assert.ok(chaves.includes(f), `${i.codigo}:${f}`);
});

test("detalhe do fator junta biblioteca, gestão, sinais, origem e AIHA", () => {
  const setor = {
    nome_setor: "Produção",
    ghe: "GHE-1",
    checklist_organizacional: { assedio: "sim", sobrecarga: "nao" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    aiha_organizacional: { assedio: { probabilidade: "Exposição a níveis baixos", severidade: "Irreversíveis", nivel: "Moderado" } },
    origem_evidencia: { assedio: ["observacao_direta"] },
    fontes_geradoras: { assedio: ["1.5"] },
  };
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.key, "assedio");
  assert.deepEqual(d.fontes, [
    "G01 — Política de prevenção e enfrentamento ao assédio e demais formas de violência (não existe)",
    "G03 — Procedimento de apuração de denúncias e aplicação de medidas (existe, sem evidência)",
    "1.5 — Lideranças sem capacitação",
  ]);
  assert.deepEqual(d.origens, ["Observação direta", "Documental"]);
  assert.equal(d.confianca, "Média");
  assert.equal(d.nivel, "Moderado");

  const linhas = linhasInventario([setor], GESTAO, BIB);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].length, COLUNAS_INVENTARIO.length);
  assert.equal(linhas[0][8], "G02 — Canal de denúncia com sigilo e garantia de não retaliação");
  // Sem medidas evidenciadas: frase padrão.
  const semMedidas = linhasInventario([setor], normalizarChecklistGestao({}), BIB);
  assert.equal(semMedidas[0][8], "Não evidenciadas medidas de controle específicas");
});

test("CSV com ponto e vírgula, BOM e aspas quando preciso", () => {
  const csv = csvInventario([["A;B", 'diz "oi"', "ok", ...Array(14).fill("")]]);
  assert.ok(csv.startsWith("﻿Setor;GHE;Perigo"));
  assert.ok(csv.includes('"A;B";"diz ""oi""";ok'));
});

test("normalizarMapaLista tira duplicados e lixo", () => {
  assert.deepEqual(normalizarMapaLista({ a: ["x", "x", 3], b: "y" }), { a: ["x"] });
});
```

### I: `lib/hooks/useBibliotecaPsi.ts` (novo, completo)

```ts
"use client";

// Biblioteca psicossocial (v272): leitura para todos, edição só Admin.
// Ver lib/aep/biblioteca.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { mensagemErro } from "@/lib/errors";
import { montarBiblioteca, type FatorBiblioteca } from "@/lib/aep/biblioteca";

const KEY = ["psi-biblioteca"] as const;

// A tabela da v272 ainda não está no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createSupabaseBrowserClient() as any;

export function useBibliotecaPsi() {
  return useQuery({
    queryKey: KEY,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db().from("psi_biblioteca_fatores").select("*").order("ordem");
      if (error) throw error;
      return montarBiblioteca(data as unknown[]);
    },
  });
}

export function useSalvarFatorBiblioteca() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (f: FatorBiblioteca) => {
      const { fator, ...resto } = f;
      const { data, error } = await db()
        .from("psi_biblioteca_fatores")
        .update({
          descricao_risco: resto.descricao_risco,
          danos_saude: resto.danos_saude,
          meio_propagacao: resto.meio_propagacao,
          situacao_padrao: resto.situacao_padrao,
          tempo_exposicao_padrao: resto.tempo_exposicao_padrao,
          medidas_controle_verificar: resto.medidas_controle_verificar,
          fontes_geradoras: resto.fontes_geradoras,
          sugestoes_iniciais: resto.sugestoes_iniciais,
          acoes: resto.acoes,
          atualizado_em: new Date().toISOString(),
          atualizado_por: user?.nome ?? user?.email ?? null,
        })
        .eq("fator", fator)
        .select("fator");
      if (error) throw error;
      // RLS barra sem erro (0 linhas) quem não é Admin.
      if (!data?.length) throw new Error("Só o perfil Admin pode editar a biblioteca.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Biblioteca atualizada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao salvar a biblioteca")),
  });
}
```

### J: `components/aep/AepChecklistGestao.tsx` (novo, completo)

```tsx
"use client";

// Checklist de gestão da AEP (Fase 2, 2026-10-06). Respondido uma vez por
// AEP, com gestor/RH, por observação ou documento — não depende dos
// trabalhadores. "Não existe" e "Existe, sem evidência" viram fonte geradora
// dos fatores mapeados; "Existe e evidenciado" vira medida de controle
// existente. Não muda a matriz AIHA. Regras em lib/aep/checklist-gestao.ts.
// Usado na rota /aep/[id]/gestao e na aba AEP da inspeção.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useAepRelatorio, useSalvarAep } from "@/lib/hooks/useAep";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { EditorSkeleton } from "@/components/ui/PageSkeletons";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import {
  ITENS_GESTAO,
  ORIGENS_GESTAO,
  RESPOSTAS_GESTAO,
  normalizarChecklistGestao,
  respondidosGestao,
  type ChecklistGestao,
  type OrigemGestao,
  type RespostaGestao,
  type RespostaItemGestao,
} from "@/lib/aep/checklist-gestao";
import { cn, fmtData } from "@/lib/utils";

const COR: Record<RespostaGestao, string> = {
  existe_evidenciado: "bg-emerald-600 text-white",
  existe_sem_evidencia: "bg-amber-500 text-white",
  nao_existe: "bg-red-500 text-white",
  na: "bg-gray-400 text-white",
};

const rotuloFator = (k: string) => ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k;

export default function AepChecklistGestao({ idRelatorio }: { idRelatorio: string }) {
  const { data: rel, isLoading } = useAepRelatorio(idRelatorio);
  const salvar = useSalvarAep();
  const canEdit = useCanEdit();
  const user = useUserStore((s) => s.user);
  const [g, setG] = useState<ChecklistGestao>({ itens: {} });
  const [sujo, setSujo] = useState(false);
  const carregado = useRef<string | null>(null);

  useEffect(() => {
    if (!rel || carregado.current === idRelatorio) return;
    carregado.current = idRelatorio;
    setG(normalizarChecklistGestao(rel.checklist_gestao));
  }, [rel, idRelatorio]);

  const respondidos = useMemo(() => respondidosGestao(g), [g]);

  function setItem(codigo: string, patch: Partial<RespostaItemGestao>) {
    setG((prev) => ({
      ...prev,
      itens: { ...(prev.itens ?? {}), [codigo]: { resposta: "", ...(prev.itens?.[codigo] ?? {}), ...patch } },
    }));
    setSujo(true);
  }

  async function handleSalvar() {
    const novo: ChecklistGestao = {
      ...g,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.nome ?? user?.email ?? null,
    };
    try {
      await salvar.mutateAsync({ id: idRelatorio, checklist_gestao: novo });
      setG(novo);
      setSujo(false);
      // Rastro de quem respondeu o quê (a auditoria é append-only).
      void registrarAuditoria({
        modulo: "aep",
        id_referencia: idRelatorio,
        acao: "checklist_gestao",
        descricao: `Checklist de gestão salvo (${respondidosGestao(novo)} de ${ITENS_GESTAO.length} itens)`,
        metadata: { itens: novo.itens },
      });
    } catch {
      // erro já tratado pelo hook
    }
  }

  if (isLoading) return <EditorSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Checklist de gestão</h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Respondido uma vez por AEP, com o gestor ou o RH, por observação ou por documento — não depende dos
            trabalhadores. <strong>Não existe</strong> e <strong>Existe, sem evidência</strong> viram fonte geradora dos
            fatores ligados ao item; <strong>Existe e evidenciado</strong> vira medida de controle existente. Não altera a
            matriz AIHA. Documentos comprobatórios podem ir em Laudo › Anexos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {respondidos} de {ITENS_GESTAO.length} respondidos
            {g.atualizado_em && ` · salvo em ${fmtData(g.atualizado_em)}${g.atualizado_por ? ` por ${g.atualizado_por}` : ""}`}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvar.isPending || !sujo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Respondido com (gestor, RH…)</label>
        <input
          type="text"
          disabled={!canEdit}
          value={g.respondido_com ?? ""}
          onChange={(e) => {
            setG((p) => ({ ...p, respondido_com: e.target.value }));
            setSujo(true);
          }}
          placeholder="Ex.: Supervisora de RH e gerente de produção"
          className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
        />
      </div>

      <div className="space-y-2">
        {ITENS_GESTAO.map((item) => {
          const r = g.itens?.[item.codigo];
          return (
            <div key={item.codigo} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    <span className="mr-1.5 font-mono text-xs text-gray-500">{item.codigo}</span>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{item.fatores.map(rotuloFator).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {RESPOSTAS_GESTAO.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      disabled={!canEdit}
                      title={o.label}
                      onClick={() => setItem(item.codigo, { resposta: r?.resposta === o.key ? "" : o.key })}
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-semibold transition",
                        r?.resposta === o.key ? COR[o.key] : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      {o.curto}
                    </button>
                  ))}
                </div>
              </div>
              {r?.resposta && r.resposta !== "na" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-[220px_1fr]">
                  <select
                    disabled={!canEdit}
                    value={r.origem ?? ""}
                    onChange={(e) => setItem(item.codigo, { origem: e.target.value as OrigemGestao | "" })}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                  >
                    <option value="">Origem…</option>
                    {ORIGENS_GESTAO.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={r.evidencia ?? ""}
                    onChange={(e) => setItem(item.codigo, { evidencia: e.target.value })}
                    placeholder="Evidência: nome do documento, data, responsável…"
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### K: `app/(aep)/aep/[idRelatorio]/gestao/page.tsx` (novo, completo)

```tsx
"use client";

import { use } from "react";
import AepChecklistGestao from "@/components/aep/AepChecklistGestao";

// O checklist mora em `components/aep/AepChecklistGestao.tsx` para ser usado
// também na aba AEP da inspeção.
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AepChecklistGestao idRelatorio={idRelatorio} />;
}
```

### L: `app/(aep)/aep/biblioteca/page.tsx` (novo, completo)

```tsx
"use client";

// Biblioteca psicossocial (v272): os 13 fatores com descrição do risco, danos
// à saúde, fontes geradoras, meio de propagação, situação/tempo de exposição,
// sugestões iniciais e ações. Todos leem; só o Admin edita (decisão de
// 2026-10-06 — o RT pede a alteração). Única para o sistema: a AEP usa hoje,
// o DRPS/QPS podem usar depois. Lida pelo editor, laudo, PDF, inventário e IA.

import { useState } from "react";
import { BookMarked, ChevronDown, Loader2, Save } from "lucide-react";
import { useBibliotecaPsi, useSalvarFatorBiblioteca } from "@/lib/hooks/useBibliotecaPsi";
import { useIsAdmin } from "@/lib/hooks/useUsuario";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import type { FatorBiblioteca, FonteGeradora } from "@/lib/aep/biblioteca";
import { cn, fmtData } from "@/lib/utils";

const linhas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** "1.3 — Texto" por linha ↔ fontes. Linha sem código ganha o próximo número. */
function fontesDeTexto(t: string, ordem: number): FonteGeradora[] {
  let n = 0;
  return linhas(t).map((l) => {
    const m = l.match(/^(\d+\.\d+)\s*[—–-]\s*(.+)$/);
    n += 1;
    return m ? { codigo: m[1], texto: m[2].trim() } : { codigo: `${ordem}.${n}`, texto: l };
  });
}

function EditorFator({ f, podeEditar }: { f: FatorBiblioteca; podeEditar: boolean }) {
  const salvar = useSalvarFatorBiblioteca();
  const [v, setV] = useState({
    descricao_risco: f.descricao_risco,
    danos_saude: f.danos_saude,
    meio_propagacao: f.meio_propagacao,
    situacao_padrao: f.situacao_padrao,
    tempo_exposicao_padrao: f.tempo_exposicao_padrao,
    medidas_controle_verificar: f.medidas_controle_verificar,
    fontes: f.fontes_geradoras.map((x) => `${x.codigo} — ${x.texto}`).join("\n"),
    sugestoes: f.sugestoes_iniciais.join("\n"),
    acoes: f.acoes.join("\n"),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const cls =
    "w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50";
  const campo = (label: string, k: keyof typeof v, rows = 2, dica?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label} {dica && <span className="font-normal text-gray-400">({dica})</span>}
      </span>
      {rows === 1 ? (
        <input disabled={!podeEditar} value={v[k]} onChange={set(k)} className={cls} />
      ) : (
        <textarea disabled={!podeEditar} rows={rows} value={v[k]} onChange={set(k)} className={cls} />
      )}
    </label>
  );
  return (
    <div className="space-y-3 border-t border-gray-100 p-4">
      {campo("Descrição do risco", "descricao_risco", 3)}
      {campo("Danos à saúde", "danos_saude", 3)}
      <div className="grid gap-3 sm:grid-cols-3">
        {campo("Meio de propagação", "meio_propagacao", 1)}
        {campo("Situação padrão", "situacao_padrao", 1)}
        {campo("Tempo de exposição padrão", "tempo_exposicao_padrao", 1)}
      </div>
      {campo("Medidas de controle a verificar em campo", "medidas_controle_verificar", 2)}
      {campo("Fontes geradoras", "fontes", 7, "uma por linha: código — texto")}
      <div className="grid gap-3 lg:grid-cols-2">
        {campo("Sugestões iniciais", "sugestoes", 5, "uma por linha")}
        {campo("Ações", "acoes", 5, "uma por linha")}
      </div>
      {podeEditar && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={salvar.isPending}
            onClick={() =>
              salvar.mutate({
                ...f,
                descricao_risco: v.descricao_risco.trim(),
                danos_saude: v.danos_saude.trim(),
                meio_propagacao: v.meio_propagacao.trim(),
                situacao_padrao: v.situacao_padrao.trim(),
                tempo_exposicao_padrao: v.tempo_exposicao_padrao.trim(),
                medidas_controle_verificar: v.medidas_controle_verificar.trim(),
                fontes_geradoras: fontesDeTexto(v.fontes, f.ordem),
                sugestoes_iniciais: linhas(v.sugestoes),
                acoes: linhas(v.acoes),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar fator
          </button>
        </div>
      )}
    </div>
  );
}

export default function BibliotecaPsiPage() {
  const { data: bib, isLoading } = useBibliotecaPsi();
  const isAdmin = useIsAdmin();
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BookMarked className="size-5 text-emerald-600" /> Biblioteca psicossocial
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Conteúdo técnico dos 13 fatores organizacionais, usado no detalhamento do laudo da AEP, no inventário
          psicossocial (SGG) e pela IA, que escolhe as ações desta lista.{" "}
          {isAdmin ? "Edite com cuidado: vale para todas as análises." : "Somente o perfil Admin pode editar."}
        </p>
      </div>
      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-gray-100" />}
      {ITENS_ORGANIZACIONAL.map(({ key, label }) => {
        const f = bib?.[key];
        if (!f) return null;
        const open = aberto === key;
        return (
          <div key={key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setAberto(open ? null : key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {f.ordem}. {label}
                </p>
                <p className="text-xs text-gray-500">
                  {f.fontes_geradoras.length} fontes geradoras · {f.acoes.length} ações
                  {f.atualizado_por && ` · editado por ${f.atualizado_por} em ${fmtData(f.atualizado_em)}`}
                </p>
              </div>
              <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition", open && "rotate-180")} />
            </button>
            {open && <EditorFator key={f.atualizado_em ?? key} f={f} podeEditar={isAdmin} />}
          </div>
        );
      })}
    </div>
  );
}
```

### M: diff de `lib/supabase/types.ts`

```diff
@@ -2455,12 +2455,25 @@ export interface AepSetor {
     prob_manual?: boolean;
     sev_manual?: boolean;
   }>;
+  /**
+   * Motivo de cada fator organizacional marcado N/I (2026-10-06), obrigatório.
+   * `{ assedio: { motivo: "receio_manifestacao" } }`. Ver lib/aep/coleta.ts.
+   */
+  motivo_ni?: Record<string, import("@/lib/aep/coleta").MotivoNiFator>;
+  /** Condições da coleta do setor (2026-10-06). Ver lib/aep/coleta.ts. */
+  condicoes_coleta?: import("@/lib/aep/coleta").CondicoesColeta;
+  /** Origem da evidência por fator "Sim" (2026-10-06). Ver lib/aep/evidencia.ts. */
+  origem_evidencia?: Record<string, string[]>;
+  /** Fontes geradoras da biblioteca marcadas por fator (códigos, ex. "1.3"). */
+  fontes_geradoras?: Record<string, string[]>;
   parecer_tecnico: string;
   recomendacoes: string;
   necessita_aet: boolean;
 }
 
 export interface AepRelatorio {
+  /** v272: checklist de gestão (uma vez por AEP). Ver lib/aep/checklist-gestao.ts. */
+  checklist_gestao?: import("@/lib/aep/checklist-gestao").ChecklistGestao;
   /** v270: liberação para o Comercial. */
   liberado_comercial_em?: string | null;
   liberado_comercial_por?: string | null;
```

### N: diff de `lib/hooks/useAep.ts`

```diff
@@ -1,6 +1,9 @@
 "use client";
 
 import { sinaisValidos } from "@/lib/aep/sinais-organizacional";
+import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta";
+import { normalizarMapaLista } from "@/lib/aep/evidencia";
+import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
 import { situacaoQuestionario, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
 import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
 import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
@@ -128,6 +131,12 @@ function normalizarSetor(s: unknown): AepSetor {
       }
       return out;
     })(),
+    // Motivo do N/I e condições da coleta (2026-10-06) — mesmo cuidado.
+    motivo_ni: normalizarMotivoNi(setor.motivo_ni),
+    condicoes_coleta: normalizarCondicoesColeta(setor.condicoes_coleta),
+    // Origem da evidência e fontes geradoras marcadas (2026-10-06).
+    origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
+    fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
     // ⚠️ Mesmo cuidado dos sinais: campo fora daqui some em toda leitura.
     aiha_organizacional:
       typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
@@ -144,6 +153,7 @@ export function normalizarRelatorio(data: unknown): AepRelatorio {
   return {
     ...rel,
     setores: Array.isArray(rel.setores) ? rel.setores.map(normalizarSetor) : [],
+    checklist_gestao: normalizarChecklistGestao(rel.checklist_gestao),
   } as AepRelatorio;
 }
 
```

### O: diff de `lib/aep/sinalizacao.ts`

```diff
@@ -11,6 +11,9 @@
 
 import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
+import { DRPS_POR_RECEIO, temReceioManifestacao, type SetorColeta } from "@/lib/aep/coleta";
+import { confiancaDoFator, type Confianca } from "@/lib/aep/evidencia";
+import { lacunasDoFator } from "@/lib/aep/checklist-gestao";
 import type { AepChecklistOrganizacional, AepRelatorio } from "@/lib/supabase/types";
 
 /** Ordem de gravidade dos níveis da matriz — o mais grave primeiro. */
@@ -25,6 +28,8 @@ export interface FatorSinalizado {
   severidade: string | null;
   sinais: string[];
   observacao: string | null;
+  /** Confiança da evidência (2026-10-06): uso interno, não muda o nível. */
+  confianca?: Confianca | null;
 }
 
 export interface SetorSinalizado {
@@ -87,9 +92,13 @@ export function totalAlertasOrganizacionais(setores: AepRelatorio["setores"]): n
 /**
  * A AEP recomenda aprofundar com DRPS/Questionário Psicossocial (NR-01) quando
  * há 3+ alertas organizacionais — a mesma regra do aviso do editor da AEP.
+ * Desde 2026-10-06 (`DRPS_POR_RECEIO`), também quando algum setor tem N/I por
+ * receio de manifestação ou sinais de inibição na coleta: o trabalhador que
+ * não fala na entrevista precisa de um instrumento em que possa responder.
  */
 export function recomendaQuestionario(setores: AepRelatorio["setores"]): boolean {
-  return totalAlertasOrganizacionais(setores) >= MIN_ALERTAS_QUESTIONARIO;
+  if (totalAlertasOrganizacionais(setores) >= MIN_ALERTAS_QUESTIONARIO) return true;
+  return DRPS_POR_RECEIO && (setores ?? []).some((s) => temReceioManifestacao(s as unknown as SetorColeta));
 }
 
 /** Situação do DRPS/Questionário Psicossocial que a empresa JÁ TEM. */
@@ -226,6 +235,10 @@ export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[
               severidade: a?.nivel ? a.severidade : null,
               sinais: rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional),
               observacao: setor.observacoes_checklist?.[key]?.trim() || null,
+              confianca: confiancaDoFator(
+                setor.origem_evidencia?.[key],
+                lacunasDoFator(rel.checklist_gestao, key).length > 0,
+              ),
             };
           })
           .sort((x, y) => (PESO_NIVEL[y.nivel ?? ""] ?? 0) - (PESO_NIVEL[x.nivel ?? ""] ?? 0));
```

### P: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -1,6 +1,27 @@
 "use client";
 
-import { MIN_ALERTAS_QUESTIONARIO, totalAlertasOrganizacionais } from "@/lib/aep/sinalizacao";
+import { recomendaQuestionario, totalAlertasOrganizacionais } from "@/lib/aep/sinalizacao";
+import {
+  DRPS_POR_RECEIO,
+  MOTIVOS_NI,
+  SINAIS_INIBICAO,
+  SINAIS_SUGERIDOS_INIBICAO,
+  fraseCondicoesColeta,
+  limitacoesDaAvaliacao,
+  niSemMotivo,
+  participantesExcedem,
+  temReceioManifestacao,
+  type CondicoesColeta,
+  type MotivoNi,
+  type MotivoNiFator,
+} from "@/lib/aep/coleta";
+import { ROTEIRO_CAMPO, type RoteiroFator } from "@/lib/aep/roteiro-campo";
+import { ORIGENS_EVIDENCIA, COR_CONFIANCA, confiancaDoFator } from "@/lib/aep/evidencia";
+import { lacunasDoFator, rotuloLacuna, type ChecklistGestao } from "@/lib/aep/checklist-gestao";
+import type { Biblioteca } from "@/lib/aep/biblioteca";
+import { detalhesDoSetor } from "@/lib/aep/inventario";
+import { useBibliotecaPsi } from "@/lib/hooks/useBibliotecaPsi";
+import { registrarAuditoria } from "@/lib/auditoria/registrar";
 import { chaveNome, type CargoCatalogo, type SetorCatalogo } from "@/lib/aep/catalogo-setores";
 import SituacaoSinalizacaoAep from "@/components/aep/SituacaoSinalizacaoAep";
 import { EditorSkeleton } from "@/components/ui/PageSkeletons";
@@ -10,6 +31,7 @@ import Link from "next/link";
 import {
   AlertTriangle,
   ChevronDown,
+  Compass,
   ChevronUp,
   ExternalLink,
   Loader2,
@@ -332,6 +354,312 @@ function AihaDoFator({
   );
 }
 
+// ─── Motivo do N/I (Ergonomia Organizacional, 2026-10-06) ─────────────────────
+// Obrigatório: o Salvar recusa N/I sem motivo. N/I continua fora da matriz e
+// do "Necessita AET"; o motivo vai para o laudo ("Limitações da avaliação").
+
+function MotivoNiCampo({
+  valor,
+  onChange,
+  disabled,
+}: {
+  valor: MotivoNiFator | undefined;
+  onChange: (v: MotivoNiFator) => void;
+  disabled?: boolean;
+}) {
+  const motivo = valor?.motivo ?? "";
+  const faltaTexto = motivo === "outro" && !(valor?.texto ?? "").trim();
+  return (
+    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2 space-y-1">
+      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
+        Motivo do N/I <span className="text-red-600">*</span>
+      </span>
+      <select
+        disabled={disabled}
+        value={motivo}
+        onChange={(e) => onChange({ ...valor, motivo: e.target.value as MotivoNi | "" })}
+        className={cn(
+          "w-full rounded border bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:outline-none disabled:bg-gray-50",
+          motivo ? "border-gray-200" : "border-red-300",
+        )}
+      >
+        <option value="">Selecione o motivo…</option>
+        {MOTIVOS_NI.map((m) => (
+          <option key={m.key} value={m.key}>
+            {m.label}
+          </option>
+        ))}
+      </select>
+      {motivo && (
+        <input
+          type="text"
+          disabled={disabled}
+          value={valor?.texto ?? ""}
+          onChange={(e) => onChange({ motivo, texto: e.target.value })}
+          placeholder={motivo === "outro" ? "Descreva o motivo (obrigatório)" : "Detalhe (opcional)"}
+          className={cn(
+            "w-full rounded border bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:outline-none disabled:bg-gray-50",
+            faltaTexto ? "border-red-300" : "border-gray-200",
+          )}
+        />
+      )}
+    </div>
+  );
+}
+
+// ─── Roteiro de campo do fator (2026-10-06) ──────────────────────────────────
+// Perguntas indiretas e o que observar — só orientação, não grava nada.
+
+function RoteiroDoFator({ roteiro }: { roteiro: RoteiroFator }) {
+  return (
+    <details className="group rounded-md border border-teal-100 bg-teal-50/40 px-2 py-1">
+      <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold text-teal-800">
+        <Compass className="size-3" /> Roteiro de campo
+        <ChevronDown className="size-3 transition group-open:rotate-180" />
+      </summary>
+      <div className="mt-1 grid gap-2 text-[11px] leading-snug text-gray-700 md:grid-cols-2">
+        <div>
+          <p className="font-semibold text-teal-800">Pergunte (de forma indireta)</p>
+          <ul className="list-disc pl-4">
+            {roteiro.perguntas.map((q) => (
+              <li key={q}>{q}</li>
+            ))}
+          </ul>
+        </div>
+        <div>
+          <p className="font-semibold text-teal-800">Observe</p>
+          <ul className="list-disc pl-4">
+            {roteiro.observar.map((q) => (
+              <li key={q}>{q}</li>
+            ))}
+          </ul>
+        </div>
+      </div>
+    </details>
+  );
+}
+
+// ─── Condições da coleta (2026-10-06) ────────────────────────────────────────
+
+function CondicoesColetaCampos({
+  valor,
+  onChange,
+  disabled,
+  assedioSim,
+  sinaisAssedio,
+  onMarcarSugeridos,
+}: {
+  valor: CondicoesColeta | undefined;
+  onChange: (v: CondicoesColeta) => void;
+  disabled?: boolean;
+  /** O fator Assédio está marcado "Sim"? (os sinais só abrem com Sim) */
+  assedioSim: boolean;
+  sinaisAssedio: string[];
+  onMarcarSugeridos: () => void;
+}) {
+  const c = valor ?? {};
+  const set = (patch: Partial<CondicoesColeta>) => onChange({ ...c, ...patch });
+  const numero = (v: string) => (v === "" ? null : Math.max(0, Math.floor(Number(v))));
+  const inibicao = c.sinais_inibicao ?? [];
+  const faltamSugeridos = SINAIS_SUGERIDOS_INIBICAO.filter((k) => !sinaisAssedio.includes(k));
+  const inputCls =
+    "w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50";
+  return (
+    <div className="space-y-2 border-t border-emerald-100 pt-3">
+      <p className="text-xs font-semibold text-emerald-800">Condições da coleta</p>
+      <div className="grid gap-3 sm:grid-cols-3">
+        <div>
+          <label className="mb-1 block text-xs font-medium text-gray-600">Trabalhadores abordados</label>
+          <input type="number" min={0} disabled={disabled} value={c.trab_abordados ?? ""}
+            onChange={(e) => set({ trab_abordados: numero(e.target.value) })} className={inputCls} />
+        </div>
+        <div>
+          <label className="mb-1 block text-xs font-medium text-gray-600">Participaram</label>
+          <input type="number" min={0} disabled={disabled} value={c.trab_participantes ?? ""}
+            onChange={(e) => set({ trab_participantes: numero(e.target.value) })}
+            className={cn(inputCls, participantesExcedem(c) && "border-red-300")} />
+          {participantesExcedem(c) && (
+            <p className="mt-0.5 text-[11px] text-red-600">Mais participantes que abordados.</p>
+          )}
+        </div>
+        <div>
+          <label className="mb-1 block text-xs font-medium text-gray-600">
+            Recusas / respostas evasivas <span className="font-normal text-gray-400">(só o número)</span>
+          </label>
+          <input type="number" min={0} disabled={disabled} value={c.recusas_evasivas ?? ""}
+            onChange={(e) => set({ recusas_evasivas: numero(e.target.value) })} className={inputCls} />
+        </div>
+      </div>
+      <label className="flex items-center gap-2 text-xs text-gray-700">
+        <input type="checkbox" disabled={disabled} checked={c.lideranca_presente === true}
+          onChange={(e) => set({ lideranca_presente: e.target.checked })}
+          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
+        Liderança presente durante a coleta
+      </label>
+      <div>
+        <p className="mb-1 text-xs font-medium text-gray-600">Sinais de inibição observados</p>
+        <div className="grid gap-1 sm:grid-cols-2">
+          {SINAIS_INIBICAO.map((s) => (
+            <label key={s.key} className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-700">
+              <input
+                type="checkbox"
+                disabled={disabled}
+                checked={inibicao.includes(s.key)}
+                onChange={() =>
+                  set({ sinais_inibicao: inibicao.includes(s.key) ? inibicao.filter((k) => k !== s.key) : [...inibicao, s.key] })
+                }
+                className="mt-0.5 size-3 shrink-0 accent-amber-600"
+              />
+              {s.label}
+            </label>
+          ))}
+        </div>
+      </div>
+      <textarea
+        disabled={disabled}
+        rows={2}
+        value={c.obs_coleta ?? ""}
+        onChange={(e) => set({ obs_coleta: e.target.value })}
+        placeholder="Observações sobre a coleta (sem identificar trabalhadores)"
+        className={inputCls}
+      />
+      {/* Sugestão, nunca marcação automática: o técnico decide. */}
+      {inibicao.length > 0 && (
+        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
+          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
+          <div className="space-y-1">
+            {assedioSim ? (
+              faltamSugeridos.length > 0 ? (
+                <p>
+                  Sinais de inibição costumam acompanhar, no fator <strong>Assédio</strong>, os sinais “Falta de abertura
+                  para escuta” e “Ambiente de tensão ou silêncio excessivo”. Avalie se eles se aplicam.
+                  {!disabled && (
+                    <button type="button" onClick={onMarcarSugeridos} className="ml-1 font-semibold text-amber-800 underline">
+                      Marcar esses sinais
+                    </button>
+                  )}
+                </p>
+              ) : (
+                <p>Os sinais de escuta e de tensão já estão marcados no fator Assédio.</p>
+              )
+            ) : (
+              <p>
+                Sinais de inibição observados: avalie o fator <strong>Assédio</strong> na Ergonomia Organizacional (sinais
+                “Falta de abertura para escuta” e “Ambiente de tensão ou silêncio excessivo”).
+              </p>
+            )}
+            <p>
+              Recomenda-se complementar com instrumento anônimo (DRPS/Questionário Psicossocial), em que os trabalhadores
+              possam responder sem exposição.
+            </p>
+          </div>
+        </div>
+      )}
+    </div>
+  );
+}
+
+// ─── Evidência do fator "Sim" (Fase 2, 2026-10-06) ───────────────────────────
+// Origem por FATOR (decisão do usuário) → confiança Baixa/Média/Alta; lacuna
+// do checklist de gestão conta como "documental". Fontes geradoras: as
+// lacunas de gestão aparecem sozinhas; o técnico marca outras da biblioteca.
+// Nada aqui mexe na matriz AIHA.
+
+function EvidenciaDoFator({
+  fator,
+  origens,
+  onOrigens,
+  fontes,
+  onFontes,
+  gestao,
+  biblioteca,
+  disabled,
+}: {
+  fator: string;
+  origens: string[];
+  onOrigens: (v: string[]) => void;
+  fontes: string[];
+  onFontes: (v: string[]) => void;
+  gestao: ChecklistGestao | undefined;
+  biblioteca: Biblioteca | undefined;
+  disabled?: boolean;
+}) {
+  const lacunas = lacunasDoFator(gestao, fator);
+  const conf = confiancaDoFator(origens, lacunas.length > 0);
+  const doFator = biblioteca?.[fator]?.fontes_geradoras ?? [];
+  const alternar = (lista: string[], k: string) => (lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
+  return (
+    <div className="rounded-md border border-sky-200 bg-sky-50/50 p-2 space-y-2">
+      <div className="flex flex-wrap items-center justify-between gap-2">
+        <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Origem da evidência</span>
+        {conf ? (
+          <span
+            className="rounded px-1.5 py-px text-[10px] font-bold"
+            style={{ backgroundColor: COR_CONFIANCA[conf].bg, color: COR_CONFIANCA[conf].cor }}
+            title="1 tipo de origem = Baixa · 2 = Média · 3 ou mais = Alta (lacuna de gestão conta como documental)"
+          >
+            Confiança {conf}
+          </span>
+        ) : (
+          <span className="text-[10px] text-gray-500">marque de onde veio a evidência</span>
+        )}
+      </div>
+      <div className="flex flex-wrap gap-1">
+        {ORIGENS_EVIDENCIA.map((o) => {
+          const auto = o.key === "documental" && lacunas.length > 0 && !origens.includes(o.key);
+          const on = origens.includes(o.key) || auto;
+          return (
+            <button
+              key={o.key}
+              type="button"
+              disabled={disabled || auto}
+              title={auto ? "Conta sozinha: há lacuna no checklist de gestão ligada a este fator" : undefined}
+              onClick={() => onOrigens(alternar(origens, o.key))}
+              className={cn(
+                "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition",
+                on ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50",
+                auto && "opacity-80",
+              )}
+            >
+              {o.label}
+            </button>
+          );
+        })}
+      </div>
+      {(lacunas.length > 0 || doFator.length > 0) && (
+        <details className="group">
+          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
+            Fontes geradoras ({lacunas.length + fontes.filter((c) => doFator.some((f) => f.codigo === c)).length})
+            <ChevronDown className="size-3 transition group-open:rotate-180" />
+          </summary>
+          <div className="mt-1 space-y-1 text-[11px] leading-snug text-gray-700">
+            {lacunas.map((l) => (
+              <p key={l.codigo} className="flex items-start gap-1.5">
+                <span className="mt-0.5 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">gestão</span>
+                {rotuloLacuna(l)}
+              </p>
+            ))}
+            {doFator.map((f) => (
+              <label key={f.codigo} className={cn("flex items-start gap-1.5", disabled ? "opacity-60" : "cursor-pointer")}>
+                <input
+                  type="checkbox"
+                  disabled={disabled}
+                  checked={fontes.includes(f.codigo)}
+                  onChange={() => onFontes(alternar(fontes, f.codigo))}
+                  className="mt-0.5 size-3 shrink-0 accent-sky-600"
+                />
+                <span>
+                  <span className="font-mono text-[10px] text-gray-500">{f.codigo}</span> {f.texto}
+                </span>
+              </label>
+            ))}
+          </div>
+        </details>
+      )}
+    </div>
+  );
+}
+
 // ─── Bloco de checklist ───────────────────────────────────────────────────────
 
 function ChecklistBloco({
@@ -351,6 +679,10 @@ function ChecklistBloco({
   matriz,
   aiha,
   onAihaChange,
+  motivosNi,
+  onMotivoNiChange,
+  roteiro,
+  extraSim,
 }: {
   titulo: string;
   cor: string;
@@ -372,6 +704,12 @@ function ChecklistBloco({
   matriz?: MatrizRisco | null;
   aiha?: AihaOrganizacional;
   onAihaChange?: (fator: string, patch: Partial<AihaFator>) => void;
+  /** Motivo do N/I e roteiro de campo — só a Ergonomia Organizacional (2026-10-06). */
+  motivosNi?: Record<string, MotivoNiFator>;
+  onMotivoNiChange?: (fator: string, v: MotivoNiFator) => void;
+  roteiro?: Record<string, RoteiroFator>;
+  /** Conteúdo extra do fator marcado "Sim" (origem da evidência, fontes). */
+  extraSim?: (fator: string) => React.ReactNode;
 }) {
   const positivos = itens.filter((i) => valores[i.key] === "sim").length;
   return (
@@ -417,6 +755,15 @@ function ChecklistBloco({
                   disabled={disabled}
                 />
               )}
+              {valores[key] === "sim" && extraSim?.(key)}
+              {valores[key] === "nao_identificado" && onMotivoNiChange && (
+                <MotivoNiCampo
+                  valor={motivosNi?.[key]}
+                  onChange={(v) => onMotivoNiChange(key, v)}
+                  disabled={disabled}
+                />
+              )}
+              {roteiro?.[key] && <RoteiroDoFator roteiro={roteiro[key]} />}
             </Tristate>
           );
         })}
@@ -464,6 +811,9 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
   const [statusOrdem, setStatusOrdem] = useState<StatusOrdemSalva>("parado");
   // Matriz de risco ativa (a mesma da inspeção) — classifica a Ergonomia Organizacional.
   const { data: matriz } = useMatrizAtiva();
+  // Biblioteca psicossocial e checklist de gestão (Fase 2, 2026-10-06).
+  const { data: biblioteca } = useBibliotecaPsi();
+  const gestao = rel?.checklist_gestao;
   // Setores e cargos que a empresa já tem no sistema (das inspeções) — o
   // editor sugere, e o técnico continua podendo digitar à mão (2026-10-05).
   const { data: catalogo = [] } = useCatalogoSetoresEmpresa(
@@ -699,6 +1049,23 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
             };
           }),
           necessita_aet: !!setor.necessita_aet,
+          // Limitações (N/I com motivo) e condições da coleta (2026-10-06).
+          limitacoes: limitacoesDaAvaliacao(
+            setor,
+            (k) => ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k,
+          ),
+          condicoes_coleta: fraseCondicoesColeta(setor.condicoes_coleta),
+          receio_manifestacao: temReceioManifestacao(setor),
+          // Fontes, origem e confiança + sugestões/ações da biblioteca (Fase 2).
+          evidencias_fatores: detalhesDoSetor(setor, gestao, biblioteca).map((d) => ({
+            fator: d.label,
+            fontes: d.fontes,
+            medidas_existentes: d.medidasExistentes,
+            origens: d.origens,
+            confianca: d.confianca,
+            sugestoes: d.sugestoes,
+            acoes: d.acoes,
+          })),
         },
       });
       if (error) { toast.error(mensagemErro(error, "Erro ao gerar texto")); return; }
@@ -712,9 +1079,39 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
   }
 
   async function handleSalvar() {
+    // N/I exige motivo (2026-10-06): sem ele o laudo não explica a lacuna.
+    const pendentes = setores.flatMap((s) =>
+      niSemMotivo(s).map(
+        (k) => `${s.nome_setor || "Setor sem nome"} · ${ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k}`,
+      ),
+    );
+    if (pendentes.length > 0) {
+      toast.error(
+        `Informe o motivo do N/I antes de salvar:\n${pendentes.slice(0, 5).join("\n")}${pendentes.length > 5 ? `\n… e mais ${pendentes.length - 5}` : ""}`,
+        { duration: 7000 },
+      );
+      return;
+    }
     setSalvando(true);
     try {
       await salvar.mutateAsync({ id: idRelatorio, setores: setores as unknown as AepSetor[] });
+      // Rastro da origem da evidência (quem marcou, quando, o quê) na
+      // auditoria append-only — só quando mudou.
+      const antes = JSON.stringify((rel?.setores ?? []).map((s) => [s.id, s.origem_evidencia ?? {}]));
+      const depois = JSON.stringify(setores.map((s) => [s.id, s.origem_evidencia ?? {}]));
+      if (antes !== depois) {
+        void registrarAuditoria({
+          modulo: "aep",
+          id_referencia: idRelatorio,
+          acao: "origem_evidencia",
+          descricao: "Origem da evidência dos fatores organizacionais atualizada",
+          metadata: {
+            setores: setores
+              .filter((s) => Object.keys(s.origem_evidencia ?? {}).length > 0)
+              .map((s) => ({ setor: s.nome_setor, origem_evidencia: s.origem_evidencia })),
+          },
+        });
+      }
     } catch {
       // erro já tratado pelo hook
     } finally {
@@ -1027,6 +1424,22 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         />
                       </div>
                     </div>
+                    <CondicoesColetaCampos
+                      valor={setor.condicoes_coleta}
+                      disabled={!canEdit}
+                      onChange={(v) => updateSetor(setor.id, { condicoes_coleta: v })}
+                      assedioSim={setor.checklist_organizacional?.assedio === "sim"}
+                      sinaisAssedio={setor.sinais_organizacional?.assedio ?? []}
+                      onMarcarSugeridos={() => {
+                        const atuais = setor.sinais_organizacional?.assedio ?? [];
+                        updateSetor(setor.id, {
+                          sinais_organizacional: {
+                            ...(setor.sinais_organizacional ?? {}),
+                            assedio: [...atuais, ...SINAIS_SUGERIDOS_INIBICAO.filter((k) => !atuais.includes(k))],
+                          },
+                        });
+                      }}
+                    />
                   </div>
                 </section>
 
@@ -1073,12 +1486,25 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         // Voltar um fator para Não/N-A limpa os sinais dele: deixar
                         // sinal marcado sob fator negado sairia contraditório no laudo.
                         const sinais = { ...(setor.sinais_organizacional ?? {}) };
+                        // Idem para o motivo do N/I de um fator que deixou de ser N/I.
+                        const motivos = { ...(setor.motivo_ni ?? {}) };
+                        // E a origem da evidência / fontes de quem deixou de ser Sim.
+                        const origens = { ...(setor.origem_evidencia ?? {}) };
+                        const fontes = { ...(setor.fontes_geradoras ?? {}) };
                         for (const [k, v] of Object.entries(p)) {
-                          if (v !== "sim") delete sinais[k];
+                          if (v !== "sim") {
+                            delete sinais[k];
+                            delete origens[k];
+                            delete fontes[k];
+                          }
+                          if (v !== "nao_identificado") delete motivos[k];
                         }
                         updateSetor(setor.id, {
                           checklist_organizacional: { ...setor.checklist_organizacional, ...p } as AepChecklistOrganizacional,
                           sinais_organizacional: sinais,
+                          motivo_ni: motivos,
+                          origem_evidencia: origens,
+                          fontes_geradoras: fontes,
                         });
                       }}
                       onObservacaoChange={(key, text) =>
@@ -1094,6 +1520,27 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                           sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
                         })
                       }
+                      motivosNi={setor.motivo_ni}
+                      onMotivoNiChange={(fator, v) =>
+                        updateSetor(setor.id, { motivo_ni: { ...(setor.motivo_ni ?? {}), [fator]: v } })
+                      }
+                      roteiro={ROTEIRO_CAMPO}
+                      extraSim={(fator) => (
+                        <EvidenciaDoFator
+                          fator={fator}
+                          origens={setor.origem_evidencia?.[fator] ?? []}
+                          onOrigens={(v) =>
+                            updateSetor(setor.id, { origem_evidencia: { ...(setor.origem_evidencia ?? {}), [fator]: v } })
+                          }
+                          fontes={setor.fontes_geradoras?.[fator] ?? []}
+                          onFontes={(v) =>
+                            updateSetor(setor.id, { fontes_geradoras: { ...(setor.fontes_geradoras ?? {}), [fator]: v } })
+                          }
+                          gestao={gestao}
+                          biblioteca={biblioteca}
+                          disabled={!canEdit}
+                        />
+                      )}
                       matriz={matriz}
                       aiha={setor.aiha_organizacional}
                       onAihaChange={(fator, patch) => {
@@ -1241,16 +1688,20 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
         );
       })}
 
-      {/* Banner AEP → QPS */}
+      {/* Banner AEP → QPS — mesma regra da Sinalização e do Comercial. */}
       {(() => {
+        if (!recomendaQuestionario(setores)) return null;
         const totalAlertasOrg = totalAlertasOrganizacionais(setores);
-        if (totalAlertasOrg < MIN_ALERTAS_QUESTIONARIO) return null;
+        const porReceio = DRPS_POR_RECEIO && setores.some((s) => temReceioManifestacao(s));
         return (
           <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
             <AlertTriangle className="size-5 shrink-0 text-indigo-600 mt-0.5" />
             <div className="flex-1">
               <p className="text-sm font-semibold text-indigo-900">
-                {totalAlertasOrg} alerta{totalAlertasOrg > 1 ? "s" : ""} de risco organizacional identificado{totalAlertasOrg > 1 ? "s" : ""}
+                {totalAlertasOrg > 0 &&
+                  `${totalAlertasOrg} alerta${totalAlertasOrg > 1 ? "s" : ""} de risco organizacional identificado${totalAlertasOrg > 1 ? "s" : ""}`}
+                {totalAlertasOrg > 0 && porReceio && " · "}
+                {porReceio && "receio dos trabalhadores em se manifestar"}
               </p>
               <p className="mt-0.5 text-xs text-indigo-700 leading-relaxed">
                 A NR-1 e a Fundacentro recomendam aprofundar a avaliação de riscos psicossociais com um
```

### Q: diff de `components/aep/SinalizacaoEmpresaDetalhe.tsx`

```diff
@@ -237,6 +237,14 @@ export default function SinalizacaoEmpresaDetalhe({
                             </td>
                             <td className="border border-gray-200 px-3 py-2 align-top">
                               <SeloNivelAiha nivel={f.nivel} />
+                              {f.confianca && (
+                                <div
+                                  className="mt-1 text-[11px] text-gray-500"
+                                  title="Confiança da evidência pela diversidade de origens (uso interno; não muda o nível)"
+                                >
+                                  Confiança {f.confianca}
+                                </div>
+                              )}
                             </td>
                             <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{f.probabilidade ?? "—"}</td>
                             <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{f.severidade ?? "—"}</td>
```

### R: diff de `app/(aep)/aep/[idRelatorio]/laudo/page.tsx`

```diff
@@ -1,7 +1,7 @@
 "use client";
 
 import { use, useMemo, useState } from "react";
-import { AlertTriangle, BadgeCheck, Download, Loader2 } from "lucide-react";
+import { AlertTriangle, BadgeCheck, Download, FileSpreadsheet, Loader2 } from "lucide-react";
 import { useAepRelatorio, CLASS_COLOR_AEP, riscoMaximoSetor } from "@/lib/hooks/useAep";
 import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
 import HtmlConteudoAssinado from "@/components/ui/HtmlConteudoAssinado";
@@ -16,6 +16,12 @@ import { useEmpresa } from "@/lib/hooks/useEmpresas";
 import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
 import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
+import { fraseCondicoesColeta, limitacoesDaAvaliacao } from "@/lib/aep/coleta";
+import { COLUNAS_INVENTARIO, csvInventario, detalhesDoSetor, linhasInventario } from "@/lib/aep/inventario";
+import { COR_CONFIANCA } from "@/lib/aep/evidencia";
+import { useBibliotecaPsi } from "@/lib/hooks/useBibliotecaPsi";
+import type { ChecklistGestao } from "@/lib/aep/checklist-gestao";
+import type { Biblioteca } from "@/lib/aep/biblioteca";
 import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
 import { piorNivel } from "@/lib/aep/sinalizacao";
 import { gerarConsideracoesAep } from "@/lib/aep/consideracoes";
@@ -96,7 +102,17 @@ const LEGENDA_ORG: { sigla: string; cls: string; titulo: string; texto: string }
 
 // ─── Bloco por setor ─────────────────────────────────────────────────────────
 
-function SetorBlock({ setor, idx }: { setor: AepSetor; idx: number }) {
+function SetorBlock({
+  setor,
+  idx,
+  gestao,
+  biblioteca,
+}: {
+  setor: AepSetor;
+  idx: number;
+  gestao?: ChecklistGestao;
+  biblioteca?: Biblioteca;
+}) {
   const rMax = riscoMaximoSetor(setor);
 
   return (
@@ -148,6 +164,12 @@ function SetorBlock({ setor, idx }: { setor: AepSetor; idx: number }) {
               </td>
             </tr>
           )}
+          {fraseCondicoesColeta(setor.condicoes_coleta) && (
+            <tr className="border-b border-gray-100">
+              <td className="bg-gray-50 px-2 py-1 font-semibold align-top">Condições da coleta</td>
+              <td className="px-2 py-1" colSpan={3}>{fraseCondicoesColeta(setor.condicoes_coleta)}</td>
+            </tr>
+          )}
           {setor.descricao_atividade && (
             <tr>
               <td className="bg-gray-50 px-2 py-1 font-semibold align-top">Atividades</td>
@@ -261,6 +283,57 @@ function SetorBlock({ setor, idx }: { setor: AepSetor; idx: number }) {
         </div>
       </div>
 
+      {/* Limitações da avaliação: cada N/I com o motivo (2026-10-06). */}
+      {(() => {
+        const lim = limitacoesDaAvaliacao(setor, (k) => CHECKLIST_ORG_LABELS.find(([x]) => x === k)?.[1] ?? k);
+        if (lim.length === 0) return null;
+        return (
+          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
+            <p className="font-bold">Limitações da avaliação</p>
+            <ul className="mt-0.5 list-disc pl-4">
+              {lim.map((l) => (
+                <li key={l}>{l}</li>
+              ))}
+            </ul>
+          </div>
+        );
+      })()}
+
+      {/* Detalhamento dos fatores psicossociais "Sim" (2026-10-06). */}
+      {(() => {
+        const det = detalhesDoSetor(setor, gestao, biblioteca);
+        if (det.length === 0) return null;
+        return (
+          <div className="mb-3 space-y-1.5 text-[11px] text-gray-700">
+            <p className="text-[10px] font-bold uppercase text-amber-800">Fatores psicossociais identificados — detalhamento</p>
+            {det.map((d) => (
+              <div key={d.key} className="rounded border border-amber-200 px-2 py-1">
+                <p className="font-bold">
+                  {d.label}
+                  {d.nivel ? ` · Nível ${d.nivel}` : ""}
+                  {d.confianca && (
+                    <span
+                      className="ml-1.5 rounded px-1 text-[10px]"
+                      style={{ backgroundColor: COR_CONFIANCA[d.confianca].bg, color: COR_CONFIANCA[d.confianca].cor }}
+                    >
+                      Confiança {d.confianca}
+                    </span>
+                  )}
+                </p>
+                {d.descricao && <p><strong>Descrição do risco:</strong> {d.descricao}</p>}
+                {d.danos && <p><strong>Danos à saúde:</strong> {d.danos}</p>}
+                {d.fontes.length > 0 && <p><strong>Fontes geradoras:</strong> {d.fontes.join("; ")}</p>}
+                <p>
+                  <strong>Medidas de controle existentes:</strong>{" "}
+                  {d.medidasExistentes.length ? d.medidasExistentes.join("; ") : "Não evidenciadas medidas de controle específicas"}
+                </p>
+                {d.origens.length > 0 && <p><strong>Origem das evidências:</strong> {d.origens.join(", ")}</p>}
+              </div>
+            ))}
+          </div>
+        );
+      })()}
+
       {/* Matriz de riscos */}
       {setor.riscos.length > 0 && (
         <table className="mb-3 w-full border border-gray-200 text-xs">
@@ -317,6 +390,34 @@ export default function AepLaudoPage({
   const { data: rel } = useAepRelatorio(idRelatorio);
   const { data: empresaFull } = useEmpresa((rel as { id_empresa?: string })?.id_empresa ?? null);
   const { data: capsAep = [] } = useTextosPadrao("aep");
+  const { data: biblioteca } = useBibliotecaPsi();
+
+  /** Inventário psicossocial (setor × fator "Sim") para lançamento no SGG. */
+  async function exportarInventario(formato: "xlsx" | "csv") {
+    if (!rel) return;
+    const linhas = linhasInventario(rel.setores, rel.checklist_gestao, biblioteca);
+    if (linhas.length === 0) {
+      toast.error("Nenhum fator organizacional marcado Sim nesta AEP.");
+      return;
+    }
+    const nomeEmp = ((rel.empresas as { nome_empresa?: string } | null)?.nome_empresa ?? "aep")
+      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").toLowerCase();
+    const nome = `inventario-psicossocial-${nomeEmp}`;
+    if (formato === "csv") {
+      const blob = new Blob([csvInventario(linhas)], { type: "text/csv;charset=utf-8" });
+      const a = document.createElement("a");
+      a.href = URL.createObjectURL(blob);
+      a.download = `${nome}.csv`;
+      a.click();
+      URL.revokeObjectURL(a.href);
+      return;
+    }
+    const XLSX = await import("xlsx");
+    const ws = XLSX.utils.aoa_to_sheet([[...COLUNAS_INVENTARIO], ...linhas]);
+    const wb = XLSX.utils.book_new();
+    XLSX.utils.book_append_sheet(wb, ws, "Inventário psicossocial");
+    XLSX.writeFile(wb, `${nome}.xlsx`);
+  }
   const { pdfAssinado, recarregar } = usePdfAssinado("aep_relatorios", idRelatorio);
   const { data: pdfCongelado } = usePdfCongelado("aep", idRelatorio);
   const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
@@ -478,6 +579,21 @@ export default function AepLaudoPage({
               baseCongeladaUrl={baseCongeladaUrl}
             />
           )}
+          <button
+            type="button"
+            onClick={() => exportarInventario("xlsx")}
+            title="Inventário psicossocial (setor × fator Sim) para lançamento no SGG"
+            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
+          >
+            <FileSpreadsheet className="size-4" /> Inventário (Excel)
+          </button>
+          <button
+            type="button"
+            onClick={() => exportarInventario("csv")}
+            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
+          >
+            CSV
+          </button>
           <BotaoGerarPdf
             tabelaNome="aep_relatorios"
             docId={idRelatorio}
@@ -621,7 +737,7 @@ export default function AepLaudoPage({
                 return (
                   <Section key={c.id_capitulo} titulo={numLabel(numPorSlug["aep_triagem"], tituloPorSlug["aep_triagem"] ?? "Triagem Ergonômica por Setor")}>
                     {rel.setores.map((setor, idx) => (
-                      <SetorBlock key={setor.id} setor={setor} idx={idx} />
+                      <SetorBlock key={setor.id} setor={setor} idx={idx} gestao={rel.checklist_gestao} biblioteca={biblioteca} />
                     ))}
                   </Section>
                 );
```

### S: diff de `app/api/pdf/aep/[id]/route.ts`

```diff
@@ -1,4 +1,8 @@
 import { NextRequest, NextResponse } from "next/server";
+import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta";
+import { normalizarMapaLista } from "@/lib/aep/evidencia";
+import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
+import { montarBiblioteca } from "@/lib/aep/biblioteca";
 import { cookies } from "next/headers";
 import { createSupabaseServerClient } from "@/lib/supabase/client";
 import type { AepRelatorioLocal, AepSetorLocal } from "@/components/pdf/templates/AepTemplate";
@@ -104,6 +108,11 @@ function normalizarSetor(s: unknown): AepSetorLocal {
       }
       return out;
     })(),
+    // Motivo do N/I e condições da coleta (2026-10-06) — mesmo cuidado.
+    motivo_ni: normalizarMotivoNi(setor.motivo_ni),
+    condicoes_coleta: normalizarCondicoesColeta(setor.condicoes_coleta),
+    origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
+    fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
     // Matriz AIHA dos fatores organizacionais (2026-10-02) — mesmo cuidado dos sinais.
     aiha_organizacional:
       typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
@@ -128,6 +137,7 @@ function normalizarRelatorio(data: unknown): AepRelatorioLocal {
     ...rel,
     endereco_empresa: (rel.endereco_empresa as string | null) ?? null,
     setores: Array.isArray(rel.setores) ? rel.setores.map(normalizarSetor) : [],
+    checklist_gestao: normalizarChecklistGestao(rel.checklist_gestao),
   } as AepRelatorioLocal;
 }
 
@@ -177,6 +187,10 @@ export async function GET(
     empresaCompleta = (rawEmp as unknown as Empresa) ?? null;
   }
 
+  // Biblioteca psicossocial (v272): descrição, danos e fontes dos fatores "Sim".
+  const { data: rawBib } = await supabase.from("psi_biblioteca_fatores").select("*");
+  const biblioteca = montarBiblioteca((rawBib ?? []) as unknown[]);
+
   // Busca capítulos editáveis (textos_padrao modulo=aep, ativos, ordenados)
   const { data: caps, error: capsError } = await supabase
     .from("textos_padrao")
@@ -239,6 +253,7 @@ export async function GET(
   const bodyHtml = renderToStaticMarkup(
     React.createElement(AepTemplate, {
       relatorio: rel,
+      biblioteca,
       empresa: empresaCompleta,
       capitulos,
       valoresVars,
```

### T: diff de `components/pdf/templates/AepTemplate.tsx`

```diff
@@ -14,6 +14,11 @@ import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/Secoes
 import { classeQuebraFixoNova, numerarCapitulos, numLabel } from "@/components/pdf/templates/shared";
 // Módulo puro (sem "use client", sem hook) — pode entrar no template do Puppeteer.
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
+import { fraseCondicoesColeta, limitacoesDaAvaliacao, type CondicoesColeta, type MotivoNiFator } from "@/lib/aep/coleta";
+import { detalhesDoSetor } from "@/lib/aep/inventario";
+import { COR_CONFIANCA } from "@/lib/aep/evidencia";
+import type { ChecklistGestao } from "@/lib/aep/checklist-gestao";
+import type { Biblioteca } from "@/lib/aep/biblioteca";
 import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
 import { piorNivel } from "@/lib/aep/sinalizacao";
 import { gerarConsideracoesAep } from "@/lib/aep/consideracoes";
@@ -91,6 +96,11 @@ export interface AepSetorLocal {
   sinais_organizacional?: Record<string, string[]>;
   /** Matriz AIHA dos fatores organizacionais "Sim" (2026-10-02). */
   aiha_organizacional?: Record<string, { probabilidade: string; severidade: string; nivel: string | null }>;
+  /** Motivo do N/I e condições da coleta (2026-10-06). */
+  motivo_ni?: Record<string, MotivoNiFator>;
+  condicoes_coleta?: CondicoesColeta;
+  origem_evidencia?: Record<string, string[]>;
+  fontes_geradoras?: Record<string, string[]>;
   cargos?: { id: string; cargo: string; descricao: string; quantidade: number }[];
   riscos: AepRisco[];
   checklist_fisica: AepChecklistFisica;
@@ -109,12 +119,16 @@ export interface AepRelatorioLocal {
   data_elaboracao: string | null;
   endereco_empresa: string | null;
   setores: AepSetorLocal[];
+  /** v272: checklist de gestão. */
+  checklist_gestao?: ChecklistGestao;
   conclusao: string | null;
   empresas?: { nome_empresa: string; cnpj: string | null } | null;
 }
 
 export interface AepTemplateProps {
   relatorio: AepRelatorioLocal;
+  /** Biblioteca psicossocial (v272) — detalhamento dos fatores "Sim". */
+  biblioteca?: Biblioteca;
   /** Empresa completa para a seção de sistema "Identificação da Empresa". */
   empresa?: Partial<Empresa> | null;
   /** Capítulos do módulo "aep" da tabela textos_padrao. */
@@ -359,9 +373,13 @@ function SectionTitulo({
 function SetorBlock({
   setor,
   idx,
+  gestao,
+  biblioteca,
 }: {
   setor: AepSetorLocal;
   idx: number;
+  gestao?: ChecklistGestao;
+  biblioteca?: Biblioteca;
 }) {
   const rMax = riscoMaximoSetor(setor);
   const rMaxCores = rMax ? RISCO_CORES[rMax] : null;
@@ -499,6 +517,16 @@ function SetorBlock({
               </td>
             </tr>
           )}
+          {fraseCondicoesColeta(setor.condicoes_coleta) && (
+            <tr>
+              <td style={{ backgroundColor: "#f9fafb", padding: "4px 8px", fontWeight: 600, verticalAlign: "top" }}>
+                Condições da coleta
+              </td>
+              <td style={{ padding: "4px 8px" }} colSpan={3}>
+                {fraseCondicoesColeta(setor.condicoes_coleta)}
+              </td>
+            </tr>
+          )}
           {setor.descricao_atividade && (
             <tr>
               <td
@@ -683,6 +711,64 @@ function SetorBlock({
         </div>
       </div>
 
+      {/* Limitações da avaliação: cada N/I com o motivo (2026-10-06). */}
+      {(() => {
+        const lim = limitacoesDaAvaliacao(
+          setor,
+          (k) => CHECKLIST_ORG_LABELS.find(([x]) => x === k)?.[1] ?? k,
+        );
+        if (lim.length === 0) return null;
+        return (
+          <div
+            className="setor-check-linha"
+            style={{ marginBottom: 12, border: "1px solid #fde68a", backgroundColor: "#fffbeb", padding: "4px 8px", fontSize: 10, color: "#92400e" }}
+          >
+            <p style={{ margin: 0, fontWeight: 700 }}>Limitações da avaliação</p>
+            <ul style={{ margin: "2px 0 0", paddingLeft: 14 }}>
+              {lim.map((l) => (
+                <li key={l} style={{ wordBreak: "break-word" }}>{l}</li>
+              ))}
+            </ul>
+          </div>
+        );
+      })()}
+
+      {/* Detalhamento dos fatores psicossociais "Sim" (2026-10-06): biblioteca,
+          fontes geradoras, medidas existentes, origem e confiança. Cores
+          cravadas (Puppeteer não enxerga as variáveis de tema). */}
+      {(() => {
+        const det = detalhesDoSetor(setor, gestao, biblioteca);
+        if (det.length === 0) return null;
+        return (
+          <div style={{ marginBottom: 12, fontSize: 9.5, color: "#374151" }}>
+            <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 10, color: "#92400e", textTransform: "uppercase" }}>
+              Fatores psicossociais identificados — detalhamento
+            </p>
+            {det.map((d) => (
+              <div key={d.key} className="setor-check-linha" style={{ border: "1px solid #fde68a", padding: "4px 8px", marginBottom: 4 }}>
+                <p style={{ margin: 0, fontWeight: 700 }}>
+                  {d.label}
+                  {d.nivel ? ` · Nível ${d.nivel}` : ""}
+                  {d.confianca && (
+                    <span style={{ marginLeft: 6, backgroundColor: COR_CONFIANCA[d.confianca].bg, color: COR_CONFIANCA[d.confianca].cor, padding: "0 4px", borderRadius: 3 }}>
+                      Confiança {d.confianca}
+                    </span>
+                  )}
+                </p>
+                {d.descricao && <p style={{ margin: "2px 0 0" }}><strong>Descrição do risco:</strong> {d.descricao}</p>}
+                {d.danos && <p style={{ margin: "2px 0 0" }}><strong>Danos à saúde:</strong> {d.danos}</p>}
+                {d.fontes.length > 0 && <p style={{ margin: "2px 0 0", wordBreak: "break-word" }}><strong>Fontes geradoras:</strong> {d.fontes.join("; ")}</p>}
+                <p style={{ margin: "2px 0 0" }}>
+                  <strong>Medidas de controle existentes:</strong>{" "}
+                  {d.medidasExistentes.length ? d.medidasExistentes.join("; ") : "Não evidenciadas medidas de controle específicas"}
+                </p>
+                {d.origens.length > 0 && <p style={{ margin: "2px 0 0" }}><strong>Origem das evidências:</strong> {d.origens.join(", ")}</p>}
+              </div>
+            ))}
+          </div>
+        );
+      })()}
+
       {/* Matriz de riscos */}
       {setor.riscos.length > 0 && (
         <table
@@ -770,6 +856,7 @@ function SetorBlock({
 
 export default function AepTemplate({
   relatorio: rel,
+  biblioteca,
   empresa,
   capitulos,
   valoresVars,
@@ -924,7 +1011,7 @@ export default function AepTemplate({
     <div style={{ marginBottom: 24 }}>
       <SectionTitulo titulo={numLabelAep(numPorSlug["aep_triagem"], tituloPorSlug["aep_triagem"] ?? "Triagem Ergonômica por Setor")} />
       {rel.setores.map((setor, idx) => (
-        <SetorBlock key={setor.id} setor={setor} idx={idx} />
+        <SetorBlock key={setor.id} setor={setor} idx={idx} gestao={rel.checklist_gestao} biblioteca={biblioteca} />
       ))}
     </div>
   );
```

### U: diff de `app/(aep)/aep/formulario-branco/page.tsx`

```diff
@@ -31,6 +31,8 @@ import {
   type SinalOrganizacional,
 } from "@/lib/aep/sinais-organizacional";
 import { CLASSIFICACOES_AEP, TIPOS_RISCO_AEP } from "@/lib/hooks/useAep";
+import { MOTIVOS_NI, SINAIS_INIBICAO } from "@/lib/aep/coleta";
+import { ROTEIRO_CAMPO, type RoteiroFator } from "@/lib/aep/roteiro-campo";
 import type { RespostaChecklistAep } from "@/lib/supabase/types";
 
 /**
@@ -60,12 +62,15 @@ function ChecklistTabela({
   itens,
   opcoes,
   sinais,
+  roteiro,
 }: {
   titulo: string;
   itens: ItemChecklistAep[];
   opcoes: RespostaChecklistAep[];
   /** Só a Organizacional passa: sinais por fator, impressos sob cada linha. */
   sinais?: Record<string, SinalOrganizacional[]>;
+  /** Só a Organizacional passa: roteiro de campo e motivo do N/I (2026-10-06). */
+  roteiro?: Record<string, RoteiroFator>;
 }) {
   const colunas = opcoes.length + 2;
   return (
@@ -83,6 +88,7 @@ function ChecklistTabela({
           dele viram uma unidade que não quebra de página no meio. */}
       {itens.map((item) => {
         const doFator = sinais?.[item.key];
+        const rot = roteiro?.[item.key];
         return (
           <tbody key={item.key} className="fb-avoid">
             <tr>
@@ -112,6 +118,24 @@ function ChecklistTabela({
                 </td>
               </tr>
             )}
+            {rot && (
+              <tr>
+                <td colSpan={colunas} className="fb-roteiro">
+                  <div className="fb-roteiro-col">
+                    <span className="fb-roteiro-titulo">Pergunte (indireto):</span> {rot.perguntas.join(" · ")}
+                  </div>
+                  <div className="fb-roteiro-col">
+                    <span className="fb-roteiro-titulo">Observe:</span> {rot.observar.join(" · ")}
+                  </div>
+                  <div className="fb-roteiro-col">
+                    <span className="fb-roteiro-titulo">Se N/I, motivo:</span>{" "}
+                    {MOTIVOS_NI.map((m) => (
+                      <FbCaixa key={m.key} label={m.key === "outro" ? "Outro: ________________" : m.label} />
+                    ))}
+                  </div>
+                </td>
+              </tr>
+            )}
           </tbody>
         );
       })}
@@ -152,6 +176,22 @@ function BlocoSetor({ indice, total }: { indice: number; total: number }) {
           <FbOpcoes titulo="Método de coleta" opcoes={METODOS_COLETA} />
           <FbCampo label="Trabalhadores consultados" />
         </div>
+
+        <div className="fb-sub">Condições da coleta</div>
+        <div className="fb-bloco fb-avoid">
+          <FbCampos colunas={3}>
+            <FbCampo label="Trabalhadores abordados" />
+            <FbCampo label="Participaram" />
+            <FbCampo label="Recusas / respostas evasivas (só o número)" />
+          </FbCampos>
+          <div className="fb-opcoes">
+            <span className="fb-campo-label" style={{ marginRight: 6 }}>Liderança presente durante a coleta?</span>
+            <FbCaixa label="Sim" />
+            <FbCaixa label="Não" />
+          </div>
+          <FbOpcoes titulo="Sinais de inibição" opcoes={SINAIS_INIBICAO.map((s) => s.label)} />
+          <FbCampo label="Observações sobre a coleta" />
+        </div>
       </FbSecao>
 
       <FbSecao
@@ -173,6 +213,7 @@ function BlocoSetor({ indice, total }: { indice: number; total: number }) {
           itens={ITENS_ORGANIZACIONAL}
           opcoes={OPCOES_COM_NI}
           sinais={SINAIS_ORGANIZACIONAL}
+          roteiro={ROTEIRO_CAMPO}
         />
         <FbLegenda itens={LEGENDA_ORGANIZACIONAL} />
       </FbSecao>
@@ -267,7 +308,12 @@ export default function AepFormularioBrancoPage() {
             <li>
               Nos checklists, marque <strong>uma</strong> resposta por fator: <strong>Sim</strong> = fator de risco identificado;{" "}
               <strong>Não</strong> = fator avaliado e ausente; <strong>N/A</strong> = não se aplica;{" "}
-              <strong>N/I</strong> (só na Organizacional) = não foi possível verificar em campo.
+              <strong>N/I</strong> (só na Organizacional) = não foi possível verificar em campo — marque também o{" "}
+              <strong>motivo</strong> (obrigatório no sistema).
+            </li>
+            <li>
+              Cada fator organizacional traz um <strong>roteiro de campo</strong>: perguntas indiretas e o que observar, para
+              sustentar a triagem mesmo quando os trabalhadores não se manifestam.
             </li>
             <li>
               Na <strong>Ergonomia Organizacional</strong>, todo fator marcado <strong>Sim</strong> pede os sinais observados —
```

### V: diff de `components/formulario-branco/primitivos.tsx`

```diff
@@ -341,6 +341,10 @@ const CSS = `
 .fb-sinais-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 14px; }
 .fb-sinais-grid .fb-opcao { white-space: normal; align-items: flex-start; margin-right: 0; }
 .fb-sinais-grid .fb-caixa { margin-top: 2px; }
+.fb-roteiro, .fb-tabela td.fb-roteiro { padding: 3px 8px 4px 22px; background: #f8fafc; font-size: 8.6px; color: #334155; line-height: 1.4; }
+.fb-roteiro-col { margin-bottom: 1px; }
+.fb-roteiro-col .fb-opcao { margin-right: 8px; }
+.fb-roteiro-titulo { font-weight: 700; color: #0f766e; }
 
 .fb-assinatura { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 22px; }
 .fb-assinatura-linha { flex: 1; max-width: 300px; }
```

### W: diff de `app/(aep)/layout.tsx`

```diff
@@ -2,7 +2,9 @@
 
 import { type ReactNode, useMemo } from "react";
 import {
+  BookMarked,
   BookOpen,
+  Building2,
   Brain,
   ClipboardCheck,
   ClipboardPen,
@@ -32,7 +34,7 @@ export default function AepLayout({ children }: { children: ReactNode }) {
 
   const match = pathname.match(/\/aep\/([^/]+)\//);
   const idRelatorio = match?.[1];
-  const isConfigPage = ["dashboard", "novo", "formulario-branco", "texto-padrao", "ajuda", "matriz-aiha"].includes(idRelatorio ?? "");
+  const isConfigPage = ["dashboard", "novo", "formulario-branco", "texto-padrao", "ajuda", "matriz-aiha", "biblioteca"].includes(idRelatorio ?? "");
 
   const sections = useMemo<NavSection[]>(() => {
     const base: NavSection[] = [
@@ -45,6 +47,7 @@ export default function AepLayout({ children }: { children: ReactNode }) {
           { href: "/aep/formulario-branco",     label: "Formulário em Branco", icon: ClipboardPen },
           { href: "/sinalizacao-psicossocial",  label: "Sinalização Psicoss.", icon: Brain },
           { href: "/aep/matriz-aiha",           label: "Matriz AIHA",          icon: Grid3x3 },
+          { href: "/aep/biblioteca",            label: "Biblioteca psicossocial", icon: BookMarked },
           { href: "/aep/ajuda",                 label: "Ajuda",                icon: HelpCircle },
         ],
       },
@@ -65,6 +68,7 @@ export default function AepLayout({ children }: { children: ReactNode }) {
         label: "Análise Atual",
         items: [
           { href: `/aep/${idRelatorio}/setores`, label: "Setores / Triagem", icon: ClipboardCheck },
+          { href: `/aep/${idRelatorio}/gestao`,  label: "Checklist de gestão", icon: Building2 },
           { href: `/aep/${idRelatorio}/dados`,   label: "Dados / Conclusão", icon: Info },
           { href: `/aep/${idRelatorio}/laudo`,   label: "Laudo / Imprimir",  icon: Printer, variant: "report" as const },
         ],
```

### X: diff de `components/inspecoes/editor/tabs/ErgonomiaTab.tsx`

```diff
@@ -19,6 +19,7 @@ import {
 } from "@/lib/hooks/useErgonomiaInspecao";
 import AepSetoresEditor from "@/components/aep/AepSetoresEditor";
 import AepDadosEditor from "@/components/aep/AepDadosEditor";
+import AepChecklistGestao from "@/components/aep/AepChecklistGestao";
 import AetSetoresEditor from "@/components/aet/AetSetoresEditor";
 import AetAnaliseEditor from "@/components/aet/AetAnaliseEditor";
 import AetPsicossocialEditor from "@/components/aet/AetPsicossocialEditor";
@@ -33,6 +34,7 @@ type Sub = { key: string; label: string; render: (id: string) => React.ReactNode
 const SUBABAS: Record<TipoErgo, Sub[]> = {
   aep: [
     { key: "setores", label: "Setores / Triagem", render: (id) => <AepSetoresEditor idRelatorio={id} /> },
+    { key: "gestao", label: "Checklist de gestão", render: (id) => <AepChecklistGestao idRelatorio={id} /> },
     { key: "dados", label: "Dados / Conclusão", render: (id) => <AepDadosEditor idRelatorio={id} embutido /> },
   ],
   aet: [
```

## Passo 4: edge function `gerar-parecer-aep-ia` (substituir, completa)

Deploy no **projeto do painel** (verify_jwt = true).

```ts
// Edge Function — gera Parecer Técnico Preliminar ou Recomendações
// para um setor da AEP, via Groq.
//
// DEPLOY:
//   supabase functions deploy gerar-parecer-aep-ia
//
// Cliente: supabase.functions.invoke('gerar-parecer-aep-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Em ordem de preferência. O Groq retira modelos do ar sem aviso (o
// llama-3.1-8b-instant sumiu em 2026-10 e a função passou a dar 502): se um
// modelo não existir mais, tenta o próximo.
const MODELOS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "moonshotai/kimi-k2-instruct",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CampoAep = "parecer_tecnico" | "recomendacoes";

interface ContextoAepIA {
  campo: CampoAep;
  empresa_nome?: string | null;
  setor_nome: string;
  cargos?: { cargo: string; descricao: string }[];
  jornada?: string | null;
  qtd_expostos?: number | null;
  checklist_fisica?: Record<string, string>;
  checklist_cognitiva?: Record<string, string>;
  checklist_organizacional?: Record<string, string>;
  observacoes?: Record<string, string>;
  textoAtual?: string | null;
  /** Fatores organizacionais na matriz AIHA (2026-10-05). */
  fatores_organizacionais?: {
    fator: string;
    nivel: string | null;
    probabilidade?: string | null;
    severidade?: string | null;
    sinais?: string[];
  }[];
  /** O setor tem indicação de AET completa (critério do sistema). */
  necessita_aet?: boolean;
  /** Fatores N/I com o motivo — "Limitações da avaliação" (2026-10-06). */
  limitacoes?: string[];
  /** Frase das condições da coleta (abordados, recusas, liderança, inibição). */
  condicoes_coleta?: string | null;
  /** N/I por receio de manifestação ou sinais de inibição na coleta. */
  receio_manifestacao?: boolean;
  /** Por fator "Sim": fontes, medidas existentes, origem/confiança e a lista
   *  de sugestões/ações da biblioteca psicossocial (2026-10-06). */
  evidencias_fatores?: {
    fator: string;
    fontes?: string[];
    medidas_existentes?: string[];
    origens?: string[];
    confianca?: string | null;
    sugestoes?: string[];
    acoes?: string[];
  }[];
}

const TITULO: Record<CampoAep, string> = {
  parecer_tecnico: "Parecer Técnico Preliminar",
  recomendacoes: "Recomendações Ergonômicas",
};

const SYSTEM_PROMPT = `Você é um(a) ergonomista / técnico(a) de segurança do trabalho brasileiro(a), especialista em Análise Ergonômica Preliminar (AEP), NR-01 GRO/PGR e NR-17.

Sua tarefa: redigir texto técnico para o laudo AEP de um setor específico, com base no checklist ergonômico, nos fatores organizacionais classificados na matriz de risco AIHA e nas observações fornecidas.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{ "texto": "Texto em português brasileiro, tom técnico, 3ª pessoa, sem bullets — apenas parágrafos corridos." }

PREMISSAS DA AEP — o texto deve refletir estas premissas (definidas pelo Responsável Técnico):
1. A AEP constitui uma triagem preliminar, voltada à identificação e priorização de fatores e setores que demandam maior atenção. Seu resultado não substitui a AET e deve ser compreendido a partir das condições observadas no ambiente de trabalho.
2. O DRPS/Questionário Psicossocial possui caráter complementar, contribuindo para ampliar a compreensão dos riscos psicossociais a partir de uma perspectiva mais personalizada, considerando como os próprios trabalhadores percebem e vivenciam suas condições de trabalho.
3. Os resultados da AEP dependem da qualidade das observações registradas e devem ser revistos sempre que houver mudanças nas condições de trabalho, conforme previsto na NR-01 e na revisão do inventário de riscos.

Como aplicar as premissas:
- Trate os achados como resultado de TRIAGEM: use "identificou-se", "foram observados indícios", "indica a necessidade de aprofundamento"; nunca apresente a AEP como diagnóstico conclusivo nem como substituta da AET.
- Fatores organizacionais: cite o nível na matriz AIHA (Trivial, Baixo, Moderado, Alto, Muito Alto) e os sinais observados que o sustentam; priorize os de nível mais alto.
- Quando o setor tiver indicação de AET ("Necessita AET: sim"), registre que a análise ergonômica do trabalho (AET, NR-17 item 17.3.2) é o aprofundamento indicado; sem indicação, não recomende AET.
- Quando houver fatores organizacionais relevantes (3 ou mais alertas organizacionais, ou algum fator Alto/Muito Alto), apresente o DRPS/Questionário Psicossocial como instrumento COMPLEMENTAR, que agrega a percepção dos próprios trabalhadores — não como substituto da AEP nem da AET.
- Limitações da avaliação: fatores marcados N/I (não identificáveis) NÃO são achados — não os trate como presentes nem como ausentes. Quando houver, registre a limitação em uma frase, citando o motivo informado.
- Quando houver receio dos trabalhadores em se manifestar (N/I por esse motivo ou sinais de inibição na coleta), registre que a participação foi limitada e indique o DRPS/Questionário Psicossocial, que permite resposta sem exposição, como complemento — mesmo com menos de 3 alertas organizacionais.
- Fontes geradoras e medidas de controle existentes: quando informadas, cite-as no parecer como base do apontamento (sem listar todas por extenso).
- Confiança da evidência (Baixa/Média/Alta, pela diversidade de origens): quando for Baixa, registre a limitação e indique instrumento anônimo/DRPS/Questionário como complemento.
- AÇÕES (só nas Recomendações): selecione e adapte ações da "Lista de ações da biblioteca" fornecida para os fatores do setor; NÃO crie ações fora dessa lista, exceto a realização da AET, a aplicação do DRPS/Questionário Psicossocial e a revisão da AEP. Sem lista fornecida, siga as regras gerais.
- Lembre que a conclusão depende das observações registradas e deve ser revista se as condições de trabalho mudarem (NR-01, inventário de riscos) — uma frase curta, sem repetir as premissas por extenso.

Comprimento esperado:
- parecer_tecnico: 2 a 3 parágrafos (140–240 palavras). Descreva os fatores identificados (itens Sim), as categorias ergonômicas afetadas, os níveis AIHA dos fatores organizacionais, a prioridade do setor e as condições observadas; encerre com o encaminhamento (AET e/ou DRPS/Questionário quando cabíveis) e a ressalva de triagem/revisão. NÃO liste ações corretivas nem prazos (imediatas/preventivas/estruturais) no parecer — isso fica só nas Recomendações.
- recomendacoes: 1 a 2 parágrafos com ações práticas priorizadas (90–180 palavras). Classifique como imediatas (<30 dias), preventivas (30–90 dias) ou estruturais (>90 dias) quando pertinente. Não repita o diagnóstico do parecer; vá direto às ações. Inclua, quando cabíveis, a realização da AET para o setor, a aplicação do DRPS/Questionário Psicossocial como complemento e a revisão da AEP quando houver mudança nas condições de trabalho.

Diretrizes:
- Citar setor, cargos e jornada quando relevante
- Basear-se apenas nos itens marcados como Sim, nos níveis AIHA e nas observações fornecidas — não inventar dados, medições ou números
- Referenciar NR-17, NR-01 e normas pertinentes
- Sem bullets, apenas parágrafos corridos`;

function buildPrompt(ctx: ContextoAepIA): string {
  const l: string[] = [];
  if (ctx.empresa_nome) l.push(`Empresa: ${ctx.empresa_nome}`);
  l.push(`Setor: ${ctx.setor_nome}`);
  if (ctx.cargos?.length) {
    const lista = ctx.cargos
      .map((c) => (c.descricao ? `${c.cargo} (${c.descricao})` : c.cargo))
      .filter(Boolean);
    if (lista.length) l.push(`Cargos: ${lista.join("; ")}`);
  }
  if (ctx.jornada) l.push(`Jornada: ${ctx.jornada}`);
  if (ctx.qtd_expostos) l.push(`Trabalhadores expostos: ${ctx.qtd_expostos}`);

  const addChecklist = (nome: string, cl?: Record<string, string>) => {
    if (!cl) return;
    const sims = Object.entries(cl)
      .filter(([, v]) => v === "sim")
      .map(([k]) => k.replace(/_/g, " "));
    if (sims.length) l.push(`${nome} — alertas: ${sims.join(", ")}`);
  };
  addChecklist("Ergonomia Física", ctx.checklist_fisica);
  addChecklist("Ergonomia Cognitiva", ctx.checklist_cognitiva);
  addChecklist("Ergonomia Organizacional", ctx.checklist_organizacional);

  // Fatores organizacionais na matriz AIHA, do mais grave para o menos.
  const PESO: Record<string, number> = { "Muito Alto": 5, Alto: 4, Moderado: 3, Baixo: 2, Trivial: 1 };
  const fatores = [...(ctx.fatores_organizacionais ?? [])].sort((a, b) => (PESO[b.nivel ?? ""] ?? 0) - (PESO[a.nivel ?? ""] ?? 0));
  if (fatores.length) {
    l.push("Fatores organizacionais na matriz AIHA:");
    for (const f of fatores) {
      const pxs = [f.probabilidade, f.severidade].filter(Boolean).join(" × ");
      const sinais = (f.sinais ?? []).filter(Boolean);
      l.push(
        `  - ${f.fator}: ${f.nivel ?? "sem nível"}${pxs ? ` (${pxs})` : ""}${sinais.length ? ` — sinais: ${sinais.join("; ")}` : " — nenhum sinal observado marcado"}`,
      );
    }
  }
  if (ctx.condicoes_coleta) l.push(`Condições da coleta: ${ctx.condicoes_coleta}`);
  if (ctx.limitacoes?.length) {
    l.push(`Limitações da avaliação (fatores N/I):\n${ctx.limitacoes.map((x) => `  - ${x}`).join("\n")}`);
  }
  if (ctx.receio_manifestacao) l.push("Receio dos trabalhadores em se manifestar: sim");
  for (const e of ctx.evidencias_fatores ?? []) {
    const partes: string[] = [];
    if (e.fontes?.length) partes.push(`fontes geradoras: ${e.fontes.join("; ")}`);
    if (e.medidas_existentes?.length) partes.push(`medidas existentes: ${e.medidas_existentes.join("; ")}`);
    if (e.origens?.length) partes.push(`origem das evidências: ${e.origens.join(", ")}`);
    if (e.confianca) partes.push(`confiança: ${e.confianca}`);
    if (partes.length) l.push(`Evidências — ${e.fator}: ${partes.join(" | ")}`);
  }
  const listaAcoes = (ctx.evidencias_fatores ?? []).filter((e) => (e.sugestoes?.length ?? 0) + (e.acoes?.length ?? 0) > 0);
  if (listaAcoes.length) {
    l.push("Lista de ações da biblioteca (use somente estas, além de AET/DRPS/revisão):");
    for (const e of listaAcoes) {
      l.push(`  - ${e.fator}: sugestões iniciais: ${(e.sugestoes ?? []).join("; ") || "—"} | ações: ${(e.acoes ?? []).join("; ") || "—"}`);
    }
  }
  if (typeof ctx.necessita_aet === "boolean") {
    l.push(`Necessita AET (critério do sistema): ${ctx.necessita_aet ? "sim" : "não"}`);
  }

  if (ctx.observacoes) {
    const obs = Object.entries(ctx.observacoes)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (obs.length) l.push(`Observações de campo:\n${obs.map((o) => `  - ${o}`).join("\n")}`);
  }

  l.push(`\nCampo a redigir: ${TITULO[ctx.campo]}`);
  if (ctx.textoAtual?.trim()) l.push(`\nTexto já redigido (refine se necessário):\n${ctx.textoAtual}`);
  l.push("\nGere o texto em JSON conforme o formato definido.");
  return l.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY não configurada." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as ContextoAepIA;
    if (!body?.setor_nome || !body?.campo) {
      return new Response(
        JSON.stringify({ error: "setor_nome e campo são obrigatórios" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let groqRes: Response | null = null;
    const falhas: string[] = [];
    for (const model of MODELOS) {
      groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(body) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.55,
          max_tokens: 2000,
        }),
      });
      if (groqRes.ok) break;
      // Modelo retirado, sem acesso ou JSON malformado: tenta o próximo.
      falhas.push(`${model}: ${groqRes.status} ${(await groqRes.text()).slice(0, 200)}`);
      if (groqRes.status === 401) break;
    }

    if (!groqRes || !groqRes.ok) {
      return new Response(
        JSON.stringify({ error: `Groq falhou em todos os modelos — ${falhas.join(" | ")}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const content: string | undefined = groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(content); } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const texto = (
      typeof parsed?.texto === "string" ? parsed.texto :
      typeof parsed?.text  === "string" ? parsed.text  :
      Object.values(parsed).find((v) => typeof v === "string") as string | undefined ?? ""
    ).trim();

    if (!texto) {
      return new Response(
        JSON.stringify({ error: "Campo 'texto' ausente", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: { texto } }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
```

## Passo 5: verificar

1. `npm test`, `npx tsc --noEmit -p .` e `npx next build` sem erros (testes novos: `coleta.test.ts`, `inventario.test.ts`).
2. **Motivo do N/I**:
   - marque N/I num fator organizacional e tente Salvar: aparece o erro pedindo o motivo;
   - escolha "Receio…" e salve: o laudo mostra "Limitações da avaliação" e o aviso de DRPS aparece mesmo com menos de 3 "Sim".
3. **Condições da coleta**:
   - preencha abordados 8, participantes 5 e marque um sinal de inibição;
   - aparece a sugestão no Assédio; o laudo traz a frase "Foram abordados 8…".
4. **Formulário em Branco**: cada fator organizacional tem o roteiro e o motivo do N/I; há o bloco Condições da coleta.
5. **Biblioteca** (`/aep/biblioteca`):
   - como Admin, edite um texto e salve;
   - como não Admin, os campos ficam só leitura.
6. **Checklist de gestão** (`/aep/[id]/gestao`): marque G01 = Não existe e salve.
7. **No setor**:
   - num fator Assédio "Sim", "Documental" aparece sozinho e as fontes mostram G01;
   - marque "Observação direta": confiança **Média**.
8. **Laudo e PDF**: bloco "Fatores psicossociais identificados — detalhamento".
9. **Inventário**: "Inventário (Excel)" e "CSV" baixam uma linha por setor × fator Sim.
10. **IA**: "Gerar IA" nas Recomendações usa ações da biblioteca.
11. **Sinalização**: "Confiança …" embaixo do nível do fator.
12. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
