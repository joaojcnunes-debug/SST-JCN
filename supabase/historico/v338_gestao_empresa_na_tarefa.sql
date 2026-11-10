-- v338 — Gestão: tarefa ligada à Empresa do cadastro (10/11/2026, 0.3.264).
--
-- Trazido da v354 do Painel SST (0.3.923), SÓ o item 11 (empresa na tarefa). O item 13 (modelos de tarefa) não veio.
-- Motivo no JCN: a página Agenda (0.3.263) precisa mostrar a EMPRESA de cada atividade — a da tarefa ou, numa
-- subtarefa, a da tarefa-mãe.
--   • gestao_tarefas.id_empresa (FK empresas, ON DELETE SET NULL — apagar a empresa só solta as tarefas).
--   • Gatilho gestao_tarefa_empresa: tarefa que nasce de automação com origem.id_empresa já vem ligada; quem liga à
--     mão precisa enxergar a empresa (caller_pode_ver_empresa, a regra da tela de Empresas).
--   • gestao_empresa_sugerida(tarefa): sugere pelo CNPJ ou pelo nome no título (a pessoa confirma; nada é gravado).
--     Nomes tratados na view materializada gestao_empresa_nomes, refeita a cada 15 min pelo /api/gestao/google/sync.
--   • gestao_tarefas_da_empresa(empresa): aba Tarefas da ficha da empresa (SECURITY INVOKER: a RLS da Gestão decide).
-- Diferença do Painel: o JCN não tem schema_migrations (o registro é este arquivo).
--
-- Rollback: scripts/sql/v338_gestao_empresa_na_tarefa_rollback.sql
begin;

do $$ begin
  if to_regclass('public.empresas') is null or to_regclass('public.gestao_tarefas') is null
     or to_regclass('public.gestao_quadros') is null or to_regclass('public.gestao_status') is null then
    raise exception 'v338: faltam tabelas (empresas / gestao_*)';
  end if;
  if to_regprocedure('public.caller_pode_ver_empresa(text)') is null then raise exception 'v338: falta caller_pode_ver_empresa(text)'; end if;
  if to_regprocedure('public.gestao_pode_ver(text)') is null or to_regprocedure('public.gestao_ve_tarefa(text)') is null then
    raise exception 'v338: faltam gestao_pode_ver(text) / gestao_ve_tarefa(text)';
  end if;
end $$;

-- ═══ 11. Empresa na tarefa ═══════════════════════════════════════════════════════════════════════════════════
alter table public.gestao_tarefas add column if not exists id_empresa text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gestao_tarefas_id_empresa_fkey' and conrelid = 'public.gestao_tarefas'::regclass) then
    alter table public.gestao_tarefas
      add constraint gestao_tarefas_id_empresa_fkey foreign key (id_empresa) references public.empresas(id_empresa) on delete set null;
  end if;
end $$;
create index if not exists idx_gestao_tarefas_empresa on public.gestao_tarefas (id_empresa) where id_empresa is not null;
comment on column public.gestao_tarefas.id_empresa is
  'v338: empresa do cadastro (empresas). Ligada à mão (só quem vê a empresa), pela sugestão confirmada ou, na criação, por origem.id_empresa (automação de SST).';

create or replace function public.gestao_tarefa_empresa_trg() returns trigger
  language plpgsql security definer set search_path = public as $fn$
begin
  -- Nasceu de automação de SST: a origem já diz a empresa (só vale se ela existe).
  if tg_op = 'INSERT' and new.id_empresa is null and jsonb_typeof(new.origem) = 'object' and new.origem ? 'id_empresa' then
    select e.id_empresa into new.id_empresa from public.empresas e where e.id_empresa = new.origem ->> 'id_empresa';
  end if;
  -- Ligação feita pela pessoa (login de usuário, fora de gatilho e de automação): precisa enxergar a empresa.
  if new.id_empresa is not null
     and (tg_op = 'INSERT' or new.id_empresa is distinct from old.id_empresa)
     and pg_trigger_depth() = 1
     and coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' = 'authenticated'
     and coalesce(current_setting('gestao.autom_depth', true), '') !~ '^[1-9]'
     and not public.caller_pode_ver_empresa(new.id_empresa) then
    raise exception 'Você não tem acesso a esta empresa.' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists gestao_tarefa_empresa on public.gestao_tarefas;
create trigger gestao_tarefa_empresa before insert or update of id_empresa on public.gestao_tarefas
  for each row execute function public.gestao_tarefa_empresa_trg();

-- Texto para comparar nomes: sem acento, maiúsculo, só letras/números, palavras separadas por um espaço e com espaço
-- nas pontas (para casar palavra inteira com position()). p_sufixo tira LTDA/ME/EPP/EIRELI/SA/MEI/SS do fim (nomes).
-- Uma expressão só e SEM "set search_path" (só usa funções do pg_catalog): assim o planner a embute na consulta — a
-- primeira versão (com WITH) não era embutida e a sugestão levava ~0,34 s (18 mil chamadas por tarefa).
create or replace function public.gestao_norm_nome(p text, p_sufixo boolean default false) returns text
  language sql immutable parallel safe as $fn$
  select ' ' || btrim(case when p_sufixo
    then regexp_replace(btrim(regexp_replace(upper(translate(coalesce(p, ''),
           'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
           '[^A-Z0-9]+', ' ', 'g')), '( (LTDA|ME|EPP|EIRELI|S A|SA|MEI|SS))+$', '')
    else regexp_replace(upper(translate(coalesce(p, ''),
           'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
           '[^A-Z0-9]+', ' ', 'g')
  end) || ' '
$fn$;

-- Nomes das empresas já tratados (o tratamento de ~8.900 nomes custa ~0,2 s; feito a cada sugestão deixava cada uma
-- em ~0,4 s). "generico": nome de UMA palavra que aparece no nome de 3+ empresas (ex.: ODONTOLOGICA) — não sugere.
-- Refeita a cada 15 min pelo agendador da Gestão (/api/gestao/google/sync → gestao_empresa_nomes_atualizar). Empresa
-- nova entra na próxima; o CNPJ é lido na hora, direto de empresas. Só as funções abaixo leem (sem acesso pela API).
create materialized view if not exists public.gestao_empresa_nomes as
  with n as (
    select e.id_empresa, x.n
      from public.empresas e
     cross join lateral (
       select distinct public.gestao_norm_nome(v, true) as n
         from unnest(array[e.nome_empresa, e.razao_social, e.nome_fantasia]) v
     ) x
     where length(btrim(x.n)) >= 6
  ),
  tokens as (
    select t.tok, count(distinct n.id_empresa) as qtd
      from n cross join lateral unnest(string_to_array(btrim(n.n), ' ')) t(tok)
     group by 1
  )
  select n.id_empresa, n.n,
         (btrim(n.n) !~ ' ' and coalesce(k.qtd, 0) >= 3) as generico,
         now() as atualizado_em
    from n
    left join tokens k on k.tok = btrim(n.n)
  with data;
create unique index if not exists gestao_empresa_nomes_uk on public.gestao_empresa_nomes (id_empresa, n);
revoke all on public.gestao_empresa_nomes from public, anon, authenticated;

create or replace function public.gestao_empresa_nomes_atualizar(p_forcar boolean default false) returns boolean
  language plpgsql security definer set search_path = public as $fn$
begin
  if not p_forcar
     and coalesce((select max(g.atualizado_em) from public.gestao_empresa_nomes g), '-infinity'::timestamptz) > now() - interval '15 minutes' then
    return false;
  end if;
  if not pg_try_advisory_xact_lock(hashtext('gestao_empresa_nomes')) then return false; end if;
  -- Sem CONCURRENTLY: no ensaio o concorrente levou 3,3 s (todas as linhas mudam por causa de atualizado_em); o simples
  -- é bem mais leve e só segura uma sugestão por uma fração de segundo, a cada 15 min.
  refresh materialized view public.gestao_empresa_nomes;
  return true;
end $fn$;
revoke all on function public.gestao_empresa_nomes_atualizar(boolean) from public, anon, authenticated;
grant execute on function public.gestao_empresa_nomes_atualizar(boolean) to service_role;

create or replace function public.gestao_empresa_sugerida(p_id_tarefa text)
returns table (id_empresa text, nome text, municipio text, por text)
  language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_t record;
  v_tit text;
  v_cnpjs text[];
begin
  select t.id_tarefa, t.titulo, t.id_empresa, t.id_quadro into v_t from public.gestao_tarefas t where t.id_tarefa = p_id_tarefa;
  if v_t.id_tarefa is null or v_t.id_empresa is not null then return; end if;
  if not (coalesce(public.gestao_pode_ver(v_t.id_quadro), false) and coalesce(public.gestao_ve_tarefa(v_t.id_tarefa), false)) then return; end if;

  -- 1º CNPJ escrito no título (com ou sem pontuação): é exato.
  select array_agg(m[1] || m[2] || m[3] || m[4] || m[5]) into v_cnpjs
    from regexp_matches(coalesce(v_t.titulo, ''), '(\d{2})\.?(\d{3})\.?(\d{3})/?(\d{4})-?(\d{2})', 'g') m;
  if v_cnpjs is not null then
    return query
      select e.id_empresa, coalesce(nullif(btrim(e.nome_fantasia), ''), e.nome_empresa), e.municipio, 'cnpj'::text
        from public.empresas e
       where regexp_replace(coalesce(e.cnpj, ''), '\D', '', 'g') = any (v_cnpjs)
         and public.caller_pode_ver_empresa(e.id_empresa)
       limit 3;
    if found then return; end if;
  end if;

  -- 2º Nome no título (palavra inteira), pelos nomes já tratados.
  v_tit := public.gestao_norm_nome(v_t.titulo);
  return query
    with casou as (
      select g.id_empresa, max(length(g.n)) as tam
        from public.gestao_empresa_nomes g
       where not g.generico and position(g.n in v_tit) > 0
       group by 1
    )
    select e.id_empresa, coalesce(nullif(btrim(e.nome_fantasia), ''), e.nome_empresa), e.municipio, 'nome'::text
      from casou c join public.empresas e on e.id_empresa = c.id_empresa
     where (select count(*) from casou) <= 3
       and public.caller_pode_ver_empresa(e.id_empresa)
     order by c.tam desc;
end $fn$;

create or replace function public.gestao_tarefas_da_empresa(p_id_empresa text)
returns table (id_tarefa text, titulo text, id_quadro text, quadro text, status text, status_nome text, status_cor text,
               concluida boolean, prazo date, prioridade text, responsavel text, created_at timestamptz)
  language sql stable security invoker set search_path = public as $fn$
  select t.id_tarefa, t.titulo, t.id_quadro, q.nome, t.status, s.nome, s.cor,
         coalesce(s.tipo = 'concluido', false), t.prazo, t.prioridade, t.responsavel, t.created_at
    from public.gestao_tarefas t
    left join public.gestao_quadros q on q.id_quadro = t.id_quadro
    left join public.gestao_status s on s.id_quadro = t.id_quadro and s.slug = t.status
   where t.id_empresa = p_id_empresa
     and t.id_tarefa_pai is null
   order by coalesce(s.tipo = 'concluido', false), t.prazo nulls last, t.created_at desc
   limit 300
$fn$;

revoke all on function public.gestao_empresa_sugerida(text) from public, anon;
revoke all on function public.gestao_tarefas_da_empresa(text) from public, anon;
revoke all on function public.gestao_tarefa_empresa_trg() from public, anon, authenticated;
grant execute on function public.gestao_empresa_sugerida(text) to authenticated;
grant execute on function public.gestao_tarefas_da_empresa(text) to authenticated;
grant execute on function public.gestao_norm_nome(text, boolean) to authenticated;


notify pgrst, 'reload schema';

commit;
