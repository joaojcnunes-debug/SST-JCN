-- v213 — Busca da auditoria sem acento.
--
-- Achado ao exercitar a tela no ar (14/09, v0.3.597): "Luva" achava o evento
-- "criou EPI/EPC Luva nitrílica", mas "nitrilica" não — o tsvector da v212 é
-- 'simple' e guarda o acento. A equipe digita sem acento; a busca tem de achar.
--
-- O que muda: a coluna gerada `busca` passa a ser calculada sobre o texto SEM
-- acento (`public.sem_acento`, wrapper IMMUTABLE do `unaccent` — a função da
-- extensão é STABLE e coluna gerada exige IMMUTABLE). A tela tira o acento do
-- que a pessoa digita antes de mandar (lib/auditoria/eventos.ts › semAcento),
-- então os dois lados falam a mesma língua.
--
-- Custo: recalcula `busca` para as linhas existentes (59 no momento de
-- escrever; a tabela nasceu hoje) e refaz o índice GIN. Nada de dado de
-- negócio é tocado. Idempotente. Rodar com `psql -1 -v ON_ERROR_STOP=1`.

-- JCN (Supabase gerenciado): unaccent mora no schema "extensions", nao em
-- "public" como no painel self-host. O involucro sem_acento fica em public
-- porque e ele que a coluna gerada e a busca da tela chamam.
create extension if not exists unaccent with schema extensions;

-- Dicionário fixo ('unaccent') para a função poder ser IMMUTABLE.
create or replace function public.sem_acento(p text)
returns text language sql immutable parallel safe strict as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p)
$$;

drop index if exists public.auditoria_eventos_busca_idx;
alter table public.auditoria_eventos drop column if exists busca;
alter table public.auditoria_eventos add column busca tsvector generated always as (
  to_tsvector('simple', public.sem_acento(
    coalesce(titulo, '') || ' ' || coalesce(usuario_email, '') || ' ' ||
    coalesce(registro_id, '') || ' ' ||
    coalesce(antes::text, '') || ' ' || coalesce(depois::text, '')))
) stored;
create index auditoria_eventos_busca_idx on public.auditoria_eventos using gin (busca);

notify pgrst, 'reload schema';
