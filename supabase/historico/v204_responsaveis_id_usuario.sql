-- V204 — `responsaveis` ganha o vínculo com a conta do painel
--
-- ─── O pedido ──────────────────────────────────────────────────────────────
--
-- Pedido do Sanmyo em 2026-09-09: "vamos mapear esses nomes e arrumá-los".
--
-- Hoje quem é o técnico de uma inspeção é DEDUZIDO a cada abertura de tela:
-- `responsaveis.tecnico_responsavel` é texto digitado na recepção do cliente, e
-- `lib/dashboard/tecnicos.ts` traduz 43 grafias → 15 pessoas por conjunto de
-- palavras. Funciona (cobre 41 das 43), mas a contagem do dashboard depende,
-- para sempre, de acertar um texto escrito à mão: grafia nova amanhã escapa de
-- novo e ninguém percebe.
--
-- Esta coluna troca a dedução por um fato.
--
-- ─── ⚠️ O QUE ESTA MIGRATION NÃO FAZ, E POR QUÊ ────────────────────────────
--
-- Ela **não preenche nada**. Só cria a coluna.
--
-- O preenchimento sai de `scripts/vincular-responsaveis.mjs`, que chama a MESMA
-- função que a tela usa (`canonicalizarTecnico`), com os mesmos testes. A
-- alternativa — um backfill em SQL reimplementando casamento por conjunto de
-- palavras, normalização de acento e desempate — seria uma SEGUNDA cópia da
-- regra, e esta casa já pagou esse preço: a mesma conta copiada em quatro telas
-- divergiu em duas (`lib/aet/consolidar-psi.ts` nasceu disso).
--
-- Consequência prática: aplicar esta migration é INÓCUO. A coluna nasce toda
-- nula, nenhuma tela muda de comportamento, e nada precisa ser desfeito com
-- pressa se o backfill for adiado.
--
-- ─── O que a coluna significa ──────────────────────────────────────────────
--
-- `id_usuario` = a conta do painel da pessoa que FOI A CAMPO, quando dá para
-- afirmar quem é. NULO tem três significados legítimos e nenhum deles é erro:
--
--   • o campo do documento está em branco;
--   • o nome é ambíguo e a regra se recusa a escolher (crédito na pessoa
--     errada é pior que nome fora do agrupamento);
--   • a pessoa não tem login no painel — o caso do técnico de Friburgo, que
--     por decisão do Sanmyo em 25/08 continua aparecendo com o próprio nome.
--
-- `tecnico_responsavel` CONTINUA sendo a fonte do que sai no documento do
-- cliente. Esta coluna é sobre CONTAGEM, não sobre o que se imprime.

begin;

alter table public.responsaveis
  add column if not exists id_usuario text;

comment on column public.responsaveis.id_usuario is
  'Conta do painel do técnico que foi a campo, quando dá para afirmar quem é. '
  'Nulo = em branco, ambíguo, ou pessoa sem login. Preenchido por '
  'scripts/vincular-responsaveis.mjs, nunca por SQL — a regra mora em '
  'lib/dashboard/tecnicos.ts e não pode ter uma segunda cópia.';

-- O dashboard vai agrupar por esta coluna; sem índice é varredura na tabela
-- inteira a cada abertura. Parcial porque a maioria das linhas antigas fica
-- nula de propósito e não interessa a nenhuma consulta.
create index if not exists responsaveis_id_usuario_idx
  on public.responsaveis (id_usuario)
  where id_usuario is not null;

-- ─── A integridade, se o banco permitir ────────────────────────────────────
--
-- ⚠️ `public.usuarios` foi criada FORA do versionamento (nenhuma migration a
-- cria, e nenhuma FK do repositório a referencia). Não dá para afirmar daqui
-- que `id_usuario` tem chave primária ou única — e `references` contra coluna
-- sem constraint única é ERRO, que derrubaria o deploy inteiro.
--
-- Então a FK é condicional: entra se houver do que depender, e se abstém com
-- aviso se não houver. Preferir a coluna sem FK a um deploy quebrado.
do $$
begin
  if exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'usuarios'
       and c.contype in ('p', 'u')
       and c.conkey = array[
             (select attnum from pg_attribute
               where attrelid = t.oid and attname = 'id_usuario')
           ]::smallint[]
  ) then
    if not exists (
      select 1 from pg_constraint where conname = 'responsaveis_id_usuario_fkey'
    ) then
      alter table public.responsaveis
        add constraint responsaveis_id_usuario_fkey
        foreign key (id_usuario) references public.usuarios(id_usuario)
        on delete set null;
      raise notice 'v204: FK responsaveis.id_usuario -> usuarios.id_usuario criada.';
    end if;
  else
    raise notice 'v204: usuarios.id_usuario nao tem chave unica; coluna criada SEM FK.';
  end if;
end $$;

-- ─── Permissão ─────────────────────────────────────────────────────────────
--
-- Nenhum GRANT novo: quem já lê e escreve `responsaveis` passa a ver mais uma
-- coluna. ⚠️ Lição da v194 (GRANT × RLS): coluna nova em tabela existente NÃO
-- pede grant, mas o PostgREST serve o schema ANTIGO até recarregar — o
-- migrate.ps1 já dá o `NOTIFY pgrst, 'reload schema'` no fim, incondicional.

commit;
