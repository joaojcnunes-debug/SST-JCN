-- ROLLBACK da v178 — Frota: movimentação, lotação e manutenção.
--
-- MORA AQUI, E NÃO EM supabase\migrations\, DE PROPÓSITO. O migrate.ps1 filtra
-- arquivos com "rollback" no nome desde a correção de 2026-07-21, mas a pasta
-- certa continua sendo esta. Um rollback dentro de migrations\ é um acidente
-- esperando a próxima pessoa que rodar a pasta inteira.
--
-- ⚠️ ESTE SCRIPT APAGA DADO. Ele não é o inverso inócuo da v178:
--     • frota_lotacoes  — perde o extrato de mudança de base. Os veículos ficam
--       onde estiverem no momento do rollback (o campo id_unidade não volta
--       atrás — a v178 nunca guardou "de onde veio" em outro lugar).
--     • frota_manutencoes — perde tudo: custo, oficina, próxima revisão.
--     • as 4 colunas de retorno — perde quem fechou, quando fechou, o que o
--       veículo trouxe de volta e a observação. `data_retorno` e `km_retorno`
--       SOBREVIVEM: elas são da v177, não desta migration.
--
-- Rode só se a v178 tiver acabado de subir e precisar sair. Se já houver
-- operação em cima dela, o caminho é corrigir para a frente.
--
--   psql -1 -v ON_ERROR_STOP=1 -f v178_frota_movimentacao_rollback.sql

-- Um retrato do que vai embora, antes de ir. Sem isto o rollback é irreversível
-- em silêncio; com isto, dá para reconstruir à mão se alguém se arrepender.
do $$
declare v_lot int; v_man int; v_ret int;
begin
  select count(*) into v_lot from public.frota_lotacoes;
  select count(*) into v_man from public.frota_manutencoes;
  select count(*) into v_ret from public.frota_checklists where retorno_em is not null;
  raise notice 'v178 rollback: apagando % lotacoes, % manutencoes e o entorno de % retornos ja registrados.',
    v_lot, v_man, v_ret;
end $$;

drop trigger if exists trg_frota_lotacao_move_veiculo   on public.frota_lotacoes;
drop trigger if exists trg_frota_lotacao_carimba_origem on public.frota_lotacoes;
drop function if exists public.frota_lotacao_move_veiculo();
drop function if exists public.frota_lotacao_carimba_origem();

drop trigger if exists trg_frota_valida_retorno on public.frota_checklists;
drop function if exists public.frota_valida_retorno();

drop table if exists public.frota_manutencoes;
drop table if exists public.frota_lotacoes;

drop index if exists public.idx_frota_checklists_em_aberto;

alter table public.frota_checklists
  drop constraint if exists ck_frota_checklists_km_retorno;

alter table public.frota_checklists
  drop column if exists retorno_por,
  drop column if exists retorno_em,
  drop column if exists avarias_retorno,
  drop column if exists retorno_observacao;

do $$
begin
  raise notice 'v178 revertida. data_retorno e km_retorno (v177) foram mantidas.';
end $$;
