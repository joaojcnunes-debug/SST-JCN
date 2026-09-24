-- Rollback da v237 — devolve o corpo anterior de set_elaboracao_documento
-- (lido do banco em 21/09/2026, antes da v237). Com este corpo a tela ainda
-- funciona: ao limpar o responsável de um documento entregue ela grava '' em
-- vez de NULL, e todas as leituras tratam '' como "sem responsável".

begin;

create or replace function public.set_elaboracao_documento(
  p_id_inspecao text,
  p_status text,
  p_responsavel text default null,
  p_concluida_em timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_empresa text;
  v_perfil text;
begin
  -- Caller precisa ser usuário interno ativo (qualquer perfil exceto Cliente).
  -- Visualizadores podem elaborar o documento (assumir/concluir), mesmo sem pode_editar.
  select perfil into v_perfil
    from public.usuarios
   where lower(email) = lower(auth.jwt() ->> 'email')
     and ativo_sistema = true
   limit 1;
  if v_perfil is null or v_perfil = 'Cliente' then
    raise exception 'sem permissao para elaborar documento';
  end if;

  if p_status not in ('PENDENTE','EM_ELABORACAO','CONCLUIDO') then
    raise exception 'status invalido';
  end if;

  select id_empresa into v_id_empresa from public.inspecoes where id_inspecao = p_id_inspecao;
  if v_id_empresa is null and not exists (select 1 from public.inspecoes where id_inspecao = p_id_inspecao) then
    raise exception 'inspecao nao encontrada';
  end if;
  if not public.caller_pode_ver_empresa(v_id_empresa) then
    raise exception 'sem acesso a esta empresa';
  end if;

  update public.inspecoes
     set elaboracao_status = p_status,
         elaboracao_responsavel = case
           when p_status = 'PENDENTE'      then null
           when p_status = 'EM_ELABORACAO' then p_responsavel
           else coalesce(p_responsavel, elaboracao_responsavel)  -- CONCLUIDO preserva o responsável
         end,
         elaboracao_concluida_em = case
           when p_status = 'CONCLUIDO' then coalesce(p_concluida_em, now())
           else null
         end,
         updated_at = now()
   where id_inspecao = p_id_inspecao;
end;
$function$;

delete from public.schema_migrations where version = 'v237_set_elaboracao_limpar_responsavel';

commit;
