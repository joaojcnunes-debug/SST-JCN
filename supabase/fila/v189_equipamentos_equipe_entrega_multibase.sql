-- v189 — Equipamentos: equipe de entrega multi-base.
--
-- Reconferir o número imediatamente antes de aplicar. Esta família de migrations já foi
-- renumerada duas vezes porque o alvo se move enquanto a branch espera.
--
-- ── Por que esta migration existe ────────────────────────────────────────────
-- A v188 exigia (a) quem assina ser da MESMA BASE da retirada e (b) os três papéis serem
-- três pessoas DISTINTAS. As duas regras bateram na operação real no primeiro teste:
-- a entrega de equipamento é feita só pela equipe de TI, que atende as 7 bases e é a
-- mesma equipe que entrega e valida.
--
-- Medido no log de produção, 31/08 13:21:29 — papel `valida`, Leandro Salles,
-- score 183,14, resultado `erro`: a digital conferiu e a guarda recusou, porque ele já
-- assinara `envia` na mesma retirada.
--
-- ── O que se perde, escrito para quem ler o termo depois ─────────────────────
-- O termo deixa de provar que DUAS pessoas diferentes participaram do lado da TI.
-- Continua provando: quem recebe não assina nenhum outro papel; toda assinatura é
-- digital real conferida no servidor contra template cifrado; e cada uma fica presa à
-- versão do documento por `conteudo_sha256`. Com equipe de quatro, separação de funções
-- dentro da TI não era sustentável — e regra que a operação não consegue cumprir vira
-- regra contornada, que é pior que regra ausente.
--
-- ── Unidade não some: muda de papel ──────────────────────────────────────────
-- Deixa de ser fronteira de QUEM ASSINA e segue sendo a CATEGORIZAÇÃO do documento.
-- `equipamentos_entregas.id_unidade` é copiado para a linha da assinatura, então a
-- rastreabilidade por base continua inteira — é dela que sai "qual unidade recebeu o
-- quê, e quem entregou".

-- ── 1) A equipe de entrega ──────────────────────────────────────────────────
-- Tabela própria, não uma flag em `colaboradores_chabra`: campo de controle de
-- segurança não mora em tabela de cadastro com CRUD aberto — foi exatamente o achado V3
-- do revisor na v188, quando o ponteiro do validador estava dentro de `unidades`.
create table if not exists public.equip_equipe_entrega (
  id_colaborador text primary key
                   references public.colaboradores_chabra(id_colaborador) on delete cascade,
  definido_por   text,
  definido_em    timestamptz not null default now()
);

alter table public.equip_equipe_entrega enable row level security;
revoke all on public.equip_equipe_entrega from authenticated, anon, service_role;
-- Leitura sim (a tela precisa listar quem pode assinar); escrita só pela RPC de admin.
grant select on public.equip_equipe_entrega to authenticated;
drop policy if exists equip_equipe_entrega_sel on public.equip_equipe_entrega;
create policy equip_equipe_entrega_sel on public.equip_equipe_entrega
  for select to authenticated using (
    public.caller_eh_admin() or public.caller_pode_equipamentos()
  );
-- SEM recorte de unidade nesta policy, de propósito: a equipe é justamente
-- cross-base. Recortar aqui esconderia da tela o colega de outra unidade que vai
-- assinar, e a tela ficaria oferecendo uma lista que o banco aceita e ela não mostra.

create or replace function public.equip_definir_equipe_entrega(
  p_id_colaborador text, p_incluir boolean
) returns void
language plpgsql security definer set search_path = public as $fn$
declare v_existe boolean;
begin
  if not public.caller_eh_admin() then
    raise exception 'Só um administrador define quem entrega e valida equipamentos.';
  end if;
  select exists(select 1 from colaboradores_chabra where id_colaborador = p_id_colaborador)
    into v_existe;
  if not v_existe then raise exception 'Colaborador não encontrado.'; end if;

  if coalesce(p_incluir, false) then
    -- Entrar na equipe sem digital cadastrada seria entrar numa lista que não consegue
    -- assinar: o erro apareceria só na hora da entrega, com a pessoa na frente.
    if not exists (select 1 from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador) then
      raise exception 'Cadastre a digital desta pessoa antes de incluí-la na equipe de entrega.';
    end if;
    insert into equip_equipe_entrega (id_colaborador, definido_por)
    values (p_id_colaborador, auth.jwt() ->> 'email')
    on conflict (id_colaborador) do update
      set definido_por = excluded.definido_por, definido_em = now();
  else
    delete from equip_equipe_entrega where id_colaborador = p_id_colaborador;
  end if;
end $fn$;

-- A tela precisa dos NOMES da equipe, e `colaboradores_chabra` é recortada por unidade:
-- um Técnico de uma base não enxergaria o colega de TI de outra. Esta função devolve o
-- mínimo — id, nome e se tem digital — para quem já tem o módulo equipamentos.
create or replace function public.equip_equipe_entrega_listar()
returns table (id_colaborador text, nome text, tem_digital boolean)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not (public.caller_eh_admin() or public.caller_pode_equipamentos()) then
    raise exception 'Sem permissão.';
  end if;
  return query
    select e.id_colaborador, c.nome,
           exists(select 1 from colaboradores_chabra_biometria b
                   where b.id_colaborador = e.id_colaborador)
      from equip_equipe_entrega e
      join colaboradores_chabra c on c.id_colaborador = e.id_colaborador
     where c.ativo
     order by c.nome;
end $fn$;

-- ── 2) A regra de quem pode assinar cada papel ──────────────────────────────
-- Mesma assinatura de 11 argumentos da v188: `create or replace` substitui no lugar,
-- sem criar sobrecarga e sem precisar remexer nos grants.
create or replace function public.equipamento_assinar_entrega_digital(
  p_id_entrega     text,
  p_papel          text,
  p_id_colaborador text,
  p_assinante_nome text,
  p_conteudo_hash  text,
  p_user_agent     text,
  p_ip             text,
  p_match_score    numeric,
  p_threshold      numeric,
  p_sonda_sha256   text,
  p_criado_por     text
) returns text
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_unidade text; v_colab_entrega text;
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

  if not exists (select 1 from colaboradores_chabra where id_colaborador = p_id_colaborador) then
    raise exception 'Colaborador não encontrado.';
  end if;

  -- ── Quem pode assinar o quê ───────────────────────────────────────────────
  if v_papel = 'recebe' then
    -- Inalterado: quem recebe é o colaborador da própria retirada. A base vem junto
    -- por construção, então não há checagem de unidade a fazer aqui.
    if p_id_colaborador is distinct from v_colab_entrega then
      raise exception 'No papel "recebe" quem assina é o colaborador da própria retirada.';
    end if;
  else
    -- `envia` e `valida`: a EQUIPE DE ENTREGA, em QUALQUER base.
    -- A checagem de mesma-base saiu daqui de propósito — era ela que impedia a TI de
    -- assinar a retirada de outra unidade, que é o trabalho que a TI faz.
    -- `ativo` faz parte da guarda, não é enfeite: a FK cascateia em DELETE, não em
    -- desativação. Sem isto, quem sai da empresa continua na equipe e continua assinando
    -- — e a tela esconderia (o `_listar` filtra `ativo`) enquanto o banco aceitaria.
    -- Tela e banco discordando é como um buraco vive muito tempo sem ser visto.
    if not exists (select 1 from equip_equipe_entrega e
                     join colaboradores_chabra c on c.id_colaborador = e.id_colaborador
                    where e.id_colaborador = p_id_colaborador and c.ativo) then
      raise exception 'Só a equipe de entrega ativa assina o papel "%".', v_papel;
    end if;
    -- A separação que SOBROU, e é a que importa: quem recebe o equipamento não assina
    -- por nenhum outro papel. `envia` = `valida` passa a ser permitido.
    if p_id_colaborador = v_colab_entrega then
      raise exception 'Quem recebe o equipamento não pode assinar como "%".', v_papel;
    end if;
  end if;

  -- Invariante explícita em vez de deduzida das duas regras acima: se um dia uma delas
  -- mudar, é aqui que o estrago aparece, e não no termo impresso.
  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega
                and id_colaborador = p_id_colaborador
                and papel <> v_papel
                and (papel = 'recebe' or v_papel = 'recebe')) then
    raise exception 'Quem recebe não pode assinar outro papel nesta retirada.';
  end if;

  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega and papel = v_papel) then
    raise exception 'O papel "%" já foi assinado nesta entrega.', v_papel;
  end if;

  -- Antirreplay: inalterado. Note a consequência desejada — quando a MESMA pessoa
  -- assina `envia` e depois `valida`, precisa encostar o dedo de novo. Reusar a leitura
  -- anterior é recusado, e é o controle funcionando, não atrito acidental.
  select amostras_sha256 into v_amostras
    from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador;
  if v_amostras is not null and p_sonda_sha256 = any(v_amostras) then
    raise exception 'A leitura enviada é idêntica a uma amostra de cadastro. Capture o dedo agora.';
  end if;
  if exists (select 1 from equip_biometria_sondas where sonda_sha256 = p_sonda_sha256) then
    raise exception 'Esta leitura já foi usada em outra assinatura. Capture o dedo agora.';
  end if;

  v_hash_real := public.equip_hash_conteudo_entrega(p_id_entrega);
  if nullif(btrim(coalesce(p_conteudo_hash, '')), '') is not null
     and p_conteudo_hash <> v_hash_real then
    raise exception 'A retirada mudou enquanto você assinava. Reabra e confira antes de assinar.';
  end if;

  select consentimento_em into v_consent
    from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador;

  -- `id_unidade` da assinatura é o da RETIRADA, não o do signatário. É isto que mantém
  -- a rastreabilidade por base agora que quem assina pode ser de outra unidade.
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

-- ── 3) Grants ───────────────────────────────────────────────────────────────
-- O default ACL desta base concede EXECUTE a PUBLIC e `anon` em toda função nova.
revoke all on function public.equip_definir_equipe_entrega(text, boolean) from public, anon;
grant execute on function public.equip_definir_equipe_entrega(text, boolean) to authenticated;
revoke all on function public.equip_equipe_entrega_listar() from public, anon;
grant execute on function public.equip_equipe_entrega_listar() to authenticated, service_role;

-- `equipamento_assinar_entrega_digital` foi substituída por `create or replace`, o que
-- PRESERVA o ACL existente — mas repetir o revoke/grant é barato e torna o end-state
-- legível sem precisar consultar a v188.
revoke all on function public.equipamento_assinar_entrega_digital(text, text, text, text, text, text, text, numeric, numeric, text, text) from public, anon, authenticated;
grant execute on function public.equipamento_assinar_entrega_digital(text, text, text, text, text, text, text, numeric, numeric, text, text) to service_role;

-- ── 4) O que NÃO é derrubado, e por quê ─────────────────────────────────────
-- `equip_validador_unidade` e `equip_definir_validador` continuam existindo, sem uso.
-- Derrubá-las tornaria o rollback desta migration mais arriscado que a própria migration
-- (teria de recriar tabela, policy e RPC), e uma tabela de 1 linha sem leitor não faz
-- mal. Fica marcada como superada; a limpeza é ticket próprio.
comment on table public.equip_validador_unidade is
  'SUPERADA pela v189 (equip_equipe_entrega). Sem leitor no código desde 31/08/2026.';
