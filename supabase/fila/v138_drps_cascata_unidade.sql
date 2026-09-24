-- v138: DRPS — Fase 2, cascata Unidade › Setor › Função no laudo.
--
-- Contexto: a v137 (Fase 1) passou a capturar `drps_respondentes.unidade_trabalho`.
-- Esta migration cria o lugar onde a psicóloga registra probabilidade, monitoramento
-- e textos SEPARADOS POR UNIDADE, decidido com o RT Sanmyo em 2026-07-21
-- (n mínimo por bloco = 1; unidade sem respondente simplesmente não aparece).
--
-- ============================================================================
-- ESTA MIGRATION É 100% ADITIVA. NÃO ALTERA NEM REESCREVE NENHUM DADO EXISTENTE.
-- ============================================================================
-- Não há ALTER de chave primária, não há UPDATE em coluna de conteúdo, não há
-- DELETE, não há TRUNCATE, não há DROP. O trabalho já feito pelas psicólogas —
-- as 637 linhas de drps_probabilidades e os 3 JSONB de conclusão/agravos/medidas
-- de 113 relatórios — continua exatamente onde está e continua sendo lido.
--
-- MODELO DE HERANÇA COM OVERRIDE:
--   O que existe hoje (nível SETOR) vira o valor PADRÃO de todas as unidades
--   daquele setor. As tabelas/colunas novas guardam SÓ as exceções — o bloco
--   (unidade, setor) que a psicóloga decidir diferenciar. Ler = procurar o
--   override; não achou, usa o valor de setor de sempre.
--   Consequência prática: se esta migration for revertida (drop das 2 tabelas
--   novas + drop das 4 colunas novas), o painel volta ao comportamento atual
--   com todos os laudos intactos. Nada do que existe depende do que é criado aqui.
--
-- ⚠️ Aplicar manualmente em produção — migrations do DRPS não são automáticas.
-- ⚠️ Depois de aplicar, recarregue o cache do PostgREST (senão a API responde
--    400/42703 para as colunas novas e as telas não mostram nada):
--      ssh chabra-107 "docker kill -s SIGUSR1 painel-sst-postgrest"
--      ssh chabra-107 "docker logs painel-sst-postgrest --tail 5"   # Schema cache loaded
-- ⚠️ Migration ANTES do front. O front usa `as never` nas tabelas drps_*, então
--    o TypeScript não protege: front na frente = importação DRPS quebrada para
--    todos os clientes.
--
-- Schema real conferido no banco de produção em 2026-07-21 (só SELECT):
--   drps_probabilidades  PK (id_relatorio, setor, topico_idx)
--   drps_monitoramento   PK (id_relatorio, setor, topico_idx)
--   drps_relatorios      conclusoes_por_setor / agravos_por_setor /
--                        medidas_por_setor — os 3 jsonb nullable

begin;

-- ---------------------------------------------------------------------------
-- 0. Travas de pré-condição + retrato do que existe ANTES.
--    O retrato é conferido no fim: se qualquer contagem tiver mudado, a
--    migration aborta e faz rollback de tudo.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'drps_relatorios') then
    raise exception 'drps_relatorios não existe — migration abortada';
  end if;

  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'drps_probabilidades') then
    raise exception 'drps_probabilidades não existe — migration abortada';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'drps_respondentes'
                    and column_name = 'unidade_trabalho') then
    raise exception 'drps_respondentes.unidade_trabalho não existe — aplique a v137 antes';
  end if;

  -- As policies novas dependem destas duas funções (não estão no repo, existem
  -- só em produção — ver memória "drps-schema-e-texto-padrao-split").
  if to_regprocedure('public.caller_pode_editar()') is null
     or to_regprocedure('public.caller_pode_ver_empresa(text)') is null then
    raise exception 'caller_pode_editar()/caller_pode_ver_empresa() ausentes — migration abortada';
  end if;
end $$;

create temporary table _v138_antes on commit drop as
select
  (select count(*) from public.drps_relatorios)                      as relatorios,
  (select count(*) from public.drps_probabilidades)                  as probabilidades,
  (select count(*) from public.drps_monitoramento)                   as monitoramento,
  (select count(*) from public.drps_respondentes)                    as respondentes,
  (select count(*) from public.drps_relatorios
    where conclusoes_por_setor is not null)                          as com_conclusoes,
  (select count(*) from public.drps_relatorios
    where agravos_por_setor is not null)                             as com_agravos,
  (select count(*) from public.drps_relatorios
    where medidas_por_setor is not null)                             as com_medidas,
  (select md5(coalesce(string_agg(
      id_relatorio || '|' || setor || '|' || topico_idx || '|' || probabilidade,
      ',' order by id_relatorio, setor, topico_idx), ''))
     from public.drps_probabilidades)                                as hash_probabilidades;

-- ---------------------------------------------------------------------------
-- 1. Overrides de probabilidade por unidade.
--    Espelha drps_probabilidades + coluna unidade na PK. Uma linha aqui só
--    existe quando a psicóloga diverge do valor do setor.
-- ---------------------------------------------------------------------------
create table if not exists public.drps_probabilidades_unidade (
  id_relatorio  text        not null references public.drps_relatorios(id_relatorio) on delete cascade,
  id_empresa    text        not null references public.empresas(id_empresa)          on delete cascade,
  unidade       text        not null,
  setor         text        not null,
  topico_idx    smallint    not null,
  probabilidade smallint    not null,
  updated_at    timestamptz not null default now(),
  primary key (id_relatorio, unidade, setor, topico_idx),
  constraint drps_prob_uni_probabilidade_check check (probabilidade between 1 and 3),
  constraint drps_prob_uni_topico_idx_chk      check (topico_idx between 0 and 12),
  -- Unidade vazia é proibida DE PROPÓSITO: "sem unidade" é o registro antigo,
  -- em drps_probabilidades. Impede que um override sombreie o valor herdado.
  constraint drps_prob_uni_unidade_nao_vazia   check (btrim(unidade) <> '')
);

comment on table public.drps_probabilidades_unidade is
  'Overrides de probabilidade por (unidade, setor). Ausência de linha = herda de drps_probabilidades (nível setor). Nunca guarda o valor herdado, só a exceção.';

create index if not exists idx_drps_prob_uni_relatorio
  on public.drps_probabilidades_unidade (id_relatorio);
create index if not exists idx_drps_prob_uni_empresa
  on public.drps_probabilidades_unidade (id_empresa);

-- ---------------------------------------------------------------------------
-- 2. Overrides de monitoramento por unidade. Mesmo desenho.
-- ---------------------------------------------------------------------------
create table if not exists public.drps_monitoramento_unidade (
  id_relatorio      text        not null references public.drps_relatorios(id_relatorio) on delete cascade,
  id_empresa        text        not null references public.empresas(id_empresa)          on delete cascade,
  unidade           text        not null,
  setor             text        not null,
  topico_idx        smallint    not null,
  data_intervencao  date,
  responsavel       text,
  status            text        not null default 'Pendente',
  proxima_avaliacao date,
  observacoes       text,
  updated_at        timestamptz not null default now(),
  primary key (id_relatorio, unidade, setor, topico_idx),
  constraint drps_monit_uni_status_check
    check (status in ('Pendente', 'Em Andamento', 'Concluido', 'Cancelado')),
  constraint drps_monit_uni_topico_idx_chk    check (topico_idx between 0 and 12),
  constraint drps_monit_uni_unidade_nao_vazia check (btrim(unidade) <> '')
);

comment on table public.drps_monitoramento_unidade is
  'Overrides de monitoramento por (unidade, setor). Ausência de linha = herda de drps_monitoramento.';

create index if not exists idx_drps_monit_uni_relatorio
  on public.drps_monitoramento_unidade (id_relatorio);
create index if not exists idx_drps_monit_uni_empresa
  on public.drps_monitoramento_unidade (id_empresa);

-- ---------------------------------------------------------------------------
-- 3. RLS e grants — cópia fiel do que vale para as tabelas de origem.
-- ---------------------------------------------------------------------------
alter table public.drps_probabilidades_unidade enable row level security;
alter table public.drps_monitoramento_unidade  enable row level security;

drop policy if exists drps_prob_uni_sel on public.drps_probabilidades_unidade;
create policy drps_prob_uni_sel on public.drps_probabilidades_unidade
  for select to authenticated
  using (caller_pode_ver_empresa(id_empresa));

drop policy if exists drps_prob_uni_rw on public.drps_probabilidades_unidade;
create policy drps_prob_uni_rw on public.drps_probabilidades_unidade
  to authenticated
  using (caller_pode_editar() and caller_pode_ver_empresa(id_empresa))
  with check (caller_pode_editar() and caller_pode_ver_empresa(id_empresa));

drop policy if exists drps_monit_uni_sel on public.drps_monitoramento_unidade;
create policy drps_monit_uni_sel on public.drps_monitoramento_unidade
  for select to authenticated
  using (caller_pode_ver_empresa(id_empresa));

drop policy if exists drps_monit_uni_rw on public.drps_monitoramento_unidade;
create policy drps_monit_uni_rw on public.drps_monitoramento_unidade
  to authenticated
  using (caller_pode_editar() and caller_pode_ver_empresa(id_empresa))
  with check (caller_pode_editar() and caller_pode_ver_empresa(id_empresa));

grant select                         on public.drps_probabilidades_unidade to anon;
grant select                         on public.drps_probabilidades_unidade to backup_operator;
grant select, insert, update, delete on public.drps_probabilidades_unidade to authenticated;
grant select, insert, update, delete on public.drps_probabilidades_unidade to service_role;

grant select                         on public.drps_monitoramento_unidade to anon;
grant select                         on public.drps_monitoramento_unidade to backup_operator;
grant select, insert, update, delete on public.drps_monitoramento_unidade to authenticated;
grant select, insert, update, delete on public.drps_monitoramento_unidade to service_role;

-- ---------------------------------------------------------------------------
-- 4. Textos por unidade — COLUNAS NOVAS, ao lado das antigas.
--    As 3 colunas *_por_setor NÃO são tocadas: continuam sendo o texto herdado.
--    As novas guardam só os blocos diferenciados, aninhadas por unidade:
--      { "INCA": { "COZINHA": "texto..." }, "MANAUS": { "COZINHA": "outro..." } }
--    Aninhado, e não chave "unidade||setor", porque unidade e setor são texto
--    livre vindo do Forms — qualquer separador pode aparecer dentro do nome.
--    NULL = nenhum override neste relatório.
-- ---------------------------------------------------------------------------
alter table public.drps_relatorios
  add column if not exists conclusoes_por_unidade_setor jsonb,
  add column if not exists agravos_por_unidade_setor    jsonb,
  add column if not exists medidas_por_unidade_setor    jsonb;

comment on column public.drps_relatorios.conclusoes_por_unidade_setor is
  'Overrides de conclusão por unidade: {unidade: {setor: texto}}. Ausente = herda de conclusoes_por_setor.';
comment on column public.drps_relatorios.agravos_por_unidade_setor is
  'Overrides de agravos por unidade: {unidade: {setor: texto}}. Ausente = herda de agravos_por_setor.';
comment on column public.drps_relatorios.medidas_por_unidade_setor is
  'Overrides de medidas por unidade: {unidade: {setor: texto}}. Ausente = herda de medidas_por_setor.';

-- ---------------------------------------------------------------------------
-- 5. Chave do "Sem análise" (tópico sem nenhuma resposta deixa de sair como
--    "Baixa/verde" e passa a sair como "Sem análise", fora da matriz).
--    Só vale para este relatório e para os próximos: o default é FALSE na
--    criação da coluna — então os relatórios que já existem ficam todos em
--    false e reimprimem idênticos — e só DEPOIS o default vira TRUE, valendo
--    para os relatórios criados daqui pra frente. Sem UPDATE em massa.
-- ---------------------------------------------------------------------------
alter table public.drps_relatorios
  add column if not exists exibir_sem_analise boolean not null default false;

alter table public.drps_relatorios
  alter column exibir_sem_analise set default true;

comment on column public.drps_relatorios.exibir_sem_analise is
  'true = tópico sem respostas (n=0) sai como "Sem análise" em vez de "Baixa". Relatórios anteriores à v138 ficam em false para reimprimir idênticos.';

-- A.C.F. DA SILVA (DRPS-4A5B07DE) é o relatório que motivou a cascata e vai
-- ser reaberto para receber o novo formato — entra no comportamento novo.
do $$
begin
  if exists (select 1 from public.drps_relatorios where id_relatorio = 'DRPS-4A5B07DE') then
    update public.drps_relatorios
       set exibir_sem_analise = true
     where id_relatorio = 'DRPS-4A5B07DE';
    raise notice 'DRPS-4A5B07DE marcado com exibir_sem_analise = true';
  else
    raise notice 'DRPS-4A5B07DE não encontrado — nenhum relatório marcado';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Conferência final: nada do que já existia pode ter mudado.
--    Qualquer divergência aborta e desfaz a migration inteira.
-- ---------------------------------------------------------------------------
do $$
declare
  a _v138_antes%rowtype;
begin
  select * into a from _v138_antes;

  if (select count(*) from public.drps_relatorios) <> a.relatorios then
    raise exception 'ABORTADO: drps_relatorios mudou de % linhas', a.relatorios;
  end if;
  if (select count(*) from public.drps_probabilidades) <> a.probabilidades then
    raise exception 'ABORTADO: drps_probabilidades mudou de % linhas', a.probabilidades;
  end if;
  if (select count(*) from public.drps_monitoramento) <> a.monitoramento then
    raise exception 'ABORTADO: drps_monitoramento mudou de % linhas', a.monitoramento;
  end if;
  if (select count(*) from public.drps_respondentes) <> a.respondentes then
    raise exception 'ABORTADO: drps_respondentes mudou de % linhas', a.respondentes;
  end if;

  -- Conteúdo (não só a contagem) das probabilidades já preenchidas.
  if (select md5(coalesce(string_agg(
        id_relatorio || '|' || setor || '|' || topico_idx || '|' || probabilidade,
        ',' order by id_relatorio, setor, topico_idx), ''))
        from public.drps_probabilidades) <> a.hash_probabilidades then
    raise exception 'ABORTADO: o conteúdo de drps_probabilidades foi alterado';
  end if;

  -- Os textos já escritos continuam presentes.
  if (select count(*) from public.drps_relatorios where conclusoes_por_setor is not null) <> a.com_conclusoes
     or (select count(*) from public.drps_relatorios where agravos_por_setor is not null) <> a.com_agravos
     or (select count(*) from public.drps_relatorios where medidas_por_setor is not null) <> a.com_medidas then
    raise exception 'ABORTADO: os textos por setor foram alterados';
  end if;

  -- Nenhum relatório antigo pode ter entrado no comportamento novo por engano
  -- (só o DRPS-4A5B07DE, marcado de propósito acima).
  if (select count(*) from public.drps_relatorios
       where exibir_sem_analise and id_relatorio <> 'DRPS-4A5B07DE') > 0 then
    raise exception 'ABORTADO: relatório antigo marcado com exibir_sem_analise';
  end if;

  raise notice 'OK v138 — nada alterado. relatorios=% probabilidades=% (hash confere) monitoramento=% respondentes=%',
    a.relatorios, a.probabilidades, a.monitoramento, a.respondentes;
  raise notice 'Criadas: drps_probabilidades_unidade, drps_monitoramento_unidade, 3 jsonb de override + exibir_sem_analise';
end $$;

-- Pede ao PostgREST para reler o schema (redundante com o SIGUSR1 do cabeçalho,
-- mas inofensivo se o canal não estiver configurado).
notify pgrst, 'reload schema';

commit;
