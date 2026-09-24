-- Rollback da v235 (GESTAO-EQUIPES-01 E1): repõe o resolver e as policies de espaço/pasta da v227,
-- dropa as RPCs/helpers e as estruturas novas. PERDE equipes, membros de equipe, grants por equipe e
-- os Meu Quadro criados sob demanda (tarefas deles ficam em backup_v235_* fechado); listas pessoais
-- convertidas (id_espaco preenchido) voltam a ser quadros comuns.
-- Depois: reload do PostgREST. NÃO mexe em schema_migrations.
begin;
drop function if exists public.gestao_colaboradores_visiveis();
drop function if exists public.gestao_meu_quadro();
drop function if exists public.gestao_quadro_pessoal_de(text);
drop function if exists public.gestao_equipe_alterar_acesso(uuid, public.gestao_recurso, text, public.gestao_nivel, text);
drop function if exists public.gestao_equipe_definir_membro(uuid, text, text, boolean);
drop function if exists public.gestao_equipe_excluir(uuid);
drop function if exists public.gestao_equipe_salvar(uuid, text, text, boolean);

-- resolver e policies como na v227 (verbatim)
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

create or replace function public.gestao_ve_tarefa(p_id_tarefa text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  -- 1) sem e-mail no JWT -> nao ve
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;

  -- 2) gestor global (owner/admin; perfil=Admin vira owner) ve TODAS
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;

  -- 3) nao-membro (papel nulo) nao ve
  if v_papel is null then
    return false;
  end if;

  -- 4) gestor DO quadro/espaco da tarefa: nivel herdado 'full' (>=4). Membro de quadro
  --    ABERTO resolve 'edit' (3) e NAO passa aqui — e exatamente o ponto do flip.
  if public.gestao_nivel_ord(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     ) >= 4 then
    return true;
  end if;

  -- 5) grant explicito NAO-restritivo na PROPRIA tarefa (view/comment/edit/full)
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 6) vinculado (responsavel ou seguidor) a tarefa
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 7) criador da tarefa (created_by = e-mail do caller)
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;

  -- 7.5) responsavel de alguma subtarefa desta tarefa (alocar subtarefa -> ve a tarefa-mae)
  if exists (
       select 1 from public.gestao_subtarefas s
       where s.id_tarefa = p_id_tarefa
         and lower(s.responsavel_email) = v_email
     ) then
    return true;
  end if;

  -- 8) senao, nao ve
  return false;
end
$function$;


-- R2/R6 do revisor: trigger de proteção sai; backup FECHADO antes de apagar (tarefas reais podem viver
-- nos Meu Quadro — inclusive as listas pessoais convertidas). Quadro convertido = repor id_espaco.
drop trigger if exists trg_gestao_quadros_protege_dono on public.gestao_quadros;
drop function if exists public.gestao_quadros_protege_dono();
create table if not exists public.backup_v235_quadros_pessoais as select * from public.gestao_quadros where dono_email is not null;
create table if not exists public.backup_v235_tarefas_pessoais as select t.* from public.gestao_tarefas t join public.gestao_quadros q using (id_quadro) where q.dono_email is not null;
alter table public.backup_v235_quadros_pessoais enable row level security;
alter table public.backup_v235_tarefas_pessoais enable row level security;
revoke all on public.backup_v235_quadros_pessoais, public.backup_v235_tarefas_pessoais from anon, authenticated, public;
-- Só os Meu Quadro criados SOB DEMANDA pelo RPC (id 'QDR-ME' + 6 hex) são apagados; as listas pessoais
-- convertidas pelo script de dados (ids antigos) só perdem o dono_email — o desfazer delas é o rollback
-- pareado do próprio script de conversão (repõe espaço/nome a partir de backup_conv_listas_pessoais).
delete from public.gestao_tarefas where id_quadro in (select id_quadro from public.gestao_quadros where dono_email is not null and id_quadro ~ '^QDR-ME[0-9A-F]{6}$');
delete from public.gestao_quadros where dono_email is not null and id_quadro ~ '^QDR-ME[0-9A-F]{6}$';
update public.gestao_quadros set dono_email = null where dono_email is not null;
drop index if exists public.uq_gestao_quadros_dono;
alter table public.gestao_quadros drop column if exists dono_email;

delete from public.gestao_acessos where id_equipe is not null;
drop index if exists public.uq_gestao_acessos_equipe;
alter table public.gestao_acessos drop constraint if exists gestao_acessos_principal_chk;
alter table public.gestao_acessos drop column if exists id_equipe;
alter table public.gestao_acessos alter column usuario_email set not null;

drop table if exists public.gestao_equipe_membros;
drop table if exists public.gestao_equipes;
-- helpers por último: a policy gestao_equipe_membros_sel dependia de gestao_equipes_supervisionadas.
drop function if exists public.gestao_supervisiona(text, text);
drop function if exists public.gestao_equipes_de(text);
drop function if exists public.gestao_equipes_supervisionadas(text);
commit;
