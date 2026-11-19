-- ROLLBACK v363 — tira a origem dos riscos trazidos da AEP/AET. Os riscos continuam (viram riscos comuns).
-- Volte antes o código (0.3.308), que grava essas colunas.
begin;

drop index if exists public.riscos_origem_chave_uk;
alter table public.riscos drop constraint if exists riscos_origem_check;
alter table public.riscos drop column if exists origem_chave;
alter table public.riscos drop column if exists origem;

notify pgrst, 'reload schema';
commit;
