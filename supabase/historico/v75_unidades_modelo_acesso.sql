-- v75: modelo de acesso por UNIDADE (agrupamento de empresas).
-- Empresa tem 1 unidade (ou nenhuma = visível a todos); usuário tem N unidades;
-- vê as empresas das suas unidades + as sem unidade. Admin vê tudo.
-- Fase A (modelo + telas). A RLS por unidade é ligada na fase B (v76).

create table if not exists public.unidades (
  id_unidade  text primary key,
  nome        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

alter table public.empresas
  add column if not exists id_unidade text references public.unidades(id_unidade) on delete set null;

alter table public.usuarios
  add column if not exists unidades text[] not null default '{}';

alter table public.unidades enable row level security;
drop policy if exists unidades_sel on public.unidades;
drop policy if exists unidades_rw on public.unidades;
create policy unidades_sel on public.unidades for select to authenticated using (true);
create policy unidades_rw  on public.unidades for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Unidades do usuário chamador (por email do JWT)
create or replace function public.caller_unidades()
returns text[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(u.unidades, '{}')
    from public.usuarios u
   where lower(u.email) = lower(auth.jwt() ->> 'email')
     and u.ativo_sistema = true
   limit 1;
$$;

-- O chamador pode ver a empresa? (admin, ou empresa sem unidade, ou unidade do usuário)
create or replace function public.caller_pode_ver_empresa(p_id_empresa text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.caller_eh_admin() or p_id_empresa is null or exists (
    select 1 from public.empresas e
     where e.id_empresa = p_id_empresa
       and (e.id_unidade is null or e.id_unidade = any(public.caller_unidades()))
  );
$$;
