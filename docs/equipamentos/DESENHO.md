---
title: Módulo Equipamentos JCN Consultoria — desenho do banco (para aprovação)
branch: feat/equipamentos-chabra
worktree: C:\Users\Usuario\projects\painel-sst-equipamentos
base: cutover/2026-06-26 @ 7f2d2aa (v0.3.503)
status: DESENHO APROVADO em 2026-08-10 (5 decisões fechadas) — nada aplicado ainda
data: 2026-08-07 · decisões fechadas em 2026-08-10
---

# Desenho do módulo Equipamentos

Este documento é o que você aprova. Ele descreve as tabelas, as regras e as
decisões que tomei ao traduzir o briefing em schema. **Nenhuma tela foi escrita**
— front-end só depois que este desenho estiver de acordo.

## Estado: nada saiu do lugar

- Escrito na pasta isolada `C:\Users\Usuario\projects\painel-sst-equipamentos`,
  branch `feat/equipamentos-chabra`. A outra sessão pode dar `git add -A` na pasta
  de sempre à vontade — não pega nada disto.
- **Nenhuma migration foi aplicada** em lugar nenhum. Não abri túnel, não conectei
  no banco da `.107`. O SQL abaixo nunca rodou — foi escrito a partir da leitura
  das migrations existentes, não de execução.
- **Nenhum commit, nenhum push, nenhum deploy.**

## Correção de numeração — duas vezes

O briefing diz três vezes que as migrations novas começam em **v161**. Esse número
já está usado (`v161_epi_sugestoes.sql`, v0.3.500).

E **v162 também já está reservado**: a urgência que você está tocando na outra
sessão criou `scripts/sql/v162_apreciacao_plano_acao_nr12.sql`. Renumerei tudo
daqui para **v163–v168**. Se aquele arquivo mudar de número ou for descartado,
o meu continua válido — sobra apenas um buraco na sequência, que é inofensivo
(o `migrate.ps1` ordena por nome, não exige continuidade).

---

## 1. O mapa

```
                        ┌─────────────────────────┐
                        │  equipamentos_catalogo  │  produto (GLOBAL)
                        │  Mouse Logitech M170    │
                        └───────────┬─────────────┘
                                    │
              ┌─────────────────────┴──────────────────────┐
              │                                            │
  ┌───────────▼──────────────┐              ┌──────────────▼───────────┐
  │ equipamentos_movimentacoes│              │      equipamentos        │
  │  APPEND-ONLY, por base    │              │  ativo individualizado   │
  │  entrada / saida          │              │  #A31, série, patrimônio │
  │  → v_equipamentos_saldo   │              │  aquisição, garantia     │
  └───────────────────────────┘              └──────────┬───────────────┘
        Guapimirim: 12                                  │
        Teresópolis: 3                       ┌──────────▼───────────────┐
                                             │  colaboradores_chabra    │
                                             │  quem está com o quê     │
                                             └──────────────────────────┘

  entrada de estoque  → saldo ↑
  entrega             → saldo ↓ + ativo criado + termo assinado
  devolução           → ativo liberado (individualizado) ou saldo ↑ (genérico)
  mudança de status   → só por RPC, motivo obrigatório, vai para o histórico
```

## 2. Os arquivos

| Arquivo | Fase do briefing | O que entrega |
|---|---|---|
| `supabase/migrations/v163_equipamentos_modulo.sql` | 3 | Tabela `equipamentos`, cópia das 86 linhas, permissão do módulo, RLS por base |
| `supabase/migrations/v164_equipamentos_catalogo_estoque.sql` | 4 | Catálogo, razão append-only, saldo derivado, RPCs de entrada e ajuste |
| `supabase/migrations/v165_equipamentos_importacao_nfe.sql` | 5 | Importação de NF-e com chave única |
| `supabase/migrations/v166_equipamentos_colaboradores_entregas.sql` | 6 | Colaboradores, entrega, assinatura, "o que está com o Fulano" |
| `supabase/migrations/v167_equipamentos_devolucao_status.sql` | 7 | Devolução com estado de retorno + histórico de status com motivo |
| `scripts/sql/v16*_rollback.sql` | — | Um desfazer por migration, com as ordens e os avisos |
| `scripts/sql/v168_equipamentos_cutover_inventario.sql` | 3 (2ª etapa) | Remoção das linhas do inventário NR-12 — **manual, nunca automático** |

---

## 3. As decisões que preciso que você confirme

Cada uma resolve uma ambiguidade do briefing. Estão em ordem de impacto.

> **Retorno do operador em 2026-08-07:**
> **3.1 ajustada** — nada de ver duplicado na tela (veja abaixo).
> **3.5 confirmada** — devolução não conta duas vezes.
> **3.9 confirmada** — módulo só para quem já tem `transferencias`.
>
> **Retorno do operador em 2026-08-10 — as 5 que faltavam, todas fechadas:**
> **3.6 APROVADA** — a trava de status por trigger fica LIGADA.
> **Patrimônio ÚNICO** entre os preenchidos, com aviso na tela (§5.1).
> **Assinatura na devolução SIM**, colhida do gerente que recebe (§5.2).
> **Lista de 10 motivos aprovada** (§5.3).
> **Fotos originais preservadas** — encolher só para a tela (§5.4).
>
> **Não há mais decisão pendente neste documento.**

### 3.1 O cutover é em dois tempos — copiar agora, apagar depois

O briefing trata a migração de dados como um passo só ("as linhas migram") e o
chama de maior risco do projeto. **Quebrei em dois:** a v163 apenas **copia** as
86 linhas e guarda a origem (`id_inventario_origem`); a remoção do inventário NR-12
vive num script separado (`v168`) que **não é migration** e por isso nunca sobe
sozinho num deploy — mora em `scripts/sql/`, que o `migrate.ps1` não varre.

**A tela separa no primeiro dia; só o banco fica com a cópia.** A versão anterior
deste documento aceitava que a equipe visse equipamento duplicado durante o
período entre a cópia e a remoção. Não é necessário: são duas coisas diferentes.

- **O que a equipe vê** é decidido pela tela do inventário NR-12. Basta ela parar
  de listar a categoria `equipamentos` — um filtro, na mesma entrega da fase 3.
  A partir daí, patrimônio interno só aparece em `/equipamentos`. Ninguém vê nada
  duas vezes.
- **O que está no banco** ninguém enxerga. As linhas originais ficam guardadas ali
  como rede de segurança até o cutover, sem atrapalhar nenhuma tela.

Ou seja: a separação para as pessoas é imediata; o que é adiado é só o `delete`,
que é a parte perigosa e irreversível. Se algo der errado no módulo novo, tira-se
o filtro e tudo volta a aparecer onde estava.

> **Descoberta ao escrever o v168:** `transferencias.id_maquina` é FK para
> `inventario_maquinas` com `on delete set null`. Apagar as linhas do inventário
> **zeraria o vínculo do histórico de transferências** — sobraria só o snapshot em
> texto. O script agora cria `transferencias.id_equipamento` e reaponta antes de
> apagar. O briefing não previa isso.

### 3.2 Base obrigatória — e a migration se recusa a rodar sem ela

A pendência nº 2 do briefing ("equipamento sem base definida") fica **fechada** para
o módulo novo: `equipamentos.id_unidade` é `NOT NULL`. O briefing mediu que os 86
equipamentos já têm base — mas eu não medi, não conectei no banco.

Então a v163 **aborta com a lista de IDs** se encontrar algum equipamento sem base.
Se abortar, é sinal de que a medição de 06/08 mudou: define-se a base desses itens
no inventário e roda de novo. Nada fica pela metade.

Os 37 de 48 itens de "máquinas" sem base **não são afetados** — continuam no
inventário NR-12 como estão.

### 3.3 O catálogo é global; o saldo é que é por base

No EPI o catálogo é por empresa cliente (cada cliente tem o seu CA). Aqui, "Mouse
Logitech M170" é o mesmo produto em Guapimirim e em Teresópolis — o que varia é o
saldo. Catálogo por base criaria o mesmo mouse cadastrado N vezes e tornaria
impossível perguntar "quantos mouses a JCN Consultoria tem no total".

### 3.4 `controla_individual` no produto

O briefing serializa tudo na saída — inclusive o mouse (`#A31 → João`). Mantive
esse comportamento como **padrão** (`controla_individual = true`), mas o produto
tem uma chave para desligar. Sem ela, entregar 5 cabos HDMI cria 5 fichas de
patrimônio e alguém vai ter de inventar número de série para cabo.

Com `false`, a entrega só baixa o saldo e registra a quantidade no item.

### 3.5 Devolver equipamento individualizado **não** faz o saldo subir

O briefing diz que sem devolução "o saldo nunca volta a subir". Isso vale para
item genérico. Para item individualizado, subir o saldo **contaria a mesma unidade
duas vezes**: o notebook existiria como 1 no estoque e como 1 no patrimônio.

Então:
- **Individualizado:** devolução desvincula a pessoa; o ativo volta a ficar livre e
  é reentregue como "ativo existente", sem passar pelo estoque de novo.
- **Genérico:** devolução lança entrada; o saldo sobe.
- **Inservível:** não volta ao saldo em nenhum caso — sumiria a informação de que
  foi descartado. Fica o registro da devolução.

### 3.6 "Motivo obrigatório" virou trava de banco, não de tela

O briefing pede que a mudança de status passe por RPC "porque validação de tela é
contornável pelo PostgREST". RPC sozinha não basta: nada impede alguém de continuar
mandando `PATCH /equipamentos` com o status novo e ignorar a RPC.

Coloquei um **trigger** em `equipamentos` que bloqueia qualquer UPDATE que mexa em
`status` fora da RPC — inclusive de admin, inclusive por psql. A RPC destrava a si
mesma com um marcador de transação. É isso que faz o critério de aceite
("nem pela API") ser verdade.

### 3.7 Ajuste de estoque pode diminuir

No EPI, `tipo` tem três valores (`entrada`/`saida`/`ajuste`) e o saldo soma tudo
que não é saída — então um `ajuste` **nunca consegue baixar o estoque**. Quem
contar 10 na prateleira onde o sistema diz 12 não tem como lançar.

Aqui `tipo` carrega só a direção (`entrada`/`saida`) e o porquê vai em `origem`
(`manual`, `nf`, `entrega`, `devolucao`, `transferencia`, `ajuste`). A RPC de
ajuste recebe **o que foi contado**, calcula a diferença sozinha e exige motivo.

### 3.8 A chave da NF-e é única no sistema inteiro

O EPI usa `unique (empresa_id, chnfe)`. Aqui é `unique (chnfe)`: uma nota fiscal é
um documento único da JCN Consultoria. Se pudesse ser importada em duas bases, o saldo total
inflaria em silêncio — que é justamente o risco que o briefing manda respeitar.

A mensagem de erro diz **em qual base** a nota já foi lançada.

### 3.9 Quem ganha o módulo no dia zero

A v136 deu `transferencias` a todo mundo que podia editar. Não repeti isso: o
patrimônio carrega **valor de aquisição e nota fiscal**, que a v136 não expunha.

O módulo `equipamentos` vai para quem **já tem `transferencias` hoje** (transferência
só existe para equipamento interno — são exatamente as pessoas que já lidam com
patrimônio), mais os admins. Se quiser outra régua, é uma linha.

---

## 4. O que ficou de fora de propósito

- **Todas as telas.** Rota, sidebar, formulário, listagem, PDF do termo de retirada,
  XLSX — nada. É o próximo passo, depois da sua aprovação.
- **A fase 1 (miniaturas do inventário atual).** Ela edita arquivos vivos do módulo
  NR-12 que está em produção e é onde a outra sessão pode encostar. O módulo novo já
  **nasce** com `foto_thumb_path` nas duas tabelas que guardam foto, então não
  repete o erro dos 272 MB.
- **A fase 2 (XLSX sobre o modelo atual).** Independente disto aqui.
- **Registrar o módulo no hub, no cadastro de usuário e nos hooks de estatística.**
  É código de front, entra junto com as telas.

## 5. Perguntas fechadas em 2026-08-10

### 5.1 `numero_patrimonio` é ÚNICO ✅

Único **entre os preenchidos** — índice parcial `uniq_equipamentos_patrimonio`.
Vários equipamentos sem plaqueta convivem; dois com o mesmo número, não. Na cópia,
`''` vira `NULL`, senão string vazia colidiria com ela mesma.

A **mensagem amigável** ("já está em uso pelo equipamento X") é da tela, na fase 3:
consulta antes de salvar, e o erro do índice como rede de segurança para dois
usuários salvando no mesmo segundo — que a tela não tem como pegar.

⚠️ **Não medi a base.** Se já houver patrimônio repetido entre os 86, a v163
aborta **listando quais números** estão repetidos e quantas vezes, para dar o que
corrigir. É a mesma proteção do "equipamento sem base" (§3.2).

### 5.2 Assinatura na devolução: SIM, de quem RECEBE ✅

Tabela `equipamentos_devolucao_assinaturas`, append-only, molde da v166.

**A assimetria é proposital e é jurídica:**

| | Quem assina | Por quê |
|---|---|---|
| **Retirada** | o **funcionário** que leva | é ele que **assume** a responsabilidade pelo bem |
| **Devolução** | o **gerente/representante** que recebe | atesta que o bem voltou e em que estado |

Quem devolveu fica registrado por nome (`id_colaborador`), sem assinar.
**Sem PDF de termo de devolução** — o documento com valor jurídico é o de retirada.
Se um dia precisar, entra `pdf_sha256` e o molde da v166 se repete inteiro.

### 5.3 Lista de motivos de status — 10 aprovados ✅

Vira `check` em `equipamentos_status_historico.motivo_codigo`. A lista fechada é o
que permite perguntar *"quantos baixamos por roubo este ano"*; o campo `motivo`
livre continua ao lado, para narrar o caso.

| Código | Rótulo | Costuma levar para |
|---|---|---|
| `DEFEITO` | Defeito | Em manutenção |
| `MANUTENCAO_PREVENTIVA` | Manutenção preventiva | Em manutenção |
| `DEVOLUCAO_AVARIA` | Avaria na devolução | Em manutenção |
| `MANUTENCAO_CONCLUIDA` | Manutenção concluída | Em operação |
| `RESERVA` | Guardado como reserva | Reserva |
| `REATIVADO` | Reativado | Em operação |
| `TROCA_POR_NOVO` | Troca por novo (+ substituto) | Baixada |
| `FIM_VIDA_UTIL` | Fim de vida útil | Baixada |
| `PERDA_ROUBO` | Perda ou roubo | Baixada |
| `OUTRO` | Outro — **exige o texto livre** | qualquer |

`CADASTRO` existe além desses, interno: é a linha de abertura da timeline, não
aparece na tela. **Acrescentar motivo depois = 1 linha, em migration própria.**

> **Falha que a lista do briefing tinha:** ela só previa motivo para **sair** de
> operação — o equipamento entrava em manutenção e não havia como registrar a
> volta. `MANUTENCAO_CONCLUIDA` e `REATIVADO` fecham o caminho de retorno.

### 5.4 Fotos originais: preservadas ✅

**Encolher só para a tela; a original fica intacta.** A lista lê
`foto_thumb_path` (~25 KB); ao abrir o equipamento, o sistema busca a original em
qualidade cheia — uma foto, sob demanda. É o que mata a lentidão sem sacrificar o
zoom na plaqueta.

Os 272 MB do inventário antigo **continuam guardados**. Não é urgência de disco
(cresce ~100 MB/ano); vira decisão só se um dia apertar. As tabelas novas já
nascem com `foto_thumb_path`, então o módulo novo não repete o problema.

## 6. Como aplicar, quando for a hora

Nesta ordem, uma por vez, conferindo entre elas:

```
v163 → v164 → v165 → v166 → v167      (supabase/migrations, pelo migrate.ps1)
                                       ... módulo em uso e conferido ...
v168                                   (scripts/sql, à mão, é o cutover)
```

Para desfazer, **ordem inversa** (167 → 166 → 165 → 164 → 163). Os rollbacks se
recusam a rodar fora de ordem e avisam, no cabeçalho, o que cada um destrói. O
rollback da v163 é inofensivo **enquanto o v168 não tiver rodado** — depois dele,
restaure `public.bkp_v168_inventario_equipamentos` antes.

## 7. Uma coisa que eu não consegui verificar

O SQL **não foi executado em lugar nenhum** — não há Postgres local e eu não abri
o túnel para a produção. Ele foi escrito lendo v75, v115, v127–v130, v136 e o
`migrate.ps1`, e segue o mesmo formato delas, mas **não passou por um parser**.
Antes de aplicar na `.107` vale rodar cada arquivo com `psql -1 -v ON_ERROR_STOP=1`
numa cópia do banco, ou pelo menos deixar o `ON_ERROR_STOP` fazer o trabalho —
como tudo está em transação única, um erro de digitação aborta sem deixar rastro.
