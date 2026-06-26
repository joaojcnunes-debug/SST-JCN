-- v106 (JCN sync 2026-06-26) — RLS das 13 tabelas novas. Aplicado via MCP supabase-sst.
-- caller_pode_ver_empresa criada permissiva aqui; v108 a substitui pela lógica real (caller_unidades já existe).
create or replace function public.caller_pode_ver_empresa(p_id_empresa text) returns boolean
  language sql stable security definer set search_path=public as $$ select true $$;

alter table public.anexos enable row level security;
alter table public.apreciacao_riscos_hrn enable row level security;
alter table public.document_audit_logs enable row level security;
alter table public.drps_agravos enable row level security;
alter table public.drps_medidas_recomendadas enable row level security;
alter table public.drps_plano_acao_5w2h enable row level security;
alter table public.investigacoes_acidente enable row level security;
alter table public.prod_colaborador_unidade enable row level security;
alter table public.prod_projecoes_salvas enable row level security;
alter table public.prod_snapshot_mensal enable row level security;
alter table public.registros_excluidos enable row level security;
alter table public.textos_padrao_versoes enable row level security;
alter table public.unidades enable row level security;

create policy anexos_rw on public.anexos for all to authenticated using ((caller_pode_editar() AND caller_pode_ver_empresa(empresa_id))) with check ((caller_pode_editar() AND caller_pode_ver_empresa(empresa_id)));
create policy anexos_sel on public.anexos for select to authenticated using (caller_pode_ver_empresa(empresa_id));
create policy apreciacao_riscos_hrn_rw_uni on public.apreciacao_riscos_hrn for all to authenticated using ((caller_pode_editar() AND (EXISTS ( SELECT 1 FROM apreciacoes_maquinas par WHERE ((par.id_apreciacao = apreciacao_riscos_hrn.id_apreciacao) AND caller_pode_ver_empresa(par.id_empresa)))))) with check ((caller_pode_editar() AND (EXISTS ( SELECT 1 FROM apreciacoes_maquinas par WHERE ((par.id_apreciacao = apreciacao_riscos_hrn.id_apreciacao) AND caller_pode_ver_empresa(par.id_empresa))))));
create policy apreciacao_riscos_hrn_sel_uni on public.apreciacao_riscos_hrn for select to authenticated using ((EXISTS ( SELECT 1 FROM apreciacoes_maquinas par WHERE ((par.id_apreciacao = apreciacao_riscos_hrn.id_apreciacao) AND caller_pode_ver_empresa(par.id_empresa)))));
create policy "auth insert document_audit_logs" on public.document_audit_logs for insert to authenticated with check (true);
create policy "auth read document_audit_logs" on public.document_audit_logs for select to authenticated using (true);
create policy "auth read drps_agravos" on public.drps_agravos for select to authenticated using (true);
create policy drps_agravos_rw on public.drps_agravos for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar());
create policy "auth read drps_medidas_recomendadas" on public.drps_medidas_recomendadas for select to authenticated using (true);
create policy drps_medidas_recomendadas_rw on public.drps_medidas_recomendadas for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar());
create policy drps_plano_acao_5w2h_rw on public.drps_plano_acao_5w2h for all to authenticated using ((caller_pode_editar() AND caller_pode_ver_empresa(id_empresa))) with check ((caller_pode_editar() AND caller_pode_ver_empresa(id_empresa)));
create policy drps_plano_acao_5w2h_sel on public.drps_plano_acao_5w2h for select to authenticated using (caller_pode_ver_empresa(id_empresa));
create policy investig_delete on public.investigacoes_acidente for delete to authenticated using ((caller_pode_editar() AND caller_pode_ver_empresa(id_empresa)));
create policy investig_insert on public.investigacoes_acidente for insert to authenticated with check ((caller_pode_editar() AND caller_pode_ver_empresa(id_empresa)));
create policy investig_select on public.investigacoes_acidente for select to authenticated using (caller_pode_ver_empresa(id_empresa));
create policy investig_update on public.investigacoes_acidente for update to authenticated using ((caller_pode_editar() AND caller_pode_ver_empresa(id_empresa))) with check ((caller_pode_editar() AND caller_pode_ver_empresa(id_empresa)));
create policy prod_colaborador_unidade_rw on public.prod_colaborador_unidade for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar());
create policy prod_colaborador_unidade_sel on public.prod_colaborador_unidade for select to authenticated using (true);
create policy prod_projecoes_salvas_rw on public.prod_projecoes_salvas for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar());
create policy prod_projecoes_salvas_sel on public.prod_projecoes_salvas for select to authenticated using (true);
create policy prod_snapshot_mensal_rw on public.prod_snapshot_mensal for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar());
create policy prod_snapshot_mensal_sel on public.prod_snapshot_mensal for select to authenticated using (true);
create policy "admin read registros_excluidos" on public.registros_excluidos for select to authenticated using (caller_eh_admin());
create policy "admin update registros_excluidos" on public.registros_excluidos for update to authenticated using (caller_eh_admin()) with check (caller_eh_admin());
create policy "auth insert registros_excluidos" on public.registros_excluidos for insert to authenticated with check (true);
create policy "auth read textos_padrao_versoes" on public.textos_padrao_versoes for select to authenticated using (true);
create policy unidades_rw on public.unidades for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar());
create policy unidades_sel on public.unidades for select to authenticated using (true);
