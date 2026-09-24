-- v227 — Fecha a visibilidade da Gestão por padrão (grant-driven).
--
-- Antes (v117): qualquer membro do roster via TODOS os espaços/pastas
--   (gestao_espacos_sel/gestao_pastas_sel = só "é membro?") e TODOS os
--   quadros abertos (resolver dava 'edit' em restrito=false e 'view' em
--   space/folder sem grant). A visibilidade por TAREFA já foi fechada em v197,
--   mas o quadro e o espaço continuavam abertos.
--
-- Depois (v227): sem grant explícito alcançável, o membro comum não vê o
--   recurso. owner/admin (perfil='Admin' ou papel owner/admin no roster)
--   seguem com 'full' — inalterado (retorno antecipado). O acesso a quadro
--   passa a exigir grant (CompartilharModal já concede 'list' nos 4 níveis);
--   o espaço/pasta aparece só quando o usuário alcança algum quadro dentro
--   (ou tem grant direto no contêiner).
--
-- Direção da mudança: APERTA o acesso (fecha default). Não expõe nada novo.

begin;

-- 1) resolver_nivel: sem grant alcançável = sem acesso (fecha o default-aberto).
create or replace function public.gestao_resolver_nivel(p_email text, p_recurso_tipo gestao_recurso, p_recurso_id text)
returns gestao_nivel
language plpgsql stable security definer set search_path to 'public'
as $function$
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

  -- FECHADO POR PADRÃO: sem grant alcançável (list/folder/space/task), sem acesso.
  if v_nivel is null then
    return null;
  end if;

  if v_teto_restr is not null and public.gestao_nivel_ord(v_nivel) > v_teto_restr then
    v_nivel := (array['view','comment','edit','full']::public.gestao_nivel[])[v_teto_restr];
  end if;
  return v_nivel;
end $function$;

-- 2) Espaço só aparece p/ gestor, ou com grant de espaço, ou se o usuário
--    alcança ALGUM quadro dentro dele (pode_ver herda grant de list/folder/space).
drop policy if exists gestao_espacos_sel on public.gestao_espacos;
create policy gestao_espacos_sel on public.gestao_espacos for select to authenticated
using (
  public.gestao_eh_gestor(public.gestao_email())
  or exists (select 1 from public.gestao_acessos a
       where a.recurso_tipo='space' and a.recurso_id=gestao_espacos.id::text
         and lower(a.usuario_email)=public.gestao_email())
  or exists (select 1 from public.gestao_quadros q
       where q.id_espaco=gestao_espacos.id and public.gestao_pode_ver(q.id_quadro))
);

-- 3) Pasta: gestor, ou grant de pasta, ou grant do espaço-pai, ou quadro
--    dentro da pasta que o usuário alcança.
drop policy if exists gestao_pastas_sel on public.gestao_pastas;
create policy gestao_pastas_sel on public.gestao_pastas for select to authenticated
using (
  public.gestao_eh_gestor(public.gestao_email())
  or exists (select 1 from public.gestao_acessos a
       where a.recurso_tipo='folder' and a.recurso_id=gestao_pastas.id::text
         and lower(a.usuario_email)=public.gestao_email())
  or exists (select 1 from public.gestao_acessos a
       where a.recurso_tipo='space' and a.recurso_id=gestao_pastas.id_espaco::text
         and lower(a.usuario_email)=public.gestao_email())
  or exists (select 1 from public.gestao_quadros q
       where q.id_pasta=gestao_pastas.id and public.gestao_pode_ver(q.id_quadro))
);

commit;
