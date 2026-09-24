-- v130 — Gestão de EPI (Fase 4): assinatura do recebedor (trilha de evidências).
--
-- Assinatura eletrônica (Lei 14.063/2020 + MP 2.200-2/2001): desenho na tela + SHA-256 do
-- PDF exato + trilha imutável (quem/quando/hash/IP/consentimento). Tabela APPEND-ONLY;
-- estado "assinada" é DERIVADO pela existência de linha (nunca UPDATE em epi_entregas).
-- A RPC captura o IP NO SERVIDOR (request.headers do PostgREST) — o cliente não forja.
-- `metodo` já previsto p/ biometria digital (Fase 4B futura). Idempotente/reversível.

create table if not exists public.epi_entrega_assinaturas (
  id               text primary key default gen_random_uuid()::text,
  id_entrega       text not null references public.epi_entregas(id) on delete cascade,
  empresa_id       text not null references public.empresas(id_empresa) on delete cascade,
  id_colaborador   text,
  assinante_nome   text,
  metodo           text not null default 'canvas',   -- 'canvas' | 'digital'
  assinatura_png   text,
  pdf_sha256       text,
  user_agent       text,
  ip               text,
  consentimento_em timestamptz,
  assinado_em      timestamptz not null default now(),
  criado_por       text,
  criado_em        timestamptz not null default now()
);
create index if not exists idx_epi_assin_entrega on public.epi_entrega_assinaturas(id_entrega);
create index if not exists idx_epi_assin_empresa on public.epi_entrega_assinaturas(empresa_id);

-- RLS append-only por empresa
alter table public.epi_entrega_assinaturas enable row level security;
drop policy if exists epi_entrega_assinaturas_sel on public.epi_entrega_assinaturas;
create policy epi_entrega_assinaturas_sel on public.epi_entrega_assinaturas
  for select to authenticated using (public.caller_pode_ver_empresa(empresa_id));
drop policy if exists epi_entrega_assinaturas_ins on public.epi_entrega_assinaturas;
create policy epi_entrega_assinaturas_ins on public.epi_entrega_assinaturas
  for insert to authenticated with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_id));

-- RPC: assinar entrega (insert-only; deriva empresa/colaborador; captura IP no servidor)
create or replace function public.epi_assinar_entrega(
  p_id_entrega text, p_assinante_nome text, p_assinatura_png text,
  p_pdf_sha256 text, p_user_agent text, p_consentimento boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_empresa text;
  v_colab   text;
  v_ip      text;
  v_id      text := gen_random_uuid()::text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para assinar.'; end if;
  select empresa_id, id_colaborador into v_empresa, v_colab from epi_entregas where id = p_id_entrega;
  if not found then raise exception 'Entrega não encontrada.'; end if;
  if not public.caller_pode_ver_empresa(v_empresa) then raise exception 'Empresa fora do seu acesso.'; end if;
  if coalesce(trim(p_assinatura_png), '') = '' then raise exception 'Assinatura em branco.'; end if;
  if not coalesce(p_consentimento, false) then raise exception 'É necessário o consentimento do recebedor.'; end if;

  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json ->> 'x-real-ip'
    );
  exception when others then v_ip := null;
  end;

  insert into public.epi_entrega_assinaturas
    (id, id_entrega, empresa_id, id_colaborador, assinante_nome, metodo, assinatura_png, pdf_sha256, user_agent, ip, consentimento_em, criado_por)
  values
    (v_id, p_id_entrega, v_empresa, v_colab,
     coalesce(nullif(trim(p_assinante_nome), ''), (select nome from epi_colaboradores where id = v_colab)),
     'canvas', p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip,
     case when p_consentimento then now() else null end, v_email);

  return v_id;
end $$;

grant execute on function public.epi_assinar_entrega(text, text, text, text, text, boolean) to authenticated;
