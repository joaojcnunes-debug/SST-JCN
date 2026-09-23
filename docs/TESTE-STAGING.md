# Como testar a branch `feat/inspecoes-offline` sem tocar em produção

Guia para quem tem acesso ao **.107**. Do zero até a decisão de publicar ou não.

Quem escreveu o código não conseguiu executá-lo — falta o `.env` e o acesso aos
containers internos. **Nada aqui foi rodado em navegador.** Passou por
`tsc --noEmit` e `eslint` no projeto inteiro, o que garante que compila, não que
funciona.

---

## O que esta branch faz

Sete módulos de campo passam a gravar sem internet: inspeções, não-conformidade,
conformidade, apreciação de máquinas, inventário de máquinas, equipamentos e
questionários (este último sem tela que use). A Frota já era offline e continua.

**Com rede, o comportamento é o mesmo de antes.** O `gravar()` tenta a gravação ao
vivo primeiro e só desvia para a fila local quando a rede falha de verdade.

---

## Passo 1 — Confirmar que produção não é afetada

Antes de qualquer coisa, o essencial:

- O deploy só dispara com push na **`cutover/2026-06-26`**
  (`.forgejo/workflows/deploy.yml`). Fazer checkout da branch de trabalho **não**
  publica nada.
- O staging sobe em container e porta **separados** (`painel-sst-staging`, 3005).
  Não encosta em `painel-sst-app`.
- Se algo der errado num deploy futuro, o `healthcheck.ps1` reverte para a imagem
  `:previous` sozinho.

## Passo 2 — Trazer a branch

Por SSH na `.107` (Ubuntu):

```bash
cd <repo>
git fetch origin
git checkout feat/inspecoes-offline
git log --oneline -1   # deve mostrar o commit mais recente da branch
```

De quebra, os testes automatizados da fila rodam aqui sem subir container
nenhum — 30 segundos, e já dizem se o motor está de pé:

```bash
npm ci
npm test          # esperado: 20 passando, 0 falhando
```

## Passo 3 — Subir o staging

```bash
bash deploy/staging-preview.sh
```

Sobe imagem, container e porta separados de produção. Os segredos ele lê do
ambiente do container `painel-sst-app` por `docker inspect` — leitura pura, sem
depender de onde o `.env.painel` mora. Para apontar um arquivo:
`--env-file /caminho/.env.painel`.

> O `deploy/staging-preview.ps1` é da época em que a `.107` era Windows (pede
> `C:\temp` e Docker Desktop). Não roda mais lá.

## Passo 4 — Chegar até a tela

**No navegador da própria `.107`:** `http://127.0.0.1:3005`.

**De outra máquina** (o caso normal, se a `.107` não tem interface gráfica):
túnel SSH, e o endereço continua sendo `127.0.0.1:3005` no navegador local —

```bash
ssh -L 3005:127.0.0.1:3005 usuario@<ip-da-107>
```

O endereço tem que ser o mesmo nas duas pontas: o app é compilado com a origem
`127.0.0.1:3005`, e os rewrites de `/api/rest/v1` e `/auth/v1` só funcionam
same-origin. Com endereço diferente, o navegador não fala com o PostgREST e
nada carrega.

Para simular falta de rede, use **F12 → aba Network → Offline**. O código
offline é código de navegador; esse botão o exercita de verdade. O teste no
celular só é possível depois que a branch estiver publicada.

## Passo 5 — Rodar os testes

O roteiro completo, com o resultado esperado de cada um, está em
[`docs/inspecoes/TESTE-OFFLINE.md`](inspecoes/TESTE-OFFLINE.md).

⚠️ **Este teste ESCREVE no banco real.** Use uma **inspeção e uma empresa de
teste**, e apague o que criar. Não é um ambiente com banco próprio — o isolamento
é de aplicação, não de dados.

### Se você só tiver tempo para quatro

Estes quatro cobrem o risco real. Os demais cobrem funcionalidade.

| # | Teste | Por que este |
|---|---|---|
| 1 | **Nada mudou com rede** — criar e editar um setor normalmente | Se algo cair na fila com rede boa, o painel inteiro passa a trabalhar offline sem necessidade |
| 2 | **Ciclo completo da Frota offline** | `checarConexao` e `ehDuplicidade` saíram de `fila.ts` para `rede.ts`. É código em produção, movido sem execução — o único ponto que pode quebrar para quem já usa hoje |
| 3 | **Banco local v2 → v4** num aparelho com saídas de Frota guardadas | As saídas não podem sumir na migração |
| 9 | **Abrir a inspeção offline depois de fechar o app** | Se falhar, todo o resto do offline é inútil: o técnico não chega aos formulários |

## Passo 6 — Encerrar

```bash
docker rm -f painel-sst-staging
docker image rm painel-sst-staging:latest
```

E apague os registros de teste que ficaram no banco.

---

## O que revisar no código, além de rodar

Três pontos merecem o olho de quem conhece o schema:

1. **O id da máquina e o do respondente passaram a nascer no navegador.**
   `inspecao_maquinas.id_maquina_inspecao` e `qps_respondentes.id_respondente` são
   `uuid ... default gen_random_uuid()`. Informar o id no insert só sobrepõe o
   default — nenhuma migração é necessária. Mas era `insert().select().single()`
   antes, e vale confirmar que nada dependia do id vir do servidor.

2. **A fila usa `upsert` com `onConflict`** em extintores e treinamentos, e trata
   violação de unicidade como **sucesso** (o id nasce no cliente, então bater na
   PK significa que a tentativa anterior chegou). Se alguma tabela tiver
   constraint de unicidade por outro motivo, isso precisa ser revisto.

3. **As fotos deixaram de subir no momento da escolha do arquivo.** Agora o
   caminho é decidido na captura e o arquivo vai junto da linha. Confirme que
   nenhum fluxo dependia do arquivo já estar no MinIO antes de salvar.

---

## Antes de publicar

O deploy é `git push origin feat/inspecoes-offline:cutover/2026-06-26` (ou merge
e push). Antes disso:

- [ ] Os quatro testes essenciais passaram
- [ ] A equipe do escritório foi avisada das mudanças visíveis: o botão da foto da
      FDS agora diz "Anexar foto", existe um bloco "Levar para o campo" acima das
      abas da inspeção e do relatório, e há um item "No aparelho" no menu quando
      houver algo pendente
- [ ] Uma janela de baixo movimento foi escolhida
- [ ] Alguém está disponível para acompanhar os minutos seguintes ao deploy

Se algo quebrar, o `healthcheck.ps1` reverte sozinho quando `/api/health` não
responde 200 — mas ele não pega quebra de tela, só de servidor.
