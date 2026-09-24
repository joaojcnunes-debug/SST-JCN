-- v241 — SGG-RISCOS-01 fase 1: vínculo empresa↔SGG, capability pode_enviar_sgg, tabela sgg_envios.
-- Só banco. Nenhuma linha de empresas/usuarios é preenchida; ninguém recebe a flag.
-- Transação própria (padrão v236): aplicar com psql -v ON_ERROR_STOP=1 -f, SEM -1.
-- Registro em schema_migrations fica FORA deste arquivo, gateado no exit do apply.
begin;

-- 0) Guarda de banco
do $$ begin
  if current_database() <> 'postgres' then
    raise exception 'banco errado: % (esperado postgres)', current_database();
  end if;
end $$;

-- 1) empresas: vínculo (base_sgg, sgg_id) resolvido uma vez (D2). Nasce vazio.
alter table public.empresas add column if not exists sgg_base_sgg text;
alter table public.empresas add column if not exists sgg_id text;
alter table public.empresas add column if not exists sgg_resolvido_em timestamptz;
alter table public.empresas add column if not exists sgg_resolvido_por text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_sgg_base_sgg_chk') then
    alter table public.empresas add constraint empresas_sgg_base_sgg_chk
      check (sgg_base_sgg is null or sgg_base_sgg in
        ('teresopolis','guapimirim','piabeta','petropolis','campos','friburgo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'empresas_sgg_par_chk') then
    alter table public.empresas add constraint empresas_sgg_par_chk
      check ((sgg_base_sgg is null) = (sgg_id is null));
  end if;
end $$;

create unique index if not exists ux_empresas_sgg
  on public.empresas (sgg_base_sgg, sgg_id) where sgg_id is not null;

comment on column public.empresas.sgg_base_sgg is
  'Base/unidade SGG da empresa (slug = SGG_API_KEY_<BASE>). Resolvido uma vez por id_unidade + CNPJ/CPF contra api.empresas de mestres; ambíguo = operador confirma (SGG-RISCOS-01 D2).';
comment on column public.empresas.sgg_id is
  'id_empresa no SGG dentro de sgg_base_sgg. Só é único dentro da base; o mesmo CNPJ existe em até 4 bases.';
comment on column public.empresas.sgg_resolvido_em is 'Quando o par (sgg_base_sgg, sgg_id) foi resolvido/confirmado.';
comment on column public.empresas.sgg_resolvido_por is 'E-mail de quem resolveu/confirmou o vínculo.';

-- 2) usuarios: capability ADITIVA, default false (padrão v191). Ninguém recebe aqui.
alter table public.usuarios add column if not exists pode_enviar_sgg boolean not null default false;
alter table public.usuarios add column if not exists pode_enviar_sgg_concedido_por text;
alter table public.usuarios add column if not exists pode_enviar_sgg_concedido_em timestamptz;

comment on column public.usuarios.pode_enviar_sgg is
  'Capability de enviar riscos ao SGG (SGG-RISCOS-01). Checada server-side na rota app/api; RLS por perfil não a consulta. NÃO auto-concedível.';

-- Cópia estrutural de pode_escrever_quimicos() (v191:69-83). EXISTS nunca devolve NULL.
create or replace function public.pode_enviar_sgg()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.usuarios u
    where lower(u.email) = lower(auth.jwt() ->> 'email')
      and u.ativo_sistema = true
      and u.pode_enviar_sgg = true
  );
$function$;

comment on function public.pode_enviar_sgg() is
  'True se o usuário do JWT (ativo) tem a capability de enviar riscos ao SGG. Gate aditivo ao perfil (SGG-RISCOS-01).';
revoke execute on function public.pode_enviar_sgg() from public, anon;
grant execute on function public.pode_enviar_sgg() to authenticated, service_role;

-- 3) sgg_envios: outbox + auditoria + idempotência local (D5). Escrita só pelo service client.
create table if not exists public.sgg_envios (
  id_envio         text primary key default ('SGE-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  id_inspecao      text not null references public.inspecoes (id_inspecao) on delete restrict,
  id_empresa       text not null,
  id_setor         text not null,
  base_sgg         text not null,
  sgg_id_empresa   text not null,
  sgg_id_setor     text not null,
  sgg_ids_cargos   text not null,
  data             date not null,
  data_validade    date not null,
  payload          jsonb not null,
  status           text not null default 'pendente',
  sgg_id_avaliacao text,
  sgg_codigo       text,
  sgg_msg          text,
  ator_email       text not null,
  criado_em        timestamptz not null default now(),
  respondido_em    timestamptz,
  constraint sgg_envios_base_chk check (base_sgg in
    ('teresopolis','guapimirim','piabeta','petropolis','campos','friburgo')),
  constraint sgg_envios_status_chk check (status in ('pendente','enviado','erro','duplicado')),
  constraint sgg_envios_validade_chk check (data_validade > data),
  constraint ux_sgg_envios_idem unique (id_inspecao, id_setor, data)
);
create index if not exists idx_sgg_envios_inspecao on public.sgg_envios (id_inspecao);
create index if not exists idx_sgg_envios_empresa  on public.sgg_envios (id_empresa);

comment on table public.sgg_envios is
  'Envios de avaliação de riscos ao SGG (POST /avaliacao_de_riscos/): payload, resposta e status. UNIQUE (id_inspecao,id_setor,data) = idempotência local; D40017 do SGG = duplicado. Escrita só pelo service client da rota app/api (SGG-RISCOS-01).';

-- Privilégios: default ACL dá anon=SELECT e authenticated=IUD a tabela nova — revogar ANTES do grant.
alter table public.sgg_envios enable row level security;
revoke all on public.sgg_envios from anon, authenticated, public;
grant select on public.sgg_envios to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'backup_operator') then
    grant select on public.sgg_envios to backup_operator;
  end if;
end $$;

drop policy if exists sgg_envios_sel_uni on public.sgg_envios;
create policy sgg_envios_sel_uni on public.sgg_envios
  for select to authenticated
  using (public.caller_pode_ver_empresa(id_empresa));

-- Auditoria (v212): auditoria_ativar cria o trigger trg_auditoria E a linha em auditoria_tabelas
-- (sem a linha o trigger é inerte — auditoria_registrar() sai no "if not found").
select public.auditoria_ativar('sgg_envios', 'painel');

-- 4) Verificação que ABORTA (lição da 0057 do EAD): nada declarado sem medir.
do $$ begin
  if has_table_privilege('authenticated', 'public.sgg_envios', 'INSERT')
     or has_table_privilege('authenticated', 'public.sgg_envios', 'UPDATE')
     or has_table_privilege('authenticated', 'public.sgg_envios', 'DELETE') then
    raise exception 'sgg_envios escrevível por authenticated';
  end if;
  if has_table_privilege('anon', 'public.sgg_envios', 'SELECT') then
    raise exception 'sgg_envios legível por anon';
  end if;
  if not has_table_privilege('service_role', 'public.sgg_envios', 'INSERT') then
    raise exception 'service_role sem INSERT em sgg_envios';
  end if;
  if has_function_privilege('anon', 'public.pode_enviar_sgg()', 'EXECUTE') then
    raise exception 'pode_enviar_sgg() executável por anon';
  end if;
  if (select count(*) from public.usuarios where pode_enviar_sgg) <> 0 then
    raise exception 'capability concedida indevidamente';
  end if;
  if (select count(*) from public.empresas where sgg_id is not null) <> 0 then
    raise exception 'sgg_id preenchido indevidamente';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgname = 'trg_auditoria' and tgrelid = 'public.sgg_envios'::regclass) then
    raise exception 'trg_auditoria ausente em sgg_envios';
  end if;
  if not exists (select 1 from public.auditoria_tabelas where tabela = 'sgg_envios' and ativo) then
    raise exception 'auditoria_tabelas sem linha ativa para sgg_envios';
  end if;
  if (select count(*) from pg_policies where tablename = 'sgg_envios') <> 1 then
    raise exception 'sgg_envios deveria ter exatamente 1 policy';
  end if;
end $$;

commit;
