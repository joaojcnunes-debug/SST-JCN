-- v221_gestao_definir_membro_cast_acao.sql
-- Fix do bug de gestão de membros: gestao_definir_membro (nascida no v116) sempre falhava
-- com 42804 (`column "acao" is of type gestao_acao but expression is of type text`) ao gravar
-- em gestao_acesso_log. Causa: o CASE que escolhe convidou/removeu/alterou_papel resolve como
-- `text` (literais soltos), e a coluna `acao` é o enum gestao_acao — Postgres recusa o cast
-- implícito text->enum num INSERT. Efeito: TODA ação de membro (adicionar/alterar/remover)
-- retornava 400 no PostgREST. Reproduzido em prod com os claims reais do ator (rollback) em 16/09.
-- Fix cirúrgico: castar SÓ o CASE para ::public.gestao_acao. Nada mais muda (mesma assinatura,
-- mesmas guardas de motivo/papel, mesmo upsert). Os 3 rótulos já existem no enum (verificado).
-- SQL-only. Idempotente (create or replace). NÃO grava schema_migrations (apply manual pelo operador).
-- Segurança: SECURITY DEFINER + search_path='public' preservados; sem SQL dinâmico; valores parametrizados.

begin;

create or replace function public.gestao_definir_membro(p_alvo text, p_papel gestao_papel, p_ativo boolean, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ator text := public.gestao_email(); v_ator_papel public.gestao_papel; v_ant public.gestao_papel; v_log uuid;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_ator_papel := public.gestao_papel_de(v_ator);
  if v_ator_papel not in ('owner','admin') then raise exception 'apenas Owner/Admin gerenciam o roster'; end if;
  select papel into v_ant from public.gestao_membros where lower(usuario_email)=lower(p_alvo);
  if v_ator_papel = 'admin' and (p_papel = 'owner' or v_ant = 'owner') then
    raise exception 'admin não promove/altera owner';
  end if;
  insert into public.gestao_membros (usuario_email, papel, ativo, adicionado_por)
    values (p_alvo, p_papel, coalesce(p_ativo, true), v_ator)
  on conflict (lower(usuario_email)) do update set papel=excluded.papel, ativo=excluded.ativo;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
    values (v_ator, p_alvo,
            (case when v_ant is null then 'convidou' when coalesce(p_ativo,true)=false then 'removeu' else 'alterou_papel' end)::public.gestao_acao,
            p_motivo)
    returning id into v_log;
  return v_log;
end $function$;

commit;
