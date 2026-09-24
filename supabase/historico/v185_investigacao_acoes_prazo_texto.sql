-- ============================================================================
-- V185: "Quando (prazo)" do plano de ação da INVESTIGAÇÃO DE ACIDENTE vira TEXTO
--
-- Pedido do técnico (26/08/2026): a data fechada não deixa registrar o prazo do
-- jeito que ele é combinado em campo — "imediato", "na próxima parada de
-- manutenção", "30 dias após a entrega dos EPIs". Com o seletor de data ele era
-- obrigado a inventar um dia do calendário para um compromisso que não tem um.
-- A coluna nasceu `date` na v113.
--
-- O QUE JÁ ESTÁ GRAVADO NÃO SE PERDE: a conversão grava a data em dd/mm/aaaa,
-- exatamente como ela aparecia na tela e no laudo. Nenhuma linha é apagada.
--
-- POR QUE SÓ AQUI:
--   `investigacao_acoes` é STANDALONE desde a v113 — as ações nascem e morrem
--   com a investigação, não são copiadas para o `acoes_5w2h` central. Ninguém
--   faz CONTA DE DATA em cima desta coluna: a listagem ordena por `ordem`, o
--   cálculo de "atrasado" e o portal do cliente leem `acoes_5w2h` (que continua
--   `date`), e a Apreciação NR-12 tem a sua própria `apreciacao_acoes` (idem).
--   Só o front da investigação e o PDF do laudo leem esta coluna.
--
-- REVERSÃO: enquanto todos os valores continuarem sendo datas dd/mm/aaaa, dá
-- para voltar para `date` com to_date(when_prazo,'DD/MM/YYYY'). Depois que o
-- técnico escrever texto livre, NÃO dá — e é justamente esse o objetivo.
--
-- Idempotente: se a coluna já for texto, não faz nada.
-- ============================================================================

begin;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'investigacao_acoes'
       and column_name  = 'when_prazo'
       and data_type    = 'date'
  ) then
    alter table public.investigacao_acoes
      alter column when_prazo type text
      using case
              when when_prazo is null then null
              else to_char(when_prazo, 'DD/MM/YYYY')
            end;
  end if;
end
$$;

comment on column public.investigacao_acoes.when_prazo is
  'Quando (prazo) do 5W2H — TEXTO LIVRE desde a v185 (era date, v113). O que existia foi convertido para dd/mm/aaaa. Exibir com lib/acoes/prazo.ts.';

commit;
