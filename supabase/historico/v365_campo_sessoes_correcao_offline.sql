-- v365 — Tempo de campo, etapa 2: correção pelo supervisor e horário do aparelho (sem sinal) (19/11/2026, 0.3.315).
--
-- POR QUÊ: pedido do João ("rode a etapa 2"): a etapa 1 (v364) deixou para depois a correção da sessão pelo
-- supervisor e o funcionamento sem sinal. No campo falta internet: o play e a pausa ficam guardados no aparelho e
-- são enviados quando a conexão volta — com o HORÁRIO EM QUE ACONTECERAM, não o do envio.
--
-- O QUE FAZ
--   campo_sessoes.corrigida      marca a sessão ajustada pelo supervisor (a tela mostra o selo).
--   campo_sessoes_correcoes      uma linha por correção (antes/depois, justificativa, quem, quando) — o mesmo da
--                                v312 do documento. Ninguém escreve direto; só a função.
--   campo_sessao_corrigir(id_sessao, inicio, fim, justificativa)
--                                só supervisor/admin que enxerga a empresa; fim ≥ início, fim no passado,
--                                justificativa com 5+ letras, sem sobrepor outra sessão de campo da mesma pessoa.
--                                Sessão aberta fecha (PAUSA). Fim = início zera a sessão.
--   campo_sessao_iniciar(id, origem, quando) e campo_sessao_pausar(id, motivo, quando): ganham `quando` (opcional).
--                                Sem ele, é agora (como antes). Com ele (o que ficou guardado sem sinal), vale o
--                                horário do aparelho, limitado: não passa de agora, não volta mais de 24 h e não
--                                sobrepõe a sessão anterior da pessoa. As assinaturas antigas saem (a nova cobre).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v365_campo_sessoes_correcao_offline_rollback.sql
begin;

do $$ begin
  if to_regclass('public.campo_sessoes') is null then raise exception 'v365: falta a v364 (campo_sessoes)'; end if;
end $$;

alter table public.campo_sessoes add column if not exists corrigida boolean not null default false;

create table if not exists public.campo_sessoes_correcoes (
  id_correcao   text primary key default ('CPC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  id_sessao     text not null,
  id_inspecao   text not null references public.inspecoes(id_inspecao) on delete cascade,
  antes         jsonb not null,
  depois        jsonb not null,
  justificativa text not null check (length(btrim(justificativa)) >= 5),
  corrigido_por text not null,
  corrigido_em  timestamptz not null default now()
);
comment on table public.campo_sessoes_correcoes is
  'Inspeção: correções de sessão de tempo de campo pelo supervisor (antes/depois, justificativa). v365.';
create index if not exists ix_campo_sessoes_correcoes_sessao on public.campo_sessoes_correcoes (id_sessao, corrigido_em);
select public.auditoria_desativar('campo_sessoes_correcoes');

alter table public.campo_sessoes_correcoes enable row level security;
drop policy if exists campo_sessoes_correcoes_select on public.campo_sessoes_correcoes;
create policy campo_sessoes_correcoes_select on public.campo_sessoes_correcoes for select to authenticated
  using (public.psico_caller_interno() and exists (
    select 1 from public.inspecoes i
     where i.id_inspecao = campo_sessoes_correcoes.id_inspecao and public.caller_pode_ver_empresa(i.id_empresa)));
revoke insert, update, delete on public.campo_sessoes_correcoes from anon, authenticated;
grant select on public.campo_sessoes_correcoes to authenticated;

create or replace function public.campo_sessao_corrigir(
  p_id_sessao text, p_inicio timestamptz, p_fim timestamptz, p_justificativa text)
returns void language plpgsql security definer set search_path = public as $$
declare u public.usuarios; s public.campo_sessoes; v_empresa text;
begin
  select * into u from public.usuarios
   where lower(email) = lower(auth.jwt() ->> 'email') and ativo_sistema = true limit 1;
  if u.id_usuario is null or not (u.perfil = 'Admin' or u.nivel in ('Aprovacao', 'Admin')) then
    raise exception 'so supervisor ou administrador corrige sessao';
  end if;
  select * into s from public.campo_sessoes where id_sessao = p_id_sessao for update;
  if s.id_sessao is null then raise exception 'sessao nao encontrada'; end if;
  select id_empresa into v_empresa from public.inspecoes where id_inspecao = s.id_inspecao;
  if not public.caller_pode_ver_empresa(v_empresa) then raise exception 'sem acesso a esta empresa'; end if;

  if length(btrim(coalesce(p_justificativa, ''))) < 5 then raise exception 'justificativa obrigatoria'; end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then raise exception 'fim antes do inicio'; end if;
  if p_fim > now() + interval '1 minute' then raise exception 'fim no futuro'; end if;
  if exists (
       select 1 from public.campo_sessoes o
        where o.id_usuario = s.id_usuario and o.id_sessao <> s.id_sessao
          and o.inicio < p_fim and coalesce(o.fim, o.ultima_atividade) > p_inicio) then
    raise exception 'o periodo sobrepoe outra sessao da mesma pessoa';
  end if;

  insert into public.campo_sessoes_correcoes (id_sessao, id_inspecao, antes, depois, justificativa, corrigido_por)
  values (s.id_sessao, s.id_inspecao,
          jsonb_build_object('inicio', s.inicio, 'fim', s.fim, 'motivo_fim', s.motivo_fim),
          jsonb_build_object('inicio', p_inicio, 'fim', least(p_fim, now()), 'motivo_fim', coalesce(s.motivo_fim, 'PAUSA')),
          btrim(p_justificativa), lower(u.email));

  update public.campo_sessoes
     set inicio = p_inicio,
         fim = least(p_fim, now()),
         motivo_fim = coalesce(motivo_fim, 'PAUSA'),
         ultima_atividade = least(p_fim, now()),
         corrigida = true
   where id_sessao = s.id_sessao;
end $$;

-- Horário que vale: o do aparelho (sem sinal), limitado a [agora − 24 h, agora] e depois do fim da sessão anterior.
create or replace function public.campo_quando(p_quando timestamptz, p_id_usuario text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
           least(coalesce(p_quando, now()), now()),
           now() - interval '24 hours',
           coalesce((select max(coalesce(fim, ultima_atividade)) from public.campo_sessoes
                      where id_usuario = p_id_usuario and fim is not null), '-infinity'::timestamptz));
$$;

drop function if exists public.campo_sessao_iniciar(text, text);
create or replace function public.campo_sessao_iniciar(p_id_inspecao text, p_origem text default 'BOTAO', p_quando timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare u public.usuarios; v_status text; v_aberta text; v_id text; v_quando timestamptz;
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
  if coalesce(p_origem, 'BOTAO') = 'AUTOMATICO' and exists (
       select 1 from public.campo_sessoes where id_inspecao = p_id_inspecao and id_usuario = u.id_usuario) then
    return null;
  end if;
  v_quando := public.campo_quando(p_quando, u.id_usuario);
  if v_aberta is not null then
    update public.campo_sessoes set fim = greatest(v_quando, inicio), motivo_fim = 'TROCA' where id_sessao = v_aberta;
  end if;

  insert into public.campo_sessoes (id_inspecao, id_usuario, nome, email, origem, inicio, ultima_atividade)
  values (p_id_inspecao, u.id_usuario, u.nome, lower(u.email), coalesce(p_origem, 'BOTAO'), v_quando, now())
  returning id_sessao into v_aberta;
  return v_aberta;
end $$;

drop function if exists public.campo_sessao_pausar(text, text);
create or replace function public.campo_sessao_pausar(p_id_inspecao text, p_motivo text default 'PAUSA', p_quando timestamptz default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare u public.usuarios; n integer;
begin
  if coalesce(p_motivo, 'PAUSA') not in ('PAUSA', 'DESLOCAMENTO', 'AGUARDANDO_CLIENTE', 'OUTRA_PRIORIDADE', 'FIM_EXPEDIENTE') then
    raise exception 'motivo invalido';
  end if;
  u := public.documento_sessao_quem(p_id_inspecao);
  perform public.campo_sessoes_fechar_inativas();
  update public.campo_sessoes
     set fim = greatest(least(coalesce(p_quando, now()), now()), inicio),
         ultima_atividade = greatest(least(coalesce(p_quando, now()), now()), inicio),
         motivo_fim = coalesce(p_motivo, 'PAUSA')
   where id_usuario = u.id_usuario and id_inspecao = p_id_inspecao and fim is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.campo_quando(timestamptz, text) from public, anon, authenticated;
revoke all on function public.campo_sessao_corrigir(text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.campo_sessao_iniciar(text, text, timestamptz) from public, anon;
revoke all on function public.campo_sessao_pausar(text, text, timestamptz) from public, anon;
grant execute on function public.campo_sessao_corrigir(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.campo_sessao_iniciar(text, text, timestamptz) to authenticated;
grant execute on function public.campo_sessao_pausar(text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';

commit;
