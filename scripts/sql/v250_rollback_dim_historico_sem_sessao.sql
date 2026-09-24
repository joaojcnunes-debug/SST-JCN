-- ROLLBACK da v250 — devolve dim_registrar_historico() à versão da v249.
--
-- ⚠️ A versão v249 QUEBRA em escrita sem sessão (`auth.jwt()` sobre claims vazias).
-- Só faz sentido rodar isto se a v250 tiver introduzido outro problema — e aí o certo
-- é corrigir para frente, não voltar para uma função com defeito conhecido.

begin;

do $$ begin
  if current_user <> 'chabra_admin' then raise exception 'aplicar como chabra_admin'; end if;
end $$;

create or replace function public.dim_registrar_historico() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  antes   jsonb;
  depois  jsonb;
  rid     text;
  v_email text;
  v_nome  text;
begin
  if coalesce(current_setting('app.dim_historico', true), '') = 'off' then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE','DELETE') then antes  := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then depois := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (antes - 'updated_at') = (depois - 'updated_at') then
    return new;
  end if;

  if tg_table_name in ('dim_colaborador_unidades','dim_demanda_mensal','dim_unidade_mes') then
    if antes is not null then
      antes := antes || jsonb_build_object('unidade_nome',
        (select x.nome from public.dim_unidades x where x.id = (antes->>'unidade_id')::uuid));
    end if;
    if depois is not null then
      depois := depois || jsonb_build_object('unidade_nome',
        (select x.nome from public.dim_unidades x where x.id = (depois->>'unidade_id')::uuid));
    end if;
  end if;
  if tg_table_name = 'dim_colaborador_unidades' then
    if antes is not null then
      antes := antes || jsonb_build_object('colaborador_nome',
        (select x.nome from public.dim_colaboradores x where x.id = (antes->>'colaborador_id')::uuid));
    end if;
    if depois is not null then
      depois := depois || jsonb_build_object('colaborador_nome',
        (select x.nome from public.dim_colaboradores x where x.id = (depois->>'colaborador_id')::uuid));
    end if;
  end if;

  v_email := lower(nullif(auth.jwt() ->> 'email', ''));
  select u.nome into v_nome from public.usuarios u where lower(u.email) = v_email limit 1;

  rid := coalesce(depois->>'id', antes->>'id', depois->>'codigo', antes->>'codigo',
                  concat_ws('/', coalesce(depois, antes)->>'unidade_id',
                                 coalesce(depois, antes)->>'colaborador_id',
                                 coalesce(depois, antes)->>'ano',
                                 coalesce(depois, antes)->>'mes',
                                 coalesce(depois, antes)->>'condicao',
                                 coalesce(depois, antes)->>'porte'));

  insert into public.dim_historico (usuario_email, usuario_nome, tabela, operacao, registro_id, antes, depois)
  values (v_email, v_nome, tg_table_name, lower(tg_op), rid, antes, depois);

  return coalesce(new, old);
end $$;

delete from public.schema_migrations where version = 'v250_dim_historico_sem_sessao';

commit;
