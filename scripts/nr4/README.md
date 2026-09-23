# Anexo I da NR-4 — CNAE → grau de risco

Como as 673 linhas da migration `v141_cnae_grau_risco.sql` foram obtidas, e
como refazer quando a norma mudar.

**Isto não roda no deploy.** É ferramenta de manutenção, usada à mão só quando
sai edição nova da NR-4.

## Por que existe

O grau de risco dimensiona o SESMT (NR-4) e influencia a CIPA (NR-5). Um valor
errado se replica em laudo, em silêncio, por centenas de empresas. Então os
valores **não podem ser digitados a mão nem tirados de site de terceiros** —
saem do PDF oficial, por processo repetível e conferido.

## Fonte

NR-4 atualizada em 2023, Anexo I: *"RELAÇÃO DA CLASSIFICAÇÃO NACIONAL DE
ATIVIDADES ECONÔMICAS - CNAE (VERSÃO 2.0), COM CORRESPONDENTE GRAU DE RISCO -
GR"*.

- URL: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-04-atualizada-2023.pdf
- SHA-256 do arquivo usado: `1e7bdfb832d7cda0ac012d55c818be2d945730cb64316f498198c6b2eae6dc84`
- 31 páginas, 731.088 bytes

O PDF **não** está versionado aqui (evita 700 KB de binário no repo). Se o link
cair, o `anexo1-nr4-2023.json` desta pasta é o registro do que foi extraído.
Confira o SHA-256 antes de reprocessar: se mudar, o Ministério publicou outra
versão e os números precisam ser reconferidos, não reaproveitados.

## Como refazer

Precisa de `pdftotext` (poppler) e Node.

```bash
curl -sL -o nr4.pdf "<URL acima>"
sha256sum nr4.pdf                       # compare com o hash acima

pdftotext -layout -enc UTF-8 nr4.pdf nr4-layout.txt
pdftotext -raw    -enc UTF-8 nr4.pdf nr4-raw.txt

node extrair-anexo1.js  nr4-layout.txt anexo1-layout.json
node conferir-anexo1.js nr4-raw.txt anexo1-layout.json anexo1-nr4-2023.json
node gerar-migration.js anexo1-nr4-2023.json ../../supabase/migrations/vNNN_cnae_grau_risco.sql
```

O `conferir-anexo1.js` **sai com erro se os dois métodos discordarem** em
qualquer mapeamento. Não contorne isso: discordância significa artefato de
leitura, e é o único guarda entre um PDF mal lido e um laudo errado.

## As duas armadilhas do PDF

Descobertas na extração de 22/07/2026 — e é por isso que a conferência cruzada
existe:

1. **Descrição que quebra linha.** No modo `-raw`, quando a denominação é longa,
   o código fica sozinho numa linha, a descrição vem embaixo e **o GR aparece
   isolado numa linha própria**. Um parser ingênuo perde 87 das 673 entradas —
   em silêncio, porque as linhas simplesmente não casam com o padrão.
2. **Rodapé no meio da tabela.** A linha *"Este texto não substitui o publicado
   no DOU"* aparece entre os registros, no meio de uma entrada quebrada.

No modo `-layout` nenhuma das duas atrapalha, porque o GR fica sempre no fim da
primeira linha. Por isso os dois modos se complementam: um confirma o outro.

## Conferências automáticas

- **673 itens** — bate com o número de classes da CNAE 2.0 (21 seções, 87
  divisões, 285 grupos, 673 classes). A migration **aborta** se a carga não tiver
  exatamente esse total; ao carregar edição nova, revise essa trava, porque o
  número muda se a CNAE mudar de versão.
- Nenhum código duplicado, todos com 5 dígitos, todos com grau entre 1 e 4.
- Nenhuma denominação termina em dígito 1–4 — não há como confundir texto com GR.
- Toda linha que *parece* um CNAE e não casa com o padrão é reportada, nunca
  descartada em silêncio.

## Granularidade — a pegadinha central

A norma trabalha na **classe** (5 dígitos, `01.11-3`). A Receita Federal devolve
a **subclasse** (7 dígitos, `4511102`). Subclasse = classe + 2 dígitos, então
truncar em 5 resolve. Quem faz isso é a função `grau_risco_por_cnae()` no banco
e o `classeDoCnae()` em `lib/nr4/grau-risco.ts` — os dois aceitam com ou sem
máscara, porque há cadastro antigo gravado nos dois formatos.
