-- v349 — Gestão: Lixeira de cartões e listas, 180 dias (11/11/2026, 0.3.280).
--
-- Trazida da v361 do Painel (0.3.940). Cartão (tarefa ou subtarefa aberta como cartão) ou lista excluídos vão para a
-- Lixeira e podem ser restaurados por 180 dias; depois saem sozinhos. Não há "excluir de vez". Quem vê/restaura: quem
-- excluiu e os gestores (owner/admin da Gestão); lista restrita (gestao_quadros.restrito) só para gestor vinculado.
--
-- A exclusão continua DE VERDADE; um gatilho BEFORE DELETE tira um retrato completo (a linha e tudo o que sai junto em
-- cascata). Restaurar devolve as linhas com os gatilhos desligados (ALTER TABLE ... DISABLE TRIGGER USER: sem avisos nem
-- automações de novo) e refaz Google Agenda, histórico do cartão e um evento na auditoria. Não voltam: avisos e
-- esperas de automação. Exclusão em cascata e exclusão sem pessoa logada (scripts) não viram item próprio.
--
-- Diferenças do Painel: o JCN não tem tarefa sigilosa (gestao_tarefas_restritas), acesso restrito do Financeiro,
-- conta oculta nem schema_migrations; "restrita" aqui = lista com restrito = true. A limpeza dos 180 dias roda no
-- pg_cron ('gestao-lixeira-limpar', 1x por dia) em vez da rota do agendador. O Supabase não deixa a função ligar
-- session_replication_role para usuário comum (conferido em 11/11): a restauração desliga os gatilhos das tabelas.
--
-- REAPLICAR: não (cria a tabela). ROLLBACK: scripts/sql/v349_gestao_lixeira_rollback.sql

begin;

do $$ begin
  if to_regclass('public.gestao_lixeira') is not null then raise exception 'v349: gestao_lixeira já existe'; end if;
  if to_regprocedure('public.gestao_email()') is null or to_regprocedure('public.gestao_papel_de(text)') is null
     or to_regprocedure('public.gestao_pode_editar_q(text)') is null or to_regclass('public.gestao_google_fila') is null
     or to_regclass('public.auditoria_eventos') is null or to_regclass('public.auditoria_tabelas') is null then
    raise exception 'v349: faltam funções/tabelas da Gestão ou da auditoria';
  end if;
end $$;

-- A auditoria liga sozinha em tabela nova; aqui fica DESLIGADA de propósito: o retrato traz comentários inteiros (até
-- de tarefa sigilosa) e a exclusão já está na auditoria de gestao_tarefas/gestao_quadros. A restauração grava um
-- evento próprio (ver gestao_lixeira_restaurar).
insert into public.auditoria_tabelas (tabela, modulo, pk_colunas, coluna_titulo, ativo)
values ('gestao_lixeira', 'gestao_chabra', array['id'], 'titulo', false)
on conflict (tabela) do update set ativo = false;

create table public.gestao_lixeira (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('tarefa', 'quadro')),
  id_item text not null,                 -- id_tarefa ou id_quadro
  id_quadro text not null,               -- tarefa: a lista onde estava; lista: ela mesma
  id_tarefa_pai text,                    -- subtarefa aberta como cartão: a tarefa-mãe
  titulo text not null,
  nome_quadro text,
  excluida_por text,                     -- e-mail (minúsculas) de quem excluiu; null = sistema/serviço
  excluida_em timestamptz not null default now(),
  restrita boolean not null default false,
  pessoas text[] not null default '{}',  -- vinculados + criador (regra das sigilosas)
  dados jsonb not null                   -- {tabela: [linhas]}
);
create index gestao_lixeira_excluida_em_idx on public.gestao_lixeira (excluida_em);
create index gestao_lixeira_excluida_por_idx on public.gestao_lixeira (excluida_por);
alter table public.gestao_lixeira enable row level security;   -- sem política: só pelas funções abaixo
revoke all on public.gestao_lixeira from public, anon, authenticated;

-- E-mail de quem está logado, sem nunca dar erro (claims vazio ou ausente = sem login). Os gatilhos usam esta e não
-- gestao_email(): numa sessão de script o claims pode ficar '' e o ::jsonb quebraria a exclusão.
create or replace function public.gestao_lixeira_email()
returns text language sql stable set search_path = public as $fn$
  select nullif(lower(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email'), '')
$fn$;

-- Linhas de uma tabela (ou de duas colunas dela) para os ids dados, como jsonb.
create or replace function public.gestao_lixeira_linhas(p_tabela text, p_coluna text, p_ids text[], p_coluna2 text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare r jsonb;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return '[]'::jsonb; end if;
  if p_coluna2 is null then
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.%I = any($1)', p_tabela, p_coluna)
      into r using p_ids;
  else
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.%I = any($1) or x.%I = any($1)',
                   p_tabela, p_coluna, p_coluna2)
      into r using p_ids;
  end if;
  return r;
end $fn$;

-- Retrato de tarefas (com as filhas, em qualquer nível) e de tudo o que sai junto com elas.
create or replace function public.gestao_lixeira_retrato_tarefas(p_ids text[])
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_ids text[];
begin
  if p_ids is null or cardinality(p_ids) = 0 then return '{}'::jsonb; end if;
  with recursive d(id) as (
    select unnest(p_ids)
    union
    select t.id_tarefa from public.gestao_tarefas t join d on t.id_tarefa_pai = d.id
  )
  select array_agg(id) into v_ids from d;
  return jsonb_build_object(
    'gestao_tarefas',           public.gestao_lixeira_linhas('gestao_tarefas', 'id_tarefa', v_ids),
    'gestao_tarefa_vinculados', public.gestao_lixeira_linhas('gestao_tarefa_vinculados', 'id_tarefa', v_ids),
    'gestao_subtarefas',        public.gestao_lixeira_linhas('gestao_subtarefas', 'id_tarefa', v_ids, 'id_tarefa_filha'),
    'gestao_checklist_itens',   public.gestao_lixeira_linhas('gestao_checklist_itens', 'id_tarefa', v_ids),
    'gestao_comentarios',       public.gestao_lixeira_linhas('gestao_comentarios', 'id_tarefa', v_ids),
    'gestao_anexos',            public.gestao_lixeira_linhas('gestao_anexos', 'id_tarefa', v_ids),
    'gestao_aprovacoes',        public.gestao_lixeira_linhas('gestao_aprovacoes', 'id_tarefa', v_ids),
    'gestao_tempo',             public.gestao_lixeira_linhas('gestao_tempo', 'id_tarefa', v_ids),
    'gestao_tarefa_historico',  public.gestao_lixeira_linhas('gestao_tarefa_historico', 'id_tarefa', v_ids),
    'gestao_sla_avisos',        public.gestao_lixeira_linhas('gestao_sla_avisos', 'id_tarefa', v_ids),
    'gestao_dependencias',      public.gestao_lixeira_linhas('gestao_dependencias', 'id_tarefa', v_ids, 'depende_de'));
end $fn$;

create or replace function public.gestao_lixeira_tarefa_trg()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- Só a exclusão feita direto por uma PESSOA logada (tela). Cascata e automação dentro de gatilho não viram item
  -- próprio; exclusão sem login (sincronização noturna do Runrun, scripts) também não — ela tem o registro dela.
  if pg_trigger_depth() > 1 or public.gestao_lixeira_email() is null then return old; end if;
  insert into public.gestao_lixeira (tipo, id_item, id_quadro, id_tarefa_pai, titulo, nome_quadro, excluida_por, restrita, pessoas, dados)
  values (
    'tarefa', old.id_tarefa, old.id_quadro, old.id_tarefa_pai,
    coalesce(nullif(btrim(old.titulo), ''), '(sem título)'),
    (select q.nome from public.gestao_quadros q where q.id_quadro = old.id_quadro),
    public.gestao_lixeira_email(),
    coalesce((select q.restrito from public.gestao_quadros q where q.id_quadro = old.id_quadro), false),
    array(select distinct lower(e) from (
            select v.usuario_email as e from public.gestao_tarefa_vinculados v where v.id_tarefa = old.id_tarefa
            union all select old.created_by) z
          where e like '%@%'),
    public.gestao_lixeira_retrato_tarefas(array[old.id_tarefa]));
  return old;
end $fn$;

create or replace function public.gestao_lixeira_quadro_trg()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  q text[] := array[old.id_quadro];
  v_tarefas text[];
begin
  if pg_trigger_depth() > 1 or public.gestao_lixeira_email() is null then return old; end if;
  -- A tela só exclui lista vazia; se vier com tarefas (por outro caminho), elas vão junto no retrato.
  select array_agg(t.id_tarefa) into v_tarefas from public.gestao_tarefas t where t.id_quadro = old.id_quadro and t.id_tarefa_pai is null;
  insert into public.gestao_lixeira (tipo, id_item, id_quadro, titulo, nome_quadro, excluida_por, restrita, pessoas, dados)
  values (
    'quadro', old.id_quadro, old.id_quadro,
    coalesce(nullif(btrim(old.nome), ''), '(lista sem nome)'), old.nome,
    public.gestao_lixeira_email(),
    coalesce(old.restrito, false),
    case when old.dono_email like '%@%' then array[lower(old.dono_email)] else '{}'::text[] end,
    jsonb_build_object(
      'gestao_quadros',              jsonb_build_array(to_jsonb(old)),
      'gestao_status',               public.gestao_lixeira_linhas('gestao_status', 'id_quadro', q),
      'gestao_campos',               public.gestao_lixeira_linhas('gestao_campos', 'id_quadro', q),
      'gestao_etiquetas',            public.gestao_lixeira_linhas('gestao_etiquetas', 'id_quadro', q),
      'gestao_automacoes',           public.gestao_lixeira_linhas('gestao_automacoes', 'id_quadro', q),
      'gestao_formularios',          public.gestao_lixeira_linhas('gestao_formularios', 'id_quadro', q),
      'gestao_acessos',              public.gestao_lixeira_linhas('gestao_acessos', 'id_quadro', q),
      'gestao_sla_quadros',          public.gestao_lixeira_linhas('gestao_sla_quadros', 'id_quadro', q),
      'gestao_subtarefa_modelos',    public.gestao_lixeira_linhas('gestao_subtarefa_modelos', 'id_quadro', q),
      'gestao_produto_responsaveis', public.gestao_lixeira_linhas('gestao_produto_responsaveis', 'id_quadro', q),
      'gestao_etapa_avisos',         public.gestao_lixeira_linhas('gestao_etapa_avisos', 'id_quadro', q),
      'gestao_filtros_salvos',       public.gestao_lixeira_linhas('gestao_filtros_salvos', 'id_quadro', q),
      'gestao_preferencias_visao',   public.gestao_lixeira_linhas('gestao_preferencias_visao', 'id_quadro', q))
    || jsonb_build_object('tarefas', public.gestao_lixeira_retrato_tarefas(v_tarefas)));
  return old;
end $fn$;

-- "zz_": roda DEPOIS dos outros BEFORE DELETE (trava de OS, proteção do Meu Quadro) — se um deles barrar, nada é
-- retratado (e, de qualquer forma, tudo volta junto com o erro).
create trigger zz_gestao_lixeira before delete on public.gestao_tarefas
  for each row execute function public.gestao_lixeira_tarefa_trg();
create trigger zz_gestao_lixeira before delete on public.gestao_quadros
  for each row execute function public.gestao_lixeira_quadro_trg();

-- Quem vê um item da lixeira (a mesma regra na lista e na restauração).
create or replace function public.gestao_lixeira_ve(p_excluida_por text, p_restrita boolean, p_pessoas text[])
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare v_email text := public.gestao_email();
begin
  if v_email is null then return false; end if;
  if p_excluida_por = v_email then return true; end if;
  if coalesce(public.gestao_papel_de(v_email)::text, '') not in ('owner', 'admin') then return false; end if;
  return not p_restrita or v_email = any(p_pessoas);
end $fn$;

-- Insere as linhas guardadas numa tabela: só as colunas que existem hoje E vieram no retrato (coluna nova depois da
-- exclusão fica com o padrão dela; coluna que deixou de existir é ignorada).
create or replace function public.gestao_lixeira_inserir(p_tabela text, p_linhas jsonb)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  v_cols text;
  n integer;
begin
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then return 0; end if;
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
   where a.attrelid = ('public.' || quote_ident(p_tabela))::regclass and a.attnum > 0 and not a.attisdropped
     and a.attgenerated = '' and p_linhas -> 0 ? a.attname;
  if v_cols is null then return 0; end if;
  execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I, $1)',
                 p_tabela, v_cols, v_cols, p_tabela) using p_linhas;
  get diagnostics n = row_count;
  return n;
end $fn$;

-- JCN: o Supabase não deixa uma função chamada por usuário comum ligar session_replication_role. Em vez disso, a
-- restauração desliga os gatilhos de usuário só das tabelas que recebe (as funções são do dono das tabelas) e religa no
-- fim — tudo na mesma transação: com erro, volta junto; quem estiver gravando nessas tabelas espera o fim (segundos).
-- As chaves estrangeiras continuam valendo, então as referências que sumiram são limpas ANTES de inserir.
create or replace function public.gestao_lixeira_gatilhos(p_ligar boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare t text;
begin
  foreach t in array array['gestao_tarefas', 'gestao_tarefa_vinculados', 'gestao_subtarefas', 'gestao_checklist_itens',
                           'gestao_comentarios', 'gestao_anexos', 'gestao_aprovacoes', 'gestao_tempo', 'gestao_tarefa_historico',
                           'gestao_sla_avisos', 'gestao_dependencias', 'gestao_quadros', 'gestao_status', 'gestao_campos',
                           'gestao_etiquetas', 'gestao_automacoes', 'gestao_formularios', 'gestao_acessos', 'gestao_sla_quadros',
                           'gestao_subtarefa_modelos', 'gestao_produto_responsaveis', 'gestao_etapa_avisos',
                           'gestao_filtros_salvos', 'gestao_preferencias_visao'] loop
    execute format('alter table public.%I %s trigger user', t, case when p_ligar then 'enable' else 'disable' end);
  end loop;
end $fn$;

-- Linhas do retrato com a coluna apontando para algo que não existe mais: a coluna vira null.
create or replace function public.gestao_lixeira_sem_ref(p_linhas jsonb, p_col text, p_tabela text, p_pk text)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare r jsonb; v jsonb := '[]'::jsonb; ok boolean;
begin
  for r in select x from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) x loop
    if r ->> p_col is not null then
      execute format('select exists (select 1 from public.%I where %I::text = $1)', p_tabela, p_pk) into ok using r ->> p_col;
      if not ok then r := jsonb_set(r, array[p_col], 'null'::jsonb); end if;
    end if;
    v := v || jsonb_build_array(r);
  end loop;
  return v;
end $fn$;

-- Só as linhas cuja coluna é nula ou aponta para algo que existe.
create or replace function public.gestao_lixeira_com_ref(p_linhas jsonb, p_col text, p_tabela text, p_pk text)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare r jsonb; v jsonb := '[]'::jsonb; ok boolean;
begin
  for r in select x from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) x loop
    ok := true;
    if r ->> p_col is not null then
      execute format('select exists (select 1 from public.%I where %I::text = $1)', p_tabela, p_pk) into ok using r ->> p_col;
    end if;
    if ok then v := v || jsonb_build_array(r); end if;
  end loop;
  return v;
end $fn$;

-- Devolve as tarefas de um retrato (gatilhos desligados pelo chamador). Ajusta o que apontava para algo que não
-- existe mais (empresa, unidade, dependência com tarefa de fora).
create or replace function public.gestao_lixeira_devolver_tarefas(p jsonb)
returns text[] language plpgsql security definer set search_path = public as $fn$
declare
  v_ids text[];
  v_tab text;
begin
  if p is null or not (p ? 'gestao_tarefas') or jsonb_array_length(p -> 'gestao_tarefas') = 0 then return '{}'::text[]; end if;
  select array_agg(r ->> 'id_tarefa') into v_ids from jsonb_array_elements(p -> 'gestao_tarefas') r;
  if exists (select 1 from public.gestao_tarefas t where t.id_tarefa = any(v_ids)) then
    raise exception 'Uma tarefa com o mesmo código já existe de novo; nada foi restaurado.';
  end if;
  perform public.gestao_lixeira_inserir('gestao_tarefas',
    public.gestao_lixeira_sem_ref(public.gestao_lixeira_sem_ref(p -> 'gestao_tarefas', 'id_empresa', 'empresas', 'id_empresa'),
                                  'id_unidade', 'gestao_unidades', 'id_unidade'));
  update public.gestao_tarefas t set id_empresa = null
   where t.id_tarefa = any(v_ids) and t.id_empresa is not null and not exists (select 1 from public.empresas e where e.id_empresa = t.id_empresa);
  update public.gestao_tarefas t set id_unidade = null
   where t.id_tarefa = any(v_ids) and t.id_unidade is not null and not exists (select 1 from public.gestao_unidades u where u.id_unidade = t.id_unidade);
  foreach v_tab in array array['gestao_tarefa_vinculados', 'gestao_checklist_itens',
                               'gestao_comentarios', 'gestao_anexos', 'gestao_aprovacoes', 'gestao_tempo', 'gestao_tarefa_historico',
                               'gestao_sla_avisos'] loop
    perform public.gestao_lixeira_inserir(v_tab, p -> v_tab);
  end loop;
  -- JCN: subtarefa e dependência só se as tarefas das duas pontas existem (as chaves estrangeiras valem aqui).
  perform public.gestao_lixeira_inserir('gestao_subtarefas',
    public.gestao_lixeira_com_ref(public.gestao_lixeira_com_ref(p -> 'gestao_subtarefas', 'id_tarefa', 'gestao_tarefas', 'id_tarefa'),
                                  'id_tarefa_filha', 'gestao_tarefas', 'id_tarefa'));
  perform public.gestao_lixeira_inserir('gestao_dependencias',
    public.gestao_lixeira_com_ref(public.gestao_lixeira_com_ref(p -> 'gestao_dependencias', 'id_tarefa', 'gestao_tarefas', 'id_tarefa'),
                                  'depende_de', 'gestao_tarefas', 'id_tarefa'));
  -- linha de subtarefa (na mãe) ou dependência que aponta para tarefa que não existe mais
  delete from public.gestao_subtarefas s
   where (s.id_tarefa = any(v_ids) or s.id_tarefa_filha = any(v_ids))
     and (not exists (select 1 from public.gestao_tarefas t where t.id_tarefa = s.id_tarefa)
          or (s.id_tarefa_filha is not null and not exists (select 1 from public.gestao_tarefas t where t.id_tarefa = s.id_tarefa_filha)));
  delete from public.gestao_dependencias d
   where (d.id_tarefa = any(v_ids) or d.depende_de = any(v_ids))
     and (not exists (select 1 from public.gestao_tarefas t where t.id_tarefa = d.id_tarefa)
          or not exists (select 1 from public.gestao_tarefas t where t.id_tarefa = d.depende_de));
  -- Espelho gestao_tarefas.subtarefas (o mesmo cálculo do gatilho gestao_subtarefa_espelho_trg, que está desligado
  -- aqui): a mãe de uma subtarefa restaurada sozinha ganha a linha de volta na barrinha do cartão.
  update public.gestao_tarefas t
     set subtarefas = coalesce((select jsonb_agg(jsonb_build_object('texto', s.texto, 'feito', s.feito) order by s.ordem, s.created_at)
                                  from public.gestao_subtarefas s where s.id_tarefa = t.id_tarefa), '[]'::jsonb)
   where t.id_tarefa = any(v_ids)
      or t.id_tarefa in (select r ->> 'id_tarefa' from jsonb_array_elements(coalesce(p -> 'gestao_subtarefas', '[]'::jsonb)) r);
  return v_ids;
end $fn$;

create or replace function public.gestao_lixeira_restaurar(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  e public.gestao_lixeira%rowtype;
  v_email text := public.gestao_email();
  v_gestor boolean;
  v_ids text[] := '{}';
  v_tab text;
begin
  if v_email is null then raise exception 'Faça login de novo para restaurar.'; end if;
  select * into e from public.gestao_lixeira where id = p_id for update;
  if not found then raise exception 'Este item não está mais na Lixeira (já foi restaurado?).'; end if;
  if not public.gestao_lixeira_ve(e.excluida_por, e.restrita, e.pessoas) then
    raise exception 'Você não pode restaurar este item.';
  end if;
  v_gestor := coalesce(public.gestao_papel_de(v_email)::text, '') in ('owner', 'admin');

  if e.tipo = 'tarefa' then
    if not exists (select 1 from public.gestao_quadros q where q.id_quadro = e.id_quadro) then
      raise exception 'A lista "%" não existe mais. Restaure a lista primeiro (veja se ela está na Lixeira).', coalesce(e.nome_quadro, e.id_quadro);
    end if;
    if e.id_tarefa_pai is not null and not exists (select 1 from public.gestao_tarefas t where t.id_tarefa = e.id_tarefa_pai) then
      raise exception 'A tarefa-mãe desta subtarefa não existe mais. Restaure a tarefa-mãe primeiro.';
    end if;
    if not v_gestor and not public.gestao_pode_editar_q(e.id_quadro) then
      raise exception 'Você não pode mais editar a lista "%". Peça a um gestor para restaurar.', coalesce(e.nome_quadro, e.id_quadro);
    end if;
  else
    if exists (select 1 from public.gestao_quadros q where q.id_quadro = e.id_quadro) then
      raise exception 'Já existe uma lista com o mesmo código; nada foi restaurado.';
    end if;
  end if;

  -- Gatilhos desligados só durante a devolução (na mesma transação: com erro, voltam junto).
  perform public.gestao_lixeira_gatilhos(false);
  if e.tipo = 'tarefa' then
    v_ids := public.gestao_lixeira_devolver_tarefas(e.dados);
  else
    perform public.gestao_lixeira_inserir('gestao_quadros',
      public.gestao_lixeira_sem_ref(public.gestao_lixeira_sem_ref(public.gestao_lixeira_sem_ref(e.dados -> 'gestao_quadros',
        'id_espaco', 'gestao_espacos', 'id'), 'id_pasta', 'gestao_pastas', 'id'), 'id_unidade', 'gestao_unidades', 'id_unidade'));
    update public.gestao_quadros q set id_espaco = null
     where q.id_quadro = e.id_quadro and q.id_espaco is not null and not exists (select 1 from public.gestao_espacos s where s.id = q.id_espaco);
    update public.gestao_quadros q set id_pasta = null
     where q.id_quadro = e.id_quadro and q.id_pasta is not null and not exists (select 1 from public.gestao_pastas s where s.id = q.id_pasta);
    update public.gestao_quadros q set id_unidade = null
     where q.id_quadro = e.id_quadro and q.id_unidade is not null and not exists (select 1 from public.gestao_unidades u where u.id_unidade = q.id_unidade);
    perform public.gestao_lixeira_inserir('gestao_acessos',
      public.gestao_lixeira_com_ref(e.dados -> 'gestao_acessos', 'id_equipe', 'gestao_equipes', 'id'));
    foreach v_tab in array array['gestao_status', 'gestao_campos', 'gestao_etiquetas', 'gestao_automacoes', 'gestao_formularios',
                                 'gestao_sla_quadros', 'gestao_subtarefa_modelos', 'gestao_produto_responsaveis',
                                 'gestao_etapa_avisos', 'gestao_filtros_salvos', 'gestao_preferencias_visao'] loop
      perform public.gestao_lixeira_inserir(v_tab, e.dados -> v_tab);
    end loop;
    delete from public.gestao_acessos a
     where a.id_quadro = e.id_quadro and a.id_equipe is not null and not exists (select 1 from public.gestao_equipes g where g.id = a.id_equipe);
    v_ids := public.gestao_lixeira_devolver_tarefas(e.dados -> 'tarefas');
  end if;
  perform public.gestao_lixeira_gatilhos(true);

  -- O que deve acontecer de novo: Google Agenda, histórico e auditoria.
  insert into public.gestao_google_fila (id_tarefa, operacao)
  select t.id_tarefa, 'upsert' from public.gestao_tarefas t where t.id_tarefa = any(v_ids) and t.prazo is not null;
  -- Histórico do cartão (gestao_atividades — não sai na exclusão, então o que havia continua lá): "excluiu" na hora em
  -- que foi para a Lixeira e "restaurou da Lixeira" agora. Na lista: em cada tarefa que voltou com ela; filhas não.
  insert into public.gestao_atividades (id, ator, acao, id_tarefa, payload, created_at)
  select gen_random_uuid(), x.ator, x.acao, t.id_tarefa, x.payload, x.quando
    from public.gestao_tarefas t
   cross join (values (e.excluida_por, 'excluida', jsonb_build_object('lixeira', true), e.excluida_em),
                      (v_email, 'restaurada', jsonb_build_object('excluida_em', e.excluida_em), now())) x(ator, acao, payload, quando)
   where t.id_tarefa = any(v_ids) and (case when e.tipo = 'tarefa' then t.id_tarefa = e.id_item else t.id_tarefa_pai is null end);
  insert into public.auditoria_eventos (tabela, registro_id, acao, modulo, titulo, usuario_email, usuario_role, campos_alterados, depois)
  values (case when e.tipo = 'tarefa' then 'gestao_tarefas' else 'gestao_quadros' end, e.id_item, 'criou', 'gestao_chabra', e.titulo,
          v_email, 'authenticated', array['restaurada_da_lixeira'],
          jsonb_build_object('restaurada_da_lixeira', true, 'excluida_por', e.excluida_por, 'excluida_em', e.excluida_em,
                             'tarefas', cardinality(v_ids)));

  delete from public.gestao_lixeira where id = p_id;
  return jsonb_build_object('tipo', e.tipo, 'id_item', e.id_item, 'id_quadro', e.id_quadro, 'titulo', e.titulo, 'tarefas', cardinality(v_ids));
end $fn$;

-- O que a pessoa vê na Lixeira (mais novos primeiro). Nome de quem excluiu segue a regra de usuarios (conta oculta
-- aparece como "Outra pessoa").
create or replace function public.gestao_lixeira_listar()
returns table (id uuid, tipo text, id_item text, id_quadro text, titulo text, nome_quadro text, quadro_existe boolean,
               mae_existe boolean, excluida_por_nome text, minha boolean, excluida_em timestamptz, expira_em timestamptz,
               n_subtarefas integer, n_comentarios integer, n_anexos integer, n_tarefas integer, pode_restaurar boolean)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_email text := public.gestao_email();
  v_gestor boolean;
begin
  if v_email is null then return; end if;
  v_gestor := coalesce(public.gestao_papel_de(v_email)::text, '') in ('owner', 'admin');
  return query
  select l.id, l.tipo, l.id_item, l.id_quadro, l.titulo, coalesce(qq.nome, l.nome_quadro),
         qq.id_quadro is not null,
         l.id_tarefa_pai is null or exists (select 1 from public.gestao_tarefas t where t.id_tarefa = l.id_tarefa_pai),
         case when l.excluida_por = v_email then 'você'
              when l.excluida_por is null then 'Sistema'
              when u.email is not null then coalesce(nullif(u.nome, ''), u.email)
              else 'Outra pessoa' end,
         l.excluida_por = v_email,
         l.excluida_em, l.excluida_em + interval '180 days',
         greatest(coalesce(jsonb_array_length(t_dados -> 'gestao_tarefas'), 0) - 1, 0)
           + coalesce((select count(*)::int from jsonb_array_elements(coalesce(t_dados -> 'gestao_subtarefas', '[]')) s
                        where s ->> 'id_tarefa_filha' is null), 0),
         coalesce(jsonb_array_length(t_dados -> 'gestao_comentarios'), 0),
         coalesce(jsonb_array_length(t_dados -> 'gestao_anexos'), 0),
         case when l.tipo = 'quadro' then coalesce(jsonb_array_length(l.dados -> 'tarefas' -> 'gestao_tarefas'), 0) else 0 end,
         case when l.tipo = 'quadro' then qq.id_quadro is null
              else qq.id_quadro is not null
                   and (l.id_tarefa_pai is null or exists (select 1 from public.gestao_tarefas t where t.id_tarefa = l.id_tarefa_pai))
                   and (v_gestor or public.gestao_pode_editar_q(l.id_quadro)) end
    from public.gestao_lixeira l
    cross join lateral (select case when l.tipo = 'tarefa' then l.dados else '{}'::jsonb end as t_dados) td
    left join public.gestao_quadros qq on qq.id_quadro = l.id_quadro
    left join public.usuarios u on lower(u.email) = l.excluida_por
   where public.gestao_lixeira_ve(l.excluida_por, l.restrita, l.pessoas)
   order by l.excluida_em desc
   limit 500;
end $fn$;

-- 180 dias: chamada pelo pg_cron 'gestao-lixeira-limpar' (abaixo), 1x por dia.
create or replace function public.gestao_lixeira_limpar()
returns integer language sql security definer set search_path = public as $fn$
  with d as (delete from public.gestao_lixeira where excluida_em < now() - interval '180 days' returning 1)
  select count(*)::int from d
$fn$;

revoke all on function public.gestao_lixeira_email() from public, anon, authenticated;
revoke all on function public.gestao_lixeira_linhas(text, text, text[], text) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_retrato_tarefas(text[]) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_tarefa_trg() from public, anon, authenticated;
revoke all on function public.gestao_lixeira_quadro_trg() from public, anon, authenticated;
revoke all on function public.gestao_lixeira_ve(text, boolean, text[]) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_inserir(text, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_gatilhos(boolean) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_sem_ref(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_com_ref(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_devolver_tarefas(jsonb) from public, anon, authenticated;
revoke all on function public.gestao_lixeira_restaurar(uuid) from public, anon;
revoke all on function public.gestao_lixeira_listar() from public, anon;
revoke all on function public.gestao_lixeira_limpar() from public, anon, authenticated;
grant execute on function public.gestao_lixeira_restaurar(uuid) to authenticated;
grant execute on function public.gestao_lixeira_listar() to authenticated;
grant execute on function public.gestao_lixeira_limpar() to service_role;

-- Limpeza diária dos itens com mais de 180 dias (03:17 UTC).
select cron.schedule('gestao-lixeira-limpar', '17 3 * * *', 'select public.gestao_lixeira_limpar()');

notify pgrst, 'reload schema';

commit;
notify pgrst, 'reload schema';
