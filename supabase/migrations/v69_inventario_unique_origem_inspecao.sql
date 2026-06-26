-- v69: dedupe de importação garantido no BANCO, não só no client.
-- A v66 criou índice comum em id_maquina_inspecao; importações concorrentes
-- (duas abas/usuários) furavam o check-then-insert do client e duplicavam
-- máquinas. Índice único CHEIO (NULLs são distintos no Postgres, então
-- cadastro manual com id_maquina_inspecao null nunca conflita).

-- Remove duplicatas existentes (mantém a mais antiga por origem)
delete from public.inventario_maquinas a
using public.inventario_maquinas b
where a.id_maquina_inspecao is not null
  and a.id_maquina_inspecao = b.id_maquina_inspecao
  and a.created_at > b.created_at;

drop index if exists idx_inventario_maquinas_origem_inspecao;

create unique index idx_inventario_maquinas_origem_inspecao
  on public.inventario_maquinas (id_maquina_inspecao);
