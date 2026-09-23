-- ROLLBACK da v177 — desfaz o módulo Frota (9 tabelas + permissão + RLS + trigger).
--
-- SEGURO POR CONSTRUÇÃO: a v177 é puramente aditiva. Ela não copiou, não moveu e
-- não alterou nenhuma tabela existente — só criou as 9 public.frota_*. Derrubar
-- tudo aqui não perde dado de nenhum outro módulo.
--
-- O QUE SE PERDE: os dados de frota lançados até agora (veículos, saídas, fotos,
-- sinistros, abastecimentos). É o que se espera de um rollback de módulo em
-- teste. Se houver lançamento que interesse guardar, faça o dump ANTES:
--   docker exec db-messages-postgres pg_dump -U chabra_admin -d painel_sst \
--     -t 'public.frota_*' > frota_backup.sql
--
-- AS FOTOS NÃO SÃO APAGADAS DAQUI. Elas moram no storage, sob o prefixo
-- fotos/frota/ — apagar é passo separado e manual (é o passo 5 da remoção do
-- módulo). Este arquivo mexe só no banco.
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v177_frota_checklist_veiculos_rollback.sql
--
-- POR QUE ESTE ARQUIVO NÃO ESTÁ EM supabase\migrations\: rollback não é
-- migration, ele desfaz. O deploy\migrate.ps1 filtra nomes com "rollback" como
-- trava extra — mas a pasta certa é esta. Em 2026-07-21 um v138_ROLLBACK_*.sql
-- foi parar na pasta de migrations e teria sido aplicado como migration normal.

-- ── 1) Triggers e funções das travas ────────────────────────────────────────
drop trigger  if exists trg_frota_exige_4_fotos    on public.frota_checklists;
drop trigger  if exists trg_frota_checklist_mesma_base on public.frota_checklists;
drop function if exists public.frota_exige_4_fotos();
drop function if exists public.frota_checklist_mesma_base();

-- ── 2) Policies ─────────────────────────────────────────────────────────────
-- Explícitas, na ordem inversa da criação. `drop table` levaria as policies
-- junto, mas listar aqui é o que faz o rollback rodar sem erro num banco onde
-- alguma tabela já tenha sido derrubada à mão.
drop policy if exists frota_abastecimento_anexos_sel on public.frota_abastecimento_anexos;
drop policy if exists frota_abastecimento_anexos_rw  on public.frota_abastecimento_anexos;
drop policy if exists frota_sinistro_fotos_sel       on public.frota_sinistro_fotos;
drop policy if exists frota_sinistro_fotos_rw        on public.frota_sinistro_fotos;
drop policy if exists frota_rotas_sel                on public.frota_rotas;
drop policy if exists frota_rotas_rw                 on public.frota_rotas;
drop policy if exists frota_checklist_fotos_sel      on public.frota_checklist_fotos;
drop policy if exists frota_checklist_fotos_rw       on public.frota_checklist_fotos;
drop policy if exists frota_sinistros_sel            on public.frota_sinistros;
drop policy if exists frota_sinistros_rw             on public.frota_sinistros;
drop policy if exists frota_abastecimentos_sel       on public.frota_abastecimentos;
drop policy if exists frota_abastecimentos_rw        on public.frota_abastecimentos;
drop policy if exists frota_veiculo_fotos_sel        on public.frota_veiculo_fotos;
drop policy if exists frota_veiculo_fotos_rw         on public.frota_veiculo_fotos;
drop policy if exists frota_checklists_sel           on public.frota_checklists;
drop policy if exists frota_checklists_rw            on public.frota_checklists;
drop policy if exists frota_veiculos_sel             on public.frota_veiculos;
drop policy if exists frota_veiculos_rw              on public.frota_veiculos;

-- ── 3) Tabelas, na ordem inversa das dependências ───────────────────────────
-- Netas → filhas → raízes. Sem `cascade`: se sobrar dependência que este script
-- não conhece, é melhor falhar e mostrar do que apagar em silêncio.
drop table if exists public.frota_abastecimento_anexos;
drop table if exists public.frota_sinistro_fotos;
drop table if exists public.frota_checklist_fotos;
drop table if exists public.frota_rotas;
drop table if exists public.frota_sinistros;
drop table if exists public.frota_abastecimentos;
drop table if exists public.frota_veiculo_fotos;
drop table if exists public.frota_checklists;
drop table if exists public.frota_veiculos;

-- ── 4) Funções de acesso do módulo ──────────────────────────────────────────
-- Depois das tabelas: frota_pode_* referencia frota_veiculos/frota_checklists.
drop function if exists public.frota_pode_checklist(text);
drop function if exists public.frota_pode_veiculo(text);
drop function if exists public.caller_pode_frota();

-- ── 5) Permissão ────────────────────────────────────────────────────────────
-- A v177 não concedeu o módulo a ninguém, mas o admin pode ter concedido à mão
-- durante a validação. Tira 'frota' de quem tiver.
update public.usuarios
   set modulos_permitidos = array_remove(modulos_permitidos, 'frota')
 where modulos_permitidos is not null
   and 'frota' = any(modulos_permitidos);

-- ── 6) Registro da migration ────────────────────────────────────────────────
-- Sem isto, o migrate.ps1 considera a v177 aplicada e não a rodaria de novo.
delete from public.schema_migrations where version = 'v177_frota_checklist_veiculos';

do $$
begin
  raise notice 'Rollback v177 concluido: 9 tabelas, 4 funcoes, 18 policies e 2 triggers removidos. As fotos em fotos/frota/ NAO foram apagadas.';
end $$;
