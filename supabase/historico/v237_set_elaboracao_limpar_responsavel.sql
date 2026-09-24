-- v237 — set_elaboracao_documento: pedido explícito de LIMPAR o responsável.
--
-- Contexto (21/09): tirar o associado que é o responsável da elaboração só
-- apagava a linha de `inspecao_associados`; `inspecoes.elaboracao_responsavel`
-- ficava, o documento seguia "Em elaboração por X", X voltava como chip e
-- continuava no gráfico "Documentos por Associado" (caso vivo INS-219C22EE,
-- 17/09). Decisão dele: "apague mesmo, caso ele queira alocar outro usuário".
--
-- No ramo CONCLUIDO a função preserva o nome quando recebe NULL — guarda do
-- "Reabrir", que antes apagava o responsável e travava o documento. Para não
-- mexer nessa guarda nem na assinatura (o PostgREST resolve a RPC pelo nome
-- dos parâmetros; assinatura nova exigiria recarregar o cache de schema), a
-- tela manda string VAZIA quando quer limpar, e esta versão converte '' em
-- NULL nos dois ramos. Sem esta migration a tela funciona igual: grava '' e
-- todas as leituras já tratam '' como "sem responsável" (trim); só o banco
-- fica com '' em vez de NULL.
--
-- Primeira cópia versionada desta função: até aqui ela só existia no banco.
-- Rollback: scripts/sql/v237_rollback_set_elaboracao.sql (o corpo anterior).

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
           when p_status = 'EM_ELABORACAO' then nullif(p_responsavel, '')
           -- CONCLUIDO: NULL preserva o responsável (guarda do "Reabrir");
           -- '' é o pedido explícito de limpar (v237).
           when p_responsavel = ''         then null
           else coalesce(p_responsavel, elaboracao_responsavel)
         end,
         elaboracao_concluida_em = case
           when p_status = 'CONCLUIDO' then coalesce(p_concluida_em, now())
           else null
         end,
         updated_at = now()
   where id_inspecao = p_id_inspecao;
end;
$function$;

-- Higiene: se alguma tela já gravou '' antes desta migration, vira NULL.
update public.inspecoes
   set elaboracao_responsavel = null
 where elaboracao_responsavel = '';


commit;
