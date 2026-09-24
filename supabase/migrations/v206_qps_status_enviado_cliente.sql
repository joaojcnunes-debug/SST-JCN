-- v206 — qps_aplicacoes.status passa a aceitar ENVIADO_CLIENTE.
--
-- 🪤 Nasceu v205 e virou v206: em 10/09 a outra sessão levou o número v205
-- (v205_fix_adicionar_vinculados) e chegou ao remoto primeiro. Renumerada a
-- minha, que era a que ainda não tinha sido empurrada — é a 4ª colisão de
-- número entre sessões (v201, v203, v205). A chave de schema_migrations é o
-- NOME INTEIRO, então nada quebra; o que quebra é a leitura humana.
--
-- POR QUE: o Resumo de Questionários Psicossociais ganhou o quadro de status
-- com 4 colunas (Rascunhos · Em andamento · Concluídos · Enviados para
-- clientes), igual ao Dashboard Geral do DRPS. As três primeiras já existiam
-- no banco; a quarta, não.
--
-- É O MESMO CONSERTO DA v106, que fez isso no DRPS. Lá o frontend já usava o
-- status antes de a constraint permitir: arrastar um cartão para "Enviados
-- para clientes" devolvia 23514 (check_violation) e o cartão voltava sozinho
-- para a coluna anterior, sem explicação na tela.
--
-- ⚠️ Sem esta migration aplicada, a 4ª coluna do quadro EXISTE mas não aceita
-- cartão. O painel avisa: a mutação traduz o 23514 numa mensagem que cita a
-- v206 pelo nome, em vez do "algum valor não é permitido" genérico.
--
-- Idempotente e reversível (a v106 é o modelo). A trava ABORTA a transação
-- inteira em vez de deixar a tabela sem constraint nenhuma: se existir linha
-- com status fora da lista, nada é aplicado e o erro diz quais valores são.
begin;

do $$
declare
  fora text;
begin
  select string_agg(distinct status, ', ')
    into fora
    from public.qps_aplicacoes
   where status is not null
     and status not in ('RASCUNHO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ENVIADO_CLIENTE', 'DELETADO');
  if fora is not null then
    raise exception 'v206: qps_aplicacoes tem status fora da lista (%). Constraint NAO aplicada.', fora;
  end if;
end $$;

alter table public.qps_aplicacoes
  drop constraint if exists qps_aplicacoes_status_check;

alter table public.qps_aplicacoes
  add constraint qps_aplicacoes_status_check
  check (status = any (array[
    'RASCUNHO'::text,
    'EM_ANDAMENTO'::text,
    'CONCLUIDO'::text,
    'ENVIADO_CLIENTE'::text,
    'DELETADO'::text
  ]));

comment on column public.qps_aplicacoes.status is
  'RASCUNHO | EM_ANDAMENTO | CONCLUIDO | ENVIADO_CLIENTE | DELETADO (soft delete). ENVIADO_CLIENTE entrou na v206, com o quadro de status do Resumo.';

commit;

-- Depois de aplicar, é obrigatório recarregar o cache do PostgREST — ele não
-- é reiniciado pelo deploy:
--   docker exec db-messages-postgres psql -U chabra_admin -d painel_sst \
--     -c "NOTIFY pgrst, 'reload schema';"
--
-- Desfazer (volta a recusar ENVIADO_CLIENTE; só faz sentido se nenhuma linha
-- já estiver com esse valor):
--   alter table public.qps_aplicacoes drop constraint if exists qps_aplicacoes_status_check;
--   alter table public.qps_aplicacoes add constraint qps_aplicacoes_status_check
--     check (status = any (array['RASCUNHO'::text,'EM_ANDAMENTO'::text,'CONCLUIDO'::text,'DELETADO'::text]));
