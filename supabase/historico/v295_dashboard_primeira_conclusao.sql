-- v295 (JCN) — Dashboard: a PRIMEIRA conclusão fica travada (inspeção e documento), reaberturas com
-- a lista do que mudou, e a data em que o documento foi assumido.
--
-- PEDIDO (26/10/2026): "Inspeções realizadas por TST" conta no mês em que o técnico concluiu; se
-- alguém reabrir depois, a contagem não muda e aparece quem reabriu e o que mudou. Mesma regra para
-- os Documentos concluídos (ADM). Documentos associados contam no mês da associação — e os
-- "assumidos pelo botão" (sem linha em inspecao_associados) no mês em que foram assumidos.
--
-- POR QUÊ: `concluida_em` e `elaboracao_concluida_em` são REGRAVADOS quando alguém reabre e conclui
-- de novo — a inspeção mudava de mês no gráfico. As colunas novas guardam a primeira vez e um
-- gatilho impede que mudem depois de preenchidas.
--
-- O QUE FAZ
--   inspecoes.primeira_conclusao_em / _por        1ª vez que a inspeção ficou CONCLUIDA (e quem clicou)
--   inspecoes.primeira_elaboracao_em / _por       1ª vez que o documento ficou CONCLUIDO (e o responsável)
--   gatilho inspecoes_primeira_conclusao          preenche uma vez e não deixa mudar
--   backfill                                      pela auditoria (1º evento de conclusão); sem
--                                                 auditoria, pela data atual de conclusão
--   dashboard_reaberturas(p_tipo)                 reaberturas depois da 1ª conclusão: quem, quando,
--                                                 quando concluiu de novo e os campos alterados
--                                                 (inspeção e abas dela) com antes → depois
--   dashboard_assuncoes()                         quando cada documento ganhou responsável de
--                                                 elaboração (botão "Assumir"), pela auditoria
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v295_dashboard_primeira_conclusao_rollback.sql

-- ── 1) Colunas ─────────────────────────────────────────────────────────────────────
alter table public.inspecoes
  add column if not exists primeira_conclusao_em  timestamptz,
  add column if not exists primeira_conclusao_por text,
  add column if not exists primeira_elaboracao_em  timestamptz,
  add column if not exists primeira_elaboracao_por text;

comment on column public.inspecoes.primeira_conclusao_em is 'v295: 1ª vez que a inspeção foi concluída. Travada (reabrir/concluir de novo não muda). Régua do dashboard.';
comment on column public.inspecoes.primeira_conclusao_por is 'v295: e-mail de quem clicou em Concluir na 1ª vez.';
comment on column public.inspecoes.primeira_elaboracao_em is 'v295: 1ª vez que o documento (elaboração) foi concluído. Travada.';
comment on column public.inspecoes.primeira_elaboracao_por is 'v295: responsável pela elaboração na 1ª conclusão do documento.';

-- ── 2) Gatilho: preenche uma vez, nunca muda ───────────────────────────────────────
-- Roda depois de inspecoes_concluida_por (ordem alfabética), que já carimbou concluida_por_email.
create or replace function public.inspecoes_primeira_conclusao_trg() returns trigger
  language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    -- Já preenchida: o valor antigo vence (ninguém reescreve a 1ª conclusão, nem pelo cliente).
    if old.primeira_conclusao_em is not null then
      new.primeira_conclusao_em := old.primeira_conclusao_em;
      new.primeira_conclusao_por := old.primeira_conclusao_por;
    end if;
    if old.primeira_elaboracao_em is not null then
      new.primeira_elaboracao_em := old.primeira_elaboracao_em;
      new.primeira_elaboracao_por := old.primeira_elaboracao_por;
    end if;
  end if;
  if new.primeira_conclusao_em is null and new.status = 'CONCLUIDA' then
    new.primeira_conclusao_em := coalesce(new.concluida_em, now());
    new.primeira_conclusao_por := new.concluida_por_email;
  end if;
  if new.primeira_elaboracao_em is null and new.elaboracao_status = 'CONCLUIDO' then
    new.primeira_elaboracao_em := coalesce(new.elaboracao_concluida_em, now());
    new.primeira_elaboracao_por := new.elaboracao_responsavel;
  end if;
  return new;
end $$;

drop trigger if exists inspecoes_primeira_conclusao on public.inspecoes;
create trigger inspecoes_primeira_conclusao before insert or update on public.inspecoes
  for each row execute function public.inspecoes_primeira_conclusao_trg();

-- ── 3) Backfill (sem auditoria nem demais gatilhos de negócio) ───────────────────────
alter table public.inspecoes disable trigger trg_auditoria;
alter table public.inspecoes disable trigger trg_inspecoes_retira_comercial;

with conc as (
  select distinct on (e.registro_id) e.registro_id, e.ocorrido_em, e.usuario_email
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes'
     and e.depois ->> 'status' = 'CONCLUIDA'
     and coalesce(e.antes ->> 'status', '') <> 'CONCLUIDA'
   order by e.registro_id, e.ocorrido_em
)
update public.inspecoes i
   set primeira_conclusao_em  = coalesce(c.ocorrido_em, i.concluida_em, i.updated_at),
       primeira_conclusao_por = coalesce(lower(c.usuario_email), i.concluida_por_email)
  from (select id_inspecao from public.inspecoes) base
  left join conc c on c.registro_id = base.id_inspecao
 where i.id_inspecao = base.id_inspecao
   and i.primeira_conclusao_em is null
   and (i.status = 'CONCLUIDA' or c.registro_id is not null);

with elab as (
  select distinct on (e.registro_id) e.registro_id, e.ocorrido_em, e.depois ->> 'elaboracao_responsavel' as resp
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes'
     and e.depois ->> 'elaboracao_status' = 'CONCLUIDO'
     and coalesce(e.antes ->> 'elaboracao_status', '') <> 'CONCLUIDO'
   order by e.registro_id, e.ocorrido_em
)
update public.inspecoes i
   set primeira_elaboracao_em  = coalesce(x.ocorrido_em, i.elaboracao_concluida_em),
       primeira_elaboracao_por = coalesce(nullif(x.resp, ''), i.elaboracao_responsavel)
  from (select id_inspecao from public.inspecoes) base
  left join elab x on x.registro_id = base.id_inspecao
 where i.id_inspecao = base.id_inspecao
   and i.primeira_elaboracao_em is null
   and (i.elaboracao_status = 'CONCLUIDO' or x.registro_id is not null)
   and coalesce(x.ocorrido_em, i.elaboracao_concluida_em) is not null;

alter table public.inspecoes enable trigger trg_auditoria;
alter table public.inspecoes enable trigger trg_inspecoes_retira_comercial;

-- ── 4) Quem pode ler as RPCs: a equipe interna (Cliente não) ─────────────────────────
create or replace function public.dashboard_caller_interno() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente'
  );
$$;
revoke all on function public.dashboard_caller_interno() from public, anon;
grant execute on function public.dashboard_caller_interno() to authenticated, service_role;

-- ── 5) Reaberturas depois da 1ª conclusão, com o que mudou ───────────────────────────
-- p_tipo: 'inspecao' (status CONCLUIDA → outro) | 'documento' (elaboracao_status CONCLUIDO → outro).
-- `alteracoes`: eventos de auditoria da inspeção e das abas dela (setores, riscos, fotos, extintores,
-- máquinas, responsáveis, associados) entre a reabertura e a nova conclusão (ou agora), um item por
-- campo: {tabela, acao, campo, antes, depois, por, em}. Campos de controle ficam de fora.
create or replace function public.dashboard_reaberturas(p_tipo text default 'inspecao')
  returns table (id_inspecao text, reaberta_em timestamptz, reaberta_por text,
                 reconcluida_em timestamptz, alteracoes jsonb)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_campo  text := case when p_tipo = 'documento' then 'elaboracao_status' else 'status' end;
  v_valor  text := case when p_tipo = 'documento' then 'CONCLUIDO' else 'CONCLUIDA' end;
begin
  if not public.dashboard_caller_interno() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
  with reab as (
    select e.registro_id as id, e.ocorrido_em as em, lower(e.usuario_email) as por
      from public.auditoria_eventos e
     where e.tabela = 'inspecoes'
       and e.antes ->> v_campo = v_valor
       and coalesce(e.depois ->> v_campo, '') <> v_valor
  ), janela as (
    select r.id, r.em, r.por,
           (select min(e2.ocorrido_em) from public.auditoria_eventos e2
             where e2.tabela = 'inspecoes' and e2.registro_id = r.id and e2.ocorrido_em > r.em
               and e2.depois ->> v_campo = v_valor
               and coalesce(e2.antes ->> v_campo, '') <> v_valor) as fim
      from reab r
  )
  select j.id, j.em, j.por, j.fim,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'tabela', ev.tabela, 'acao', ev.acao, 'campo', c.campo,
                    'antes', ev.antes -> c.campo, 'depois', ev.depois -> c.campo,
                    'por', lower(ev.usuario_email), 'em', ev.ocorrido_em)
                  order by ev.ocorrido_em)
             from public.auditoria_eventos ev
             cross join lateral (
               select unnest(case when coalesce(cardinality(ev.campos_alterados), 0) > 0
                                  then ev.campos_alterados else array['(registro)'] end) as campo
             ) c
            where ev.ocorrido_em > j.em
              and ev.ocorrido_em <= coalesce(j.fim, now())
              and (
                (ev.tabela = 'inspecoes' and ev.registro_id = j.id)
                or (ev.tabela in ('setores','riscos','fotos','extintores','inspecao_maquinas',
                                  'inspecao_maquinas_setores','responsaveis','inspecao_associados')
                    and coalesce(ev.depois ->> 'id_inspecao', ev.antes ->> 'id_inspecao') = j.id)
              )
              and c.campo not in ('updated_at','created_at','concluida_em','concluida_por_email',
                                  'elaboracao_concluida_em','liberado_comercial_em','liberado_comercial_por',
                                  'primeira_conclusao_em','primeira_conclusao_por',
                                  'primeira_elaboracao_em','primeira_elaboracao_por')
         ), '[]'::jsonb)
    from janela j
    join public.inspecoes i on i.id_inspecao = j.id
   where (p_tipo = 'documento' and i.primeira_elaboracao_em is not null and j.em >= i.primeira_elaboracao_em)
      or (p_tipo <> 'documento' and i.primeira_conclusao_em is not null and j.em >= i.primeira_conclusao_em)
   order by j.em desc;
end $$;
revoke all on function public.dashboard_reaberturas(text) from public, anon;
grant execute on function public.dashboard_reaberturas(text) to authenticated, service_role;

-- ── 6) Quando o documento foi assumido (responsável de elaboração preenchido) ────────
create or replace function public.dashboard_assuncoes()
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

notify pgrst, 'reload schema';
