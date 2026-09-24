-- v124 (JCN) — EPI Fase 4: assinatura biométrica / não-repúdio da entrega. Aplicado via MCP.
-- Trilha de evidências APPEND-ONLY (só select+insert; nunca update/delete): quem
-- assinou, imagem manuscrita, hash SHA-256 do PDF consentido, user-agent, IP e
-- carimbo de tempo. O estado "assinada" da entrega é DERIVADO da existência de
-- uma linha aqui (epi_entregas permanece append-only, sem UPDATE).
-- Idempotente/reversível (create if not exists + drop policy if exists).

create table if not exists public.epi_entrega_assinaturas (
  id             text primary key,
  id_entrega     text not null references public.epi_entregas(id) on delete cascade,
  empresa_id     text not null references public.empresas(id_empresa) on delete cascade,
  id_colaborador text references public.epi_colaboradores(id) on delete set null,
  assinante_nome text,
  assinatura_png text,   -- data URL PNG do canvas (assinatura manuscrita do recebedor)
  pdf_sha256     text,   -- hash do PDF exatamente consentido (pré-assinatura)
  user_agent     text,
  ip             text,
  assinado_em    timestamptz not null default now(),
  criado_por     text,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_epi_ent_assin_entrega on public.epi_entrega_assinaturas (id_entrega, assinado_em desc);

alter table public.epi_entrega_assinaturas enable row level security;

drop policy if exists epi_ent_assin_sel on public.epi_entrega_assinaturas;
create policy epi_ent_assin_sel on public.epi_entrega_assinaturas for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_ent_assin_ins on public.epi_entrega_assinaturas;
create policy epi_ent_assin_ins on public.epi_entrega_assinaturas for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));

create or replace function public.epi_assinar_entrega(
  p_id_entrega text, p_assinante_nome text, p_assinatura_png text,
  p_pdf_sha256 text, p_user_agent text
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_perfil  text := public.get_meu_perfil();
  v_email   text := (select email from public.usuarios where id_usuario = (auth.uid())::text limit 1);
  v_id      text := gen_random_uuid()::text;
  v_empresa text; v_colab text; v_ip text;
begin
  select empresa_id, id_colaborador into v_empresa, v_colab
    from public.epi_entregas where id = p_id_entrega;
  if v_empresa is null then
    raise exception 'entrega não encontrada';
  end if;
  if not (v_perfil in ('Admin','Tecnico') or v_empresa = any(public.get_minhas_empresas())) then
    raise exception 'sem permissão para assinar esta entrega';
  end if;
  if p_assinatura_png is null or length(p_assinatura_png) < 100 then
    raise exception 'assinatura ausente';
  end if;

  -- IP capturado no servidor (PostgREST expõe os headers da requisição); o
  -- cliente não consegue forjar. Falha silenciosa se o header não existir.
  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json->>'x-real-ip'
    );
  exception when others then
    v_ip := null;
  end;

  insert into public.epi_entrega_assinaturas
    (id, id_entrega, empresa_id, id_colaborador, assinante_nome, assinatura_png, pdf_sha256, user_agent, ip, criado_por)
  values
    (v_id, p_id_entrega, v_empresa, v_colab, p_assinante_nome, p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip, v_email);

  return v_id;
end $fn$;

grant execute on function public.epi_assinar_entrega(text,text,text,text,text) to authenticated;
