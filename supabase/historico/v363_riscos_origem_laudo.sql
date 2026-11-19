-- v363 — Riscos trazidos da AEP/AET: de onde o risco veio (19/11/2026, 0.3.308).
--
-- POR QUÊ: pedido do João — "quando uma AEP ou AET é realizada, os riscos não aparecem nos setores como os demais
-- riscos". A AEP/AET guarda os riscos DENTRO do laudo (setores[].riscos e, na AEP, os fatores organizacionais com o
-- nível AIHA); a aba Riscos da inspeção lê só a tabela `riscos`. Decisão dele: um botão "Trazer riscos da AEP/AET",
-- com prévia, que grava riscos normais da inspeção. Para trazer de novo SEM duplicar (e atualizar o que mudou no
-- laudo), cada risco trazido guarda de onde veio.
--
-- O QUE FAZ:
--   riscos.origem        'AEP' | 'AET' (null = risco lançado à mão, como sempre).
--   riscos.origem_chave  identificador do item no laudo: '<tipo>:<id do setor no laudo>:<id do risco>' ou
--                        '<tipo>:<id do setor no laudo>:org:<fator>' (fator organizacional da AEP). Não leva o id do
--                        laudo: a cópia de inspeção copia o laudo com os mesmos ids internos, e a chave continua valendo.
--   Índice único (id_inspecao, origem_chave) quando há chave: o mesmo item do laudo entra uma vez por inspeção.
--   Nenhuma linha existente muda.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v363_riscos_origem_laudo_rollback.sql
begin;

alter table public.riscos
  add column if not exists origem text,
  add column if not exists origem_chave text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'riscos_origem_check') then
    alter table public.riscos
      add constraint riscos_origem_check check (origem is null or origem in ('AEP', 'AET'));
  end if;
end $$;

create unique index if not exists riscos_origem_chave_uk
  on public.riscos (id_inspecao, origem_chave)
  where origem_chave is not null;

comment on column public.riscos.origem is 'v363: AEP ou AET quando o risco foi trazido do laudo pela aba Riscos; null = lançado à mão.';
comment on column public.riscos.origem_chave is 'v363: item do laudo (<tipo>:<setor do laudo>:<risco> ou :org:<fator>); único por inspeção.';

notify pgrst, 'reload schema';

commit;
