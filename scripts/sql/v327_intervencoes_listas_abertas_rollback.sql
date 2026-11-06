-- Desfaz a v327. Rode depois de voltar o código para a 0.3.239. Recusa se já houver modalidade fora das
-- três de partida: são dados da equipe, e quem decide o destino deles é uma pessoa. Os responsáveis além
-- do primeiro se perdem; a coluna responsavel fica com o primeiro de cada intervenção.
begin;

do $$
begin
  if exists (select 1 from public.comercial_intervencoes where not modalidades <@ array['EAD', 'Presencial', 'Ao vivo']::text[])
     or exists (select 1 from public.comercial_atendimento_intervencoes where modalidade is not null and modalidade not in ('EAD', 'Presencial', 'Ao vivo')) then
    raise exception 'Existem modalidades fora de EAD, Presencial e Ao vivo; resolva-as antes de desfazer a v327';
  end if;
end $$;

alter table public.comercial_intervencoes drop column if exists responsaveis;
alter table public.comercial_intervencoes
  add constraint comercial_intervencoes_modalidades_check check (modalidades <@ array['EAD', 'Presencial', 'Ao vivo']::text[]);
alter table public.comercial_atendimento_intervencoes
  add constraint comercial_atendimento_intervencoes_modalidade_check check (modalidade is null or modalidade in ('EAD', 'Presencial', 'Ao vivo'));

notify pgrst, 'reload schema';

commit;
