-- ROLLBACK da v163 — desfaz o módulo Equipamentos (tabela + permissão + RLS).
--
-- SEGURO NESTE PONTO: a v163 só COPIA do inventário, não apaga nada. Derrubar a
-- tabela `equipamentos` aqui não perde dado nenhum — as 86 linhas originais
-- continuam em inventario_maquinas com categoria_inventario = 'equipamentos'.
--
-- DEIXA DE SER SEGURO depois de rodar scripts\sql\v168_*_cutover_inventario.sql,
-- que é quando as linhas originais são removidas. A partir dali, restaure o
-- backup que o v168 cria (public.bkp_v168_inventario_equipamentos) ANTES disto.
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v163_equipamentos_modulo_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_catalogo') is not null then
    raise exception 'Rollback da v163 abortado: a v164 (catalogo/estoque) esta aplicada. Rode os rollbacks na ordem inversa (167 -> 166 -> 165 -> 164 -> 163).';
  end if;
end $$;

drop policy if exists equipamentos_sel on public.equipamentos;
drop policy if exists equipamentos_rw  on public.equipamentos;
drop table if exists public.equipamentos;
drop function if exists public.caller_pode_equipamentos();

-- Devolve a permissão ao estado anterior (tira só o módulo novo).
update public.usuarios
   set modulos_permitidos = array_remove(modulos_permitidos, 'equipamentos')
 where modulos_permitidos is not null
   and 'equipamentos' = any(modulos_permitidos);

delete from public.schema_migrations where version = 'v163_equipamentos_modulo';
