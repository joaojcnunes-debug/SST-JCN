-- ROLLBACK da v150 — desfaz a cascata Unidade › Setor › Função.
--
-- ⚠️ NÃO é uma migration para aplicar na sequência. É o botão de desfazer,
-- para o caso de a adição precisar ser removida.
--
-- O QUE ELE APAGA: só o que a v150 criou — as 2 tabelas de override (que
-- guardam apenas as exceções por unidade) e as 4 colunas novas de
-- drps_relatorios.
--
-- O QUE ELE NÃO ENCOSTA: drps_probabilidades, drps_monitoramento,
-- drps_respondentes, drps_relatorios e as colunas *_por_setor com os textos
-- das psicólogas. Todo o trabalho anterior à v150 continua exatamente onde
-- está — a v150 nunca reescreveu nada disso, por isso desfazer é seguro.
--
-- O que se perde ao rodar: as diferenciações por unidade feitas DEPOIS da
-- v150 (overrides de probabilidade e textos por unidade). O bloco volta a
-- usar o valor do setor, que é de onde ele herdava antes.
--
-- Ordem correta ao desfazer tudo: rode este script E volte o código para
-- antes do reflexo da cascata (v0.3.132 daqui). O código novo tolera as tabelas
-- ausentes? NÃO — as telas consultariam tabela inexistente. Por isso: código
-- primeiro, banco depois, ou os dois na mesma janela.
--
-- Depois de rodar, o PostgREST relê o schema sozinho (notify pgrst no fim).

begin;

-- Retrato do que NÃO pode mudar.
create temporary table _rb150_antes on commit drop as
select
  (select count(*) from public.drps_relatorios)      as relatorios,
  (select count(*) from public.drps_probabilidades)  as probabilidades,
  (select count(*) from public.drps_monitoramento)   as monitoramento,
  (select count(*) from public.drps_respondentes)    as respondentes,
  (select md5(coalesce(string_agg(
      id_relatorio || '|' || setor || '|' || topico_idx || '|' || probabilidade,
      ',' order by id_relatorio, setor, topico_idx), ''))
     from public.drps_probabilidades)                as hash_probabilidades,
  (select count(*) from public.drps_relatorios
    where conclusoes_por_setor is not null)          as com_conclusoes;

-- Avisa quanto trabalho por unidade está sendo descartado.
do $$
declare
  v_over int := 0;
  v_txt  int := 0;
begin
  if to_regclass('public.drps_probabilidades_unidade') is not null then
    select count(*) into v_over from public.drps_probabilidades_unidade;
  end if;
  if exists (select 1 from information_schema.columns
              where table_name = 'drps_relatorios'
                and column_name = 'conclusoes_por_unidade_setor') then
    select count(*) into v_txt from public.drps_relatorios
     where conclusoes_por_unidade_setor is not null
        or agravos_por_unidade_setor is not null
        or medidas_por_unidade_setor is not null;
  end if;
  raise notice 'Descartando: % override(s) de probabilidade por unidade e texto(s) por unidade em % relatorio(s)',
    v_over, v_txt;
end $$;

drop table if exists public.drps_probabilidades_unidade;
drop table if exists public.drps_monitoramento_unidade;

alter table public.drps_relatorios
  drop column if exists conclusoes_por_unidade_setor,
  drop column if exists agravos_por_unidade_setor,
  drop column if exists medidas_por_unidade_setor,
  drop column if exists exibir_sem_analise;

-- Conferência: o trabalho anterior à v150 continua intacto.
do $$
declare
  a _rb150_antes%rowtype;
begin
  select * into a from _rb150_antes;

  if (select count(*) from public.drps_relatorios) <> a.relatorios
     or (select count(*) from public.drps_probabilidades) <> a.probabilidades
     or (select count(*) from public.drps_monitoramento) <> a.monitoramento
     or (select count(*) from public.drps_respondentes) <> a.respondentes then
    raise exception 'ABORTADO: o rollback mexeu em dado que nao deveria';
  end if;

  if (select md5(coalesce(string_agg(
        id_relatorio || '|' || setor || '|' || topico_idx || '|' || probabilidade,
        ',' order by id_relatorio, setor, topico_idx), ''))
        from public.drps_probabilidades) <> a.hash_probabilidades then
    raise exception 'ABORTADO: o conteudo de drps_probabilidades mudou';
  end if;

  if (select count(*) from public.drps_relatorios
       where conclusoes_por_setor is not null) <> a.com_conclusoes then
    raise exception 'ABORTADO: os textos por setor mudaram';
  end if;

  raise notice 'OK rollback — v150 removida. relatorios=% probabilidades=% (hash confere) respondentes=%',
    a.relatorios, a.probabilidades, a.respondentes;
end $$;

notify pgrst, 'reload schema';

commit;
