-- v222_gestao_automacao_cond_subtarefa.sql
-- GESTAO-KANBAN-02-GE3 (esteira) — cond_teste passa a aceitar condição por SUBTAREFA.
-- Recria public.gestao_automacao_cond_teste (versão viva = v217) adicionando SOMENTE os ramos
-- `subtarefa`/`subtarefa_texto`/`subtarefa_etapa`/`subtarefa_tipo`, que leem o contexto que o
-- gatilho subtarefa_concluida já injeta (v201: subtarefa_texto/tipo/etapa). Todos os demais ramos
-- (etiqueta/status/prioridade/quadro/campo multi) IDÊNTICOS ao v217. Regressão zero.
-- Necessário para a esteira: distinguir QUAL subtarefa foi concluída (controle x produto) — sem isso
-- concluir um produto avançaria a etapa cedo demais. E2E provado (transação com rollback) 2026-09-16.
-- SQL-only. Idempotente (create or replace). NÃO grava schema_migrations (apply manual pelo operador).
-- Segurança: SECURITY DEFINER + search_path='public'; zero SQL dinâmico; valores parametrizados.

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
  -- GE3: condição por subtarefa (contexto do gatilho subtarefa_concluida)
  elsif f in ('subtarefa','subtarefa_texto') then
    fval := p_ctx->>'subtarefa_texto';
  elsif f = 'subtarefa_etapa' then
    fval := p_ctx->>'subtarefa_etapa';
  elsif f = 'subtarefa_tipo' then
    fval := p_ctx->>'subtarefa_tipo';
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
