-- Rollback de v219_presenca_relatorio_trilha_encerrar.sql — Presença, fase 2.
-- Devolve presenca_ping() à forma da v218 (void, sem pedido de encerramento) e
-- apaga as duas funções de leitura e a tabela de encerramentos. O front da
-- v0.3.607 que ainda estiver aberto engole os 404 em silêncio.
-- Nome com "rollback" → migrate.ps1 NÃO aplica isto no fluxo normal (é manual, gateado).

drop function if exists public.presenca_encerrar_sessao(text);
drop function if exists public.presenca_trilha(text, date, date, integer);
drop function if exists public.presenca_uso_mensal(date, text);
drop table if exists public.presenca_encerramentos;

drop function if exists public.presenca_ping(text);

create function public.presenca_ping(p_origem text default 'web')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claims  jsonb;
  v_email text;
  v_bloco timestamptz;
begin
  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));
  if v_email is null then
    return;
  end if;
  if not exists (
    select 1 from public.usuarios u
     where lower(u.email) = v_email and u.perfil <> 'Cliente'
  ) then
    return;
  end if;
  v_bloco := to_timestamp(floor(extract(epoch from now()) / 300) * 300);
  insert into public.presenca_pings (usuario_email, bloco, primeiro_em, ultimo_em, pings, origem)
  values (v_email, v_bloco, now(), now(), 1, left(coalesce(p_origem, 'web'), 20))
  on conflict (usuario_email, bloco) do update
    set ultimo_em = now(),
        pings     = public.presenca_pings.pings + 1,
        origem    = coalesce(excluded.origem, public.presenca_pings.origem);
end;
$$;

revoke all on function public.presenca_ping(text) from public, anon;
grant execute on function public.presenca_ping(text) to authenticated;

delete from schema_migrations where version like 'v219_presenca%';

notify pgrst, 'reload schema';
