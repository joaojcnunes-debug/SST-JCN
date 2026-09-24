-- v252 -- SGG-RISCOS-01 fase 3: sgg_envios.status passa a aceitar 'indeterminado'.
-- O servico do host (fase 2) ja devolve esse resultado quando a falha ocorre DEPOIS
-- de os bytes sairem: virar 'erro' convidaria reenvio, que e a unica forma de duplicar.
begin;
do $$ begin
  if current_database() <> 'postgres' then raise exception 'banco errado: %', current_database(); end if;
end $$;

alter table public.sgg_envios drop constraint if exists sgg_envios_status_chk;
alter table public.sgg_envios add constraint sgg_envios_status_chk
  check (status in ('pendente','enviado','erro','duplicado','indeterminado'));

comment on column public.sgg_envios.status is
  'pendente|enviado|erro|duplicado|indeterminado. indeterminado = falha apos os bytes sairem; conferir no SGG antes de reenviar (nao ha DELETE na API).';

do $$ begin
  if (select count(*) from pg_constraint
       where conrelid='public.sgg_envios'::regclass and conname='sgg_envios_status_chk'
         and pg_get_constraintdef(oid) like '%indeterminado%') <> 1 then
    raise exception 'CHECK de status nao ficou com indeterminado';
  end if;
end $$;
commit;
