-- v282 (JCN) — Inspeções: quem foi a campo, como COLUNA CALCULADA (PostgREST).
-- Replicado do Painel SST (v284, commit 4cd79ee6, v0.3.724), sem schema_migrations.
-- O índice responsaveis(id_inspecao) já existe no JCN (idx_responsaveis_inspecao).
--
-- PEDIDO (07/10): o filtro "Técnico" da tela Inspeções procurava só quem
-- LANÇOU a inspeção (`inspecoes.responsavel`), e o técnico de campo mora em
-- outra tabela (`responsaveis`, aba Responsáveis / "Quem vai a campo?").
-- Proposta aprovada por ele:
--   1. o filtro segue a regra de quem foi a campo (a do dashboard, 25/08):
--      os nomes da aba Responsáveis; sem nenhum, quem lançou;
--   2. a busca ignora acento ("Ledimo" acha "Lédimo");
--   3. a coluna da lista mostra quem foi a campo quando é outra pessoa.
--
-- POR QUE COLUNA CALCULADA, E NÃO COLUNA GRAVADA + GATILHO: é o padrão da
-- `tem_associado` (v239). Calculada na hora, nunca desatualiza, não precisa de
-- backfill, não dispara a auditoria da v212 a cada mudança na aba e não mexe no
-- `updated_at` da inspeção.
--
-- Nome: o da CONTA quando há vínculo (`id_usuario`, v204) — é a grafia
-- padronizada —; senão o texto gravado. Linha com o nome em branco não conta,
-- igual ao dashboard (`fetchTecnicosDeCampo`).
--
-- Idempotente.
-- ROLLBACK: drop function public.tecnicos_campo(public.inspecoes);
--           drop function public.tecnicos_busca(public.inspecoes);

-- Para EXIBIR: "Sirlei Lopes, Elaine Maia". Nulo = ninguém na aba.
create or replace function public.tecnicos_campo(i public.inspecoes)
returns text
language sql
stable
set search_path to 'public'
as $$
  select string_agg(distinct coalesce(nullif(btrim(u.nome), ''), btrim(r.tecnico_responsavel)), ', ')
    from public.responsaveis r
    left join public.usuarios u on u.id_usuario = r.id_usuario
   where r.id_inspecao = i.id_inspecao
     and nullif(btrim(r.tecnico_responsavel), '') is not null;
$$;

comment on function public.tecnicos_campo(public.inspecoes) is
  'v282 (painel v284) — coluna calculada: nomes de quem foi a campo (aba Responsáveis), nome da conta quando há vínculo.';

-- Para BUSCAR: minúsculo e sem acento; sem ninguém na aba, quem lançou.
-- A tela manda o termo já minúsculo e sem acento.
create or replace function public.tecnicos_busca(i public.inspecoes)
returns text
language sql
stable
set search_path to 'public'
as $$
  select lower(public.sem_acento(coalesce(
    public.tecnicos_campo(i),
    nullif(btrim(i.responsavel), ''),
    ''
  )));
$$;

comment on function public.tecnicos_busca(public.inspecoes) is
  'v282 (painel v284) — coluna calculada do filtro Técnico: quem foi a campo (ou, sem ninguém, quem lançou), minúsculo e sem acento.';

grant execute on function public.tecnicos_campo(public.inspecoes) to authenticated;
grant execute on function public.tecnicos_busca(public.inspecoes) to authenticated;

notify pgrst, 'reload schema';
