-- v188 — Equipamentos: cadastro de digital e assinatura biométrica em TRÊS PAPÉIS
-- (quem envia, quem recebe, quem valida) na retirada. Aditiva e idempotente.
--
-- Numerada 188 porque 186 e 187 já estão APLICADAS em produção
-- (`v186_gestao_acessos_dml_revoke`, `v187_gestao_tarefa_vinculados`) — conferido em
-- `schema_migrations`, não presumido. Esta migration já foi renumerada duas vezes: o
-- alvo se move enquanto a branch fica parada, então o número tem de ser reconferido
-- imediatamente antes de aplicar, nunca no dia em que o arquivo foi escrito.
--
-- O dano de colidir não é o `INSERT` — `schema_migrations` chaveia pelo basename
-- inteiro. É o caminho de emergência: dois arquivos chamados "rollback da v187", e o
-- errado derruba `gestao_tarefa_vinculados`, que tem dado.
--
-- Três decisões que valem explicar, porque não são óbvias:
--
-- 1) O template NÃO mora em `colaboradores_chabra`. A policy de SELECT da v166 libera
--    a linha inteira para quem tem `caller_pode_equipamentos()` na base — o template
--    cifrado sairia junto, para todo mundo da unidade. Ele vai em tabela própria, com
--    RLS ligada e ZERO policy, alcançável só por RPC `security definer`.
--    E o `revoke` não é decoração: o default ACL desta base concede `arwd` a
--    `authenticated` em toda tabela nova. Sem revogar, ela nasce escrevível.
--
-- 2) Reusa `public.epi_bio_key()` (v132). Mesma base, mesmo domínio de confiança.
--    Duas chaves seriam duas coisas para perder — e uma já se perdeu uma vez.
--    MAS: o revisor mediu que `epi_bio_key()` estava com EXECUTE para PUBLIC/anon/
--    authenticated — devolvendo a própria chave para qualquer portador da publishable
--    key, inclusive sem login. Herdar isso deixaria "cifrado" nominal: a confidencia-
--    lidade do cofre novo dependeria de UM controle (o revoke da tabela), sem
--    profundidade. Esta migration revoga (§10). Nenhum `.ts` chama, e os chamadores
--    reais são `security definer` do `chabra_admin`, que não consultam ACL do chamador.
--
-- 3) A gravação de assinatura DIGITAL é exclusiva do servidor. A RPC que o navegador
--    alcança recusa gravar com score; quem grava é outra função, concedida SÓ a
--    `service_role`. Sem isso, qualquer cliente autenticado mandaria
--    `finger_verificado = true` sem nunca ter encostado o dedo no leitor.

create extension if not exists pgcrypto;

-- ── 1) Metadado não-secreto (a UI precisa mostrar quem já cadastrou) ────────
alter table public.colaboradores_chabra
  add column if not exists biometria_em   timestamptz,
  add column if not exists biometria_dedo text;

-- ── 2) O template, em tabela trancada ──────────────────────────────────────
create table if not exists public.colaboradores_chabra_biometria (
  id_colaborador   text primary key
                     references public.colaboradores_chabra(id_colaborador) on delete cascade,
  id_unidade       text not null references public.unidades(id_unidade) on delete restrict,
  template         text not null,               -- JSON de amostras, cifrado (pgp_sym, base64)
  dedo             text,
  consentimento_em timestamptz not null,
  cadastrado_em    timestamptz not null default now(),
  cadastrado_por   text
);

-- B3 — o sha256 de CADA amostra de cadastro, em claro (hash não é o dado).
-- Sem isto, quem cadastra sai com as três imagens no navegador e elas são a sonda
-- perfeita: alimentadas de volta ao matcher, é imagem contra si mesma, score máximo por
-- construção. Guardar o hash permite recusar exatamente esse payload.
alter table public.colaboradores_chabra_biometria
  add column if not exists amostras_sha256 text[];

alter table public.colaboradores_chabra_biometria enable row level security;
-- Sem policy DE PROPÓSITO: RLS ligada + zero policy = ninguém em `authenticated` lê nada.
revoke all on public.colaboradores_chabra_biometria from authenticated, anon, service_role;

-- ── 2b) Sondas já usadas — antirreplay ─────────────────────────────────────
-- Nada amarrava a imagem capturada a um instante ou a uma retirada: um PNG guardado do
-- devtools reassinava depois, em outra retirada, de outra máquina, sem leitor.
--
-- O que isto é, com honestidade: um DETECTOR do replay literal, não um controle
-- criptográfico. Reencodar a imagem muda o hash e o SourceAFIS ainda casa. Prender de
-- verdade exigiria canal assinado do leitor, que o WebSdk da DigitalPersona não oferece.
-- Eleva o custo de "colar o payload" para "reprocessar a imagem", e deixa trilha.
create table if not exists public.equip_biometria_sondas (
  sonda_sha256   text primary key,
  id_colaborador text not null,
  id_entrega     text,
  papel          text,
  usado_em       timestamptz not null default now()
);
alter table public.equip_biometria_sondas enable row level security;
revoke all on public.equip_biometria_sondas from authenticated, anon, service_role;

-- ── 3) Validador fixo da unidade — em tabela PRÓPRIA, com guarda própria ───
-- Achado do revisor (V3): esta migration tinha posto este ponteiro dentro de `unidades`, que é
-- cadastro básico com CRUD aberto por desenho (`unidades_rw ALL USING caller_pode_editar()`,
-- sem recorte de unidade, e `useUnidades.ts` cria/renomeia/exclui direto do navegador).
-- Resultado: qualquer Técnico de qualquer base reescrevia quem valida nas 7 unidades,
-- apontava o `valida` para si e assinava dois papéis — a separação de funções, que é o
-- motivo inteiro do terceiro papel, caía numa chamada. E sem registro de quem trocou.
--
-- Campo de controle de segurança não mora em tabela de cadastro. Aqui: escrita só por
-- RPC de admin, e quem trocou fica gravado.
alter table public.unidades drop column if exists id_validador_biometrico;

create table if not exists public.equip_validador_unidade (
  id_unidade     text primary key references public.unidades(id_unidade) on delete cascade,
  id_colaborador text not null references public.colaboradores_chabra(id_colaborador) on delete restrict,
  definido_por   text,
  definido_em    timestamptz not null default now()
);

alter table public.equip_validador_unidade enable row level security;
revoke all on public.equip_validador_unidade from authenticated, anon, service_role;
-- leitura sim (a tela precisa mostrar quem valida); escrita só pela RPC abaixo
grant select on public.equip_validador_unidade to authenticated;
drop policy if exists equip_validador_unidade_sel on public.equip_validador_unidade;
create policy equip_validador_unidade_sel on public.equip_validador_unidade
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
  );

create or replace function public.equip_definir_validador(
  p_id_unidade text, p_id_colaborador text
) returns void
language plpgsql security definer set search_path = public as $fn$
declare v_unidade_colab text; v_tem_bio boolean;
begin
  if not public.caller_eh_admin() then
    raise exception 'Só um administrador define quem valida as retiradas da base.';
  end if;
  select id_unidade into v_unidade_colab from colaboradores_chabra where id_colaborador = p_id_colaborador;
  if v_unidade_colab is null then raise exception 'Colaborador não encontrado.'; end if;
  if v_unidade_colab <> p_id_unidade then
    raise exception 'O validador precisa ser da própria base.';
  end if;
  select exists(select 1 from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador)
    into v_tem_bio;
  if not v_tem_bio then raise exception 'O validador precisa ter digital cadastrada.'; end if;

  insert into equip_validador_unidade (id_unidade, id_colaborador, definido_por)
  values (p_id_unidade, p_id_colaborador, auth.jwt() ->> 'email')
  on conflict (id_unidade) do update
    set id_colaborador = excluded.id_colaborador,
        definido_por = excluded.definido_por,
        definido_em = now();
end $fn$;

-- ── 4) Papel, score e verificação nas assinaturas de entrega ───────────────
alter table public.equipamentos_entrega_assinaturas
  add column if not exists papel             text not null default 'recebe',
  add column if not exists match_score       numeric,
  add column if not exists finger_verificado boolean,
  -- B2 — o hash do CONTEÚDO da retirada no instante da assinatura, calculado pelo
  -- servidor. `pdf_sha256` vinha do corpo da requisição: o próprio signatário escolhia
  -- o valor (aceitou `HASH-QUE-EU-INVENTEI` no ensaio), nunca era lido de volta, e o
  -- hash impresso no rodapé era outro — calculado na hora da impressão. O termo afirma
  -- em letra impressa que a validade decorre desse hash.
  add column if not exists conteudo_sha256   text;

do $ck$ begin
  alter table public.equipamentos_entrega_assinaturas
    add constraint equip_assin_papel_ck check (papel in ('envia','recebe','valida'));
exception when duplicate_object then null;
end $ck$;

-- ── 4b) A TABELA DE ASSINATURAS PARA DE ACEITAR ESCRITA DIRETA ─────────────
-- Achado do revisor-seguranca, e era o buraco de verdade: `authenticated` tinha
-- `insert` na tabela, e a policy de INSERT da v166 só restringia perfil e unidade —
-- nada restringia `metodo`, `finger_verificado` nem `match_score`. Ou seja, esta migration
-- estaria criando as colunas da PROVA biométrica numa tabela onde qualquer editor da
-- base insere a linha que quiser pelo PostgREST, sem dedo, sem template e sem
-- `service_role`. Medido: a RLS deixava passar; quem barrava era só a FK.
--
-- Revogar não quebra nada: as duas gravações são RPC `security definer` com owner
-- `chabra_admin`, que atravessa ACL e RLS. Nenhum call site escreve aqui — as duas
-- referências no código são leitura.
revoke insert, update, delete on public.equipamentos_entrega_assinaturas from authenticated, anon;
drop policy if exists equipamentos_entrega_assinaturas_ins on public.equipamentos_entrega_assinaturas;

-- ── 4c) Teto de tentativas ────────────────────────────────────────────────
-- Comparador 1:1 que devolve score e aceita tentativas infinitas é hill-climbing de
-- manual. O registro também serve de trilha: quem tentou assinar por quem, e quando.
create table if not exists public.equip_biometria_tentativas (
  id_tentativa   bigserial primary key,
  email_chamador text not null,
  id_colaborador text not null,
  id_entrega     text,
  papel          text,
  resultado      text not null check (resultado in ('match','sem_match','erro')),
  score          numeric,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_equip_bio_tent on public.equip_biometria_tentativas (email_chamador, id_colaborador, criado_em desc);
alter table public.equip_biometria_tentativas enable row level security;
revoke all on public.equip_biometria_tentativas from authenticated, anon, service_role;
revoke all on sequence public.equip_biometria_tentativas_id_tentativa_seq from authenticated, anon, service_role;

create or replace function public.equip_bio_tentativas_recentes(
  p_email text, p_id_colaborador text, p_minutos int default 10
) returns integer
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.caller_eh_servico() then raise exception 'Somente o servidor.'; end if;
  return (select count(*) from equip_biometria_tentativas
           where email_chamador = p_email and id_colaborador = p_id_colaborador
             and criado_em > now() - make_interval(mins => greatest(p_minutos, 1)));
end $fn$;

create or replace function public.equip_bio_registrar_tentativa(
  p_email text, p_id_colaborador text, p_id_entrega text, p_papel text,
  p_resultado text, p_score numeric default null
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.caller_eh_servico() then raise exception 'Somente o servidor.'; end if;
  insert into equip_biometria_tentativas
    (email_chamador, id_colaborador, id_entrega, papel, resultado, score)
  values (p_email, p_id_colaborador, p_id_entrega, p_papel, p_resultado, p_score);
end $fn$;

-- ── 4c-bis) O teto, sem corrida ───────────────────────────────────────────
-- R-a: a rota lia o contador, chamava o matcher e só então gravava. N requisições
-- em paralelo liam 0 e passavam todas — e como a resposta devolve `score` mesmo sem
-- match, o oráculo de hill-climbing que o teto existia para fechar seguia aberto.
--
-- Aqui contar e reservar acontecem sob a mesma trava, na mesma transação. A reserva
-- JÁ é a linha da tentativa: o resultado depois atualiza a linha, em vez de inserir
-- outra (senão cada verificação gastaria duas do teto).
create or replace function public.equip_bio_reservar_tentativa(
  p_email text, p_id_colaborador text, p_minutos int default 10, p_limite int default 5
) returns bigint
language plpgsql security definer set search_path = public as $fn$
declare v_qtd int; v_id bigint;
begin
  if not public.caller_eh_servico() then raise exception 'Somente o servidor.'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(p_email,'') || '|' || coalesce(p_id_colaborador,'')));
  select count(*) into v_qtd from equip_biometria_tentativas
   where email_chamador = p_email and id_colaborador = p_id_colaborador
     and criado_em > now() - make_interval(mins => greatest(p_minutos, 1));
  if v_qtd >= greatest(p_limite, 1) then
    raise exception 'Tentativas demais em pouco tempo. Espere alguns minutos.';
  end if;
  insert into equip_biometria_tentativas (email_chamador, id_colaborador, resultado)
  values (p_email, p_id_colaborador, 'erro')
  returning id_tentativa into v_id;
  return v_id;
end $fn$;

create or replace function public.equip_bio_fechar_tentativa(
  p_id_tentativa bigint, p_resultado text, p_score numeric default null,
  p_id_entrega text default null, p_papel text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.caller_eh_servico() then raise exception 'Somente o servidor.'; end if;
  update equip_biometria_tentativas
     set resultado = p_resultado, score = p_score,
         id_entrega = coalesce(p_id_entrega, id_entrega),
         papel = coalesce(p_papel, papel)
   where id_tentativa = p_id_tentativa;
end $fn$;

-- É ISTO que substitui a regra "uma assinatura por entrega" da v166: uma por PAPEL.
create unique index if not exists uniq_equip_assin_entrega_papel
  on public.equipamentos_entrega_assinaturas (id_entrega, papel);

-- ── 4d) O que, exatamente, a pessoa assinou ────────────────────────────────
-- Hash canônico do CONTEÚDO da retirada: os campos do termo e os itens, em ordem
-- estável. Calculado no servidor no ato da assinatura e recalculado na impressão.
--
-- Fecha dois achados de uma vez:
--   B2 — a assinatura passa a estar presa a uma versão do documento.
--   F3 — item pode ser ACRESCENTADO a uma entrega já assinada (medido: `insert` de
--        "Notebook Dell i7 32GB" numa entrega assinada devolveu INSERT 0 1). Não
--        falsifica a digital: a pessoa encostou o dedo. Falsifica *o que* ela assinou.
--        Agora o termo denuncia — o hash recalculado deixa de bater e a impressão
--        para de afirmar "digital verificada".
create or replace function public.equip_hash_conteudo_entrega(p_id_entrega text)
returns text
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare v_unidade text;
begin
  -- `definer` concedida a `authenticated` sem checar acesso seria oráculo de existência
  -- de retirada de outra base — a mesma classe de defeito que esta migration corrige
  -- em outros três lugares. O recorte é o mesmo da policy de SELECT das entregas.
  select id_unidade into v_unidade from equipamentos_entregas where id_entrega = p_id_entrega;
  if v_unidade is null then return null; end if;
  if not (public.caller_eh_servico()
          or public.caller_eh_admin()
          or (public.caller_pode_equipamentos() and v_unidade = any(public.caller_unidades()))) then
    raise exception 'Base fora do seu acesso.';
  end if;

  return encode(digest(
    coalesce((
      select e.id_entrega || '|' || e.id_unidade || '|' || e.id_colaborador
             || '|' || e.data_entrega::text
             || '|' || coalesce(e.responsavel_entrega, '')
             || '|' || coalesce(e.observacao, '')
             || '|' || e.status
        from equipamentos_entregas e
       where e.id_entrega = p_id_entrega
    ), '')
    || '#' ||
    coalesce((
      select string_agg(
               i.id_item || ':' || coalesce(i.nome_equipamento, '')
               || ':' || coalesce(i.numero_serie, '')
               || ':' || coalesce(i.numero_patrimonio, '')
               || ':' || i.quantidade::text,
               '|' order by i.id_item)
        from equipamentos_entregas_itens i
       where i.id_entrega = p_id_entrega
    ), ''),
  'sha256'), 'hex');
end $fn$;

-- ── 5) Quem é o chamador ───────────────────────────────────────────────────
create or replace function public.caller_eh_servico() returns boolean
language sql stable set search_path = public as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', ''
  ) = 'service_role';
$fn$;

-- ── 6) Cadastro da digital ─────────────────────────────────────────────────
create or replace function public.equip_cadastrar_biometria(
  p_id_colaborador text,
  p_template       text,
  p_consentimento  boolean,
  p_dedo           text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_unidade text;
  v_key     text := public.epi_bio_key();
  v_email   text := auth.jwt() ->> 'email';
  v_hashes  text[];
begin
  if not (public.caller_pode_editar() and public.caller_pode_equipamentos()) then
    raise exception 'Sem permissão para cadastrar biometria.';
  end if;

  select id_unidade into v_unidade from colaboradores_chabra where id_colaborador = p_id_colaborador;
  if not found then raise exception 'Colaborador não encontrado.'; end if;
  if not (public.caller_eh_admin() or v_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if not coalesce(p_consentimento, false) then
    raise exception 'Consentimento biométrico é obrigatório.';
  end if;
  if coalesce(btrim(p_template), '') = '' then raise exception 'Template biométrico vazio.'; end if;
  -- V1 — CADASTRO SÓ POR ADMIN, inclusive o primeiro. Decisão do operador em 27/08.
  -- O achado: exigir só `caller_pode_editar()` não exige nada de quem está sendo
  -- cadastrado. Um Técnico escolhia um colega sem digital, encostava o PRÓPRIO dedo três
  -- vezes e passava a assinar por ele — com score alto e `finger_verificado=true`,
  -- genuíno, do dedo errado. A guarda anterior só cobria a SUBSTITUIÇÃO, e como não há
  -- ninguém cadastrado hoje, todo cadastro que vai existir é um "primeiro".
  -- Admin não prova presença; reduz a população que pode forjar de todos os Técnicos das
  -- 7 bases para as poucas contas Admin, e deixa nome e hora em `cadastrado_por`.
  if not public.caller_eh_admin() then
    raise exception 'Só um administrador cadastra digital. Chame quem tem perfil Admin.';
  end if;
  if v_key is null then
    raise exception 'Chave de biometria não configurada (app.epi_bio_key).';
  end if;

  -- B3 — hash de cada amostra, para poder recusá-la depois como sonda.
  -- Falha de parse não pode virar cadastro sem proteção: aqui, template que não é
  -- array JSON de strings é rejeitado, não aceito com `v_hashes` nulo.
  begin
    select array_agg(encode(digest(x.valor, 'sha256'), 'hex'))
      into v_hashes
      from json_array_elements_text(p_template::json) as x(valor);
  exception when others then
    raise exception 'Template biométrico não é um array JSON de amostras.';
  end;
  if v_hashes is null or array_length(v_hashes, 1) is null then
    raise exception 'Template biométrico sem amostras.';
  end if;

  insert into colaboradores_chabra_biometria
    (id_colaborador, id_unidade, template, dedo, consentimento_em, cadastrado_por,
     amostras_sha256)
  values
    (p_id_colaborador, v_unidade,
     encode(pgp_sym_encrypt(p_template, v_key), 'base64'),
     nullif(btrim(p_dedo), ''), now(), v_email, v_hashes)
  on conflict (id_colaborador) do update
    set template = excluded.template,
        dedo = excluded.dedo,
        consentimento_em = excluded.consentimento_em,
        cadastrado_em = now(),
        cadastrado_por = excluded.cadastrado_por,
        amostras_sha256 = excluded.amostras_sha256;

  update colaboradores_chabra
     set biometria_em = now(), biometria_dedo = nullif(btrim(p_dedo), ''), updated_at = now()
   where id_colaborador = p_id_colaborador;
end $fn$;

-- ── 7) Leitura do template (para o matcher comparar) ───────────────────────
-- O servidor chama com token de serviço; a tela de cadastro nunca precisa disto.
create or replace function public.equip_obter_biometria(p_id_colaborador text)
returns text
language plpgsql security definer set search_path = public, extensions as $fn$
declare v_unidade text; v_enc text; v_key text := public.epi_bio_key();
begin
  if not (public.caller_eh_servico()
          or (public.caller_pode_editar() and public.caller_pode_equipamentos())) then
    raise exception 'Sem permissão.';
  end if;

  select b.id_unidade, b.template into v_unidade, v_enc
    from colaboradores_chabra_biometria b where b.id_colaborador = p_id_colaborador;
  if not found then return null; end if;

  if not public.caller_eh_servico()
     and not (public.caller_eh_admin() or v_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if v_key is null then raise exception 'Chave de biometria não configurada.'; end if;

  return pgp_sym_decrypt(decode(v_enc, 'base64'), v_key);
end $fn$;

-- ── 8) Assinatura por DESENHO, agora com papel ─────────────────────────────
-- A v166 tinha 6 argumentos, proibia a segunda assinatura e exigia PNG sempre.
-- Ninguém a chamava (conferido no repo), então é substituída, não versionada.
drop function if exists public.equipamento_assinar_entrega(text, text, text, text, text, boolean);

create or replace function public.equipamento_assinar_entrega(
  p_id_entrega     text,
  p_papel          text,
  p_assinante_nome text,
  p_assinatura_png text,
  p_pdf_sha256     text,
  p_user_agent     text,
  p_consentimento  boolean default false
) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_email   text := auth.jwt() ->> 'email';
  v_unidade text; v_colab text; v_ip text;
  v_id      text := gen_random_uuid()::text;
  v_papel   text := coalesce(nullif(btrim(p_papel), ''), 'recebe');
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para assinar.'; end if;
  if v_papel not in ('envia','recebe','valida') then
    raise exception 'Papel inválido: %. Use envia, recebe ou valida.', v_papel;
  end if;

  select id_unidade, id_colaborador into v_unidade, v_colab
    from equipamentos_entregas where id_entrega = p_id_entrega;
  if not found then raise exception 'Entrega não encontrada.'; end if;
  if not (public.caller_eh_admin() or v_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if coalesce(btrim(p_assinatura_png), '') = '' then raise exception 'Assinatura em branco.'; end if;
  if not coalesce(p_consentimento, false) then
    raise exception 'É necessário o consentimento de quem assina.';
  end if;
  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega and papel = v_papel) then
    raise exception 'O papel "%" já foi assinado nesta entrega.', v_papel;
  end if;

  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json ->> 'x-real-ip');
  exception when others then v_ip := null;
  end;

  insert into equipamentos_entrega_assinaturas
    (id_assinatura, id_entrega, id_unidade, id_colaborador, assinante_nome, papel, metodo,
     assinatura_png, pdf_sha256, user_agent, ip, consentimento_em, criado_por)
  values
    (v_id, p_id_entrega, v_unidade, v_colab,
     coalesce(nullif(btrim(p_assinante_nome), ''),
              (select nome from colaboradores_chabra where id_colaborador = v_colab)),
     v_papel, 'canvas', p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip, now(), v_email);

  return v_id;
end $fn$;

-- ── 9) Assinatura DIGITAL — só o servidor grava ────────────────────────────
-- Separada de propósito: o score e o `finger_verificado` vêm do matcher, e o cliente
-- não pode inventá-los. Por isso esta função NÃO é concedida a `authenticated`.
-- A assinatura de 9 argumentos SAI. `create or replace` com lista nova criaria uma
-- SOBRECARGA e deixaria a antiga viva — concedida a `service_role`, aceitando
-- `p_pdf_sha256` do cliente e sem nenhuma das guardas abaixo.
drop function if exists public.equipamento_assinar_entrega_digital(
  text, text, text, text, text, text, text, numeric, text);

create or replace function public.equipamento_assinar_entrega_digital(
  p_id_entrega     text,
  p_papel          text,
  p_id_colaborador text,
  p_assinante_nome text,
  p_conteudo_hash  text,   -- o que o cliente ACHA que está assinando (conferido, não gravado)
  p_user_agent     text,
  p_ip             text,
  p_match_score    numeric,
  p_threshold      numeric,
  p_sonda_sha256   text,
  p_criado_por     text
) returns text
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_unidade text; v_unidade_colab text; v_colab_entrega text;
  v_id text := gen_random_uuid()::text;
  v_papel text := coalesce(nullif(btrim(p_papel), ''), 'recebe');
  v_hash_real text;
  v_consent timestamptz;
  v_amostras text[];
begin
  if not public.caller_eh_servico() then
    raise exception 'Assinatura digital só pode ser gravada pelo servidor.';
  end if;
  if v_papel not in ('envia','recebe','valida') then
    raise exception 'Papel inválido: %.', v_papel;
  end if;
  if p_match_score is null then
    raise exception 'Score ausente — sem comparação, sem assinatura.';
  end if;
  -- R-b — a rota confiava no booleano `match` do matcher e nunca comparava o score
  -- com o limiar. Aqui é o lado que grava: confere de novo, com o limiar explícito.
  if p_threshold is null then
    raise exception 'Limiar ausente — score sem limiar não afirma nada.';
  end if;
  if p_match_score < p_threshold then
    raise exception 'Score % abaixo do limiar %.', p_match_score, p_threshold;
  end if;
  if coalesce(btrim(p_sonda_sha256), '') = '' then
    raise exception 'Leitura sem identificação — sonda não registrada.';
  end if;

  select id_unidade, id_colaborador into v_unidade, v_colab_entrega
    from equipamentos_entregas where id_entrega = p_id_entrega;
  if not found then raise exception 'Entrega não encontrada.'; end if;

  -- Roda como definer e sem RLS: não pode confiar no escopo que a rota conferiu.
  -- Reconfere aqui, que é onde a linha de fato entra.
  select id_unidade into v_unidade_colab
    from colaboradores_chabra where id_colaborador = p_id_colaborador;
  if v_unidade_colab is null then raise exception 'Colaborador não encontrado.'; end if;
  if v_unidade_colab <> v_unidade then
    raise exception 'Quem assina precisa ser da mesma base da retirada.';
  end if;
  if v_papel = 'recebe' and p_id_colaborador is distinct from v_colab_entrega then
    raise exception 'No papel "recebe" quem assina é o colaborador da própria retirada.';
  end if;

  -- ── B1 — SEPARAÇÃO DE FUNÇÕES ────────────────────────────────────────────
  -- Achado do revisor: no papel `envia` a única guarda era ser da mesma base. Nada
  -- impedia escolher a PRÓPRIA pessoa que recebe — e a tela lista o recebedor no
  -- seletor "Quem está entregando…". Demonstrado no ensaio: uma colaboradora ocupando
  -- os três papéis, três "digital verificada" no mesmo termo, sem devtools.
  --
  -- A correção anterior (V3) fechou "apontar o `valida` para si". A separação de
  -- funções, que é a razão inteira de existirem três papéis, caía pela porta ao lado.
  -- As três pessoas precisam ser distintas, duas a duas.
  if v_papel = 'envia' and p_id_colaborador = v_colab_entrega then
    raise exception 'Quem entrega não pode ser quem recebe — são papéis separados de propósito.';
  end if;
  if v_papel = 'valida' and p_id_colaborador = v_colab_entrega then
    raise exception 'Quem valida não pode ser quem recebe. Esta base precisa de outro validador.';
  end if;
  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega
                and id_colaborador = p_id_colaborador
                and papel <> v_papel) then
    raise exception 'Esta pessoa já assinou outro papel nesta retirada.';
  end if;

  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega and papel = v_papel) then
    raise exception 'O papel "%" já foi assinado nesta entrega.', v_papel;
  end if;

  -- ── B3 — antirreplay ─────────────────────────────────────────────────────
  -- (a) a sonda não pode ser uma das amostras de cadastro: imagem contra si mesma dá
  --     score máximo por construção, e quem cadastra sai com elas no navegador;
  -- (b) nenhuma leitura assina duas vezes.
  select amostras_sha256 into v_amostras
    from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador;
  if v_amostras is not null and p_sonda_sha256 = any(v_amostras) then
    raise exception 'A leitura enviada é idêntica a uma amostra de cadastro. Capture o dedo agora.';
  end if;
  if exists (select 1 from equip_biometria_sondas where sonda_sha256 = p_sonda_sha256) then
    raise exception 'Esta leitura já foi usada em outra assinatura. Capture o dedo agora.';
  end if;

  -- ── B2 — o hash do conteúdo é do SERVIDOR ────────────────────────────────
  -- `p_conteudo_hash` é só o que o cliente achava estar assinando: serve para pegar a
  -- corrida (alguém editou a retirada enquanto a tela estava aberta). O que fica
  -- gravado é sempre o hash recalculado aqui.
  v_hash_real := public.equip_hash_conteudo_entrega(p_id_entrega);
  if nullif(btrim(coalesce(p_conteudo_hash, '')), '') is not null
     and p_conteudo_hash <> v_hash_real then
    raise exception 'A retirada mudou enquanto você assinava. Reabra e confira antes de assinar.';
  end if;

  -- ── B4 — consentimento é o do CADASTRO, não um literal ───────────────────
  -- A tela de assinatura mandava `consentimento: true` fixo (não existe caixa lá) e o
  -- banco carimbava `now()`. Registrar consentimento que ninguém coletou, em documento
  -- trabalhista com dado pessoal sensível, é pior que não registrar. O consentimento
  -- real foi dado no cadastro, onde a caixa existe: é esse instante que vale.
  select consentimento_em into v_consent
    from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador;

  insert into equipamentos_entrega_assinaturas
    (id_assinatura, id_entrega, id_unidade, id_colaborador, assinante_nome, papel, metodo,
     assinatura_png, pdf_sha256, conteudo_sha256, user_agent, ip, consentimento_em,
     match_score, finger_verificado, criado_por)
  values
    (v_id, p_id_entrega, v_unidade, p_id_colaborador,
     coalesce(nullif(btrim(p_assinante_nome), ''),
              (select nome from colaboradores_chabra where id_colaborador = p_id_colaborador)),
     v_papel, 'digital', null, null, v_hash_real, p_user_agent, p_ip, v_consent,
     p_match_score, true, p_criado_por);

  insert into equip_biometria_sondas (sonda_sha256, id_colaborador, id_entrega, papel)
  values (p_sonda_sha256, p_id_colaborador, p_id_entrega, v_papel);

  return v_id;
end $fn$;

-- ── 10) Grants ─────────────────────────────────────────────────────────────
grant execute on function public.caller_eh_servico() to authenticated, service_role;
grant execute on function public.equip_cadastrar_biometria(text, text, boolean, text) to authenticated;
-- NAO conceder a `authenticated`. Esta funcao e `security definer` e devolve o
-- template DECIFRADO: conceder a ela seria abrir, ao lado da tabela trancada, uma
-- porta que entrega em texto claro exatamente para a populacao que a tranca exclui
-- (qualquer editor com o modulo equipamentos, direto do navegador via PostgREST).
-- E o template lido vira `sonda` valida: replay que grava `finger_verificado=true`
-- sem dedo nenhum. Achado do portao antes do push; medido por has_function_privilege.
revoke all on function public.equip_obter_biometria(text) from public, anon, authenticated;
grant execute on function public.equip_obter_biometria(text) to service_role;
-- V2 — NÃO conceder ao navegador. Esta função é `security definer`: atravessa o
-- `revoke insert` acima e a RLS. Ela aceita `assinante_nome` de texto livre, não confere
-- identidade nenhuma, e com o `p_papel` que esta migration acrescentou passaria a ocupar
-- os TRÊS slots — três chamadas deixariam a retirada permanentemente incapaz de receber
-- assinatura biométrica, sem caminho de desfazer para quem não é admin.
-- Nenhum código a chama (varredura na raiz + as 20 edge functions: zero). Fica sem
-- concessão: só o owner alcança, até existir um desenho de fallback que se justifique.
revoke all on function public.equipamento_assinar_entrega(text, text, text, text, text, text, boolean) from public, anon, authenticated;

-- R1 — o default ACL desta base concede EXECUTE a PUBLIC e `anon` em toda função nova.
-- Revogar explicitamente é obrigatório, não higiene.
revoke all on function public.equip_cadastrar_biometria(text, text, boolean, text) from public, anon;
revoke all on function public.equip_definir_validador(text, text) from public, anon;
grant execute on function public.equip_definir_validador(text, text) to authenticated;

-- A digital é do servidor. Revoga de public/authenticated ANTES de conceder ao serviço,
-- porque `execute` em função nasce liberado para PUBLIC.
revoke all on function public.equipamento_assinar_entrega_digital(text, text, text, text, text, text, text, numeric, numeric, text, text) from public, anon, authenticated;
grant execute on function public.equipamento_assinar_entrega_digital(text, text, text, text, text, text, text, numeric, numeric, text, text) to service_role;

revoke all on function public.equip_bio_tentativas_recentes(text, text, int) from public, anon, authenticated;
grant execute on function public.equip_bio_tentativas_recentes(text, text, int) to service_role;
revoke all on function public.equip_bio_registrar_tentativa(text, text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.equip_bio_registrar_tentativa(text, text, text, text, text, numeric) to service_role;

revoke all on function public.equip_bio_reservar_tentativa(text, text, int, int) from public, anon, authenticated;
grant execute on function public.equip_bio_reservar_tentativa(text, text, int, int) to service_role;
revoke all on function public.equip_bio_fechar_tentativa(bigint, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.equip_bio_fechar_tentativa(bigint, text, numeric, text, text) to service_role;

-- O hash do conteúdo: leitura para o navegador (a tela precisa saber se o termo mudou
-- depois de assinado). É `definer` porque atravessa a RLS dos itens, mas só devolve um
-- hash — nunca conteúdo. Sem grant a `anon`.
revoke all on function public.equip_hash_conteudo_entrega(text) from public, anon;
grant execute on function public.equip_hash_conteudo_entrega(text) to authenticated, service_role;

-- ── F1 — a chave do cofre deixa de ser pública ─────────────────────────────
-- Medido pelo revisor, em produção: has_function_privilege('authenticated',
-- 'public.epi_bio_key()', 'execute') = t, e para `anon` também. É a chave que cifra
-- `colaboradores_chabra_biometria.template` — qualquer portador da publishable key a
-- lia, inclusive sem login, e a propriedade "cifrado" da LGPD Art. 11 ficava nominal.
--
-- Seguro porque: nenhum `.ts`/`.tsx` chama (varredura completa, zero acertos), e todos
-- os chamadores reais (`equip_cadastrar_biometria`, `equip_obter_biometria`, a família
-- `epi_*`) são `security definer` do `chabra_admin`, que executa com o ACL do owner.
revoke execute on function public.epi_bio_key() from public, anon, authenticated;
