-- v220 — Presença: a trilha da Auditoria devolve id_empresa.
--
-- A tela Presença (v0.3.609) mostra "editou inspeção — NOME DA EMPRESA" em vez
-- de "editou inspeção INS-4CD57E73": o nome vem do cadastro de empresas pelo
-- id_empresa, como a tela Auditoria já faz. Só a função muda (mesma assinatura,
-- mais uma chave no JSON); tabela e permissões seguem as da v219.

create or replace function public.presenca_trilha(
  p_email   text,
  p_de      date,
  p_ate     date,
  p_ultimos integer default 2
)
returns table (
  dia      date,
  total    integer,
  ultimos  jsonb
)
language sql
stable
security definer
set search_path = public
as $$
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
       and public.caller_eh_admin()
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
$$;

comment on function public.presenca_trilha(text, date, date, integer) is
  'v219/v220 — por dia civil (RJ): quantos eventos da auditoria a pessoa tem e os N últimos (com id_empresa), reduzidos ao que a tela Presença mostra. Só Admin.';

notify pgrst, 'reload schema';
