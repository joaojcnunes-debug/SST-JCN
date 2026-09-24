-- v76: Fase B do modelo de acesso — liga a RLS por UNIDADE.
-- Leitura restrita às empresas visíveis ao usuário (admin=tudo; demais=empresas
-- das suas unidades + empresas sem unidade, via caller_pode_ver_empresa).
-- Escrita = caller_pode_editar() E poder ver a empresa (Visualizador só-leitura).
-- Seguro de ligar: toda empresa nasce sem unidade (=visível a todos), então só
-- começa a restringir conforme unidades forem atribuídas.
-- Catálogos, prod_* e pdfs_* NÃO mudam (não são por empresa).
-- Verificado por simulação de papel: técnico com unidade A vê empresa da A e
-- não vê a da B; admin vê tudo; tabelas-filhas resolvem via o pai sem erro.

-- ── 29 tabelas com id_empresa direto ─────────────────────────────────────
do $$
declare
  tbls text[] := array[
    'acoes_5w2h','aep_relatorios','aet_relatorios','analises_quimicos',
    'apreciacoes_maquinas','cargos','complementos','drps_empresa_config',
    'drps_monitoramento','drps_plano_medidas','drps_probabilidades','drps_relatorios',
    'drps_respondentes','drps_revisao','empresas','epi_epc','extintores','fotos',
    'inspecao_maquinas','inspecoes','inventario_maquinas','pae_contatos',
    'qps_aplicacoes','relatorios_conformidade','relatorios_nao_conformidade',
    'responsaveis','riscos','setores','treinamentos_nr'
  ];
  t text; p record;
begin
  foreach t in array tbls loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.caller_pode_ver_empresa(id_empresa))$f$, t||'_sel_uni', t);
    execute format($f$create policy %I on public.%I for all to authenticated using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa)) with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa))$f$, t||'_rw_uni', t);
  end loop;
end $$;

-- ── tabelas filhas: resolvem a empresa via o pai ─────────────────────────
do $$
declare
  rels text[][] := array[
    ['relatorios_conformidade_itens','relatorios_conformidade','id_relatorio'],
    ['relatorios_nao_conformidade_itens','relatorios_nao_conformidade','id_relatorio'],
    ['apreciacao_acoes','apreciacoes_maquinas','id_apreciacao'],
    ['apreciacao_riscos_hrn','apreciacoes_maquinas','id_apreciacao'],
    ['apreciacoes_maquinas_itens','apreciacoes_maquinas','id_apreciacao'],
    ['aet_laudo_fatores_psi','aet_relatorios','id_relatorio'],
    ['aet_laudo_qps_meta','aet_relatorios','id_relatorio'],
    ['aet_laudo_qps_respostas','aet_relatorios','id_relatorio'],
    ['qps_planos_acao','qps_aplicacoes','id_aplicacao'],
    ['qps_probabilidades','qps_aplicacoes','id_aplicacao'],
    ['qps_respondentes','qps_aplicacoes','id_aplicacao']
  ];
  child text; parent text; fk text; p record; cond text; i int;
begin
  for i in 1 .. array_length(rels,1) loop
    child := rels[i][1]; parent := rels[i][2]; fk := rels[i][3];
    for p in select policyname from pg_policies where schemaname='public' and tablename=child loop
      execute format('drop policy %I on public.%I', p.policyname, child);
    end loop;
    execute format('alter table public.%I enable row level security', child);
    cond := format('exists (select 1 from public.%I par where par.%I = public.%I.%I and public.caller_pode_ver_empresa(par.id_empresa))',
                   parent, fk, child, fk);
    execute format($f$create policy %I on public.%I for select to authenticated using (%s)$f$, child||'_sel_uni', child, cond);
    execute format($f$create policy %I on public.%I for all to authenticated using (public.caller_pode_editar() and %s) with check (public.caller_pode_editar() and %s)$f$, child||'_rw_uni', child, cond, cond);
  end loop;
end $$;
