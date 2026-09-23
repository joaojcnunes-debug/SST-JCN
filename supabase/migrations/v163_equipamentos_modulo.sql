-- v163 — Equipamentos Chabra (Fase 3): tabela própria do patrimônio interno.
--
-- O QUE FAZ
--   1) Cria public.equipamentos — patrimônio interno individualizado, escopado por
--      BASE (id_unidade), não por empresa cliente. É a troca de eixo em relação ao
--      molde do EPI (v127: empresa_id) descrita no briefing.
--   2) COPIA (não move) as linhas de inventario_maquinas com
--      categoria_inventario = 'equipamentos'. Nada é apagado aqui — a retirada do
--      inventário NR-12 é um passo separado e MANUAL (scripts/sql/v167_*), rodado
--      só depois que o módulo novo estiver validado em produção. Cutover em dois
--      tempos: se algo estiver errado, a fonte original continua intacta.
--   3) Módulo 'equipamentos' na permissão (usuarios.modulos_permitidos) +
--      caller_pode_equipamentos(), no padrão que a v136 usou para 'transferencias'.
--   4) RLS por unidade desde o primeiro dia — sem a rampa de compatibilidade
--      "id_unidade is null" que a v136 precisou abrir no inventário: aqui a coluna
--      é NOT NULL, então não existe linha órfã para tratar.
--
-- TRANSAÇÃO: aplicada por deploy\migrate.ps1, que roda psql com -1 (arquivo inteiro
-- em uma transação) e ON_ERROR_STOP=1. Por isso NÃO há begin/commit explícito aqui
-- — seria um BEGIN aninhado. Se rodar à mão, use:
--   psql -1 -v ON_ERROR_STOP=1 -f v163_equipamentos_modulo.sql
--
-- Idempotente. Rollback em scripts\sql\v163_equipamentos_modulo_rollback.sql

-- ── Pré-condições: aborta em vez de deixar meia-bagunça (padrão v136) ────────
do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'v163 abortada: tabela public.unidades nao existe';
  end if;
  if to_regclass('public.inventario_maquinas') is null then
    raise exception 'v163 abortada: tabela public.inventario_maquinas nao existe';
  end if;
  if to_regproc('public.caller_unidades') is null
     or to_regproc('public.caller_eh_admin') is null
     or to_regproc('public.caller_pode_editar') is null then
    raise exception 'v163 abortada: funcoes de acesso (v75/v76) ausentes';
  end if;

  -- A v173 (Fase 1, 2026-08-10) criou inventario_maquinas.foto_thumb_path e o
  -- mutirao gerou miniatura para TODAS as fotos. A copia abaixo leva a miniatura
  -- junto: sem isso, os itens migrados nasceriam sem thumb e a lista do modulo
  -- novo voltaria a baixar as originais — a lentidao que a Fase 1 acabou de
  -- matar. Como v163 < v173 na ordem alfabetica do migrate.ps1, num banco
  -- reconstruido do zero esta coluna ainda nao existiria: aborta com o recado.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'inventario_maquinas'
       and column_name = 'foto_thumb_path'
  ) then
    raise exception 'v163 abortada: inventario_maquinas.foto_thumb_path ausente — aplique a v173 antes (a copia leva a miniatura junto)';
  end if;

  -- id_unidade é NOT NULL na tabela nova. Se existir equipamento sem base no
  -- inventário, a cópia falharia no meio: melhor abortar ANTES, com a lista.
  if exists (
    select 1 from public.inventario_maquinas
     where coalesce(categoria_inventario, 'maquinas') = 'equipamentos'
       and id_unidade is null
  ) then
    raise exception
      'v163 abortada: % equipamento(s) sem base definida (id_unidade is null). Defina a base desses itens no inventario antes de migrar. IDs: %',
      (select count(*) from public.inventario_maquinas
        where coalesce(categoria_inventario,'maquinas') = 'equipamentos' and id_unidade is null),
      (select string_agg(id_maquina, ', ') from public.inventario_maquinas
        where coalesce(categoria_inventario,'maquinas') = 'equipamentos' and id_unidade is null);
  end if;

  -- numero_patrimonio é ÚNICO na tabela nova (decisão do operador, 2026-08-10).
  -- Vazio e nulo não contam — equipamento sem plaqueta pode ficar sem número; o
  -- que não pode é o mesmo número em dois equipamentos. Se a base de hoje já
  -- tiver repetido, o índice único falharia no meio da cópia: aborta ANTES, e
  -- devolve QUAIS números estão repetidos, para dar o que corrigir.
  if exists (
    select 1 from public.inventario_maquinas
     where coalesce(categoria_inventario, 'maquinas') = 'equipamentos'
       and nullif(btrim(numero_patrimonio), '') is not null
     group by btrim(numero_patrimonio)
    having count(*) > 1
  ) then
    raise exception
      'v163 abortada: numero(s) de patrimonio repetido(s) no inventario. Corrija antes de migrar. Repetidos: %',
      (select string_agg(p || ' (' || n || 'x)', ', ')
         from (select btrim(numero_patrimonio) as p, count(*) as n
                 from public.inventario_maquinas
                where coalesce(categoria_inventario,'maquinas') = 'equipamentos'
                  and nullif(btrim(numero_patrimonio), '') is not null
                group by btrim(numero_patrimonio) having count(*) > 1
                order by 2 desc, 1) d);
  end if;
end $$;

-- ── 1) A tabela do patrimônio interno ───────────────────────────────────────
-- Sem id_empresa, de propósito: patrimônio da Chabra não pertence a cliente
-- nenhum. Hoje "equipamento interno" é identificado por `id_empresa is null` no
-- inventário, e é justamente esse NULL que faz máquina interna vazar em consulta
-- de cliente. Tabela separada mata a classe do problema, não só o sintoma.
create table if not exists public.equipamentos (
  id_equipamento      text primary key default gen_random_uuid()::text,

  -- Base (unidade). NOT NULL: equipamento sempre está em algum lugar. restrict
  -- porque apagar uma base com patrimônio dentro é erro, não cascata.
  id_unidade          text not null references public.unidades(id_unidade) on delete restrict,

  -- ── Identificação ──────────────────────────────────────────
  nome                text not null,
  tipo                text,                     -- Notebook, Monitor, Cadeira, Ferramenta…
  fabricante          text,                     -- espelha inventario_maquinas.marca
  modelo              text,
  numero_serie        text,
  numero_patrimonio   text,
  codigo_interno      text,
  tag                 text,
  status              text not null default 'OPERANTE'
                      check (status in ('OPERANTE','MANUTENCAO','INATIVA','BAIXADA','RESERVA')),

  -- ── Aquisição (§3.3 — o que patrimônio exige e o NR-12 não tem) ──────────
  fornecedor          text,
  nota_fiscal         text,
  data_aquisicao      date,
  valor_aquisicao     numeric(14,2),
  garantia_ate        date,
  termo_garantia_path text,                     -- PDF/foto do termo, no storage

  -- ── Localização ────────────────────────────────────────────
  -- setor é OPCIONAL aqui. No MaquinaForm ele é obrigatório ("toda máquina
  -- pertence a um setor") — atrito puro para um mouse em estoque.
  setor               text,
  localizacao         text,
  responsavel         text,

  -- ── Foto: nasce com miniatura (§3.1) ───────────────────────
  -- foto_thumb_path existe desde o primeiro commit justamente para o módulo novo
  -- não repetir os 272 MB do inventário. A lista lê a miniatura; o detalhe, a original.
  foto_url            text,
  foto_path           text,
  foto_thumb_path     text,

  observacoes         text,

  -- ── Rastro da migração ─────────────────────────────────────
  -- Guarda inventario_maquinas.id_maquina. É o que torna a cópia idempotente,
  -- o que prova "nenhuma linha perdida" na conferência, e o que permite desfazer.
  id_inventario_origem text,

  criado_por          text,
  criado_em           timestamptz not null default now(),
  updated_at          timestamptz
);

create index if not exists idx_equipamentos_unidade  on public.equipamentos (id_unidade);
create index if not exists idx_equipamentos_status   on public.equipamentos (status);
create index if not exists idx_equipamentos_criado   on public.equipamentos (criado_em desc);
-- Um item do inventário só pode ter sido copiado uma vez.
create unique index if not exists uniq_equipamentos_origem
  on public.equipamentos (id_inventario_origem) where id_inventario_origem is not null;
-- Patrimônio único ENTRE OS PREENCHIDOS (decisão do operador, 2026-08-10).
-- Índice parcial: vários equipamentos sem plaqueta convivem; dois com o mesmo
-- número, não. A mensagem amigável ("já está em uso pelo equipamento X") é da
-- tela; este índice é a rede de segurança para dois usuários salvando junto,
-- que a tela não tem como pegar.
create unique index if not exists uniq_equipamentos_patrimonio
  on public.equipamentos (numero_patrimonio) where numero_patrimonio is not null;

-- ── 2) Cópia das linhas de patrimônio interno ───────────────────────────────
-- `not exists` = pode rodar de novo sem duplicar.
insert into public.equipamentos (
  id_unidade, nome, tipo, fabricante, modelo, numero_serie, numero_patrimonio,
  codigo_interno, tag, status, setor, localizacao, responsavel,
  foto_url, foto_path, foto_thumb_path, observacoes, id_inventario_origem,
  criado_por, criado_em, updated_at
)
select
  m.id_unidade,
  coalesce(nullif(btrim(m.nome), ''), 'Equipamento sem nome'),
  m.tipo,
  m.marca,
  m.modelo,
  m.numero_serie,
  -- '' vira NULL: string vazia colidiria com ela mesma no índice único.
  nullif(btrim(m.numero_patrimonio), ''),
  m.codigo_interno,
  m.tag,
  case when m.status in ('OPERANTE','MANUTENCAO','INATIVA','BAIXADA','RESERVA')
       then m.status else 'OPERANTE' end,
  m.setor,
  coalesce(nullif(btrim(m.localizacao), ''), nullif(btrim(m.area), '')),
  m.responsavel_setor,
  m.foto_url,
  m.foto_storage_path,
  m.foto_thumb_path,
  m.observacoes,
  m.id_maquina,
  m.usuario_email,
  coalesce(m.created_at, now()),
  m.updated_at
from public.inventario_maquinas m
where coalesce(m.categoria_inventario, 'maquinas') = 'equipamentos'
  and not exists (
    select 1 from public.equipamentos e where e.id_inventario_origem = m.id_maquina
  );

-- Conferência dentro da própria transação: se a contagem não bater, aborta tudo.
-- É o critério de aceite do §3.2 ("nenhuma linha perdida") virado em trava.
do $$
declare v_origem int; v_destino int;
begin
  select count(*) into v_origem from public.inventario_maquinas
   where coalesce(categoria_inventario, 'maquinas') = 'equipamentos';
  select count(*) into v_destino from public.equipamentos
   where id_inventario_origem is not null;
  if v_origem <> v_destino then
    raise exception 'v163 abortada: copiadas % de % linhas de equipamento', v_destino, v_origem;
  end if;
  raise notice 'v163: % equipamento(s) copiado(s) do inventario (origem preservada)', v_destino;
end $$;

-- ── 3) Permissão do módulo ──────────────────────────────────────────────────
create or replace function public.caller_pode_equipamentos()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.caller_eh_admin() or exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo_sistema = true
       and (u.modulos_permitidos is null                    -- NULL = herda todos
            or 'equipamentos' = any(u.modulos_permitidos))
  );
$$;

-- Dia-zero: concede a quem JÁ trabalha com patrimônio interno hoje, ou seja,
-- quem tem o módulo 'transferencias' (transferência só existe para equipamento
-- interno). Não concede a todo mundo que pode editar: patrimônio carrega valor
-- de aquisição e nota fiscal, que a v136 não expunha.
update public.usuarios
   set modulos_permitidos = (
     select array_agg(distinct m)
       from unnest(coalesce(modulos_permitidos, '{}') || array['equipamentos']) m
   )
 where modulos_permitidos is not null
   and 'transferencias' = any(modulos_permitidos)
   and not ('equipamentos' = any(modulos_permitidos));

-- ── 4) RLS por unidade, sem rampa ───────────────────────────────────────────
alter table public.equipamentos enable row level security;

drop policy if exists equipamentos_sel on public.equipamentos;
create policy equipamentos_sel on public.equipamentos
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
  );

drop policy if exists equipamentos_rw on public.equipamentos;
create policy equipamentos_rw on public.equipamentos
  for all to authenticated
  using (
    public.caller_eh_admin()
    or (public.caller_pode_editar() and public.caller_pode_equipamentos()
        and id_unidade = any(public.caller_unidades()))
  )
  with check (
    public.caller_eh_admin()
    or (public.caller_pode_editar() and public.caller_pode_equipamentos()
        and id_unidade = any(public.caller_unidades()))
  );
