-- v231 — Presença e Auditoria para a gerência (não só Admin).
--
-- Decisão dele (21/09/2026), quando os 7 Admin por supervisão desceram na v229:
-- "essa parte é para gerentes e admin, além do TI" — e "não entram" para os
-- supervisores dos técnicos (Phelipe, Emilia).
--
-- Até aqui as duas telas eram só-Admin em três camadas: o layout da área
-- Sistema (useRequireAdmin), o card do hub e o BANCO (RLS de presenca_pings,
-- presenca_encerramentos, auditoria_eventos, auditoria_tabelas e as três RPCs de
-- leitura, todas por caller_eh_admin()). Esta migration mexe só na camada do
-- banco; a tela vem na v0.3.620.
--
-- Como: a FUNÇÃO ganha a marcação `ve_presenca_auditoria` (editável em Sistema ›
-- Funções), ligada para TI, Gerente e Supervisora do administrativo. A função
-- SQL caller_ve_presenca() diz se quem chama é Admin OU tem função com a
-- marcação. Só a LEITURA passa a aceitá-la; presenca_encerrar_sessao e
-- presenca_limpar continuam exigindo Admin (derrubar sessão e apagar histórico
-- não é coisa de gerente).
--
-- Depende da v229 (funcoes_painel e usuarios.funcao). As três RPCs abaixo são
-- as definições que estavam na produção em 21/09 (v218/v219/v220) com UMA troca:
-- caller_eh_admin() -> caller_ve_presenca().
--
-- Reversível: scripts/sql/v231_rollback_presenca_gerencia.sql volta as policies
-- e as RPCs a caller_eh_admin() e apaga a coluna.

begin;

-- 1) A marcação na função
alter table public.funcoes_painel
  add column if not exists ve_presenca_auditoria boolean not null default false;
comment on column public.funcoes_painel.ve_presenca_auditoria is
  'v231: quem tem esta função abre Sistema › Presença e Sistema › Auditoria (só leitura). Admin sempre abre.';

update public.funcoes_painel
   set ve_presenca_auditoria = (funcao in ('TI', 'Gerente', 'Supervisora do administrativo'));

-- 2) Quem chama vê Presença/Auditoria? Admin, ou função marcada. Mesmo desenho
--    de caller_eh_admin() (e-mail do JWT, conta ativa), que vive fora do versionamento.
create or replace function public.caller_ve_presenca()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.usuarios u
      left join public.funcoes_painel f on f.funcao = u.funcao
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo_sistema = true
       and (u.perfil = 'Admin' or coalesce(f.ve_presenca_auditoria, false))
  );
$$;
revoke all on function public.caller_ve_presenca() from public;
grant execute on function public.caller_ve_presenca() to authenticated;

-- 3) Leitura das tabelas
drop policy if exists presenca_pings_sel on public.presenca_pings;
create policy presenca_pings_sel on public.presenca_pings
  for select to authenticated using (public.caller_ve_presenca());

drop policy if exists presenca_encerramentos_sel on public.presenca_encerramentos;
create policy presenca_encerramentos_sel on public.presenca_encerramentos
  for select to authenticated using (public.caller_ve_presenca());

drop policy if exists auditoria_eventos_sel on public.auditoria_eventos;
create policy auditoria_eventos_sel on public.auditoria_eventos
  for select to authenticated using (public.caller_ve_presenca());

drop policy if exists auditoria_tabelas_sel on public.auditoria_tabelas;
create policy auditoria_tabelas_sel on public.auditoria_tabelas
  for select to authenticated using (public.caller_ve_presenca());

-- 4) As três RPCs de leitura (corpo idêntico ao da produção; só a checagem muda)
CREATE OR REPLACE FUNCTION public.presenca_resumo(p_dia date DEFAULT NULL::date)
 RETURNS TABLE(usuario_email text, nome text, perfil text, cargo text, entrou_em timestamp with time zone, ultima_atividade timestamp with time zone, blocos integer, minutos_ativos integer, ultima_atividade_geral timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with dia as (
    select coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date) as d
  ),
  janela as (
    select (d::timestamp       at time zone 'America/Sao_Paulo') as ini,
           ((d + 1)::timestamp at time zone 'America/Sao_Paulo') as fim
      from dia
  ),
  do_dia as (
    select p.usuario_email,
           min(p.primeiro_em)                 as entrou_em,
           max(p.ultimo_em)                   as ultima_atividade,
           count(*)::int                      as blocos,
           sum(least(p.pings, 5))::int        as minutos_ativos
      from public.presenca_pings p, janela j
     where p.bloco >= j.ini and p.bloco < j.fim
     group by p.usuario_email
  ),
  geral as (
    select p.usuario_email, max(p.ultimo_em) as ultima_geral
      from public.presenca_pings p
     group by p.usuario_email
  )
  select lower(u.email),
         u.nome,
         u.perfil::text,
         u.cargo,
         d.entrou_em,
         d.ultima_atividade,
         coalesce(d.blocos, 0),
         coalesce(d.minutos_ativos, 0),
         g.ultima_geral
    from public.usuarios u
    left join do_dia d on d.usuario_email = lower(u.email)
    left join geral  g on g.usuario_email = lower(u.email)
   where u.ativo_sistema
     and u.perfil <> 'Cliente'
     and public.caller_ve_presenca()   -- quem não vê Presença recebe lista vazia (v231)
   order by u.nome
$function$
;
CREATE OR REPLACE FUNCTION public.presenca_trilha(p_email text, p_de date, p_ate date, p_ultimos integer DEFAULT 2)
 RETURNS TABLE(dia date, total integer, ultimos jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with j as (
    select (p_de::timestamp         at time zone 'America/Sao_Paulo') as ini_ts,
           ((p_ate + 1)::timestamp  at time zone 'America/Sao_Paulo') as fim_ts
  ),
  ev as (
    select e.id, e.ocorrido_em, e.acao, e.modulo, e.tabela, e.registro_id, e.titulo, e.id_empresa,
           e.campos_alterados,
           (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
              from jsonb_each(coalesce(e.antes, '{}'::jsonb) || coalesce(e.depois, '{}'::jsonb)) as kv(k, v)
             where k in ('nome_empresa','titulo','nome','descricao','placa','nr_titulo','email',
                         'id_inspecao','id_apreciacao','id_aplicacao')) as linha,
           (e.ocorrido_em at time zone 'America/Sao_Paulo')::date as dia,
           row_number() over (
             partition by (e.ocorrido_em at time zone 'America/Sao_Paulo')::date
             order by e.ocorrido_em desc
           ) as rn
      from public.auditoria_eventos e, j
     where e.usuario_email = lower(p_email)
       and e.ocorrido_em >= j.ini_ts and e.ocorrido_em < j.fim_ts
       and public.caller_ve_presenca()
  )
  select ev.dia,
         count(*)::int as total,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', ev.id, 'ocorrido_em', ev.ocorrido_em, 'acao', ev.acao, 'modulo', ev.modulo,
               'tabela', ev.tabela, 'registro_id', ev.registro_id, 'titulo', ev.titulo,
               'id_empresa', ev.id_empresa,
               'campos_alterados', to_jsonb(ev.campos_alterados),
               'antes', null, 'depois', ev.linha
             ) order by ev.ocorrido_em desc
           ) filter (where ev.rn <= greatest(p_ultimos, 1)),
           '[]'::jsonb
         ) as ultimos
    from ev
   group by ev.dia
   order by ev.dia desc
$function$
;
CREATE OR REPLACE FUNCTION public.presenca_uso_mensal(p_mes date, p_email text DEFAULT NULL::text)
 RETURNS TABLE(dia date, minutos integer, pessoas integer, entrou_em timestamp with time zone, saiu_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with lim as (
    select date_trunc('month', p_mes)::date                         as ini,
           (date_trunc('month', p_mes) + interval '1 month')::date  as fim
  ),
  j as (
    select (ini::timestamp at time zone 'America/Sao_Paulo') as ini_ts,
           (fim::timestamp at time zone 'America/Sao_Paulo') as fim_ts
      from lim
  )
  select (p.bloco at time zone 'America/Sao_Paulo')::date  as dia,
         sum(least(p.pings, 5))::int                        as minutos,
         count(distinct p.usuario_email)::int               as pessoas,
         min(p.primeiro_em)                                 as entrou_em,
         max(p.ultimo_em)                                   as saiu_em
    from public.presenca_pings p, j
   where p.bloco >= j.ini_ts and p.bloco < j.fim_ts
     and (p_email is null or p.usuario_email = lower(p_email))
     and public.caller_ve_presenca()
   group by 1
   order by 1
$function$
;

-- 5) Conferência: a trava de escrita continua só Admin
do $$
begin
  if (select count(*) from public.funcoes_painel where ve_presenca_auditoria) <> 3 then raise exception 'v231: esperava 3 funcoes com ve_presenca_auditoria, achou %', (select count(*) from public.funcoes_painel where ve_presenca_auditoria); end if;
  if position('caller_eh_admin' in pg_get_functiondef('public.presenca_encerrar_sessao(text)'::regprocedure)) = 0 then raise exception 'v231: presenca_encerrar_sessao deixou de exigir Admin'; end if;
  if position('caller_eh_admin' in pg_get_functiondef('public.presenca_limpar(integer)'::regprocedure)) = 0 then raise exception 'v231: presenca_limpar deixou de exigir Admin'; end if;
end $$;


commit;

notify pgrst, 'reload schema';
