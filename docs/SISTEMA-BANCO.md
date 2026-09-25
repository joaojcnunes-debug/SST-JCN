# Apêndice — Banco de dados (Supabase / Postgres)

> Gerado automaticamente a partir do banco de produção do JCN (`public`). 
> Formato das colunas: `nome tipo` e `NN` = NOT NULL. Não contém dados, só a estrutura.

**221 tabelas.** Todas com RLS ligada; as permissões usam as funções `caller_*`, `is_admin_caller`, `rls_modulo_ok` (ver seção de funções).

## AEP

### `aep_relatorios`

id_relatorio uuid NN, id_empresa text NN, status text NN, setores jsonb NN, responsavel_elaboracao text NN, titulo_profissional text NN, registro_profissional text NN, data_elaboracao date, endereco_empresa text, conclusao text NN, usuario uuid, created_at timestamp with time zone, updated_at timestamp with time zone, data_validade date, id_inspecao text, enviado_modulo_em timestamp with time zone

### `aep_textos_padrao`

id_capitulo uuid NN, titulo text NN, conteudo text, tipo text NN, slug_fixo text, mostrar boolean NN, ordem integer NN, ordem_global integer NN, orientacao text, bg_imagem_url text, caixas_texto jsonb, created_at timestamp with time zone, updated_at timestamp with time zone

## AET

### `aet_13fatores_config`

codigo text NN, nome text NN, descricao text, perigos_tipicos text, possiveis_danos text, foco_plano text, acao_plano text, responsavel_plano text, prazo_plano text, ordem integer NN, updated_at timestamp with time zone

### `aet_13fatores_perguntas`

id uuid NN, codigo_fator text NN, texto text NN, logica text NN, ordem integer NN, updated_at timestamp with time zone

### `aet_13fatores_semaforo`

id text NN, label text NN, min_score numeric, max_score numeric, nivel_pgr text NN, prazo_texto text NN, cor_fundo text NN, cor_texto text NN, updated_at timestamp with time zone

### `aet_acoes`

id_acao text NN, id_relatorio uuid NN, id_setor uuid, ordem integer NN, what_acao text NN, why_justificativa text, where_local text, when_prazo text, who_responsavel text, how_metodo text, how_much_custo text, status text NN, prioridade text NN, data_conclusao date, observacoes text, created_by text, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `aet_checklist_perguntas`

slug text NN, label text NN, secao text NN, oculta boolean NN

### `aet_laudo_fatores_psi`

id uuid NN, id_relatorio uuid NN, codigo_fator text NN, avaliado boolean NN, media numeric, pct_zona_risco numeric, pergunta_critica text, observacao text, zona text, updated_at timestamp with time zone, id_setor uuid NN

### `aet_laudo_fatores_psi_bkp`

id uuid, id_relatorio uuid, codigo_fator text, avaliado boolean, media numeric, pct_zona_risco numeric, pergunta_critica text, observacao text, zona text, updated_at timestamp with time zone

### `aet_laudo_qps_meta`

id_relatorio uuid NN, n_respondentes integer, total_elegivel integer, periodo_inicio date, periodo_fim date, modo_aplicacao text, observacao_geral text, updated_at timestamp with time zone, tecnico_aplicador text

### `aet_laudo_qps_respostas`

id_relatorio uuid NN, id_setor uuid NN, codigo_fator text NN, pergunta_ordem integer NN, resposta integer NN, updated_at timestamp with time zone

### `aet_owas_categorias`

id uuid NN, slug text NN, titulo text NN, imagem_url text, opcoes jsonb NN, ordem integer NN

### `aet_owas_select_campos`

slug text NN, label text NN, opcoes ARRAY NN

### `aet_perfis_owas`

id uuid NN, nome text NN, posturas_costas ARRAY NN, posturas_bracos ARRAY NN, posturas_pernas ARRAY NN, esforco ARRAY NN, created_at timestamp with time zone NN

### `aet_relatorios`

id_relatorio uuid NN, id_empresa text NN, data_elaboracao date, responsavel_elaboracao text NN, titulo_profissional text NN, registro_profissional text NN, status text NN, setores jsonb NN, consideracoes_finais text NN, created_at timestamp with time zone NN, updated_at timestamp with time zone, usuario uuid, textos_secoes jsonb, endereco_empresa text, data_validade date, id_inspecao text, enviado_modulo_em timestamp with time zone

### `aet_textos_padrao`

id_capitulo uuid NN, titulo text NN, conteudo text, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone, posicao_pdf text, bg_imagem_url text, caixas_texto jsonb, orientacao text, quebra_pagina text, tipo text NN, slug_fixo text, mostrar boolean NN, ordem_global integer

## Análise de químicos

### `analises_quimicos`

id_analise text NN, id_empresa text, titulo text NN, nome_quimico text, numero_cas text, formula_quimica text, forma_fisica text, concentracao text, modo text NN, fonte_arquivo text, texto_extraido text, condicoes_uso jsonb, resultado_texto text NN, conclusao_rapida jsonb, usuario_email text, usuario_nome text, created_at timestamp with time zone NN, updated_at timestamp with time zone, data_validade date

### `base_referencia_quimicos`

id text NN, agente text NN, cas text, lt_mg_m3 numeric, lt_ppm numeric, grau_nr15 text, teto boolean, pele boolean, esocial_tab24 text, iarc text, inflamavel boolean, cancerigeno_13a boolean, tlv_acgih text, decreto_3048 text, cod_gfip text, anexo text, observacoes text, is_alias boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

## Apreciação de máquinas NR-12

### `apreciacao_acoes`

id_acao text NN, id_apreciacao text NN, id_item text, ordem integer NN, what_acao text NN, why_justificativa text, where_local text, when_prazo date, who_responsavel text, how_metodo text, how_much_custo text, status text NN, prioridade text NN, data_conclusao date, observacoes text, created_by text, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `apreciacao_fichas_maquina`

id_ficha text NN, id_apreciacao text NN, numero_ordem integer NN, id_maquina text, maquina_descricao text, equipamento text, tipo text, modelo text, fabricante text, serie text, ano text, capacidade text, setor text, componentes_maquina ARRAY, limite_uso text, limite_espaco text, limite_tempo text, limite_produtividade text, npe text, sistemas_atual ARRAY, sistemas_necessario ARRAY, constatacoes_inspecao text, parecer_tecnico text, prioridade_manual boolean NN, foto_urls ARRAY NN, foto_storage_paths ARRAY NN, created_at timestamp with time zone NN, updated_at timestamp with time zone, operadores jsonb

### `apreciacao_perigos_catalogo`

id text NN, nome text NN, origem_consequencias text, itens_nr12 ARRAY NN, medidas_eng text, medidas_adm text, pod_default text, fep_default text, gpd_default text, pod_residual_default text, fep_residual_default text, gpd_residual_default text, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN

### `apreciacao_riscos_hrn`

id_risco text NN, id_apreciacao text NN, tipo_perigo text NN, origem text, potenciais_consequencias text, pod text, fep text, gpd text, npe_item text, classificacao_risco text, nivel_acoes text, medidas_preventivas text, ordem integer, created_at timestamp with time zone, id_ficha text, pod_residual text, fep_residual text, gpd_residual text, classificacao_residual text, itens_nr12 ARRAY, categoria_seguranca text

### `inventario_maquinas`

id_maquina text NN, id_empresa text, nome text NN, marca text, modelo text, numero_serie text, ano_fabricacao integer, numero_patrimonio text, localizacao text, status text NN, observacoes text, foto_url text, foto_storage_path text, usuario_email text, usuario_nome text, created_at timestamp with time zone NN, updated_at timestamp with time zone, tipo text, categoria text, codigo_interno text, tag text, unidade text, setor text, linha_processo text, area text, responsavel_setor text, operacao_executada text, capacidade_operacional text, producao_estimada text, potencia text, tensao text, pressao text, capacidade_carga text, velocidade text, dimensoes text, finalidade text, descricao_tecnica text, protecao_fixa boolean, protecao_movel boolean, intertravamento boolean, botao_emergencia boolean, sistema_bloqueio boolean, possui_manual boolean, possui_diagrama_eletrico boolean, aterramento boolean, sinalizacao boolean, necessita_adequacao_nr12 boolean, grau_risco text, observacoes_tecnicas text, id_inspecao text, id_maquina_inspecao uuid, descricao_protecao_fixa text, descricao_protecao_movel text, dispositivos_seguranca text, categoria_inventario text, id_unidade text, foto_thumb_path text

## Cadastros e sistema

### `apreciacoes_maquinas`

id_apreciacao text NN, id_empresa text NN, id_maquina text, maquina_descricao text, titulo text, setor text, responsavel text, responsavel_empresa text, cidade text, data_apreciacao date, conclusao_tecnica text, recomendacoes text, risco_residual text, status text NN, finalizado_em timestamp with time zone, observacoes_gerais text, usuario_email text, usuario_nome text, created_at timestamp with time zone NN, updated_at timestamp with time zone, componentes_maquina ARRAY, data_validade date, id_inspecao text, limite_espaco text, limite_produtividade text, limite_tempo text, limite_uso text, npe text, sistemas_atual ARRAY, sistemas_necessario ARRAY, notificacao_sit text, incluir_checklist_pdf boolean NN

### `apreciacoes_maquinas_itens`

id_item text NN, id_apreciacao text NN, item_codigo text NN, item_categoria text NN, item_titulo text NN, item_descricao text, ordem integer NN, situacao text NN, observacao text, recomendacao text, foto_urls ARRAY NN, foto_storage_paths ARRAY NN, created_at timestamp with time zone NN, updated_at timestamp with time zone, item_origem text, probabilidade text, severidade text, nivel_risco_calculado text, id_matriz text, id_ficha text, foto_legendas ARRAY NN

### `backup_v181_responsaveis_duplas`

id_responsavel text, id_inspecao text, id_empresa text, tecnico_responsavel text, recepcionado_por text, cargo text, data_hora timestamp with time zone

### `backup_v233_usuarios_cargo`

id_usuario text NN, cargo text, gravado_em timestamp with time zone NN

### `bkp_20260924_schema_migrations`

version text, statements ARRAY, name text, created_by text, idempotency_key text, rollback ARRAY

### `cargos_painel`

cargo text NN, ordem integer NN, registro text, criado_em timestamp with time zone NN

### `cnae_grau_risco`

cnae_classe text NN, grau_risco integer NN, denominacao text NN, versao_norma text NN, created_at timestamp with time zone NN

### `colaboradores_chabra`

id_colaborador text NN, id_unidade text NN, nome text NN, cpf text, matricula text, cargo text, setor text, email text, ativo boolean NN, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone

### `configuracoes`

chave text NN, valor jsonb NN, updated_at timestamp with time zone, updated_by text

### `document_audit_logs`

id uuid NN, modulo text NN, id_referencia text, acao text NN, descricao text, empresa_id text, usuario_email text, metadata jsonb, created_at timestamp with time zone NN

### `empresas`

id_empresa text NN, nome_empresa text NN, razao_social text, cnpj text, grau_risco integer, status text, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone, cpf text, cei text, caepf text, cno text, modulos_habilitados ARRAY NN, bairro text, cep text, cnae_descricao text, cnae_principal text, complemento text, email text, id_unidade text, logradouro text, municipio text, numero text, porte text, situacao_cadastral text, telefone text, uf text, grau_risco_origem text, grau_risco_norma integer, tipo_estabelecimento text NN, id_empresa_contratante text, nome_fantasia text, referencia text, locais_emergencia text, dados_adicionais text, sgg_base_sgg text, sgg_id text, sgg_resolvido_em timestamp with time zone, sgg_resolvido_por text

### `funcoes_painel`

funcao text NN, ordem integer NN, descricao text NN, nivel text NN, perfil_padrao text NN, pode_criar_padrao boolean, pode_editar_padrao boolean, pode_excluir_padrao boolean, modulos_padrao ARRAY NN, unidades_padrao text NN, criado_em timestamp with time zone NN, ve_presenca_auditoria boolean NN

### `itens_catalogo_tipo`

id_item text NN, id_tipo text NN, categoria text NN, texto text NN, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `itens_modelo_risco`

id_item text NN, id_modelo text NN, categoria text NN, texto text NN, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `matrizes_risco`

id_matriz text NN, nome text NN, descricao text, probabilidades jsonb NN, severidades jsonb NN, lookup jsonb NN, ativa boolean NN, created_at timestamp with time zone, updated_at timestamp with time zone, pesos_prob ARRAY, pesos_sev ARRAY, faixas jsonb

### `modelos_risco`

id_modelo text NN, id_tipo text NN, agente text NN, fonte_geradora text, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `modulo_aberturas`

id_usuario text NN, modulo text NN, dia date NN, primeira_em timestamp with time zone NN, ultima_em timestamp with time zone NN, vezes integer NN

### `perguntas_modelo_risco`

id_pergunta text NN, id_modelo text NN, chave text NN, texto text NN, input_type text NN, opcoes ARRAY NN, ordem integer NN, obrigatoria boolean NN, ativo boolean NN, created_at timestamp with time zone NN

### `perguntas_tipo_risco`

id_pergunta text NN, id_tipo text NN, chave text NN, texto text NN, input_type text NN, opcoes jsonb, ordem integer NN, obrigatoria boolean NN, ativo boolean NN, created_at timestamp with time zone

### `registros_excluidos`

id uuid NN, tabela text NN, registro_id text NN, rotulo text, dados jsonb NN, modulo text, excluido_por text, excluido_em timestamp with time zone NN, restaurado boolean NN, restaurado_por text, restaurado_em timestamp with time zone, chave text, tipo_exclusao text NN

### `sgg_envios`

id_envio text NN, id_inspecao text NN, id_empresa text NN, id_setor text NN, base_sgg text NN, sgg_id_empresa text NN, sgg_id_setor text NN, sgg_ids_cargos text NN, data date NN, data_validade date NN, payload jsonb NN, status text NN, sgg_id_avaliacao text, sgg_codigo text, sgg_msg text, ator_email text NN, criado_em timestamp with time zone NN, respondido_em timestamp with time zone

### `tipos_risco`

id_tipo text NN, nome text NN, icone text, ordem integer NN, ativo boolean NN, sistema boolean NN, created_at timestamp with time zone, updated_at timestamp with time zone

### `transferencias`

id_transferencia text NN, id_maquina text, de_unidade text, de_localizacao text, de_responsavel text, para_unidade text, para_localizacao text, para_responsavel text, motivo text, observacoes text, maquina_nome text, maquina_tipo text, maquina_categoria text, maquina_codigo_interno text, maquina_tag text, maquina_marca text, maquina_modelo text, maquina_numero_serie text, maquina_numero_patrimonio text, maquina_foto_url text, responsavel_nome text, responsavel_email text, data_hora timestamp with time zone NN, created_at timestamp with time zone NN, status text NN, de_id_unidade text, para_id_unidade text, para_usuario_email text, para_usuario_nome text, transportado_por text, aceita_por_email text, aceita_em timestamp with time zone, recusada_por_email text, recusada_em timestamp with time zone, recusada_motivo text, cancelada_por_email text, cancelada_em timestamp with time zone, cancelada_motivo text, assinante_nome text, assinatura_png text, pdf_sha256 text, user_agent text, assinatura_ip text, consentimento_em timestamp with time zone, assinado_em timestamp with time zone, em_atendimento_por text, em_atendimento_em timestamp with time zone, id_equipamento text, id_catalogo text, quantidade numeric

### `triagens_modelo`

id_triagem text NN, id_modelo text NN, ordem integer NN, created_at timestamp with time zone NN

### `triagens_opcao`

id_opcao text NN, id_triagem text NN, texto text NN, id_modelo text, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN

### `triagens_tipo`

id_triagem text NN, id_tipo text NN, texto text NN, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `unidades`

id_unidade text NN, nome text NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `usuarios`

id_usuario text NN, nome text NN, email text NN, cargo text, perfil text, ativo_sistema boolean, empresas_vinculadas ARRAY, senha_hash text, created_at timestamp with time zone, modulos_permitidos ARRAY NN, pode_criar boolean NN, pode_editar boolean NN, pode_excluir boolean NN, assinatura_url text, tipo_certificado text, certificado_pfx_path text, mostrar_assinatura_imagem boolean NN, crp character varying, crm character varying, registro_mte character varying, certificado_titular text, certificado_validade timestamp with time zone, unidades ARRAY NN, crea text, art text, pode_escrever_quimicos boolean NN, concedido_por text, concedido_em timestamp with time zone, funcao text, nivel text, pode_enviar_sgg boolean NN, pode_enviar_sgg_concedido_por text, pode_enviar_sgg_concedido_em timestamp with time zone, cpf text

## Certificados de treinamento

### `certificados_treinamento`

id_certificado uuid NN, id_empresa text NN, trabalhador_nome text NN, trabalhador_cpf text, setor text, cargo text, nr text, treinamento text NN, carga_horaria numeric, data_realizacao date, data_emissao date NN, validade date, numero text, instrutor text, emitido_por_id text, emitido_por_nome text NN, observacoes text, criado_por_email text, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN

## Conformidade NR

### `relatorios_conformidade`

id_relatorio text NN, id_empresa text NN, nr_codigo text NN, nr_titulo text NN, setor text, responsavel text, data_inspecao date, observacoes_gerais text, status text NN, finalizado_em timestamp with time zone, usuario_email text, usuario_nome text, created_at timestamp with time zone NN, updated_at timestamp with time zone, responsavel_empresa text, cidade text, data_validade date

### `relatorios_conformidade_itens`

id_item text NN, id_relatorio text NN, item_codigo text NN, item_titulo text NN, item_descricao text, ordem integer NN, situacao text NN, observacao text, created_at timestamp with time zone NN, updated_at timestamp with time zone, foto_url text, foto_storage_path text, foto_urls ARRAY NN, foto_storage_paths ARRAY NN, item_nr_origem text

## DRPS (psicossocial)

### `drps_acao_como`

id text NN, id_oque text NN, titulo text NN, ativo boolean NN, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `drps_acao_oque`

id text NN, titulo text NN, ativo boolean NN, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `drps_agravos`

id text NN, titulo text NN, ativo boolean NN, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `drps_empresa_config`

id_empresa text NN, responsavel_tecnico text, crp text, data_elaboracao date, funcoes text, qtd_trabalhadores integer, qtd_homens integer, qtd_mulheres integer, agravos_saude_mental text, medidas_existentes text, updated_at timestamp with time zone NN

### `drps_medidas_recomendadas`

id text NN, titulo text NN, ativo boolean NN, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `drps_monitoramento`

id_empresa text NN, setor text NN, topico_idx smallint NN, data_intervencao date, responsavel text, status text NN, proxima_avaliacao date, observacoes text, updated_at timestamp with time zone NN, id_relatorio text NN

### `drps_monitoramento_unidade`

id_relatorio text NN, id_empresa text NN, unidade text NN, setor text NN, topico_idx smallint NN, data_intervencao date, responsavel text, status text NN, proxima_avaliacao date, observacoes text, updated_at timestamp with time zone NN

### `drps_plano_acao_5w2h`

id uuid NN, id_relatorio text NN, id_empresa text, ordem integer NN, acao text, justificativa text, onde text, prazo text, responsavel text, como text, quanto_custa text, status text NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `drps_plano_medidas`

id_empresa text NN, ano smallint NN, plano jsonb NN, updated_at timestamp with time zone NN, id_relatorio text NN

### `drps_probabilidades`

id_empresa text NN, setor text NN, topico_idx smallint NN, probabilidade smallint NN, updated_at timestamp with time zone NN, id_relatorio text NN

### `drps_probabilidades_unidade`

id_relatorio text NN, id_empresa text NN, unidade text NN, setor text NN, topico_idx smallint NN, probabilidade smallint NN, updated_at timestamp with time zone NN

### `drps_relatorios`

id_relatorio text NN, id_empresa text NN, revisao smallint NN, status text NN, data_elaboracao date, responsavel_tecnico text, crp text, funcoes text, qtd_trabalhadores integer, qtd_homens integer, qtd_mulheres integer, agravos_saude_mental text, medidas_existentes text, usuario_email text, created_at timestamp with time zone NN, updated_at timestamp with time zone, conclusoes_por_setor jsonb, agravos_por_setor jsonb, medidas_por_setor jsonb, conclusao_geral text, data_conclusao timestamp with time zone, data_validade date, data_envio_cliente timestamp with time zone, conclusoes_por_unidade_setor jsonb, agravos_por_unidade_setor jsonb, medidas_por_unidade_setor jsonb, exibir_sem_analise boolean NN, fontes_por_setor jsonb NN

### `drps_respondentes`

id_respondente uuid NN, id_empresa text NN, setor text NN, cargo text, respostas ARRAY NN, data_carimbo timestamp with time zone, importado_em timestamp with time zone NN, lote_importacao uuid NN, id_relatorio text NN, unidade_trabalho text

### `drps_revisao`

id_empresa text NN, checklist jsonb NN, equipe jsonb NN, anotacoes text, updated_at timestamp with time zone NN, id_relatorio text NN

### `drps_texto_padrao`

id_capitulo text NN, ordem integer NN, titulo text NN, conteudo text, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, caixas_texto jsonb, bg_imagem_url text, posicao_pdf text NN, orientacao text NN, quebra_pagina text NN, tipo text NN, slug_fixo text

## Dimensionamento

### `dim_clientes_porte`

codigo text NN, nome text NN, porte text NN, cnpj text, condicao text, updated_at timestamp with time zone NN

### `dim_colaborador_unidades`

colaborador_id uuid NN, unidade_id uuid NN, percentual numeric NN, created_at timestamp with time zone NN

### `dim_colaboradores`

id uuid NN, nome text NN, funcao_id uuid NN, empresas_dia numeric NN, inspecoes_dia numeric NN, relatorios_dia numeric NN, data_admissao date, data_desligamento date, custo_mensal numeric, created_at timestamp with time zone NN, updated_at timestamp with time zone NN, sem_producao_diaria boolean NN, gestao boolean NN

### `dim_demanda_mensal`

unidade_id uuid NN, ano smallint NN, mes smallint NN, condicao text NN, porte text NN, quantidade integer NN, updated_at timestamp with time zone NN

### `dim_documentos`

id uuid NN, nome text NN, horas numeric NN, periodicidade_meses integer NN, responsavel text NN, created_at timestamp with time zone NN, updated_at timestamp with time zone NN

### `dim_funcoes`

id uuid NN, nome text NN, tipo_producao text NN, ordem integer NN, chefia boolean NN, coordena text NN, responde_para uuid, custo_mensal numeric NN, created_at timestamp with time zone NN, updated_at timestamp with time zone NN

### `dim_historico`

id bigint NN, quando timestamp with time zone NN, usuario_id uuid, usuario_email text, usuario_nome text, tabela text NN, operacao text NN, registro_id text, antes jsonb, depois jsonb

### `dim_parametros`

id smallint NN, dias_uteis ARRAY NN, ocupacao_alvo numeric NN, prazo_dias integer NN, rampup ARRAY NN, updated_at timestamp with time zone NN

### `dim_portes`

codigo text NN, nome text NN, peso numeric NN, ordem smallint NN

### `dim_sincronizacao_sst`

id bigint NN, executado_em timestamp with time zone NN, ano integer NN, unidade_id uuid, codigo_api text, cobertura text, ultima_varredura_em timestamp with time zone, documentos integer NN, demanda_gravada integer NN, atendidas_gravadas integer NN, aplicada boolean NN, mensagem text

### `dim_unidade_mes`

unidade_id uuid NN, ano smallint NN, mes smallint NN, clientes_ativos integer NN, atendidas integer NN, atendidas_porte jsonb NN, updated_at timestamp with time zone NN

### `dim_unidades`

id uuid NN, nome text NN, codigo_api text, created_at timestamp with time zone NN, updated_at timestamp with time zone NN

## EPI

### `epi_catalogo`

id text NN, empresa_id text NN, nome text NN, tipo text NN, ca_numero text, ca_validade date, fabricante text, descricao text, unidade text NN, estoque_minimo numeric NN, foto_url text, foto_path text, ativo boolean NN, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone

### `epi_colaboradores`

id text NN, empresa_id text NN, nome text NN, cpf text, matricula text, cargo text, setor text, ativo boolean NN, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone, biometria_template text, biometria_cadastrada_em timestamp with time zone, biometria_consentimento_em timestamp with time zone, biometria_expurgada_em timestamp with time zone

### `epi_entrega_assinaturas`

id text NN, id_entrega text NN, empresa_id text NN, id_colaborador text, assinante_nome text, assinatura_png text, pdf_sha256 text, user_agent text, ip text, assinado_em timestamp with time zone NN, criado_por text, criado_em timestamp with time zone NN, metodo text NN, finger_hash text, device_info text, qualidade text, consentimento_em timestamp with time zone, verificado boolean NN, match_score integer

### `epi_entregas`

id text NN, empresa_id text NN, id_colaborador text NN, data_entrega date NN, responsavel_entrega text, observacao text, total_itens integer NN, status text NN, assinatura_recebedor text, criado_por text, criado_em timestamp with time zone NN

### `epi_entregas_itens`

id text NN, id_entrega text NN, empresa_id text NN, id_catalogo text NN, nome_epi text, ca_numero text, quantidade numeric NN, criado_em timestamp with time zone NN

### `epi_importacoes_nfe`

id text NN, empresa_id text NN, chnfe text NN, fornecedor_cnpj text, fornecedor_nome text, numero_nf text, data_emissao date, xml_nome text, total_itens integer NN, itens_lancados integer NN, status text NN, criado_por text, criado_em timestamp with time zone NN

### `epi_importacoes_nfe_itens`

id text NN, id_importacao text NN, empresa_id text NN, cprod text, xprod text, ncm text, unidade text, quantidade numeric NN, valor_unitario numeric, id_catalogo text, status_map text NN, criado_em timestamp with time zone NN

### `epi_movimentacoes`

id text NN, empresa_id text NN, id_catalogo text NN, tipo text NN, quantidade numeric NN, origem text NN, ref_id text, motivo text, responsavel text, criado_por text, criado_em timestamp with time zone NN

### `epi_transferencias`

id text NN, empresa_origem text NN, empresa_destino text NN, observacao text, total_itens integer NN, criado_por text, criado_em timestamp with time zone NN

### `epi_transferencias_itens`

id text NN, id_transferencia text NN, empresa_origem text NN, empresa_destino text NN, id_catalogo_origem text NN, id_catalogo_destino text NN, nome_epi text, quantidade numeric NN, criado_em timestamp with time zone NN

## Equipamentos

### `equipamentos`

id_equipamento text NN, id_unidade text NN, nome text NN, tipo text, fabricante text, modelo text, numero_serie text, numero_patrimonio text, codigo_interno text, tag text, status text NN, fornecedor text, nota_fiscal text, data_aquisicao date, valor_aquisicao numeric, garantia_ate date, termo_garantia_path text, setor text, localizacao text, responsavel text, foto_url text, foto_path text, foto_thumb_path text, observacoes text, id_inventario_origem text, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone, id_catalogo text, id_colaborador text, entregue_em timestamp with time zone

### `equipamentos_catalogo`

id_catalogo text NN, nome text NN, tipo text, fabricante text, modelo text, unidade_medida text NN, estoque_minimo numeric NN, controla_individual boolean NN, foto_url text, foto_path text, foto_thumb_path text, ativo boolean NN, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone

### `equipamentos_devolucao_assinaturas`

id_assinatura text NN, id_devolucao text NN, id_unidade text NN, assinante_nome text, assinante_email text, metodo text NN, assinatura_png text, user_agent text, ip text, assinado_em timestamp with time zone NN, criado_por text, criado_em timestamp with time zone NN

### `equipamentos_devolucoes`

id_devolucao text NN, id_unidade text NN, id_colaborador text NN, id_entrega text, data_devolucao date NN, recebido_por text, observacao text, total_itens integer NN, criado_por text, criado_em timestamp with time zone NN

### `equipamentos_devolucoes_itens`

id_item text NN, id_devolucao text NN, id_unidade text NN, id_catalogo text, id_equipamento text, nome_equipamento text, numero_serie text, numero_patrimonio text, quantidade numeric NN, estado_retorno text NN, observacao_estado text, criado_em timestamp with time zone NN

### `equipamentos_entrega_assinaturas`

id_assinatura text NN, id_entrega text NN, id_unidade text NN, id_colaborador text, assinante_nome text, metodo text NN, assinatura_png text, pdf_sha256 text, user_agent text, ip text, consentimento_em timestamp with time zone, assinado_em timestamp with time zone NN, criado_por text, criado_em timestamp with time zone NN

### `equipamentos_entregas`

id_entrega text NN, id_unidade text NN, id_colaborador text NN, data_entrega date NN, responsavel_entrega text, observacao text, total_itens integer NN, status text NN, criado_por text, criado_em timestamp with time zone NN, emitido_em timestamp with time zone, emitido_por text, cancelado_em timestamp with time zone, cancelado_por text, cancelado_motivo text

### `equipamentos_entregas_historico`

id_historico text NN, id_entrega text NN, id_unidade text NN, acao text NN, campo text, valor_antes text, valor_depois text, motivo text, usuario_email text, criado_em timestamp with time zone NN

### `equipamentos_entregas_itens`

id_item text NN, id_entrega text NN, id_unidade text NN, id_catalogo text, id_equipamento text, nome_equipamento text, numero_serie text, numero_patrimonio text, quantidade numeric NN, devolvido_em timestamp with time zone, criado_em timestamp with time zone NN

### `equipamentos_importacoes_nfe`

id_importacao text NN, id_unidade text NN, chnfe text NN, fornecedor_cnpj text, fornecedor_nome text, numero_nf text, data_emissao date, valor_total numeric, xml_nome text, total_itens integer NN, itens_lancados integer NN, status text NN, criado_por text, criado_em timestamp with time zone NN

### `equipamentos_importacoes_nfe_itens`

id_item text NN, id_importacao text NN, id_unidade text NN, cprod text, xprod text, ncm text, unidade_medida text, quantidade numeric, valor_unitario numeric, id_catalogo text, status_map text NN, criado_em timestamp with time zone NN

### `equipamentos_movimentacoes`

id_movimentacao text NN, id_catalogo text NN, id_unidade text NN, tipo text NN, quantidade numeric NN, origem text NN, ref_id text, motivo text, responsavel text, criado_por text, criado_em timestamp with time zone NN

### `equipamentos_status_historico`

id_historico text NN, id_equipamento text NN, id_unidade text NN, status_anterior text, status_novo text NN, motivo text NN, motivo_codigo text, id_equipamento_substituto text, usuario_email text, criado_em timestamp with time zone NN

## Escala de supervisores

### `escala_dias`

id_dia text NN, id_supervisor text NN, data date NN, unidade_ids ARRAY NN, situacao text, origem text NN, observacao text, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `escala_feriados`

id_feriado text NN, data date NN, descricao text NN, abrangencia text NN, municipio text, tipo text NN, created_at timestamp with time zone NN

### `escala_log`

id_log text NN, id_dia text, id_supervisor text, data date, ator_email text NN, valor_anterior jsonb, valor_novo jsonb, criado_em timestamp with time zone NN

### `escala_padrao_semanal`

id_padrao text NN, id_supervisor text NN, dia_semana integer NN, unidade_ids ARRAY NN, situacao text, vigencia_inicio date NN, vigencia_fim date, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `escala_regras`

id_regra text NN, codigo text NN, descricao text NN, parametros jsonb NN, ativa boolean NN, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `escala_supervisores`

id_supervisor text NN, nome text NN, nome_resumido text, funcao text, usuario_email text, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `escala_unidade_config`

id_unidade text NN, cor_hex text NN, ordem integer NN, municipio text, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

## Frota

### `frota_abastecimento_anexos`

id_anexo text NN, id_abastecimento text NN, arquivo_path text NN, mime text NN, nome_arquivo text NN, bytes integer NN, thumb_path text, criado_por text, criado_em timestamp with time zone NN

### `frota_abastecimentos`

id_abastecimento text NN, id_veiculo text NN, data_hora timestamp with time zone NN, condutor_nome text NN, km_odometro integer, tipo_combustivel text NN, litros numeric, valor_litro numeric, valor_total numeric, posto text, cidade_uf text, forma_pagamento text, numero_cupom text, tanque_cheio boolean NN, id_checklist_origem text, criado_por text, criado_em timestamp with time zone NN

### `frota_checklist_fotos`

id_foto text NN, id_checklist text NN, angulo text NN, thumb_path text NN, vista_path text NN, original_path text, legenda text, ordem integer NN, criado_em timestamp with time zone NN

### `frota_checklists`

id_checklist text NN, id_veiculo text NN, id_unidade text NN, condutor_nome text NN, data_saida timestamp with time zone NN, km_saida integer NN, avarias_constatadas text, observacoes text, endereco_cep text, endereco_logradouro text NN, endereco_numero text, endereco_complemento text, endereco_bairro text, endereco_cidade text NN, endereco_uf character NN, endereco_ponto_referencia text, latitude numeric, longitude numeric, maps_url text, status text NN, finalizado_em timestamp with time zone, finalizado_por text, data_retorno timestamp with time zone, km_retorno integer, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone, retorno_por text, retorno_em timestamp with time zone, avarias_retorno text, retorno_observacao text

### `frota_lotacoes`

id_lotacao text NN, id_veiculo text NN, id_unidade_origem text, id_unidade_destino text NN, data_movimentacao timestamp with time zone NN, motivo text, responsavel_nome text, observacao text, km_percorrido integer, km_odometro integer, criado_por text, criado_em timestamp with time zone NN

### `frota_manutencoes`

id_manutencao text NN, id_veiculo text NN, tipo text NN, status text NN, data_entrada date NN, data_saida date, km_odometro integer, descricao text NN, oficina text, nota_fiscal text, valor numeric, proxima_revisao_data date, proxima_revisao_km integer, id_sinistro_origem text, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone

### `frota_rotas`

id_rota text NN, id_checklist text NN, ordem integer NN, origem text NN, destino text NN, km_percorrido integer, data date, finalidade text, observacao text, criado_em timestamp with time zone NN

### `frota_sinistro_fotos`

id_foto text NN, id_sinistro text NN, thumb_path text NN, vista_path text NN, original_path text, legenda text, ordem integer NN, criado_em timestamp with time zone NN

### `frota_sinistros`

id_sinistro text NN, id_veiculo text NN, data_ocorrencia date NN, hora_ocorrencia time without time zone, tipo text NN, gravidade text, com_vitima boolean NN, descricao text NN, condutor_nome text, local_ocorrencia text, latitude numeric, longitude numeric, boletim_ocorrencia text, seguradora text, numero_aviso_sinistro text, valor_franquia numeric, valor_prejuizo numeric, status text NN, id_checklist_origem text, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone

### `frota_veiculo_fotos`

id_foto text NN, id_veiculo text NN, thumb_path text NN, vista_path text NN, original_path text, legenda text, ordem integer NN, largura integer, altura integer, bytes integer, criado_por text, criado_em timestamp with time zone NN

### `frota_veiculos`

id_veiculo text NN, id_unidade text NN, placa text NN, modelo text NN, marca text, ano_fabricacao integer, ano_modelo integer, cor text, renavam text, chassi text, tipo text, avarias_padrao text, observacoes text, km_cadastro integer NN, km_atual integer, km_atual_em timestamp with time zone, km_atual_origem text, status text NN, foto_capa_path text, foto_capa_thumb_path text, criado_por text, criado_em timestamp with time zone NN, updated_at timestamp with time zone

## Gestão (kanban)

### `gestao_acesso_log`

id uuid NN, ator_email text NN, alvo_email text NN, acao USER-DEFINED NN, recurso_tipo USER-DEFINED, recurso_id text, nivel_anterior USER-DEFINED, nivel_novo USER-DEFINED, motivo text NN, created_at timestamp with time zone NN

### `gestao_acessos`

id uuid NN, id_quadro text, usuario_email text, papel text NN, created_at timestamp with time zone NN, recurso_tipo USER-DEFINED, recurso_id text, nivel USER-DEFINED, restritivo boolean NN, concedido_por text, id_equipe uuid

### `gestao_anexos`

id uuid NN, id_tarefa text NN, nome text NN, storage_path text NN, mime text, tamanho_bytes integer, created_by text, created_at timestamp with time zone NN

### `gestao_aprovacoes`

id uuid NN, id_tarefa text NN, solicitado_por text, aprovador_email text, status text NN, motivo text, decidido_em timestamp with time zone, created_at timestamp with time zone

### `gestao_atividades`

id uuid NN, ator text, acao text NN, id_tarefa text, payload jsonb NN, created_at timestamp with time zone NN

### `gestao_automacao_log`

id uuid NN, id_automacao uuid, id_tarefa text, gatilho text NN, resultado text NN, detalhe text, created_at timestamp with time zone NN, profundidade integer NN

### `gestao_automacoes`

id uuid NN, id_quadro text NN, nome text NN, ativo boolean NN, gatilho text NN, condicao jsonb NN, acao jsonb NN, ordem integer NN, created_at timestamp with time zone NN

### `gestao_campos`

id uuid NN, id_quadro text NN, nome text NN, tipo text NN, opcoes ARRAY NN, ordem integer NN, visivel_cliente boolean NN, created_at timestamp with time zone NN

### `gestao_comentarios`

id_comentario text NN, id_tarefa text NN, autor text, texto text NN, created_at timestamp with time zone NN

### `gestao_dependencias`

id uuid NN, id_tarefa text NN, depende_de text NN, created_at timestamp with time zone NN

### `gestao_equipe_membros`

id uuid NN, id_equipe uuid NN, usuario_email text NN, papel text NN, created_by text, created_at timestamp with time zone NN

### `gestao_equipes`

id uuid NN, nome text NN, descricao text, ativo boolean NN, created_by text, created_at timestamp with time zone NN

### `gestao_espacos`

id uuid NN, nome text NN, cor text NN, ordem integer NN, created_at timestamp with time zone NN

### `gestao_etiquetas`

id uuid NN, id_quadro text NN, nome text NN, cor text NN, ordem integer NN

### `gestao_filtros_salvos`

id uuid NN, usuario_email text NN, id_quadro text NN, nome text NN, criterios jsonb NN, created_at timestamp with time zone NN

### `gestao_formularios`

id uuid NN, id_quadro text NN, titulo text NN, descricao text, token text NN, ativo boolean NN, mostra_descricao boolean NN, mostra_prazo boolean NN, mostra_prioridade boolean NN, prioridade_padrao text NN, status_inicial text, responsavel_padrao text, etiquetas_padrao ARRAY NN, perguntas jsonb NN, created_by text, created_at timestamp with time zone NN, responsavel_email text, titulo_composicao jsonb, runrun_form_id bigint, origem jsonb

### `gestao_google_contas`

usuario_email text NN, refresh_token bytea NN, calendar_id text NN, sync_token text, channel_id text, channel_token text, channel_expira timestamp with time zone, ativo boolean NN, created_at timestamp with time zone NN

### `gestao_google_eventos`

id_tarefa text NN, usuario_email text NN, event_id text NN, etag text, updated_at timestamp with time zone

### `gestao_google_fila`

id bigint NN, id_tarefa text, operacao text NN, tentativas integer NN, processado_em timestamp with time zone, created_at timestamp with time zone NN

### `gestao_import_log`

id bigint NN, runrun_id bigint, id_tarefa text, board_runrun text, resultado text, detalhe text, created_at timestamp with time zone NN

### `gestao_membros`

id uuid NN, usuario_email text NN, papel USER-DEFINED NN, ativo boolean NN, adicionado_por text, created_at timestamp with time zone NN

### `gestao_notificacoes`

id uuid NN, destinatario text NN, tipo text NN, titulo text NN, id_tarefa text, id_quadro text, lida boolean NN, canal text NN, email_enviado boolean NN, created_at timestamp with time zone NN

### `gestao_pastas`

id uuid NN, id_espaco uuid NN, nome text NN, ordem integer NN, created_at timestamp with time zone NN

### `gestao_preferencias_visao`

id uuid NN, usuario_email text NN, id_quadro text NN, vista text NN, agrupar_por text, config jsonb NN, updated_at timestamp with time zone NN

### `gestao_quadros`

id_quadro text NN, nome text NN, descricao text, created_by text, created_at timestamp with time zone NN, updated_at timestamp with time zone, id_espaco uuid, id_pasta uuid, ordem integer NN, ics_token text, restrito boolean NN, dono_email text

### `gestao_status`

id uuid NN, id_quadro text NN, slug text NN, nome text NN, cor text NN, ordem integer NN, tipo text NN

### `gestao_subtarefa_modelos`

id uuid NN, id_quadro text NN, slug text NN, titulo text NN, itens jsonb NN, created_at timestamp with time zone

### `gestao_subtarefas`

id text NN, id_tarefa text NN, texto text NN, feito boolean NN, ordem integer NN, etapa text, tipo text, created_at timestamp with time zone NN, responsavel_email text

### `gestao_tarefa_historico`

id bigint NN, id_tarefa text NN, ator text, tipo text NN, campo text, de text, para text, created_at timestamp with time zone NN

### `gestao_tarefa_vinculados`

id uuid NN, id_tarefa text NN, usuario_email text NN, tipo text NN, origem text NN, created_at timestamp with time zone NN

### `gestao_tarefas`

id_tarefa text NN, id_quadro text NN, titulo text NN, descricao text, status text NN, prioridade text NN, responsavel text, prazo date, ordem integer NN, created_by text, created_at timestamp with time zone NN, updated_at timestamp with time zone, etiquetas ARRAY NN, subtarefas jsonb NN, data_inicio date, campos jsonb NN, recorrencia jsonb, pontos integer, runrun_id bigint, origem jsonb

### `gestao_tempo`

id uuid NN, id_tarefa text NN, usuario_email text NN, inicio timestamp with time zone NN, fim timestamp with time zone, segundos integer, manual boolean NN, descricao text, created_at timestamp with time zone NN

### `gestao_vinculo_log`

id uuid NN, ator_email text NN, alvo_email text NN, acao text NN, tipo text NN, id_tarefa text NN, created_at timestamp with time zone NN

## Inspeções

### `inspecao_associados`

id text NN, id_inspecao text NN, id_usuario text NN, nome text NN, created_by text, created_at timestamp with time zone NN

### `inspecao_maquinas`

id_maquina_inspecao uuid NN, id_inspecao text NN, id_empresa text, id_setor text, nome text NN, tipo text, marca text, modelo text, numero_serie text, tag text, ano_fabricacao integer, potencia text, tensao text, protecao_fixa boolean, protecao_movel boolean, intertravamento boolean, botao_emergencia boolean, sistema_bloqueio boolean, possui_manual boolean, aterramento boolean, sinalizacao boolean, necessita_adequacao_nr12 boolean, grau_risco text, observacoes text, parecer_ia text, foto_urls ARRAY, foto_storage_paths ARRAY, ordem integer NN, ativo boolean NN, usuario_email text, usuario_nome text, created_at timestamp with time zone NN, updated_at timestamp with time zone, operadores jsonb

### `inspecao_maquinas_setores`

id_maquina_inspecao uuid NN, id_setor text NN

## Inspeções (Painel SST)

### `acoes_5w2h`

id_acao text NN, id_empresa text NN, id_setor text, id_risco text, id_inspecao text, what_acao text NN, why_justificativa text, where_local text, when_prazo date, who_responsavel text, how_metodo text, how_much_custo text, status text NN, prioridade text NN, data_conclusao date, observacoes text, created_by text, created_at timestamp with time zone NN, updated_at timestamp with time zone, id_apreciacao_item text, id_apreciacao_acao text, id_risco_origem text, id_aet_acao text

### `anexos`

id_anexo uuid NN, modulo text NN, id_referencia text NN, nome text NN, descricao text, storage_path text NN, url text NN, mime text, tamanho_bytes bigint, tipo text NN, ordem integer NN, incluir_no_pdf boolean NN, criado_por text, created_at timestamp with time zone NN, empresa_id text, vinculo_tipo text, vinculo_id text, validade date, obrigatorio boolean NN, capitulo_destino text, mostrar_no_corpo boolean NN

### `cargos`

id_cargo text NN, id_inspecao text, id_empresa text, id_setor text, cargo text NN, descricao text, created_at timestamp with time zone

### `complementos`

id_complemento text NN, id_inspecao text, id_empresa text, id_setor text, tipo text, titulo text, descricao text, dados text, created_at timestamp with time zone

### `epi_epc`

id_protecao text NN, id_risco text, id_inspecao text, id_empresa text, id_setor text, tipo text, descricao text NN, ca text, recomendado text, fotos_urls ARRAY NN, fotos_storage_paths ARRAY NN

### `extintores`

id_extintor text NN, id_inspecao text NN, id_empresa text NN, id_setor text, tipo_agente text NN, capacidade text, numero_identificacao text, localizacao text, data_validade date, status text, observacoes text, ordem integer NN, ativo boolean NN, created_at timestamp with time zone, updated_at timestamp with time zone, fotos_urls ARRAY NN, fotos_storage_paths ARRAY NN, situacao text, nao_conformidades ARRAY NN

### `fotos`

id_foto text NN, id_inspecao text, id_empresa text, id_setor text, categoria text, legenda text, arquivo_foto text, storage_path text, data_upload timestamp with time zone, usuario text

### `inspecoes`

id_inspecao text NN, id_empresa text, data_inspecao date, status text, revisao integer, responsavel text, observacoes text, tipo_criacao text, id_inspecao_base text, usuario text, created_at timestamp with time zone, updated_at timestamp with time zone, data_validade date, elaboracao_concluida_em timestamp with time zone, elaboracao_responsavel text, elaboracao_status text, concluida_em timestamp with time zone

### `pae_contatos`

id_contato text NN, id_inspecao text NN, id_empresa text NN, id_parent text, nome text NN, cargo text, telefone text, ordem integer NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `responsaveis`

id_responsavel text NN, id_inspecao text, id_empresa text, tecnico_responsavel text, recepcionado_por text, cargo text, data_hora timestamp with time zone, id_usuario text

### `riscos`

id_risco text NN, id_inspecao text, id_empresa text, id_setor text, id_cargo text, tipo_risco text, agente text, fonte_geradora text, probabilidade text, severidade text, nivel_risco text, situacao text, tempo_exposicao text, tecnica_utilizada text, concentracao_exposicao text, limite_tolerancia text, insalubridade text, periculosidade text, numero_cas text, via_absorcao text, tipo_agente_biologico text, fator_ergonomico text, fator_psicossocial text, pontuacao_iapat text, medidas_adotadas text, medidas_recomendadas text, observacoes_risco text, meio_propagacao ARRAY, fisico_necessita_medicao text, fisico_qual_medicao text, fisico_motivo_medicao text, quim_q1 text, quim_q2 text, quim_q3 text, quim_q4 text, quim_q5 text, quim_q6 text, uso_processo text, foto_quim_url text, created_at timestamp with time zone, updated_at timestamp with time zone, respostas_custom jsonb, id_matriz text, id_modelo text

### `setores`

id_setor text NN, id_inspecao text, id_empresa text, setor_ghe text NN, descricao text, conformidade text, nao_conformidade text, created_at timestamp with time zone

## Inspeções — treinamentos

### `treinamentos_cargo`

id_treinamento text NN, id_cargo text NN

### `treinamentos_nr`

id_treinamento text NN, id_inspecao text NN, id_empresa text NN, nr text NN, titulo text NN, descricao text, carga_horaria text, periodicidade text, observacoes text, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `treinamentos_risco`

id_treinamento text NN, id_risco text NN

### `treinamentos_setor`

id_treinamento text NN, id_setor text NN

## Investigação de acidente

### `investigacao_acoes`

id_acao text NN, id_investigacao text NN, ordem integer NN, what_acao text NN, why_justificativa text, where_local text, when_prazo text, who_responsavel text, how_metodo text, how_much_custo text, status text NN, prioridade text NN, data_conclusao date, observacoes text, created_by text, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `investigacoes_acidente`

id_investigacao text NN, id_empresa text NN, data_acidente date, hora_acidente text, local_acidente text, setor text, data_investigacao date, responsavel_tecnico text, numero_cat text, data_cat date, acidentado_nome text, acidentado_cargo text, acidentado_admissao date, tipo_acidente text, houve_afastamento boolean NN, dias_afastamento integer, gravidade text, descricao text, agente_causador text, parte_corpo text, natureza_lesao text, cid text, testemunhas jsonb NN, causas_imediatas text, causas_basicas text, cinco_porques jsonb NN, medidas text, conclusao text, foto_urls ARRAY NN, foto_legendas ARRAY NN, status text NN, data_validade date, created_at timestamp with time zone NN, updated_at timestamp with time zone, setores ARRAY NN, acidentado_funcoes ARRAY NN, partes_corpo ARRAY NN, ishikawa jsonb NN, qtd_acidentados integer, consequencias ARRAY NN, fatores_morbi ARRAY NN, acidentado_cpf text, acidentado_pis text, acidentado_estado_civil text, acidentado_nascimento date, acidentado_escolaridade text, acidentado_telefone text, acidentado_endereco text, acidentado_cbo text, acidentado_tempo_funcao text, acidentado_tempo_empresa text, acidentado_jornada text, acidentado_tempo_apos_inicio text, pessoas_envolvidas jsonb NN, organizacao_trabalho jsonb NN, atividade_momento text, relatos_envolvidos jsonb NN, croqui jsonb NN, mapa_riscos jsonb NN, fotos_anteriores jsonb NN, fotos_momento jsonb NN, fotos_atuais jsonb NN, videos jsonb NN, fatores_contribuintes jsonb NN, laudos_externos jsonb NN, analise_equipe text, consultores jsonb NN, analise_links jsonb NN, medidas_adotadas text, cronogramas jsonb NN, fotos_pos jsonb NN, responsavel_legal_nome text, responsavel_legal_cargo text, responsavel_legal_data date

## Não conformidade (RNC)

### `relatorios_nao_conformidade`

id_relatorio text NN, id_empresa text NN, titulo text NN, setor text, responsavel text, responsavel_empresa text, cidade text, data_inspecao date, observacoes_gerais text, status text NN, finalizado_em timestamp with time zone, usuario_email text, usuario_nome text, created_at timestamp with time zone NN, updated_at timestamp with time zone, nr_codigo text, nr_titulo text, data_validade date

### `relatorios_nao_conformidade_itens`

id_item text NN, id_relatorio text NN, ordem integer NN, descricao text NN, norma_violada text, criticidade text NN, causa_raiz text, acao_corretiva text, prazo date, responsavel_tratativa text, status_tratativa text NN, foto_urls ARRAY NN, foto_storage_paths ARRAY NN, created_at timestamp with time zone NN, updated_at timestamp with time zone, item_codigo_origem text

## PDFs

### `pdfs_assinados`

id uuid NN, tabela text NN, doc_id text NN, pdf_path text NN, assinado_em timestamp with time zone NN, assinado_por text NN

### `pdfs_gerados`

id uuid NN, modulo text NN, tipo_documento text, id_relatorio text, empresa_id text, empresa_nome text, empresa_cnpj text, setor text, responsavel_tecnico text, usuario_email text, data_geracao timestamp with time zone NN, status text NN, versao integer NN, pdf_storage_path text, pdf_url text, pdf_assinado_url text, assinado boolean NN, data_assinatura timestamp with time zone, observacoes text, hash_sha256 text, created_at timestamp with time zone NN

## Portal do cliente

### `portal_anexos`

id text NN, empresa_id text NN, referencia_tipo text NN, referencia_id text NN, nome_arquivo text NN, storage_path text NN, tamanho_bytes integer, mime_type text, criado_por text, criado_em timestamp with time zone NN

### `portal_comentarios`

id text NN, empresa_id text NN, referencia_tipo text NN, referencia_id text NN, texto text NN, criado_por text, criado_em timestamp with time zone NN

### `portal_documentos_cliente`

id text NN, empresa_id text NN, titulo text NN, tipo_documento text NN, modulo_origem text NN, arquivo_pdf_url text, status text NN, versao integer NN, data_emissao date, data_validade date, criado_por text, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN, referencia_tipo text, referencia_id text

### `portal_pendencias_cliente`

id text NN, empresa_id text NN, titulo text NN, descricao text, status text NN, prioridade text NN, prazo date, criado_por text, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN

### `portal_solicitacoes_cliente`

id text NN, empresa_id text NN, tipo_solicitacao text NN, descricao text NN, prioridade text NN, status text NN, criado_por text, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN

## Produtividade (legado)

### `prod_colaborador_unidade`

id uuid NN, id_colaborador uuid NN, id_unidade uuid NN, percentual smallint NN, criado_em timestamp with time zone NN

### `prod_colaboradores`

id uuid NN, id_unidade uuid NN, nome text NN, tipo text NN, capacidade_docs_mes integer NN, capacidade_visitas_mes integer NN, ativo boolean NN, criado_em timestamp with time zone NN

### `prod_documentos_sst`

id uuid NN, id_empresa text NN, nome_empresa text, id_unidade uuid NN, tipo_documento text NN, status text NN, data_emissao date, data_vencimento date, responsavel_nome text, observacoes text, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN

### `prod_projecoes_salvas`

id uuid NN, titulo text NN, tipo text NN, id_unidade uuid, nome_unidade text, dias_uteis integer NN, adms_atuais integer NN, tecnicos_atuais integer NN, docs_por_adm_dia numeric NN, insp_por_tec_dia numeric NN, dados_unidades jsonb NN, observacao text, comentarios text, total_clientes integer, pend_inspecao integer, pend_docs integer, adms_necessarios integer, tecs_necessarios integer, adms_adicionais integer, tecs_adicionais integer, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN, mes smallint, ano smallint

### `prod_registros_mensais`

id uuid NN, id_unidade uuid NN, id_colaborador uuid NN, mes integer NN, ano integer NN, docs_gerados integer NN, visitas_realizadas integer NN, levantamentos_enviados integer NN, docs_ssg integer NN, criado_em timestamp with time zone NN

### `prod_snapshot_mensal`

id uuid NN, id_unidade uuid NN, mes smallint NN, ano smallint NN, clientes_pagantes integer NN, clientes_cortesia integer NN, vencidos integer NN, vencendo integer NN, inspecao_pendente integer NN, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone NN

### `prod_unidades`

id uuid NN, nome text NN, cidade text, responsavel text, ativo boolean NN, criado_em timestamp with time zone NN

## Psicossocial — compartilhado

### `psi_fontes_geradoras`

id uuid NN, modulo text NN, chave text NN, texto text NN, criado_por text, criado_em timestamp with time zone NN

## Questionários psicossociais (QPS)

### `qps_aplicacoes`

id_aplicacao uuid NN, id_tipo uuid NN, id_empresa text NN, titulo text NN, status text NN, responsavel text, periodo_inicio date, periodo_fim date, usuario_email text, usuario_nome text, criado_em timestamp with time zone NN, atualizado_em timestamp with time zone, observacoes_dimensoes jsonb, trabalhadores_previstos integer, unidade_cliente text, agravos_por_setor jsonb, medidas_por_setor jsonb, conclusoes_por_setor jsonb, crp text, data_elaboracao date, fontes_por_setor jsonb NN

### `qps_categorias`

id_categoria uuid NN, id_tipo uuid NN, nome text NN, descricao text, ordem integer NN, fonte_geradora text

### `qps_monitoramento`

id_aplicacao uuid NN, setor text NN, id_categoria uuid NN, data_intervencao date, responsavel text, status text NN, proxima_avaliacao date, observacoes text, updated_at timestamp with time zone NN

### `qps_perguntas`

id_pergunta uuid NN, id_categoria uuid NN, texto text NN, logica text NN, ordem integer NN, ativo boolean NN, opcoes jsonb

### `qps_plano_acao_5w2h`

id uuid NN, id_aplicacao uuid NN, ordem integer NN, acao text, justificativa text, onde text, prazo text, responsavel text, como text, quanto_custa text, status text NN, created_at timestamp with time zone NN, updated_at timestamp with time zone

### `qps_plano_medidas`

id_aplicacao uuid NN, ano smallint NN, plano jsonb NN, updated_at timestamp with time zone NN

### `qps_probabilidades`

id_aplicacao uuid NN, setor text NN, id_categoria uuid NN, probabilidade integer NN, atualizado_em timestamp with time zone NN

### `qps_respondentes`

id_respondente uuid NN, id_aplicacao uuid NN, setor text NN, cargo text, respostas jsonb NN, lote text, importado_em timestamp with time zone NN

### `qps_revisao`

id_aplicacao uuid NN, checklist jsonb NN, equipe jsonb NN, anotacoes text, updated_at timestamp with time zone NN

### `qps_tipos`

id_tipo uuid NN, nome text NN, descricao text, instrucoes text, escala_min integer NN, escala_max integer NN, ativo boolean NN, criado_em timestamp with time zone NN

## SGG / Gestão gerencial

### `gg_ausencias`

id text NN, id_profissional text NN, tipo text NN, data_inicio date NN, data_fim date NN, obs text, created_at timestamp with time zone NN

### `gg_categorias`

id text NN, nome text NN, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, id_unidade text NN

### `gg_escala_padrao`

id text NN, id_profissional text NN, id_unidade text NN, dia_semana integer NN, id_turno text NN, created_at timestamp with time zone NN, tipo text NN

### `gg_profissionais`

id text NN, nome text NN, ativo boolean NN, created_at timestamp with time zone NN

### `gg_profissional_unidades`

id text NN, id_profissional text NN, id_unidade text NN, created_at timestamp with time zone NN, id_categoria text

### `gg_substituicoes`

id text NN, id_unidade text NN, data date NN, id_turno text NN, id_ausente text NN, id_substituto text NN, created_at timestamp with time zone NN

### `gg_turnos`

id text NN, nome text NN, ordem integer NN, ativo boolean NN, created_at timestamp with time zone NN, id_unidade text NN

## Sistema — auditoria

### `auditoria_eventos`

id bigint NN, ocorrido_em timestamp with time zone NN, tabela text NN, registro_id text, acao text NN, modulo text NN, id_empresa text, titulo text, usuario_email text, usuario_role text, campos_alterados ARRAY NN, antes jsonb, depois jsonb, busca tsvector, usuario_origem text

### `auditoria_tabelas`

tabela text NN, modulo text NN, pk_colunas ARRAY NN, coluna_titulo text, ativo boolean NN, criado_em timestamp with time zone NN

## Sistema — novidades

### `novidades_avisos`

id_aviso text NN, data date NN, tipo text NN, titulo text NN, texto text NN, onde text, impacto text, destaque boolean NN, ativo boolean NN, criado_por text, created_at timestamp with time zone NN, updated_at timestamp with time zone NN

### `novidades_vistas`

usuario_email text NN, ids_vistos ARRAY NN, visto_ate timestamp with time zone NN, updated_at timestamp with time zone NN

## Sistema — presença

### `presenca_encerramentos`

id bigint NN, usuario_email text NN, pedido_em timestamp with time zone NN, pedido_por text, atendido_em timestamp with time zone, sessoes_apagadas integer NN

### `presenca_pings`

usuario_email text NN, bloco timestamp with time zone NN, primeiro_em timestamp with time zone NN, ultimo_em timestamp with time zone NN, pings integer NN, origem text

## Sistema — trava por módulo

### `rls_modulo_config`

chave text NN, modo text NN, desde timestamp with time zone NN, revisar_em date NN, alterado_em timestamp with time zone, alterado_por text

### `rls_modulo_log`

email text NN, id_usuario text, modulo text NN, tabela text NN, dia date NN, vezes integer NN, primeira_em timestamp with time zone NN, ultima_em timestamp with time zone NN, ultimo_metodo text, ultimo_path text, bloqueado boolean NN, ultima_tela text

### `rls_modulo_tabelas`

tabela text NN, modulo text NN

## Textos padrão

### `textos_padrao`

id_capitulo text NN, modulo text NN, ordem integer NN, titulo text NN, conteudo text, bg_imagem_url text, caixas_texto jsonb, ativo boolean NN, created_at timestamp with time zone NN, updated_at timestamp with time zone, orientacao text NN, quebra_pagina text NN, posicao_pdf text NN, tipo text NN, slug_fixo text

### `textos_padrao_versoes`

id_versao uuid NN, id_capitulo text NN, versao integer NN, modulo text NN, titulo text NN, conteudo text, bg_imagem_url text, caixas_texto jsonb, orientacao text, quebra_pagina text, posicao_pdf text, tipo text, slug_fixo text, ordem integer, ativo boolean, editado_por text, editado_em timestamp with time zone NN

## Storage (buckets)

| Bucket | Acesso | Uso |
|---|---|---|
| `fotos` | público | fotos de inspeções, setores AET, OWAS personalizados, equipamentos |
| `anexos` | público | anexos gerais |
| `atualizacoes`, `updates` | público | pacotes de atualização (legado do app desktop) |
| `certificados` | privado (só Admin) | certificados digitais A1 (.pfx) dos técnicos |
| `pdfs-gerados` | privado | PDFs gerados dos laudos |
| `pdfs-assinados` | privado | PDFs assinados (PAdES) |
| `portal-anexos` | privado | anexos do portal do cliente |

## Funções do banco (public) — por família

- **Permissão do chamador:** `caller_eh_admin`, `caller_pode_editar`, `caller_pode_ver_empresa(id_empresa)`, `caller_unidades`, `caller_pode_equipamentos`, `caller_pode_frota`, `caller_pode_transferir`, `caller_ve_presenca`, `caller_memo`, `caller_eh_servico`, `is_admin_caller`, `get_meu_perfil`, `get_minhas_empresas`, `pode_enviar_sgg`, `pode_escrever_quimicos`.
- **Trava por módulo:** `rls_modulo_ok(modulo, tabela)` (modo `log` ou `trava` em `rls_modulo_config`), `rls_modulo_tela`, `rls_modulo_por_tela`, `rls_modulo_resumo`, `modulo_abrir`.
- **Usuários (admin, SECURITY DEFINER):** `criar_usuario_admin`, `excluir_usuario_admin`, `redefinir_senha_admin`, `atualizar_email_admin` — usadas quando o servidor não tem `SUPABASE_SERVICE_ROLE_KEY`.
- **Auditoria:** `auditoria_registrar`, `auditoria_ativar/desativar`, `auditoria_ligar_tabela_nova` (liga sozinha em tabela nova), `auditoria_elegivel`, `auditoria_modulo_de`.
- **Presença:** `presenca_ping`, `presenca_resumo`, `presenca_trilha`, `presenca_uso_mensal`, `presenca_encerrar_sessao`, `presenca_limpar`.
- **Gestão (kanban):** `gestao_*` — acessos/níveis (`gestao_resolver_nivel`, `gestao_alterar_acesso`, `gestao_meu_nivel`), membros/equipes, automações (`gestao_automacao_run/tick/aplicar/prazos`, `gestao_cron_diario`), aprovações, vínculos, histórico, sincronização com Google Agenda (`gestao_google_*`).
- **SGG/Escala:** `gg_projecao_mensal`, `gg_sugerir_substitutos`, `escala_pascoa`, `escala_semear_feriados`, `set_elaboracao_documento`.
- **Dimensionamento:** `dim_definir_alocacoes`, `dim_substituir_demanda_ano`, `dim_aplicar_sincronizacao_sst`, `dim_checar_soma_alocacoes`, `dim_registrar_historico`.
- **EPI:** `epi_registrar_entrega`, `epi_assinar_entrega` (assinatura + biometria), `epi_importar_nfe`, `epi_transferir`, `epi_expurgar_biometria_inativo`.
- **Equipamentos:** `equipamento_lancar_entrada`, `equipamento_importar_nfe`, `equipamento_registrar_entrega/devolucao`, `equipamento_assinar_entrega`, `equipamento_transferir_estoque`, `equipamento_estornar_transferencia`, `equipamento_ajustar_saldo`, `equipamento_mudar_status`, `equip_entrega_*` (emitir, editar, cancelar, excluir, itens, histórico, hash do conteúdo).
- **Transferências (inventário entre bases):** `transferencia_abrir/aceitar/recusar/cancelar`.
- **Frota:** `frota_pode_veiculo`, `frota_pode_checklist`, triggers `frota_exige_4_fotos`, `frota_valida_retorno`, `frota_lotacao_*`.
- **Utilitários:** `grau_risco_por_cnae(cnae)`, `sem_acento(texto)`, `fn_drps_carimbo_envio` (carimba `data_envio_cliente`), `fn_textos_padrao_snapshot` (versões dos textos padrão), triggers de `updated_at`.
