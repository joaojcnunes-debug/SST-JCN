-- v327 — Catálogo de intervenções com listas abertas (06/11/2026, 0.3.240).
--
-- Pedido do João: na etapa Intervenções da Conciliação, inserir valor novo em Intervenção, Modalidade e
-- Responsável, e o valor entrar sozinho na página Intervenções, na coluna certa. Para isso a modalidade
-- deixa de ser limitada a três, e cada intervenção passa a guardar uma lista de responsáveis, como já
-- guarda de modalidades: inserir um novo não apaga o que estava lá. O primeiro é o padrão.
--
-- A coluna responsavel continua, acompanhando o primeiro da lista, para a versão anterior da tela seguir
-- funcionando durante o deploy. Pode sair numa próxima migração.
--
-- Rollback: scripts/sql/v327_intervencoes_listas_abertas_rollback.sql
begin;

alter table public.comercial_intervencoes drop constraint if exists comercial_intervencoes_modalidades_check;
alter table public.comercial_atendimento_intervencoes drop constraint if exists comercial_atendimento_intervencoes_modalidade_check;

alter table public.comercial_intervencoes add column if not exists responsaveis text[] not null default '{}';
update public.comercial_intervencoes
   set responsaveis = array[btrim(responsavel)]
 where responsaveis = '{}' and nullif(btrim(responsavel), '') is not null;

notify pgrst, 'reload schema';

commit;
