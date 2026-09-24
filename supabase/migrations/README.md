# `supabase/migrations/` — vazio de propósito

Este diretório é o que a **integração da Supabase com o GitHub** lê. Tudo que
estiver aqui e não constar em `supabase_migrations.schema_migrations` do projeto
é aplicado no banco **de produção** quando o `main` recebe push.

Ele está vazio porque o histórico deste banco não nasceu em arquivo neste
formato. O detalhe está em [`docs/supabase-migrations-e-git.md`](../../docs/supabase-migrations-e-git.md);
o resumo:

- O banco registrou 178 migrations com versão em **timestamp** e nomes da
  linhagem própria do JCN (`security_hardening`, `v110_jcn_drps_envio_cliente`,
  `v163_equipamentos_modulo`…).
- Os 240 arquivos `vNNN_*.sql` que vieram da equalização com o painel-sst estão
  em [`../historico/`](../historico/). **Todos já estão no banco** — foram
  aplicados pelo MCP/painel da Supabase conforme a equalização avançava. Ficam
  ali para leitura, fora do alcance da CLI.
- Os que **não** foram aplicados estão em [`../fila/`](../fila/), com um README
  explicando cada grupo.

Isso importa porque a integração **já está ligada** neste projeto, apontando
para o branch `main`, e está em `MIGRATIONS_FAILED` desde 2026-06-02 — data em
que foi ligada. Ela nunca aplicou nada: as 178 linhas do rastreador foram
escritas pelo painel da Supabase e pelo MCP, nenhuma por ela. A causa provável é
o formato do nome: a CLI extrai a versão do prefixo do arquivo, e `vNNN_` não
começa com timestamp.

## Migration nova, daqui em diante

```
supabase migration new nome_curto_do_que_muda
```

Isso cria `supabase/migrations/<timestamp>_nome_curto_do_que_muda.sql`, no
formato que a integração entende. O arquivo entra no git junto com o resto da
mudança; o push para `main` aplica.

Enquanto a integração não for confirmada funcionando, vale a regra que vinha
sendo usada: aplicar pelo MCP/painel e versionar o arquivo na mesma leva.

## Uma linha de base ainda falta

Com este diretório vazio, um ambiente novo não se reconstrói só do repositório.
O artefato que faltava para isso — um `supabase db pull` — exige CLI autenticada.
Os dumps antigos não servem: `supabase/schema.sql` é de maio/2026 e parcial, e
`supabase/schema_dump.sql` está vazio. Quando houver `supabase login`, a linha de
base entra aqui como o primeiro arquivo com timestamp.
