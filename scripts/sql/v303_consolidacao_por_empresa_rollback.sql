-- Rollback da v303 (consolidação por empresa salva). Rodar DEPOIS de voltar o código.
-- Apaga as consolidações por empresa (e, em cascata, os setores padronizados delas).
-- Se alguma tiver registro gravado (psico_consolidacao_execucoes), o delete falha de
-- propósito: os registros são imutáveis — decida antes o que fazer com eles.

delete from public.empresa_grupos where tipo = 'CONSOLIDACAO';

drop function if exists public.psico_consolidacao_membros(text);
drop trigger if exists trg_empresa_grupo_nao_consolidacao on public.empresas;
drop function if exists public.fn_empresa_grupo_nao_consolidacao();

drop index if exists public.ux_empresa_grupos_nome;
create unique index ux_empresa_grupos_nome on public.empresa_grupos (lower(btrim(nome)));

alter table public.empresa_grupos drop constraint if exists empresa_grupos_tipo_check;
alter table public.empresa_grupos drop column if exists empresas_consolidacao;
alter table public.empresa_grupos drop column if exists tipo;
