-- v364 — Inspeção: tempo de campo por sessão (19/11/2026, 0.3.314).
--
-- POR QUÊ: pedido do João — "na página de cadastro de inspeção temos o contador de tempo? caso não tenha, como
-- deveria funcionar". Só existia o tempo do DOCUMENTO (v311, associados). Decisões dele (19/11, "seguir com o
-- recomendado"): conta o técnico de campo; começa pelo botão "Iniciar campo" e também sozinho na primeira alteração;
-- deslocamento conta à parte (como o "aguardando cliente"); o técnico vê o próprio tempo e a supervisão vê o de
-- todos. Offline fica para uma segunda etapa.
--
-- O QUE FAZ (mesmo desenho das sessões do Comercial, v321 — tabela própria, sem mexer no tempo do documento):
--   campo_sessoes                 uma linha por período de trabalho de UM técnico numa inspeção: início, última
--                                 atividade, fim, motivo do fim e a origem (BOTAO ou AUTOMATICO, a 1ª alteração).
--                                 Uma sessão de campo aberta por pessoa (índice único parcial): iniciar em outra
--                                 inspeção fecha a anterior (TROCA).
--   campo_sessao_pode(id, u)      técnico de campo da inspeção: o responsável (nome), quem lançou (e-mail) ou quem
--                                 está na aba Responsáveis (id_usuario ou nome).
--   campo_sessao_iniciar(id, origem)  abre (ou devolve a aberta). AUTOMATICO só abre se a pessoa nunca teve sessão de
--                                 campo nesta inspeção (pausou de propósito → não reabre sozinho); devolve null.
--   campo_sessao_pausar(id, motivo)   PAUSA · DESLOCAMENTO · AGUARDANDO_CLIENTE · OUTRA_PRIORIDADE · FIM_EXPEDIENTE.
--   campo_sessao_atividade(id)    "ainda estou aqui" (a tela manda a cada interação, no máximo a cada 2 min).
--   campo_sessoes_fechar_inativas()   fecha as paradas há 30 min no momento da última atividade (INATIVIDADE).
--                                 Sem pg_cron (como o Comercial): roda em cada iniciar/atividade, e a tela já conta
--                                 só até a última atividade.
--   gatilho em inspecoes          concluir a inspeção (status CONCLUIDA) fecha as sessões de campo dela (CONCLUIDO).
--   RLS: lê a equipe interna que enxerga a empresa; ninguém escreve direto — só pelas funções.
--   Sem trilha na auditoria (a atividade atualiza a linha a cada 2 min).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v364_campo_sessoes_tempo_rollback.sql
begin;

do $$ begin
  if to_regprocedure('public.documento_sessao_quem(text)') is null
     or to_regprocedure('public.sem_acento(text)') is null
     or to_regprocedure('public.psico_caller_interno()') is null
     or to_regprocedure('public.caller_pode_ver_empresa(text)') is null
     or to_regprocedure('public.auditoria_desativar(text)') is null then
    raise exception 'v364: falta a v311 (documento_sessao_quem) ou sem_acento/psico_caller_interno/caller_pode_ver_empresa/auditoria_desativar';
  end if;
end $$;

create table if not exists public.campo_sessoes (
  id_sessao        text primary key default ('CPS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_inspecao      text not null references public.inspecoes(id_inspecao) on delete cascade,
  id_usuario       text not null,
  nome             text not null,
  email            text not null,
  inicio           timestamptz not null default now(),
  ultima_atividade timestamptz not null default now(),
  fim              timestamptz,
  motivo_fim       text check (motivo_fim is null or motivo_fim in (
                     'PAUSA', 'DESLOCAMENTO', 'AGUARDANDO_CLIENTE', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE',
                     'TROCA', 'INATIVIDADE', 'CONCLUIDO')),
  fechada_auto     boolean not null default false,
  origem           text not null default 'BOTAO' check (origem in ('BOTAO', 'AUTOMATICO')),
  check (fim is null or fim >= inicio),
  check ((fim is null) = (motivo_fim is null))
);
comment on table public.campo_sessoes is
  'Inspeção: períodos de trabalho de campo de cada técnico (Iniciar/Pausar/Retomar). v364.';
create unique index if not exists ux_campo_sessao_aberta on public.campo_sessoes (id_usuario) where fim is null;
create index if not exists ix_campo_sessoes_inspecao on public.campo_sessoes (id_inspecao, inicio);
create index if not exists ix_campo_sessoes_usuario on public.campo_sessoes (id_usuario, inicio);

select public.auditoria_desativar('campo_sessoes');

alter table public.campo_sessoes enable row level security;
drop policy if exists campo_sessoes_select on public.campo_sessoes;
create policy campo_sessoes_select on public.campo_sessoes for select to authenticated
  using (public.psico_caller_interno() and exists (
    select 1 from public.inspecoes i
     where i.id_inspecao = campo_sessoes.id_inspecao and public.caller_pode_ver_empresa(i.id_empresa)));
revoke insert, update, delete on public.campo_sessoes from anon, authenticated;
grant select on public.campo_sessoes to authenticated;

create or replace function public.campo_sessoes_fechar_inativas()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.campo_sessoes
     set fim = ultima_atividade, motivo_fim = 'INATIVIDADE', fechada_auto = true
   where fim is null and ultima_atividade < now() - interval '30 minutes';
  get diagnostics n = row_count;
  return n;
end $$;

-- Técnico de campo da inspeção: responsável (nome), quem lançou (e-mail) ou quem está na aba Responsáveis.
create or replace function public.campo_sessao_pode(p_id_inspecao text, p_id_usuario text, p_nome text, p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inspecoes i
     where i.id_inspecao = p_id_inspecao
       and ((nullif(btrim(i.responsavel), '') is not null
             and lower(public.sem_acento(btrim(i.responsavel))) = lower(public.sem_acento(btrim(p_nome))))
            or lower(coalesce(i.usuario, '')) = lower(p_email))
  ) or exists (
    select 1 from public.responsaveis r
     where r.id_inspecao = p_id_inspecao
       and (r.id_usuario = p_id_usuario
            or (nullif(btrim(r.tecnico_responsavel), '') is not null
                and lower(public.sem_acento(btrim(r.tecnico_responsavel))) = lower(public.sem_acento(btrim(p_nome)))))
  );
$$;

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

create or replace function public.campo_sessao_atividade(p_id_inspecao text)
returns boolean language plpgsql security definer set search_path = public as $$
declare u public.usuarios; n integer;
begin
  u := public.documento_sessao_quem(p_id_inspecao);
  perform public.campo_sessoes_fechar_inativas();
  update public.campo_sessoes set ultima_atividade = now()
   where id_usuario = u.id_usuario and id_inspecao = p_id_inspecao and fim is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Concluir a inspeção fecha as sessões de campo abertas dela.
create or replace function public.campo_sessoes_fechar_por_status_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status = 'CONCLUIDA' then
    update public.campo_sessoes
       set fim = greatest(now(), inicio), motivo_fim = 'CONCLUIDO'
     where id_inspecao = new.id_inspecao and fim is null;
  end if;
  return null;
end $$;
drop trigger if exists trg_campo_sessoes_fechar_por_status on public.inspecoes;
create trigger trg_campo_sessoes_fechar_por_status
  after update of status on public.inspecoes
  for each row execute function public.campo_sessoes_fechar_por_status_trg();

revoke all on function public.campo_sessoes_fechar_inativas() from public, anon, authenticated;
revoke all on function public.campo_sessao_pode(text, text, text, text) from public, anon, authenticated;
revoke all on function public.campo_sessoes_fechar_por_status_trg() from public, anon, authenticated;
revoke all on function public.campo_sessao_iniciar(text, text) from public, anon;
revoke all on function public.campo_sessao_pausar(text, text) from public, anon;
revoke all on function public.campo_sessao_atividade(text) from public, anon;
grant execute on function public.campo_sessao_iniciar(text, text) to authenticated;
grant execute on function public.campo_sessao_pausar(text, text) to authenticated;
grant execute on function public.campo_sessao_atividade(text) to authenticated;

notify pgrst, 'reload schema';

commit;
