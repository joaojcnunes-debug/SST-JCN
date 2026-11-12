-- Remove a demonstração "Teresópolis — modelo enxuto (teste)" (scripts/sql/demo_kanban_teresopolis_enxuto.sql).
-- Apaga a lista QDR-TERDEMO1 inteira: colunas, etiquetas, automações, filtros salvos e TODOS os cartões dela.
begin;
delete from public.gestao_filtros_salvos where id_quadro = 'QDR-TERDEMO1';
delete from public.gestao_automacoes where id_quadro = 'QDR-TERDEMO1';
delete from public.gestao_automacoes where id_quadro = 'QDR-70A13B38' and nome like '[Teste modelo enxuto]%';
delete from public.gestao_tarefas where id_quadro = 'QDR-TERDEMO1';
delete from public.gestao_etiquetas where id_quadro = 'QDR-TERDEMO1';
delete from public.gestao_status where id_quadro = 'QDR-TERDEMO1';
delete from public.gestao_quadros where id_quadro = 'QDR-TERDEMO1';
commit;
