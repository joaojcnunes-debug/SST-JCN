-- Rollback da v194 (Novidades). Fora de supabase/migrations/ porque o
-- migrate.ps1 varre aquela pasta e ignora arquivos com "rollback" no nome.
--
-- Derruba APENAS o que a v194 criou. Nada mais no painel depende destas duas
-- tabelas: o texto das novidades mora no codigo, entao perder os avisos avulsos
-- e perder o marcador de ja-vi custa, no maximo, um modal repetido.

begin;

drop trigger if exists trg_novidades_avisos_touch on public.novidades_avisos;
drop trigger if exists trg_novidades_vistas_touch on public.novidades_vistas;
drop function if exists public.novidades_touch_updated_at();

drop table if exists public.novidades_avisos;
drop table if exists public.novidades_vistas;

commit;
