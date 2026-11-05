-- v321 — Consolidação › Liberar para o Comercial (05/11/2026, 0.3.233).
--
-- Até aqui a liberação era do documento inteiro: liberar uma inspeção soltava todas as
-- oportunidades dela. Agora cada empresa tem um ATENDIMENTO, feito por quem está na Consolidação
-- (não precisa do módulo Comercial):
--   comercial_atendimentos       — um por empresa: Em andamento ou Concluído, com o parecer;
--   comercial_atendimento_eventos — histórico de conclusões e reaberturas (com o motivo);
--   comercial_sessoes            — o tempo trabalhado, igual ao da inspeção (Iniciar/Pausar, pausa
--                                  sozinha com 30 min parado). Sem pg_cron: quem inicia ou avisa
--                                  atividade fecha as paradas, e a tela já conta até a última atividade;
--   comercial_liberacoes         — a decisão de cada serviço (LIBERADO, com modalidades e orientação;
--                                  SEGURADO, com motivo);
--   comercial_intervencoes       — o catálogo de intervenções, editável por quem libera;
--   comercial_atendimento_intervencoes — as intervenções indicadas à empresa, com o nome gravado
--                                  (excluir do catálogo não apaga o que já foi indicado).
--
-- Decidir, indicar e escrever o parecer exigem a sessão aberta de quem faz e o atendimento em
-- andamento. O vendedor só vê o liberado depois de concluído; reabrir tira até concluir de novo.
-- O que já estava liberado antes desta migração continua visível (comercial_corte_fila), decisão
-- do João em 05/11/2026. A regra da tela está em lib/comercial/liberacao.ts.
--
-- Quem faz: comercial_pode_liberar() — Admin, ou Técnico com o módulo consolidacao_psicossocial.
-- comercial_dados() passa a aceitar também quem tem esse módulo, para ler a fila.
-- REAPLICAR: idempotente; o corte não muda e a semente só entra na primeira vez.
-- Rollback: scripts/sql/v321_comercial_liberacoes_rollback.sql
begin;

create or replace function public.comercial_pode_liberar()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo_sistema = true
       and (u.perfil = 'Admin'
         or (u.perfil = 'Tecnico'
             and (u.modulos_permitidos is null or 'consolidacao_psicossocial' = any(u.modulos_permitidos))))
  );
$$;
revoke execute on function public.comercial_pode_liberar() from public, anon;
grant execute on function public.comercial_pode_liberar() to authenticated;

create table if not exists public.comercial_atendimentos (
  id_empresa    text primary key references public.empresas(id_empresa) on delete cascade,
  status        text not null default 'EM_ANDAMENTO' check (status in ('EM_ANDAMENTO', 'CONCLUIDO')),
  parecer       text,
  concluido_em  timestamptz,
  concluido_por text,
  criado_em     timestamptz not null default now(),
  criado_por    text
);
comment on table public.comercial_atendimentos is
  'Liberação de serviços ao Comercial, um atendimento por empresa. O vendedor só vê o liberado com o atendimento CONCLUIDO.';

create table if not exists public.comercial_atendimento_eventos (
  id_evento  bigint generated always as identity primary key,
  id_empresa text not null references public.comercial_atendimentos(id_empresa) on delete cascade,
  tipo       text not null check (tipo in ('CONCLUIDO', 'REABERTO')),
  motivo     text,
  parecer    text,
  por        text,
  em         timestamptz not null default now()
);
create index if not exists ix_comercial_eventos_empresa on public.comercial_atendimento_eventos (id_empresa, em);

create table if not exists public.comercial_sessoes (
  id_sessao        text primary key default ('CSE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_empresa       text not null references public.comercial_atendimentos(id_empresa) on delete cascade,
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
create unique index if not exists ux_comercial_sessao_aberta on public.comercial_sessoes (id_usuario) where fim is null;
create index if not exists ix_comercial_sessoes_empresa on public.comercial_sessoes (id_empresa, inicio);

create table if not exists public.comercial_liberacoes (
  id_empresa   text not null references public.comercial_atendimentos(id_empresa) on delete cascade,
  produto      text not null check (produto in (
                 'AET', 'DRPS/Questionário', 'Apreciação NR-12', 'Medição quantitativa',
                 'Análise de Químicos', 'Treinamentos NR')),
  status       text not null check (status in ('LIBERADO', 'SEGURADO')),
  modalidades  text[] not null default '{}'
                 check (modalidades <@ array['EAD', 'Presencial', 'Ao vivo']::text[]),
  orientacao   text,
  motivo       text,
  decidido_por text,
  decidido_em  timestamptz not null default now(),
  primary key (id_empresa, produto),
  constraint comercial_liberacoes_motivo_segurado
    check (status <> 'SEGURADO' or nullif(btrim(motivo), '') is not null)
);
comment on table public.comercial_liberacoes is
  'Decisão vigente sobre cada serviço indicado (empresa × produto). Vale até o documento de origem ser reenviado. Sem linha: serviço na fila, ou já liberado antes da fila (comercial_corte_fila).';

create table if not exists public.comercial_intervencoes (
  id_intervencao text primary key default ('INT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  nome           text not null check (nullif(btrim(nome), '') is not null),
  modalidades    text[] not null default '{}'
                   check (modalidades <@ array['EAD', 'Presencial', 'Ao vivo']::text[]),
  observacao     text,
  responsavel    text,
  ativo          boolean not null default true,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now()
);
create unique index if not exists ux_comercial_intervencoes_nome on public.comercial_intervencoes (lower(btrim(nome)));
comment on table public.comercial_intervencoes is
  'Catálogo de intervenções psicossociais vendidas pelo Comercial. Editado em Consolidação › Intervenções.';

create table if not exists public.comercial_atendimento_intervencoes (
  id_empresa     text not null references public.comercial_atendimentos(id_empresa) on delete cascade,
  id_intervencao text not null,
  nome           text not null,
  responsavel    text,
  modalidades    text[] not null default '{}',
  orientacao     text,
  decidido_por   text,
  decidido_em    timestamptz not null default now(),
  primary key (id_empresa, id_intervencao)
);

-- Leitura: quem libera. A escrita do catálogo é direta; o resto, só pelas funções abaixo.
do $do$
declare t text;
begin
  foreach t in array array['comercial_atendimentos', 'comercial_atendimento_eventos', 'comercial_sessoes',
                           'comercial_liberacoes', 'comercial_atendimento_intervencoes', 'comercial_intervencoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.comercial_pode_liberar())', t || '_leitura', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end $do$;

grant insert, update, delete on public.comercial_intervencoes to authenticated;
drop policy if exists comercial_intervencoes_escrita on public.comercial_intervencoes;
create policy comercial_intervencoes_escrita on public.comercial_intervencoes for all to authenticated
  using (public.comercial_pode_liberar()) with check (public.comercial_pode_liberar());

-- Semente: a planilha "Intervenções Psicossocial" do setor (05/11/2026), com dois erros de grafia
-- corrigidos. Só entra com o catálogo vazio, para reaplicar não devolver o que foi excluído.
do $do$
begin
  if not exists (select 1 from public.comercial_intervencoes) then
    insert into public.comercial_intervencoes (nome, modalidades, observacao, responsavel, ordem) values
      ('Treinamento Integração NR-01', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 1),
      ('Treinamento Saúde Mental', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 2),
      ('Treinamento Inteligência Emocional', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 3),
      ('Treinamento Comunicação Assertiva', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 4),
      ('Treinamento Foco e Concentração', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 5),
      ('Treinamento Relações Interpessoais', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 6),
      ('Treinamento Liderança no Ambiente de Trabalho', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 7),
      ('Treinamento Gestão de Estresse', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 8),
      ('Treinamento Valorização e Reconhecimento', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 9),
      ('Treinamento Trabalho Sob Pressão', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 10),
      ('Treinamento Primeiros Socorros Psicológicos', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 11),
      ('Treinamento Assédio de Qualquer Natureza', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 12),
      ('Treinamento Síndrome de Burnout', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 13),
      ('Treinamento Trabalho Remoto', array['EAD'], 'Plataforma Chabra', 'Equipe EAD + Equipe Psicossocial', 14),
      ('Capacitação para Liderança e Gestores', array['Ao vivo'], 'Online. Tema de acordo com a necessidade da empresa, conforme as temáticas oferecidas pela Chabra.', 'Sanmyo', 15),
      ('Mobilização e conscientização com funcionários', array['Presencial', 'Ao vivo'], 'Presencial ou online, a depender da quantidade de funcionários e do escopo de trabalho. Tema de acordo com a necessidade da empresa, conforme as temáticas oferecidas pela Chabra.', 'Sanmyo', 16);
  end if;
end $do$;

-- O instante desta migração fica gravado na função. Reaplicar o script não pode mover o corte,
-- por isso o create só roda se a função ainda não existir.
do $do$
begin
  if to_regprocedure('public.comercial_corte_fila()') is null then
    execute format(
      'create function public.comercial_corte_fila() returns timestamptz language sql immutable as $f$ select %L::timestamptz $f$',
      now());
  end if;
end $do$;
revoke execute on function public.comercial_corte_fila() from public, anon, authenticated;

create or replace function public.comercial_quem(out r_id text, out r_nome text, out r_email text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.comercial_pode_liberar() then
    raise exception 'Sem permissão para liberar serviços ao Comercial' using errcode = '42501';
  end if;
  select u.id_usuario, coalesce(nullif(btrim(u.nome), ''), u.email), u.email into r_id, r_nome, r_email
    from public.usuarios u where lower(u.email) = lower(auth.jwt() ->> 'email') limit 1;
end $$;
revoke execute on function public.comercial_quem() from public, anon, authenticated;

create or replace function public.comercial_sessoes_fechar_inativas()
  returns void language sql security definer set search_path = public as $$
  update public.comercial_sessoes
     set fim = ultima_atividade, motivo_fim = 'INATIVIDADE', fechada_auto = true
   where fim is null and ultima_atividade < now() - interval '30 minutes';
$$;
revoke execute on function public.comercial_sessoes_fechar_inativas() from public, anon, authenticated;

-- Abre o atendimento na primeira vez. Com outro atendimento meu aberto, fecha como TROCA.
create or replace function public.comercial_sessao_iniciar(p_id_empresa text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_id text;
  v_status text;
begin
  select * into q from public.comercial_quem();
  perform public.comercial_sessoes_fechar_inativas();

  insert into public.comercial_atendimentos (id_empresa, criado_por) values (p_id_empresa, q.r_nome)
    on conflict (id_empresa) do nothing;
  select status into v_status from public.comercial_atendimentos where id_empresa = p_id_empresa;
  if v_status = 'CONCLUIDO' then
    raise exception 'Atendimento concluído: reabra para continuar' using errcode = 'P0001';
  end if;

  select id_sessao into v_id from public.comercial_sessoes
   where id_usuario = q.r_id and fim is null and id_empresa = p_id_empresa;
  if v_id is not null then
    return v_id;
  end if;
  update public.comercial_sessoes set fim = now(), motivo_fim = 'TROCA'
   where id_usuario = q.r_id and fim is null;
  insert into public.comercial_sessoes (id_empresa, id_usuario, nome, email)
    values (p_id_empresa, q.r_id, q.r_nome, q.r_email) returning id_sessao into v_id;
  return v_id;
end $$;

create or replace function public.comercial_sessao_pausar(p_id_empresa text, p_motivo text)
  returns void language plpgsql security definer set search_path = public as $$
declare q record;
begin
  select * into q from public.comercial_quem();
  if p_motivo not in ('PAUSA', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_TECNICO', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE') then
    raise exception 'Motivo de pausa inválido' using errcode = '22023';
  end if;
  update public.comercial_sessoes set fim = now(), motivo_fim = p_motivo
   where id_usuario = q.r_id and id_empresa = p_id_empresa and fim is null;
end $$;

create or replace function public.comercial_sessao_atividade(p_id_empresa text)
  returns boolean language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_n integer;
begin
  select * into q from public.comercial_quem();
  perform public.comercial_sessoes_fechar_inativas();
  update public.comercial_sessoes set ultima_atividade = now()
   where id_usuario = q.r_id and id_empresa = p_id_empresa and fim is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- Guarda de quem altera o atendimento: atendimento em andamento e a minha sessão ativa.
create or replace function public.comercial_exige_sessao(p_id_empresa text, out r_nome text)
  language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_status text;
begin
  select * into q from public.comercial_quem();
  r_nome := q.r_nome;
  select status into v_status from public.comercial_atendimentos where id_empresa = p_id_empresa;
  if v_status is distinct from 'EM_ANDAMENTO' then
    raise exception 'O atendimento não está em andamento' using errcode = 'P0001';
  end if;
  update public.comercial_sessoes set ultima_atividade = now()
   where id_usuario = q.r_id and id_empresa = p_id_empresa and fim is null
     and ultima_atividade >= now() - interval '30 minutes';
  if not found then
    raise exception 'Clique em Iniciar para continuar o atendimento' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.comercial_exige_sessao(text) from public, anon, authenticated;

create or replace function public.comercial_decidir(
  p_id_empresa text,
  p_produtos text[],
  p_status text,
  p_modalidades text[] default '{}',
  p_orientacao text default null,
  p_motivo text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
begin
  v_nome := public.comercial_exige_sessao(p_id_empresa);
  if coalesce(array_length(p_produtos, 1), 0) = 0 then
    raise exception 'Escolha ao menos um serviço' using errcode = '22023';
  end if;
  insert into public.comercial_liberacoes
    (id_empresa, produto, status, modalidades, orientacao, motivo, decidido_por, decidido_em)
  select p_id_empresa, p, p_status,
         case when p_status = 'LIBERADO' then coalesce(p_modalidades, '{}') else '{}' end,
         case when p_status = 'LIBERADO' then nullif(btrim(p_orientacao), '') end,
         case when p_status = 'SEGURADO' then nullif(btrim(p_motivo), '') end,
         v_nome, now()
    from unnest(p_produtos) as p
  on conflict (id_empresa, produto) do update set
    status = excluded.status,
    modalidades = excluded.modalidades,
    orientacao = excluded.orientacao,
    motivo = excluded.motivo,
    decidido_por = excluded.decidido_por,
    decidido_em = excluded.decidido_em;
end $$;

create or replace function public.comercial_desfazer_decisao(p_id_empresa text, p_produto text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.comercial_exige_sessao(p_id_empresa);
  delete from public.comercial_liberacoes where id_empresa = p_id_empresa and produto = p_produto;
end $$;

create or replace function public.comercial_intervencao_indicar(
  p_id_empresa text,
  p_id_intervencao text,
  p_modalidades text[] default '{}',
  p_orientacao text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  c record;
begin
  v_nome := public.comercial_exige_sessao(p_id_empresa);
  select * into c from public.comercial_intervencoes where id_intervencao = p_id_intervencao;
  if not found then
    raise exception 'Intervenção não encontrada no catálogo' using errcode = 'P0002';
  end if;
  if not coalesce(p_modalidades, '{}') <@ c.modalidades then
    raise exception 'Modalidade não oferecida nesta intervenção' using errcode = '22023';
  end if;
  insert into public.comercial_atendimento_intervencoes
    (id_empresa, id_intervencao, nome, responsavel, modalidades, orientacao, decidido_por, decidido_em)
  values (p_id_empresa, p_id_intervencao, c.nome, c.responsavel, coalesce(p_modalidades, '{}'),
          nullif(btrim(p_orientacao), ''), v_nome, now())
  on conflict (id_empresa, id_intervencao) do update set
    nome = excluded.nome,
    responsavel = excluded.responsavel,
    modalidades = excluded.modalidades,
    orientacao = excluded.orientacao,
    decidido_por = excluded.decidido_por,
    decidido_em = excluded.decidido_em;
end $$;

create or replace function public.comercial_intervencao_retirar(p_id_empresa text, p_id_intervencao text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.comercial_exige_sessao(p_id_empresa);
  delete from public.comercial_atendimento_intervencoes
   where id_empresa = p_id_empresa and id_intervencao = p_id_intervencao;
end $$;

create or replace function public.comercial_salvar_parecer(p_id_empresa text, p_parecer text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.comercial_exige_sessao(p_id_empresa);
  update public.comercial_atendimentos set parecer = nullif(btrim(p_parecer), '') where id_empresa = p_id_empresa;
end $$;

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

create or replace function public.comercial_reabrir(p_id_empresa text, p_motivo text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  q record;
begin
  select * into q from public.comercial_quem();
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Escreva o motivo da reabertura' using errcode = '22023';
  end if;
  update public.comercial_atendimentos
     set status = 'EM_ANDAMENTO', concluido_em = null, concluido_por = null
   where id_empresa = p_id_empresa and status = 'CONCLUIDO';
  if not found then
    raise exception 'O atendimento não está concluído' using errcode = 'P0001';
  end if;
  insert into public.comercial_atendimento_eventos (id_empresa, tipo, motivo, por)
    values (p_id_empresa, 'REABERTO', btrim(p_motivo), q.r_nome);
end $$;

do $do$
declare f text;
begin
  foreach f in array array[
    'comercial_sessao_iniciar(text)', 'comercial_sessao_pausar(text, text)', 'comercial_sessao_atividade(text)',
    'comercial_decidir(text, text[], text, text[], text, text)', 'comercial_desfazer_decisao(text, text)',
    'comercial_intervencao_indicar(text, text, text[], text)', 'comercial_intervencao_retirar(text, text)',
    'comercial_salvar_parecer(text, text)', 'comercial_concluir(text, text)', 'comercial_reabrir(text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $do$;

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
          select jsonb_agg(jsonb_build_object('nome', m.nome, 'grau_risco', m.grau_risco, 'adequacao', m.necessita_adequacao_nr12))
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
    'liberacoes', coalesce((
      select jsonb_agg(to_jsonb(l)) from public.comercial_liberacoes l
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
    ), '[]'::jsonb),
    'intervencoes', coalesce((
      select jsonb_agg(to_jsonb(x)) from public.comercial_atendimento_intervencoes x
    ), '[]'::jsonb),
    'corte', public.comercial_corte_fila()
  );
end $$;

commit;
