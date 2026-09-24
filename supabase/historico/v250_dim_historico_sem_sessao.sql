-- v250 — DIM-01: o gatilho de histórico para de quebrar quando NÃO há sessão.
--
-- Defeito da v249, encontrado pela prova de acesso em 2026-09-22:
--
--   ERROR: invalid input syntax for type json
--   DETAIL: The input string ended unexpectedly.
--   CONTEXT: PL/pgSQL function dim_registrar_historico() line 40
--
-- `dim_registrar_historico()` lia o autor com `auth.jwt() ->> 'email'`. O `auth.jwt()`
-- castra `current_setting('request.jwt.claims')` para json, e SEM sessão esse ajuste é a
-- string vazia — o cast estoura. Quem escreve sem sessão é justamente quem mais precisa
-- que a tabela aceite a escrita: `chabra_admin` num `psql`, uma correção manual, um
-- script de manutenção. Pela API (PostgREST) as claims sempre existem, então o defeito
-- ficaria escondido até o primeiro conserto à mão — e apareceria como "não consigo
-- corrigir a linha", não como "o gatilho está errado".
--
-- A carga da Fase 1.2 escapava por acidente (liga `app.dim_historico='off'` e retorna
-- antes da linha 40). Depender desse acaso não é desenho.
--
-- Correção: ler as claims com guarda, como a origem já fazia. Sem sessão, o autor fica
-- NULL — que é a verdade: não houve usuário, houve manutenção.
--
-- Rollback: scripts/sql/v250_rollback_dim_historico_sem_sessao.sql (volta à versão v249).

begin;

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'aplicar como postgres (dono da função)';
  end if;
  if to_regprocedure('public.dim_registrar_historico()') is null then
    raise exception 'v249 (dim_registrar_historico) é pré-requisito desta migration';
  end if;
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
  claims  jsonb;
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

  -- A GUARDA. Sem sessão o ajuste vem vazio (ou ausente) e o cast para jsonb estoura:
  -- o bloco de exceção transforma isso em "sem autor", que é o fato.
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;
  v_email := lower(nullif(claims ->> 'email', ''));
  if v_email is not null then
    select u.nome into v_nome from public.usuarios u where lower(u.email) = v_email limit 1;
  end if;

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

comment on function public.dim_registrar_historico() is
  'v250: grava quem mudou o quê nas dim_*. Lê as claims do JWT com guarda — escrita sem sessão (psql do chabra_admin, manutenção) grava autor NULL em vez de estourar. `app.dim_historico=off` desliga durante carga em massa.';


commit;
