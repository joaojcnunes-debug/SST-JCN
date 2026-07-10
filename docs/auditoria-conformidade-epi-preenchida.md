# Auditoria de Conformidade — Assinatura Biométrica (EPI) — PREENCHIDA

**Sistema avaliado:** SST-JCN (módulo Gestão de EPI) — base para o Painel SST
**Responsável técnico:** Chabra TI
**Data:** 2026-07-09
**Escopo:** assinatura biométrica (digital) da **Ficha de Entrega de EPI** (v0.3.85)

> Preenchimento **técnico** com base na implementação real. Itens jurídicos/negócio
> (marcados **[JUR]**) dependem do jurídico/DPO — não substituem parecer formal.

Legenda: `[x]` conforme · `[ ]` pendente · `N/A` não se aplica.

> **Atualização (Fase 4D, v0.3.88):** foi implementada a **verificação biométrica 1:1**
> (confronto de identidade) — o que fortalece a Camada 2 (impede assinatura por terceiro).
> **Consequência:** agora **armazenamos o template** do colaborador (minúcias, não a imagem),
> sob RLS. Para a Camada 4 (retenção), há **expurgo automático do template ao inativar o
> colaborador** (trigger v129, com carimbo `biometria_expurgada_em`) + botão de **remoção
> manual** (revogação de consentimento). Ainda pendente de política/DPO: prazo formal de
> retenção e o **RIPD** (NCs #1 e #2 continuam abertas na parte documental).

---

## Camada 1 — Classificação jurídica por tipo de documento

- [x] Nível de assinatura atual da Ficha de EPI: **avançada (biometria)**.
- [x] Nível adequado ao risco: **sim** — é ciência/recebimento pelo colaborador; a NR-06 (6.5 "d") prevê **sistema biométrico** para registro de entrega de EPI.
- [ ] **[JUR]** Exigência contratual do cliente por ICP-Brasil: **verificar por cliente**.
- [x] Alinhamento à NR-06 (6.5 "d"): **sim** (biometria prevista em norma).

### Tabela de classificação

| Documento | Nível atual | Nível recomendado | Base normativa | Observação |
|---|---|---|---|---|
| Ficha de entrega de EPI | **Avançada (biometria)** | Avançada (biometria) — ICP-Brasil opcional | NR-06 6.5"d"; Lei 14.063/2020; MP 2.200-2/2001 | **Implementado** neste módulo |
| PGR / PCMSO / LTCAT / AET / ASO (profissional) | — | **Qualificada (ICP-Brasil)** | MP 2.200-2; assinatura do RT | **Fora do escopo** do módulo EPI |
| ASO / certificado de treinamento (ciência do colaborador) | — | Avançada (biometria) aceitável | NR-06/NR-01; Lei 14.063 | Reaproveitar o mesmo fluxo biométrico |

---

## Camada 2 — Vínculo técnico entre biometria e documento

- [x] **Hash SHA-256 do documento** no momento exato da assinatura — sim. O front baixa o PDF exato da ficha e calcula `SHA-256` (WebCrypto); gravado em `epi_entrega_assinaturas.pdf_sha256`.
- [x] **Carimbo de tempo** vinculado à captura — `assinado_em timestamptz`. *(Melhoria opcional: TSA RFC 3161 para carimbo qualificado.)*
- N/A **Liveness (facial)** — a biometria é **digital (óptica)**, não facial. O SDK expõe códigos de qualidade (inclui `DP_QUALITY_FAKE_FINGER`), mas não há liveness robusto.
- [x] **Template irreversível** — na prática guardamos **apenas o hash SHA-256 da amostra** (`finger_hash`); **imagem e template são descartados** (mais forte que o exigido).
- [ ] **Alteração posterior detectável** — **parcial**: o `pdf_sha256` permite **detectar** adulteração (recomputando o hash), mas o PDF **não é selado** criptograficamente sem o **PAdES A1 (Nível 2, não aplicado)**. → ver Não Conformidade #3.

**Evidência:** `lib/epi/digitalPersona.ts` (hash da amostra), `EpiAssinaturaModal.tsx` (SHA-256 do PDF), migration v124/v127.

---

## Camada 3 — Trilha de auditoria (append-only)

- [x] **ID do usuário/colaborador** — `criado_por` (e-mail do operador) + `id_colaborador`.
- [x] **Documento + hash** — `id_entrega` + `pdf_sha256`.
- [x] **Data/hora exatos** — `assinado_em`.
- [x] **Dispositivo/leitor** — `device_info` (UID do leitor). Modelo: **HID DigitalPersona U.are.U 4500**.
- [x] **IP** — capturado **no servidor** (`current_setting('request.headers')`, não forjável). Geolocalização: N/A (não coletada).
- [x] **Resultado da verificação** — `qualidade` (ex.: `DP_QUALITY_GOOD`). *Score numérico de match: N/A (captura, não 1:N matching).*
- [x] **Append-only** — `epi_entrega_assinaturas` tem **apenas** políticas `SELECT` + `INSERT`.
- [ ] **Exportável para fiscalização (NT 162/2017)** — os dados são consultáveis por SQL, mas **falta um relatório/exportação pronta** na UI. → Não Conformidade #6.

**Evidência:** migration v124/v127; RPC `epi_assinar_entrega`.

---

## Camada 4 — LGPD (dado biométrico é sensível)

- [x] **Base legal (consentimento específico e destacado, art. 11, I)** — termo específico exibido no modal antes da captura; registrado em `consentimento_em`; **obrigatório** para o método digital (a RPC recusa sem consentimento).
- [x] **Consentimento específico (não genérico)** — sim; é um termo próprio de biometria, não dentro de um termo de uso geral.
- [x] **Alternativa não biométrica** — **assinatura desenhada** (canvas) sempre disponível como fallback.
- [x] **Minimização** — **excelente**: coletamos só o **hash** da amostra; **nada** de imagem/template é persistido.
- [ ] **Prazo de retenção + eliminação** — **não definido** formalmente. *(Exposição é mínima por só guardarmos hash irreversível, mas a política precisa existir — desligamento/revogação.)* → Não Conformidade #1.
- [x] **Segurança (trânsito/acesso)** — HTTPS ponta a ponta; tabela sob **RLS restrita** (dual: interno + empresa do titular). Em repouso: **não há biometria recuperável** (só hash), reduzindo drasticamente o risco.
- [ ] **[JUR]** **RIPD** — não elaborado. → Não Conformidade #2 (DPO).
- [ ] **Direitos do titular** — acesso/eliminação hoje via suporte; **falta fluxo formal** (revogação de consentimento, expurgo). → Não Conformidade #7.

**Evidência:** `EpiAssinaturaModal.tsx` (termo + consentimento), migration v127 (`consentimento_em`, `metodo`), RLS v126.

---

## Camada 5 — Hardware / dispositivos homologados

- [ ] **Lista de leitores homologados** — **a documentar/versionar**. Atual em uso: **HID DigitalPersona U.are.U 4500**. → Não Conformidade #4.
- [ ] **Specs (FAR/FRR)** — preencher com os dados do fabricante (HID/DigitalPersona).
- N/A **ANATEL** — dispositivo **USB, sem RF** (Bluetooth/Wi-Fi) → não se aplica.
- [x] **Driver/SDK testado e travado** — versões conhecidas: **DPUruNet (RTE 3.5)** / agente **DpHost `:52181`** / web `@digitalpersona/devices@0.2.6` + `@digitalpersona/websdk`. *(Recomenda-se travar/pinar essas versões.)*

### Tabela de dispositivos homologados

| Modelo | Fabricante | Sensor | FAR | FRR | ANATEL | Driver/SDK testado | Data |
|---|---|---|---|---|---|---|---|
| U.are.U 4500 | HID / DigitalPersona | Óptico | *(preencher)* | *(preencher)* | N/A (USB) | RTE 3.5 / DpHost 52181 / devices 0.2.6 | 2026-07-09 |

---

## Camada 6 — Governança contratual e documental

- [ ] **[JUR]** Termo/contrato reconhecendo biometria como meio válido de assinatura. → Não Conformidade #5.
- [ ] **[JUR]** Política de privacidade citando **especificamente** o tratamento biométrico. → Não Conformidade #5.
- [x] **Documentação interna dos níveis** — `docs/ficha-epi-implementacao.md` + esta auditoria; o próprio **carimbo do PDF** cita a base legal (Lei 14.063/2020 + MP 2.200-2/2001).

---

## Não conformidades identificadas

| # | Item | Camada | Risco | Ação corretiva | Responsável | Prazo |
|---|---|---|---|---|---|---|
| 1 | Política de retenção + rotina de eliminação do `finger_hash` | 4 | Médio | Definir prazo (ex.: enquanto durar o vínculo + N anos) e job de expurgo/anonimização | DPO + TI | — |
| 2 | RIPD (Relatório de Impacto) | 4 | Médio | Elaborar RIPD do tratamento biométrico | DPO | — |
| 3 | PDF não selado (sem ICP-Brasil A1) → só detecção por hash | 2 | Baixo/Médio | Cadastrar certificado A1 e ativar selagem **PAdES A1** na ficha (infra já pronta) | TI + Gestão | — |
| 4 | Lista de dispositivos homologados + FAR/FRR | 5 | Baixo | Documentar/versionar leitores e specs do fabricante | TI | — |
| 5 | **[JUR]** Termo contratual + política de privacidade citando biometria | 6 | Médio | Atualizar contratos/política | Jurídico | — |
| 6 | Exportação da trilha para fiscalização (NT 162/2017) | 3 | Baixo | Criar relatório/export (CSV/PDF) das assinaturas por período/empresa | TI | — |
| 7 | Fluxo formal de direitos do titular (revogação/expurgo) | 4 | Baixo | Implementar revogação de consentimento + eliminação sob demanda | TI + DPO | — |

**Resumo:** o **núcleo técnico** da assinatura biométrica está **conforme** (hash do documento, trilha
append-only, IP no servidor, consentimento específico, alternativa não biométrica e **minimização
exemplar** — só hash, sem imagem/template). Os pontos abertos são majoritariamente **de política/documentação
(retenção, RIPD, contrato/privacidade)** e uma **melhoria técnica opcional** (selo ICP-Brasil para PDF imutável).

---

## Referências normativas
- MP nº 2.200-2/2001 (ICP-Brasil); Lei nº 14.063/2020 (assinaturas eletrônicas simples/avançada/qualificada).
- NR-06, 6.5 "d" (Portaria MTP 2.175/2022) — sistema biométrico para entrega de EPI.
- NT 162/2017 DSST/SIT/MTb — biometria condicionada à extração de relatórios para fiscalização.
- LGPD (Lei 13.709/2018), art. 5º II e art. 11 — dado biométrico sensível.
- STJ, REsp 1.495.920/DF — presunção de autenticidade da assinatura eletrônica avançada auditável.

> Ferramenta de organização interna; não substitui parecer jurídico formal.
