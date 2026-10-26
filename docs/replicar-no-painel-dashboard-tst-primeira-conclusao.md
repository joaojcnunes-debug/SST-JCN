# Replicar no Painel SST: Dashboard — Inspeções realizadas por TST, 1ª conclusão travada, reaberturas e página da pessoa

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `C:\Users\Usuario\sst-jcn\docs\replicar-no-painel-dashboard-tst-primeira-conclusao.md`"*.
>
> Origem: JCN (`sst-jcn`), versões 0.3.149 e 0.3.150 (PRs #116 e #117, 26/10/2026), já em produção lá.
> **Mexe no banco** (1 migration) e no Dashboard (4 telas + 1 página nova).
> Trabalhe num **worktree** do painel (a pasta local fica em outra branch, com alterações).

## O que faz (decisões do usuário em 26/10/2026)

1. **"Inspeções por Mês" vira "Inspeções realizadas por TST".**
   - Cada inspeção conta para o **técnico responsável que foi a campo** (aba Responsáveis, vínculo `id_usuario`; visita em dupla conta para os dois), **mesmo que outra pessoa tenha clicado em Concluir por ele**. Hoje o painel conta para quem **lançou** (`donoDaInspecao`, decisão de 08/10). Isso muda.
   - Conta no **mês da 1ª conclusão**, independentemente de quando foi cadastrada.
   - Se for **reaberta** depois, a contagem **não muda** (nem o mês, nem a pessoa). Aparece um aviso com **quem reabriu, quando, se concluiu de novo e a lista de campos alterados** (antes → depois), da inspeção e das abas dela, lida da auditoria.
   - Inspeção **sem técnico** na aba Responsáveis continua contando para quem abriu, marcada "sem registro", e aparece uma **nota para os supervisores** (`useIsSupervisor`: Admin ou nível Aprovação) com a lista. O supervisor escolhe o técnico de cada uma, e a escolha grava uma linha em `responsaveis`.
2. **Documentos concluídos (ADM):** mesma regra. Conta no mês da 1ª conclusão do documento, para o responsável naquele momento, com o aviso de reabertura.
3. **Documentos associados:**
   - Por mês, **quantas EMPRESAS** foram associadas a cada pessoa, seja por ela mesma ou por outra pessoa, **sem acumular**. Duas inspeções da mesma empresa no mês contam 1.
   - Documento **assumido pelo botão** (sem linha em `inspecao_associados`) entra no **mês em que foi assumido** (data da auditoria).
   - Gráfico novo **"Por pessoa — acumulado"**, abaixo do "Por pessoa": a soma dos meses até o mês escolhido.
   - O card e o donut do dashboard usam a mesma conta.
4. **Página nova `/dashboard/pessoa?fonte=inspecoes|documentos|associados&nome=…`:** clicar no **nome** de alguém em qualquer gráfico "por pessoa" abre a relação de **empresas em que a pessoa atuou**, pela régua daquele gráfico. Mostra **todos os meses**, com filtro de mês e as inspeções/documentos de cada empresa.

Por que precisa de banco: `concluida_em` e `elaboracao_concluida_em` são **regravados** quando alguém reabre e conclui de novo, e por isso a inspeção mudava de mês no gráfico. As colunas novas guardam a primeira vez e ficam travadas por gatilho.

## Passo 1 — conferir o painel (só leitura)

| Conferir | Como | Se não bater |
|---|---|---|
| Os arquivos de lógica estão iguais aos do JCN antes da mudança | `git -C C:/Users/Usuario/sst-jcn show 1368df9:<arquivo>` × o do painel, para `lib/dashboard/inspecoes.ts`, `lib/dashboard/documentos.ts`, `lib/hooks/useDocumentosConcluidos.ts`, `lib/hooks/useInspecoesPorMes.ts` | Em 26/10 estavam **idênticos**. Se mudaram, aplique o diff com `--3way` e resolva à mão |
| As telas `app/(app)/dashboard/{page,inspecoes-concluidas/page,documentos-emitidos/page,por-associados/page}.tsx` diferem só nas cores | mesmo `diff` | Em 26/10 a única diferença era `#006B54` (painel) × `#0ea5e9` (JCN) |
| A auditoria registra `inspecoes` e as abas | `select tabela from auditoria_tabelas where ativo and tabela in ('inspecoes','setores','riscos','fotos','extintores','inspecao_maquinas','inspecao_maquinas_setores','responsaveis','inspecao_associados');` | Tabela fora da lista: tire-a do `in (...)` da `dashboard_reaberturas` |
| `auth.jwt()` existe | já usado em `scripts/sql` (transferências, v242) | — |
| `useIsSupervisor` existe em `lib/hooks/useUsuario.ts` | `grep` | Use `perfil === "Admin"` |
| Número livre da migration | `select max(version) from public.schema_migrations;` | Em 26/10 o maior era v309; troque **v310** abaixo se já estiver tomado |
| Gatilhos de `inspecoes` | `select tgname from pg_trigger where tgrelid='public.inspecoes'::regclass and not tgisinternal;` | O bloco de preenchimento desliga `trg_auditoria` e `trg_inspecoes_retira_comercial`. Desligue também qualquer outro gatilho de negócio que reagir a `UPDATE` (Google, histórico…) e religue no fim |

## Passo 2 — banco: `scripts/sql/v310_dashboard_primeira_conclusao.sql`

Rodar como **chabra_admin** com `psql -1 -v ON_ERROR_STOP=1`. Idempotente.

```sql
-- v310 — Dashboard: 1ª conclusão travada (inspeção e documento), reaberturas com o que mudou,
-- data de quando o documento foi assumido. Replicado do JCN v295 (26/10/2026).
DO $$ BEGIN
  IF current_database() NOT LIKE 'painel_sst%' THEN RAISE EXCEPTION 'banco errado: %', current_database(); END IF;
  IF current_user <> 'chabra_admin' THEN RAISE EXCEPTION 'aplicar como chabra_admin'; END IF;
  IF EXISTS (SELECT 1 FROM public.schema_migrations WHERE version LIKE 'v310_%' AND version <> 'v310_dashboard_primeira_conclusao') THEN
    RAISE EXCEPTION 'v310 já tomada — renumerar';
  END IF;
END $$;

alter table public.inspecoes
  add column if not exists primeira_conclusao_em  timestamptz,
  add column if not exists primeira_conclusao_por text,
  add column if not exists primeira_elaboracao_em  timestamptz,
  add column if not exists primeira_elaboracao_por text;

create or replace function public.inspecoes_primeira_conclusao_trg() returns trigger
  language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if old.primeira_conclusao_em is not null then
      new.primeira_conclusao_em := old.primeira_conclusao_em;
      new.primeira_conclusao_por := old.primeira_conclusao_por;
    end if;
    if old.primeira_elaboracao_em is not null then
      new.primeira_elaboracao_em := old.primeira_elaboracao_em;
      new.primeira_elaboracao_por := old.primeira_elaboracao_por;
    end if;
  end if;
  if new.primeira_conclusao_em is null and new.status = 'CONCLUIDA' then
    new.primeira_conclusao_em := coalesce(new.concluida_em, now());
    new.primeira_conclusao_por := new.concluida_por_email;
  end if;
  if new.primeira_elaboracao_em is null and new.elaboracao_status = 'CONCLUIDO' then
    new.primeira_elaboracao_em := coalesce(new.elaboracao_concluida_em, now());
    new.primeira_elaboracao_por := new.elaboracao_responsavel;
  end if;
  return new;
end $$;
-- O nome começa com "inspecoes_p" para rodar DEPOIS de inspecoes_concluida_por (v283), que carimba o e-mail.
drop trigger if exists inspecoes_primeira_conclusao on public.inspecoes;
create trigger inspecoes_primeira_conclusao before insert or update on public.inspecoes
  for each row execute function public.inspecoes_primeira_conclusao_trg();

-- Preenchimento: 1º evento de conclusão na auditoria; sem auditoria, a data atual de conclusão.
alter table public.inspecoes disable trigger trg_auditoria;
alter table public.inspecoes disable trigger trg_inspecoes_retira_comercial;
-- (desligue aqui os demais gatilhos de negócio de UPDATE listados no Passo 1)

with conc as (
  select distinct on (e.registro_id) e.registro_id, e.ocorrido_em, e.usuario_email
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and e.depois ->> 'status' = 'CONCLUIDA'
     and coalesce(e.antes ->> 'status', '') <> 'CONCLUIDA'
   order by e.registro_id, e.ocorrido_em
)
update public.inspecoes i
   set primeira_conclusao_em  = coalesce(c.ocorrido_em, i.concluida_em, i.updated_at),
       primeira_conclusao_por = coalesce(lower(c.usuario_email), i.concluida_por_email)
  from (select id_inspecao from public.inspecoes) base
  left join conc c on c.registro_id = base.id_inspecao
 where i.id_inspecao = base.id_inspecao and i.primeira_conclusao_em is null
   and (i.status = 'CONCLUIDA' or c.registro_id is not null);

with elab as (
  select distinct on (e.registro_id) e.registro_id, e.ocorrido_em, e.depois ->> 'elaboracao_responsavel' as resp
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and e.depois ->> 'elaboracao_status' = 'CONCLUIDO'
     and coalesce(e.antes ->> 'elaboracao_status', '') <> 'CONCLUIDO'
   order by e.registro_id, e.ocorrido_em
)
update public.inspecoes i
   set primeira_elaboracao_em  = coalesce(x.ocorrido_em, i.elaboracao_concluida_em),
       primeira_elaboracao_por = coalesce(nullif(x.resp, ''), i.elaboracao_responsavel)
  from (select id_inspecao from public.inspecoes) base
  left join elab x on x.registro_id = base.id_inspecao
 where i.id_inspecao = base.id_inspecao and i.primeira_elaboracao_em is null
   and (i.elaboracao_status = 'CONCLUIDO' or x.registro_id is not null)
   and coalesce(x.ocorrido_em, i.elaboracao_concluida_em) is not null;

alter table public.inspecoes enable trigger trg_auditoria;
alter table public.inspecoes enable trigger trg_inspecoes_retira_comercial;

-- Índices para as RPCs (a auditoria do painel é grande; no JCN não fez falta).
create index if not exists auditoria_eventos_tab_reg_em_idx on public.auditoria_eventos (tabela, registro_id, ocorrido_em);
create index if not exists auditoria_eventos_insp_em_idx on public.auditoria_eventos
  ((coalesce(depois ->> 'id_inspecao', antes ->> 'id_inspecao')), ocorrido_em)
  where tabela in ('setores','riscos','fotos','extintores','inspecao_maquinas','inspecao_maquinas_setores','responsaveis','inspecao_associados');

create or replace function public.dashboard_caller_interno() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios u
                  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
                    and coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente');
$$;

create or replace function public.dashboard_reaberturas(p_tipo text default 'inspecao')
  returns table (id_inspecao text, reaberta_em timestamptz, reaberta_por text,
                 reconcluida_em timestamptz, alteracoes jsonb)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_campo text := case when p_tipo = 'documento' then 'elaboracao_status' else 'status' end;
  v_valor text := case when p_tipo = 'documento' then 'CONCLUIDO' else 'CONCLUIDA' end;
begin
  if not public.dashboard_caller_interno() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return query
  with reab as (
    select e.registro_id as id, e.ocorrido_em as em, lower(e.usuario_email) as por
      from public.auditoria_eventos e
     where e.tabela = 'inspecoes' and e.antes ->> v_campo = v_valor and coalesce(e.depois ->> v_campo, '') <> v_valor
  ), janela as (
    select r.id, r.em, r.por,
           (select min(e2.ocorrido_em) from public.auditoria_eventos e2
             where e2.tabela = 'inspecoes' and e2.registro_id = r.id and e2.ocorrido_em > r.em
               and e2.depois ->> v_campo = v_valor and coalesce(e2.antes ->> v_campo, '') <> v_valor) as fim
      from reab r
  )
  select j.id, j.em, j.por, j.fim,
         coalesce((
           select jsonb_agg(jsonb_build_object('tabela', ev.tabela, 'acao', ev.acao, 'campo', c.campo,
                    'antes', ev.antes -> c.campo, 'depois', ev.depois -> c.campo,
                    'por', lower(ev.usuario_email), 'em', ev.ocorrido_em) order by ev.ocorrido_em)
             from public.auditoria_eventos ev
             cross join lateral (select unnest(case when coalesce(cardinality(ev.campos_alterados), 0) > 0
                                                    then ev.campos_alterados else array['(registro)'] end) as campo) c
            where ev.ocorrido_em > j.em and ev.ocorrido_em <= coalesce(j.fim, now())
              and ((ev.tabela = 'inspecoes' and ev.registro_id = j.id)
                   or (ev.tabela in ('setores','riscos','fotos','extintores','inspecao_maquinas',
                                     'inspecao_maquinas_setores','responsaveis','inspecao_associados')
                       and coalesce(ev.depois ->> 'id_inspecao', ev.antes ->> 'id_inspecao') = j.id))
              and c.campo not in ('updated_at','created_at','concluida_em','concluida_por_email',
                                  'elaboracao_concluida_em','liberado_comercial_em','liberado_comercial_por',
                                  'primeira_conclusao_em','primeira_conclusao_por',
                                  'primeira_elaboracao_em','primeira_elaboracao_por')
         ), '[]'::jsonb)
    from janela j
    join public.inspecoes i on i.id_inspecao = j.id
   where (p_tipo = 'documento' and i.primeira_elaboracao_em is not null and j.em >= i.primeira_elaboracao_em)
      or (p_tipo <> 'documento' and i.primeira_conclusao_em is not null and j.em >= i.primeira_conclusao_em)
   order by j.em desc;
end $$;

create or replace function public.dashboard_assuncoes()
  returns table (id_inspecao text, responsavel text, assumido_em timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.dashboard_caller_interno() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return query
  select e.registro_id, e.depois ->> 'elaboracao_responsavel', e.ocorrido_em
    from public.auditoria_eventos e
   where e.tabela = 'inspecoes' and coalesce(e.depois ->> 'elaboracao_responsavel', '') <> ''
     and (e.antes ->> 'elaboracao_responsavel') is distinct from (e.depois ->> 'elaboracao_responsavel')
   order by e.ocorrido_em;
end $$;

alter function public.dashboard_caller_interno() owner to chabra_admin;
alter function public.dashboard_reaberturas(text) owner to chabra_admin;
alter function public.dashboard_assuncoes() owner to chabra_admin;
-- `from public` não basta: o default privilege do chabra_admin dá EXECUTE a authenticated (ver v292).
revoke all on function public.dashboard_caller_interno() from public, anon;
revoke all on function public.dashboard_reaberturas(text) from public, anon;
revoke all on function public.dashboard_assuncoes() from public, anon;
grant execute on function public.dashboard_caller_interno() to authenticated, service_role;
grant execute on function public.dashboard_reaberturas(text) to authenticated, service_role;
grant execute on function public.dashboard_assuncoes() to authenticated, service_role;

insert into public.schema_migrations (version) values ('v310_dashboard_primeira_conclusao') on conflict do nothing;
notify pgrst, 'reload schema';
```

**Rollback** (`scripts/sql/v310_dashboard_primeira_conclusao.rollback.sql`, depois de voltar o código):

```sql
drop function if exists public.dashboard_assuncoes();
drop function if exists public.dashboard_reaberturas(text);
drop function if exists public.dashboard_caller_interno();
drop trigger if exists inspecoes_primeira_conclusao on public.inspecoes;
drop function if exists public.inspecoes_primeira_conclusao_trg();
alter table public.inspecoes drop column if exists primeira_conclusao_em, drop column if exists primeira_conclusao_por,
  drop column if exists primeira_elaboracao_em, drop column if exists primeira_elaboracao_por;
drop index if exists public.auditoria_eventos_tab_reg_em_idx;
drop index if exists public.auditoria_eventos_insp_em_idx;
delete from public.schema_migrations where version = 'v310_dashboard_primeira_conclusao';
notify pgrst, 'reload schema';
```

**Conferir depois de aplicar:**

```sql
-- quantas ganharam a 1ª conclusão e de onde veio a data
select count(*) filter (where primeira_conclusao_em is not null) com_primeira,
       count(*) filter (where status = 'CONCLUIDA' and primeira_conclusao_em is null) concluidas_sem_primeira, -- deve ser 0
       count(*) filter (where status <> 'CONCLUIDA' and primeira_conclusao_em is not null) reabertas_que_contam,
       count(*) filter (where primeira_elaboracao_em is not null) docs_com_primeira
  from public.inspecoes where status <> 'DELETADA';
-- teste da trava (desfeito no fim): troque o id por uma concluída real
do $$ declare a timestamptz; b timestamptz; begin
  select primeira_conclusao_em into a from inspecoes where id_inspecao = 'INS-XXXXXXXX';
  update inspecoes set status = 'EM_ANDAMENTO' where id_inspecao = 'INS-XXXXXXXX';
  update inspecoes set status = 'CONCLUIDA', concluida_em = now(), primeira_conclusao_em = now() where id_inspecao = 'INS-XXXXXXXX';
  select primeira_conclusao_em into b from inspecoes where id_inspecao = 'INS-XXXXXXXX';
  raise exception 'TESTE (desfeito): antes=% depois=%', a, b;   -- os dois têm de ser iguais
end $$;
```

⚠️ **Data estimada:** a auditoria do painel começou com a v255. O que foi concluído **e** reaberto antes dela fica com a data da reconclusão (`concluida_em`). O aviso "data estimada" da tela continua cobrindo o que é anterior a 04/08/2026 (v154).

## Passo 3 — código

O código é o do JCN: commit de merge **`2c922d4`** (PR #116) sobre a base **`1368df9`**, mais o ajuste do supervisor do PR #117.

```bash
# no worktree do painel
git -C C:/Users/Usuario/sst-jcn diff 1368df9 2c922d4 -- \
  lib/dashboard lib/hooks/useDashboardFontes.ts lib/hooks/useDocumentosConcluidos.ts \
  lib/hooks/useInspecoesPorMes.ts components/dashboard "app/(app)/dashboard" > ../dash-tst.patch
git apply --3way ../dash-tst.patch
```

Ficam de fora do patch, e cada um se faz no painel: `docs/`, `lib/novidades/catalogo.ts`, `package.json`, `supabase/historico/` e `scripts/sql/` do JCN.

**Arquivos (novos ★ e alterados):**

| Arquivo | O que é |
|---|---|
| ★ `lib/dashboard/associacoes-empresas.ts` (+ `.test.ts`) | Eventos (pessoa, empresa, mês): associação ou assunção, o 1º por pessoa e documento; empresas por pessoa e mês; acumulado |
| ★ `lib/hooks/useDashboardFontes.ts` | Consultas compartilhadas: inspeções concluídas (inclui reabertas com `primeira_conclusao_em`), técnicos de campo, contas, `dashboard_reaberturas`, associações + `dashboard_assuncoes` |
| ★ `components/dashboard/ReaberturasAviso.tsx` | Aviso âmbar com quem reabriu, quando e a tabela dos campos alterados |
| ★ `components/dashboard/TickPessoa.tsx` | Nome no eixo Y vira link para `/dashboard/pessoa` |
| ★ `components/dashboard/NotaSemTecnico.tsx` | Nota para os supervisores: escolher o técnico de cada inspeção "sem registro" (grava em `responsaveis`) |
| ★ `app/(app)/dashboard/pessoa/page.tsx` | Página da pessoa (empresas, todos os meses, filtro de mês) |
| `lib/dashboard/inspecoes.ts` (+ teste) | `primeira_conclusao_em` em `InspecaoContavel`; `mesDeConclusao` usa a 1ª conclusão e conta a reaberta; `instanteDeConclusao`; `conclusaoEhAproximada` |
| `lib/dashboard/documentos.ts` (+ teste) | `primeira_elaboracao_em/_por`; `dataConclusaoDoc`, `admDoDoc`; `chaveNome` exportada |
| `lib/hooks/useDocumentosConcluidos.ts` | Busca também os reabertos (`primeira_elaboracao_em`) e a empresa |
| `lib/hooks/useInspecoesPorMes.ts` | Seleciona `primeira_conclusao_em` |
| `app/(app)/dashboard/inspecoes-concluidas/page.tsx` | Título novo, crédito ao técnico (`porTecnico`/`tecnicosCreditados`), aviso de reabertura, nota do supervisor, nomes clicáveis |
| `app/(app)/dashboard/documentos-emitidos/page.tsx` | Aviso de reabertura, nomes clicáveis |
| `app/(app)/dashboard/por-associados/page.tsx` | Empresas por pessoa e mês + "Por pessoa — acumulado" |
| `app/(app)/dashboard/page.tsx` | Card "Inspeções realizadas por TST"; card e donut de associados pela conta nova |

**Ajuste do supervisor (PR #117)**, em `inspecoes-concluidas/page.tsx`. Se o patch já veio com `ehAdmin`, troque:

```diff
-import { useUserStore } from "@/lib/store";
+import { useIsSupervisor } from "@/lib/hooks/useUsuario";
-  const ehAdmin = useUserStore((s) => s.user?.perfil === "Admin");
+  const ehSupervisor = useIsSupervisor();
-            (ehAdmin ? (
+            (ehSupervisor ? (
```

**Cores (marca da Chabra):** nos arquivos do patch, troque `#0ea5e960` → `#006B5460`, `#0ea5e9` → `#006B54` e, em `TickPessoa.tsx`, `#0284c7` → `#006B54`. As caixas `sky`/`amber` dos avisos podem ficar.

**Atenção ao que é do painel:**
- Inspeções SGG, prioridade (v308) e regiões não mexem nesta régua.
- Se a lista de Inspeções do painel usar `donoDaInspecao` em outro lugar, ela **continua igual**: só o Dashboard passou a contar pelo técnico de campo.
- Renovação (`RENOVACAO`) continua fora das contagens de inspeção.

## Passo 4 — testes, versão e docs

1. `npm test` (o painel roda os testes com `node --test`). Os testes novos estão no patch: `associacoes-empresas.test.ts` e os blocos "v295" de `inspecoes.test.ts` e `documentos.test.ts`.
2. `tsc`, lint dos arquivos e `next build`.
3. Novidade no catálogo do painel (adapte o texto):

   > **Dashboard: Inspeções realizadas por TST, reaberturas e a página de cada pessoa.**
   > O gráfico de inspeções conta para o técnico que foi a campo, no mês da primeira conclusão. Reabrir e concluir de novo não muda a contagem, e um aviso mostra quem reabriu e os campos alterados. Documentos concluídos seguem a mesma regra. Documentos associados contam empresas por pessoa em cada mês, com um gráfico acumulado. Clicar no nome de alguém abre as empresas em que a pessoa atuou.
   > *Impacto:* inspeção sem técnico na aba Responsáveis conta para quem abriu; um supervisor escolhe o técnico na nota da tela de inspeções.

4. Atualize a documentação do painel no mesmo commit: a seção do Dashboard e a tabela `inspecoes` (colunas e RPCs da v310).

## Passo 5 — conferir no ar

- **Dashboard › Inspeções realizadas por TST:** os meses de agosto em diante não devem mudar muito. A diferença vem da troca de **quem lançou** por **técnico de campo**. Compare um mês com a lista de Inspeções filtrada pelo técnico.
- **Reaberturas:** reabra uma inspeção de teste, altere um campo, conclua de novo. O mês não muda, e o aviso mostra a alteração.
- **Nota do supervisor:** como Admin ou nível Aprovação, defina o técnico de uma inspeção "sem registro". A barra passa para o técnico.
- **Página da pessoa:** clique num nome em cada um dos 3 gráficos e confira se as empresas batem com a barra.
- **Documentos associados:** o número por pessoa no mês é **≤** o antigo, porque agora conta empresas e não documentos. Com o acumulado, o mês corrente fecha com a soma dos meses.
