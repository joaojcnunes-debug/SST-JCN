-- v342 — Gestão: Região e Produtos em toda tarefa (10/11/2026, 0.3.269).
--
-- Pedido do João (10/11/2026): "quero os dois campos" — igual ao Painel (0.3.908, v348). A Região grava a etiqueta da
-- unidade (lib/gestao/regiao-produtos.ts, sem banco). Os Produtos ficam num campo de múltipla escolha da lista
-- Comercial, com o MESMO id do Painel (eb5d9daf…), e a função gestao_produtos_catalogo() entrega só os nomes das
-- opções a quem é da Gestão (a lista Comercial pode ser restrita na RLS de gestao_campos).
-- No JCN o campo não existia: nasce aqui com um catálogo inicial (produtos de SST do Runrun, os do Painel que não são
-- só da Chabra e os do Comercial do JCN). As opções se editam depois em Campos da lista Comercial.
-- Rollback: scripts/sql/v342_gestao_produtos_catalogo_rollback.sql
begin;

do $$ begin
  if not exists (select 1 from public.gestao_quadros where id_quadro = 'QDR-70A13B38') then
    raise exception 'v342: lista Comercial (QDR-70A13B38) não encontrada';
  end if;
  if to_regprocedure('public.gestao_meu_papel()') is null then raise exception 'v342: falta gestao_meu_papel()'; end if;
end $$;

insert into public.gestao_campos (id, id_quadro, nome, tipo, opcoes, ordem)
values ('eb5d9daf-9b81-4903-bfd5-4fea654225e7', 'QDR-70A13B38', 'Produtos', 'multi', array[
  'PGR', 'PCMSO', 'LTCAT', 'LI', 'LP', 'PPP', 'Envio do eSocial', 'AET', 'AEP', 'APR', 'DRPS', 'QPS',
  'Psicossocial', 'Intervenção psicossocial', 'PAE', 'Mapa de Risco', 'Apreciação NR-12', 'Análise de Químicos',
  'Avaliação de Quantitativo', 'Avaliação de Agentes Químicos', 'Avaliação de Ruído', 'Avaliação de Vibração',
  'Primeiros Socorros', 'Treinamentos NR'
]::text[], 0)
on conflict (id) do nothing;

create or replace function public.gestao_produtos_catalogo()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.opcoes, '{}'::text[])
    from public.gestao_campos c
   where c.id = 'eb5d9daf-9b81-4903-bfd5-4fea654225e7'
     and public.gestao_meu_papel() is not null
$$;

comment on function public.gestao_produtos_catalogo() is
  'v342 (Painel v348): opções do campo Produtos do Comercial para a tarefa de qualquer lista. Só membro da Gestão.';

revoke all on function public.gestao_produtos_catalogo() from public, anon;
grant execute on function public.gestao_produtos_catalogo() to authenticated;

notify pgrst, 'reload schema';

commit;
