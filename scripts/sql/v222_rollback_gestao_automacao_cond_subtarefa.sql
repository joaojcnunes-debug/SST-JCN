-- v222_rollback_gestao_automacao_cond_subtarefa.sql
-- Reverte o v222: restaura gestao_automacao_cond_teste EXATAMENTE como no v217 (sem os ramos de subtarefa).
-- Só usar se a esteira for retirada; as automações que condicionam por `subtarefa` deixam de casar (voltam a false).
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
  fval text;
  farr jsonb := null;
begin
  if f is null then
    return false;
  elsif f = 'etiqueta' then
    farr := coalesce(p_ctx->'etiquetas', '[]'::jsonb);
  elsif f like 'campo:%' then
    if jsonb_typeof(p_ctx->'campos'->substring(f from 7)) = 'array' then
      farr := p_ctx->'campos'->substring(f from 7);
    else
      fval := p_ctx->'campos'->>substring(f from 7);
    end if;
  elsif f in ('status', 'status_de', 'status_para', 'prioridade', 'quadro') then
    fval := p_ctx->>f;
  else
    return false;
  end if;

  if farr is not null then
    if op in ('=', 'contains') then
      if jsonb_typeof(val) = 'array' then
        return farr @> val;
      else
        return farr ? coalesce(val_txt, '');
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

commit;
