-- v173_inventario_foto_thumb.sql -- 2026-08-10
--
-- Fase 1 do briefing-equipamentos-chabra.md (secao 3.1): a coluna que guarda o
-- caminho da MINIATURA da foto do inventario.
--
-- O PROBLEMA QUE ELA RESOLVE (medido na producao em 2026-08-10, igual ao que o
-- briefing mediu em 06/08 -- nao mudou nada em 4 dias):
--   * fotos/inventario-maquinas no MinIO = 272 MB
--   * 121 fotos, media de 2,25 MB, as maiores em 6 MB
--   * a lista desenha cada uma num quadrado de 64x64 px (size-16), baixando a
--     ORIGINAL em resolucao plena -- sem paginacao, sem lazy, sem miniatura
--   * uploadFotoMaquina gravava o arquivo como saiu da camera
-- Ou seja: ~270 MB baixados para pintar 121 quadradinhos de unha.
--
-- COM a miniatura: a lista le foto_thumb_path (~25 kB cada, ~3 MB no total) e a
-- ORIGINAL so e buscada quando o usuario abre o equipamento. Decisao do operador
-- em 2026-08-10: encolher SO para a tela, original preservada e intocada.
--
-- 100% ADITIVA. Nao altera nem apaga uma linha sequer. Enquanto a coluna estiver
-- vazia o codigo cai na original (`foto_thumb_path ?? foto_url`), entao aplicar
-- esta migration ANTES do deploy do codigo e inofensivo, e aplicar DEPOIS
-- tambem -- a tela so deixa de ter miniatura ate a coluna existir.
--
-- TRANSACAO: deploy\migrate.ps1 roda `psql -1`, ou seja, o arquivo inteiro ja vem
-- dentro de UMA transacao. Por isso nao ha begin/commit explicito aqui -- seria
-- um BEGIN aninhado e o psql avisaria "there is already a transaction in
-- progress". O mesmo script dispara `NOTIFY pgrst, 'reload schema'` no fim, que
-- e o que faz a coluna nova aparecer para o PostgREST.
--
-- Rodar a mao:  psql -1 -v ON_ERROR_STOP=1 -f v173_inventario_foto_thumb.sql
-- Desfazer:     scripts/sql/v173_inventario_foto_thumb_rollback.sql

set lock_timeout = '5s';

-- Trava: aborta a transacao inteira em vez de deixar meia-bagunca.
do $$
begin
  if to_regclass('public.inventario_maquinas') is null then
    raise exception 'v173 abortada: public.inventario_maquinas nao existe';
  end if;
end $$;

alter table public.inventario_maquinas
  add column if not exists foto_thumb_path text;

comment on column public.inventario_maquinas.foto_thumb_path is
  'Caminho no bucket "fotos" da miniatura (~320px, JPEG) usada na LISTAGEM. A original continua em foto_storage_path/foto_url e e buscada so quando o usuario abre o item. NULL = ainda sem miniatura; o codigo cai na original. v173, 2026-08-10.';

do $$
declare v_total int; v_com_foto int;
begin
  select count(*), count(foto_url) into v_total, v_com_foto
    from public.inventario_maquinas;
  raise notice 'v173 OK: coluna criada. % itens no inventario, % com foto a receber miniatura pelo mutirao', v_total, v_com_foto;
end $$;
