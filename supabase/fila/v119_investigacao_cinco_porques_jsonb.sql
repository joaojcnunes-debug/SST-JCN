-- v119 — Investigação de Acidente: 5 Porquês passa a ter PERGUNTA + RESPOSTA por linha.
--
-- Antes: cinco_porques text[] (só a resposta de cada "Por quê?").
-- Agora:  cinco_porques jsonb  = array de { "pergunta": text, "resposta": text }.
--
-- Backward compat: cada string existente vira { pergunta: '', resposta: <string> } (o texto
-- atual era a resposta; a pergunta fica vazia para o usuário preencher). Entradas vazias são
-- descartadas. Idempotente: só converte se a coluna ainda for text[] (ARRAY).
--
-- Nota: o ALTER ... TYPE ... USING não aceita subquery, por isso a conversão vai numa função
-- auxiliar (chamada de função É permitida no USING). A função é criada e removida aqui mesmo.

create or replace function public._v119_porques_conv(arr text[]) returns jsonb
  language sql immutable as $f$
    select coalesce(
      jsonb_agg(jsonb_build_object('pergunta', '', 'resposta', e)),
      '[]'::jsonb)
    from unnest(arr) e
    where e is not null and btrim(e) <> '';
  $f$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'investigacao_acidente'
      and column_name  = 'cinco_porques'
      and data_type    = 'ARRAY'
  ) then
    alter table public.investigacao_acidente alter column cinco_porques drop default;
    alter table public.investigacao_acidente
      alter column cinco_porques type jsonb using public._v119_porques_conv(cinco_porques);
    alter table public.investigacao_acidente
      alter column cinco_porques set default '[]'::jsonb;
  end if;
end $$;

drop function if exists public._v119_porques_conv(text[]);
