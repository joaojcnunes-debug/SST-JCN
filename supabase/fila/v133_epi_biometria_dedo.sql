-- v133 — Gestão de EPI (biometria): guarda QUAL dedo foi cadastrado e aceita múltiplas
-- amostras (o template passa a ser um JSON com N imagens, cifrado igual antes).
-- A RPC epi_cadastrar_biometria ganha p_dedo. Idempotente/reversível.

alter table public.epi_colaboradores
  add column if not exists biometria_dedo text;

-- RPC com o dedo (recria; a de 3 args foi da v132)
drop function if exists public.epi_cadastrar_biometria(text, text, boolean);
create or replace function public.epi_cadastrar_biometria(
  p_id_colaborador text, p_template text, p_consentimento boolean, p_dedo text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_emp text; v_key text := public.epi_bio_key();
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para cadastrar biometria.'; end if;
  select empresa_id into v_emp from epi_colaboradores where id = p_id_colaborador;
  if not found then raise exception 'Colaborador não encontrado.'; end if;
  if not public.caller_pode_ver_empresa(v_emp) then raise exception 'Empresa fora do seu acesso.'; end if;
  if not coalesce(p_consentimento, false) then raise exception 'Consentimento biométrico é obrigatório.'; end if;
  if coalesce(trim(p_template), '') = '' then raise exception 'Template biométrico vazio.'; end if;
  if v_key is null then raise exception 'Chave de biometria não configurada (defina app.epi_bio_key no banco).'; end if;

  update epi_colaboradores
    set biometria_template = encode(pgp_sym_encrypt(p_template, v_key), 'base64'),
        biometria_dedo = nullif(trim(p_dedo), ''),
        biometria_em = now(),
        biometria_consentimento_em = now(),
        updated_at = now()
  where id = p_id_colaborador;
end $$;

grant execute on function public.epi_cadastrar_biometria(text, text, boolean, text) to authenticated;
