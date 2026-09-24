-- v121 — Investigação de Acidente: converte cinco_porques na tabela CORRETA.
--
-- A v119 alterou `investigacao_acidente` (SINGULAR) — mas o app usa `investigacoes_acidente`
-- (PLURAL). Então a coluna real continuou text[], e os objetos { pergunta, resposta } gravados
-- pelo editor novo viravam JSON-string dentro do text[] → saíam crus no PDF.
--
-- Aqui: converte `investigacoes_acidente.cinco_porques` text[] → jsonb, PARSEANDO elementos que
-- já são JSON de objeto (o caso do bug) e tratando strings simples (legado) como { resposta }.
-- Idempotente: só converte se ainda for text[] (ARRAY).

create or replace function public._v121_porq_one(e text) returns jsonb
  language plpgsql immutable as $fn$
declare j jsonb;
begin
  if e is null or btrim(e) = '' then return null; end if;
  begin j := e::jsonb; exception when others then j := null; end;
  if j is not null and jsonb_typeof(j) = 'object' and (j ? 'pergunta' or j ? 'resposta') then
    return jsonb_build_object('pergunta', coalesce(j->>'pergunta',''), 'resposta', coalesce(j->>'resposta',''));
  end if;
  return jsonb_build_object('pergunta', '', 'resposta', e);
end $fn$;

create or replace function public._v121_porques_conv(arr text[]) returns jsonb
  language sql immutable as $fn$
  select coalesce(jsonb_agg(x) filter (where x is not null), '[]'::jsonb)
  from (select public._v121_porq_one(e) as x from unnest(arr) e) t;
$fn$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'investigacoes_acidente'
      and column_name  = 'cinco_porques'
      and data_type    = 'ARRAY'
  ) then
    alter table public.investigacoes_acidente alter column cinco_porques drop default;
    alter table public.investigacoes_acidente
      alter column cinco_porques type jsonb using public._v121_porques_conv(cinco_porques);
    alter table public.investigacoes_acidente
      alter column cinco_porques set default '[]'::jsonb;
  end if;
end $$;

drop function if exists public._v121_porques_conv(text[]);
drop function if exists public._v121_porq_one(text);
