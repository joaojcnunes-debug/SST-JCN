-- v356 — Conciliação por grupo, etapa 2: Intervenções, Liberar para o Comercial e o tempo (Iniciar) no grupo
-- (16/11/2026, 0.3.290).
--
-- POR QUÊ: pedido do João. O trabalho do Comercial é feito uma vez no grupo (sessão de tempo, intervenções por risco,
-- parecer, Liberar). Decisões dele: o vendedor vê POR EMPRESA (cada empresa do grupo aparece em Oportunidades com as
-- intervenções dos setores dela; a venda continua por CNPJ) e, se a empresa já tinha liberação própria, O GRUPO
-- SUBSTITUI no Comercial (a liberação dela fica no histórico).
--
-- O QUE FAZ (o mesmo desenho da v321/v322/v324, com id_grupo):
--   1) comercial_atendimentos_grupo (um por grupo) e comercial_atendimento_grupo_eventos (liberado/retirado);
--   2) comercial_sessoes_grupo — o tempo do grupo (mesmas regras de comercial_sessoes; iniciar num fecha a sessão
--      aberta da pessoa no outro);
--   3) comercial_grupo_intervencoes — intervenção por risco do grupo, com `empresas` (as do setor) para o vendedor;
--   4) funções comercial_grupo_* (iniciar/pausar/atividade, intervenção salvar/retirar, parecer, concluir, reabrir) e
--      comercial_reabrir_conciliacao_grupo (reabre a conciliação do grupo e, se liberada, o atendimento junto);
--   5) comercial_venda_registrar aceita a intervenção do grupo para a empresa que está nela;
--   6) comercial_dados() ganha a chave `grupos`.
--   RLS: leitura por comercial_pode_liberar(); escrita só pelas funções (que exigem psico_caller_ve_grupo).
--   Só cria objetos e troca duas funções (o resto delas igual à v331/v329). Nenhum dado existente muda.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v356_comercial_grupo_rollback.sql
begin;

do $$ begin
  if to_regprocedure('public.comercial_pode_liberar()') is null
     or to_regprocedure('public.comercial_quem()') is null
     or to_regprocedure('public.psico_caller_ve_grupo(text)') is null
     or to_regclass('public.psico_conciliacao_grupo_fechamentos') is null
     or to_regclass('public.comercial_atendimento_intervencoes') is null then
    raise exception 'v356: faltam a v321/v322 (comercial_*) ou a v354 (conciliação por grupo)';
  end if;
end $$;

-- ── 1) Atendimento do grupo ───────────────────────────────────────────────────
create table if not exists public.comercial_atendimentos_grupo (
  id_grupo      text primary key references public.empresa_grupos(id_grupo) on delete cascade,
  status        text not null default 'EM_ANDAMENTO' check (status in ('EM_ANDAMENTO', 'CONCLUIDO')),
  parecer       text,
  concluido_em  timestamptz,
  concluido_por text,
  criado_em     timestamptz not null default now(),
  criado_por    text
);
comment on table public.comercial_atendimentos_grupo is
  'Liberação ao Comercial da Conciliação por grupo, um atendimento por grupo. v356.';

create table if not exists public.comercial_atendimento_grupo_eventos (
  id_evento bigint generated always as identity primary key,
  id_grupo  text not null references public.comercial_atendimentos_grupo(id_grupo) on delete cascade,
  tipo      text not null check (tipo in ('CONCLUIDO', 'REABERTO')),
  motivo    text,
  parecer   text,
  por       text,
  em        timestamptz not null default now()
);
create index if not exists ix_comercial_grupo_eventos on public.comercial_atendimento_grupo_eventos (id_grupo, em);

-- ── 2) Tempo do grupo ─────────────────────────────────────────────────────────
create table if not exists public.comercial_sessoes_grupo (
  id_sessao        text primary key default ('CSG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_grupo         text not null references public.comercial_atendimentos_grupo(id_grupo) on delete cascade,
  id_usuario       text not null,
  nome             text not null,
  email            text not null,
  inicio           timestamptz not null default now(),
  ultima_atividade timestamptz not null default now(),
  fim              timestamptz,
  motivo_fim       text check (motivo_fim is null or motivo_fim in (
                     'PAUSA', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_TECNICO', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE',
                     'TROCA', 'INATIVIDADE', 'CONCLUIDO')),
  fechada_auto     boolean not null default false,
  check (fim is null or fim >= inicio),
  check ((fim is null) = (motivo_fim is null))
);
create unique index if not exists ux_comercial_sessao_grupo_aberta on public.comercial_sessoes_grupo (id_usuario) where fim is null;
create index if not exists ix_comercial_sessoes_grupo on public.comercial_sessoes_grupo (id_grupo, inicio);

-- ── 3) Intervenções do grupo ──────────────────────────────────────────────────
create table if not exists public.comercial_grupo_intervencoes (
  id_item        text primary key default ('CGI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_grupo       text not null references public.comercial_atendimentos_grupo(id_grupo) on delete cascade,
  setor_chave    text not null,
  setor_nome     text not null,
  id_fator       text not null,
  fator_nome     text not null,
  id_intervencao text,
  nome           text not null check (nullif(btrim(nome), '') is not null),
  modalidade     text,
  responsavel    text,
  prazo_dias     integer check (prazo_dias is null or prazo_dias >= 0),
  empresas       text[] not null default '{}',   -- empresas do grupo em que o setor aparece (o vendedor vê nelas)
  decidido_por   text,
  decidido_em    timestamptz not null default now()
);
create index if not exists ix_comercial_grupo_intervencoes on public.comercial_grupo_intervencoes (id_grupo);
comment on table public.comercial_grupo_intervencoes is
  'Intervenção indicada por risco (setor × fator) na Conciliação por grupo; empresas = onde o vendedor a vê. v356.';

do $do$
declare t text;
begin
  foreach t in array array['comercial_atendimentos_grupo', 'comercial_atendimento_grupo_eventos',
                           'comercial_sessoes_grupo', 'comercial_grupo_intervencoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.comercial_pode_liberar())', t || '_leitura', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $do$;

-- ── 4) Funções ────────────────────────────────────────────────────────────────
-- A última conciliação do grupo existe e não foi reaberta.
create or replace function public.comercial_conciliacao_grupo_fechada(p_id_grupo text)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from (
      select f.id_fechamento from public.psico_conciliacao_grupo_fechamentos f
       where f.id_grupo = p_id_grupo order by f.fechado_em desc limit 1
    ) u
    where not exists (select 1 from public.psico_conciliacao_grupo_reaberturas r where r.id_fechamento = u.id_fechamento)
  );
$$;
revoke execute on function public.comercial_conciliacao_grupo_fechada(text) from public, anon, authenticated;

-- Quem trabalha no grupo: quem libera (comercial_quem) e enxerga todas as empresas do grupo.
create or replace function public.comercial_grupo_quem(p_id_grupo text, out r_id text, out r_nome text, out r_email text)
  returns record language plpgsql stable security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.comercial_quem();
  if not public.psico_caller_ve_grupo(p_id_grupo) then
    raise exception 'Sem acesso a todas as empresas deste grupo' using errcode = '42501';
  end if;
  r_id := q.r_id; r_nome := q.r_nome; r_email := q.r_email;
end $$;

create or replace function public.comercial_grupo_sessoes_fechar_inativas()
  returns void language sql security definer set search_path = public as $$
  update public.comercial_sessoes_grupo
     set fim = ultima_atividade, motivo_fim = 'INATIVIDADE', fechada_auto = true
   where fim is null and ultima_atividade < now() - interval '30 minutes';
$$;

create or replace function public.comercial_grupo_sessao_iniciar(p_id_grupo text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_id text;
  v_status text;
begin
  select * into q from public.comercial_grupo_quem(p_id_grupo);
  perform public.comercial_grupo_sessoes_fechar_inativas();
  perform public.comercial_sessoes_fechar_inativas();

  insert into public.comercial_atendimentos_grupo (id_grupo, criado_por) values (p_id_grupo, q.r_nome)
    on conflict (id_grupo) do nothing;
  select status into v_status from public.comercial_atendimentos_grupo where id_grupo = p_id_grupo;
  if v_status = 'CONCLUIDO' then
    raise exception 'Atendimento concluído: reabra para continuar' using errcode = 'P0001';
  end if;

  select id_sessao into v_id from public.comercial_sessoes_grupo
   where id_usuario = q.r_id and fim is null and id_grupo = p_id_grupo;
  if v_id is not null then
    return v_id;
  end if;
  -- Uma sessão aberta por pessoa: fecha a de outro grupo e a de uma empresa (como TROCA).
  update public.comercial_sessoes_grupo set fim = now(), motivo_fim = 'TROCA' where id_usuario = q.r_id and fim is null;
  update public.comercial_sessoes set fim = now(), motivo_fim = 'TROCA' where id_usuario = q.r_id and fim is null;
  insert into public.comercial_sessoes_grupo (id_grupo, id_usuario, nome, email)
    values (p_id_grupo, q.r_id, q.r_nome, q.r_email) returning id_sessao into v_id;
  return v_id;
end $$;

create or replace function public.comercial_grupo_sessao_pausar(p_id_grupo text, p_motivo text)
  returns void language plpgsql security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.comercial_grupo_quem(p_id_grupo);
  if p_motivo not in ('PAUSA', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_TECNICO', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE') then
    raise exception 'Motivo de pausa inválido' using errcode = '22023';
  end if;
  update public.comercial_sessoes_grupo set fim = now(), motivo_fim = p_motivo
   where id_usuario = q.r_id and id_grupo = p_id_grupo and fim is null;
end $$;

create or replace function public.comercial_grupo_sessao_atividade(p_id_grupo text)
  returns boolean language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_n integer;
begin
  select * into q from public.comercial_grupo_quem(p_id_grupo);
  perform public.comercial_grupo_sessoes_fechar_inativas();
  update public.comercial_sessoes_grupo set ultima_atividade = now()
   where id_usuario = q.r_id and id_grupo = p_id_grupo and fim is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

create or replace function public.comercial_grupo_exige_sessao(p_id_grupo text, out r_nome text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_status text;
begin
  select * into q from public.comercial_grupo_quem(p_id_grupo);
  r_nome := q.r_nome;
  select status into v_status from public.comercial_atendimentos_grupo where id_grupo = p_id_grupo;
  if v_status is distinct from 'EM_ANDAMENTO' then
    raise exception 'O atendimento não está em andamento' using errcode = 'P0001';
  end if;
  update public.comercial_sessoes_grupo set ultima_atividade = now()
   where id_usuario = q.r_id and id_grupo = p_id_grupo and fim is null
     and ultima_atividade >= now() - interval '30 minutes';
  if not found then
    raise exception 'Clique em Iniciar para continuar o atendimento' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.comercial_grupo_intervencao_salvar(
  p_id_item text, p_id_grupo text, p_setor_chave text, p_setor_nome text, p_id_fator text, p_fator_nome text,
  p_id_intervencao text, p_nome text, p_modalidade text, p_responsavel text, p_prazo_dias integer, p_empresas text[])
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_id text;
  -- Só empresas que são do grupo.
  v_empresas text[] := coalesce((select array_agg(e.id_empresa order by e.id_empresa) from public.empresas e
                                  where e.id_grupo = p_id_grupo and e.id_empresa = any (coalesce(p_empresas, '{}'))), '{}');
begin
  v_nome := public.comercial_grupo_exige_sessao(p_id_grupo);
  if p_id_item is null then
    insert into public.comercial_grupo_intervencoes
      (id_grupo, setor_chave, setor_nome, id_fator, fator_nome, id_intervencao, nome, modalidade, responsavel, prazo_dias, empresas, decidido_por)
    values (p_id_grupo, p_setor_chave, p_setor_nome, p_id_fator, p_fator_nome, p_id_intervencao, btrim(p_nome),
            nullif(p_modalidade, ''), nullif(btrim(p_responsavel), ''), p_prazo_dias, v_empresas, v_nome)
    returning id_item into v_id;
  else
    update public.comercial_grupo_intervencoes
       set id_intervencao = p_id_intervencao, nome = btrim(p_nome), modalidade = nullif(p_modalidade, ''),
           responsavel = nullif(btrim(p_responsavel), ''), prazo_dias = p_prazo_dias,
           empresas = case when cardinality(v_empresas) > 0 then v_empresas else empresas end,
           decidido_por = v_nome, decidido_em = now()
     where id_item = p_id_item and id_grupo = p_id_grupo
     returning id_item into v_id;
    if v_id is null then
      raise exception 'Intervenção não encontrada neste atendimento' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.comercial_grupo_intervencao_retirar(p_id_grupo text, p_id_item text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.comercial_grupo_exige_sessao(p_id_grupo);
  delete from public.comercial_grupo_intervencoes where id_grupo = p_id_grupo and id_item = p_id_item;
end $$;

create or replace function public.comercial_grupo_salvar_parecer(p_id_grupo text, p_parecer text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.comercial_grupo_exige_sessao(p_id_grupo);
  update public.comercial_atendimentos_grupo set parecer = nullif(btrim(p_parecer), '') where id_grupo = p_id_grupo;
end $$;

create or replace function public.comercial_grupo_concluir(p_id_grupo text, p_parecer text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_parecer text := nullif(btrim(p_parecer), '');
begin
  v_nome := public.comercial_grupo_exige_sessao(p_id_grupo);
  if not public.comercial_conciliacao_grupo_fechada(p_id_grupo) then
    raise exception 'Feche a conciliação antes de liberar' using errcode = 'P0001';
  end if;
  if v_parecer is null then
    raise exception 'Escreva o parecer antes de liberar' using errcode = '22023';
  end if;
  update public.comercial_atendimentos_grupo
     set status = 'CONCLUIDO', parecer = v_parecer, concluido_em = now(), concluido_por = v_nome
   where id_grupo = p_id_grupo;
  update public.comercial_sessoes_grupo set fim = now(), motivo_fim = 'CONCLUIDO'
   where id_grupo = p_id_grupo and fim is null;
  insert into public.comercial_atendimento_grupo_eventos (id_grupo, tipo, parecer, por)
    values (p_id_grupo, 'CONCLUIDO', v_parecer, v_nome);
end $$;

create or replace function public.comercial_grupo_reabrir(p_id_grupo text, p_motivo text)
  returns void language plpgsql security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.comercial_grupo_quem(p_id_grupo);
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Escreva o motivo da reabertura' using errcode = '22023';
  end if;
  update public.comercial_atendimentos_grupo
     set status = 'EM_ANDAMENTO', concluido_em = null, concluido_por = null
   where id_grupo = p_id_grupo and status = 'CONCLUIDO';
  if not found then
    raise exception 'O atendimento não está concluído' using errcode = 'P0001';
  end if;
  insert into public.comercial_atendimento_grupo_eventos (id_grupo, tipo, motivo, por)
    values (p_id_grupo, 'REABERTO', btrim(p_motivo), q.r_nome);
end $$;

-- Reabre a conciliação do grupo (registro à parte; a foto não muda) e, se estava liberada, o atendimento junto.
create or replace function public.comercial_reabrir_conciliacao_grupo(p_id_grupo text, p_id_fechamento text, p_motivo text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_nome text;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not (public.caller_pode_editar() and public.psico_caller_ve_grupo(p_id_grupo)) then
    raise exception 'Sem acesso a este grupo' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Escreva o motivo da reabertura' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(u.nome), ''), u.email) into v_nome from public.usuarios u where lower(u.email) = v_email limit 1;
  -- O gatilho da v354 confere que é a última conciliação do grupo.
  insert into public.psico_conciliacao_grupo_reaberturas (id_reabertura, id_fechamento, id_grupo, motivo, reaberto_por)
  values ('PGR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), p_id_fechamento, p_id_grupo, v_motivo, v_email);

  update public.comercial_atendimentos_grupo
     set status = 'EM_ANDAMENTO', concluido_em = null, concluido_por = null
   where id_grupo = p_id_grupo and status = 'CONCLUIDO';
  if found then
    insert into public.comercial_atendimento_grupo_eventos (id_grupo, tipo, motivo, por)
    values (p_id_grupo, 'REABERTO', 'Conciliação reaberta: ' || v_motivo, coalesce(v_nome, v_email));
  end if;
end $$;

do $do$
declare f text;
begin
  foreach f in array array[
    'comercial_grupo_quem(text)', 'comercial_grupo_sessoes_fechar_inativas()', 'comercial_grupo_exige_sessao(text)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'comercial_grupo_sessao_iniciar(text)', 'comercial_grupo_sessao_pausar(text, text)', 'comercial_grupo_sessao_atividade(text)',
    'comercial_grupo_intervencao_salvar(text, text, text, text, text, text, text, text, text, text, integer, text[])',
    'comercial_grupo_intervencao_retirar(text, text)', 'comercial_grupo_salvar_parecer(text, text)',
    'comercial_grupo_concluir(text, text)', 'comercial_grupo_reabrir(text, text)',
    'comercial_reabrir_conciliacao_grupo(text, text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $do$;

-- ── 5) Venda: a intervenção também pode ser do grupo (igual à v329, com o trecho do grupo) ──
create or replace function public.comercial_venda_registrar(
  p_id_empresa text, p_produto text, p_observacao text default null, p_id_item text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  u record;
  v_item text := coalesce(btrim(p_id_item), '');
begin
  select coalesce(nullif(btrim(x.nome), ''), x.email) as nome, lower(x.email) as email into u
    from public.usuarios x
   where lower(x.email) = lower(auth.jwt() ->> 'email') and x.ativo_sistema = true
     and (x.perfil = 'Admin' or x.modulos_permitidos is null or 'comercial' = any(x.modulos_permitidos))
   limit 1;
  if u.email is null then
    raise exception 'Sem permissão para registrar a venda' using errcode = '42501';
  end if;
  -- Venda de uma intervenção: só psicossocial, e a intervenção tem de ser da empresa.
  -- v356: ou do atendimento do grupo, quando a empresa está entre as empresas do item.
  if v_item <> '' and (p_produto <> 'Intervenção psicossocial' or not (
       exists (select 1 from public.comercial_atendimento_intervencoes i
                where i.id_item = v_item and i.id_empresa = p_id_empresa)
       or exists (select 1 from public.comercial_grupo_intervencoes gi
                   where gi.id_item = v_item and p_id_empresa = any (gi.empresas)))) then
    raise exception 'Intervenção não encontrada nesta empresa' using errcode = '22023';
  end if;
  insert into public.comercial_vendas (id_empresa, produto, id_item, observacao, vendido_por, vendido_por_email)
  values (p_id_empresa, p_produto, v_item, nullif(btrim(p_observacao), ''), u.nome, u.email)
  on conflict (id_empresa, produto, id_item) do update set
    observacao = excluded.observacao,
    vendido_por = excluded.vendido_por,
    vendido_por_email = excluded.vendido_por_email,
    vendido_em = now();
end $$;

-- ── 6) comercial_dados: igual à v331, com a chave "grupos" ──
create or replace function public.comercial_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_ok boolean;
  -- Quem libera vê o trabalho em andamento. O vendedor só recebe o que está concluído.
  v_libera boolean := public.comercial_pode_liberar();
begin
  select (u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos)
          or 'consolidacao_psicossocial' = any(u.modulos_permitidos))
    into v_ok
    from public.usuarios u
   where lower(u.email) = v_email and u.ativo_sistema = true
   limit 1;
  if not coalesce(v_ok, false) then
    raise exception 'Sem permissão para o módulo Comercial' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'aeps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_relatorio', a.id_relatorio,
        'id_empresa', a.id_empresa,
        'status', a.status,
        'setores', a.setores,
        'responsavel_elaboracao', a.responsavel_elaboracao,
        'data_elaboracao', a.data_elaboracao,
        'id_inspecao', a.id_inspecao,
        'entregue_em', case when a.id_inspecao is not null then i.elaboracao_concluida_em else a.concluido_em end,
        'enviado_por', i.elaboracao_responsavel,
        'liberado_comercial_em', a.liberado_comercial_em,
        'liberado_comercial_por', a.liberado_comercial_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.aep_relatorios a
        join public.empresas e on e.id_empresa = a.id_empresa
        left join public.inspecoes i on i.id_inspecao = a.id_inspecao
       where a.liberado_comercial_em is not null
         and ((a.id_inspecao is not null and i.elaboracao_status = 'CONCLUIDO' and i.status <> 'DELETADA')
           or (a.id_inspecao is null and a.status = 'CONCLUIDO'))
    ), '[]'::jsonb),
    'inspecoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_inspecao', i.id_inspecao,
        'id_empresa', i.id_empresa,
        'concluida_em', coalesce(i.concluida_em, i.updated_at),
        'responsavel', i.responsavel,
        'liberado_comercial_em', i.liberado_comercial_em,
        'liberado_comercial_por', i.liberado_comercial_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email),
        'maquinas', coalesce((
          -- v331: os setores da máquina vêm da ligação da v160 (inspecao_maquinas.id_setor ficou congelado).
          select jsonb_agg(jsonb_build_object('nome', m.nome, 'grau_risco', m.grau_risco, 'adequacao', m.necessita_adequacao_nr12,
                                              'setores', coalesce((
                                                select jsonb_agg(distinct sm.setor_ghe)
                                                  from public.inspecao_maquinas_setores ims
                                                  join public.setores sm on sm.id_setor = ims.id_setor
                                                 where ims.id_maquina_inspecao = m.id_maquina_inspecao
                                                   and nullif(btrim(sm.setor_ghe), '') is not null), '[]'::jsonb)))
            from public.inspecao_maquinas m
           where m.id_inspecao = i.id_inspecao and m.ativo is not false
             and (m.necessita_adequacao_nr12 or m.grau_risco in ('ALTO', 'CRITICO'))), '[]'::jsonb),
        'medicoes', coalesce((
          select jsonb_agg(jsonb_build_object('agente', r.agente, 'qual', r.fisico_qual_medicao, 'setor', s.setor_ghe))
            from public.riscos r left join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Físico' and r.fisico_necessita_medicao = 'Sim'), '[]'::jsonb),
        'quimicos', coalesce((
          select jsonb_agg(distinct coalesce(nullif(trim(r.agente), ''), 'Agente químico'))
            from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Químico'), '[]'::jsonb),
        'quimicos_setores', coalesce((
          select jsonb_agg(distinct s.setor_ghe)
            from public.riscos r join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Químico' and nullif(btrim(s.setor_ghe), '') is not null), '[]'::jsonb),
        'psicossociais_setores', coalesce((
          select jsonb_agg(distinct s.setor_ghe)
            from public.riscos r join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Psicossocial' and nullif(btrim(s.setor_ghe), '') is not null), '[]'::jsonb),
        'ergonomicos', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Ergonômico'),
        'psicossociais', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Psicossocial'),
        'treinamentos', coalesce((
          select jsonb_agg(jsonb_build_object('nr', t.nr, 'titulo', t.titulo) order by t.ordem)
            from public.treinamentos_nr t where t.id_inspecao = i.id_inspecao and t.ativo is not false), '[]'::jsonb)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.inspecoes x
           where x.status = 'CONCLUIDA' and x.liberado_comercial_em is not null
           order by x.id_empresa, coalesce(x.concluida_em, x.updated_at) desc nulls last
        ) i
        join public.empresas e on e.id_empresa = i.id_empresa
    ), '[]'::jsonb),
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id_empresa', d.id_empresa, 'tipo', d.tipo, 'status', d.status, 'data', d.data))
        from (
          select id_empresa, 'DRPS'::text as tipo, status,
                 coalesce(data_envio_cliente::timestamptz, data_conclusao::timestamptz, data_elaboracao::timestamptz, updated_at) as data
            from public.drps_relatorios
          union all select id_empresa, 'QPS', status, coalesce(data_elaboracao::timestamptz, atualizado_em) from public.qps_aplicacoes
          union all select id_empresa, 'AET', status, coalesce(updated_at, created_at) from public.aet_relatorios
          union all select id_empresa, 'AEP', status, coalesce(concluido_em, updated_at, created_at) from public.aep_relatorios
          union all select id_empresa, 'APRECIACAO', status, coalesce(finalizado_em, updated_at, created_at) from public.apreciacoes_maquinas
          union all select id_empresa, 'QUIMICOS', 'CONCLUIDO', coalesce(updated_at, created_at) from public.analises_quimicos
        ) d
       where d.id_empresa is not null
    ), '[]'::jsonb),
    'certificados', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id_empresa', c.id_empresa, 'nr', c.nr))
        from public.certificados_treinamento c where c.id_empresa is not null
    ), '[]'::jsonb),
    'atendimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_empresa', t.id_empresa, 'status', t.status, 'parecer', t.parecer,
        'concluido_em', t.concluido_em, 'concluido_por', t.concluido_por,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.comercial_atendimentos t
        join public.empresas e on e.id_empresa = t.id_empresa
       where v_libera or (t.status = 'CONCLUIDO' and public.comercial_conciliacao_fechada(t.id_empresa))
    ), '[]'::jsonb),
    'intervencoes', coalesce((
      select jsonb_agg(to_jsonb(x)) from public.comercial_atendimento_intervencoes x
       where v_libera or exists (
         select 1 from public.comercial_atendimentos t
          where t.id_empresa = x.id_empresa and t.status = 'CONCLUIDO'
            and public.comercial_conciliacao_fechada(t.id_empresa))
    ), '[]'::jsonb),
    'vendas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_empresa', v.id_empresa, 'produto', v.produto, 'id_item', v.id_item, 'observacao', v.observacao,
        'vendido_por', v.vendido_por, 'vendido_por_email', v.vendido_por_email, 'vendido_em', v.vendido_em,
        'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf))
        from public.comercial_vendas v
        join public.empresas e on e.id_empresa = v.id_empresa
    ), '[]'::jsonb),
    'conciliacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_fechamento', f.id_fechamento, 'id_empresa', f.id_empresa, 'fechado_em', f.fechado_em,
        'fechado_por', f.fechado_por,
        -- Só os riscos e só o que a tela usa: o resto da foto (justificativa, níveis) é da equipe.
        'itens', coalesce((
          select jsonb_agg(jsonb_build_object(
            'setor', it ->> 'setor', 'setor_chave', it ->> 'setor_chave', 'id_fator', it ->> 'id_fator',
            'fator', it ->> 'fator', 'questionario', it ->> 'questionario', 'decisao', it ->> 'decisao'))
            from jsonb_array_elements(f.itens) it
           where it ->> 'decisao' in ('CONFIRMAR', 'AET')
        ), '[]'::jsonb),
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.psico_conciliacao_fechamentos x
           order by x.id_empresa, x.fechado_em desc
        ) f
        join public.empresas e on e.id_empresa = f.id_empresa
       where public.comercial_conciliacao_fechada(f.id_empresa)
         and (v_libera or exists (
           select 1 from public.comercial_atendimentos t
            where t.id_empresa = f.id_empresa and t.status = 'CONCLUIDO'))
    ), '[]'::jsonb),
    -- v356: atendimentos de GRUPO (Conciliação por grupo › Liberar). O vendedor só recebe o concluído com a conciliação
    -- do grupo fechada; quem libera vê todos. Cada um leva as empresas do grupo, as intervenções (com as empresas que
    -- têm o setor) e os riscos Confirmar/AET do último fechamento do grupo.
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_grupo', t.id_grupo, 'nome_grupo', g.nome, 'status', t.status, 'parecer', t.parecer,
        'concluido_em', t.concluido_em, 'concluido_por', t.concluido_por,
        'fechada', public.comercial_conciliacao_grupo_fechada(t.id_grupo),
        'empresas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id_empresa', e.id_empresa, 'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
            'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email) order by e.nome_empresa)
            from public.empresas e where e.id_grupo = t.id_grupo), '[]'::jsonb),
        'intervencoes', coalesce((
          select jsonb_agg(to_jsonb(x) order by x.setor_nome, x.fator_nome)
            from public.comercial_grupo_intervencoes x where x.id_grupo = t.id_grupo), '[]'::jsonb),
        'itens', coalesce((
          select jsonb_agg(jsonb_build_object(
            'setor', it ->> 'setor', 'setor_chave', it ->> 'setor_chave', 'id_fator', it ->> 'id_fator',
            'fator', it ->> 'fator', 'questionario', it ->> 'questionario', 'decisao', it ->> 'decisao',
            'id_empresas', coalesce(it -> 'id_empresas', '[]'::jsonb)))
            from (
              select f.itens from public.psico_conciliacao_grupo_fechamentos f
               where f.id_grupo = t.id_grupo order by f.fechado_em desc limit 1
            ) u, jsonb_array_elements(u.itens) it
           where it ->> 'decisao' in ('CONFIRMAR', 'AET')
        ), '[]'::jsonb)))
        from public.comercial_atendimentos_grupo t
        join public.empresa_grupos g on g.id_grupo = t.id_grupo
       where v_libera or (t.status = 'CONCLUIDO' and public.comercial_conciliacao_grupo_fechada(t.id_grupo))
    ), '[]'::jsonb)
  );
end $$;

notify pgrst, 'reload schema';

commit;
