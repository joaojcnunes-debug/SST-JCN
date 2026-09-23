# Inspeções offline — roteiro de teste

O que validar na branch `feat/inspecoes-offline` **antes** de qualquer merge ou deploy.

Escrito porque quem escreveu o código não conseguiu executá-lo: falta o `.env` e
o acesso aos containers internos. Tudo abaixo passou por `tsc` e `eslint`, e nada
passou por navegador.

## Como subir sem tocar em produção

```powershell
# no .107, com a branch em checkout
powershell -File deploy\staging-preview.ps1
```

Container `painel-sst-staging` na porta 3005, isolado do de produção. Lê dados
reais via PostgREST, com RLS respeitada.

⚠️ **Este teste ESCREVE no banco real** — ao contrário do aviso original do
script, que era para navegação read-only. Setores e cargos criados aqui aparecem
no painel de verdade. Use uma **inspeção de teste**, e apague o que criar.

Para testar pelo celular em vez do navegador do servidor, o `$ORIGIN` do script
precisa apontar para o IP de rede do .107 em vez de `127.0.0.1` — senão o
same-origin quebra e o app não fala com o PostgREST.

## Como simular a falta de rede

- **Navegador**: DevTools → aba Network → `Offline`. Cobre quase tudo.
- **Celular**: modo avião. É o único jeito de testar o caso real, porque o
  `navigator.onLine` do Android se comporta diferente do que o DevTools finge.

## Os testes

### 1. Regressão: nada mudou com rede

O mais importante da lista. Com rede normal, criar e editar um setor e um cargo.

**Esperado:** exatamente o comportamento de antes — grava direto, a lista
atualiza, o toast diz "Setor adicionado". **Nada** deve aparecer em
`/pendencias`.

Se algo cair na fila com rede boa, o `gravar()` está classificando errado e o
painel inteiro passaria a trabalhar offline sem necessidade.

### 2. Regressão da Frota — a que mais me preocupa

`checarConexao` e `ehDuplicidade` saíram de `lib/offline/fila.ts` para
`lib/offline/rede.ts`. É código em produção da Frota, movido sem execução.

**Testar:** o ciclo completo de uma saída de veículo offline — capturar sem rede,
voltar a rede, confirmar que sobe e que a tela de pendências da Frota zera.

Se isto quebrar, quebra para quem já usa hoje. É o único ponto do trabalho com
esse risco.

### 3. Migração do banco local (v2 → v4)

Num aparelho **que já tenha saídas de Frota guardadas**, abrir a versão nova.

**Esperado:** as saídas continuam lá, e as lojas novas (`operacoes`, `imagens`,
`documentos`) são criadas ao lado. O upgrade é idempotente por loja, então nada
antigo deveria ser tocado — mas é exatamente o tipo de coisa que só o teste prova.

**Como conferir:** DevTools → Application → IndexedDB → `painel-sst-offline`.

### 4. Setor criado sem rede

Modo avião → abrir inspeção → adicionar setor.

**Esperado:**
- toast "Setor guardado no aparelho" com ícone 📵;
- o setor **aparece na lista imediatamente** (atualização otimista);
- aparece em `/pendencias` como "1 setor novo".

Se o setor sumir ao fechar o modal, a atualização otimista falhou — e o técnico
digitaria de novo, criando duplicata no dia seguinte.

### 5. Volta da rede

Desligar o modo avião com a pendência na tela.

**Esperado:** sobe sozinho, sem clique. A pendência migra para "Já enviados" e o
setor existe no painel de verdade.

**Conferir o aviso:** enquanto há pendência, a barra superior mostra um selo
`N no aparelho`, em QUALQUER módulo — ele é o único ponto que os dezenove
compartilham. O selo some quando a fila esvazia. Se ele não aparecer, o técnico
nunca vai descobrir sozinho que tem registro parado no celular.

### 5b. Faxina da fila

Depois de sincronizar, abrir DevTools → Application → IndexedDB →
`painel-sst-offline` → `imagens`.

**Esperado:** as fotos já enviadas continuam ali por até sete dias e somem
depois — a limpeza roda ao fim de cada sincronização. Se elas nunca saírem, o
aparelho de um técnico com quarenta fotos por dia enche em algumas semanas e o
offline morre por falta de espaço justamente em quem mais o usa.

### 6. Dependência: setor e cargo, os dois offline

Modo avião → criar um setor → criar um cargo **nesse setor** → voltar a rede.

**Esperado:** o setor sobe primeiro, o cargo depois, os dois com sucesso.

**O caso que importa de verdade:** force o setor a ser recusado (nome duplicado,
ou edite o `id_empresa` para um inválido antes de reconectar). O cargo deve
aparecer em **"Esperando outro registro"**, e **não** em "Recusados". Se o cargo
for para "Recusados", o `depende_de` não está sendo respeitado — e o técnico
procuraria defeito num cargo que está correto.

### 7. Recusa de verdade

Com rede, tentar salvar um setor com nome vazio.

**Esperado:** erro na hora, na tela. **Nada** vai para a fila. Enfileirar erro de
preenchimento cria pendência fantasma que ninguém sabe resolver.

### 8. Sessão do Cloudflare Access caindo

Com pendências na fila, apagar o cookie `CF_Authorization` e mandar enviar.

**Esperado:** a tela mostra "Sua sessão expirou / Nada foi perdido", e as
operações continuam **PENDENTE**. Se virarem RECUSADA, a sonda `checarConexao`
não está distinguindo queda de sessão de recusa do banco — que é o erro mais
grave possível neste módulo.

### 9. Levar para o campo

Abrir uma inspeção com rede → "Levar para o campo" → modo avião → recarregar.

**Esperado:** o botão passa a dizer "Disponível sem internet" com data e hora, e a
inspeção **abre normalmente** depois de recarregar em modo avião — com setores,
cargos, riscos e fotos.

**O teste que separa isto de tudo o mais:** feche o aplicativo por completo,
reabra ainda sem sinal e abra a inspeção. Se ela abrir, a leitura offline
funciona. Se abrir vazia ou com erro, o resto do offline não serve para nada — o
técnico não chega até os formulários.

**Conferir também o contrário:** abra uma inspeção que você **não** levou para o
campo, sem rede. Ela deve dar erro honesto, e não tela vazia sem explicação.

### 10. Foto sem rede — o caso com arquivo

Modo avião → aba Fotos → enviar uma foto com legenda e setor.

**Esperado:** "Foto guardada no aparelho", a foto aparece na lista, e a pendência
diz "1 foto nova · 1 foto no aparelho". Ao voltar a rede, o arquivo sobe ao MinIO
e a imagem abre de verdade no painel.

**O que confere se está certo:** a URL gravada na linha tem que ser exatamente o
caminho para onde o arquivo subiu. Se a foto aparecer quebrada no painel depois
de sincronizar, `getPublicUrl` e o caminho da fila divergiram.

**Conferir também o espaço:** DevTools → Application → Storage. A foto é guardada
como saiu da câmera, sem redução — 40 fotos de 2,5 MB são 100 MB no aparelho. Se
isso for demais na prática, a decisão de reduzir precisa valer para o caminho
online também, senão a mesma inspeção termina com fotos nítidas e fotos reduzidas
conforme o técnico tinha sinal.

### 11. EPI com vários equipamentos de uma vez

Modo avião → aba EPIs → escolher 3 equipamentos num único cadastro.

**Esperado:** uma pendência dizendo "3 EPIs/EPCs novos" — uma operação só, com
três linhas. Se aparecerem três pendências separadas, o insert em lote virou três,
e o comportamento de "se algo falhar, não fica meia lista" se perdeu.

### 12. Treinamento — o encadeamento longo

Modo avião → editar um treinamento existente, trocando os setores e cargos
vinculados.

**Esperado:** até 7 pendências (o treinamento, 3 limpezas, 3 reinserções), nesta
ordem, e todas sobem em cascata quando a rede voltar.

**O caso que importa:** force a limpeza de setores a falhar. As reinserções devem
ficar em **"Esperando outro registro"**. Se elas subirem assim mesmo, o
treinamento termina com os vínculos antigos e os novos ao mesmo tempo — e ninguém
vai perceber olhando a tela.

### 13. Risco sem rede — o fluxo mais importante de todos

Modo avião → aba Riscos → novo risco, marcando **3 setores** e adicionando
**2 EPIs** antes de salvar.

**Esperado:** "3 risco(s) guardado(s) no aparelho, um por setor", os três
aparecem na lista, e em pendências há **duas** entradas — "3 riscos novos" e
"6 EPIs/EPCs novos" — nesta ordem. Os EPIs devem aparecer como dependentes: se o
insert dos riscos falhar, eles vão para "Esperando outro registro", nunca para
"Recusados". A FK aponta para os riscos, e culpar a lista de EPIs por isso faria
o técnico procurar defeito onde não tem.

**Conferir também:** abra um dos riscos criados. Os 2 EPIs precisam estar lá. Se
a lista de proteções abrir vazia, a atualização otimista não incluiu os EPIs.

### 14. Foto da FDS sem rede

Risco do tipo Químico → anexar foto da FDS, ainda em modo avião.

**Esperado:** o botão diz "Anexar foto" e a mensagem é "Foto FDS anexada — sobe
ao salvar o risco". **Nada sobe neste momento** — antes deste trabalho, a foto ia
para o MinIO já na escolha do arquivo, e sem rede falhava ali.

Ao salvar e reconectar, o arquivo sobe **antes** da linha do risco e a imagem
abre no painel. Se abrir quebrada, o caminho decidido na captura e o do envio
divergiram.

### 15. Catálogo NÃO aprende offline

Salve um risco sem rede com um agente que não existe no catálogo. Reconecte.

**Esperado:** o risco sobe, mas o agente **não** vira sugestão — e **nenhuma
pendência de catálogo aparece**. É comportamento desejado, não falha: o
aprendizado é conveniência, e uma pendência chamada "1 item de catálogo novo" não
diria nada ao técnico nem teria como ser resolvida por ele.

## O que NÃO está pronto
- **Leitura offline** — ver a limitação do teste 9. O cache é gravado e ainda não
  é lido.
- **Contador no cabeçalho** — não há aviso de pendência fora da própria tela.
- **Apagar foto offline** — o arquivo removido fica no MinIO quando a troca
  acontece sem rede. Desperdício de espaço, não erro.
- **Demais módulos de SST** — não-conformidade, conformidade, máquinas,
  equipamentos e questionários seguem exigindo rede.
