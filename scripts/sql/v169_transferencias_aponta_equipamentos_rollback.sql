-- ROLLBACK da v169 — desfaz o vínculo entre transferências e o módulo Equipamentos.
--
-- O QUE ESTE SCRIPT DESTRÓI
--   A coluna `transferencias.id_equipamento` e o índice dela. O histórico em si
--   NÃO se perde: `transferencias.id_maquina` continua apontando para o
--   inventário, e é de lá que a coluna foi derivada.
--
-- ⚠️ NÃO RODE ESTE ROLLBACK DEPOIS DO v168.
--   Depois do cutover, `id_maquina` aponta para linhas que foram APAGADAS e
--   `id_equipamento` passa a ser o ÚNICO vínculo vivo do histórico. Derrubar a
--   coluna ali deixaria as transferências sem referência nenhuma — só o
--   snapshot em texto. Restaure `public.bkp_v168_inventario_equipamentos` antes.
--
--   Este script se recusa a rodar se detectar que o v168 já passou.
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v169_..._rollback.sql

do $$
begin
  if to_regclass('public.bkp_v168_inventario_equipamentos') is not null then
    raise exception
      'rollback da v169 RECUSADO: o v168 (cutover) ja rodou — id_equipamento e o unico vinculo vivo do historico. Restaure bkp_v168_inventario_equipamentos antes.';
  end if;
end $$;

drop index if exists public.idx_transferencias_equipamento;

alter table public.transferencias
  drop column if exists id_equipamento;

do $$
begin
  raise notice 'v169 desfeita: transferencias.id_equipamento removida (historico preservado via id_maquina)';
end $$;
