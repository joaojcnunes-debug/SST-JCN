-- v373 — Catálogo de intervenções: o texto do método em cada intervenção (27/11/2026, 0.3.330).
--
-- POR QUÊ: pedido do João (melhorar a página do catálogo, que vai receber novos cadastros): o texto padrão do método
-- (forma de realização, duração, avaliação, certificado) era só por modalidade (comercial_metodos, v370), e cada
-- treinamento tem duração e carga diferentes — a equipe ajustava empresa por empresa na Conciliação.
--
-- O QUE MUDA:
--   * comercial_intervencoes.metodos (jsonb, objeto): por modalidade, os campos que a intervenção tem de próprio;
--   * comercial_dados ganha 'metodos_intervencao' (id_intervencao → métodos), antes de 'planos', para o vendedor (o
--     catálogo só abre para quem libera).
-- Ordem do texto na tela: ajuste da empresa na intervenção > ajuste da empresa na modalidade (0.3.321) > texto da
-- intervenção (novo) > texto da modalidade.
-- ENSAIO (27/11/2026): a função mudou, reaplicar = mesmo md5, o vendedor (Admin) recebeu a intervenção com texto; o
-- rollback devolveu a função idêntica e tirou a coluna.
-- Rollback: scripts/sql/v373_catalogo_metodo_intervencao_rollback.sql.

begin;

-- 1) O texto padrão do método em cada intervenção do catálogo, por modalidade: {"EAD": {"duracao": "8h", ...}, ...}.
alter table public.comercial_intervencoes add column if not exists metodos jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comercial_intervencoes_metodos_objeto') then
    alter table public.comercial_intervencoes
      add constraint comercial_intervencoes_metodos_objeto check (jsonb_typeof(metodos) = 'object');
  end if;
end $$;

-- 2) comercial_dados leva esses textos ao vendedor (o catálogo só abre para quem libera): 'metodos_intervencao',
--    um objeto id_intervencao → métodos, só com as intervenções que têm texto próprio. Entra antes de 'planos'.
do $$
declare
  d text := pg_get_functiondef('public.comercial_dados()'::regprocedure);
  de text := E'\n    ''planos'', coalesce((';
  para text := E'\n    -- v373: o texto padrão do método de cada intervenção do catálogo (por modalidade), para o vendedor.\n'
    || E'    ''metodos_intervencao'', coalesce((\n'
    || E'      select jsonb_object_agg(i.id_intervencao, i.metodos) from public.comercial_intervencoes i\n'
    || E'       where i.metodos <> ''{}''::jsonb\n'
    || E'    ), ''{}''::jsonb),\n'
    || E'    ''planos'', coalesce((';
begin
  if position('''metodos_intervencao''' in d) > 0 then raise notice 'v373: comercial_dados já tem os métodos das intervenções'; return; end if;
  if (length(d) - length(replace(d, de, ''))) / length(de) <> 1 then
    raise exception 'v373: o trecho de ''planos'' não aparece exatamente 1 vez em comercial_dados (falta a v372/v395?) — nada foi aplicado';
  end if;
  execute replace(d, de, para);
end $$;

notify pgrst, 'reload schema';
commit;
