-- v362 — Gestão: a recorrência passa para a tarefa mais nova (18/11/2026, 0.3.298).
--
-- POR QUÊ: pedido do João — "a tarefa estava marcada como recorrência, desmarco e ela continua criando novas". A regra
-- ficava só na tarefa ORIGINAL; o robô diário (gestao_cron_diario) criava as cópias SEM recorrência. Quem abria a
-- cópia via "Recorrência: Adicionar", e desmarcar nela não parava nada — a original seguia gerando (mesmo concluída).
-- Decisão dele: "a regra passa para a nova" (como ClickUp e Runrun).
--
-- O QUE FAZ:
--   gestao_cron_diario(): igual à atual, mas ao gerar as cópias de uma série a recorrência vai para a ÚLTIMA cópia
--     criada (com a próxima data) e sai da tarefa de onde veio. A recorrência fica sempre na tarefa mais recente.
--   Arruma as séries que já existem: a regra de cada tarefa com recorrência que já gerou cópias vai para a cópia mais
--     nova que ainda existe (pelo registro 'recorrencia_gerada' em gestao_atividades).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v362_gestao_recorrencia_passa_adiante_rollback.sql (a função volta;
-- as regras já movidas ficam onde estão — continuam funcionando, cada uma numa tarefa só).
begin;

CREATE OR REPLACE FUNCTION public.gestao_cron_diario()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record; v_novo text; v_status text; v_base date; v_int int; v_prox date; v_guarda int; v_ultimo text;
begin
  for r in
    select * from public.gestao_tarefas
    where recorrencia is not null
      and (recorrencia->>'proxima_geracao') is not null
      and (recorrencia->>'proxima_geracao')::date <= current_date
  loop
    select slug into v_status from public.gestao_status
      where id_quadro = r.id_quadro and tipo = 'nao_iniciado' order by ordem asc limit 1;
    if v_status is null then v_status := 'A_FAZER'; end if;
    v_base := (r.recorrencia->>'proxima_geracao')::date;
    v_int  := greatest(coalesce((r.recorrencia->>'intervalo')::int, 1), 1);
    v_guarda := 0;
    v_ultimo := null;

    while v_base <= current_date and v_guarda < 400 loop
      v_guarda := v_guarda + 1;
      v_novo := 'TRF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, responsavel, prazo, ordem, etiquetas, subtarefas, campos, created_by, created_at)
      values (v_novo, r.id_quadro, r.titulo, r.descricao, v_status, r.prioridade, r.responsavel,
              v_base, 0, r.etiquetas, '[]'::jsonb, coalesce(r.campos,'{}'::jsonb), 'recorrencia', now());

      insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
        select gen_random_uuid(), v_novo, v.usuario_email, v.tipo, 'recorrencia'
          from public.gestao_tarefa_vinculados v where v.id_tarefa = r.id_tarefa
        on conflict (id_tarefa, usuario_email, tipo) do nothing;

      insert into public.gestao_atividades (id, ator, acao, id_tarefa, payload)
        values (gen_random_uuid(), 'cron', 'recorrencia_gerada', v_novo, jsonb_build_object('origem', r.id_tarefa, 'data', v_base));
      v_ultimo := v_novo;

      if r.recorrencia->>'tipo' = 'semanal' then v_base := v_base + (v_int * 7);
      elsif r.recorrencia->>'tipo' = 'mensal' then v_base := (v_base + (v_int * interval '1 month'))::date;
      else v_base := v_base + v_int;
      end if;
    end loop;

    -- v362: a regra PASSA para a tarefa mais nova da série (a anterior fica sem recorrência). Assim a recorrência está
    -- sempre na última tarefa criada, e tirar a recorrência dela para a série. Antes a regra ficava na original e as
    -- cópias nasciam sem ela: desmarcar numa cópia não parava nada.
    if v_ultimo is not null then
      update public.gestao_tarefas
        set recorrencia = jsonb_set(r.recorrencia, '{proxima_geracao}', to_jsonb(v_base::text))
        where id_tarefa = v_ultimo;
      update public.gestao_tarefas set recorrencia = null where id_tarefa = r.id_tarefa;
    else
      update public.gestao_tarefas
        set recorrencia = jsonb_set(recorrencia, '{proxima_geracao}', to_jsonb(v_base::text))
        where id_tarefa = r.id_tarefa;
    end if;
  end loop;

  insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro, canal, email_enviado)
  select gen_random_uuid(), lower(v.usuario_email), 'prazo',
         case when t.prazo < current_date then 'Tarefa atrasada: ' else 'Vence hoje: ' end || t.titulo,
         t.id_tarefa, t.id_quadro,
         case when t.prazo < current_date then 'in_app' else 'in_app+email' end,
         (t.prazo < current_date)
  from public.gestao_tarefas t
  join public.gestao_tarefa_vinculados v on v.id_tarefa = t.id_tarefa and v.tipo = 'responsavel'
  join public.usuarios u on lower(u.email) = lower(v.usuario_email) and coalesce(u.ativo_sistema, true)
  left join public.gestao_status s on s.id_quadro = t.id_quadro and s.slug = t.status
  where t.prazo is not null
    and t.prazo <= current_date
    and coalesce(s.tipo, 'ativo') <> 'concluido'
    and not exists (
      select 1 from public.gestao_notificacoes n
      where n.id_tarefa = t.id_tarefa and n.tipo = 'prazo' and lower(n.destinatario) = lower(v.usuario_email)
        and (n.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    );
end $function$;

-- Séries que já existem: a regra vai para a cópia mais nova (que ainda existe) de cada original com recorrência.
with ultima as (
  select distinct on (a.payload ->> 'origem') a.payload ->> 'origem' as origem, a.id_tarefa as copia
    from public.gestao_atividades a
    join public.gestao_tarefas c on c.id_tarefa = a.id_tarefa
   where a.acao = 'recorrencia_gerada' and a.payload ? 'origem'
   order by a.payload ->> 'origem', a.created_at desc, c.created_at desc
), alvo as (
  select o.id_tarefa as origem, u.copia, o.recorrencia
    from public.gestao_tarefas o join ultima u on u.origem = o.id_tarefa
   where o.recorrencia is not null and u.copia <> o.id_tarefa
), passa as (
  update public.gestao_tarefas c set recorrencia = a.recorrencia
    from alvo a where c.id_tarefa = a.copia
  returning a.origem
)
update public.gestao_tarefas o set recorrencia = null where o.id_tarefa in (select origem from passa);

notify pgrst, 'reload schema';

commit;
