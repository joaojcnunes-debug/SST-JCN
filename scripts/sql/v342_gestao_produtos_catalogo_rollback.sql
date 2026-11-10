-- Rollback da v342 — tira a função do catálogo e o campo Produtos da lista Comercial.
-- ATENÇÃO: os Produtos marcados nas tarefas (gestao_tarefas.campos['eb5d9daf…']) ficam gravados, mas sem o campo não
-- aparecem. Use junto com a volta do código.
begin;
drop function if exists public.gestao_produtos_catalogo();
delete from public.gestao_campos where id = 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';
notify pgrst, 'reload schema';
commit;
