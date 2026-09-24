-- ROLLBACK da v213 — a busca da auditoria volta a guardar acento (como na v212).
--
-- Efeito na tela: "nitrilica" deixa de achar "nitrílica" de novo. Os eventos
-- não são tocados; só a coluna gerada `busca` é recalculada e o índice refeito.
-- `sem_acento()` só é apagada se nada mais depender dela (índice, coluna,
-- outra função com dependência registrada); se depender, fica e avisa.
-- `unaccent` fica instalada (já estava antes da v213).
-- Rodar com `psql -1 -v ON_ERROR_STOP=1`.

drop index if exists public.auditoria_eventos_busca_idx;
alter table public.auditoria_eventos drop column if exists busca;
alter table public.auditoria_eventos add column busca tsvector generated always as (
  to_tsvector('simple',
    coalesce(titulo, '') || ' ' || coalesce(usuario_email, '') || ' ' ||
    coalesce(registro_id, '') || ' ' ||
    coalesce(antes::text, '') || ' ' || coalesce(depois::text, ''))
) stored;
create index auditoria_eventos_busca_idx on public.auditoria_eventos using gin (busca);

do $$
begin
  drop function if exists public.sem_acento(text);
exception when dependent_objects_still_exist then
  raise warning 'rollback v213: sem_acento() mantida — outro objeto depende dela.';
end $$;

delete from public.schema_migrations where version = 'v213_auditoria_busca_sem_acento';

notify pgrst, 'reload schema';
