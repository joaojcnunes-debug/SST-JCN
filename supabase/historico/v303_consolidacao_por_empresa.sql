-- v303 — Consolidação por empresa salva (27/10/2026)
--
-- A página Consolidação › Por empresa passa a funcionar como a de grupo (Setores, Fatores,
-- Validação, PDF), com as empresas escolhidas na hora. Como uma empresa só pode estar em UM
-- grupo (`empresas.id_grupo`), a seleção não pode virar um grupo de verdade: ela vira uma linha
-- de `empresa_grupos` do tipo CONSOLIDACAO, com as empresas na própria linha
-- (`empresas_consolidacao`). Assim tudo o que a consolidação de grupo grava por `id_grupo`
-- (setores padronizados, de-para, fatores ignorados, registros e validações) vale sem tabela nova.
--
-- - `tipo` GRUPO (padrão, todos os grupos atuais) | CONSOLIDACAO.
-- - Nome único por tipo (uma consolidação pode ter o nome de um grupo).
-- - Nenhuma empresa entra (`empresas.id_grupo`) numa CONSOLIDACAO — trigger.
-- - `psico_consolidacao_membros(id)` devolve as empresas da consolidação no formato de
--   `empresa_grupos_membros()` (com `visivel` pela unidade de quem pede).
-- - Excluir usa a mesma `empresa_grupo_excluir` (setores e de-para caem em cascata; registro
--   gravado impede a exclusão, como no grupo).
--
-- Idempotente. Rollback: scripts/sql/v303_consolidacao_por_empresa_rollback.sql

alter table public.empresa_grupos add column if not exists tipo text not null default 'GRUPO';
alter table public.empresa_grupos add column if not exists empresas_consolidacao text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresa_grupos_tipo_check') then
    alter table public.empresa_grupos
      add constraint empresa_grupos_tipo_check check (tipo in ('GRUPO', 'CONSOLIDACAO'));
  end if;
end $$;

drop index if exists public.ux_empresa_grupos_nome;
create unique index ux_empresa_grupos_nome on public.empresa_grupos (tipo, lower(btrim(nome)));

-- empresa não entra numa consolidação pelo id_grupo (as empresas dela ficam no array)
create or replace function public.fn_empresa_grupo_nao_consolidacao()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.id_grupo is not null
     and exists (select 1 from public.empresa_grupos g where g.id_grupo = new.id_grupo and g.tipo <> 'GRUPO') then
    raise exception 'Uma consolidação por empresa não é grupo: a empresa não pode entrar nela.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_empresa_grupo_nao_consolidacao on public.empresas;
create trigger trg_empresa_grupo_nao_consolidacao
  before insert or update of id_grupo on public.empresas
  for each row execute function public.fn_empresa_grupo_nao_consolidacao();

-- as empresas de uma consolidação, no formato de empresa_grupos_membros()
create or replace function public.psico_consolidacao_membros(p_id_grupo text)
returns table(id_empresa text, id_grupo text, papel_grupo text, nome_empresa text, razao_social text,
              nome_fantasia text, cnpj text, id_unidade text, unidade_nome text, status text, visivel boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select e.id_empresa, g.id_grupo, 'FILIAL'::text, e.nome_empresa, e.razao_social,
         e.nome_fantasia, e.cnpj, e.id_unidade, u.nome, e.status,
         public.caller_pode_ver_empresa(e.id_empresa)
    from public.empresa_grupos g
    cross join lateral unnest(g.empresas_consolidacao) with ordinality as x(id_empresa, ordem)
    join public.empresas e on e.id_empresa = x.id_empresa
    left join public.unidades u on u.id_unidade = e.id_unidade
   where g.id_grupo = p_id_grupo
     and g.tipo = 'CONSOLIDACAO'
     and exists (
       select 1 from public.usuarios us
        where lower(us.email) = lower(auth.jwt() ->> 'email')
          and us.ativo_sistema = true
          and us.perfil is distinct from 'Cliente'
     )
   order by e.nome_empresa;
$$;

revoke all on function public.psico_consolidacao_membros(text) from public, anon;
grant execute on function public.psico_consolidacao_membros(text) to authenticated;
