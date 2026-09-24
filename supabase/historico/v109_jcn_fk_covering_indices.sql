-- v109 (JCN sync 2026-06-26) — índices de cobertura para foreign keys sem índice.
-- Aplicado via MCP supabase-sst. Origem: advisor de performance (unindexed_foreign_keys, 18 FKs).
create index if not exists idx_aep_relatorios_id_empresa on public.aep_relatorios (id_empresa);
create index if not exists idx_aep_relatorios_usuario on public.aep_relatorios (usuario);
create index if not exists idx_extintores_id_empresa on public.extintores (id_empresa);
create index if not exists idx_extintores_id_setor on public.extintores (id_setor);
create index if not exists idx_gestao_filtros_salvos_id_quadro on public.gestao_filtros_salvos (id_quadro);
create index if not exists idx_gestao_notificacoes_id_quadro on public.gestao_notificacoes (id_quadro);
create index if not exists idx_gestao_notificacoes_id_tarefa on public.gestao_notificacoes (id_tarefa);
create index if not exists idx_gestao_preferencias_visao_id_quadro on public.gestao_preferencias_visao (id_quadro);
create index if not exists idx_gestao_quadros_id_espaco on public.gestao_quadros (id_espaco);
create index if not exists idx_gestao_quadros_id_pasta on public.gestao_quadros (id_pasta);
create index if not exists idx_portal_anexos_criado_por on public.portal_anexos (criado_por);
create index if not exists idx_portal_comentarios_criado_por on public.portal_comentarios (criado_por);
create index if not exists idx_portal_documentos_cliente_criado_por on public.portal_documentos_cliente (criado_por);
create index if not exists idx_portal_pendencias_cliente_criado_por on public.portal_pendencias_cliente (criado_por);
create index if not exists idx_portal_solicitacoes_cliente_criado_por on public.portal_solicitacoes_cliente (criado_por);
create index if not exists idx_prod_colaboradores_id_unidade on public.prod_colaboradores (id_unidade);
create index if not exists idx_prod_documentos_sst_id_unidade on public.prod_documentos_sst (id_unidade);
create index if not exists idx_prod_registros_mensais_id_unidade on public.prod_registros_mensais (id_unidade);
