-- v294 (JCN) — Gestão: tarefa criada no Meu Quadro nasce com o DONO como responsável.
--
-- POR QUÊ: a Google Agenda (e o Meu Espaço, os avisos de prazo) só considera quem está vinculado
-- (responsável/seguidor). Tarefa criada no Meu Quadro pelo "+" da coluna, pela lista ou pelo
-- calendário nascia sem ninguém e não ia para a agenda do dono. Pedido do usuário em 23/10/2026.
--
-- O QUE FAZ: gatilho AFTER INSERT em gestao_tarefas. Quadro com dono_email e tarefa sem
-- responsável → vincula o dono como responsável (origem 'meu-quadro'). Fica de fora:
--   • subtarefa aberta como tarefa (id_tarefa_pai) — o responsável vem da linha da subtarefa;
--   • escrita do sync do Google (gestao.in_google_sync = 'on') — a RPC do evento vincula sozinha;
--   • tarefa que já nasceu com responsável (recorrência copia os vínculos depois; o ON CONFLICT
--     evita duplicar).
-- A janela da tarefa também já sugere o dono como responsável (dá para trocar antes de salvar).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v294_gestao_meu_quadro_dono_responsavel_rollback.sql

create or replace function public.gestao_meu_quadro_dono_trg() returns trigger
  language plpgsql security definer set search_path = public as $fn$
declare v_dono text;
begin
  if new.id_tarefa_pai is not null then return null; end if;
  if coalesce(current_setting('gestao.in_google_sync', true), '') = 'on' then return null; end if;
  select lower(dono_email) into v_dono from public.gestao_quadros where id_quadro = new.id_quadro;
  if v_dono is null or v_dono = '' then return null; end if;
  if exists (select 1 from public.gestao_tarefa_vinculados
              where id_tarefa = new.id_tarefa and tipo = 'responsavel') then
    return null;
  end if;
  insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
  values (new.id_tarefa, v_dono, 'responsavel', 'meu-quadro')
  on conflict (id_tarefa, usuario_email, tipo) do nothing;
  return null;
end $fn$;
revoke all on function public.gestao_meu_quadro_dono_trg() from public, anon, authenticated;

drop trigger if exists trg_gestao_meu_quadro_dono on public.gestao_tarefas;
create trigger trg_gestao_meu_quadro_dono after insert on public.gestao_tarefas
  for each row execute function public.gestao_meu_quadro_dono_trg();

-- Tarefas que já existem no Meu Quadro sem responsável ganham o dono (hoje: a de teste).
insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
select t.id_tarefa, lower(q.dono_email), 'responsavel', 'meu-quadro'
  from public.gestao_tarefas t
  join public.gestao_quadros q on q.id_quadro = t.id_quadro
 where q.dono_email is not null and t.id_tarefa_pai is null
   and not exists (select 1 from public.gestao_tarefa_vinculados v
                    where v.id_tarefa = t.id_tarefa and v.tipo = 'responsavel')
on conflict (id_tarefa, usuario_email, tipo) do nothing;
