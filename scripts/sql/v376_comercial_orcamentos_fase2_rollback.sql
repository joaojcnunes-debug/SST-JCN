-- Rollback da v376: volta a aceitar só os 3 modelos da Fase 1. Recusa se já houver orçamento de um modelo novo
-- (grupo, vida, cipa ou exames): apague ou converta esses orçamentos antes, de propósito.
begin;
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.comercial_orcamentos where modelo not in ('essencial', 'treinamentos', 'avulso');
  if v_n > 0 then
    raise exception 'Rollback v376 recusado: % orçamento(s) usam os modelos da Fase 2 (grupo, vida, cipa, exames).', v_n;
  end if;
end $$;
alter table public.comercial_orcamentos drop constraint if exists comercial_orcamentos_modelo_check;
alter table public.comercial_orcamentos add constraint comercial_orcamentos_modelo_check
  check (modelo in ('essencial', 'treinamentos', 'avulso'));
notify pgrst, 'reload schema';
commit;
