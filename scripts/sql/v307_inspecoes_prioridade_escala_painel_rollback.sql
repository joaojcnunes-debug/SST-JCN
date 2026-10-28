-- Rollback da v307 (volta a escala e a trava da v306). Rodar DEPOIS de voltar o código.
-- As prioridades GRAVE/CRITICA marcadas viram ALTA/URGENTE (mesmo peso).
alter table public.inspecoes drop constraint if exists inspecoes_prioridade_check;
update public.inspecoes set prioridade = case prioridade when 'GRAVE' then 'ALTA' when 'CRITICA' then 'URGENTE' else prioridade end
 where prioridade in ('GRAVE', 'CRITICA');
alter table public.inspecoes add constraint inspecoes_prioridade_check
  check (prioridade is null or prioridade in ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE'));
drop index if exists public.inspecoes_prioridade_idx;

create or replace function public.inspecoes_prioridade_trg() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.prioridade is distinct from old.prioridade or new.prazo is distinct from old.prazo then
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.dashboard_caller_supervisor() then
      raise exception 'Só supervisor define a prioridade e o prazo da inspeção.' using errcode = '42501';
    end if;
    new.prioridade_definida_por := lower(coalesce(auth.jwt() ->> 'email', ''));
    new.prioridade_definida_em := now();
  end if;
  return new;
end $$;

create or replace function public.prioridade_auto(i inspecoes) returns text language sql stable set search_path to 'public' as $$
  with b as (select public.dias_espera(i) as espera, (now() at time zone 'America/Sao_Paulo')::date as hoje)
  select case when b.espera is null then null
              when (i.prazo is not null and i.prazo < b.hoje) or (i.data_validade is not null and i.data_validade < b.hoje) or b.espera > 45 then 'URGENTE'
              when (i.prazo is not null and i.prazo <= b.hoje + 3) or (i.data_validade is not null and i.data_validade <= b.hoje + 30) or b.espera > 30 then 'ALTA'
              when (i.prazo is not null and i.prazo <= b.hoje + 7) or b.espera > 15 then 'MEDIA'
              else 'BAIXA' end from b $$;

create or replace function public.prioridade_peso(p text) returns integer language sql immutable set search_path to 'public' as $$
  select case p when 'URGENTE' then 4 when 'ALTA' then 3 when 'MEDIA' then 2 when 'BAIXA' then 1 else 0 end $$;
notify pgrst, 'reload schema';
