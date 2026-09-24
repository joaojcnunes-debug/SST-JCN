-- v117 — Gestão Chabra: Fase 3 — vira o portão de membership + seed dos internos.
--
-- (1) SEED: todos os internos ativos não-Cliente que ainda não são membros → 'membro'
--     (não mexe em quem já é membro/owner). Ninguém perde acesso na virada.
-- (2) RESOLVER: quadro ABERTO + membro sem grant → 'edit' (não-regressão: hoje aberto é
--     colaborativo). Espaço/Pasta → 'view' (contêiner). Não-membro → NULL.
-- (3) FLIP: redefine gestao_pode_ver()/gestao_pode_editar_q() para DELEGAR ao resolver.
--     Assim as ~20 policies da v103 passam a ser membership-gated SEM reescrever nenhuma.
--     REVERSÍVEL: restaurar as definições da v103 desfaz a virada.
-- (4) Gate de contêiner: SELECT de gestao_espacos/gestao_pastas passa a exigir ser membro.
-- (5) Wrappers p/ o cliente (usam o JWT do caller): gestao_meu_papel(), gestao_meu_nivel().

-- (1) SEED ────────────────────────────────────────────────────────────────────
insert into public.gestao_membros (usuario_email, papel, adicionado_por)
  select u.email, 'membro', 'seed:v117' from public.usuarios u
  where coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente'
    and not exists (select 1 from public.gestao_membros m where lower(m.usuario_email)=lower(u.email));

-- (2) RESOLVER (open board = edit p/ membro) ─────────────────────────────────
create or replace function public.gestao_resolver_nivel(p_email text, p_recurso_tipo public.gestao_recurso, p_recurso_id text)
  returns public.gestao_nivel language plpgsql stable security definer set search_path=public as $$
declare
  v_papel public.gestao_papel; v_quadro text; v_pasta uuid; v_espaco uuid;
  v_nivel public.gestao_nivel; v_teto_restr int;
begin
  v_papel := public.gestao_papel_de(p_email);
  if v_papel is null then return null; end if;
  if v_papel in ('owner','admin') then return 'full'; end if;

  if    p_recurso_tipo='task' then select id_quadro into v_quadro from public.gestao_tarefas where id_tarefa=p_recurso_id;
  elsif p_recurso_tipo='list' then v_quadro := p_recurso_id; end if;
  if v_quadro is not null then select id_espaco, id_pasta into v_espaco, v_pasta from public.gestao_quadros where id_quadro=v_quadro;
  elsif p_recurso_tipo='folder' then v_pasta := p_recurso_id::uuid; select id_espaco into v_espaco from public.gestao_pastas where id=v_pasta;
  elsif p_recurso_tipo='space' then v_espaco := p_recurso_id::uuid; end if;

  select a.nivel into v_nivel from public.gestao_acessos a where lower(a.usuario_email)=lower(p_email)
    and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
      or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text))
    order by case a.recurso_tipo when 'task' then 4 when 'list' then 3 when 'folder' then 2 else 1 end desc limit 1;

  select min(public.gestao_nivel_ord(a.nivel)) into v_teto_restr from public.gestao_acessos a where lower(a.usuario_email)=lower(p_email) and a.restritivo
    and ((a.recurso_tipo='task' and p_recurso_tipo='task' and a.recurso_id=p_recurso_id) or (a.recurso_tipo='list' and a.recurso_id=v_quadro)
      or (a.recurso_tipo='folder' and a.recurso_id=v_pasta::text) or (a.recurso_tipo='space' and a.recurso_id=v_espaco::text));

  if v_nivel is null then
    if v_quadro is not null and exists (select 1 from public.gestao_quadros where id_quadro=v_quadro and restrito=false) then
      v_nivel := 'edit';                 -- lista aberta = colaborativa p/ membros
    elsif p_recurso_tipo in ('space','folder') then
      v_nivel := 'view';                 -- contêiner visível
    else
      return null;                       -- lista restrita sem grant
    end if;
  end if;

  if v_teto_restr is not null and public.gestao_nivel_ord(v_nivel) > v_teto_restr then
    v_nivel := (array['view','comment','edit','full']::public.gestao_nivel[])[v_teto_restr];
  end if;
  return v_nivel;
end $$;

-- (3) FLIP: gestao_pode_ver/editar_q delegam ao resolver ─────────────────────
create or replace function public.gestao_pode_ver(p text) returns boolean
  language sql stable security definer set search_path=public as $$
  select public.gestao_resolver_nivel(public.gestao_email(), 'list', p) is not null;
$$;
create or replace function public.gestao_pode_editar_q(p text) returns boolean
  language sql stable security definer set search_path=public as $$
  select coalesce(public.gestao_nivel_ord(public.gestao_resolver_nivel(public.gestao_email(), 'list', p)) >= 3, false);
$$;

-- (4) Gate de contêiner (espaços/pastas visíveis só a membros) ────────────────
drop policy if exists gestao_espacos_sel on public.gestao_espacos;
create policy gestao_espacos_sel on public.gestao_espacos for select to authenticated
  using (public.gestao_papel_de(public.gestao_email()) is not null);
drop policy if exists gestao_pastas_sel on public.gestao_pastas;
create policy gestao_pastas_sel on public.gestao_pastas for select to authenticated
  using (public.gestao_papel_de(public.gestao_email()) is not null);

-- (5) Wrappers p/ o cliente (usam gestao_email() do JWT) ──────────────────────
create or replace function public.gestao_meu_papel() returns public.gestao_papel
  language sql stable security definer set search_path=public as $$ select public.gestao_papel_de(public.gestao_email()); $$;
create or replace function public.gestao_meu_nivel(p_recurso_tipo public.gestao_recurso, p_recurso_id text) returns public.gestao_nivel
  language sql stable security definer set search_path=public as $$ select public.gestao_resolver_nivel(public.gestao_email(), p_recurso_tipo, p_recurso_id); $$;
