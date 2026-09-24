# Conformidade e não-conformidade offline — desenho

Segundo e terceiro módulos a entrar no offline, depois de Inspeções. A
infraestrutura é a mesma (`lib/offline/*`); este documento registra só o que é
diferente aqui.

O desenho geral, a fila e o motor estão em
[`docs/inspecoes/DESENHO-OFFLINE.md`](../inspecoes/DESENHO-OFFLINE.md).

## A diferença que muda tudo: o relatório nasce em campo

A inspeção já existe no painel quando o técnico sai da base — ela é *incrementada*
em campo. O relatório é o contrário: **ele é criado no cliente**, no momento em
que o auditor vê a não-conformidade ou percorre o checklist da NR.

Por isso a criação entrou no offline aqui, e ficou de fora lá.

Consequência prática: ao criar sem rede, a tela redireciona para um relatório que
o servidor ainda não conhece. Sem semear o detalhe no cache na hora, o auditor
criaria o registro e cairia numa tela de erro — que é a pior primeira impressão
possível de uma funcionalidade que existe justamente para não perder trabalho.

## Onde a gravação mora

Nos dois módulos, toda a escrita está concentrada nos hooks
(`lib/hooks/useRelatorios*.ts`). Converter o hook converteu a tela inteira, sem
tocar nos componentes — ao contrário de Inspeções, onde a escrita estava
espalhada por 31 componentes.

| Ação | Offline |
|---|---|
| Criar relatório | ✅ |
| Editar cabeçalho, finalizar, reabrir | ✅ |
| Adicionar, editar e excluir item/NC | ✅ |
| Marcar conforme / não conforme | ✅ |
| Anexar e remover foto | ✅ |
| Excluir relatório | ❌ passa pela lixeira compartilhada; é operação de escritório |

## O caso das fotos: ler "fresco do banco" sem banco

As duas rotinas de foto reescrevem os arrays `foto_urls` e
`foto_storage_paths` inteiros. Para não perder alteração concorrente, elas liam
o estado **fresco do banco** antes de gravar.

Sem rede isso não existe — e falhar não é a resposta certa: o que está na tela é
a melhor verdade disponível. A leitura cai para o cache do React Query, mas
**só em erro de rede**. Recusa do banco continua estourando; senão um item
apagado por outra pessoa voltaria a receber foto em silêncio.

O `scope` do React Query, que já serializava essas mutações entre si, continua
valendo e é o que impede duas fotos disputarem o mesmo array offline.

## Ordem que vem do banco

Ao criar um relatório de conformidade, os itens do checklist da NR são gravados
logo depois do relatório. Eles declaram dependência dele: a FK aponta para o
relatório, e mandar a lista primeiro faria o banco recusar um checklist que está
perfeitamente correto — e a tela de pendências acusaria o item, não a causa.

## Limitações conhecidas

- **Foto apagada sem rede** deixa o arquivo órfão no MinIO. Desperdício de
  espaço, não erro — enfileirar a remoção exigiria a fila entender storage, que
  hoje ela só sabe escrever.
- **Edição concorrente**: dois auditores no mesmo item, um offline. O último a
  subir vence.
- **Excluir relatório** continua exigindo rede.
