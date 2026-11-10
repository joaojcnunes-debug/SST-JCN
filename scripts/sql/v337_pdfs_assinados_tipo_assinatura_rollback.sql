-- Rollback da v337 — apaga pdfs_assinados.tipo_assinatura (volta o erro 400 do relatório e a falha da
-- assinatura por imagem; só use junto com a volta do código).
begin;

alter table public.pdfs_assinados drop constraint if exists pdfs_assinados_tipo_assinatura_valido;
alter table public.pdfs_assinados drop column if exists tipo_assinatura;

notify pgrst, 'reload schema';

commit;
