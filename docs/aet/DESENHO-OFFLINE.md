# AET e AEP offline — desenho

Quarta e última frente do offline de campo. Aqui só o que difere dos módulos
anteriores; o desenho geral está em
[`docs/inspecoes/DESENHO-OFFLINE.md`](../inspecoes/DESENHO-OFFLINE.md).

## O laudo é partido ao meio, e sempre foi

Estes dois módulos são os únicos em que **metade fica online por natureza**:

| Parte | Onde acontece | Offline |
|---|---|---|
| Observação do posto, análise postural, checklist, fotos | no cliente, diante do posto | ✅ |
| Redação do laudo, seções fixas, considerações finais | escritório | ✅ (é o mesmo `salvar`) |
| Geração do PDF | servidor, com Chrome headless | ❌ impossível |
| Análise por IA (setor, introdução de capítulo) | modelo externo | ❌ sem rede não existe |
| Catálogo OWAS, perfis, perguntas do checklist, 13 fatores | configuração global, admin | ❌ por decisão |
| Criar o laudo | escritório, antes da visita | ❌ por decisão |

A divisão foi anunciada desde o diagnóstico: **a coleta vai offline, o laudo
continua exigindo servidor.** O que este trabalho fez foi tornar a coleta
possível sem sinal — não mudar a natureza do laudo.

## Tudo mora num jsonb, e isso muda a foto

Ao contrário dos outros módulos, o AET e o AEP guardam os setores inteiros —
cargos, checklist, riscos, fotos — dentro de **uma coluna `jsonb`** do próprio
relatório. Não há tabela filha.

Consequência: **não existe "gravar só a foto"**. A URL da foto vive dentro do
jsonb, e o jsonb só vai ao banco quando o técnico salva. Por isso:

- a foto deixou de subir no momento em que é escolhida — antes ia direto ao
  MinIO ali, e sem sinal falhava com o técnico ainda diante do posto;
- o caminho e a URL são decididos na captura (montagem de string, sem rede) e
  entram no jsonb imediatamente, para a tela mostrar a foto;
- o arquivo viaja separado, numa lista de pendentes, e é entregue ao `gravar()`
  no salvamento — que o leva ao MinIO **antes** do jsonb.

O auto-save da ordem dos setores também carrega as fotos pendentes. Gravar a
ordem sem levar os arquivos publicaria no laudo uma foto apontando para o nada
até o salvamento seguinte.

A lista de pendentes só é limpa **no sucesso**. Se a gravação falhar, as fotos
continuam esperando o próximo salvamento em vez de sumirem em silêncio.

## O que não mudou

O `silencioso` do auto-save continua existindo e com o mesmo propósito: não
cuspir um toast a cada arrasto. Sem rede o comportamento é o mesmo dele —
atualiza o cache em vez de invalidar, porque um refetch devolveria um objeto
novo, a tela remontaria o estado local e o setor aberto se fecharia sozinho.

## Limitações

- **Criar o laudo exige rede.** Ele nasce no escritório, antes da visita — mesma
  premissa da inspeção.
- **Edição concorrente do jsonb é tudo-ou-nada.** Dois técnicos no mesmo laudo,
  um offline: o último a subir sobrescreve o array inteiro de setores, não só o
  campo alterado. É o risco mais alto de todos os módulos, e vem do formato de
  armazenamento, não do offline.
