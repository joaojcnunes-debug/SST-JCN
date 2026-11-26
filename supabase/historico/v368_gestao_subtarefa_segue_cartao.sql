-- v368 — Gestão: quem é responsável de subtarefa passa a SEGUIR o cartão (26/11/2026, 0.3.320).
--
-- Trazida da v375 do Painel (17/11/2026, caso Paulina, RRN-48568: quem só estava na subtarefa não achava o cartão).
-- É a base do "só as próprias vê a subtarefa como cartão" (0.3.320): o vínculo com origem 'subtarefa-mae' marca que a
-- pessoa está no cartão SÓ por causa da subtarefa.
--
-- O QUE MUDA
--   gestao_subtarefa_segue_mae_trg()  gatilho em gestao_subtarefas (INSERT/DELETE/UPDATE OF responsavel_email):
--     entrou responsável → vira SEGUIDOR do cartão-mãe, se ainda não tem vínculo nenhum nele (origem 'subtarefa-mae');
--     saiu responsável   → sai o seguidor que ESTE gatilho pôs, se ela não é mais responsável de nenhuma subtarefa do
--                          cartão. Vínculo posto por gente ou pela importação nunca é tirado.
--   Sem aviso extra: a subtarefa já avisa. Falha aqui nunca impede gravar a subtarefa.
--   Carga inicial: as subtarefas ABERTAS cujo responsável não tem vínculo no cartão (no JCN, 1 par em 26/11).
--
-- Diferenças do Painel: sem as travas de chabra_admin/schema_migrations.
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v368_gestao_subtarefa_segue_cartao_rollback.sql
begin;

create or replace function public.gestao_subtarefa_segue_mae_trg()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_novo text := case when tg_op <> 'DELETE' then nullif(lower(trim(new.responsavel_email)), '') end;
  v_velho text := case when tg_op <> 'INSERT' then nullif(lower(trim(old.responsavel_email)), '') end;
  v_id text := coalesce(new.id_tarefa, old.id_tarefa);
  v_sync text := coalesce(current_setting('gestao.sync_sub', true), '');
begin
  if v_novo is not distinct from v_velho then return null; end if;
  begin
    -- sem o aviso "Você agora segue a tarefa": a própria subtarefa já avisa
    perform set_config('gestao.sync_sub', 'on', true);
    if v_novo is not null then
      insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
      select v_id, v_novo, 'seguidor', 'subtarefa-mae'
       where exists (select 1 from public.gestao_tarefas t where t.id_tarefa = v_id)
         and not exists (select 1 from public.gestao_tarefa_vinculados v
                          where v.id_tarefa = v_id and v.usuario_email = v_novo)
      on conflict do nothing;
    end if;
    if v_velho is not null then
      delete from public.gestao_tarefa_vinculados v
       where v.id_tarefa = v_id and v.usuario_email = v_velho
         and v.tipo = 'seguidor' and v.origem = 'subtarefa-mae'
         and not exists (select 1 from public.gestao_subtarefas s
                          where s.id_tarefa = v_id and lower(s.responsavel_email) = v_velho);
    end if;
    perform set_config('gestao.sync_sub', v_sync, true);
  exception when others then
    perform set_config('gestao.sync_sub', v_sync, true);
    raise warning 'v368 gestao_subtarefa_segue_mae_trg (%): %', v_id, sqlerrm;
  end;
  return null;
end $function$;

revoke all on function public.gestao_subtarefa_segue_mae_trg() from public, anon, authenticated;

drop trigger if exists gestao_subtarefa_segue_mae on public.gestao_subtarefas;
create trigger gestao_subtarefa_segue_mae
  after insert or delete or update of responsavel_email on public.gestao_subtarefas
  for each row execute function public.gestao_subtarefa_segue_mae_trg();

-- ── carga inicial: subtarefas abertas cujo responsável não tem vínculo no cartão ─────────────
select set_config('gestao.sync_sub', 'on', true);        -- sem aviso
select set_config('gestao.in_google_sync', 'on', true);  -- sem entradas na fila da Google Agenda
insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
select distinct s.id_tarefa, lower(s.responsavel_email), 'seguidor', 'subtarefa-mae'
  from public.gestao_subtarefas s
  join public.gestao_tarefas t on t.id_tarefa = s.id_tarefa
 where not s.feito and nullif(trim(s.responsavel_email), '') is not null
   and not exists (select 1 from public.gestao_tarefa_vinculados v
                    where v.id_tarefa = s.id_tarefa and v.usuario_email = lower(s.responsavel_email))
on conflict do nothing;
select set_config('gestao.sync_sub', '', true);
select set_config('gestao.in_google_sync', '', true);

commit;
