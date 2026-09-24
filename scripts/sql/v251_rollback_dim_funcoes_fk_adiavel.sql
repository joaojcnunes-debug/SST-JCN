-- ROLLBACK da v251 — a FK de hierarquia de dim_funcoes volta a NÃO ser adiável.
--
-- ⚠️ Depois disto, uma carga em massa de dim_funcoes só entra se o arquivo estiver em
-- ordem topológica (chefia antes de subordinada). Só faz sentido se a v251 tiver
-- causado algum problema — e aí o certo é entender qual, não voltar às cegas.

begin;

do $$ begin
  if current_user <> 'chabra_admin' then raise exception 'aplicar como chabra_admin'; end if;
end $$;

alter table public.dim_funcoes
  drop constraint if exists dim_funcoes_responde_para_fkey;

alter table public.dim_funcoes
  add constraint dim_funcoes_responde_para_fkey
  foreign key (responde_para) references public.dim_funcoes(id)
  on delete set null;

delete from public.schema_migrations where version = 'v251_dim_funcoes_fk_adiavel';

commit;
