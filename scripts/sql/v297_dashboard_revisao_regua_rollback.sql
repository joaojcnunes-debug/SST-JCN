-- ROLLBACK da v297 (JCN): volta à régua da v295/v296.
--  1. Tira o técnico travado, a nota pelo banco e o papel de supervisor.
--  2. Volta o gatilho da 1ª conclusão da v295 (reaplicar o bloco 2 de
--     supabase/historico/v295_dashboard_primeira_conclusao.sql logo depois deste script).
--  3. Volta a dashboard_assuncoes da v295 (sem a coluna origem) e a dashboard_reaberturas da v296
--     (reaplicar supabase/historico/v296_dashboard_reaberturas_por_chave.sql).
-- As datas do backfill da v297 ficam (são as mais antigas comprovadas); não há o que desfazer nelas.

drop function if exists public.dashboard_definir_tecnico(text, text);
drop function if exists public.dashboard_caller_supervisor();
drop function if exists public.dashboard_resp_elaboracao_em(text, timestamptz);
drop index if exists public.auditoria_eventos_insp_id_idx;

drop function if exists public.dashboard_assuncoes();
create function public.dashboard_assuncoes()
  returns table (id_inspecao text, responsavel text, assumido_em timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.dashboard_caller_interno() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
  select e.registro_id, e.depois ->> 'elaboracao_responsavel', e.ocorrido_em
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes'
     and coalesce(e.depois ->> 'elaboracao_responsavel', '') <> ''
     and (e.antes ->> 'elaboracao_responsavel') is distinct from (e.depois ->> 'elaboracao_responsavel')
   order by e.ocorrido_em;
end $$;
revoke all on function public.dashboard_assuncoes() from public, anon;
grant execute on function public.dashboard_assuncoes() to authenticated, service_role;

-- O gatilho da v297 usa inspecao_tecnicos_campo_json: reaplique o gatilho da v295 ANTES de tirá-la.
-- (bloco 2 da v295) e só então:
--   drop function if exists public.inspecao_tecnicos_campo_json(text);
--   alter table public.inspecoes drop column if exists primeira_conclusao_tecnicos;

notify pgrst, 'reload schema';
