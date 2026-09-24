-- v145 — Inventário: coluna `operadores` na máquina/equipamento.
--
-- Pedido do responsável técnico: a Relação de Máquinas e Equipamentos precisa
-- da coluna "Operadores", que existe no laudo de referência e não tinha campo
-- correspondente no painel.
--
-- Texto livre de propósito (nomes separados por vírgula), e não um vínculo com
-- o cadastro de colaboradores: hoje há 1 colaborador cadastrado no sistema
-- inteiro, então um vínculo deixaria a coluna vazia no papel. Quando o cadastro
-- de pessoas estiver povoado, os nomes já estarão aqui para migrar.
--
-- Aditiva e idempotente: nullable, sem default, sem backfill, nenhuma linha
-- existente é tocada. RLS não muda — a coluna herda as policies da tabela.

alter table public.inventario_maquinas
  add column if not exists operadores text;

comment on column public.inventario_maquinas.operadores is
  'Operadores da máquina, texto livre (nomes separados por vírgula). Sai na coluna "Operadores" da Relação de Máquinas.';
