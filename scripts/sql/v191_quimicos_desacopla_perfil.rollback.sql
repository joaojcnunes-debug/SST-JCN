-- ROLLBACK da v191 — Quimicos: capability de escrita desacoplada do perfil.
--
-- Mora em scripts/sql/ e NAO em supabase/migrations/ de proposito: o migrate.ps1 varre
-- a pasta de migrations e ignora arquivo com "rollback" no nome, mas a regra ja falhou
-- uma vez (v138) -- entao o arquivo fica fora do caminho dele.
--
-- Repoe as policies ORIGINAIS (perfil-only), remove a funcao e as 3 colunas de
-- capability/auditoria e apaga a linha de schema_migrations. begin;...commit; PROPRIO.
--
-- ⚠️ SE A REVERSAO DE PERFIL JA TIVER OCORRIDO (passo 6 da Ordem: os 3 viraram
-- Visualizador), rodar este rollback CORTA a escrita de quimicos deles -- a policy volta
-- a exigir Admin/Tecnico e a flag some. Nesse caso, RE-CONCEDER perfil Tecnico aos 3 e
-- MANUAL e obrigatorio para nao deixar gabriel.avelar/anna.oliveira/lucas.marinho sem a
-- capacidade de producao:
--     UPDATE public.usuarios SET perfil = 'Tecnico'
--       WHERE email IN ('gabriel.avelar@chabra.com.br',
--                       'anna.oliveira@chabra.com.br',
--                       'lucas.marinho@chabra.com.br');
--   (gabriel.avelar escreve quimicos ativamente -- ultima analise 2026-08-31.)
-- Se a reversao de perfil AINDA NAO ocorreu, os 3 continuam Tecnico e nada precisa ser
-- re-concedido -- este rollback so remove o caminho ADITIVO que ninguem usava ainda.

begin;

-- (1) analises_quimicos_rw_uni volta a perfil-only E unidade (estado v76).
alter table public.analises_quimicos enable row level security;
drop policy if exists analises_quimicos_rw_uni on public.analises_quimicos;
create policy analises_quimicos_rw_uni on public.analises_quimicos
  for all to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa))
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

-- (2) base_referencia_quimicos_rw_editor volta a perfil-only (estado v74).
alter table public.base_referencia_quimicos enable row level security;
drop policy if exists base_referencia_quimicos_rw_editor on public.base_referencia_quimicos;
create policy base_referencia_quimicos_rw_editor on public.base_referencia_quimicos
  for all to authenticated
  using (public.caller_pode_editar())
  with check (public.caller_pode_editar());

-- (3) Funcao da capability.
drop function if exists public.pode_escrever_quimicos();

-- (4) Colunas de capability + auditoria.
alter table public.usuarios drop column if exists pode_escrever_quimicos;
alter table public.usuarios drop column if exists concedido_por;
alter table public.usuarios drop column if exists concedido_em;

-- (5) Registro da migration.
delete from public.schema_migrations where version = 'v191_quimicos_desacopla_perfil';

commit;
