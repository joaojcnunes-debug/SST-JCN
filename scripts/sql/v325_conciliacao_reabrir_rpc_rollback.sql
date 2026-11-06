-- Rollback da v325: devolve a reabertura por escrita direta e o comercial_concluir da v321.
-- Se reverter, reverta também o código da 0.3.238.
begin;

drop function if exists public.comercial_reabrir_conciliacao(text, text, text);

drop policy if exists psico_conciliacao_reaberturas_ins on public.psico_conciliacao_reaberturas;
create policy psico_conciliacao_reaberturas_ins on public.psico_conciliacao_reaberturas
  for insert to authenticated
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));
grant insert on public.psico_conciliacao_reaberturas to authenticated;

create or replace function public.comercial_concluir(p_id_empresa text, p_parecer text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_parecer text := nullif(btrim(p_parecer), '');
begin
  v_nome := public.comercial_exige_sessao(p_id_empresa);
  if v_parecer is null then
    raise exception 'Escreva o parecer antes de concluir' using errcode = '22023';
  end if;
  update public.comercial_atendimentos
     set status = 'CONCLUIDO', parecer = v_parecer, concluido_em = now(), concluido_por = v_nome
   where id_empresa = p_id_empresa;
  update public.comercial_sessoes set fim = now(), motivo_fim = 'CONCLUIDO'
   where id_empresa = p_id_empresa and fim is null;
  insert into public.comercial_atendimento_eventos (id_empresa, tipo, parecer, por)
    values (p_id_empresa, 'CONCLUIDO', v_parecer, v_nome);
end $$;

notify pgrst, 'reload schema';

commit;
