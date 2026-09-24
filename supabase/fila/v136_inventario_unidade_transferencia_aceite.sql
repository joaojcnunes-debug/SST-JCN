-- v136 — Inventário: unidade como ID (seletor) + transferência com aceite assinado.
--
-- O QUE MUDA
--   1) Regulariza o schema: colunas que existem na PRODUÇÃO mas em nenhuma migration
--      (tipo, categoria, codigo_interno, tag, unidade, setor...). `if not exists` =>
--      em produção não faz nada; conserta o repo para quem restaurar do zero.
--   2) `inventario_maquinas.id_unidade` (FK -> unidades). Fim do texto livre:
--      a tela passa a usar SELETOR. O texto `unidade` continua como espelho legado.
--   3) `transferencias` deixa de ser só um LOG e ganha ESTADO:
--      pendente -> aceita | recusada | cancelada.
--      + destinatário (só ELE aceita), transportador (informativo) e ASSINATURA no aceite.
--   4) Permissão: módulo 'transferencias' em usuarios.modulos_permitidos.
--   5) RLS: SÓ o equipamento interno passa a ser isolado por unidade.
--      Máquinas e medições continuam exatamente como estão hoje.
--
-- Idempotente e transacional: qualquer erro aborta tudo (nada pela metade).

begin;

-- Pré-condições: aborta em vez de criar meia-bagunça.
do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'v136 abortada: tabela public.unidades nao existe';
  end if;
  if to_regproc('public.caller_unidades') is null or to_regproc('public.caller_eh_admin') is null then
    raise exception 'v136 abortada: funcoes de acesso (v75) ausentes';
  end if;
end $$;

-- ── 1) Regulariza o drift (existem na produção, não no versionamento) ────────
alter table public.inventario_maquinas
  add column if not exists tipo               text,
  add column if not exists categoria          text,
  add column if not exists codigo_interno     text,
  add column if not exists tag                text,
  add column if not exists unidade            text,
  add column if not exists setor              text,
  add column if not exists linha_processo     text,
  add column if not exists area               text,
  add column if not exists responsavel_setor  text,
  add column if not exists operacao_executada text;

-- ── 2) A base do equipamento vira ID (seletor, não digitação) ────────────────
alter table public.inventario_maquinas
  add column if not exists id_unidade text references public.unidades(id_unidade) on delete set null;

-- Backfill tolerante a acento e a erros de digitação comuns. Os dados reais
-- mostram "teresopolis" (sem acento) e "GUAPIMRIM" (falta um I) — cada variação
-- vira um silo invisível, que é exatamente o que o seletor vem curar.
create extension if not exists unaccent;
create extension if not exists pg_trgm;

update public.inventario_maquinas m
   set id_unidade = u.id_unidade
  from public.unidades u
 where m.id_unidade is null
   and m.unidade is not null
   and (
     lower(unaccent(btrim(m.unidade))) = lower(unaccent(btrim(u.nome)))          -- acento/caixa
     or similarity(lower(unaccent(m.unidade)), lower(unaccent(u.nome))) > 0.6    -- erro de digitação
   );

create index if not exists idx_inv_maquinas_unidade on public.inventario_maquinas (id_unidade);

-- ── 3) Transferência com estado, destinatário e assinatura ───────────────────
alter table public.transferencias
  -- default 'aceita': as transferências ANTIGAS já aconteceram. Se nascessem
  -- 'pendente', o histórico inteiro viraria fila de trabalho amanhã.
  add column if not exists status text not null default 'aceita',
  add column if not exists de_id_unidade      text references public.unidades(id_unidade),
  add column if not exists para_id_unidade    text references public.unidades(id_unidade),
  -- quem ACEITA (obrigatório) — só este e-mail pode aceitar/recusar
  add column if not exists para_usuario_email text,
  add column if not exists para_usuario_nome  text,
  -- quem LEVA fisicamente (informativo; pode ser a mesma pessoa)
  add column if not exists transportado_por   text,
  -- trilha do desfecho
  add column if not exists aceita_por_email    text,
  add column if not exists aceita_em           timestamptz,
  add column if not exists recusada_por_email  text,
  add column if not exists recusada_em         timestamptz,
  add column if not exists recusada_motivo     text,
  add column if not exists cancelada_por_email text,
  add column if not exists cancelada_em        timestamptz,
  add column if not exists cancelada_motivo    text,
  -- Assinatura eletrônica do aceite — mesmo padrão do EPI (v130/v134):
  -- desenho no canvas + SHA-256 do PDF assinado + IP/user-agent + consentimento.
  -- (Lei 14.063/2020 + MP 2.200-2/2001: o que vale é o hash do DOCUMENTO.)
  add column if not exists assinante_nome   text,
  add column if not exists assinatura_png   text,
  add column if not exists pdf_sha256       text,
  add column if not exists user_agent       text,
  add column if not exists assinatura_ip    text,
  add column if not exists consentimento_em timestamptz,
  add column if not exists assinado_em      timestamptz,
  -- trava leve: avisa "item aberto" quando dois abrem juntos (conforto de UI)
  add column if not exists em_atendimento_por text,
  add column if not exists em_atendimento_em  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transferencias_status_chk') then
    alter table public.transferencias
      add constraint transferencias_status_chk
      check (status in ('pendente','aceita','recusada','cancelada'));
  end if;

  -- Proibições (regras de 2026-07-15), no NÍVEL DO BANCO — a tela não é a única
  -- guardiã. Uma transferência PENDENTE exige: unidade de destino, destinatário,
  -- e destinatário ≠ quem registrou. (Registros 'aceita' antigos ficam isentos.)
  if not exists (select 1 from pg_constraint where conname = 'transferencias_pendente_completa_chk') then
    alter table public.transferencias
      add constraint transferencias_pendente_completa_chk
      check (
        status <> 'pendente' or (
          para_id_unidade    is not null
          and para_usuario_email is not null
          and lower(para_usuario_email) <> lower(coalesce(responsavel_email,''))
        )
      );
  end if;
end $$;

-- Garantia do banco: uma máquina só pode ter UMA transferência pendente.
create unique index if not exists uniq_transf_pendente_maquina
  on public.transferencias (id_maquina) where status = 'pendente';

create index if not exists idx_transf_status_destino
  on public.transferencias (status, para_id_unidade, data_hora desc);

-- ── 4) Permissão: módulo 'transferencias' (checkbox no cadastro de usuário) ──
create or replace function public.caller_pode_transferir()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.caller_eh_admin() or exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo_sistema = true
       and 'transferencias' = any(u.modulos_permitidos)
  );
$$;

-- Dia-zero: preserva EXATAMENTE quem transfere hoje (regra atual = caller_pode_editar).
-- Ninguém perde a função de repente; a partir daqui o operador RESTRINGE pela nova
-- caixinha 'transferencias' no cadastro de usuário.
update public.usuarios
   set modulos_permitidos = array_append(modulos_permitidos, 'transferencias')
 where ativo_sistema
   and pode_editar
   and not ('transferencias' = any(modulos_permitidos));

-- ── 5) RLS do inventário: SÓ o equipamento interno é isolado por unidade ─────
-- Máquinas e medições continuam com a regra de empresa que já existe (v76).
drop policy if exists inventario_maquinas_sel_uni on public.inventario_maquinas;
create policy inventario_maquinas_sel_uni on public.inventario_maquinas
  for select to authenticated using (
    public.caller_eh_admin()
    or (
      public.caller_pode_ver_empresa(id_empresa)
      and (
        coalesce(categoria_inventario, 'maquinas') <> 'equipamentos'  -- máquina/medição: como hoje
        or id_unidade is null                                          -- rampa: sem base = visível
        or id_unidade = any(public.caller_unidades())                  -- equipamento: só a sua base
      )
    )
  );

-- ── 6) RLS das transferências: origem, destino, destinatário ou admin ────────
drop policy if exists "auth read transferencias" on public.transferencias;
drop policy if exists transferencias_sel on public.transferencias;
create policy transferencias_sel on public.transferencias
  for select to authenticated using (
    public.caller_eh_admin()
    or lower(coalesce(para_usuario_email,'')) = lower(auth.jwt() ->> 'email')
    or de_id_unidade   = any(public.caller_unidades())
    or para_id_unidade = any(public.caller_unidades())
    or (de_id_unidade is null and para_id_unidade is null)   -- registros legados
  );

-- Escrita direta: só quem tem o módulo. O aceite/recusa NÃO passa por aqui —
-- vai pelas RPCs abaixo (transacionais), que é o que garante o item único.
drop policy if exists "auth write transferencias" on public.transferencias;
drop policy if exists transferencias_rw on public.transferencias;
create policy transferencias_rw on public.transferencias
  for all to authenticated
  using (public.caller_pode_editar() and public.caller_pode_transferir())
  with check (public.caller_pode_editar() and public.caller_pode_transferir());

-- ── 7) RPCs: abrir / aceitar / recusar / cancelar ────────────────────────────

-- Trava leve: quem abrir depois vê "item aberto por Fulano" (expira em 3 min).
create or replace function public.transferencia_abrir(p_id text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare t public.transferencias; me text := lower(auth.jwt() ->> 'email');
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;

  if t.em_atendimento_por is not null
     and t.em_atendimento_por <> me
     and t.em_atendimento_em > now() - interval '3 minutes' then
    raise exception 'Item aberto por % — finalizando', t.em_atendimento_por;
  end if;

  update public.transferencias
     set em_atendimento_por = me, em_atendimento_em = now()
   where id_transferencia = p_id;
end $$;

-- Aceite: só o destinatário, com assinatura, movendo a máquina numa transação só.
create or replace function public.transferencia_aceitar(
  p_id text,
  p_assinatura_png text,
  p_pdf_sha256 text default null,
  p_user_agent text default null,
  p_ip text default null,
  p_consentimento boolean default false)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  t public.transferencias;
  me text := lower(auth.jwt() ->> 'email');
  v_nome text;
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;   -- trava a linha
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;

  -- Aceita o destinatário escolhido OU um admin (cobre a base que só tem o
  -- próprio técnico cadastrado — decisão de 2026-07-15).
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode aceitar esta transferência';
  end if;
  -- Quem cria nunca é quem aceita — separa transporte de recebimento (vale até para admin).
  if lower(coalesce(t.responsavel_email,'')) = me then
    raise exception 'Quem registrou a transferência não pode aceitá-la — o recebimento deve ser confirmado por outra pessoa';
  end if;
  if coalesce(btrim(p_assinatura_png),'') = '' then
    raise exception 'Assinatura obrigatória para aceitar a transferência';
  end if;
  -- Blindagem: sem unidade de destino, aceitar apagaria a base da máquina
  -- (perda silenciosa). Aborta em vez de mover para "lugar nenhum".
  if t.para_id_unidade is null then
    raise exception 'Transferência sem unidade de destino definida — não pode ser aceita';
  end if;

  select nome into v_nome from public.usuarios where lower(email) = me limit 1;

  -- É AQUI que o equipamento muda de base. Só aqui.
  update public.inventario_maquinas
     set id_unidade        = t.para_id_unidade,
         unidade           = (select nome from public.unidades where id_unidade = t.para_id_unidade),
         localizacao       = coalesce(t.para_localizacao, localizacao),
         responsavel_setor = coalesce(t.para_responsavel, responsavel_setor),
         updated_at        = now()
   where id_maquina = t.id_maquina;

  update public.transferencias
     set status = 'aceita',
         aceita_por_email = me, aceita_em = now(),
         assinante_nome = coalesce(v_nome, t.para_usuario_nome),
         assinatura_png = p_assinatura_png,
         pdf_sha256     = p_pdf_sha256,
         user_agent     = p_user_agent,
         assinatura_ip  = p_ip,
         consentimento_em = case when p_consentimento then now() else null end,
         assinado_em    = now(),
         em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
end $$;

-- Recusa: só o destinatário. A máquina NÃO se move (fica na origem).
create or replace function public.transferencia_recusar(p_id text, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare t public.transferencias; me text := lower(auth.jwt() ->> 'email');
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode recusar esta transferência';
  end if;

  update public.transferencias
     set status = 'recusada', recusada_por_email = me, recusada_em = now(),
         recusada_motivo = p_motivo, em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
end $$;

-- Cancelamento: quem tem o módulo (a origem), só enquanto pendente.
create or replace function public.transferencia_cancelar(p_id text, p_motivo text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare me text := lower(auth.jwt() ->> 'email');
begin
  if not public.caller_pode_transferir() then
    raise exception 'Sem permissão de transferência';
  end if;
  update public.transferencias
     set status = 'cancelada', cancelada_por_email = me, cancelada_em = now(),
         cancelada_motivo = p_motivo,
         em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id and status = 'pendente';
  if not found then raise exception 'Transferência já finalizada — não é mais possível cancelar'; end if;
end $$;

commit;
