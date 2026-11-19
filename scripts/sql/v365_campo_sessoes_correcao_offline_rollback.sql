-- ROLLBACK v365 — tira a correção do tempo de campo e o horário do aparelho; volta iniciar/pausar da v364.
-- APAGA o histórico de correções (as sessões corrigidas ficam com os horários corrigidos). Volte antes o código (0.3.315).
begin;

drop function if exists public.campo_sessao_corrigir(text, timestamptz, timestamptz, text);
drop table if exists public.campo_sessoes_correcoes;
alter table public.campo_sessoes drop column if exists corrigida;

drop function if exists public.campo_sessao_iniciar(text, text, timestamptz);
drop function if exists public.campo_sessao_pausar(text, text, timestamptz);
drop function if exists public.campo_quando(timestamptz, text);

create or replace function public.campo_sessao_iniciar(p_id_inspecao text, p_origem text default 'BOTAO')
returns text language plpgsql security definer set search_path = public as $$
declare u public.usuarios; v_status text; v_aberta text; v_id text;
begin
  if coalesce(p_origem, 'BOTAO') not in ('BOTAO', 'AUTOMATICO') then raise exception 'origem invalida'; end if;
  u := public.documento_sessao_quem(p_id_inspecao);
  if not public.campo_sessao_pode(p_id_inspecao, u.id_usuario, u.nome, u.email) then
    raise exception 'so o tecnico de campo da inspecao aponta tempo de campo';
  end if;
  select status into v_status from public.inspecoes where id_inspecao = p_id_inspecao;
  if v_status = 'CONCLUIDA' then raise exception 'inspecao ja concluida'; end if;

  perform public.campo_sessoes_fechar_inativas();
  select id_sessao, id_inspecao into v_aberta, v_id from public.campo_sessoes
   where id_usuario = u.id_usuario and fim is null;
  if v_aberta is not null and v_id = p_id_inspecao then
    update public.campo_sessoes set ultima_atividade = now() where id_sessao = v_aberta;
    return v_aberta;
  end if;
  -- Automático só na primeira vez da pessoa nesta inspeção: quem pausou de propósito não volta a contar sozinho.
  if coalesce(p_origem, 'BOTAO') = 'AUTOMATICO' and exists (
       select 1 from public.campo_sessoes where id_inspecao = p_id_inspecao and id_usuario = u.id_usuario) then
    return null;
  end if;
  if v_aberta is not null then
    update public.campo_sessoes set fim = greatest(now(), inicio), motivo_fim = 'TROCA' where id_sessao = v_aberta;
  end if;

  insert into public.campo_sessoes (id_inspecao, id_usuario, nome, email, origem)
  values (p_id_inspecao, u.id_usuario, u.nome, lower(u.email), coalesce(p_origem, 'BOTAO'))
  returning id_sessao into v_aberta;
  return v_aberta;
end $$;

create or replace function public.campo_sessao_pausar(p_id_inspecao text, p_motivo text default 'PAUSA')
returns boolean language plpgsql security definer set search_path = public as $$
declare u public.usuarios; n integer;
begin
  if coalesce(p_motivo, 'PAUSA') not in ('PAUSA', 'DESLOCAMENTO', 'AGUARDANDO_CLIENTE', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE') then
    raise exception 'motivo invalido';
  end if;
  u := public.documento_sessao_quem(p_id_inspecao);
  perform public.campo_sessoes_fechar_inativas();
  update public.campo_sessoes
     set fim = greatest(now(), inicio), motivo_fim = coalesce(p_motivo, 'PAUSA')
   where id_usuario = u.id_usuario and id_inspecao = p_id_inspecao and fim is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.campo_sessao_iniciar(text, text) from public, anon;
revoke all on function public.campo_sessao_pausar(text, text) from public, anon;
grant execute on function public.campo_sessao_iniciar(text, text) to authenticated;
grant execute on function public.campo_sessao_pausar(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
