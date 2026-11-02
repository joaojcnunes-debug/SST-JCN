-- v316 — Auditoria, Fase 3: a aba "Histórico" dentro do documento (02/11/2026).
-- Mesma mudança da v259 do Painel SST (25/09/2026), trazida no comparativo Painel × JCN. Antes de
-- aplicar: as 80 regras apontam para colunas que existem aqui, `auditoria_registrar()` tinha o mesmo
-- corpo do "antes" do Painel (rollback dele) e a policy de leitura era a mesma (caller_ve_presenca).
--
-- DECISÕES (Painel, 25/09/2026):
--   · o Histórico mostra o documento E os itens dele (risco, setor, foto, ação…);
--   · quem vê é quem consegue abrir o documento (Admin continua vendo tudo);
--   · entra nos 13 documentos que têm tela própria.
--
-- O PROBLEMA: um evento de risco guarda o id do RISCO; numa edição, o antes/
-- depois guarda só o que mudou, então o `id_inspecao` nem aparece. Achar "tudo
-- da inspeção X" pela trilha não dá sem saber, no momento da gravação, a que
-- documento a linha pertence.
--
-- O QUE FAZ:
--   1) `auditoria_eventos.doc_tabela` / `doc_id` + índice: o documento dono.
--   2) `auditoria_doc_regras`: "a tabela T pertence ao documento D pela coluna C"
--      (ou passando por uma tabela intermediária — os netos: vínculo de
--      treinamento → treinamento → inspeção). Várias regras por tabela, a 1ª que
--      achar vence (acoes_5w2h é de inspeção, de item da NR-12 OU de ação do AET).
--      `anexos` é genérico: a regra filtra pelo `modulo` da linha.
--   3) `auditoria_doc_de(tabela, linha)`: aplica as regras. Nunca lança.
--   4) `auditoria_registrar()` (a da v256, com UMA mudança): grava doc_tabela/doc_id.
--   5) Liga os eventos ANTIGOS ao documento (criou/excluiu pela linha guardada;
--      editou pelo evento irmão do mesmo registro, senão pela linha atual).
--   6) Leitura: a policy da v231 ganha um "ou" (Admin/Presença continuam vendo
--      tudo): quem não é Admin lê o evento se `auditoria_doc_visivel()` — que roda
--      com o acesso DA PESSOA e pergunta ao próprio documento "você me vê?". A
--      regra de acesso é a do documento, não uma cópia dela aqui.
--
-- Documento excluído some do Histórico de quem não é Admin (não dá mais para
-- abrir o documento); a Auditoria geral continua com tudo.
--
-- ROLLBACK: scripts/sql/v316_auditoria_historico_documento_rollback.sql
-- Idempotente.

-- ── 1) Colunas + índice ─────────────────────────────────────────────────────
alter table public.auditoria_eventos add column if not exists doc_tabela text;
alter table public.auditoria_eventos add column if not exists doc_id text;
comment on column public.auditoria_eventos.doc_tabela is
  'v259 — tabela do documento dono do registro (inspecoes, aet_relatorios…). NULL = não pertence a um dos 13 documentos.';
comment on column public.auditoria_eventos.doc_id is
  'v259 — id do documento dono (texto). Usado pela aba Histórico.';

create index if not exists auditoria_eventos_doc_idx
  on public.auditoria_eventos (doc_tabela, doc_id, id desc)
  where doc_id is not null;

-- ── 2) Regras ───────────────────────────────────────────────────────────────
create table if not exists public.auditoria_doc_regras (
  tabela       text not null,
  ordem        int  not null default 1,
  doc_tabela   text not null,
  -- Coluna DESTA tabela com o id do documento — ou, com via_tabela, o id da intermediária.
  coluna       text not null,
  -- Neto: busca `via_coluna` na `via_tabela` pela PK dela (de auditoria_tabelas).
  via_tabela   text,
  via_coluna   text,
  -- Tabela genérica: a regra só vale quando linha->>filtro_coluna = filtro_valor.
  filtro_coluna text,
  filtro_valor  text,
  primary key (tabela, ordem)
);
comment on table public.auditoria_doc_regras is
  'v259 — a que documento cada tabela pertence, para a aba Histórico. A 1ª regra (por ordem) que achar id vence.';

alter table public.auditoria_doc_regras enable row level security;
revoke all on public.auditoria_doc_regras from authenticated, anon;

-- Recria o conteúdo inteiro: a lista abaixo é a fonte da verdade.
delete from public.auditoria_doc_regras;
insert into public.auditoria_doc_regras (tabela, ordem, doc_tabela, coluna, via_tabela, via_coluna, filtro_coluna, filtro_valor) values
  -- Os 13 documentos: cada um é dono de si.
  ('inspecoes',                   1, 'inspecoes',                   'id_inspecao',     null, null, null, null),
  ('empresas',                    1, 'empresas',                    'id_empresa',      null, null, null, null),
  ('aet_relatorios',              1, 'aet_relatorios',              'id_relatorio',    null, null, null, null),
  ('aep_relatorios',              1, 'aep_relatorios',              'id_relatorio',    null, null, null, null),
  ('drps_relatorios',             1, 'drps_relatorios',             'id_relatorio',    null, null, null, null),
  ('relatorios_conformidade',     1, 'relatorios_conformidade',     'id_relatorio',    null, null, null, null),
  ('relatorios_nao_conformidade', 1, 'relatorios_nao_conformidade', 'id_relatorio',    null, null, null, null),
  ('apreciacoes_maquinas',        1, 'apreciacoes_maquinas',        'id_apreciacao',   null, null, null, null),
  ('analises_quimicos',           1, 'analises_quimicos',           'id_analise',      null, null, null, null),
  ('qps_aplicacoes',              1, 'qps_aplicacoes',              'id_aplicacao',    null, null, null, null),
  ('investigacoes_acidente',      1, 'investigacoes_acidente',      'id_investigacao', null, null, null, null),
  ('equipamentos',                1, 'equipamentos',                'id_equipamento',  null, null, null, null),
  ('frota_veiculos',              1, 'frota_veiculos',              'id_veiculo',      null, null, null, null),

  -- Inspeção: filhos diretos.
  ('setores',             1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('cargos',              1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('riscos',              1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('epi_epc',             1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('fotos',               1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('responsaveis',        1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('complementos',        1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('pae_contatos',        1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('treinamentos_nr',     1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('extintores',          1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('inspecao_maquinas',   1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('inspecao_associados', 1, 'inspecoes', 'id_inspecao', null, null, null, null),
  ('sgg_envios',          1, 'inspecoes', 'id_inspecao', null, null, null, null),
  -- Inspeção: netos.
  -- (2º caminho pelo setor/cargo/risco: quando o treinamento já foi excluído.)
  ('treinamentos_setor',        1, 'inspecoes', 'id_treinamento',      'treinamentos_nr',   'id_inspecao', null, null),
  ('treinamentos_setor',        2, 'inspecoes', 'id_setor',            'setores',           'id_inspecao', null, null),
  ('treinamentos_cargo',        1, 'inspecoes', 'id_treinamento',      'treinamentos_nr',   'id_inspecao', null, null),
  ('treinamentos_cargo',        2, 'inspecoes', 'id_cargo',            'cargos',            'id_inspecao', null, null),
  ('treinamentos_risco',        1, 'inspecoes', 'id_treinamento',      'treinamentos_nr',   'id_inspecao', null, null),
  ('treinamentos_risco',        2, 'inspecoes', 'id_risco',            'riscos',            'id_inspecao', null, null),
  ('inspecao_maquinas_setores', 1, 'inspecoes', 'id_maquina_inspecao', 'inspecao_maquinas', 'id_inspecao', null, null),

  -- Plano de ação central: de quem a ação for.
  ('acoes_5w2h', 1, 'inspecoes',            'id_inspecao',        null,                         null,            null, null),
  ('acoes_5w2h', 2, 'apreciacoes_maquinas', 'id_apreciacao_item', 'apreciacoes_maquinas_itens', 'id_apreciacao', null, null),
  ('acoes_5w2h', 3, 'apreciacoes_maquinas', 'id_apreciacao_acao', 'apreciacao_acoes',           'id_apreciacao', null, null),
  ('acoes_5w2h', 4, 'aet_relatorios',       'id_aet_acao',        'aet_acoes',                  'id_relatorio',  null, null),

  -- AET.
  ('aet_acoes',               1, 'aet_relatorios', 'id_relatorio', null, null, null, null),
  ('aet_laudo_fatores_psi',   1, 'aet_relatorios', 'id_relatorio', null, null, null, null),
  ('aet_laudo_qps_meta',      1, 'aet_relatorios', 'id_relatorio', null, null, null, null),
  ('aet_laudo_qps_respostas', 1, 'aet_relatorios', 'id_relatorio', null, null, null, null),

  -- DRPS.
  ('drps_respondentes',           1, 'drps_relatorios', 'id_relatorio', null, null, null, null),
  ('drps_probabilidades',         1, 'drps_relatorios', 'id_relatorio', null, null, null, null),
  ('drps_probabilidades_unidade', 1, 'drps_relatorios', 'id_relatorio', null, null, null, null),
  ('drps_monitoramento',          1, 'drps_relatorios', 'id_relatorio', null, null, null, null),
  ('drps_monitoramento_unidade',  1, 'drps_relatorios', 'id_relatorio', null, null, null, null),
  ('drps_plano_medidas',          1, 'drps_relatorios', 'id_relatorio', null, null, null, null),
  ('drps_plano_acao_5w2h',        1, 'drps_relatorios', 'id_relatorio', null, null, null, null),

  -- Conformidade / Não conformidade.
  ('relatorios_conformidade_itens',     1, 'relatorios_conformidade',     'id_relatorio', null, null, null, null),
  ('relatorios_nao_conformidade_itens', 1, 'relatorios_nao_conformidade', 'id_relatorio', null, null, null, null),

  -- Apreciação NR-12.
  ('apreciacao_fichas_maquina',  1, 'apreciacoes_maquinas', 'id_apreciacao', null, null, null, null),
  ('apreciacoes_maquinas_itens', 1, 'apreciacoes_maquinas', 'id_apreciacao', null, null, null, null),
  ('apreciacao_riscos_hrn',      1, 'apreciacoes_maquinas', 'id_apreciacao', null, null, null, null),
  ('apreciacao_acoes',           1, 'apreciacoes_maquinas', 'id_apreciacao', null, null, null, null),

  -- Questionários (QAP).
  ('qps_respondentes',    1, 'qps_aplicacoes', 'id_aplicacao', null, null, null, null),
  ('qps_probabilidades',  1, 'qps_aplicacoes', 'id_aplicacao', null, null, null, null),
  ('qps_plano_acao_5w2h', 1, 'qps_aplicacoes', 'id_aplicacao', null, null, null, null),
  ('qps_plano_medidas',   1, 'qps_aplicacoes', 'id_aplicacao', null, null, null, null),
  ('qps_monitoramento',   1, 'qps_aplicacoes', 'id_aplicacao', null, null, null, null),

  -- Investigação de acidente.
  ('investigacao_acoes', 1, 'investigacoes_acidente', 'id_investigacao', null, null, null, null),

  -- Equipamento: onde o item aparece (entrega, devolução, transferência).
  ('equipamentos_entregas_itens',   1, 'equipamentos', 'id_equipamento', null, null, null, null),
  ('equipamentos_devolucoes_itens', 1, 'equipamentos', 'id_equipamento', null, null, null, null),
  ('transferencias',                1, 'equipamentos', 'id_equipamento', null, null, null, null),

  -- Frota: filhos e netos.
  ('frota_veiculo_fotos',        1, 'frota_veiculos', 'id_veiculo',       null,                   null,         null, null),
  ('frota_checklists',           1, 'frota_veiculos', 'id_veiculo',       null,                   null,         null, null),
  ('frota_abastecimentos',       1, 'frota_veiculos', 'id_veiculo',       null,                   null,         null, null),
  ('frota_sinistros',            1, 'frota_veiculos', 'id_veiculo',       null,                   null,         null, null),
  ('frota_lotacoes',             1, 'frota_veiculos', 'id_veiculo',       null,                   null,         null, null),
  ('frota_manutencoes',          1, 'frota_veiculos', 'id_veiculo',       null,                   null,         null, null),
  ('frota_checklist_fotos',      1, 'frota_veiculos', 'id_checklist',     'frota_checklists',     'id_veiculo', null, null),
  ('frota_rotas',                1, 'frota_veiculos', 'id_checklist',     'frota_checklists',     'id_veiculo', null, null),
  ('frota_abastecimento_anexos', 1, 'frota_veiculos', 'id_abastecimento', 'frota_abastecimentos', 'id_veiculo', null, null),
  ('frota_sinistro_fotos',       1, 'frota_veiculos', 'id_sinistro',      'frota_sinistros',      'id_veiculo', null, null),

  -- Anexos (genérico: modulo + id_referencia; lib/anexos/types.ts).
  ('anexos', 1, 'relatorios_conformidade',     'id_referencia', null, null, 'modulo', 'conformidade'),
  ('anexos', 2, 'relatorios_nao_conformidade', 'id_referencia', null, null, 'modulo', 'nao_conformidade'),
  ('anexos', 3, 'analises_quimicos',           'id_referencia', null, null, 'modulo', 'analise_quimicos'),
  ('anexos', 4, 'apreciacoes_maquinas',        'id_referencia', null, null, 'modulo', 'apreciacao_maquinas'),
  ('anexos', 5, 'aep_relatorios',              'id_referencia', null, null, 'modulo', 'aep'),
  ('anexos', 6, 'drps_relatorios',             'id_referencia', null, null, 'modulo', 'psicossocial'),
  ('anexos', 7, 'qps_aplicacoes',              'id_referencia', null, null, 'modulo', 'qps');

-- Conferência: toda coluna citada existe de verdade (o schema já divergiu das
-- migrations antes). Coluna errada não quebra nada — só não liga —, então
-- aborta aqui para a regra não ficar muda.
do $$
declare
  faltando text;
begin
  select string_agg(format('%s.%s', x.t, x.c), ', ')
    into faltando
    from (
      select tabela as t, coluna as c from public.auditoria_doc_regras
      union select via_tabela, via_coluna from public.auditoria_doc_regras where via_tabela is not null
      union select tabela, filtro_coluna from public.auditoria_doc_regras where filtro_coluna is not null
    ) x
   where not exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = x.t and ic.column_name = x.c);
  if faltando is not null then
    raise exception 'v259: regra aponta para coluna que não existe: %', faltando;
  end if;
end
$$;

-- ── 3) Aplicar as regras a uma linha ────────────────────────────────────────
create or replace function public.auditoria_doc_de(p_tabela text, p_linha jsonb,
  out doc_tabela text, out doc_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r      public.auditoria_doc_regras%rowtype;
  v_ref  text;
  v_pk   text;
  v_id   text;
begin
  if p_linha is null then return; end if;
  for r in select * from public.auditoria_doc_regras where tabela = p_tabela order by ordem loop
    if r.filtro_coluna is not null and (p_linha ->> r.filtro_coluna) is distinct from r.filtro_valor then
      continue;
    end if;
    v_ref := nullif(p_linha ->> r.coluna, '');
    if v_ref is null then continue; end if;
    if r.via_tabela is null then
      v_id := v_ref;
    else
      select t.pk_colunas[1] into v_pk from public.auditoria_tabelas t where t.tabela = r.via_tabela;
      if v_pk is null then continue; end if;
      v_id := null;
      execute format('select %I::text from public.%I where %I::text = $1 limit 1', r.via_coluna, r.via_tabela, v_pk)
        into v_id using v_ref;
    end if;
    if v_id is not null then
      doc_tabela := r.doc_tabela;
      doc_id := v_id;
      return;
    end if;
  end loop;
exception when others then
  -- Nunca derruba a trilha (nem a gravação do usuário): sem documento, só isso.
  raise warning 'auditoria_doc_de(%): %', p_tabela, sqlerrm;
  doc_tabela := null; doc_id := null;
end
$$;
revoke all on function public.auditoria_doc_de(text, jsonb) from public, authenticated, anon;

-- ── 4) O gatilho (v256 + doc_tabela/doc_id) ─────────────────────────────────
create or replace function public.auditoria_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg        public.auditoria_tabelas%rowtype;
  j_old      jsonb;
  j_new      jsonb;
  antes      jsonb := '{}'::jsonb;
  depois     jsonb := '{}'::jsonb;
  campos     text[] := '{}';
  k          text;
  v_old      jsonb;
  v_new      jsonb;
  sub_antes  jsonb;
  sub_depois jsonb;
  sk         text;
  claims     jsonb;
  v_email    text;
  v_role     text;
  headers    jsonb;
  v_origem   text;
  v_registro text;
  v_empresa  text;
  v_titulo   text;
  v_acao     text;
  v_doc      record;
  -- Colunas que nunca saem em claro.
  c_mascara  constant text := 'senha|password|token|secret|pfx|biometria_dedo|biometria_template|^template$|assinatura_png|_base64';
  -- Colunas que não contam como mudança.
  c_ignora   constant text[] := array['updated_at','atualizado_em'];
begin
  select * into cfg from public.auditoria_tabelas where tabela = TG_TABLE_NAME;
  if not found or not cfg.ativo then
    return null;
  end if;

  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));
  v_role  := coalesce(claims ->> 'role', current_user::text);

  -- v256: gravação pelo token de SERVIÇO traz quem está por trás nos cabeçalhos
  -- X-Painel-Ator / X-Painel-Origem (lib/supabase/client.ts). Só vale para
  -- service_role: esse token nunca sai do servidor, então do navegador não dá
  -- para se passar por outra pessoa (um authenticated que mande o cabeçalho é
  -- ignorado — o e-mail dele vem do JWT, acima).
  if v_role = 'service_role' then
    headers  := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
    v_origem := left(nullif(btrim(headers ->> 'x-painel-origem'), ''), 80);
    if v_email is null then
      v_email := left(lower(nullif(btrim(headers ->> 'x-painel-ator'), '')), 200);
    end if;
  end if;

  if TG_OP in ('UPDATE','DELETE') then j_old := to_jsonb(OLD); end if;
  if TG_OP in ('UPDATE','INSERT') then j_new := to_jsonb(NEW); end if;

  -- Mascara segredos nos dois lados.
  if j_old is not null then
    select coalesce(jsonb_object_agg(e.key, case when e.key ~* c_mascara and e.value <> 'null'::jsonb then '"***"'::jsonb else e.value end), '{}'::jsonb)
      into j_old from jsonb_each(j_old) e;
  end if;
  if j_new is not null then
    select coalesce(jsonb_object_agg(e.key, case when e.key ~* c_mascara and e.value <> 'null'::jsonb then '"***"'::jsonb else e.value end), '{}'::jsonb)
      into j_new from jsonb_each(j_new) e;
  end if;

  if TG_OP = 'INSERT' then
    v_acao := 'criou';
    depois := j_new;
    antes  := null;
  elsif TG_OP = 'DELETE' then
    v_acao := 'excluiu';
    antes  := j_old;
    depois := null;
  else
    v_acao := 'editou';
    for k in select key from jsonb_each(j_new) union select key from jsonb_each(j_old) loop
      if k = any(c_ignora) then continue; end if;
      v_old := j_old -> k;
      v_new := j_new -> k;
      if v_old is distinct from v_new then
        campos := array_append(campos, k);
        -- jsonb OBJETO dos dois lados: guarda só as chaves que mudaram.
        if jsonb_typeof(v_old) = 'object' and jsonb_typeof(v_new) = 'object' then
          sub_antes := '{}'::jsonb; sub_depois := '{}'::jsonb;
          for sk in select key from jsonb_each(v_new) union select key from jsonb_each(v_old) loop
            if (v_old -> sk) is distinct from (v_new -> sk) then
              sub_antes  := sub_antes  || jsonb_build_object(sk, v_old -> sk);
              sub_depois := sub_depois || jsonb_build_object(sk, v_new -> sk);
            end if;
          end loop;
          antes  := antes  || jsonb_build_object(k, sub_antes);
          depois := depois || jsonb_build_object(k, sub_depois);
        else
          antes  := antes  || jsonb_build_object(k, v_old);
          depois := depois || jsonb_build_object(k, v_new);
        end if;
      end if;
    end loop;
    -- Só updated_at mudou (ou nada): não é movimentação.
    if coalesce(array_length(campos, 1), 0) = 0 then
      return null;
    end if;
  end if;

  -- Identificação do registro (PK simples ou composta, unida por '|').
  select string_agg(coalesce(coalesce(j_new, j_old) ->> c, ''), '|' order by ord)
    into v_registro
    from unnest(cfg.pk_colunas) with ordinality as u(c, ord);

  v_empresa := coalesce(j_new ->> 'id_empresa', j_old ->> 'id_empresa',
                        j_new ->> 'empresa_id', j_old ->> 'empresa_id');
  if cfg.coluna_titulo is not null then
    v_titulo := left(coalesce(j_new ->> cfg.coluna_titulo, j_old ->> cfg.coluna_titulo), 200);
  end if;

  -- v259: a que DOCUMENTO o registro pertence. A linha inteira está em
  -- j_new/j_old mesmo numa edição (o antes/depois guardado é que é só o que mudou).
  v_doc := public.auditoria_doc_de(TG_TABLE_NAME, coalesce(j_new, j_old));

  insert into public.auditoria_eventos
    (tabela, registro_id, acao, modulo, id_empresa, titulo, usuario_email, usuario_role, usuario_origem, campos_alterados, antes, depois, doc_tabela, doc_id)
  values
    (TG_TABLE_NAME, v_registro, v_acao, cfg.modulo, v_empresa, v_titulo, v_email, v_role, v_origem, campos, antes, depois, v_doc.doc_tabela, v_doc.doc_id);

  return null;
exception when others then
  -- Nunca derruba a gravação do usuário por causa da trilha.
  raise warning 'auditoria: falha ao registrar % em % (%): %', TG_OP, TG_TABLE_NAME, v_registro, sqlerrm;
  return null;
end
$$;

revoke all on function public.auditoria_registrar() from public, authenticated, anon;

-- ── 5) Eventos antigos ──────────────────────────────────────────────────────
-- a) criou/excluiu guardam a linha inteira.
update public.auditoria_eventos e
   set doc_tabela = d.doc_tabela, doc_id = d.doc_id
  from (
    select ev.id, (public.auditoria_doc_de(ev.tabela, coalesce(ev.depois, ev.antes))).*
      from public.auditoria_eventos ev
     where ev.doc_id is null
       and ev.acao in ('criou', 'excluiu')
       and ev.tabela in (select tabela from public.auditoria_doc_regras)
  ) d
 where e.id = d.id and d.doc_id is not null;

-- b) editou guarda só o que mudou: pega o documento de um evento irmão do mesmo
--    registro (o criou dele, se foi criado depois de 14/09).
update public.auditoria_eventos e
   set doc_tabela = irmao.doc_tabela, doc_id = irmao.doc_id
  from (
    select distinct on (tabela, registro_id) tabela, registro_id, doc_tabela, doc_id
      from public.auditoria_eventos
     where doc_id is not null
     order by tabela, registro_id, id desc
  ) irmao
 where e.doc_id is null
   and e.acao = 'editou'
   and e.tabela = irmao.tabela and e.registro_id = irmao.registro_id;

-- c) o resto (registro criado antes da v212): lê a linha como está hoje.
--    Só PK simples; registro já excluído fica sem documento.
do $$
declare
  alvo  record;
  v_pk  text;
  v_row jsonb;
  v_doc record;
  n     int := 0;
begin
  for alvo in
    select distinct e.tabela, e.registro_id
      from public.auditoria_eventos e
     where e.doc_id is null and e.acao = 'editou'
       and e.tabela in (select tabela from public.auditoria_doc_regras)
  loop
    select t.pk_colunas[1] into v_pk from public.auditoria_tabelas t
     where t.tabela = alvo.tabela and array_length(t.pk_colunas, 1) = 1;
    if v_pk is null then continue; end if;
    v_row := null;
    execute format('select to_jsonb(x) from public.%I x where %I::text = $1', alvo.tabela, v_pk)
      into v_row using alvo.registro_id;
    if v_row is null then continue; end if;
    v_doc := public.auditoria_doc_de(alvo.tabela, v_row);
    if v_doc.doc_id is null then continue; end if;
    update public.auditoria_eventos
       set doc_tabela = v_doc.doc_tabela, doc_id = v_doc.doc_id
     where tabela = alvo.tabela and registro_id = alvo.registro_id and doc_id is null;
    n := n + 1;
  end loop;
  raise notice 'v259: % registros antigos ligados pela linha atual', n;
end
$$;

-- ── 6) Leitura por quem abre o documento ────────────────────────────────────
-- SECURITY INVOKER de propósito: o SELECT no documento roda com o acesso DA
-- PESSOA, então a resposta é a da RLS do próprio documento (unidade, módulo…).
-- Memo de 1 posição por transação: um Histórico é sempre de UM documento, e a
-- policy chama esta função por linha.
create or replace function public.auditoria_doc_visivel(p_doc_tabela text, p_doc_id text)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_pk    text;
  v_chave text;
  v_ok    boolean;
begin
  if p_doc_tabela is null or p_doc_id is null then return false; end if;
  v_pk := case p_doc_tabela
    when 'inspecoes'                   then 'id_inspecao'
    when 'empresas'                    then 'id_empresa'
    when 'aet_relatorios'              then 'id_relatorio'
    when 'aep_relatorios'              then 'id_relatorio'
    when 'drps_relatorios'             then 'id_relatorio'
    when 'relatorios_conformidade'     then 'id_relatorio'
    when 'relatorios_nao_conformidade' then 'id_relatorio'
    when 'apreciacoes_maquinas'        then 'id_apreciacao'
    when 'analises_quimicos'           then 'id_analise'
    when 'qps_aplicacoes'              then 'id_aplicacao'
    when 'investigacoes_acidente'      then 'id_investigacao'
    when 'equipamentos'                then 'id_equipamento'
    when 'frota_veiculos'              then 'id_veiculo'
  end;
  if v_pk is null then return false; end if;

  v_chave := p_doc_tabela || ':' || p_doc_id;
  if coalesce(current_setting('auditoria.doc_chave', true), '') = v_chave then
    return current_setting('auditoria.doc_ok', true) = 't';
  end if;

  begin
    execute format('select exists(select 1 from public.%I where %I::text = $1)', p_doc_tabela, v_pk)
      into v_ok using p_doc_id;
  exception when others then
    v_ok := false;  -- sem permissão na tabela = não vê
  end;

  perform set_config('auditoria.doc_ok', case when v_ok then 't' else 'f' end, true);
  perform set_config('auditoria.doc_chave', v_chave, true);
  return coalesce(v_ok, false);
end
$$;
revoke all on function public.auditoria_doc_visivel(text, text) from public, anon;
grant execute on function public.auditoria_doc_visivel(text, text) to authenticated;

-- UMA policy só, com a da v231 (Admin/Presença) PRIMEIRO no OR: medido no
-- ensaio, duas policies permissivas entram no filtro com a nova na frente, e o
-- Admin pagaria a consulta ao documento em cada linha da Auditoria geral.
drop policy if exists auditoria_eventos_sel_doc on public.auditoria_eventos;
drop policy if exists auditoria_eventos_sel on public.auditoria_eventos;
create policy auditoria_eventos_sel on public.auditoria_eventos
  for select to authenticated
  using (
    public.caller_ve_presenca()
    or (doc_id is not null and public.auditoria_doc_visivel(doc_tabela, doc_id))
  );

notify pgrst, 'reload schema';
