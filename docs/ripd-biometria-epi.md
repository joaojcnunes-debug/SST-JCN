# RIPD — Relatório de Impacto à Proteção de Dados
## Tratamento de dado biométrico (impressão digital) — Assinatura de Ficha de EPI

> **Modelo para revisão do Encarregado (DPO)/Jurídico.** Preenchido com a realidade
> técnica do sistema (SST-JCN, módulo EPI, v0.3.88). Não é parecer jurídico. Campos
> `[preencher]` são decisões do controlador/DPO. Estruturado conforme o Guia de
> Elaboração de RIPD da ANPD.

| Campo | Valor |
|---|---|
| **Controlador** | `[preencher: razão social]` — `[CNPJ]` |
| **Encarregado (DPO)** | `[preencher: nome / e-mail / canal do titular]` |
| **Sistema** | Painel SST — módulo Gestão de EPI |
| **Versão do RIPD** | 1.0 — `[data]` |
| **Elaborado por** | `[preencher]` |
| **Status** | ☐ Rascunho ☐ Em revisão ☐ Aprovado |

---

## 1. Descrição do tratamento

**Natureza:** coleta, armazenamento e uso de **template de impressão digital** de
colaboradores das empresas clientes, para **verificar a identidade** de quem assina a
**Ficha de Entrega de EPI** (verificação biométrica 1:1).

**Dados pessoais tratados:**

| Dado | Classificação | Observação |
|---|---|---|
| Template biométrico (minúcias ISO/ANSI da digital) | **Sensível** (art. 5º, II) | **Não** é a imagem da digital; é um gabarito de minúcias |
| Hash SHA-256 da amostra de assinatura (`finger_hash`) | Derivado (irreversível) | A amostra da assinatura é **descartada**; fica só o hash |
| Score da verificação (`match_score`), qualidade, modelo do leitor | Metadado | Evidência técnica |
| Data/hora, **IP** (capturado no servidor), user-agent, registro de consentimento | Pessoal | Trilha de evidência (não-repúdio) |
| Nome, CPF, matrícula, cargo, setor do colaborador | Pessoal | Já tratados no cadastro do módulo |

**Titulares:** colaboradores das empresas clientes que recebem EPI.
**Volume/frequência:** 1 template por colaborador (cadastro opcional); verificações a
cada assinatura de ficha.

**Agentes de tratamento:**
- **Controlador:** `[preencher]`.
- **Operadores:** Supabase (banco de dados/hospedagem), Vercel (hospedagem da aplicação
  web). O **leitor e o agente de biometria são locais** (não enviam a digital à internet).
- **Fornecedor de tecnologia:** HID/DigitalPersona (leitor U.are.U 4500 + runtime local) —
  não processa dados em nome do controlador; execução é local na estação.

---

## 2. Finalidade e base legal

**Finalidades:**
1. **Confirmar a identidade** do recebedor, garantindo que a ficha de EPI é assinada pelo
   próprio colaborador (autenticidade e não-repúdio) e **prevenindo fraude** (assinatura por
   terceiro).
2. Instrumentalizar o **registro de entrega de EPI por sistema biométrico**, previsto na
   **NR-06, item 6.5 "d"** (redação da Portaria MTP nº 2.175/2022).

**Base legal (art. 11, LGPD — dado sensível):**
- **Consentimento específico e destacado** (art. 11, I) — coletado no **cadastro**
  (`biometria_consentimento_em`) e reafirmado na **assinatura**. Há **alternativa não
  biométrica** (assinatura desenhada) quando o uso não é obrigatório.
- `[Avaliar com o jurídico:` cabimento também do art. 11, II, "a" (cumprimento de obrigação
  legal/regulatória — NR-06) como base concorrente/subsidiária.`]`

---

## 3. Necessidade e proporcionalidade

- **Necessidade:** a verificação 1:1 é o meio técnico para confrontar a identidade; sem o
  template cadastrado não há como confirmar que é o próprio colaborador.
- **Proporcionalidade / minimização:**
  - Armazena-se **template de minúcias**, **não a imagem** da digital.
  - A amostra colhida **na assinatura é descartada** — persiste apenas o **hash** (irreversível).
  - **Alternativa não biométrica** disponível (desenho).
  - **Consentimento** obrigatório (bloqueio técnico sem ele).
  - **Expurgo automático** do template ao inativar o colaborador + remoção manual.

---

## 4. Ciclo de vida dos dados

| Fase | Como ocorre |
|---|---|
| **Coleta** | No cadastro do colaborador, via leitor U.are.U 4500 + agente local `EpiBiometricAgent`, mediante consentimento. |
| **Uso** | Comparação **1:1 local** (motor DigitalPersona, `Comparison.Compare`) no momento da assinatura; limiar FAR ~1:100.000. |
| **Armazenamento** | Template em `epi_colaboradores.biometria_template` (Postgres/Supabase, **criptografia de disco em repouso**), acesso restrito por **RLS** (interno por e-mail OU empresa vinculada do titular). |
| **Compartilhamento** | **Não há** compartilhamento externo. Na verificação, o template trafega **Banco → navegador → agente em `localhost`** (não sai da estação/rede). |
| **Eliminação** | **Expurgo automático** ao inativar o colaborador (trigger `epi_expurgar_biometria_inativo`, migration v129) e **remoção manual** (revogação de consentimento). Mantém-se o carimbo `biometria_expurgada_em` para prestação de contas. |

---

## 5. Matriz de riscos aos titulares e medidas de mitigação

| # | Risco | Probab. | Impacto | Medidas implementadas |
|---|---|---|---|---|
| 1 | Vazamento do template | Baixa | Alto | RLS dual; criptografia em repouso (Supabase); template = **minúcias, não imagem**; **não trafega** para fora da estação/plataforma |
| 2 | Uso além da finalidade | Baixa | Médio | Finalidade documentada; escopo restrito ao módulo EPI; RLS |
| 3 | Acesso indevido | Baixa | Médio | RLS (só equipe interna ativa **ou** empresa do titular); autenticação; localhost (agente não exposto à rede) |
| 4 | Retenção excessiva | Baixa | Médio | **Expurgo automático** ao inativar + remoção manual; carimbo de expurgo |
| 5 | Falso positivo (terceiro assina) | Baixa | Médio | Limiar **FAR 1:100.000**; verificação 1:1 obrigatória quando há cadastro |
| 6 | Falso negativo (rejeita o legítimo) | Média | Baixo | **Alternativa** desenho; possibilidade de recadastro |
| 7 | Coleta sem consentimento | Baixa | Alto | Consentimento **obrigatório** (bloqueio técnico) e registrado |

**Risco residual:** `[preencher: Baixo — sujeito à validação do DPO]`.

---

## 6. Medidas de segurança da informação

- Controle de acesso por **RLS** (dual: interno por e-mail / cliente por empresa).
- **HTTPS** ponta a ponta; agente de biometria em **loopback** (`127.0.0.1`, sem exposição de rede) com CORS restrito à origem da aplicação.
- **Criptografia em repouso** (disco, Supabase).
- **Minimização**: amostra de assinatura descartada; guarda-se só o hash. Template = minúcias.
- **Trilha append-only** das assinaturas (evidência imutável) + **exportação para fiscalização** (CSV).
- `[Hardening opcional a avaliar: criptografia em nível de coluna (pgcrypto/Vault) do template.]`

---

## 7. Direitos dos titulares

| Direito | Como é atendido |
|---|---|
| Confirmação e acesso | Consulta ao cadastro/registro pelo controlador; canal do DPO |
| Correção | Recadastro da biometria |
| Eliminação | **Remoção manual** + **expurgo automático** ao inativar |
| Revogação do consentimento | Botão "Remover biometria" → expurgo |
| Informação sobre o tratamento | Política de Privacidade + termo de consentimento `[publicar]` |
| Oposição / alternativa | Assinatura **desenhada** (não biométrica) |

**Canal do titular / Encarregado:** `[preencher]`.

---

## 8. Conclusão e plano de ação

**Parecer técnico:** o tratamento é **necessário e proporcional** à finalidade
(prevenção de fraude na entrega de EPI, conforme NR-06), com **minimização robusta** e
**mecanismos de eliminação** implementados. Risco residual avaliado como baixo.

**Pendências para conformidade plena (DPO/negócio):**
1. `[ ]` Definir e publicar o **prazo formal de retenção** (o sistema já expurga no
   desligamento; formalizar em política — ver documento de Retenção).
2. `[ ]` Publicar **termo de consentimento** específico e a **Política de Privacidade**
   mencionando o tratamento biométrico.
3. `[ ]` Registrar formalmente a **base legal** escolhida (consentimento e/ou obrigação legal).
4. `[ ]` **Aprovar** este RIPD e revisá-lo em caso de mudança de fornecedor/finalidade.

**Aprovação do Encarregado (DPO):** ______________________  Data: __/__/____
