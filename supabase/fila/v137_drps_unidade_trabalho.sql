-- v137: DRPS — captura da "unidade de trabalho" informada no Forms.
--
-- Contexto: o formulário de alguns clientes tem uma pergunta demográfica a mais
-- ("Qual sua unidade de trabalho?", coluna 2 de 54). O parser passou a tolerar
-- essa coluna extra na v0.3.445 (commit ffdcdb9) ancorando as respostas no fim
-- da linha — mas apenas ABSORVIA a coluna: lia e descartava. Esta migration cria
-- o destino do dado; o parser passa a preenchê-lo na mesma versão.
--
-- FASE 1 (esta): só captura. Nada lê a coluna ainda, nenhum cálculo muda, nenhum
-- laudo existente é afetado. Relatórios cujo formulário não tem a pergunta ficam
-- com NULL e seguem funcionando exatamente como hoje.
-- FASE 2 (futura, a decidir): unidade no filtro / hierarquia no laudo.
--
-- Aplicar em produção manualmente (migrations do DRPS não são automáticas).
-- Schema real de drps_respondentes conferido no banco em 2026-07-16: bate com o
-- repositório (id_respondente uuid PK, sem coluna unidade_*).

begin;

-- Trava: aborta se a tabela não for a esperada, em vez de alterar o que não deve.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'drps_respondentes'
  ) then
    raise exception 'drps_respondentes não existe — migration abortada';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'drps_respondentes'
       and column_name = 'unidade_trabalho'
  ) then
    raise notice 'unidade_trabalho já existe — nada a fazer';
  end if;
end $$;

-- Nullable de propósito: a coluna só é preenchida quando o formulário pergunta.
-- Não confundir com a tabela public.unidades (v75), que é um agrupamento de
-- empresas para controle de acesso — conceito diferente, nível acima da empresa.
-- Esta coluna é o local/posto de trabalho DENTRO de uma empresa, texto livre
-- vindo da resposta do trabalhador.
alter table public.drps_respondentes
  add column if not exists unidade_trabalho text;

comment on column public.drps_respondentes.unidade_trabalho is
  'Unidade/local de trabalho informado pelo respondente no Forms. NULL quando o formulário não tem essa pergunta. Texto livre — não é FK para public.unidades.';

-- Índice para o agrupamento por unidade dentro de um relatório (Fase 2) e para
-- o "quantas unidades tem aqui?" da tela de Dados. Parcial: a maioria é NULL.
create index if not exists idx_drps_resp_unidade
  on public.drps_respondentes (id_relatorio, unidade_trabalho)
  where unidade_trabalho is not null;

-- Conferência: deve listar a coluna nova como nullable, e 0 linhas preenchidas
-- (o backfill vem da reimportação pela tela, não daqui).
do $$
declare
  v_existe boolean;
begin
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'drps_respondentes'
       and column_name = 'unidade_trabalho'
       and is_nullable = 'YES'
  ) into v_existe;

  if not v_existe then
    raise exception 'unidade_trabalho não foi criada como nullable — abortando';
  end if;

  raise notice 'OK: unidade_trabalho criada. Respondentes totais: %',
    (select count(*) from public.drps_respondentes);
end $$;

commit;
