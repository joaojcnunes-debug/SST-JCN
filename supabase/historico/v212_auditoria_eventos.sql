-- v212 — Auditoria de toda movimentação do painel (Fase 1: o banco passa a gravar).
--
-- PEDIDO (14/09): "criar uma auditoria de toda movimentação que é feita no
-- painel, com mecanismos de busca avançados. Documentos editados, concluídos,
-- mudanças no painel, tudo que for mudança ou adição/edição."
--
-- POR QUE GATILHO, E NÃO CÓDIGO: a trilha de hoje (`document_audit_logs`) só
-- grava quando o programador lembrou de chamar `registrarAuditoria` — 5 arquivos
-- num painel com ~410 pontos de gravação direto do navegador, 29 RPCs, 55 rotas
-- de API e a sincronização offline. Medido em 14/09: 712 registros em 3 meses,
-- nenhum de criação ou edição de documento. Um gatilho por tabela pega TODOS os
-- caminhos de uma vez — inclusive script rodado à mão — e não depende de ninguém
-- lembrar. Volume medido nos 30 dias anteriores: 9.420 criações + ~2.000 edições
-- em 47 tabelas; maior valor de coluna 123 KB (DRPS), p95 do `setores` do AET
-- 51 KB. Banco inteiro: 73 MB.
--
-- O QUE GRAVA (`auditoria_eventos`): quem (e-mail do JWT, o mesmo que a RLS lê),
-- quando, tabela + registro, módulo, empresa, título do registro, a ação
-- (criou | editou | excluiu) e — na edição — SÓ os campos que mudaram, com o valor
-- antes e depois. Criação e exclusão guardam a linha inteira. Se ambos os lados
-- de um campo jsonb são OBJETOS, desce um nível e guarda só as chaves que mudaram
-- (o AET guarda o laudo inteiro num jsonb; sem isso cada edição copiaria 50 KB).
--
-- O QUE NÃO GRAVA: colunas de segredo e de imagem de assinatura saem mascaradas
-- ('***'); `updated_at`/`atualizado_em` não contam como mudança (edição que só
-- tocou nelas não vira evento); tabelas de log/backup/histórico não têm gatilho.
--
-- SEGURANÇA: o gatilho é SECURITY DEFINER (dono chabra_admin) — o usuário comum
-- não tem INSERT na tabela de eventos e mesmo assim o registro entra. Leitura só
-- para Admin (RLS via caller_eh_admin()). Ninguém edita nem apaga evento pela
-- API. Falha dentro do gatilho vira WARNING e NÃO derruba a gravação do usuário:
-- perder um evento é melhor do que perder o trabalho de alguém.
--
-- QUEM GRAVA PELO TOKEN DE SERVIÇO (13 rotas de API) aparece com e-mail nulo e
-- role 'service_role' — a Fase 3 passa o ator por essas rotas.
--
-- TABELA NOVA no futuro: `select public.auditoria_ativar('nome_da_tabela');` —
-- ou reexecutar esta migration, que é idempotente e varre o schema de novo.
--
-- ROLLBACK: scripts/sql/v212_auditoria_eventos.rollback.sql (tira gatilhos e
-- funções; a tabela de eventos fica, apagar é decisão do operador).
-- Rodar com `psql -1 -v ON_ERROR_STOP=1`. Depois: notify pgrst (está no fim).

-- ── 1) Configuração: uma linha por tabela auditada ──────────────────────────
create table if not exists public.auditoria_tabelas (
  tabela         text primary key,
  modulo         text not null,
  pk_colunas     text[] not null,
  coluna_titulo  text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);
comment on table public.auditoria_tabelas is
  'v212 — tabelas com gatilho de auditoria. modulo é o id do hub; pk_colunas monta registro_id; coluna_titulo alimenta a busca.';

-- ── 2) Os eventos ───────────────────────────────────────────────────────────
create table if not exists public.auditoria_eventos (
  id               bigserial primary key,
  ocorrido_em      timestamptz not null default now(),
  tabela           text not null,
  registro_id      text,
  acao             text not null check (acao in ('criou','editou','excluiu')),
  modulo           text not null,
  id_empresa       text,
  titulo           text,
  usuario_email    text,
  usuario_role     text,
  campos_alterados text[] not null default '{}',
  antes            jsonb,
  depois           jsonb,
  -- Busca livre (Fase 2): título, quem, e o texto do antes/depois.
  busca            tsvector generated always as (
    to_tsvector('simple',
      coalesce(titulo, '') || ' ' || coalesce(usuario_email, '') || ' ' ||
      coalesce(registro_id, '') || ' ' ||
      coalesce(antes::text, '') || ' ' || coalesce(depois::text, ''))
  ) stored
);
comment on table public.auditoria_eventos is
  'v212 — trilha de tudo que foi criado, editado ou excluído no painel, gravada por gatilho. Só Admin lê; ninguém edita.';

create index if not exists auditoria_eventos_ocorrido_idx  on public.auditoria_eventos (ocorrido_em desc);
create index if not exists auditoria_eventos_registro_idx  on public.auditoria_eventos (tabela, registro_id, ocorrido_em desc);
create index if not exists auditoria_eventos_usuario_idx   on public.auditoria_eventos (usuario_email, ocorrido_em desc);
create index if not exists auditoria_eventos_empresa_idx   on public.auditoria_eventos (id_empresa, ocorrido_em desc);
create index if not exists auditoria_eventos_modulo_idx    on public.auditoria_eventos (modulo, ocorrido_em desc);
create index if not exists auditoria_eventos_campos_idx    on public.auditoria_eventos using gin (campos_alterados);
create index if not exists auditoria_eventos_busca_idx     on public.auditoria_eventos using gin (busca);

-- ── 3) Módulo a partir do nome da tabela (mesmos ids do hub) ────────────────
create or replace function public.auditoria_modulo_de(p_tabela text)
returns text language sql immutable as $$
  select case
    when p_tabela ~ '^aep_'                            then 'aep'
    when p_tabela ~ '^aet_'                            then 'aet'
    when p_tabela ~ '^drps_'                           then 'psicossocial'
    when p_tabela ~ '^qps_'                            then 'questionarios_psicossociais'
    when p_tabela ~ '^apreciac'                        then 'apreciacao_maquinas'
    when p_tabela ~ '^epi_'                            then 'epi'
    when p_tabela ~ '^equip'                           then 'equipamentos'
    when p_tabela ~ '^frota_'                          then 'frota'
    when p_tabela ~ '^escala_'                         then 'escala_supervisores'
    when p_tabela ~ '^gg_'                             then 'gestao_gerencial'
    when p_tabela ~ '^gestao_'                         then 'gestao_chabra'
    when p_tabela ~ '^prod_'                           then 'produtividade'
    when p_tabela ~ '^investigac'                      then 'investigacao_acidente'
    when p_tabela ~ '^relatorios_nao_conformidade'     then 'nao_conformidade'
    when p_tabela ~ '^relatorios_conformidade'         then 'conformidade'
    when p_tabela in ('analises_quimicos','base_referencia_quimicos') then 'analise_quimicos'
    when p_tabela = 'transferencias'                   then 'transferencias'
    when p_tabela = 'inventario_maquinas'              then 'inventario_maquinas'
    when p_tabela in ('pdfs_gerados','pdfs_assinados') then 'pdfs'
    when p_tabela in ('empresas','unidades','usuarios','configuracoes','textos_padrao',
                      'novidades_avisos','cnae_grau_risco','colaboradores_chabra',
                      'colaboradores_chabra_biometria') then 'sistema'
    else 'painel'   -- inspeções: inspecoes, riscos, setores, cargos, treinamentos_*, extintores, fotos, catálogos…
  end
$$;

-- ── 4) O gatilho ────────────────────────────────────────────────────────────
create or replace function public.auditoria_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg        public.auditoria_tabelas%rowtype;
  j_old      jsonb;
  j_new      jsonb;
  antes      jsonb := '{}'::jsonb;
  depois     jsonb := '{}'::jsonb;
  campos     text[] := '{}';
  k          text;
  v_old      jsonb;
  v_new      jsonb;
  sub_antes  jsonb;
  sub_depois jsonb;
  sk         text;
  claims     jsonb;
  v_email    text;
  v_role     text;
  v_registro text;
  v_empresa  text;
  v_titulo   text;
  v_acao     text;
  -- Colunas que nunca saem em claro.
  c_mascara  constant text := 'senha|password|token|secret|pfx|biometria_dedo|biometria_template|^template$|assinatura_png|_base64';
  -- Colunas que não contam como mudança.
  c_ignora   constant text[] := array['updated_at','atualizado_em'];
begin
  select * into cfg from public.auditoria_tabelas where tabela = TG_TABLE_NAME;
  if not found or not cfg.ativo then
    return null;
  end if;

  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));
  v_role  := coalesce(claims ->> 'role', current_user::text);

  if TG_OP in ('UPDATE','DELETE') then j_old := to_jsonb(OLD); end if;
  if TG_OP in ('UPDATE','INSERT') then j_new := to_jsonb(NEW); end if;

  -- Mascara segredos nos dois lados.
  if j_old is not null then
    select coalesce(jsonb_object_agg(e.key, case when e.key ~* c_mascara and e.value <> 'null'::jsonb then '"***"'::jsonb else e.value end), '{}'::jsonb)
      into j_old from jsonb_each(j_old) e;
  end if;
  if j_new is not null then
    select coalesce(jsonb_object_agg(e.key, case when e.key ~* c_mascara and e.value <> 'null'::jsonb then '"***"'::jsonb else e.value end), '{}'::jsonb)
      into j_new from jsonb_each(j_new) e;
  end if;

  if TG_OP = 'INSERT' then
    v_acao := 'criou';
    depois := j_new;
    antes  := null;
  elsif TG_OP = 'DELETE' then
    v_acao := 'excluiu';
    antes  := j_old;
    depois := null;
  else
    v_acao := 'editou';
    for k in select key from jsonb_each(j_new) union select key from jsonb_each(j_old) loop
      if k = any(c_ignora) then continue; end if;
      v_old := j_old -> k;
      v_new := j_new -> k;
      if v_old is distinct from v_new then
        campos := array_append(campos, k);
        -- jsonb OBJETO dos dois lados: guarda só as chaves que mudaram.
        if jsonb_typeof(v_old) = 'object' and jsonb_typeof(v_new) = 'object' then
          sub_antes := '{}'::jsonb; sub_depois := '{}'::jsonb;
          for sk in select key from jsonb_each(v_new) union select key from jsonb_each(v_old) loop
            if (v_old -> sk) is distinct from (v_new -> sk) then
              sub_antes  := sub_antes  || jsonb_build_object(sk, v_old -> sk);
              sub_depois := sub_depois || jsonb_build_object(sk, v_new -> sk);
            end if;
          end loop;
          antes  := antes  || jsonb_build_object(k, sub_antes);
          depois := depois || jsonb_build_object(k, sub_depois);
        else
          antes  := antes  || jsonb_build_object(k, v_old);
          depois := depois || jsonb_build_object(k, v_new);
        end if;
      end if;
    end loop;
    -- Só updated_at mudou (ou nada): não é movimentação.
    if coalesce(array_length(campos, 1), 0) = 0 then
      return null;
    end if;
  end if;

  -- Identificação do registro (PK simples ou composta, unida por '|').
  select string_agg(coalesce(coalesce(j_new, j_old) ->> c, ''), '|' order by ord)
    into v_registro
    from unnest(cfg.pk_colunas) with ordinality as u(c, ord);

  v_empresa := coalesce(j_new ->> 'id_empresa', j_old ->> 'id_empresa',
                        j_new ->> 'empresa_id', j_old ->> 'empresa_id');
  if cfg.coluna_titulo is not null then
    v_titulo := left(coalesce(j_new ->> cfg.coluna_titulo, j_old ->> cfg.coluna_titulo), 200);
  end if;

  insert into public.auditoria_eventos
    (tabela, registro_id, acao, modulo, id_empresa, titulo, usuario_email, usuario_role, campos_alterados, antes, depois)
  values
    (TG_TABLE_NAME, v_registro, v_acao, cfg.modulo, v_empresa, v_titulo, v_email, v_role, campos, antes, depois);

  return null;
exception when others then
  -- Nunca derruba a gravação do usuário por causa da trilha.
  raise warning 'auditoria: falha ao registrar % em % (%): %', TG_OP, TG_TABLE_NAME, v_registro, sqlerrm;
  return null;
end
$$;

-- ── 5) Ligar / desligar uma tabela ──────────────────────────────────────────
create or replace function public.auditoria_ativar(p_tabela text, p_modulo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pk     text[];
  v_titulo text;
begin
  if to_regclass('public.' || quote_ident(p_tabela)) is null then
    raise exception 'auditoria_ativar: tabela public.% nao existe', p_tabela;
  end if;

  select array_agg(a.attname::text order by k.ord)
    into v_pk
    from pg_index i
    join lateral unnest(i.indkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
   where i.indrelid = ('public.' || quote_ident(p_tabela))::regclass
     and i.indisprimary;
  if v_pk is null then
    raise exception 'auditoria_ativar: tabela % sem chave primaria — nao ha como identificar o registro', p_tabela;
  end if;

  -- Primeira coluna "de nome" que a tabela tiver.
  select c.column_name::text into v_titulo
    from unnest(array['nome_empresa','titulo','nome','nome_completo','razao_social','placa','nr_titulo','descricao','email','codigo'])
         with ordinality as p(nome, ord)
    join information_schema.columns c
      on c.table_schema = 'public' and c.table_name = p_tabela and c.column_name = p.nome
   order by p.ord limit 1;

  insert into public.auditoria_tabelas (tabela, modulo, pk_colunas, coluna_titulo)
  values (p_tabela, coalesce(p_modulo, public.auditoria_modulo_de(p_tabela)), v_pk, v_titulo)
  on conflict (tabela) do update
    set modulo = coalesce(p_modulo, public.auditoria_tabelas.modulo),
        pk_colunas = excluded.pk_colunas,
        coluna_titulo = excluded.coluna_titulo,
        ativo = true;

  execute format('drop trigger if exists trg_auditoria on public.%I', p_tabela);
  execute format(
    'create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.auditoria_registrar()',
    p_tabela);
end $$;

create or replace function public.auditoria_desativar(p_tabela text)
returns void language plpgsql security definer set search_path = public as $$
begin
  execute format('drop trigger if exists trg_auditoria on public.%I', p_tabela);
  update public.auditoria_tabelas set ativo = false where tabela = p_tabela;
end $$;

-- ── 6) Ligar em todas as tabelas de negócio ─────────────────────────────────
-- Ficam de fora: a própria auditoria, logs, históricos, versões, backups,
-- migrations, filas/caches e preferências de tela (ruído, não movimentação).
do $$
declare r record; n int := 0;
begin
  for r in
    select c.relname as tabela
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r'
       and c.relname !~ '^(auditoria_|backup_|bkp_|schema_migrations$)'
       and c.relname !~ '(_log|_historico|_versoes|_revisao)$'
       and c.relname not in (
         'document_audit_logs', 'registros_excluidos',
         'gestao_google_eventos', 'gestao_google_fila', 'gestao_notificacoes',
         'gestao_preferencias_visao', 'gestao_filtros_salvos',
         'novidades_vistas',
         'equip_biometria_sondas', 'equip_biometria_tentativas'
       )
       and exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary)
     order by 1
  loop
    perform public.auditoria_ativar(r.tabela);
    n := n + 1;
  end loop;
  raise notice 'v212: gatilho de auditoria ligado em % tabela(s).', n;
end $$;

-- ── 7) Permissões ───────────────────────────────────────────────────────────
alter table public.auditoria_eventos enable row level security;
alter table public.auditoria_tabelas enable row level security;

drop policy if exists auditoria_eventos_sel on public.auditoria_eventos;
create policy auditoria_eventos_sel on public.auditoria_eventos
  for select to authenticated using (public.caller_eh_admin());

drop policy if exists auditoria_tabelas_sel on public.auditoria_tabelas;
create policy auditoria_tabelas_sel on public.auditoria_tabelas
  for select to authenticated using (public.caller_eh_admin());

revoke all on public.auditoria_eventos from authenticated, anon;
revoke all on public.auditoria_tabelas from authenticated, anon;
grant select on public.auditoria_eventos to authenticated;
grant select on public.auditoria_tabelas to authenticated;
-- Ligar/desligar tabela é operação de banco, não de API.
revoke all on function public.auditoria_ativar(text, text) from public, authenticated, anon;
revoke all on function public.auditoria_desativar(text) from public, authenticated, anon;
revoke all on function public.auditoria_registrar() from public, authenticated, anon;

notify pgrst, 'reload schema';
