# Migrations, a CLI da Supabase e a integração com o GitHub

**Resumo: não ligue a integração da Supabase com o GitHub apontando para
`supabase/migrations/` como o diretório está hoje. Ela tentaria reaplicar 240
arquivos num banco em produção.**

Este documento explica por quê e qual é o caminho para poder ligar.

## O estado de hoje (2026-09-24)

Existem **duas linhagens de migration** neste repositório, e elas não se falam.

**A linhagem do JCN** é a que o banco de fato registrou. Está em
`supabase_migrations.schema_migrations`, com 178 linhas, versão em timestamp
(`20260527145608` … `20260924155502`) e nomes próprios deste projeto:
`security_hardening`, `gestao_core_v86_v96`, `v110_jcn_drps_envio_cliente`,
`v163_equipamentos_modulo`, `v60_extintores`…

**A linhagem do painel** é a que está nos arquivos. `supabase/migrations/` tem
302 arquivos `vNNN_nome.sql`, copiados do painel-sst durante a equalização. 240
estão versionados; 62 continuam fora do git de propósito — é a fila do que
**não** foi aplicado (correções de dados do painel sem alvo aqui, a cadeia de
biometria que depende de uma chave inexistente, e a v254, que espera uma release).

As duas só coincidem onde migrations do painel foram aplicadas nesta sessão
(v209 em diante). A maior parte dos 240 arquivos versionados não tem
correspondente no rastreador — foram aplicados por outros caminhos, antes, com
outro nome.

## Por que isso quebra a integração

A CLI e a integração da Supabase casam arquivo com registro pelo **prefixo de
timestamp do nome do arquivo**. Dois problemas somados:

1. `vNNN_nome.sql` não começa com timestamp — a CLI não consegue extrair versão.
2. Mesmo que conseguisse, os nomes não batem com os 178 registros.

O resultado de um `supabase db push` ou de um deploy pela integração seria
tratar tudo como pendente. Em um banco com dados, reaplicar 240 migrations não é
idempotente: há `drop constraint`, `alter column type`, `delete`, `update` e
`create policy` que dependem de estado.

## O caminho para poder ligar

O procedimento padrão da Supabase para este caso é **fechar uma linha de base**:

1. `supabase db pull` gera um único arquivo com o schema atual, já no formato de
   timestamp.
2. Esse arquivo vira a migration inicial; o histórico antigo sai de
   `supabase/migrations/` e vai para uma pasta de arquivo (`supabase/historico/`,
   por exemplo), preservado mas fora do alcance da CLI.
3. `supabase migration repair --status applied <versão>` alinha o rastreador.
4. Daí em diante, migration nova nasce por `supabase migration new <nome>`, já
   com timestamp, e a integração passa a valer.

Isso é uma operação de uma vez só, e precisa ser feita com o banco parado de
receber mudanças por outros caminhos. **Não foi feita** — é decisão de quando,
não de se.

## Enquanto isso não acontece

- Migration é aplicada pelo MCP/painel da Supabase, e o arquivo `vNNN_` entra no
  git **na mesma leva**, com o conteúdo exatamente como foi aplicado. A regra que
  vem sendo seguida: *tudo que está em `supabase/migrations/` versionado está no
  banco*. O que não foi aplicado fica fora do git.
- `supabase/config.toml` fixa o `project_id` deste projeto. Ele existe porque o
  vínculo local apontava para o projeto do **painel** — um `db push` teria
  mandado migration do JCN para a produção do painel.
- A integração com o GitHub pode ser ligada para **Edge Functions**
  (`supabase/functions/`) sem nenhum desses problemas; o impedimento é só o
  diretório de migrations.
