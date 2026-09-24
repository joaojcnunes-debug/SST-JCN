-- v178 — Frota Chabra: movimentação, lotação e manutenção (fase 2).
--
-- POR QUE ESTA MIGRATION EXISTE
--   A v177 registra a SAÍDA e nunca a fecha. `data_retorno` e `km_retorno`
--   nasceram lá comentadas como "Fase 2 — previstas e sem uso". O efeito prático
--   é que ninguém consegue responder as três perguntas que sustentam a vigilância
--   da frota:
--     • qual veículo está fora AGORA, com quem e desde quando;
--     • quantos km aquela viagem deu de fato;
--     • onde o veículo está lotado hoje, e desde quando.
--   Enquanto a saída não fecha, o módulo é um caderno de idas sem voltas.
--
-- O QUE FAZ
--   1) Completa o RETORNO em frota_checklists (colunas novas + CHECK + índice
--      parcial das saídas em aberto). As duas colunas da v177 continuam as
--      mesmas: aqui elas ganham companhia, não substituição.
--   2) Cria public.frota_lotacoes — o histórico de EM QUAL BASE o veículo esteve.
--      Hoje `frota_veiculos.id_unidade` é um campo que se sobrescreve: o carro
--      muda de base e a base anterior desaparece sem deixar rastro.
--   3) Cria public.frota_manutencoes — o que foi feito, quando, quanto custou e
--      quando é a próxima. O status MANUTENCAO já existia no veículo, mas sem
--      nenhum registro por trás dele.
--
-- O QUE NÃO FAZ
--   • NÃO mexe em nenhuma tabela fora do módulo frota_*. Zero ALTER em tabela
--     compartilhada — mesma disciplina da v177, pelo mesmo motivo: se o
--     healthcheck derrubar a imagem para :previous, a imagem antiga ignora
--     coluna e tabela que não conhece.
--   • NÃO concede permissão a ninguém. O módulo 'frota' continua sendo liberado
--     à mão, um e-mail por vez, como a v177 decidiu.
--   • NÃO apaga nem reescreve nada. Toda saída já registrada continua exatamente
--     como está — sem retorno, que é a verdade sobre ela.
--
-- TRANSAÇÃO: aplicada por deploy\migrate.ps1 (psql -1, ON_ERROR_STOP=1). Por
-- isso não há begin/commit aqui. À mão:
--   psql -1 -v ON_ERROR_STOP=1 -f v178_frota_movimentacao.sql
--
-- Idempotente. Rollback em scripts\sql\v178_frota_movimentacao_rollback.sql
-- (fora de supabase\migrations\ de propósito — ver a cicatriz de 2026-07-21 no
-- migrate.ps1).

-- ── Pré-condições: aborta em vez de deixar meia-bagunça ─────────────────────
do $$
begin
  if to_regclass('public.frota_veiculos') is null
     or to_regclass('public.frota_checklists') is null then
    raise exception 'v178 abortada: modulo frota (v177) nao esta aplicado';
  end if;
  if to_regproc('public.frota_pode_veiculo') is null then
    raise exception 'v178 abortada: frota_pode_veiculo() (v177) ausente';
  end if;
  if to_regproc('public.caller_pode_editar') is null then
    raise exception 'v178 abortada: funcoes de acesso (v75/v76) ausentes';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) O RETORNO — a metade que faltava da saída
-- ════════════════════════════════════════════════════════════════════════════
-- data_retorno e km_retorno já existem desde a v177. O que falta é o entorno:
-- quem fechou, quando fechou no sistema, e o que o veículo trouxe de volta.
--
-- POR QUE `retorno_em` É DIFERENTE DE `data_retorno`: quem registra no sistema
-- não é necessariamente quem dirigiu — foi decisão explícita do operador. O
-- carro volta às 17h e o registro pode acontecer no dia seguinte de manhã.
-- Guardar um só carimbo obrigaria escolher entre a verdade da operação e a
-- verdade do sistema, e as duas importam: uma para o controle da frota, outra
-- para a auditoria de quem digitou.
alter table public.frota_checklists
  add column if not exists retorno_por        text,
  add column if not exists retorno_em         timestamptz,
  add column if not exists avarias_retorno    text,
  add column if not exists retorno_observacao text;

-- km_retorno é OPCIONAL de propósito (nullable desde a v177 e continua):
-- quem lança pode não ter o odômetro na mão. O que não se aceita é odômetro
-- MENOR na volta do que na ida — isso é digitação errada em 100% dos casos, o
-- mesmo raciocínio de lib/frota/km.ts. Nulo passa; menor, não.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ck_frota_checklists_km_retorno'
       and conrelid = 'public.frota_checklists'::regclass
  ) then
    alter table public.frota_checklists
      add constraint ck_frota_checklists_km_retorno
      check (km_retorno is null or km_retorno >= km_saida);
  end if;
end $$;

-- O índice que faz a pergunta "quem está fora agora" custar nada. Parcial: só
-- as saídas finalizadas e ainda em aberto entram nele, que é sempre um punhado
-- de linhas mesmo quando a tabela tiver dezenas de milhares.
create index if not exists idx_frota_checklists_em_aberto
  on public.frota_checklists (id_veiculo, data_saida desc)
  where status = 'FINALIZADO' and data_retorno is null;

-- Retorno não existe sem saída finalizada, e não se fecha duas vezes com datas
-- conflitantes. A trava é de banco porque a tela não é o único caminho.
create or replace function public.frota_valida_retorno()
returns trigger language plpgsql as $$
begin
  if new.data_retorno is null then
    -- Reabrir uma viagem (limpar o retorno) é legítimo: correção de lançamento.
    -- O que não pode é sobrar sujeira de um retorno que não existe mais.
    new.km_retorno         := null;
    new.avarias_retorno    := null;
    new.retorno_observacao := null;
    new.retorno_por        := null;
    new.retorno_em         := null;
    return new;
  end if;

  if new.status <> 'FINALIZADO' then
    raise exception 'Retorno so pode ser registrado em saida FINALIZADA (esta esta %)', new.status;
  end if;

  if new.data_retorno < new.data_saida then
    raise exception 'Retorno (%) anterior a saida (%)', new.data_retorno, new.data_saida;
  end if;

  new.retorno_em := coalesce(new.retorno_em, now());
  return new;
end $$;

drop trigger if exists trg_frota_valida_retorno on public.frota_checklists;
create trigger trg_frota_valida_retorno
  before insert or update on public.frota_checklists
  for each row execute function public.frota_valida_retorno();

-- ════════════════════════════════════════════════════════════════════════════
-- 2) LOTAÇÃO — o histórico de onde o veículo ficou
-- ════════════════════════════════════════════════════════════════════════════
-- `frota_veiculos.id_unidade` responde "onde está hoje" e só. Ele é
-- sobrescrito: passar o carro de Barbacena para Conselheiro Lafaiete apaga
-- Barbacena. Esta tabela é o extrato — cada linha é uma mudança de base, com
-- data, motivo e quem autorizou.
--
-- POR QUE NÃO REUSEI frota_checklists: saída é VIAGEM (vai e volta no mesmo
-- dia, o carro continua sendo da base). Lotação é MUDANÇA DE ENDEREÇO do
-- patrimônio (o carro passa a ser de outra base, e as saídas seguintes nascem
-- carimbadas nela). Misturar as duas faria o relatório de viagens contar
-- transferência como passeio, e o de patrimônio contar ida ao cliente como
-- mudança de base.
create table if not exists public.frota_lotacoes (
  id_lotacao          text primary key default gen_random_uuid()::text,

  -- cascade: o extrato de lotação não faz sentido sem o veículo, e o veículo
  -- só pode ser apagado quando não tem histórico nenhum (regra de
  -- useExcluirVeiculo). Restrict aqui só criaria um segundo bloqueio para dizer
  -- a mesma coisa.
  id_veiculo          text not null references public.frota_veiculos(id_veiculo) on delete cascade,

  -- Nulo na PRIMEIRA lotação: o veículo não veio de lugar nenhum, ele nasceu
  -- ali. restrict nas duas porque apagar unidade citada no histórico é erro.
  id_unidade_origem   text references public.unidades(id_unidade) on delete restrict,
  id_unidade_destino  text not null references public.unidades(id_unidade) on delete restrict,

  -- Quando o veículo MUDOU de base, não quando alguém digitou. Os dois carimbos
  -- existem pelo mesmo motivo do retorno (ver seção 1).
  data_movimentacao   timestamptz not null default now(),

  motivo              text,
  responsavel_nome    text,   -- quem levou / quem autorizou. Nome, sem FK:
                              -- mesma regra do condutor na v177.
  observacao          text,

  -- ── Os dois km, e por que são dois ─────────────────────────
  -- km_percorrido é o trecho ("de Barbacena até Lafaiete deu 210 km"), e é o
  -- que o operador pediu como campo OPCIONAL: quem registra no sistema não é
  -- quem dirigiu, e frequentemente não sabe.
  -- km_odometro é a leitura do painel na chegada. Só ele atualiza o registro do
  -- veículo, e só para cima — a regra de lib/frota/km.ts vale igual aqui.
  km_percorrido       int,
  km_odometro         int,

  criado_por          text,
  criado_em           timestamptz not null default now(),

  -- Mudar de base para a mesma base não é movimentação, é ruído no extrato.
  constraint ck_frota_lotacoes_bases
    check (id_unidade_origem is null or id_unidade_origem <> id_unidade_destino),
  constraint ck_frota_lotacoes_km
    check ((km_percorrido is null or km_percorrido >= 0)
       and (km_odometro   is null or km_odometro   >= 0))
);
create index if not exists idx_frota_lotacoes_v
  on public.frota_lotacoes (id_veiculo, data_movimentacao desc);
create index if not exists idx_frota_lotacoes_destino
  on public.frota_lotacoes (id_unidade_destino, data_movimentacao desc);

-- ── 2.1) A origem NÃO é digitada: ela é lida do veículo ─────────────────────
-- Deixar a origem vir da tela permitiria gravar "saiu de Lafaiete" para um
-- carro que está em Barbacena, e o extrato viraria ficção. O trigger carimba a
-- base real no momento do lançamento e recusa quem tentar discordar.
create or replace function public.frota_lotacao_carimba_origem()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_base_atual text;
begin
  select v.id_unidade into v_base_atual
    from public.frota_veiculos v
   where v.id_veiculo = new.id_veiculo;

  if v_base_atual is null then
    raise exception 'Lotacao aponta para veiculo inexistente (%)', new.id_veiculo;
  end if;

  if new.id_unidade_origem is null then
    new.id_unidade_origem := v_base_atual;
  elsif new.id_unidade_origem is distinct from v_base_atual then
    raise exception 'Lotacao diz que o veiculo sai de %, mas ele esta em %',
      new.id_unidade_origem, v_base_atual;
  end if;

  if new.id_unidade_destino = new.id_unidade_origem then
    raise exception 'O veiculo ja esta lotado nesta base';
  end if;

  return new;
end $$;

drop trigger if exists trg_frota_lotacao_carimba_origem on public.frota_lotacoes;
create trigger trg_frota_lotacao_carimba_origem
  before insert on public.frota_lotacoes
  for each row execute function public.frota_lotacao_carimba_origem();

-- ── 2.2) Registrar a lotação MOVE o veículo, no mesmo statement ─────────────
-- Se a tela fizesse insert-e-depois-update, existiria uma janela em que o
-- extrato diz uma coisa e o veículo diz outra — e um erro de rede no meio
-- deixaria as duas verdades divergentes para sempre. Aqui é atômico.
--
-- security invoker de propósito (o padrão): o UPDATE passa pela RLS de
-- frota_veiculos, então ninguém move veículo para uma base fora do seu escopo.
-- A tela só oferece as bases visíveis, mas a garantia tem de estar no banco.
create or replace function public.frota_lotacao_move_veiculo()
returns trigger language plpgsql as $$
begin
  update public.frota_veiculos
     set id_unidade = new.id_unidade_destino,
         updated_at = now()
   where id_veiculo = new.id_veiculo;
  return null;
end $$;

drop trigger if exists trg_frota_lotacao_move_veiculo on public.frota_lotacoes;
create trigger trg_frota_lotacao_move_veiculo
  after insert on public.frota_lotacoes
  for each row execute function public.frota_lotacao_move_veiculo();

-- ════════════════════════════════════════════════════════════════════════════
-- 3) MANUTENÇÃO — o que está por trás do status
-- ════════════════════════════════════════════════════════════════════════════
-- frota_veiculos.status já tinha 'MANUTENCAO' desde a v177, sem nada por trás:
-- o carro ficava marcado como em manutenção e ninguém sabia do quê, desde
-- quando, em qual oficina, nem por quanto. Esta tabela é esse "por trás".
create table if not exists public.frota_manutencoes (
  id_manutencao   text primary key default gen_random_uuid()::text,
  id_veiculo      text not null references public.frota_veiculos(id_veiculo) on delete cascade,

  tipo            text not null check (tipo in
                    ('PREVENTIVA','CORRETIVA','REVISAO','PNEUS','ELETRICA',
                     'FUNILARIA','SOCORRO','OUTRO')),
  status          text not null default 'AGENDADA' check (status in
                    ('AGENDADA','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),

  -- Entrada é obrigatória e saída não: manutenção aberta é justamente a que
  -- interessa vigiar, e ela não tem data de saída ainda.
  data_entrada    date not null,
  data_saida      date,

  km_odometro     int,          -- leitura na entrada; atualiza o veículo, só para cima
  descricao       text not null,
  oficina         text,
  nota_fiscal     text,
  valor           numeric(14,2),

  -- ── A próxima revisão, que é o que ninguém lembra ──────────
  -- Duas colunas independentes porque a regra real é "o que vier primeiro":
  -- revisão a cada 10.000 km OU 12 meses. Uma coluna só forçaria escolher.
  proxima_revisao_data date,
  proxima_revisao_km   int,

  -- Preenchido quando a manutenção nasceu de um sinistro. set null: encerrar o
  -- sinistro não pode apagar a manutenção que ele gerou.
  id_sinistro_origem text references public.frota_sinistros(id_sinistro) on delete set null,

  criado_por      text,
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz,

  constraint ck_frota_manutencoes_datas
    check (data_saida is null or data_saida >= data_entrada),
  constraint ck_frota_manutencoes_valor
    check (valor is null or valor >= 0)
);
create index if not exists idx_frota_manutencoes_v
  on public.frota_manutencoes (id_veiculo, data_entrada desc);
create index if not exists idx_frota_manutencoes_abertas
  on public.frota_manutencoes (status, data_entrada desc)
  where status in ('AGENDADA','EM_ANDAMENTO');

-- ════════════════════════════════════════════════════════════════════════════
-- 4) RLS — herda o escopo do veículo, como todas as filhas da v177
-- ════════════════════════════════════════════════════════════════════════════
-- Nenhuma das duas tabelas repete id_unidade. frota_lotacoes é a exceção
-- aparente: ela CITA duas unidades, mas nenhuma delas é o escopo da linha — o
-- escopo é o do veículo, que é justamente o que muda. Amarrar a policy à
-- unidade de destino faria a linha sumir da base de origem no instante da
-- transferência, e o extrato perderia metade dos leitores.
alter table public.frota_lotacoes    enable row level security;
alter table public.frota_manutencoes enable row level security;

drop policy if exists frota_lotacoes_sel on public.frota_lotacoes;
create policy frota_lotacoes_sel on public.frota_lotacoes
  for select to authenticated using (public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_lotacoes_rw on public.frota_lotacoes;
create policy frota_lotacoes_rw on public.frota_lotacoes
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo))
  with check (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_manutencoes_sel on public.frota_manutencoes;
create policy frota_manutencoes_sel on public.frota_manutencoes
  for select to authenticated using (public.frota_pode_veiculo(id_veiculo));

drop policy if exists frota_manutencoes_rw on public.frota_manutencoes;
create policy frota_manutencoes_rw on public.frota_manutencoes
  for all to authenticated
  using      (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo))
  with check (public.caller_pode_editar() and public.frota_pode_veiculo(id_veiculo));

do $$
begin
  raise notice 'v178: retorno da saida + frota_lotacoes + frota_manutencoes. Nenhuma permissao concedida, nenhuma linha existente alterada.';
end $$;
