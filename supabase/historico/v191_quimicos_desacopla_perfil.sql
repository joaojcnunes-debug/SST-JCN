-- v191 — Quimicos: capability de escrita desacoplada do perfil.
--
-- GESTAO-KANBAN-01-F1.3-A. Hoje a escrita de analises_quimicos depende do PERFIL
-- (caller_pode_editar() = Admin/Tecnico). Reverter os 3 Tecnico temporarios de 21/08
-- para Visualizador cortaria a escrita de quimicos deles -- a capacidade para a qual
-- foram elevados. Esta migration cria um caminho de escrita INDEPENDENTE do perfil:
-- uma capability por-usuario (usuarios.pode_escrever_quimicos) que serve a RLS e o
-- front no mesmo fetch.
--
-- Decisoes fechadas pelo operador (2026-09-01):
--   P1 = (a) coluna booleana em usuarios (+ auditoria concedido_por/concedido_em).
--   P2 = sim -- a capability cobre TAMBEM base_referencia_quimicos (base CAS).
--   P3 = nao remover o perfil do gate: vira caller_pode_editar() OR pode_escrever_quimicos()
--        (ADITIVO -- Admins/Tecnicos seguem escrevendo sem re-concessao).
--
-- ADITIVA e SEGURA: a policy passa a ACEITAR MAIS (a flag nasce default false, ninguem
-- ganha nada ainda) e NAO muda comportamento ate alguem receber a flag. Esta migration
-- NAO concede a capability a ninguem e NAO altera perfil de ninguem -- a concessao aos 3
-- e o UPDATE de perfil sao passos de apply do operador, separados pelo gate de identidade.
--
-- Idempotente (aplicavel 2x) e reversivel. Rollback em
-- scripts/sql/v191_quimicos_desacopla_perfil.rollback.sql (fora de supabase/migrations/
-- porque o migrate.ps1 varre esta pasta e ignora arquivo com "rollback" no nome).
-- begin;...commit; PROPRIO -- NAO aplicar com psql -1.

begin;

-- ── (0) Guardas: falha fechada em vez de aplicar as cegas (padrao v186/v190) ──
do $$
begin
  if to_regclass('public.analises_quimicos') is null then
    raise exception 'v191: public.analises_quimicos ausente -- a policy de quimicos dependeria dela; abortado';
  end if;
  if to_regclass('public.base_referencia_quimicos') is null then
    raise exception 'v191: public.base_referencia_quimicos ausente -- P2 cobre essa tabela; abortado';
  end if;
  if to_regclass('public.usuarios') is null then
    raise exception 'v191: public.usuarios ausente -- a capability mora nela; abortado';
  end if;
  if to_regprocedure('public.caller_pode_editar()') is null then
    raise exception 'v191: caller_pode_editar() ausente -- o gate ADITIVO depende dela; abortado';
  end if;
  if to_regprocedure('public.caller_pode_ver_empresa(text)') is null then
    raise exception 'v191: caller_pode_ver_empresa(text) ausente -- o recorte de unidade depende dela; abortado';
  end if;
end $$;

-- ── (1) Capability + auditoria (ADITIVO; default false = ninguem ganha nada) ──
-- pode_escrever_quimicos: a flag que a RLS e o front consultam.
-- concedido_por / concedido_em: quem concedeu e quando (auditoria minima, P1=a).
alter table public.usuarios
  add column if not exists pode_escrever_quimicos boolean not null default false;
alter table public.usuarios
  add column if not exists concedido_por text;
alter table public.usuarios
  add column if not exists concedido_em timestamptz;

comment on column public.usuarios.pode_escrever_quimicos is
  'Capability de escrita de quimicos desacoplada do perfil (F1.3-A). Serve RLS (pode_escrever_quimicos()) e front. NAO auto-concedivel: write de usuarios segue gated por admin.';
comment on column public.usuarios.concedido_por is
  'E-mail de quem concedeu pode_escrever_quimicos (auditoria).';
comment on column public.usuarios.concedido_em is
  'Quando pode_escrever_quimicos foi concedido (auditoria).';

-- ── (2) Funcao da capability ─────────────────────────────────────────────────
-- Espelha o padrao de leitura de e-mail do JWT de caller_unidades() (v75): usuario
-- ATIVO cujo e-mail bate o do token e tem a flag. SECURITY DEFINER + search_path fixo
-- para atravessar a RLS de usuarios sem recursao e resistir a search_path hostil.
create or replace function public.pode_escrever_quimicos()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.usuarios u
    where lower(u.email) = lower(auth.jwt() ->> 'email')
      and u.ativo_sistema = true
      and u.pode_escrever_quimicos = true
  );
$$;

comment on function public.pode_escrever_quimicos() is
  'True se o usuario do JWT (ativo) tem a capability de escrita de quimicos. Gate ADITIVO ao perfil (F1.3-A).';

-- ── (3) Repoe as policies de escrita: perfil OR capability ───────────────────
-- analises_quimicos_rw_uni (origem v76): perfil E unidade. Vira (perfil OR cap) E unidade.
-- O recorte de unidade caller_pode_ver_empresa(id_empresa) e PRESERVADO exatamente.
alter table public.analises_quimicos enable row level security;
drop policy if exists analises_quimicos_rw_uni on public.analises_quimicos;
create policy analises_quimicos_rw_uni on public.analises_quimicos
  for all to authenticated
  using ((public.caller_pode_editar() or public.pode_escrever_quimicos())
         and public.caller_pode_ver_empresa(id_empresa))
  with check ((public.caller_pode_editar() or public.pode_escrever_quimicos())
              and public.caller_pode_ver_empresa(id_empresa));

-- base_referencia_quimicos_rw_editor (origem v74): perfil-only, SEM recorte de unidade
-- (a tabela nao tem id_empresa). P2=sim -> a mesma capability cobre a base CAS.
alter table public.base_referencia_quimicos enable row level security;
drop policy if exists base_referencia_quimicos_rw_editor on public.base_referencia_quimicos;
create policy base_referencia_quimicos_rw_editor on public.base_referencia_quimicos
  for all to authenticated
  using (public.caller_pode_editar() or public.pode_escrever_quimicos())
  with check (public.caller_pode_editar() or public.pode_escrever_quimicos());

-- ── (4) NAO concede a flag a ninguem e NAO toca perfil. ──────────────────────
-- A concessao aos 3 (pode_escrever_quimicos=true) e o UPDATE de perfil para
-- Visualizador sao passos de apply do operador, apos o gate de identidade.

commit;
