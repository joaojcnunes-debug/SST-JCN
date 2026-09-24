# Fila — migrations do painel que **não** foram aplicadas no JCN

Cada arquivo aqui veio da equalização com o painel-sst e ficou **de fora do
banco de propósito**. Nenhum deles está em `supabase_migrations.schema_migrations`.

Ficavam soltos em `supabase/migrations/` e fora do git, o que era ruim por dois
motivos: só existiam no disco de quem sincronizou, e um `supabase db push`
distraído os aplicaria junto com o resto. Agora estão versionados e fora do
alcance da CLI.

## Por que cada grupo está aqui

**Correções pontuais de dados do painel.** `v203_transferencia_elaboracao_*`,
`v211_gestao_gerencial_para_quem_tem_escala`, `v247_colaborador_leandro_duplicado`,
`v249_inspecoes_renovacao_setembro`. Mexem em linhas identificadas por
`USR-…`/`UNI-…` que não existem aqui. Aplicar não faria mal — simplesmente não
casaria com nada.

**A cadeia de biometria dos Equipamentos.** `v188` (inteira), `v189`, e o trecho
de assinatura digital da `v192`. Dependem de `public.epi_bio_key()`, que lê
`current_setting('app.epi_bio_key')` — chave posta por `ALTER DATABASE` no
self-host do painel. Aqui não existe, e inventar uma seria decidir sozinho onde
guardar um segredo. A parte portável da v188 e da v192 **foi** aplicada (ver
`v188_parcial_equip_hash_e_servico.sql` em `migrations/`).

**`v246_equipe_entrega_grant_service_role`.** Dá grant numa tabela que vem da
v189, que está aqui.

**`v254_retira_produtividade`.** Dropa as 7 tabelas `prod_*`. A própria migration
manda só aplicar depois que o código sem o módulo estiver no ar. O código já
saiu (2026-09-24), mas as tabelas ficam até a primeira release/deploy que
realmente chegue aos usuários. Estão vazias, então não há pressa.

**`v155_apreciacao_capitulos_retrato`.** O laudo de apreciação em A4 retrato
depende de uma reorganização do `ApreciacaoTemplate` que aqui é diferente — o
módulo nasceu no JCN. Aplicar só o DML espremeria a faixa de 7 colunas.

**`v182`/`v183` (questionário PER).** Semente de pesquisa que não se aplica.

**O bloco v104–v154.** Numeração do painel que o JCN já tinha coberto com a
própria linhagem (`v1xx_jcn_*`). Ver `docs/supabase-migrations-e-git.md`.

## Se um dia entrar

Aplicar, conferir no banco e **mover o arquivo para `supabase/migrations/`** na
mesma leva — a regra da casa é que tudo em `migrations/` está no banco.
