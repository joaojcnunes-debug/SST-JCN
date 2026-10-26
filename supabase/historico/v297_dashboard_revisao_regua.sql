-- v297 (JCN) — Dashboard: revisão da régua da 1ª conclusão (26/10/2026). Substitui as partes da v295
-- e da v296; é também a versão consolidada levada ao Painel SST (lá: v310).
--
-- Corrige o que a revisão independente e a simulação acharam:
--  B1  o backfill da v295 era atropelado pelo próprio gatilho (que não foi desligado): o documento
--      reconcluído por outra pessoa ficava no mês/pessoa da RECONCLUSÃO, e documento antigo sem data
--      ganhava now(). Agora o gatilho é desligado no backfill e só age na PASSAGEM para concluído.
--  B2  a 1ª conclusão anterior à auditoria se perdia (ficava a data da reconclusão, ou a reaberta
--      sumia). Agora o backfill olha também o valor ANTES de cada evento (concluida_em desfeito).
--  B3  o responsável do documento na 1ª conclusão vem do histórico de elaboracao_responsavel na
--      data (a auditoria só guarda campos alterados).
--  B4  (v296) a lista de alterações liga as abas pela chave do registro; agora cobre TODAS as abas
--      auditadas da inspeção e ignora a ida para a Lixeira (CONCLUIDA → DELETADA não é reabertura).
--  B5  a nota do supervisor grava por RPC: sem data_hora inventada, sem linha duplicada, só supervisor.
--  B6  os técnicos da 1ª conclusão ficam FOTOGRAFADOS (primeira_conclusao_tecnicos). Com técnico
--      registrado, a pessoa não muda depois (quem reabre e se inclui não divide a contagem). Sem
--      técnico (lista vazia) vale o que for preenchido depois — é o "sem registro" que a aba ou a
--      nota do supervisor completa.
--  +   gatilho ignora primeira_* enviados pelo cliente; data limitada a now() (relógio adiantado).
--  +   dashboard_assuncoes devolve também associações REMOVIDAS (histórico da auditoria) e a origem.
--
-- REAPLICAR: idempotente (recalcula as colunas a partir da auditoria e do estado atual).
-- ROLLBACK: scripts/sql/v297_dashboard_revisao_regua_rollback.sql

-- ── 1) Colunas ─────────────────────────────────────────────────────────────────────
alter table public.inspecoes
  add column if not exists primeira_conclusao_em  timestamptz,
  add column if not exists primeira_conclusao_por text,
  add column if not exists primeira_conclusao_tecnicos jsonb,
  add column if not exists primeira_elaboracao_em  timestamptz,
  add column if not exists primeira_elaboracao_por text;

comment on column public.inspecoes.primeira_conclusao_tecnicos is
  'v297: técnicos da aba Responsáveis na 1ª conclusão — [{digitado, idUsuario}]. Vazio = sem registro (vale o preenchido depois).';

-- ── 2) Auxiliares ──────────────────────────────────────────────────────────────────
-- Técnicos de campo atuais da inspeção, no formato que o Dashboard lê.
create or replace function public.inspecao_tecnicos_campo_json(p_id text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('digitado', r.tecnico_responsavel, 'idUsuario', r.id_usuario)
                            order by r.id_responsavel), '[]'::jsonb)
    from public.responsaveis r
   where r.id_inspecao = p_id
     and (coalesce(btrim(r.tecnico_responsavel), '') <> '' or r.id_usuario is not null);
$$;

-- Responsável pela elaboração numa data: o último valor gravado até lá; sem nenhum, o valor "antes"
-- da 1ª troca depois dela; sem histórico, o atual.
create or replace function public.dashboard_resp_elaboracao_em(p_id text, p_t timestamptz) returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(btrim(e.depois ->> 'elaboracao_responsavel'), '')
       from public.auditoria_eventos e
      where e.tabela = 'inspecoes' and e.registro_id = p_id
        and 'elaboracao_responsavel' = any (e.campos_alterados) and e.ocorrido_em <= p_t
      order by e.id desc limit 1),
    (select nullif(btrim(e.antes ->> 'elaboracao_responsavel'), '')
       from public.auditoria_eventos e
      where e.tabela = 'inspecoes' and e.registro_id = p_id
        and 'elaboracao_responsavel' = any (e.campos_alterados) and e.ocorrido_em > p_t
      order by e.id limit 1),
    (select nullif(btrim(i.elaboracao_responsavel), '') from public.inspecoes i where i.id_inspecao = p_id)
  );
$$;

-- ── 3) Gatilho: só na passagem para concluído; nunca muda depois; ignora o cliente ──────
create or replace function public.inspecoes_primeira_conclusao_trg() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.primeira_conclusao_em       := old.primeira_conclusao_em;
    new.primeira_conclusao_por      := old.primeira_conclusao_por;
    new.primeira_conclusao_tecnicos := old.primeira_conclusao_tecnicos;
    new.primeira_elaboracao_em      := old.primeira_elaboracao_em;
    new.primeira_elaboracao_por     := old.primeira_elaboracao_por;
  else
    new.primeira_conclusao_em := null; new.primeira_conclusao_por := null; new.primeira_conclusao_tecnicos := null;
    new.primeira_elaboracao_em := null; new.primeira_elaboracao_por := null;
  end if;

  if new.primeira_conclusao_em is null and new.status = 'CONCLUIDA'
     and (tg_op = 'INSERT' or old.status is distinct from 'CONCLUIDA') then
    new.primeira_conclusao_em       := least(coalesce(new.concluida_em, now()), now());
    new.primeira_conclusao_por      := new.concluida_por_email;
    new.primeira_conclusao_tecnicos := public.inspecao_tecnicos_campo_json(new.id_inspecao);
  end if;

  if new.primeira_elaboracao_em is null and new.elaboracao_status = 'CONCLUIDO'
     and (tg_op = 'INSERT' or old.elaboracao_status is distinct from 'CONCLUIDO') then
    new.primeira_elaboracao_em  := least(coalesce(new.elaboracao_concluida_em, now()), now());
    new.primeira_elaboracao_por := new.elaboracao_responsavel;
  end if;
  return new;
end $$;
revoke all on function public.inspecoes_primeira_conclusao_trg() from public, anon, authenticated;

drop trigger if exists inspecoes_primeira_conclusao on public.inspecoes;
create trigger inspecoes_primeira_conclusao before insert or update on public.inspecoes
  for each row execute function public.inspecoes_primeira_conclusao_trg();

-- ── 4) Backfill (com ESTE gatilho e os de negócio desligados) ─────────────────────────
alter table public.inspecoes disable trigger inspecoes_primeira_conclusao;
alter table public.inspecoes disable trigger trg_auditoria;
alter table public.inspecoes disable trigger trg_inspecoes_retira_comercial;

update public.inspecoes
   set primeira_conclusao_em = null, primeira_conclusao_por = null, primeira_conclusao_tecnicos = null,
       primeira_elaboracao_em = null, primeira_elaboracao_por = null
 where primeira_conclusao_em is not null or primeira_conclusao_tecnicos is not null or primeira_elaboracao_em is not null;

-- 4a) 1ª conclusão da inspeção: a mais antiga entre (i) a passagem para CONCLUIDA na auditoria,
--     (ii) o concluida_em DESFEITO por qualquer evento (valor "antes" — cobre a conclusão anterior à
--     auditoria que foi reaberta ou regravada) e (iii) o estado atual.
with cand as (
  select e.registro_id as id, e.ocorrido_em as em, lower(e.usuario_email) as por
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and e.depois ->> 'status' = 'CONCLUIDA'
     and coalesce(e.antes ->> 'status', '') <> 'CONCLUIDA'
  union all
  select e.registro_id, (e.antes ->> 'concluida_em')::timestamptz, lower(nullif(e.antes ->> 'concluida_por_email', ''))
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and nullif(e.antes ->> 'concluida_em', '') is not null
  union all
  select i.id_inspecao, coalesce(i.concluida_em, i.updated_at), i.concluida_por_email
    from public.inspecoes i where i.status = 'CONCLUIDA'
), escolhida as (
  select distinct on (id) id, em, por from cand where em is not null order by id, em
)
update public.inspecoes i
   set primeira_conclusao_em = least(x.em, now()), primeira_conclusao_por = x.por
  from escolhida x
 where x.id = i.id_inspecao;

-- 4b) Técnicos na 1ª conclusão: os da aba que já existiam naquela hora (não criados depois) + os
--     excluídos depois dela (o registro excluído vem inteiro no "antes" da auditoria).
update public.inspecoes i
   set primeira_conclusao_tecnicos = coalesce((
     select jsonb_agg(t.obj order by t.ord)
       from (
         select jsonb_build_object('digitado', r.tecnico_responsavel, 'idUsuario', r.id_usuario) as obj, r.id_responsavel as ord
           from public.responsaveis r
          where r.id_inspecao = i.id_inspecao
            and (coalesce(btrim(r.tecnico_responsavel), '') <> '' or r.id_usuario is not null)
            and not exists (select 1 from public.auditoria_eventos c
                             where c.tabela = 'responsaveis' and c.registro_id = r.id_responsavel
                               and c.acao = 'criou' and c.ocorrido_em > i.primeira_conclusao_em)
         union all
         select jsonb_build_object('digitado', d.antes ->> 'tecnico_responsavel', 'idUsuario', d.antes ->> 'id_usuario'), d.registro_id
           from public.auditoria_eventos d
          where d.tabela = 'responsaveis' and d.acao = 'excluiu'
            and d.antes ->> 'id_inspecao' = i.id_inspecao and d.ocorrido_em > i.primeira_conclusao_em
            and (coalesce(btrim(d.antes ->> 'tecnico_responsavel'), '') <> '' or d.antes ->> 'id_usuario' is not null)
            and not exists (select 1 from public.auditoria_eventos c
                             where c.tabela = 'responsaveis' and c.registro_id = d.registro_id
                               and c.acao = 'criou' and c.ocorrido_em > i.primeira_conclusao_em)
       ) t), '[]'::jsonb)
 where i.primeira_conclusao_em is not null;

-- 4c) 1ª conclusão do documento: a mais antiga entre a passagem para CONCLUIDO, o
--     elaboracao_concluida_em desfeito por qualquer evento e o estado atual; o responsável é o
--     daquela data (B3).
with cand as (
  select e.registro_id as id, e.ocorrido_em as em
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and e.depois ->> 'elaboracao_status' = 'CONCLUIDO'
     and coalesce(e.antes ->> 'elaboracao_status', '') <> 'CONCLUIDO'
  union all
  select e.registro_id, (e.antes ->> 'elaboracao_concluida_em')::timestamptz
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and nullif(e.antes ->> 'elaboracao_concluida_em', '') is not null
  union all
  select i.id_inspecao, i.elaboracao_concluida_em
    from public.inspecoes i where i.elaboracao_status = 'CONCLUIDO' and i.elaboracao_concluida_em is not null
), escolhida as (
  select distinct on (id) id, em from cand where em is not null order by id, em
)
update public.inspecoes i
   set primeira_elaboracao_em  = least(x.em, now()),
       primeira_elaboracao_por = public.dashboard_resp_elaboracao_em(i.id_inspecao, x.em)
  from escolhida x
 where x.id = i.id_inspecao;

alter table public.inspecoes enable trigger inspecoes_primeira_conclusao;
alter table public.inspecoes enable trigger trg_auditoria;
alter table public.inspecoes enable trigger trg_inspecoes_retira_comercial;

-- ── 5) Índices das RPCs ────────────────────────────────────────────────────────────
create index if not exists auditoria_eventos_tab_reg_id_idx
  on public.auditoria_eventos (tabela, registro_id, id);
create index if not exists auditoria_eventos_insp_id_idx
  on public.auditoria_eventos ((coalesce(depois ->> 'id_inspecao', antes ->> 'id_inspecao')), id);

-- ── 6) Quem chama: equipe interna; supervisor para gravar ────────────────────────────
create or replace function public.dashboard_caller_interno() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente'
  );
$$;

create or replace function public.dashboard_caller_supervisor() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and coalesce(u.ativo_sistema, true)
       and (u.perfil = 'Admin' or u.nivel in ('Aprovacao', 'Admin'))
  );
$$;

-- ── 7) Reaberturas depois da 1ª conclusão, com o que mudou ───────────────────────────
create or replace function public.dashboard_reaberturas(p_tipo text default 'inspecao')
  returns table (id_inspecao text, reaberta_em timestamptz, reaberta_por text,
                 reconcluida_em timestamptz, alteracoes jsonb)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_campo text := case when p_tipo = 'documento' then 'elaboracao_status' else 'status' end;
  v_valor text := case when p_tipo = 'documento' then 'CONCLUIDO' else 'CONCLUIDA' end;
begin
  if not public.dashboard_caller_interno() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
  with reab as (
    select e.id as rid, e.registro_id as id, e.ocorrido_em as em, lower(e.usuario_email) as por
      from public.auditoria_eventos e
     where e.tabela = 'inspecoes'
       and e.antes ->> v_campo = v_valor
       and coalesce(e.depois ->> v_campo, '') <> v_valor
       and coalesce(e.depois ->> 'status', '') <> 'DELETADA'   -- Lixeira não é reabertura
  ), janela as (
    select r.rid, r.id, r.em, r.por, f.fid, f.fem
      from reab r
      left join lateral (
        select e2.id as fid, e2.ocorrido_em as fem
          from public.auditoria_eventos e2
         where e2.tabela = 'inspecoes' and e2.registro_id = r.id and e2.id > r.rid
           and e2.depois ->> v_campo = v_valor
           and coalesce(e2.antes ->> v_campo, '') <> v_valor
         order by e2.id
         limit 1
      ) f on true
  )
  select j.id, j.em, j.por, j.fem,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'tabela', ev.tabela, 'acao', ev.acao, 'campo', c.campo,
                    'antes', ev.antes -> c.campo, 'depois', ev.depois -> c.campo,
                    'por', lower(ev.usuario_email), 'em', ev.ocorrido_em, 'titulo', ev.titulo,
                    'registro', case when c.campo = '(registro)' then coalesce(ev.depois, ev.antes) end)
                  order by ev.id)
             from (
               -- itens que pertencem à inspeção hoje: edições ligadas pela CHAVE do registro
               select a.id, a.tabela, a.acao, a.campos_alterados, a.antes, a.depois, a.usuario_email, a.ocorrido_em, a.titulo
                 from (
                   select 'inspecoes'::text as tabela, j.id::text as reg
                   union all select 'setores', x.id_setor::text from public.setores x where x.id_inspecao::text = j.id
                   union all select 'riscos', x.id_risco::text from public.riscos x where x.id_inspecao::text = j.id
                   union all select 'cargos', x.id_cargo::text from public.cargos x where x.id_inspecao::text = j.id
                   union all select 'fotos', x.id_foto::text from public.fotos x where x.id_inspecao::text = j.id
                   union all select 'extintores', x.id_extintor::text from public.extintores x where x.id_inspecao::text = j.id
                   union all select 'epi_epc', x.id_protecao::text from public.epi_epc x where x.id_inspecao::text = j.id
                   union all select 'complementos', x.id_complemento::text from public.complementos x where x.id_inspecao::text = j.id
                   union all select 'pae_contatos', x.id_contato::text from public.pae_contatos x where x.id_inspecao::text = j.id
                   union all select 'treinamentos_nr', x.id_treinamento::text from public.treinamentos_nr x where x.id_inspecao::text = j.id
                   union all select 'acoes_5w2h', x.id_acao::text from public.acoes_5w2h x where x.id_inspecao::text = j.id
                   union all select 'inspecao_maquinas', x.id_maquina_inspecao::text from public.inspecao_maquinas x where x.id_inspecao::text = j.id
                   union all select 'inspecao_maquinas_setores', ms.id_maquina_inspecao::text || '|' || ms.id_setor::text
                               from public.inspecao_maquinas_setores ms
                               join public.inspecao_maquinas m2 on m2.id_maquina_inspecao = ms.id_maquina_inspecao
                              where m2.id_inspecao::text = j.id
                   union all select 'responsaveis', x.id_responsavel::text from public.responsaveis x where x.id_inspecao::text = j.id
                   union all select 'inspecao_associados', x.id::text from public.inspecao_associados x where x.id_inspecao::text = j.id
                 ) alvo
                 join public.auditoria_eventos a
                   on a.tabela = alvo.tabela and a.registro_id = alvo.reg
                  and a.id >= j.rid and (j.fid is null or a.id <= j.fid)
               union
               -- criações e exclusões: o registro inteiro traz o id_inspecao (o excluído não está mais na aba)
               select a.id, a.tabela, a.acao, a.campos_alterados, a.antes, a.depois, a.usuario_email, a.ocorrido_em, a.titulo
                 from public.auditoria_eventos a
                where coalesce(a.depois ->> 'id_inspecao', a.antes ->> 'id_inspecao') = j.id
                  and a.tabela in ('setores','riscos','cargos','fotos','extintores','epi_epc','complementos',
                                   'pae_contatos','treinamentos_nr','acoes_5w2h','inspecao_maquinas',
                                   'responsaveis','inspecao_associados')
                  and a.id >= j.rid and (j.fid is null or a.id <= j.fid)
             ) ev
             cross join lateral (
               select unnest(case when coalesce(cardinality(ev.campos_alterados), 0) > 0
                                  then ev.campos_alterados else array['(registro)'] end) as campo
             ) c
            where c.campo <> v_campo
              and c.campo not in ('updated_at','created_at','concluida_em','concluida_por_email',
                                  'elaboracao_concluida_em','liberado_comercial_em','liberado_comercial_por',
                                  'primeira_conclusao_em','primeira_conclusao_por','primeira_conclusao_tecnicos',
                                  'primeira_elaboracao_em','primeira_elaboracao_por')
         ), '[]'::jsonb)
    from janela j
    join public.inspecoes i on i.id_inspecao = j.id
   where (p_tipo = 'documento' and i.primeira_elaboracao_em is not null and j.em >= i.primeira_elaboracao_em)
      or (p_tipo <> 'documento' and i.primeira_conclusao_em is not null and j.em >= i.primeira_conclusao_em)
   order by j.rid desc;
end $$;

-- ── 8) Assunções (botão "Assumir") e associações removidas, com a origem ───────────────
drop function if exists public.dashboard_assuncoes();
create function public.dashboard_assuncoes()
  returns table (id_inspecao text, responsavel text, assumido_em timestamptz, origem text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.dashboard_caller_interno() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
  select e.registro_id, e.depois ->> 'elaboracao_responsavel', e.ocorrido_em, 'assuncao'::text
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes'
     and coalesce(e.depois ->> 'elaboracao_responsavel', '') <> ''
     and (e.antes ->> 'elaboracao_responsavel') is distinct from (e.depois ->> 'elaboracao_responsavel')
  union all
  -- desassociar apaga a linha de inspecao_associados; o histórico continua contando no mês dela
  select e.antes ->> 'id_inspecao', e.antes ->> 'nome',
         coalesce(nullif(e.antes ->> 'created_at', '')::timestamptz, e.ocorrido_em), 'associacao_removida'::text
    from public.auditoria_eventos e
   where e.tabela = 'inspecao_associados' and e.acao = 'excluiu'
     and coalesce(e.antes ->> 'nome', '') <> '' and coalesce(e.antes ->> 'id_inspecao', '') <> ''
  order by 3;
end $$;

-- ── 9) Nota do supervisor: registrar o técnico de uma inspeção "sem registro" ──────────
create or replace function public.dashboard_definir_tecnico(p_id_inspecao text, p_id_usuario text)
  returns text language plpgsql security definer set search_path = public as $$
declare v_nome text; v_emp text; v_id text;
begin
  if not public.dashboard_caller_supervisor() then
    raise exception 'Só supervisores definem o técnico.' using errcode = '42501';
  end if;
  select nome into v_nome from public.usuarios
   where id_usuario = p_id_usuario and coalesce(ativo_sistema, true) and perfil <> 'Cliente';
  if v_nome is null then raise exception 'Usuário inválido.' using errcode = 'P0001'; end if;
  select id_empresa into v_emp from public.inspecoes where id_inspecao = p_id_inspecao and status <> 'DELETADA';
  if not found then raise exception 'Inspeção não encontrada.' using errcode = 'P0001'; end if;
  -- não duplica (clique duplo, ou o técnico já registrado)
  select id_responsavel into v_id from public.responsaveis
   where id_inspecao = p_id_inspecao and id_usuario = p_id_usuario limit 1;
  if v_id is not null then return v_id; end if;
  v_id := 'RSP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  -- data_hora fica vazia: é a data da recepção da visita (sai no laudo) e não é conhecida aqui.
  insert into public.responsaveis (id_responsavel, id_inspecao, id_empresa, tecnico_responsavel, id_usuario)
  values (v_id, p_id_inspecao, v_emp, v_nome, p_id_usuario);
  return v_id;
end $$;

-- ── 10) Permissões ─────────────────────────────────────────────────────────────────
revoke all on function public.inspecao_tecnicos_campo_json(text) from public, anon, authenticated;
revoke all on function public.dashboard_resp_elaboracao_em(text, timestamptz) from public, anon, authenticated;
revoke all on function public.dashboard_caller_interno() from public, anon;
revoke all on function public.dashboard_caller_supervisor() from public, anon;
revoke all on function public.dashboard_reaberturas(text) from public, anon;
revoke all on function public.dashboard_assuncoes() from public, anon;
revoke all on function public.dashboard_definir_tecnico(text, text) from public, anon;
grant execute on function public.dashboard_caller_interno() to authenticated, service_role;
grant execute on function public.dashboard_caller_supervisor() to authenticated, service_role;
grant execute on function public.dashboard_reaberturas(text) to authenticated, service_role;
grant execute on function public.dashboard_assuncoes() to authenticated, service_role;
grant execute on function public.dashboard_definir_tecnico(text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
