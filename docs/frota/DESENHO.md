# Frota JCN Consultoria — Checklist de Veículos (v177)

Módulo interno de controle de saída de veículos da frota da JCN Consultoria. Escopado por
**base** (`id_unidade`), nunca por empresa cliente — mesmo eixo que Equipamentos
(v163).

## A decisão central: cinco tempos, não um formulário

As cinco seções pedidas não vivem no mesmo ritmo, e é isso que dita o esquema:

| Ritmo | O que é | Onde mora |
|---|---|---|
| Nasce uma vez | placa, modelo, avarias padrão, km de cadastro | `frota_veiculos` |
| Cresce sem fim | galeria, sinistros, abastecimentos | 5 tabelas filhas |
| A cada chave | a saída: condutor, km, 4 fotos, destino, rotas | `frota_checklists` |

Se tudo fosse um registro só, o condutor redigitaria a placa em cada saída e o
sinistro de março reapareceria copiado em todas as saídas de abril.

## As 9 tabelas

```
frota_veiculos ─┬─ frota_veiculo_fotos          galeria ilimitada
                ├─ frota_sinistros ──── frota_sinistro_fotos
                ├─ frota_abastecimentos ─ frota_abastecimento_anexos
                └─ frota_checklists ─┬─ frota_checklist_fotos   as 4 obrigatórias
                                     └─ frota_rotas             trechos do trajeto
```

`on delete` difere de propósito: fotos, anexos e rotas caem junto com o pai
(`cascade`); o checklist aponta para o veículo com `restrict`, porque apagar um
veículo que tem histórico de saída é erro, não cascata.

## Decisões do operador, e onde cada uma vive

| # | Decisão | Implementação |
|---|---|---|
| 1 | Frota é só da JCN Consultoria | `id_unidade` em todas as raízes. Nenhuma coluna de empresa. |
| 2 | Dois campos de avaria | `frota_veiculos.avarias_padrao` (no cadastro) + `frota_checklists.avarias_constatadas` (por saída). A tela de saída mostra a padrão em cinza acima do campo. |
| 3 | Rotas pertencem à **saída** | `frota_rotas.id_checklist`. Antes seria filha do abastecimento — abastecer duas vezes na mesma viagem duplicaria as rotas e dobraria o km rodado. |
| 4 | Sem soma automática | `litros`, `valor_litro`, `valor_total` são três colunas comuns e independentes. Nenhuma é gerada, e a tela não preenche uma a partir das outras. Comprovante em `frota_abastecimento_anexos`, com `mime` — **aceita qualquer formato**, e mais de um. |
| 5 | Peso das imagens | Três níveis (`thumb_path` 320px, `vista_path` 1600px, `original_path` opcional). Reduzido **no navegador** por `gerarMiniatura` (v173). Original descartado — ver `PRESERVAR_ORIGINAL` em `lib/frota/fotos.ts`. |
| 6 | km obrigatório, dois registros | `km_cadastro` (uma vez, imutável) + `km_atual`/`km_atual_em`/`km_atual_origem`. O rodado é **derivado**, não coluna. |
| 7 | CEP autocompleta | `app/api/frota/cep/[cep]/route.ts` — server-side, porque o CSP do Electron bloqueia fetch externo do renderer (mesma razão do `api/cnpj`). |
| 8 | Retorno é fase 2 | `data_retorno` e `km_retorno` previstas e sem uso. |
| 9 | Permissão não definida | A v177 **não concede o módulo a ninguém**. Concessão manual em `usuarios.modulos_permitidos`. |

## A trava das 4 fotos

Duas camadas:

1. **Índice único parcial** `(id_checklist, angulo) where angulo <> 'EXTRA'` — impede
   duas "frentes" no mesmo checklist.
2. **Trigger** `frota_exige_4_fotos` na transição para `FINALIZADO` — recusa se
   faltar qualquer ângulo. Roda em **`before insert or update`**: a tela sempre
   passa pelo rascunho, mas um `insert ... status='FINALIZADO'` direto no
   PostgREST nasceria finalizado sem foto, e um trigger só de `update` nunca
   veria essa linha. Como foto precisa de um `id_checklist` para existir, todo
   INSERT já-finalizado tem zero foto e cai aqui.

O trigger é `security definer` **por correção**: ele consulta
`frota_checklist_fotos`, que tem RLS. Sem `definer`, a contagem seria a que o
*chamador* vê — e uma trava cujo veredito depende de quem pergunta não é trava.

`ANGULOS_OBRIGATORIOS` em `lib/frota/angulos.ts` deve bater com o `array[...]` do
trigger. Se um ângulo entrar em um e não no outro, a tela cobra e o banco deixa
passar (ou o contrário, e a saída nunca finaliza).

## A saída mora na mesma base do veículo

`frota_checklists.id_unidade` é **cópia** da unidade do veículo — existe para a
RLS e o índice não precisarem de join. Cópia sem trava vira duas verdades: a
policy valida a unidade *do checklist*, e a FK de `id_veiculo` não passa por RLS.
Sem guarda, alguém da base A criaria uma saída carimbada A para um veículo da
base B — a saída apareceria na lista de A e o veículo na de B.

`frota_checklist_mesma_base` fecha isso. Cobra só no `insert` e quando
`id_veiculo`/`id_unidade` mudam: se o veículo for transferido de base depois, as
saídas antigas ficam como estão. Elas aconteceram na base antiga, e reescrever
histórico seria pior que a doença.

A tela nunca esbarra nisso — `ChecklistSaidaWizard` já envia `veiculo.id_unidade`.

## km nunca regride

`atualizarKmVeiculo()` em `lib/hooks/useFrotaVeiculos.ts` usa `UPDATE` condicional
num só statement (`.or("km_atual.is.null,km_atual.lt.<km>")`), atômico: dois
lançamentos simultâneos não se atropelam. Um `select` seguido de `update` teria
janela para o menor sobrescrever o maior.

Odômetro digitado errado (`8421` em vez de `84210`) faria o veículo voltar no
tempo, e todo cálculo de rodado e consumo sairia errado sem que se soubesse desde
quando. `CHECK ck_frota_veiculos_km` é a rede.

## Exclusão: lixeira sempre, com autor

Veículo, saída, sinistro e abastecimento passam por `excluirComLixeiraPorId`
(`lib/hooks/useLixeira.ts`), que já grava `registros_excluidos.excluido_por`, o
retrato completo da linha em `dados` (jsonb) e chama `registrarAuditoria`.

**Não existe coluna `excluido_por` nas tabelas de frota, de propósito**: a linha
deixa de existir no `DELETE`, então a coluna morreria junto com a informação. O
registro tem de viver fora da tabela apagada.

A galeria é a exceção: remover foto não vai para a lixeira, porque lixeira guarda
registro de negócio, não item de mídia — e o veículo continua lá com o resto.

As fotos no storage **ficam** após a exclusão. É o que permite a restauração
reabrir as imagens.

## Storage

Bucket `fotos` (o que já existe), tudo sob o prefixo **`frota/`** — é o que torna
a limpeza um comando só.

```
fotos/frota/
├─ veiculos/{id}/capa.jpg  capa_thumb.jpg  galeria/{id_foto}_{thumb|vista}.jpg
├─ checklists/{id}/{frente|lateral-direita|lateral-esquerda|traseira}_{thumb|vista}.jpg
│                  extra/{id_foto}_{thumb|vista}.jpg
├─ sinistros/{id}/{id_foto}_{thumb|vista}.jpg
└─ abastecimentos/{id}/{id_anexo}.{ext}
```

Caminho usa **ID, nunca placa**: placa se corrige por digitação errada, o ID não
muda. Nome do ângulo é fixo no caminho, com `upsert` — refazer a foto da frente
sobrescreve em vez de acumular lixo.

## Deploy

O pipeline já sequencia certo (`deploy/README.md`): `build.ps1` → `migrate.ps1` →
`deploy.ps1` → `healthcheck.ps1`. A migration entra antes da imagem que a lê.

A v177 é **puramente aditiva** — 9 tabelas novas, zero `ALTER` em tabela
existente. Isso é o que torna seguro um deploy só: o `healthcheck` faz rollback
da *imagem* para `:previous`, mas não desfaz a migration, e a imagem antiga
simplesmente ignora tabelas que não conhece.

**Validar em produção sem expor ninguém:** suba tudo, conceda `frota` só ao seu
usuário, teste com storage e celular reais, e só então libere. A v177 não concede
a ninguém justamente para isso.

## Remoção em 5 passos

1. `psql -1 -v ON_ERROR_STOP=1 -f scripts/sql/v177_frota_checklist_veiculos_rollback.sql`
2. `rm -r "app/(frota)" app/api/frota lib/frota components/frota docs/frota`
3. `rm lib/hooks/useFrota*.ts`
4. `git checkout -- lib/supabase/types.ts "app/(hub)/modulos/page.tsx"`
5. Remover o prefixo `fotos/frota/` no MinIO

Depois disso, `grep -rn "frota" .` volta zero.

**Arquivos compartilhados: apenas 2**, e nos dois só há adição —
`lib/supabase/types.ts` (3 linhas) e `app/(hub)/modulos/page.tsx` (o card, com
`skipStats: true` para não precisar tocar `lib/hooks/useHomeStats.ts`).

## Fora do escopo da fase 1

Manutenção preventiva, multas e CNH, telemetria, custo por km, modo offline com
fila, PDF do checklist, assinatura do condutor, vínculo condutor↔usuário, e
ponte automática com Investigação de Acidente quando `com_vitima` é marcado
(o campo registra; abrir a investigação é decisão de quem conduz).
