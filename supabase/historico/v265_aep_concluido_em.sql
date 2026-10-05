-- v265 (2026-10-05): data em que a AEP foi concluída (= enviada ao cliente).
-- Usada pela Sinalização Psicossocial para AEP SEM inspeção. Preenchida por
-- trigger ao passar para CONCLUIDO; volta a NULL se a AEP voltar a rascunho.
-- Já aplicada via MCP. Rollback: scripts/sql/v265_rollback_aep_concluido_em.sql
alter table public.aep_relatorios add column if not exists concluido_em timestamptz;

update public.aep_relatorios set concluido_em = coalesce(updated_at, created_at)
 where status = 'CONCLUIDO' and concluido_em is null;

create or replace function public.aep_relatorios_concluido_em()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'CONCLUIDO' and (tg_op = 'INSERT' or old.status is distinct from 'CONCLUIDO') then
    new.concluido_em := now();
  elsif new.status <> 'CONCLUIDO' then
    new.concluido_em := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_aep_relatorios_concluido_em on public.aep_relatorios;
create trigger trg_aep_relatorios_concluido_em
  before insert or update of status on public.aep_relatorios
  for each row execute function public.aep_relatorios_concluido_em();
