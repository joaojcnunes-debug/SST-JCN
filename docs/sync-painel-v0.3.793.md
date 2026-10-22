# Sincronização com o Painel SST: v0.3.649 → v0.3.793

> Levantamento de 2026-10-22, **só leitura** (nada foi alterado no Painel nem no sst-jcn).
> Painel: `origin/cutover/2026-06-26` (8e77b9c8, v0.3.793). sst-jcn: `origin/main` (870743b, 0.3.136, de 08/10).
> Ponto da última sincronização: Painel `ef2a9a77` (v0.3.649). No intervalo: 235 commits.

## Antes de tudo: o que muda para portar

1. **O banco do Painel agora é auto-hospedado.** As migrations novas têm travas
   (`current_database() like 'painel_sst%'`, `current_user = 'chabra_admin'`, `public.schema_migrations`)
   e scripts `psql` para o servidor da Chabra. **Nenhuma roda no Supabase da JCN sem adaptar.**
2. **A numeração não bate.** O sst-jcn tem linha própria (`supabase/historico/` até `v278_empresa_grupos`).
   Comparar pelo **nome**; migration nova no JCN ganha número/timestamp novo citando a versão do Painel.
3. **Agendador.** O Painel trocou o pg_cron por um timer do Linux que chama `/api/gestao/google/sync` a
   cada minuto. No JCN seria Vercel Cron ou pg_cron + pg_net (o pg_cron do JCN ainda roda o
   `gestao_cron_diario`; não duplicar).
4. **Vercel limita o corpo da requisição (~4,5 MB):** anexos grandes precisam ir direto ao Storage.
5. **Muitos commits do intervalo vieram do próprio sst-jcn** (AEP/AIHA, Comercial, Liberação, grupos,
   certificados, Dimensionamento, auditoria v255/v256, Google Vids): esses já estão aqui.

## Visão rápida

| Frente | Já tem | Falta e se aplica | Específico da Chabra (não portar) |
|---|---|---|---|
| Gestão (tarefas) | correção do evento órfão no Google | 20 itens (Google Agenda, vários responsáveis, avisos por e-mail, horas, subtarefa em janela, Agenda do Meu Espaço, formulário com anexos, filtros etc.) | acesso por unidade com as 6 unidades da Chabra (v294, adaptável), acesso restrito "Financeiro" (v306), botão OS (T.I) |
| Psicossocial / AEP / AET | quase todas as réplicas da AEP (AIHA, sinais, biblioteca, Sinalização, Comercial), AEP/AET pela inspeção, item AEP no Painel SST | 17 itens (Consolidação de Grupo, laudos QPS/DRPS, correções do QPS, exportar Excel/PDF por empresa, AET) | v267 e v277 (dados da Chabra), lista do PGR com agente do SGG |
| Inspeções / Dashboard / Conformidade / Empresas | grupos (v282), documentos da empresa no relatório | 18 itens | SGG (integração da Chabra), v309 (dados do SGG), v264/v265 |
| Sistema / Equipamentos / outros | Dimensionamento, auditoria v255/v256, certificados | 15 itens | Laboratório (unidade da Chabra fixa), v304, OS (T.I), agendador systemd |

## Recomendação de ordem

**Lote 1 — correções e segurança (P, baixo risco):**
> ✅ Feito em 2026-10-22 (v0.3.137): Modal, CNPJ, aviso de permissão, Visão geral por módulos, v279 (série na devolução = painel v266) e v280 (SEC-EQP-01 = painel v269), aplicadas no banco. O limite do Groq (429) ficou para depois: no JCN a IA está nas edge functions.
- Janelas: Enter/Esc voltam a funcionar, Enter no CNPJ busca em vez de salvar (`components/ui/Modal.tsx`, v0.3.743).
- **SEC-EQP-01 (v269):** fecha 13 RPCs de Equipamentos/Transferência para anon e remove políticas abertas. *Segurança — prioridade.*
- Devolução grava o número de série (v266).
- Buscar CNPJ com User-Agent (corrige 403/502 da BrasilAPI).
- Aviso "Sem permissão… peça ao administrador"; Visão geral só lê tabelas dos módulos da conta.
- Limite do Groq (429) vira "tente de novo em N segundos" (adaptar aos caminhos do JCN).

**Lote 2 — Inspeções e Dashboard (G, alto valor):**
> ✅ Feito em 2026-10-22 (v0.3.138): v281 (= painel v283) e v282 (= painel v284) aplicadas; lista e Dashboard com a mesma régua, quem concluiu, técnico por seleção, pílulas múltiplas, Não associados, Status Assoc., documentos por Situação/Mês/Associado, Ficha em Branco com leques.
- v283 `concluida_por` + v284 técnicos de campo; lista e Dashboard com a mesma régua, "Quem concluiu".
- Pílulas com seleção múltipla, "Não associados", linha "Mostrando", coluna "Status Assoc.".
- Dashboard: Documentos por Situação, por Mês (ADM), por Associado.
- Ficha em Branco com seletor e seções em leque.

**Lote 3 — Conformidade e Empresas (P/M):**
> ✅ Feito em 2026-10-22 (v0.3.139): v283 (= painel v285) e v284 (= painel v289) aplicadas; ocultar tópico, fotos inteiras, trocar responsável técnico, NR-24, várias matrizes + SelectBusca/GrupoSelect, lista de Empresas progressiva, card clicável, Documentos & Laudos com todos os documentos, aviso de perda de acesso, fantasia abaixo do nome. Fora: SGG (aba, regiões, v309) e o botão de histórico da auditoria (v259).
- Ocultar tópico do PDF (v289), fotos inteiras no PDF, Trocar responsável técnico, checklist NR-24 (21 perguntas).
- Grupo com várias matrizes (v285), `SelectBusca`/`GrupoSelect` com digitação, lista de Empresas progressiva sem N+1,
  card clicável, Documentos & Laudos por tipo, aviso de perda de acesso ao trocar unidade, fantasia abaixo do Nome (só tela).

**Lote 4 — Psicossocial (P/M, depois G):**
> ✅ Feito em 2026-10-22 (v0.3.140), menos a Consolidação de Grupo e o Exportar Excel/PDF por empresa: v285 (= painel v263, só estrutura — os textos do Texto Padrão ficaram de fora) e v286 (= painel v291) aplicadas; edge functions `gerar-parecer-aep-ia` v8 e `gerar-observacao-psi-ia` v3 publicadas. A v258 (apagar o capítulo Resumo vazio do QPS) não foi aplicada.
- Rápidos (P): Formulário em Branco da AEP só com a Triagem e sem Matriz de Riscos; QPS Análise com agravos/medidas por setor;
  CRP do psicólogo vindo do cadastro; CSV do QPS ignora coluna extra; sigla QAP→QPS; AET com lista única do checklist;
  IA da AEP com o critério do sistema (edge function); conferir no banco o capítulo AIHA "1 sinal = 1 nível".
- Laudos (M), nesta ordem: QPS igual ao DRPS (v263) → 5W2H em folha deitada → DRPS justificado → botões de alinhar (v291).
- Correções do QPS (M): salvar aplicação que "mentia", Responsável como menu do time, card de detalhe.
- Exportar Excel/PDF por empresa (M) — pré-requisito da Consolidação.
- **Consolidação Psicossocial de Grupo (G+G):** v295 + 9 abas + motor + Excel (exceljs) + PDF + validação do cliente
  + PowerPoint (pptxgenjs) + lista para o PGR. Usa os grupos que o JCN já tem; trocar marca Chabra pela JCN
  e adaptar/deixar de fora a parte do agente do SGG.

**Lote 5 — Gestão (M/G, em ordem obrigatória):**
- Só front, sem migration (P): Agenda do Meu Espaço, Calendário do Meu Quadro, múltipla escolha em lista fechada,
  formulários das outras listas, recorrência recalcula, Mostrar/Agrupar, Painel como visão da lista, rodapé do menu,
  notificações no painel todo.
- Com banco, nesta ordem: v296 (vários responsáveis + avisos/e-mail) → v297 (automação incompleta, aviso de quadro)
  → v298 (horas) → v300 (subtarefa em janela; depende da unidade da v294) → v292/v293/v301/v302 (Google Agenda e fotos).
- Formulário com anexos: refazer o envio direto ao Storage (Vercel).
- Precisa de segredos: Google OAuth, `GESTAO_GOOGLE_ENC_KEY`, `GESTAO_CRON_TOKEN`, Resend.

**Decisões de negócio (perguntar antes):**
- v290: remover a trava por módulo do banco?
- v303: usuário oculto?
- Aposentar o Inventário de Máquinas (Relação de Máquinas lendo a aba Máquinas; drop só com levantamento próprio da JCN)?
- Auditoria v259 (aba Histórico em 13 documentos + XLSX): recria `auditoria_registrar` e faz backfill.
- Laboratório, acesso restrito, OS (T.I): só se a JCN tiver o equivalente.
- Botão "Enviar Riscos para SGG" herdado: esconder no JCN?

---

## Detalhe por frente

### Gestão (quadros de tarefas)

| Funcionalidade | Painel | JCN tem? | Observação | Esforço |
|---|---|---|---|---|
| Evento órfão no Google é apagado | v0.3.650 | Sim | — | — |
| Google: desconectar, card de status, enviar tarefas existentes, lembrete, agendador | v0.3.753, v292, v293 | Não | OAuth + agendador | M/G |
| Retorno do OAuth em endereço válido | v0.3.755 | Não | Problema do contêiner da Chabra; na Vercel provavelmente não ocorre | P |
| Acesso por unidade e setor (Usuários) | v0.3.748, v294 | Não | Unidades da Chabra embutidas; refazer com as da JCN | G |
| Sai "Equipes da Gestão" da janela de Usuários | v0.3.754 | Não | Junto da v294 | P |
| Vários responsáveis + avisos no banco e por e-mail | v0.3.756, v296 | Não | Resend + worker a cada minuto | M/G |
| Rotina diária, automação incompleta travada, aviso "Nova tarefa no quadro" | v0.3.758, v297 | Não | Parte "rotina de volta" é por causa do pg_cron perdido na Chabra | M |
| Hora de início/fim (também no Google) | v0.3.760, v298 | Não | — | P/M |
| Subtarefa abre a janela completa | v0.3.763, v300 | Não | ~450 linhas; reescreve `gestao_ve_tarefa` | G |
| Evento do Google vira tarefa | v0.3.765, v301 | Não | Depende de v298 + webhook | M/G |
| Foto da conta Google (Gestão e barra superior) | v0.3.767/781, v302 | Não | Reconectar para dar permissão de perfil | P |
| Janela da tarefa reorganizada | v0.3.768 | Não | Depende de v296/v298 | P |
| Agenda do Meu Espaço; Calendário do Meu Quadro com outros quadros | v0.3.771–774 | Não | Só front | P |
| Formulário público com anexos (até 90 MB) | v0.3.744 | Não | Na Vercel: URL assinada do Storage | M |
| Formulário: múltipla escolha em lista fechada | v0.3.775 | Não | Só front | P |
| Formulários das outras listas (gestor) | v0.3.788 | Não | Só front | P |
| Recorrência recalcula a próxima cópia | v0.3.777 | Não | Só front | P |
| Mostrar/Agrupar, `SelectVerde`, Painel vira visão da lista, rodapé do menu | v0.3.776–785 | Não | Trocar o verde pela cor da JCN | M (total) |
| Notificações no painel todo (contador na sigla, sino em Módulos) | v0.3.780/790 | Não | Só front | P |
| Usuário oculto | v303 | Não | Reescreve RLS de `usuarios` | M |
| Acesso restrito ("Financeiro") + tarefa que abre à parte | v306, v0.3.792 | Não | Da Chabra | G — não portar |
| Botão OS (T.I) | v0.3.749–786 | Não | Formulário da Chabra | não portar |

### Inspeções, Dashboard, Conformidade, Empresas

| Funcionalidade | Painel | JCN tem? | Observação | Esforço |
|---|---|---|---|---|
| Quem concluiu + técnico de campo; contagens sem limite de 1000 | v0.3.724, v283, v284 | Não | Migrations antes do deploy | G |
| Dashboard: "Quem concluiu"; concluídas contam para quem lançou | v0.3.724/726 | Não | Depende da v283 | (junto) |
| Pílulas múltiplas, "Não associados", "Mostrando" | v0.3.789/791 | Não | Usa `tem_associado` (JCN v239) | P/M |
| Coluna "Status Assoc." | v0.3.787 | Não | — | P |
| Relatório da inspeção com documentos da empresa | v0.3.685 | Sim | — | — |
| Ficha em Branco: seletor e seções em leque | v0.3.686/688 | Não | Só front | M |
| Dashboard: Documentos por Situação / Mês (ADM) / Associado | v0.3.740/732/679 | Não | Quase tudo em `lib/dashboard/documentos.ts` | M |
| Conformidade: ocultar tópico do PDF | v0.3.738, v289 | Não | — | P/M |
| Conformidade: fotos inteiras no PDF | v0.3.739 | Não | — | P |
| Conformidade: Trocar responsável técnico | v0.3.736 | Não | — | P |
| Conformidade: checklist NR-24 (21 perguntas) | v0.3.697 | Não | Só conteúdo | P |
| Grupos: várias matrizes, campo com digitação, `SelectBusca` | v0.3.719/728, v285 | Não | JCN ainda força 1 matriz | M |
| Lista de Empresas progressiva, sem N+1 | v0.3.735 | Não | Conflito provável com os grupos do JCN: aplicar diff | M |
| Card da empresa clicável | v0.3.730 | Não | — | P |
| Documentos & Laudos por tipo | v0.3.729 | Não | Possível colisão com `useDocumentosEmpresa` do JCN | M |
| Aviso ao trocar a unidade da empresa | v0.3.692 | Não | — | P |
| Razão social no Nome, fantasia abaixo (tela) | v0.3.793 | Não | A v309 é dado do SGG: não se aplica | P |
| SGG (catálogo, reenvio, regiões, aba SGG) | ~40 commits, v264/v265/v309 | Parcial (fase 1–3) | Infra da Chabra | não portar |

### Sistema, Equipamentos e demais

| Funcionalidade | Painel | JCN tem? | Observação | Esforço |
|---|---|---|---|---|
| Remove a trava por módulo do banco | v0.3.741, v290 | Não | Decisão de negócio | M |
| Usuário oculto | v303 | Não | Ver Gestão | M |
| Usuários: módulos por categoria + "Marcar todos" | v0.3.752 | Não | Ajustar categorias da JCN | P |
| Relação de Máquinas lê a aba Máquinas das inspeções | v0.3.676 | Não | Passo para aposentar o Inventário | M |
| Código deixa de ler `inventario_maquinas` | v0.3.782 | Não | Antes de qualquer drop | M |
| Recadastro + drop de `inventario_maquinas` | v304, v305 | Não | v304 é dado da Chabra | G |
| Devolução grava número de série | v0.3.675, v266 | Não | Comparar com a função viva da JCN | P |
| **SEC-EQP-01** (segurança de Equipamentos/Transferência) | v269 | Não | **Prioridade** | M |
| Controle de Laboratório | v273, v0.3.700 | Não | Unidade da Chabra fixa | G — se houver demanda |
| Auditoria: aba Histórico nos 13 documentos + XLSX | v0.3.653, v259 | Não | Recria `auditoria_registrar` + backfill | M/G |
| Auditoria v255/v256, Dimensionamento, Certificados | — | Sim | — | — |
| IA: 429 do Groq com espera | v0.3.663 | Não | Caminhos diferentes no JCN | M |
| IA de visão: modelo qwen3.8 | v0.3.662 | Não | Conferir se o qwen3.6 ainda responde | P |
| Aviso de sem permissão; Visão geral por módulos da conta | v0.3.664/665 | Não | — | P |
| Enter/Esc das janelas | v0.3.743 | Não | Bug geral | P |
| CNPJ com User-Agent | v0.3.672 | Não | — | P |
| Produtividade: v254 + redirect | v254 | Parcial (v254 na `fila`) | Conferir tabelas no banco | P |
| Remoção de `supabase/functions` | — | — | No JCN estão em uso: **não portar** | — |

### Dependências npm novas no Painel

- `exceljs` 4.4.0 e `pptxgenjs` 3.12.0 (Consolidação Psicossocial de Grupo). O sst-jcn não tem nenhuma das duas.

### Psicossocial, AEP e AET

| Funcionalidade | Painel | JCN tem? | Observação | Esforço |
|---|---|---|---|---|
| Consolidação Psicossocial de Grupo (fases 2–8, módulo próprio `consolidacao_psicossocial`) | v0.3.757–766, v295, v299 | Não | 8 tabelas (execuções só aceitam inclusão), motor de regras, 9 abas, Excel colorido, PDF ao cliente, validação por empresa, .pptx, lista para o PGR. v299 nem foi aplicada na produção do Painel | G + G |
| DRPS: botões de alinhar Agravos/Medidas | v0.3.742, v291 | Não | Depende do item abaixo | M |
| Laudo do DRPS: Agravos e Medidas justificados | v0.3.737 | Não | Usa `paragrafosDoTexto` do QPS | P |
| Laudos psicossociais: 5W2H em folha deitada | v0.3.720 | Não | Depende da v0.3.670 | P |
| Laudo QPS igual ao DRPS (data de conclusão, período da coleta, sumário) | v0.3.670, v263 | Não | Copia capítulos do DRPS no Texto Padrão | M |
| Sigla QAP → "QPS (Questionários Psicossociais)" | v0.3.667/668 | Não | — | P |
| Resumo do QAP sem etapa "Plano"; sai capítulo vazio | v0.3.652, v258 | Não | Conferir o capítulo no banco do JCN | P |
| CSV do QPS ignora coluna extra (respostas deslizavam) | v0.3.666 | Não | Mesmo commit põe `empresaId` nos PDFs de AEP/AET | P |
| Laudo da QAP com CRP do cadastro | v0.3.677 | Não | — | P |
| QPS Análise: agravos e medidas por setor voltam a salvar | v0.3.721 | Não | Bug provavelmente presente no JCN | P |
| QPS: salvar aplicação deixa de "mentir", Responsável como menu, card de detalhe, lápis da Unidade | 06/10 | Não | 4 arquivos novos | M |
| Riscos Psicossociais e AEP por empresa: Exportar Excel e PDF | v0.3.731–734 | Não | Pré-requisito da Consolidação | M |
| Formulário em Branco da AEP: só a Triagem; sem Matriz de Riscos | v0.3.745/746 | Não | O JCN tirou a Matriz do editor, mas não do formulário | P |
| IA do parecer da AEP: DRPS/Questionário pelo critério do sistema + lembrete de campo | v0.3.707 | Parcial | No JCN vai na edge function | P |
| AET: PDF lê a mesma lista de perguntas do checklist | v0.3.680 | Não | — | P |
| AET: Plano de Ação em paisagem, introdução editável, direção da escala na IA | v0.3.659/661 | Não | Prompt na edge function | P/M |
| AET: faxina de órfãos | v267 | Não | Dados da Chabra; medir no JCN antes | opcional |
| Réplicas da AEP vindas do JCN (AIHA, sinais, biblioteca, Sinalização, Comercial, Liberação, Matriz removida) | v0.3.682–717 | Sim | Exceção: texto do capítulo AIHA (v278) — conferir no banco | — |
| AEP/AET pela inspeção, item AEP no Painel SST, Riscos Psicossociais | v0.3.654–708 | Sim | — | — |
