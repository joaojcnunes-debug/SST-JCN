-- Desfaz a v326. Recusa se já houver parecer com AEP: são dados da equipe, e quem decide o destino
-- deles é uma pessoa. Rode depois de voltar o código para a 0.3.238.
begin;

do $$
begin
  if exists (select 1 from public.psico_conciliacao_pareceres where questionario = 'AEP') then
    raise exception 'Existem pareceres com questionario = AEP; resolva-os antes de desfazer a v326';
  end if;
end $$;

alter table public.psico_conciliacao_pareceres drop constraint if exists psico_conciliacao_pareceres_questionario_check;
alter table public.psico_conciliacao_pareceres
  add constraint psico_conciliacao_pareceres_questionario_check check (questionario in ('DRPS', 'QPS'));

alter table public.psico_conciliacao_reaberturas
  add constraint psico_conciliacao_reaberturas_id_empresa_fkey
  foreign key (id_empresa) references public.empresas(id_empresa) on delete cascade;

commit;
