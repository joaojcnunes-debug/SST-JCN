-- v239 — coluna calculada `tem_associado` em inspecoes, para a pílula
-- "Associados" da lista de Inspeções (pedido de 16/09, afinado por ele em
-- 21/09: "um ícone como Todos / Rascunho / Em Andamento / Concluídas, que
-- puxa os documentos que têm associados").
--
-- Por que no banco e não na tela: a alternativa era mandar os ids das
-- inspeções com associado na URL (`id_inspecao=in.(...)`) — hoje são 402 ids
-- (~5 KB), e a URL passa dos 16 KB antes de um ano. Uma função com a linha
-- de `inspecoes` como parâmetro vira "coluna calculada" no PostgREST (v12):
-- filtra com `?tem_associado=is.true`, pagina e conta no servidor.
--
-- A régua é a MESMA da coluna "Associados" da lista e da contagem em memória
-- (lib/inspecoes/pilulas.ts): tem gente no documento se há linha em
-- inspecao_associados com nome, OU se elaboracao_responsavel está preenchido
-- (os 109 documentos com responsável sem linha, decisão dele de 21/09, contam).
--
-- SECURITY INVOKER (padrão): roda com a RLS de quem consulta.
-- Rollback: scripts/sql/v239_rollback_tem_associado.sql

begin;

create or replace function public.tem_associado(i public.inspecoes)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select nullif(trim(i.elaboracao_responsavel), '') is not null
      or exists (
        select 1 from public.inspecao_associados a
         where a.id_inspecao = i.id_inspecao
           and nullif(trim(a.nome), '') is not null
      );
$$;

comment on function public.tem_associado(public.inspecoes) is
  'v239 — coluna calculada (PostgREST): há alguém associado ao documento (linha em inspecao_associados ou elaboracao_responsavel).';

grant execute on function public.tem_associado(public.inspecoes) to authenticated;


commit;

-- PostgREST só enxerga a coluna calculada depois de reler o schema.
notify pgrst, 'reload schema';
