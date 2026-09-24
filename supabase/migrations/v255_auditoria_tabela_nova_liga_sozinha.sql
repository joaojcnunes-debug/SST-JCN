-- v255 — Auditoria: as 6 tabelas que ficaram de fora + toda tabela NOVA liga sozinha.
--
-- O BURACO (medido 23-24/09): a v212 ligou o gatilho em todas as tabelas que
-- existiam em 14/09 e deixou a regra "tabela nova → `select auditoria_ativar(...)`".
-- Só a v225 (qps_*) e a v241 (sgg_envios) lembraram. Ficaram SEM trilha:
--   funcoes_painel, cargos_painel (v229/v233) — quem muda a permissão de quem;
--   gestao_equipes, gestao_equipe_membros (v235);
--   rls_modulo_config, rls_modulo_tabelas (v236) — a trava por módulo.
--
-- O QUE FAZ:
--   1) `auditoria_elegivel(tabela)`: o filtro da v212 (logs, históricos, backups,
--      filas, preferências de tela ficam de fora) num lugar só, mais:
--      - telemetria de uso (`modulo_aberturas`, `presenca_pings`,
--        `presenca_encerramentos`): ruído, não movimentação — o mesmo motivo de
--        `novidades_vistas` já estar fora;
--      - `dim_*` (Dimensionamento, v249): o módulo tem trilha PRÓPRIA
--        (`dim_historico`) com chave para desligar em carga em massa
--        (`app.dim_historico=off`); o gatilho daqui dobraria o registro e
--        ignoraria essa chave.
--   2) Liga o gatilho nas 6 tabelas acima.
--   3) EVENT TRIGGER `auditoria_tabela_nova`: ao fim de todo CREATE TABLE no
--      schema public, se a tabela é elegível e tem chave primária, chama
--      `auditoria_ativar`. Tabela que alguém DESLIGOU de propósito
--      (`auditoria_tabelas.ativo = false`) não é religada.
--      NUNCA derruba a migration de ninguém: qualquer erro vira WARNING e a
--      tabela é criada do mesmo jeito (sem trilha, como hoje).
--   4) As 7 `prod_*` que a v254 apagou continuavam "ativas" na config — viram
--      `ativo = false` (a trilha delas fica).
--
-- Tabela criada SEM chave primária e ganhando a chave depois (ALTER TABLE) não é
-- pega — a regra olha só o CREATE TABLE. Aí vale o `auditoria_ativar` à mão.
--
-- ROLLBACK: scripts/sql/v255_auditoria_tabela_nova_liga_sozinha.rollback.sql
-- Idempotente. Rodar com `psql -1 -v ON_ERROR_STOP=1` (como chabra_admin:
-- event trigger exige superusuário).

-- ── 1) Quem entra na trilha ─────────────────────────────────────────────────
create or replace function public.auditoria_elegivel(p_tabela text)
returns boolean language sql immutable as $$
  select p_tabela !~ '^(auditoria_|backup_|bkp_|dim_|schema_migrations$)'
     and p_tabela !~ '(_log|_historico|_versoes|_revisao)$'
     and p_tabela not in (
       'document_audit_logs', 'registros_excluidos',
       'gestao_google_eventos', 'gestao_google_fila', 'gestao_notificacoes',
       'gestao_preferencias_visao', 'gestao_filtros_salvos',
       'novidades_vistas',
       'equip_biometria_sondas', 'equip_biometria_tentativas',
       'modulo_aberturas', 'presenca_pings', 'presenca_encerramentos'
     )
$$;
comment on function public.auditoria_elegivel(text) is
  'v255 — true se a tabela deve ter gatilho de auditoria (filtro da v212 + telemetria + dim_*). Usada pelo event trigger auditoria_tabela_nova.';

-- ── 2) As 6 que ficaram de fora ─────────────────────────────────────────────
select public.auditoria_ativar('funcoes_painel', 'sistema');
select public.auditoria_ativar('cargos_painel', 'sistema');
select public.auditoria_ativar('rls_modulo_config', 'sistema');
select public.auditoria_ativar('rls_modulo_tabelas', 'sistema');
select public.auditoria_ativar('gestao_equipes');
select public.auditoria_ativar('gestao_equipe_membros');

-- ── 3) Tabela nova liga sozinha ─────────────────────────────────────────────
create or replace function public.auditoria_ligar_tabela_nova()
returns event_trigger language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_nome text;
begin
  for r in
    select objid
      from pg_event_trigger_ddl_commands()
     where command_tag = 'CREATE TABLE'
       and object_type = 'table'
       and schema_name = 'public'
  loop
    begin
      select c.relname::text into v_nome
        from pg_class c
       where c.oid = r.objid and c.relkind = 'r';

      if v_nome is null or not public.auditoria_elegivel(v_nome) then
        continue;
      end if;
      if exists (select 1 from public.auditoria_tabelas t
                  where t.tabela = v_nome and not t.ativo) then
        continue;  -- desligada de propósito: não religar
      end if;
      if not exists (select 1 from pg_index i
                      where i.indrelid = r.objid and i.indisprimary) then
        raise warning 'auditoria: tabela % criada SEM chave primaria — ficou sem trilha. Depois de criar a chave: select public.auditoria_ativar(''%'');', v_nome, v_nome;
        continue;
      end if;

      perform public.auditoria_ativar(v_nome);
      raise notice 'auditoria: gatilho ligado na tabela nova %.', v_nome;
    exception when others then
      raise warning 'auditoria: nao liguei o gatilho em % (%). A tabela foi criada normalmente.', coalesce(v_nome, r.objid::text), sqlerrm;
    end;
  end loop;
exception when others then
  raise warning 'auditoria_ligar_tabela_nova falhou (%). A migration segue.', sqlerrm;
end $$;

revoke all on function public.auditoria_ligar_tabela_nova() from public, authenticated, anon;

drop event trigger if exists auditoria_tabela_nova;
create event trigger auditoria_tabela_nova
  on ddl_command_end
  when tag in ('CREATE TABLE')
  execute function public.auditoria_ligar_tabela_nova();

-- ── 4) Config das tabelas que não existem mais ──────────────────────────────
update public.auditoria_tabelas t
   set ativo = false
 where t.ativo
   and to_regclass('public.' || quote_ident(t.tabela)) is null;


notify pgrst, 'reload schema';
