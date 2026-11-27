-- v374 — Comercial: avisar quando uma empresa ou serviço entra nas Oportunidades (27/11/2026, 0.3.338).
--
-- POR QUÊ: pedido do João — "quando uma empresa ou produto entrar na página do Comercial, notificar por e-mail e no
-- nome da pessoa, como tem nos outros quadros". O vendedor só ficava sabendo abrindo a página.
--
-- O QUE MUDA (os avisos usam a fila da Gestão, gestao_notificacoes — o sino da foto e o e-mail do worker
-- /api/gestao/google/sync; a preferência de cada pessoa, gestao_aviso_preferencias, continua valendo):
--   * comercial_avisar(titulo, mensagem): um aviso (tipo 'comercial') para cada usuário ativo com o módulo Comercial
--     marcado, menos quem fez a liberação;
--   * gatilhos que chamam o aviso quando algo ENTRA no Comercial:
--       - inspeção liberada (inspecoes.liberado_comercial_em passa a ter data);
--       - AEP liberada (aep_relatorios.liberado_comercial_em passa a ter data);
--       - conciliação da empresa liberada (comercial_atendimentos.status passa a CONCLUIDO);
--       - conciliação do grupo liberada (comercial_atendimentos_grupo.status passa a CONCLUIDO).
-- Nada é avisado ao retirar do Comercial. REAPLICAR: idempotente.
-- Rollback: scripts/sql/v374_comercial_avisos_rollback.sql.

begin;

-- 1) O aviso: um por vendedor (módulo Comercial marcado, ativo, com e-mail), menos quem liberou.
create or replace function public.comercial_avisar(p_titulo text, p_mensagem text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eu text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_n integer := 0;
  r record;
begin
  for r in
    select distinct lower(btrim(u.email)) as email
      from public.usuarios u
     where 'comercial' = any(coalesce(u.modulos_permitidos, '{}'::text[]))
       and coalesce(u.ativo_sistema, true)
       and u.email like '%@%'
       and lower(btrim(u.email)) <> v_eu
  loop
    insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, mensagem)
    values (gen_random_uuid(), r.email, 'comercial', left(p_titulo, 300), p_mensagem);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.comercial_avisar(text, text) from public, anon, authenticated;

-- 2) O nome da empresa (para o texto do aviso).
create or replace function public.comercial_nome_empresa(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select nullif(btrim(e.nome_empresa), '') from public.empresas e where e.id_empresa = p_id), 'empresa')
$$;
revoke all on function public.comercial_nome_empresa(text) from public, anon, authenticated;

-- 3) Inspeção e AEP liberadas para o Comercial.
create or replace function public.comercial_aviso_liberacao_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text;
  v_por text := nullif(btrim(coalesce(new.liberado_comercial_por, '')), '');
begin
  if new.liberado_comercial_em is null or old.liberado_comercial_em is not null then return null; end if;
  v_emp := public.comercial_nome_empresa(new.id_empresa);
  if tg_table_name = 'inspecoes' then
    perform public.comercial_avisar(
      'Nova oportunidade no Comercial: ' || v_emp,
      'A inspeção de ' || v_emp || ' foi liberada para o Comercial' || coalesce(' por ' || v_por, '') || '.' || E'\n'
        || 'Os serviços que ela indica (Apreciação NR-12, medição quantitativa, Análise de Químicos, DRPS/Questionário e '
        || 'treinamentos NR) já estão em Oportunidades.');
  else
    perform public.comercial_avisar(
      'Nova oportunidade no Comercial: ' || v_emp,
      'A AEP de ' || v_emp || ' foi liberada para o Comercial' || coalesce(' por ' || v_por, '') || '.' || E'\n'
        || 'Os serviços que ela indica (AET e DRPS/Questionário) já estão em Oportunidades.');
  end if;
  return null;
end $$;

drop trigger if exists trg_comercial_aviso_inspecao on public.inspecoes;
create trigger trg_comercial_aviso_inspecao
  after update of liberado_comercial_em on public.inspecoes
  for each row execute function public.comercial_aviso_liberacao_trg();

drop trigger if exists trg_comercial_aviso_aep on public.aep_relatorios;
create trigger trg_comercial_aviso_aep
  after update of liberado_comercial_em on public.aep_relatorios
  for each row execute function public.comercial_aviso_liberacao_trg();

-- 4) Conciliação liberada (atendimento concluído): da empresa e do grupo.
create or replace function public.comercial_aviso_atendimento_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_n integer;
  v_por text := nullif(btrim(coalesce(new.concluido_por, '')), '');
begin
  if new.status is distinct from 'CONCLUIDO' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'CONCLUIDO' then return null; end if;
  if tg_table_name = 'comercial_atendimentos' then
    v_nome := public.comercial_nome_empresa(new.id_empresa);
    select count(*) into v_n from public.comercial_atendimento_intervencoes i where i.id_empresa = new.id_empresa;
    perform public.comercial_avisar(
      'Intervenções psicossociais no Comercial: ' || v_nome,
      'A conciliação DRPS/QPS × AEP de ' || v_nome || ' foi liberada para o Comercial' || coalesce(' por ' || v_por, '')
        || ', com ' || v_n || case when v_n = 1 then ' intervenção indicada' else ' intervenções indicadas' end || '.' || E'\n'
        || 'O plano de intervenções e o método de cada uma estão em Oportunidades › Intervenção psicossocial.');
  else
    select coalesce(nullif(btrim(g.nome), ''), 'grupo') into v_nome from public.empresa_grupos g where g.id_grupo = new.id_grupo;
    select count(*) into v_n from public.comercial_grupo_intervencoes i where i.id_grupo = new.id_grupo;
    perform public.comercial_avisar(
      'Intervenções psicossociais no Comercial: grupo ' || coalesce(v_nome, 'grupo'),
      'A conciliação do grupo ' || coalesce(v_nome, '—') || ' foi liberada para o Comercial' || coalesce(' por ' || v_por, '')
        || ', com ' || v_n || case when v_n = 1 then ' intervenção indicada' else ' intervenções indicadas' end || '.' || E'\n'
        || 'Cada empresa do grupo aparece em Oportunidades com as intervenções dos setores dela.');
  end if;
  return null;
end $$;

drop trigger if exists trg_comercial_aviso_atendimento on public.comercial_atendimentos;
create trigger trg_comercial_aviso_atendimento
  after insert or update of status on public.comercial_atendimentos
  for each row execute function public.comercial_aviso_atendimento_trg();

drop trigger if exists trg_comercial_aviso_atendimento_grupo on public.comercial_atendimentos_grupo;
create trigger trg_comercial_aviso_atendimento_grupo
  after insert or update of status on public.comercial_atendimentos_grupo
  for each row execute function public.comercial_aviso_atendimento_trg();

commit;
