-- v263 — Dimensionamento deixa de ser só do Admin (pedido de 2026-09-28).
--
--   Admin        → tudo.
--   Gerente      → lê tudo (Headcount, Cadastros, Histórico); não grava nada.
--   Supervisores → Cadastros: lê e grava (criar/editar/excluir). A tela não
--                  mostra Headcount nem Histórico para eles — os dados vêm das
--                  mesmas tabelas, então essa parte é trava de TELA.
--   Sincronização com a API externa → continua só do Admin.
--
-- O papel vem de usuarios.funcao (Sistema › Funções). Mesma regra no cliente
-- em lib/dimensionamento/permissoes.ts — se mudar aqui, mude lá.
--
-- Antes (v249): policy `dim_admin` = caller_eh_admin() em todas as 12 tabelas.
-- Rollback: scripts/sql/v263_rollback_dimensionamento_gerente_supervisor.sql

begin;

create or replace function public.dim_papel()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
           when u.perfil = 'Admin' then 'admin'
           when u.funcao = 'Gerente' then 'gerente'
           when u.funcao in ('Supervisor dos técnicos', 'Supervisora do administrativo') then 'supervisor'
         end
    from public.usuarios u
   where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and u.ativo_sistema = true
   limit 1
$$;

create or replace function public.dim_pode_ver()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.dim_papel() is not null, false) $$;

create or replace function public.dim_pode_editar()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.dim_papel() in ('admin', 'supervisor'), false) $$;

comment on function public.dim_papel() is
  'Papel no Dimensionamento: admin | gerente | supervisor | null (v263).';

-- Tabelas de cadastro: gerente lê; admin e supervisor gravam.
do $$
declare t text;
begin
  foreach t in array array[
    'dim_unidades', 'dim_funcoes', 'dim_colaboradores', 'dim_colaborador_unidades',
    'dim_demanda_mensal', 'dim_unidade_mes', 'dim_clientes_porte', 'dim_portes',
    'dim_parametros', 'dim_documentos'
  ] loop
    execute format('drop policy if exists dim_admin on public.%I', t);
    execute format('drop policy if exists dim_ler on public.%I', t);
    execute format('drop policy if exists dim_gravar on public.%I', t);
    execute format('create policy dim_ler on public.%I for select to authenticated using (public.dim_pode_ver())', t);
    execute format('create policy dim_gravar on public.%I for all to authenticated using (public.dim_pode_editar()) with check (public.dim_pode_editar())', t);
  end loop;
end $$;

-- Sincronização: todos que entram leem; só o Admin grava.
drop policy if exists dim_admin on public.dim_sincronizacao_sst;
drop policy if exists dim_ler on public.dim_sincronizacao_sst;
drop policy if exists dim_gravar on public.dim_sincronizacao_sst;
create policy dim_ler on public.dim_sincronizacao_sst
  for select to authenticated using (public.dim_pode_ver());
create policy dim_gravar on public.dim_sincronizacao_sst
  for all to authenticated
  using (coalesce(public.caller_eh_admin(), false))
  with check (coalesce(public.caller_eh_admin(), false));

-- Histórico: só leitura (quem grava é o gatilho SECURITY DEFINER).
drop policy if exists dim_admin on public.dim_historico;
drop policy if exists dim_ler on public.dim_historico;
create policy dim_ler on public.dim_historico
  for select to authenticated using (public.dim_pode_ver());

-- RPCs de gravação dos cadastros: admin OU supervisor (o corpo segue igual).
do $$
declare f text; def text;
begin
  foreach f in array array['dim_definir_alocacoes', 'dim_substituir_demanda_ano'] loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f;
    if def is null or position('coalesce(public.caller_eh_admin(), false)' in def) = 0 then
      raise exception 'v263: % não tem a guarda esperada — revisar antes de aplicar', f;
    end if;
    def := replace(def, 'coalesce(public.caller_eh_admin(), false)', 'coalesce(public.dim_pode_editar(), false)');
    def := replace(def, 'Só administradores alteram o dimensionamento.', 'Sem permissão para alterar o dimensionamento.');
    execute def;
  end loop;
end $$;

-- Prova dentro da transação
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename like 'dim\_%' and policyname = 'dim_admin') then
    raise exception 'v263: sobrou policy dim_admin';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename like 'dim\_%') <> 23 then
    raise exception 'v263: esperava 23 policies nas tabelas dim_*';
  end if;
end $$;

commit;
