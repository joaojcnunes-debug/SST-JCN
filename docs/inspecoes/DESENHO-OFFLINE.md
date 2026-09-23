# Inspeções offline — desenho

Levar a captura de inspeção para o campo sem rede. Segunda aplicação do offline no
painel, depois de Frota (v0.3.522–528), e a primeira que **não pode copiar aquele
desenho**.

## Por que o padrão da Frota não serve aqui

`lib/offline/db.ts` guarda **um registro por saída** e diz por quê: a saída é a
unidade que o técnico entende, que o banco valida e que a tela de pendências
mostra. Fila de operações soltas obrigaria a remontar esse contexto a cada erro.

A inspeção quebra as três premissas:

| | Saída de veículo | Inspeção |
|---|---|---|
| Duração | minutos, num fôlego | horas ou dias, em várias visitas |
| Dono | um condutor | técnico + revisor + quem copia de outra empresa |
| Tamanho | 1 linha + 4 fotos + rotas | 11 sub-entidades, dezenas a centenas de linhas |
| Nasce onde | no aparelho, offline | quase sempre no painel, antes da visita |

Guardar "a inspeção inteira" no aparelho significaria baixar e devolver um
documento que outra pessoa pode estar editando no escritório ao mesmo tempo. O
conflito seria a regra, não a exceção.

**A inspeção não é capturada offline. Ela é *incrementada* offline.** O técnico
chega com a inspeção já criada e acrescenta riscos, fotos e medidas enquanto
caminha. É isso que o desenho precisa modelar.

## O que torna isto barato: o id já nasce no celular

O painel inteiro gera identificador no cliente — `gerarId("RSC")` para risco,
`SET` setor, `CGO` cargo, `EPI` proteção, `FOT` foto, `INS` inspeção. Não foi
feito pensando em offline, mas é exatamente a propriedade que a fila da Frota
explora para ser idempotente (`lib/offline/fila.ts`, cabeçalho): reenviar bate na
chave primária, e violação de unicidade **é sucesso**, não erro.

Consequência prática: uma operação de escrita pode ser gravada no aparelho e
repetida quantas vezes for preciso, sem duplicar registro. Sem isso, cada
formulário precisaria de reconciliação própria — e aí sim seriam meses só nesta
fase.

## As três camadas

```
   ┌─ leitura ──────────  cache da inspeção no IndexedDB
   │                      (o técnico "leva" a inspeção para o campo)
   │
   ├─ escrita ──────────  fila de operações por tabela
   │                      (insert/update/delete serializados, repetíveis)
   │
   └─ imagens ──────────  Blob no IndexedDB até o MinIO aceitar
                          (sempre ANTES da linha que aponta para elas)
```

Nenhuma delas reescreve os 31 componentes de `components/inspecoes/`. A escrita
hoje é `supabase.from("riscos").insert(...)` — uma chamada serializável. O ponto
de intercepção é a camada de dados, não a interface.

### Camada de escrita

Cada operação vira um registro na loja `operacoes`:

```
{ id, tabela, tipo: "insert"|"update"|"delete", linhas, filtro,
  id_inspecao, criado_em, tentativas, status }
```

Regras que vêm do banco, não de gosto:

1. **Ordem de criação, sequencial.** Mesma exigência da Frota. Um `update` que
   chegue antes do `insert` da própria linha falha por FK.
2. **Imagem antes da linha.** `riscos.foto_path` guarda o caminho no MinIO; subir
   a linha antes do arquivo deixa referência quebrada.
3. **Reenvio é seguro.** Ver o parágrafo do id acima.
4. **Erro classificado em três**, reaproveitando `lib/offline/fila.ts`:
   `SEM_REDE` (tenta de novo), `REAUTENTICAR` (Cloudflare Access derrubou a
   sessão; o dado está inteiro) e `RECUSADO` (o banco disse não; precisa de
   gente). Confundir os dois primeiros com o terceiro faz o técnico achar que
   perdeu o trabalho — o pecado capital do módulo.

### Camada de leitura

O técnico precisa **decidir** levar a inspeção, não torcer para o cache ter
sobrado. Botão explícito na tela da inspeção: baixa setores, cargos, riscos,
catálogo de tipos e o que mais a tela consulta, e marca a inspeção como
disponível offline.

Motivo de ser explícito: cache oportunista dá a ilusão de cobertura. O técnico sai
da base achando que está coberto e descobre no cliente que a tela que ele precisa
nunca foi aberta. Melhor uma ação consciente antes de sair.

### Camada de imagens

Reaproveita `gerarMiniatura` de `lib/frota/fotos.ts` (redução no navegador, três
níveis). Uma inspeção com 40 riscos fotografados são dezenas de MB — reduzir no
aparelho não é otimização, é o que torna o envio possível numa conexão de campo.

## Escopo: o que vai offline

| Entidade | Offline | Observação |
|---|---|---|
| Setores, cargos | ✅ | criar, editar e excluir |
| Fotos | ✅ | arquivo guardado no aparelho até o MinIO aceitar |
| Responsáveis, complementos | ✅ | |
| EPIs/EPCs | ✅ | inclusive vários equipamentos num cadastro só |
| Extintores | ✅ | via `upsert` |
| Treinamentos | ✅ | com as três relações M:N encadeadas |
| Máquinas | ✅ | id passou a nascer no navegador — ver abaixo |
| Observações e concluir/reabrir | ✅ | data de conclusão vem do aparelho |
| **Riscos** | ✅ | inclusive o produto cruzado modelo × setor, os EPIs do risco e a foto da FDS |
| Semeadura do catálogo | ❌ | conveniência que aprende com o que foi digitado — ver abaixo |
| Análise por IA (máquina, treinamento) | ❌ | a sugestão vem de modelo externo; sem rede não existe |
| Criar inspeção, atribuir responsável, excluir da lista | ❌ | operação de escritório: a inspeção nasce no painel |
| Cópia entre empresas | ❌ | exige as duas pontas online |
| PGR, relatório, PDF | ❌ | geração no servidor, ver o diagnóstico do app |

### O id da máquina passou a nascer no navegador

`inspecao_maquinas.id_maquina_inspecao` é `uuid` e vinha do banco, por
`insert().select().single()` — e era exatamente isso que impedia o cadastro
offline: sem o id, a ligação com os setores não tinha para onde apontar.

Agora o navegador gera com `crypto.randomUUID()`. Informar o id no insert só
sobrepõe o default da coluna; **nenhuma migração é necessária**. É o mesmo
princípio que o resto do painel já usa com `gerarId`, e o que torna o reenvio
idempotente.

É a única mudança de comportamento em gravação existente que este trabalho
introduz. Merece um olhar do dev na revisão.

### Por que a semeadura do catálogo não vai para a fila

Ao salvar um risco, o painel aprende: o agente, as fontes e os EPIs digitados
viram sugestões para a próxima vez (`semearCatalogoFormSnapshot`). O próprio
código já trata falha ali como não-fatal — *"falhas aqui são logadas mas não
derrubam o save do risco"*.

Sem rede ela simplesmente não roda. Enfileirar encheria a tela de pendências com
"1 item de catálogo novo" — algo que não diz nada ao técnico e que ele não
saberia resolver se aparecesse como recusado. O risco sobe; o aprendizado do
catálogo se perde, e ele volta na próxima vez que alguém digitar o mesmo com
sinal.

### A foto da FDS mudou de momento

Ela subia ao MinIO no instante em que o arquivo era escolhido, antes de o risco
existir — e sem rede falhava ali, com o técnico ainda no meio do formulário.
Agora o componente só decide o caminho e monta a URL; o arquivo vai junto do
risco, pelo `gravar()`. O botão passou a dizer "Anexar foto" em vez de "Enviar
foto", porque é isso que ele faz agora.

## Pendências

- **RiscoForm**. O que falta, e o maior de todos.
- **Edição concorrente**: dois técnicos no mesmo registro, um offline. Hoje o
  último a subir vence. Aceitável enquanto a captura em campo for de registro
  novo; deixa de ser quando virar edição de registro existente.
- **Foto apagada sem rede**: a linha some pela fila, mas o arquivo fica no MinIO.
  Órfão que ocupa espaço e não aparece em lugar nenhum. Enfileirar a remoção
  exigiria a fila entender storage, que hoje ela só sabe escrever.
- **Excluir algo que ainda não subiu**: a fila fica com o insert e o delete, e os
  dois sobem — o registro nasce e morre no servidor em segundos. Desperdício, não
  erro. Vale otimizar só se a tela de pendências mostrar que acontece muito.
- **Peso das fotos**: são guardadas como saem da câmera, sem redução, para não
  divergir do caminho online. Quarenta fotos de 2,5 MB são 100 MB no aparelho. Se
  isso apertar na prática, a decisão de reduzir precisa valer para os dois
  caminhos.
- **Teto de armazenamento**: `navigator.storage.persist()` já é chamado em
  `lib/offline/db.ts`, mas o navegador pode negar. No app Android o armazenamento
  é garantido — mais um motivo para a equipe usar o APK, e não o navegador.
- **Sem aviso fora da tela de pendências**: o cabeçalho não mostra contador. O
  técnico precisa lembrar de conferir.
