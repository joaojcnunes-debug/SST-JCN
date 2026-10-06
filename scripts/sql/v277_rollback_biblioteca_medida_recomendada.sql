-- Rollback da v277: remove as opções de medida recomendada e o tópico.
delete from public.psi_biblioteca_itens where topico = 'medida_recomendada';
alter table public.psi_biblioteca_itens drop constraint if exists psi_biblioteca_itens_topico_check;
alter table public.psi_biblioteca_itens add constraint psi_biblioteca_itens_topico_check check (topico in
  ('perigo','fonte','evidencia','descricao','danos','medida','sugestao','acao','meio','situacao','tempo'));
