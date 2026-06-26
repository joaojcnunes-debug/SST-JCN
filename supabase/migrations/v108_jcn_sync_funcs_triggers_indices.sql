-- v108 (JCN sync 2026-06-26) — funções/trigger/índices que faltavam. Aplicado via MCP supabase-sst.
create or replace function public.caller_unidades() returns text[]
  language sql stable security definer set search_path to 'public' as $fn$
  select coalesce(u.unidades, '{}') from public.usuarios u
   where lower(u.email) = lower(auth.jwt() ->> 'email') and u.ativo_sistema = true limit 1;
$fn$;

-- Lógica real do painel (substitui a permissiva da v106).
create or replace function public.caller_pode_ver_empresa(p_id_empresa text) returns boolean
  language sql stable security definer set search_path to 'public' as $fn$
  select public.caller_eh_admin() or p_id_empresa is null or exists (
    select 1 from public.empresas e
     where e.id_empresa = p_id_empresa
       and (e.id_unidade is null or e.id_unidade = any(public.caller_unidades()))
  );
$fn$;

create or replace function public.fn_textos_padrao_snapshot() returns trigger
  language plpgsql security definer set search_path to 'public' as $fn$
declare v_prox integer;
begin
  if (TG_OP = 'UPDATE') then
    if new.titulo is not distinct from old.titulo
       and new.conteudo is not distinct from old.conteudo
       and new.bg_imagem_url is not distinct from old.bg_imagem_url
       and new.caixas_texto is not distinct from old.caixas_texto
       and new.posicao_pdf is not distinct from old.posicao_pdf
       and new.orientacao is not distinct from old.orientacao
       and new.quebra_pagina is not distinct from old.quebra_pagina then
      return new;
    end if;
  end if;
  select coalesce(max(versao), 0) + 1 into v_prox from public.textos_padrao_versoes where id_capitulo = new.id_capitulo;
  insert into public.textos_padrao_versoes (
    id_capitulo, versao, modulo, titulo, conteudo, bg_imagem_url, caixas_texto,
    orientacao, quebra_pagina, posicao_pdf, tipo, slug_fixo, ordem, ativo, editado_por, editado_em
  ) values (
    new.id_capitulo, v_prox, new.modulo, new.titulo, new.conteudo, new.bg_imagem_url, new.caixas_texto,
    new.orientacao, new.quebra_pagina, new.posicao_pdf, new.tipo, new.slug_fixo, new.ordem, new.ativo, auth.email(), now()
  );
  return new;
end; $fn$;
drop trigger if exists trg_textos_padrao_snapshot on public.textos_padrao;
create trigger trg_textos_padrao_snapshot after insert or update on public.textos_padrao for each row execute function public.fn_textos_padrao_snapshot();

create or replace function public.set_elaboracao_documento(p_id_inspecao text, p_status text, p_responsavel text default null::text, p_concluida_em timestamptz default null::timestamptz)
  returns void language plpgsql security definer set search_path to 'public' as $fn$
declare v_id_empresa text; v_perfil text;
begin
  select perfil into v_perfil from public.usuarios where lower(email) = lower(auth.jwt() ->> 'email') and ativo_sistema = true limit 1;
  if v_perfil is null or v_perfil = 'Cliente' then raise exception 'sem permissao para elaborar documento'; end if;
  if p_status not in ('PENDENTE','EM_ELABORACAO','CONCLUIDO') then raise exception 'status invalido'; end if;
  select id_empresa into v_id_empresa from public.inspecoes where id_inspecao = p_id_inspecao;
  if v_id_empresa is null and not exists (select 1 from public.inspecoes where id_inspecao = p_id_inspecao) then raise exception 'inspecao nao encontrada'; end if;
  if not public.caller_pode_ver_empresa(v_id_empresa) then raise exception 'sem acesso a esta empresa'; end if;
  update public.inspecoes
     set elaboracao_status = p_status,
         elaboracao_responsavel = case when p_status = 'PENDENTE' then null when p_status = 'EM_ELABORACAO' then p_responsavel else coalesce(p_responsavel, elaboracao_responsavel) end,
         elaboracao_concluida_em = case when p_status = 'CONCLUIDO' then coalesce(p_concluida_em, now()) else null end,
         updated_at = now()
   where id_inspecao = p_id_inspecao;
end; $fn$;

create index if not exists idx_anexos_ref on public.anexos using btree (modulo, id_referencia, ordem);
create index if not exists idx_audit_ref on public.document_audit_logs using btree (modulo, id_referencia, created_at desc);
create index if not exists idx_audit_created on public.document_audit_logs using btree (created_at desc);
create index if not exists idx_drps_plano_acao_5w2h_relatorio on public.drps_plano_acao_5w2h using btree (id_relatorio, ordem);
create index if not exists idx_investig_acidente_empresa on public.investigacoes_acidente using btree (id_empresa);
create index if not exists idx_investig_acidente_status on public.investigacoes_acidente using btree (status);
create index if not exists idx_prod_projecoes_salvas_criado on public.prod_projecoes_salvas using btree (criado_em desc);
create index if not exists idx_prod_projecoes_salvas_unidade on public.prod_projecoes_salvas using btree (id_unidade);
create index if not exists idx_prod_snapshot_mensal_periodo on public.prod_snapshot_mensal using btree (ano, mes);
create index if not exists idx_reg_excl on public.registros_excluidos using btree (excluido_em desc);
create index if not exists idx_reg_excl_pendentes on public.registros_excluidos using btree (restaurado, excluido_em desc);
create index if not exists idx_tpv_capitulo on public.textos_padrao_versoes using btree (id_capitulo, versao desc);
