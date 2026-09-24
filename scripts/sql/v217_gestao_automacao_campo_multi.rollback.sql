-- v217_gestao_automacao_campo_multi.rollback.sql
-- Rollback de GESTAO-KANBAN-02-GE2: restaura public.gestao_automacao_cond_teste ao corpo VIVO do v201
-- (ramo `campo:%` ESCALAR — multi volta a NÃO casar "contém"), e remove o registro em schema_migrations.
-- Corpo abaixo = verbatim do pg_get_functiondef vivo (baseline em d46418f / v216), delimitador $fn$.
-- SQL-only. Idempotente (create or replace).

begin;

create or replace function public.gestao_automacao_cond_teste(p_clause jsonb, p_ctx jsonb)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $fn$
declare
  f    text  := p_clause->>'campo';
  op   text  := lower(coalesce(p_clause->>'op', '='));
  val  jsonb := p_clause->'valor';
  val_txt text := case
                    when val is null then null
                    when jsonb_typeof(val) = 'string' then val #>> '{}'
                    else val::text
                  end;
  fval text;         -- valor escalar do campo (texto)
  farr jsonb := null; -- valor de array (etiquetas)
begin
  if f is null then
    return false;
  elsif f = 'etiqueta' then
    farr := coalesce(p_ctx->'etiquetas', '[]'::jsonb);
  elsif f like 'campo:%' then
    fval := p_ctx->'campos'->>substring(f from 7);
  elsif f in ('status', 'status_de', 'status_para', 'prioridade', 'quadro') then
    fval := p_ctx->>f;
  else
    return false;  -- campo desconhecido nunca casa
  end if;

  -- campo de array (etiqueta): membership / interseção
  if farr is not null then
    if op in ('=', 'contains') then
      if jsonb_typeof(val) = 'array' then
        return farr @> val;                              -- contém TODAS as listadas
      else
        return farr ? coalesce(val_txt, '');             -- contém a etiqueta
      end if;
    elsif op = 'in' then
      if jsonb_typeof(val) = 'array' then
        return exists (select 1 from jsonb_array_elements_text(val) e where farr ? e);
      else
        return farr ? coalesce(val_txt, '');
      end if;
    elsif op = '!=' then
      return not (farr ? coalesce(val_txt, ''));
    end if;
    return false;
  end if;

  -- campo escalar
  if op = '=' then
    return fval is not distinct from val_txt;
  elsif op = '!=' then
    return fval is distinct from val_txt;
  elsif op = 'in' then
    if jsonb_typeof(val) = 'array' then
      return exists (select 1 from jsonb_array_elements_text(val) e where e = fval);
    else
      return fval = val_txt;
    end if;
  elsif op = 'contains' then
    return fval is not null and val_txt is not null and position(val_txt in fval) > 0;
  end if;
  return false;
end
$fn$;

delete from public.schema_migrations where version = 'v217_gestao_automacao_campo_multi';

commit;
