-- v148 — Apreciação NR-12: um laudo passa a cobrir VÁRIAS máquinas (fichas).
--
-- CONTEXTO: hoje o painel amarra 1 apreciação a 1 máquina. O documento de
-- referência (e a instância SST-JCN, descrita no handoff de 2026-07-31) trabalha
-- com 1 laudo = N máquinas, cada uma com sua ficha, agrupadas por SETOR:
--
--   Empresa → Apreciação (laudo) → Ficha de máquina → { riscos HRN, checklist }
--
-- Esta migration cria a ficha e reaponta o que já existe para ela, SEM mudar o
-- comportamento atual: cada um dos laudos de hoje vira um laudo de UMA ficha.
--
-- SEGURANÇA DO DADO (medido em 2026-07-31, antes de rodar):
--   * 12 laudos · 444 itens de checklist · 13 ações · 0 riscos HRN.
--   * O backfill CRIA uma ficha por laudo e reaponta os 444 itens. Nada é
--     apagado, nada é movido de tabela.
--   * `conclusao_tecnica` do laudo é COPIADA para `parecer_tecnico` da ficha e
--     PERMANECE no laudo. Nos laudos de hoje ela é o parecer daquela máquina;
--     no modelo novo ela passa a ser a conclusão geral. Copiar (em vez de mover)
--     evita perder o texto se a decisão sobre onde ele vive mudar depois.
--   * `constatacoes_inspecao` (v146, nível do laudo) idem — copiada para a ficha
--     e mantida no laudo. Estava vazia nos 12.
--   * A migration ABORTA (RAISE EXCEPTION) se algum item de checklist ficar sem
--     ficha. Rodando com `psql -1`, o rollback devolve a produção intacta.
--
-- IDs: TEXT no formato `APF-HEX8`, igual ao `gerarId("APF")` do app. Aqui são
-- derivados do md5 do id do laudo — determinístico, então reexecutar não duplica.
--
-- Idempotente: `if not exists` em tudo e backfill com `where not exists`.
-- Rodar com `psql -1` para ter transação única.

-- ── 1) A ficha de máquina ────────────────────────────────────────────────────
create table if not exists public.apreciacao_fichas_maquina (
  id_ficha       text primary key,
  id_apreciacao  text not null
                 references public.apreciacoes_maquinas(id_apreciacao) on delete cascade,
  -- Vínculo opcional com o inventário. SET NULL de propósito: excluir a máquina
  -- do inventário não pode levar junto a ficha de um laudo já emitido (foi o
  -- que travou a exclusão de empresa na v142 — FK sem regra de cascata).
  id_maquina     text references public.inventario_maquinas(id_maquina) on delete set null,
  numero_ordem   integer not null default 1,

  -- Snapshot da máquina (o laudo não pode mudar quando o inventário mudar)
  maquina_descricao text,
  equipamento    text,
  tipo           text,
  modelo         text,
  fabricante     text,
  serie          text,
  ano            text,
  capacidade     text,
  setor          text,

  -- Identificação NR-12 (ABNT ISO/TR 14121-2) — era do laudo, passa a ser da máquina
  componentes_maquina  text[],
  limite_uso           text,
  limite_espaco        text,
  limite_tempo         text,
  limite_produtividade text,
  npe                  text,
  sistemas_atual       text[],
  sistemas_necessario  text[],

  constatacoes_inspecao text,
  parecer_tecnico       text,

  -- [{nome, cargo}] — estruturado desde o início; o campo texto de
  -- inventario_maquinas.operadores (v145) continua existindo e não é tocado.
  operadores        jsonb,
  prioridade_manual boolean not null default false,

  foto_urls          text[] not null default '{}',
  foto_storage_paths text[] not null default '{}',

  usuario_email text,
  usuario_nome  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

comment on table public.apreciacao_fichas_maquina is
  'Ficha de uma máquina dentro de um laudo de apreciação NR-12. 1 laudo = N fichas, agrupadas por `setor`. Os dados da máquina são SNAPSHOT: mudar o inventário não altera laudo já emitido.';
comment on column public.apreciacao_fichas_maquina.operadores is
  'Operadores/responsáveis: jsonb [{nome, cargo}]. Sai no PDF como "Nome — Cargo; ...".';
comment on column public.apreciacao_fichas_maquina.numero_ordem is
  'Ordem da máquina DENTRO do laudo. A numeração impressa (4.1, 4.2...) é sequencial na hierarquia setor → máquina, calculada na renderização.';
comment on column public.apreciacao_fichas_maquina.parecer_tecnico is
  'Parecer daquela máquina. Não confundir com `apreciacoes_maquinas.conclusao_tecnica`, que passa a ser a conclusão GERAL do laudo.';

create index if not exists idx_fichas_maquina_apreciacao
  on public.apreciacao_fichas_maquina (id_apreciacao, numero_ordem);
create index if not exists idx_fichas_maquina_maquina
  on public.apreciacao_fichas_maquina (id_maquina);

-- ── 2) RLS — mesma herança das outras filhas (join no laudo-pai) ─────────────
alter table public.apreciacao_fichas_maquina enable row level security;

drop policy if exists apreciacao_fichas_maquina_sel_uni on public.apreciacao_fichas_maquina;
create policy apreciacao_fichas_maquina_sel_uni
  on public.apreciacao_fichas_maquina for select
  using (exists (
    select 1 from public.apreciacoes_maquinas par
     where par.id_apreciacao = apreciacao_fichas_maquina.id_apreciacao
       and caller_pode_ver_empresa(par.id_empresa)
  ));

drop policy if exists apreciacao_fichas_maquina_rw_uni on public.apreciacao_fichas_maquina;
create policy apreciacao_fichas_maquina_rw_uni
  on public.apreciacao_fichas_maquina for all
  using (caller_pode_editar() and exists (
    select 1 from public.apreciacoes_maquinas par
     where par.id_apreciacao = apreciacao_fichas_maquina.id_apreciacao
       and caller_pode_ver_empresa(par.id_empresa)
  ))
  with check (caller_pode_editar() and exists (
    select 1 from public.apreciacoes_maquinas par
     where par.id_apreciacao = apreciacao_fichas_maquina.id_apreciacao
       and caller_pode_ver_empresa(par.id_empresa)
  ));

-- Grants espelhados de apreciacao_riscos_hrn (sem isto o PostgREST devolve 401
-- mesmo com a policy correta).
grant select on public.apreciacao_fichas_maquina to anon;
grant select, insert, update, delete on public.apreciacao_fichas_maquina to authenticated;
grant select, insert, update, delete on public.apreciacao_fichas_maquina to service_role;
grant select on public.apreciacao_fichas_maquina to backup_operator;

-- ── 3) Ligação das filhas com a ficha ───────────────────────────────────────
alter table public.apreciacao_riscos_hrn
  add column if not exists id_ficha text
  references public.apreciacao_fichas_maquina(id_ficha) on delete cascade;

alter table public.apreciacoes_maquinas_itens
  add column if not exists id_ficha text
  references public.apreciacao_fichas_maquina(id_ficha) on delete cascade;

create index if not exists idx_riscos_hrn_ficha on public.apreciacao_riscos_hrn (id_ficha);
create index if not exists idx_itens_apreciacao_ficha on public.apreciacoes_maquinas_itens (id_ficha);

comment on column public.apreciacao_riscos_hrn.id_ficha is
  'Máquina (ficha) a que o perigo pertence. `id_apreciacao` fica denormalizado ao lado porque as policies de RLS resolvem por ele.';

-- ── 4) Backfill: cada laudo de hoje vira um laudo de UMA ficha ──────────────
insert into public.apreciacao_fichas_maquina (
  id_ficha, id_apreciacao, id_maquina, numero_ordem,
  maquina_descricao, equipamento, tipo, modelo, fabricante, serie, ano, capacidade, setor,
  componentes_maquina, limite_uso, limite_espaco, limite_tempo, limite_produtividade,
  npe, sistemas_atual, sistemas_necessario,
  constatacoes_inspecao, parecer_tecnico, operadores,
  foto_urls, usuario_email, usuario_nome, created_at
)
select
  'APF-' || upper(substr(md5(a.id_apreciacao), 1, 8)),
  a.id_apreciacao,
  a.id_maquina,
  1,
  coalesce(m.nome, a.maquina_descricao),
  m.nome,
  m.tipo,
  m.modelo,
  m.marca,
  m.numero_serie,
  nullif(m.ano_fabricacao::text, ''),
  m.capacidade_operacional,
  coalesce(m.setor, a.setor),
  a.componentes_maquina, a.limite_uso, a.limite_espaco, a.limite_tempo, a.limite_produtividade,
  a.npe, a.sistemas_atual, a.sistemas_necessario,
  a.constatacoes_inspecao,
  a.conclusao_tecnica,
  -- v145 gravava os operadores como texto livre; vira uma entrada sem cargo em
  -- vez de ser descartada (o JCN nulou os antigos na v141 — aqui não perdemos).
  case
    when m.operadores is not null and btrim(m.operadores) <> ''
      then jsonb_build_array(jsonb_build_object('nome', btrim(m.operadores), 'cargo', ''))
    else null
  end,
  case when m.foto_url is not null and btrim(m.foto_url) <> ''
       then array[m.foto_url] else '{}'::text[] end,
  a.usuario_email, a.usuario_nome, a.created_at
from public.apreciacoes_maquinas a
left join public.inventario_maquinas m on m.id_maquina = a.id_maquina
where not exists (
  select 1 from public.apreciacao_fichas_maquina f where f.id_apreciacao = a.id_apreciacao
);

-- Reaponta checklist e riscos para a ficha do próprio laudo.
update public.apreciacoes_maquinas_itens i
   set id_ficha = f.id_ficha
  from public.apreciacao_fichas_maquina f
 where f.id_apreciacao = i.id_apreciacao
   and i.id_ficha is null;

update public.apreciacao_riscos_hrn r
   set id_ficha = f.id_ficha
  from public.apreciacao_fichas_maquina f
 where f.id_apreciacao = r.id_apreciacao
   and r.id_ficha is null;

-- ── 5) Travas: aborta em vez de deixar dado órfão ───────────────────────────
do $$
declare
  itens_orfaos   integer;
  riscos_orfaos  integer;
  laudos_sem_ficha integer;
begin
  select count(*) into itens_orfaos
    from public.apreciacoes_maquinas_itens where id_ficha is null;
  select count(*) into riscos_orfaos
    from public.apreciacao_riscos_hrn where id_ficha is null;
  select count(*) into laudos_sem_ficha
    from public.apreciacoes_maquinas a
   where not exists (select 1 from public.apreciacao_fichas_maquina f
                      where f.id_apreciacao = a.id_apreciacao);

  if itens_orfaos > 0 then
    raise exception 'v148 abortada: % itens de checklist ficaram sem ficha', itens_orfaos;
  end if;
  if riscos_orfaos > 0 then
    raise exception 'v148 abortada: % riscos HRN ficaram sem ficha', riscos_orfaos;
  end if;
  if laudos_sem_ficha > 0 then
    raise exception 'v148 abortada: % laudos ficaram sem ficha', laudos_sem_ficha;
  end if;

  raise notice 'v148 OK: % fichas criadas',
    (select count(*) from public.apreciacao_fichas_maquina);
end $$;
