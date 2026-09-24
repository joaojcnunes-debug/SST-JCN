-- v177 — Frota Chabra: Checklist de Veículos (módulo interno, fase 1).
--
-- O QUE FAZ
--   1) Cria as 9 tabelas public.frota_* do módulo. Escopadas por BASE
--      (id_unidade), não por empresa cliente: a frota é da Chabra. Mesmo eixo
--      que a v163 usou para Equipamentos.
--   2) Módulo 'frota' na permissão (usuarios.modulos_permitidos) +
--      caller_pode_frota(), no molde de caller_pode_equipamentos() da v163.
--   3) RLS por unidade desde o primeiro dia — sem a rampa "id_unidade is null"
--      que a v136 precisou abrir no inventário: aqui a coluna é NOT NULL nas
--      duas tabelas-raiz, então não existe linha órfã para tratar.
--   4) Trigger que recusa FINALIZADO sem as 4 fotos de ângulo obrigatórias —
--      no INSERT e no UPDATE, porque finalizar por chamada direta também conta.
--   5) Trigger que amarra a base da saída à base do veículo, para a cópia de
--      id_unidade em frota_checklists não virar uma segunda verdade.
--
-- O QUE NÃO FAZ
--   • NÃO concede o módulo a ninguém. Diferente da v163 (que concedeu a quem
--     tinha 'transferencias'), aqui o dia-zero é ninguém: frota é público
--     diferente de SST e a concessão é do admin, por decisão do operador.
--     Sem isso, o card aparece e ninguém entra — que é exatamente o
--     comportamento desejado para validar em produção antes de liberar.
--   • NÃO altera nenhuma tabela existente. Zero ALTER fora do módulo. É o que
--     torna seguro subir num deploy só: se o healthcheck derrubar a imagem para
--     :previous, a imagem antiga simplesmente ignora tabelas que não conhece.
--
-- TRANSAÇÃO: aplicada por deploy\migrate.ps1, que roda psql com -1 (arquivo
-- inteiro em uma transação) e ON_ERROR_STOP=1. Por isso NÃO há begin/commit
-- explícito aqui — seria um BEGIN aninhado. Se rodar à mão, use:
--   psql -1 -v ON_ERROR_STOP=1 -f v177_frota_checklist_veiculos.sql
--
-- Idempotente. Rollback em scripts\sql\v177_frota_checklist_veiculos_rollback.sql
-- (fora de supabase\migrations\ de propósito: o migrate.ps1 filtra o nome, mas a
-- pasta certa é scripts\sql\ — ver a cicatriz de 2026-07-21 no migrate.ps1).

-- ── Pré-condições: aborta em vez de deixar meia-bagunça (padrão v136/v163) ───
do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'v177 abortada: tabela public.unidades nao existe';
  end if;
  if to_regclass('public.usuarios') is null then
    raise exception 'v177 abortada: tabela public.usuarios nao existe';
  end if;
  if to_regproc('public.caller_unidades') is null
     or to_regproc('public.caller_eh_admin') is null
     or to_regproc('public.caller_pode_editar') is null then
    raise exception 'v177 abortada: funcoes de acesso (v75/v76) ausentes';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) VEÍCULO — nasce uma vez e fica
-- ════════════════════════════════════════════════════════════════════════════
-- O eixo do módulo. Tudo pendura aqui. Separar o veículo (cadastro) do evento
-- (a saída) é a decisão central do desenho: sem isso o condutor redigitaria a
-- placa em cada saída e o sinistro de março reapareceria em toda saída de abril.
create table if not exists public.frota_veiculos (
  id_veiculo          text primary key default gen_random_uuid()::text,

  -- Base (unidade). NOT NULL: veículo sempre pertence a uma base. restrict
  -- porque apagar uma base com frota dentro é erro, não cascata.
  id_unidade          text not null references public.unidades(id_unidade) on delete restrict,

  -- ── Identificação ──────────────────────────────────────────
  placa               text not null,
  modelo              text not null,
  marca               text,
  ano_fabricacao      int,
  ano_modelo          int,
  cor                 text,
  renavam             text,
  chassi              text,
  tipo                text check (tipo in ('CARRO','CAMINHONETE','VAN','CAMINHAO','MOTO','ONIBUS')),

  -- ── Avarias: a linha de base, preenchida NO CADASTRO ───────
  -- As avarias que JÁ EXISTEM quando o carro é registrado. O par dela é
  -- frota_checklists.avarias_constatadas, que é o que o condutor viu NAQUELA
  -- saída. Sem os dois não há como saber o que é novo, e "quem amassou" vira
  -- discussão sem prova.
  avarias_padrao      text,
  observacoes         text,

  -- ── Km: dois registros, por decisão do operador ────────────
  -- km_cadastro é gravado uma vez e nunca mais alterado. km_atual é a última
  -- atualização, e sobe pela saída ou pelo abastecimento. A diferença entre os
  -- dois é o rodado desde o cadastro — sem somar nada à mão.
  -- km_atual NUNCA regride: quem atualiza é lib/frota/km.ts, com um UPDATE
  -- condicional (km novo > coalesce(km_atual, km_cadastro)) num só statement.
  km_cadastro         int not null,
  km_atual            int,
  km_atual_em         timestamptz,
  km_atual_origem     text,        -- 'SAIDA:<id>' | 'ABASTECIMENTO:<id>'

  status              text not null default 'ATIVO'
                      check (status in ('ATIVO','MANUTENCAO','INATIVO','VENDIDO')),

  -- ── Foto de capa: nasce com miniatura ──────────────────────
  -- Miniatura desde o primeiro commit, como a v163 fez. A lista lê a thumb; o
  -- detalhe lê a vista. É o que evita repetir os 272 MB que a v173 corrigiu.
  foto_capa_path       text,
  foto_capa_thumb_path text,

  criado_por          text,
  criado_em           timestamptz not null default now(),
  updated_at          timestamptz,

  -- km_atual não pode ser menor que o km do cadastro: o carro não anda para trás.
  constraint ck_frota_veiculos_km check (km_atual is null or km_atual >= km_cadastro)
);

-- Placa normalizada (sem hífen, maiúscula) é única no sistema. Índice funcional
-- porque a placa é digitada de várias formas — "RJP2A45", "rjp-2a45", "RJP 2A45".
create unique index if not exists uniq_frota_veiculos_placa
  on public.frota_veiculos (upper(replace(replace(placa,'-',''),' ','')));
create index if not exists idx_frota_veiculos_unidade on public.frota_veiculos (id_unidade);
create index if not exists idx_frota_veiculos_status  on public.frota_veiculos (status);

-- ════════════════════════════════════════════════════════════════════════════
-- 2) GALERIA — cresce sem fim
-- ════════════════════════════════════════════════════════════════════════════
-- Tabela filha, não coluna de array: galeria "ilimitada" em text[]/JSON convida
-- a um teto implícito, dificulta paginar e impede guardar legenda, ordem e
-- miniatura por foto. Uma linha por foto resolve os quatro de uma vez.
create table if not exists public.frota_veiculo_fotos (
  id_foto      text primary key default gen_random_uuid()::text,
  id_veiculo   text not null references public.frota_veiculos(id_veiculo) on delete cascade,

  -- Três níveis, gerados por gerarMiniatura() de lib/imagem/redimensionar.ts:
  --   thumb 320 px  → a grade da galeria (24 por página = ~840 kB)
  --   vista 1600 px → o que abre ao clicar; mostra risco e amassado de sobra
  --   original      → nulo quando descartado (política padrão do módulo)
  -- Os dois primeiros são NOT NULL de propósito: galeria sem teto e sem
  -- miniatura repete exatamente o problema que a v173 acabou de matar.
  thumb_path   text not null,
  vista_path   text not null,
  original_path text,

  legenda      text,
  ordem        int  not null default 0,
  largura      int,
  altura       int,
  bytes        int,
  criado_por   text,
  criado_em    timestamptz not null default now()
);
create index if not exists idx_frota_veiculo_fotos_v
  on public.frota_veiculo_fotos (id_veiculo, ordem, criado_em desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 3) CHECKLIST DE SAÍDA — acontece a cada chave
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.frota_checklists (
  id_checklist        text primary key default gen_random_uuid()::text,

  -- restrict, não cascade: apagar um veículo que tem histórico de saída é erro.
  -- O histórico é justamente o que se vai querer consultar depois.
  id_veiculo          text not null references public.frota_veiculos(id_veiculo) on delete restrict,
  id_unidade          text not null references public.unidades(id_unidade) on delete restrict,

  -- Nome apenas, por decisão do operador: sem FK para usuarios nem para
  -- colaboradores. Quem dirige não necessariamente tem conta no sistema.
  condutor_nome       text not null,
  data_saida          timestamptz not null default now(),

  -- Obrigatório por decisão do operador: é o que atualiza o registro de km do
  -- veículo. Sem ele não há km rodado nem consumo.
  km_saida            int not null,

  -- O que o condutor constatou NESTA saída (o par de veiculos.avarias_padrao).
  avarias_constatadas text,
  observacoes         text,

  -- ── Endereço de destino ────────────────────────────────────
  -- logradouro + cidade + uf é o mínimo para o mapa achar o lugar. O resto o
  -- CEP autocompleta (ViaCEP), com digitação manual sempre disponível.
  endereco_cep              text,
  endereco_logradouro       text not null,
  endereco_numero           text,
  endereco_complemento      text,
  endereco_bairro           text,
  endereco_cidade           text not null,
  endereco_uf               char(2) not null,
  endereco_ponto_referencia text,
  latitude                  numeric(10,7),
  longitude                 numeric(10,7),

  -- Link colado à mão (pin compartilhado, plus code). Vazio = lib/frota/maps.ts
  -- monta na hora a partir de coordenada ou endereço. A URL montada NÃO é
  -- gravada: corrigir o endereço corrige o link sem migration.
  maps_url                  text,

  status         text not null default 'RASCUNHO' check (status in ('RASCUNHO','FINALIZADO')),
  finalizado_em  timestamptz,
  finalizado_por text,

  -- Previstas para a fase 2 (retorno do veículo). Sem uso e sem tela na fase 1.
  data_retorno   timestamptz,
  km_retorno     int,

  criado_por     text,
  criado_em      timestamptz not null default now(),
  updated_at     timestamptz
);
create index if not exists idx_frota_checklists_v
  on public.frota_checklists (id_veiculo, data_saida desc);
create index if not exists idx_frota_checklists_unidade
  on public.frota_checklists (id_unidade, data_saida desc);
create index if not exists idx_frota_checklists_status
  on public.frota_checklists (status, data_saida desc);

-- ── 3.1) As 4 fotos obrigatórias ────────────────────────────────────────────
create table if not exists public.frota_checklist_fotos (
  id_foto       text primary key default gen_random_uuid()::text,
  id_checklist  text not null references public.frota_checklists(id_checklist) on delete cascade,
  angulo        text not null check (angulo in
                  ('FRENTE','LATERAL_DIREITA','LATERAL_ESQUERDA','TRASEIRA','EXTRA')),
  thumb_path    text not null,
  vista_path    text not null,
  original_path text,
  legenda       text,
  ordem         int not null default 0,   -- só as EXTRA usam
  criado_em     timestamptz not null default now()
);

-- Uma foto por ângulo obrigatório; EXTRA pode repetir à vontade. Índice único
-- parcial: é o que impede duas "frentes" no mesmo checklist.
create unique index if not exists uniq_frota_checklist_angulo
  on public.frota_checklist_fotos (id_checklist, angulo) where angulo <> 'EXTRA';

-- ── 3.2) Rotas do trajeto — filhas da SAÍDA ─────────────────────────────────
-- Por decisão do operador, a rota pendura no checklist, não no abastecimento.
-- Rota é característica do TRAJETO, e o trajeto é a saída: quem abastece duas
-- vezes na mesma viagem lançaria a mesma sequência duas vezes, e o total de km
-- rodado sairia dobrado. O abastecimento continua ligado à saída por
-- id_checklist_origem, então o relatório sabe ligar combustível a trajeto.
create table if not exists public.frota_rotas (
  id_rota       text primary key default gen_random_uuid()::text,
  id_checklist  text not null references public.frota_checklists(id_checklist) on delete cascade,
  ordem         int  not null,
  origem        text not null,
  destino       text not null,
  km_percorrido int,
  data          date,
  finalidade    text,
  observacao    text,
  criado_em     timestamptz not null default now()
);
create unique index if not exists uniq_frota_rotas_ordem
  on public.frota_rotas (id_checklist, ordem);

-- ════════════════════════════════════════════════════════════════════════════
-- 4) ABASTECIMENTO — cresce sem fim
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.frota_abastecimentos (
  id_abastecimento    text primary key default gen_random_uuid()::text,
  id_veiculo          text not null references public.frota_veiculos(id_veiculo) on delete cascade,
  data_hora           timestamptz not null default now(),

  -- "Quem pegou o veículo". Nome apenas, igual à saída.
  condutor_nome       text not null,
  km_odometro         int,
  tipo_combustivel    text not null check (tipo_combustivel in
                        ('GASOLINA','ETANOL','DIESEL_S10','DIESEL_S500','GNV','ARLA32','ELETRICO')),

  -- Três colunas comuns e INDEPENDENTES, por decisão do operador: sem coluna
  -- gerada, sem soma automática e sem preenchimento sugerido na tela. O valor
  -- do litro varia por posto, e uma soma automática geraria mais confusão do
  -- que ajuda. Todas opcionais: nem todo cupom chega completo.
  litros              numeric(10,3),
  valor_litro         numeric(10,3),
  valor_total         numeric(14,2),

  posto               text,
  cidade_uf           text,
  forma_pagamento     text check (forma_pagamento in
                        ('CARTAO_FROTA','CARTAO_EMPRESA','DINHEIRO','PIX','FATURADO')),
  numero_cupom        text,       -- só o número; o arquivo vai em _anexos

  -- Sem isso, consumo médio não fecha: tanque parcial invalida a conta.
  tanque_cheio        boolean not null default true,

  id_checklist_origem text references public.frota_checklists(id_checklist) on delete set null,

  criado_por          text,
  criado_em           timestamptz not null default now()
);
create index if not exists idx_frota_abastecimentos_v
  on public.frota_abastecimentos (id_veiculo, data_hora desc);

-- ── 4.1) Comprovante: anexo de QUALQUER formato ─────────────────────────────
-- Por decisão do operador: "opção de encaixar o comprovante, seja ele foto, pdf
-- entre outros". Tabela filha e não coluna porque um abastecimento no
-- cartão-frota costuma ter cupom da bomba E comprovante da máquina — coluna
-- única forçaria escolher um. Com mime na linha, a tela sabe se renderiza
-- imagem ou oferece download, sem adivinhar por extensão.
create table if not exists public.frota_abastecimento_anexos (
  id_anexo         text primary key default gen_random_uuid()::text,
  id_abastecimento text not null references public.frota_abastecimentos(id_abastecimento) on delete cascade,
  arquivo_path     text not null,
  mime             text not null,   -- image/jpeg, application/pdf, …
  nome_arquivo     text not null,
  bytes            int  not null,
  -- Nulo quando não é imagem: PDF não tem miniatura, a lista mostra ícone.
  thumb_path       text,
  criado_por       text,
  criado_em        timestamptz not null default now()
);
create index if not exists idx_frota_abastecimento_anexos_a
  on public.frota_abastecimento_anexos (id_abastecimento, criado_em);

-- ════════════════════════════════════════════════════════════════════════════
-- 5) SINISTRO — cresce sem fim
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.frota_sinistros (
  id_sinistro           text primary key default gen_random_uuid()::text,
  id_veiculo            text not null references public.frota_veiculos(id_veiculo) on delete cascade,
  data_ocorrencia       date not null,
  hora_ocorrencia       time,
  tipo                  text not null check (tipo in
                          ('COLISAO','CAPOTAMENTO','ATROPELAMENTO','ROUBO','FURTO',
                           'INCENDIO','VIDROS','FENOMENO_NATURAL','TERCEIROS','OUTRO')),
  gravidade             text check (gravidade in ('LEVE','MEDIA','GRAVE')),
  com_vitima            boolean not null default false,
  descricao             text not null,
  condutor_nome         text,
  local_ocorrencia      text,
  latitude              numeric(10,7),
  longitude             numeric(10,7),
  boletim_ocorrencia    text,
  seguradora            text,
  numero_aviso_sinistro text,
  valor_franquia        numeric(14,2),
  valor_prejuizo        numeric(14,2),

  -- É o status que faz "histórico de sinistros" valer alguma coisa: sem ele a
  -- lista é um monte de ocorrência sem desfecho.
  status                text not null default 'ABERTO' check (status in
                          ('ABERTO','EM_ANALISE','EM_REPARO','ENCERRADO','NEGADO')),

  id_checklist_origem   text references public.frota_checklists(id_checklist) on delete set null,

  criado_por            text,
  criado_em             timestamptz not null default now(),
  updated_at            timestamptz
);
create index if not exists idx_frota_sinistros_v
  on public.frota_sinistros (id_veiculo, data_ocorrencia desc);
create index if not exists idx_frota_sinistros_status
  on public.frota_sinistros (status, data_ocorrencia desc);

create table if not exists public.frota_sinistro_fotos (
  id_foto       text primary key default gen_random_uuid()::text,
  id_sinistro   text not null references public.frota_sinistros(id_sinistro) on delete cascade,
  thumb_path    text not null,
  vista_path    text not null,
  original_path text,
  legenda       text,
  ordem         int not null default 0,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_frota_sinistro_fotos_s
  on public.frota_sinistro_fotos (id_sinistro, ordem);

-- ════════════════════════════════════════════════════════════════════════════
-- 6) PERMISSÃO DO MÓDULO
-- ════════════════════════════════════════════════════════════════════════════
-- Molde de caller_pode_equipamentos() (v163).
create or replace function public.caller_pode_frota()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.caller_eh_admin() or exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo_sistema = true
       and (u.modulos_permitidos is null                    -- NULL = herda todos
            or 'frota' = any(u.modulos_permitidos))
  );
$$;

-- Dia-zero: NINGUÉM, de propósito. A v163 concedeu 'equipamentos' a quem tinha
-- 'transferencias'; aqui não há grupo equivalente — frota é público diferente de
-- SST, e o operador decidiu que a concessão é do admin.
--
-- Efeito colateral desejado: dá para subir o módulo inteiro num deploy só e
-- validar em produção (storage real, celular real, .107 real) concedendo o
-- módulo apenas a você, antes de liberar para os motoristas. É feature flag de
-- graça, usando o mecanismo que já existe.
--
-- Quando quiser liberar, é um UPDATE à mão:
--   update public.usuarios
--      set modulos_permitidos = (select array_agg(distinct m) from
--            unnest(coalesce(modulos_permitidos,'{}') || array['frota']) m)
--    where email in ('...');

-- ════════════════════════════════════════════════════════════════════════════
-- 7) RLS por unidade, sem rampa
-- ════════════════════════════════════════════════════════════════════════════
-- Tabelas-raiz (veiculos, checklists) filtram por id_unidade direto. As filhas
-- herdam o escopo por exists no pai, no padrão da v148 — NÃO repetem
-- id_unidade, para não haver duas verdades sobre a mesma linha.

alter table public.frota_veiculos            enable row level security;
alter table public.frota_veiculo_fotos       enable row level security;
alter table public.frota_checklists          enable row level security;
alter table public.frota_checklist_fotos     enable row level security;
alter table public.frota_rotas               enable row level security;
alter table public.frota_abastecimentos      enable row level security;
alter table public.frota_abastecimento_anexos enable row level security;
alter table public.frota_sinistros           enable row level security;
alter table public.frota_sinistro_fotos      enable row level security;

-- ── 7.1) frota_veiculos (raiz) ──────────────────────────────────────────────
drop policy if exists frota_veiculos_sel on public.frota_veiculos;
create policy frota_veiculos_sel on public.frota_veiculos
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_frota() and id_unidade = any(public.caller_unidades()))
  );

drop policy if exists frota_veiculos_rw on public.frota_veiculos;
create policy frota_veiculos_rw on public.frota_veiculos
  for all to authenticated
  using (
    public.caller_eh_admin()
    or (public.caller_pode_editar() and public.caller_pode_frota()
        and id_unidade = any(public.caller_unidades()))
  )
  with check (
    public.caller_eh_admin()
    or (public.caller_pode_editar() and public.caller_pode_frota()
        and id_unidade = any(public.caller_unidades()))
  );

-- ── 7.2) frota_checklists (raiz) ────────────────────────────────────────────
drop policy if exists frota_checklists_sel on public.frota_checklists;
create policy frota_checklists_sel on public.frota_checklists
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_frota() and id_unidade = any(public.caller_unidades()))
  );

drop policy if exists frota_checklists_rw on public.frota_checklists;
create policy frota_checklists_rw on public.frota_checklists
  for all to authenticated
  using (
    public.caller_eh_admin()
    or (public.caller_pode_editar() and public.caller_pode_frota()
        and id_unidade = any(public.caller_unidades()))
  )
  with check (
    public.caller_eh_admin()
    or (public.caller_pode_editar() and public.caller_pode_frota()
        and id_unidade = any(public.caller_unidades()))
  );

-- ── 7.3) Dois auxiliares de escopo, no molde caller_pode_* ──────────────────
-- Cada tabela filha precisaria repetir o mesmo `exists` no pai (padrão v148).
-- Com 7 filhas isso seriam 21 cópias da mesma condição — e uma delas ficaria
-- diferente das outras algum dia. Duas funções resolvem, e a policy vira uma
-- linha legível.
--
-- security definer é deliberado, no molde de caller_pode_frota(): a leitura do
-- pai acontece sem reavaliar o RLS do pai, o que evita recursão de policy.
create or replace function public.frota_pode_veiculo(p_id_veiculo text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.frota_veiculos v
     where v.id_veiculo = p_id_veiculo
       and (public.caller_eh_admin()
            or (public.caller_pode_frota() and v.id_unidade = any(public.caller_unidades())))
  );
$$;

create or replace function public.frota_pode_checklist(p_id_checklist text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.frota_checklists c
     where c.id_checklist = p_id_checklist
       and (public.caller_eh_admin()
            or (public.caller_pode_frota() and c.id_unidade = any(public.caller_unidades())))
  );
$$;

-- ── 7.4) Filhas do VEÍCULO ──────────────────────────────────────────────────
drop policy if exists frota_veiculo_fotos_sel on public.frota_veiculo_fotos;
create policy frota_veiculo_fotos_sel on public.frota_veiculo_fotos
  for select to authenticated using (public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_veiculo_fotos_rw on public.frota_veiculo_fotos;
create policy frota_veiculo_fotos_rw on public.frota_veiculo_fotos
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo))
  with check (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_abastecimentos_sel on public.frota_abastecimentos;
create policy frota_abastecimentos_sel on public.frota_abastecimentos
  for select to authenticated using (public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_abastecimentos_rw on public.frota_abastecimentos;
create policy frota_abastecimentos_rw on public.frota_abastecimentos
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo))
  with check (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_sinistros_sel on public.frota_sinistros;
create policy frota_sinistros_sel on public.frota_sinistros
  for select to authenticated using (public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_sinistros_rw on public.frota_sinistros;
create policy frota_sinistros_rw on public.frota_sinistros
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo))
  with check (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo));

-- ── 7.5) Filhas do CHECKLIST ────────────────────────────────────────────────
drop policy if exists frota_checklist_fotos_sel on public.frota_checklist_fotos;
create policy frota_checklist_fotos_sel on public.frota_checklist_fotos
  for select to authenticated using (public.frota_pode_checklist(id_checklist));

drop policy if exists frota_checklist_fotos_rw on public.frota_checklist_fotos;
create policy frota_checklist_fotos_rw on public.frota_checklist_fotos
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_checklist(id_checklist))
  with check (public.caller_pode_editar() and public.frota_pode_checklist(id_checklist));

drop policy if exists frota_rotas_sel on public.frota_rotas;
create policy frota_rotas_sel on public.frota_rotas
  for select to authenticated using (public.frota_pode_checklist(id_checklist));

drop policy if exists frota_rotas_rw on public.frota_rotas;
create policy frota_rotas_rw on public.frota_rotas
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_checklist(id_checklist))
  with check (public.caller_pode_editar() and public.frota_pode_checklist(id_checklist));

-- ── 7.6) Netas: fotos de sinistro e anexos de abastecimento ─────────────────
-- O escopo vem do avô (o veículo), porque é lá que mora a unidade — o pai
-- intermediário não repete id_unidade, de propósito.
drop policy if exists frota_sinistro_fotos_sel on public.frota_sinistro_fotos;
create policy frota_sinistro_fotos_sel on public.frota_sinistro_fotos
  for select to authenticated using (exists (
    select 1 from public.frota_sinistros s
     where s.id_sinistro = frota_sinistro_fotos.id_sinistro
       and public.frota_pode_veiculo(s.id_veiculo)
  ));

drop policy if exists frota_sinistro_fotos_rw on public.frota_sinistro_fotos;
create policy frota_sinistro_fotos_rw on public.frota_sinistro_fotos
  for all to authenticated
  using (public.caller_pode_editar() and exists (
    select 1 from public.frota_sinistros s
     where s.id_sinistro = frota_sinistro_fotos.id_sinistro
       and public.frota_pode_veiculo(s.id_veiculo)
  ))
  with check (public.caller_pode_editar() and exists (
    select 1 from public.frota_sinistros s
     where s.id_sinistro = frota_sinistro_fotos.id_sinistro
       and public.frota_pode_veiculo(s.id_veiculo)
  ));

drop policy if exists frota_abastecimento_anexos_sel on public.frota_abastecimento_anexos;
create policy frota_abastecimento_anexos_sel on public.frota_abastecimento_anexos
  for select to authenticated using (exists (
    select 1 from public.frota_abastecimentos a
     where a.id_abastecimento = frota_abastecimento_anexos.id_abastecimento
       and public.frota_pode_veiculo(a.id_veiculo)
  ));

drop policy if exists frota_abastecimento_anexos_rw on public.frota_abastecimento_anexos;
create policy frota_abastecimento_anexos_rw on public.frota_abastecimento_anexos
  for all to authenticated
  using (public.caller_pode_editar() and exists (
    select 1 from public.frota_abastecimentos a
     where a.id_abastecimento = frota_abastecimento_anexos.id_abastecimento
       and public.frota_pode_veiculo(a.id_veiculo)
  ))
  with check (public.caller_pode_editar() and exists (
    select 1 from public.frota_abastecimentos a
     where a.id_abastecimento = frota_abastecimento_anexos.id_abastecimento
       and public.frota_pode_veiculo(a.id_veiculo)
  ));

-- ════════════════════════════════════════════════════════════════════════════
-- 8) A TRAVA: não finaliza sem as 4 fotos
-- ════════════════════════════════════════════════════════════════════════════
-- Trava de BANCO, não só de tela. A tela dá a mensagem amigável; isto aqui é a
-- rede para dois envios simultâneos e para qualquer chamada que não passe pela
-- tela (PostgREST direto, psql, script).
--
-- security definer NÃO é cosmético aqui: a função consulta
-- frota_checklist_fotos, que tem RLS. Sem definer, a contagem de ângulos seria
-- a que o CHAMADOR consegue ver — e uma trava cujo veredito depende de quem
-- pergunta não é trava. Com definer ela avalia o estado real da tabela.
-- Não há escalação: quem chega neste UPDATE já provou acesso ao checklist pela
-- policy frota_checklists_rw, e a função só conta ângulos daquele id.
-- COBRE INSERT TAMBÉM, não só UPDATE. A tela sempre cria RASCUNHO e só depois
-- promove a FINALIZADO — mas um `insert ... status='FINALIZADO'` direto no
-- PostgREST nasceria finalizado sem foto nenhuma, e um trigger só de UPDATE
-- jamais veria essa linha. Como a foto precisa de um id_checklist para existir,
-- todo INSERT já-finalizado tem zero foto e é recusado aqui: finalizar exige
-- passar pelo rascunho, que é justamente o fluxo da tela.
create or replace function public.frota_exige_4_fotos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_faltam text;
  v_virou_finalizado boolean;
begin
  -- old só existe no UPDATE: referenciá-lo no INSERT é erro de plpgsql, por isso
  -- os dois casos ficam em ramos separados em vez de uma condição só.
  if tg_op = 'INSERT' then
    v_virou_finalizado := (new.status = 'FINALIZADO');
  else
    v_virou_finalizado := (new.status = 'FINALIZADO'
                           and old.status is distinct from 'FINALIZADO');
  end if;

  if v_virou_finalizado then
    select string_agg(a, ', ') into v_faltam
      from unnest(array['FRENTE','LATERAL_DIREITA','LATERAL_ESQUERDA','TRASEIRA']) a
     where not exists (
       select 1 from public.frota_checklist_fotos f
        where f.id_checklist = new.id_checklist and f.angulo = a
     );
    if v_faltam is not null then
      raise exception 'Saida nao pode ser finalizada: faltam as fotos %', v_faltam;
    end if;
    new.finalizado_em := coalesce(new.finalizado_em, now());
  end if;
  return new;
end $$;

drop trigger if exists trg_frota_exige_4_fotos on public.frota_checklists;
create trigger trg_frota_exige_4_fotos
  before insert or update on public.frota_checklists
  for each row execute function public.frota_exige_4_fotos();

-- ════════════════════════════════════════════════════════════════════════════
-- 9) A SAÍDA MORA NA MESMA BASE DO VEÍCULO
-- ════════════════════════════════════════════════════════════════════════════
-- frota_checklists.id_unidade é cópia da unidade do veículo — existe para a RLS
-- e o índice não precisarem de join. Cópia sem trava vira duas verdades: a
-- policy valida a unidade DO CHECKLIST, e a FK de id_veiculo não passa por RLS,
-- então nada impedia alguém da base A criar uma saída (carimbada A) para um
-- veículo da base B. A saída apareceria na lista de A e o veículo na de B.
--
-- Só cobra no INSERT e quando id_veiculo/id_unidade mudam: se o veículo for
-- transferido de base depois, as saídas antigas ficam como estão — elas
-- aconteceram na base antiga, e reescrever histórico seria pior que a doença.
create or replace function public.frota_checklist_mesma_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_unidade_veiculo text;
begin
  -- old só existe no UPDATE, e `and` em SQL não garante curto-circuito: o ramo
  -- separado é o que impede um "record old is not assigned yet" no INSERT.
  if tg_op = 'UPDATE' then
    if new.id_veiculo is not distinct from old.id_veiculo
       and new.id_unidade is not distinct from old.id_unidade then
      return new;
    end if;
  end if;

  select v.id_unidade into v_unidade_veiculo
    from public.frota_veiculos v
   where v.id_veiculo = new.id_veiculo;

  if v_unidade_veiculo is null then
    raise exception 'Saida aponta para veiculo inexistente (%)', new.id_veiculo;
  end if;

  if new.id_unidade is distinct from v_unidade_veiculo then
    raise exception 'Saida carimbada na base % para veiculo da base %: a saida herda a base do veiculo',
      new.id_unidade, v_unidade_veiculo;
  end if;

  return new;
end $$;

drop trigger if exists trg_frota_checklist_mesma_base on public.frota_checklists;
create trigger trg_frota_checklist_mesma_base
  before insert or update on public.frota_checklists
  for each row execute function public.frota_checklist_mesma_base();

do $$
begin
  raise notice 'v177: modulo frota criado (9 tabelas, RLS por unidade, trava das 4 fotos, saida amarrada a base do veiculo). Modulo concedido a NINGUEM: conceder via usuarios.modulos_permitidos.';
end $$;
