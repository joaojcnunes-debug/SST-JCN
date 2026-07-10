# Política de Retenção e Eliminação — Dados Biométricos (Módulo EPI)

> **Modelo para aprovação do Encarregado (DPO)/Jurídico.** Reflete o comportamento
> técnico já implementado (SST-JCN, v0.3.88). Campos `[preencher]` são decisões do
> controlador. Complementa o [RIPD](ripd-biometria-epi.md).

| Campo | Valor |
|---|---|
| **Controlador** | `[preencher: razão social / CNPJ]` |
| **Encarregado (DPO)** | `[preencher]` |
| **Escopo** | Template biométrico e evidências de assinatura da Ficha de EPI |
| **Versão** | 1.0 — `[data]` · **Revisão:** anual ou por mudança regulatória/de fornecedor |

---

## 1. Objetivo

Definir por quanto tempo e sob quais condições os dados biométricos e as evidências de
assinatura do módulo de EPI são mantidos, e como são eliminados, em atendimento aos
princípios de **necessidade**, **minimização** e **finalidade** da LGPD.

## 2. Dados abrangidos e prazos de retenção

| Dado | Onde | Retenção | Eliminação |
|---|---|---|---|
| **Template biométrico** (`biometria_template`) | `epi_colaboradores` | **Enquanto durar o vínculo** do colaborador com a empresa cliente **e** o consentimento | **Automática** ao inativar o colaborador (imediata) e por **revogação** manual |
| Carimbos de biometria (`biometria_cadastrada_em`, `_consentimento_em`, `_expurgada_em`) | `epi_colaboradores` | Registro de accountability | Mantidos após o expurgo do template (não contêm biometria) |
| **Hash** da amostra de assinatura (`finger_hash`), `match_score`, `qualidade`, `device_info`, IP, data/hora | `epi_entrega_assinaturas` (append-only) | **Vinculado à ficha de EPI** — `[preencher: ex. 5 anos após a entrega / conforme guarda dos documentos de SST]` | Não é biometria recuperável (hash irreversível); segue a guarda documental da ficha |
| Imagem/amostra bruta da digital | — | **Não é armazenada** | Descartada no ato (captura → hash → descarte) |

> **Princípio:** o **dado biométrico recuperável** (template) tem retenção **mínima** — só
> enquanto necessário à verificação; as **evidências** da assinatura (sem biometria
> recuperável) seguem a guarda legal da própria ficha de EPI.

## 3. Eventos que disparam a eliminação do template

1. **Inativação/desligamento** do colaborador → expurgo **automático** (trigger de banco;
   grava `biometria_expurgada_em`).
2. **Revogação do consentimento** pelo titular → botão "Remover biometria" no cadastro.
3. **Solicitação de eliminação** pelo titular (direito LGPD) → atendida pelo controlador.
4. **Fim da finalidade** (ex.: descontinuação do uso biométrico) → expurgo em massa `[procedimento a definir]`.

## 4. Método de eliminação

- Substituição do template por `NULL` no banco (irreversível), preservando apenas o
  carimbo de expurgo para prestação de contas.
- A eliminação **não** apaga a **ficha de EPI** nem a **trilha de assinatura** (documentos e
  evidências, sem biometria recuperável), que seguem a guarda legal aplicável.

## 5. Responsabilidades

| Papel | Responsabilidade |
|---|---|
| Encarregado (DPO) | Aprovar/rever esta política; atender titulares; definir os prazos `[preencher]` |
| TI/Sistema | Manter os mecanismos de expurgo (automático e manual) e as medidas de segurança |
| Operação (SST) | Inativar colaboradores desligados (dispara o expurgo); coletar consentimento |

## 6. Verificação / auditoria

- O expurgo é auditável pelo carimbo `biometria_expurgada_em`.
- A trilha de assinaturas é **append-only** e **exportável** (CSV) para fiscalização
  (NT 162/2017 DSST/SIT/MTb).
- Revisar esta política junto ao **RIPD** anualmente ou em mudança de fornecedor/finalidade.

## 7. Pendências para formalização (DPO)

1. `[ ]` Definir o **prazo numérico** de guarda das evidências da ficha de EPI (item 2).
2. `[ ]` Confirmar a regra de retenção do template (padrão: "até o desligamento").
3. `[ ]` Aprovar e datar esta política; vincular ao termo de consentimento e à Política de Privacidade.

**Aprovação do Encarregado (DPO):** ______________________  Data: __/__/____
