-- v309 — Documento: "Atribuído" separado de "Em elaboração" (28/10/2026)
--
-- Pedido de 28/10: "ter o colaborador [associado] não significa que o colaborador começou a atuar
-- nessa empresa — o que podemos fazer para esse controle ficar 100% assertivo". Até aqui (decisão de
-- 22/09) quem estava no documento contava como "em elaboração". Agora:
--
--   situacao_documento   ENTREGUE · EM_ELABORACAO (só com início de verdade) · ATRIBUIDO (novo: tem
--                        associado, ninguém começou) · PENDENTE · null (inspeção em campo, sem ninguém)
--   inspecoes.elaboracao_iniciada_em/_por/_inicio_origem
--                        quando, quem e como o trabalho no documento começou:
--                        BOTAO      = "Iniciar elaboração"/"Assumir elaboração" (set_elaboracao_documento)
--                        AUTOMATICO = a 1ª edição do associado no documento (gatilho na auditoria)
--   atribuido_em(i)      coluna calculada: a primeira associação (inspecao_associados.created_at)
--
-- O início automático: depois de qualquer evento em auditoria_eventos (as tabelas auditadas da
-- inspeção: riscos, setores, fotos, complementos, 5W2H, envios ao SGG, a própria inspeção…), se
-- quem editou é ASSOCIADO daquela inspeção (id_usuario ou o nome, sem acento), a inspeção já saiu
-- do campo (CONCLUIDA) e o documento ainda não começou, ele passa a EM_ELABORACAO com a data do
-- evento. Ficam de fora: inspecao_associados e responsaveis (quem é quem, não é trabalho no
-- documento) e, na própria inspeção, os campos de classificação/fluxo (prioridade, prazo,
-- complexidade, status, elaboracao_*…).
--
-- "Liberar" (volta a PENDENTE) limpa o início; reabrir um entregue mantém o início que já havia.
-- Nenhum dado existente muda: as inspeções com associado e sem início passam a aparecer como
-- ATRIBUIDO só pela regra nova da coluna calculada.
--
-- Rollback: scripts/sql/v309_documento_inicio_elaboracao_rollback.sql

alter table public.inspecoes add column if not exists elaboracao_iniciada_em timestamptz;
alter table public.inspecoes add column if not exists elaboracao_iniciada_por text;
alter table public.inspecoes add column if not exists elaboracao_inicio_origem text;
alter table public.inspecoes drop constraint if exists inspecoes_elaboracao_inicio_origem_check;
alter table public.inspecoes add constraint inspecoes_elaboracao_inicio_origem_check
  check (elaboracao_inicio_origem is null or elaboracao_inicio_origem in ('BOTAO', 'AUTOMATICO'));
comment on column public.inspecoes.elaboracao_iniciada_em is
  'v309: quando o trabalho no documento começou (botão ou 1ª edição do associado); nulo = não começou.';
comment on column public.inspecoes.elaboracao_inicio_origem is
  'v309: BOTAO (Iniciar/Assumir elaboração) ou AUTOMATICO (1ª edição do associado no documento).';

-- ── início pelo botão (e por qualquer caminho que mude o elaboracao_status) ──────────────────────
create or replace function public.inspecoes_elaboracao_inicio_trg()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.elaboracao_status is distinct from old.elaboracao_status then
    if coalesce(new.elaboracao_status, 'PENDENTE') = 'PENDENTE' then
      -- "Liberar": o documento volta para a fila, sem início
      new.elaboracao_iniciada_em := null;
      new.elaboracao_iniciada_por := null;
      new.elaboracao_inicio_origem := null;
    elsif new.elaboracao_iniciada_em is null then
      new.elaboracao_iniciada_em := now();
      new.elaboracao_iniciada_por := lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''));
      new.elaboracao_inicio_origem := coalesce(new.elaboracao_inicio_origem, 'BOTAO');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_inspecoes_elaboracao_inicio on public.inspecoes;
create trigger trg_inspecoes_elaboracao_inicio
  before update of elaboracao_status on public.inspecoes
  for each row execute function public.inspecoes_elaboracao_inicio_trg();

-- ── início automático: a 1ª edição do associado no documento ────────────────────────────────────
create or replace function public.documento_inicio_automatico_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_id text;
  v_pk text[];
  v_insp record;
  v_usuario record;
  c_ignora constant text[] := array[
    'prioridade', 'prazo', 'complexidade', 'prioridade_definida_por', 'prioridade_definida_em',
    'status', 'concluida_em', 'concluida_por_email',
    'elaboracao_status', 'elaboracao_responsavel', 'elaboracao_concluida_em',
    'elaboracao_iniciada_em', 'elaboracao_iniciada_por', 'elaboracao_inicio_origem',
    'primeira_conclusao_em', 'primeira_conclusao_por', 'primeira_conclusao_tecnicos',
    'primeira_elaboracao_em', 'primeira_elaboracao_por'];
begin
  if new.usuario_email is null or new.tabela in ('inspecao_associados', 'responsaveis') then
    return null;
  end if;

  if new.tabela = 'inspecoes' then
    if new.acao <> 'editou'
       or not exists (select 1 from unnest(new.campos_alterados) c where c <> all (c_ignora)) then
      return null;
    end if;
    v_id := new.registro_id;
  else
    v_id := coalesce(new.depois ->> 'id_inspecao', new.antes ->> 'id_inspecao');
    -- numa EDIÇÃO o antes/depois só traz o que mudou: busca a inspeção na linha atual pela chave
    -- (v309b — sem isto, editar um risco/setor/foto não marcava o início; só criar ou excluir)
    if v_id is null and new.acao = 'editou' and new.registro_id is not null then
      select t.pk_colunas into v_pk from public.auditoria_tabelas t where t.tabela = new.tabela;
      if cardinality(v_pk) = 1 and exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = new.tabela and column_name = 'id_inspecao') then
        execute format('select id_inspecao::text from public.%I where %I::text = $1', new.tabela, v_pk[1])
          into v_id using new.registro_id;
      end if;
    end if;
  end if;
  if v_id is null then return null; end if;

  select i.id_inspecao, i.status, i.elaboracao_status into v_insp
    from public.inspecoes i where i.id_inspecao = v_id;
  if not found or v_insp.status <> 'CONCLUIDA' or coalesce(v_insp.elaboracao_status, 'PENDENTE') <> 'PENDENTE' then
    return null;
  end if;

  select u.id_usuario, u.nome into v_usuario
    from public.usuarios u where lower(u.email) = lower(new.usuario_email) limit 1;
  if not found then return null; end if;

  if not exists (
       select 1 from public.inspecao_associados a
        where a.id_inspecao = v_id
          and (a.id_usuario = v_usuario.id_usuario
               or (nullif(btrim(a.nome), '') is not null
                   and lower(public.sem_acento(btrim(a.nome))) = lower(public.sem_acento(btrim(v_usuario.nome)))))) then
    return null;
  end if;

  update public.inspecoes
     set elaboracao_status = 'EM_ELABORACAO',
         elaboracao_responsavel = coalesce(nullif(btrim(elaboracao_responsavel), ''), v_usuario.nome),
         elaboracao_iniciada_em = new.ocorrido_em,
         elaboracao_iniciada_por = lower(new.usuario_email),
         elaboracao_inicio_origem = 'AUTOMATICO',
         updated_at = now()
   where id_inspecao = v_id
     and coalesce(elaboracao_status, 'PENDENTE') = 'PENDENTE';
  return null;
exception when others then
  -- nunca derruba a gravação de quem está editando
  raise warning 'documento_inicio_automatico: % (%)', sqlerrm, v_id;
  return null;
end $$;

drop trigger if exists trg_documento_inicio_automatico on public.auditoria_eventos;
create trigger trg_documento_inicio_automatico
  after insert on public.auditoria_eventos
  for each row execute function public.documento_inicio_automatico_trg();

-- ── colunas calculadas ───────────────────────────────────────────────────────────────────────────
create or replace function public.situacao_documento(i inspecoes)
returns text language sql stable set search_path to 'public' as $$
  select case when i.elaboracao_status = 'CONCLUIDO' then 'ENTREGUE'
              when i.elaboracao_status = 'EM_ELABORACAO' then 'EM_ELABORACAO'
              when public.tem_associado(i) then 'ATRIBUIDO'
              when i.status = 'CONCLUIDA' then 'PENDENTE' else null end
$$;

create or replace function public.atribuido_em(i inspecoes)
returns timestamptz language sql stable set search_path to 'public' as $$
  select min(a.created_at) from public.inspecao_associados a
   where a.id_inspecao = i.id_inspecao and nullif(btrim(a.nome), '') is not null
$$;

revoke all on function public.inspecoes_elaboracao_inicio_trg() from public, anon, authenticated;
revoke all on function public.documento_inicio_automatico_trg() from public, anon, authenticated;
grant execute on function public.atribuido_em(public.inspecoes) to authenticated;

notify pgrst, 'reload schema';
