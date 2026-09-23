-- ROLLBACK da v173 -- remove a coluna da miniatura do inventario.
--
-- SEGURO: a coluna so guarda o CAMINHO da miniatura. Nenhuma foto e apagada aqui
-- -- nem a original (foto_storage_path), nem os arquivos de miniatura que o
-- mutirao tenha criado no bucket. Depois deste script a lista volta a carregar a
-- ORIGINAL em resolucao plena, ou seja, volta a lentidao dos ~270 MB.
--
-- SE VOCE SO QUER PARAR DE USAR A MINIATURA sem perder o trabalho do mutirao,
-- NAO rode isto: basta o codigo voltar a ler foto_url. Apagar a coluna joga fora
-- os caminhos ja calculados e o mutirao teria de rodar de novo.
--
-- Os arquivos de miniatura em fotos/inventario-maquinas/thumbs/ ficam orfaos no
-- MinIO depois deste script (~3 MB no total). Limpeza deles e manual e
-- opcional -- nao atrapalham nada.
--
-- Rodar a mao:  psql -1 -v ON_ERROR_STOP=1 -f v173_inventario_foto_thumb_rollback.sql

do $$
declare n int;
begin
  select count(foto_thumb_path) into n from public.inventario_maquinas;
  raise notice 'ROLLBACK v173: descartando % caminho(s) de miniatura ja calculados', n;
end $$;

alter table public.inventario_maquinas
  drop column if exists foto_thumb_path;

delete from public.schema_migrations where version = 'v173_inventario_foto_thumb';
