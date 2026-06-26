-- v74: Parte 1 do isolamento de acesso (auditoria).
-- Visualizador (e Cliente) viram SÓ-LEITURA no banco; escrita só Admin/Técnico
-- (caller_pode_editar()). Leitura continua aberta a todo autenticado — NINGUÉM
-- é travado. O isolamento por empresa (Técnico/Visualizador só vê empresas
-- vinculadas) fica para depois, quando usuarios.empresas_vinculadas estiver
-- preenchido (hoje está vazio para todos os técnicos/visualizadores; ligar o
-- filtro agora trancaria toda a equipe).
-- Espelha o padrão já usado nas 9 tabelas-núcleo (inspecoes, empresas, riscos…).
-- Excluídas: usuarios/configuracoes (já admin-only), prod_* (módulo à parte),
-- pdfs_gerados/pdfs_assinados (logs de auditoria).
do $$
declare
  tbls text[] := array[
    'acoes_5w2h','analises_quimicos','apreciacao_acoes','apreciacao_riscos_hrn',
    'apreciacoes_maquinas','apreciacoes_maquinas_itens','aep_relatorios','aet_relatorios',
    'aep_textos_padrao','aet_textos_padrao','aet_13fatores_config','aet_13fatores_perguntas',
    'aet_13fatores_semaforo','aet_checklist_perguntas','aet_owas_categorias',
    'aet_owas_select_campos','aet_perfis_owas','aet_laudo_fatores_psi','aet_laudo_qps_meta',
    'aet_laudo_qps_respostas','base_referencia_quimicos','drps_empresa_config',
    'drps_monitoramento','drps_plano_medidas','drps_probabilidades','drps_relatorios',
    'drps_respondentes','drps_revisao','drps_texto_padrao','extintores','inspecao_maquinas',
    'inventario_maquinas','itens_catalogo_tipo','itens_modelo_risco','matrizes_risco',
    'modelos_risco','pae_contatos','perguntas_modelo_risco','perguntas_tipo_risco',
    'qps_aplicacoes','qps_categorias','qps_perguntas','qps_planos_acao','qps_probabilidades',
    'qps_respondentes','qps_tipos','relatorios_conformidade','relatorios_conformidade_itens',
    'relatorios_nao_conformidade','relatorios_nao_conformidade_itens','textos_padrao',
    'tipos_risco','treinamentos_cargo','treinamentos_nr','treinamentos_risco',
    'treinamentos_setor','triagens_modelo','triagens_opcao','triagens_tipo'
  ];
  t text;
  p record;
begin
  foreach t in array tbls loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (true)$f$,
                   t||'_sel_auth', t);
    execute format($f$create policy %I on public.%I for all to authenticated using (caller_pode_editar()) with check (caller_pode_editar())$f$,
                   t||'_rw_editor', t);
  end loop;
end $$;
