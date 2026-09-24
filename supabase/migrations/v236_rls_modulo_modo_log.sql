-- v236 — Trava por MÓDULO no banco, em modo LOG (não barra; só anota).
--
-- O problema (levantamento de 17–18/09/2026): dos 17 módulos do hub, só 3
-- (transferências v136, equipamentos v163, frota v177) conferem o módulo no
-- BANCO. Os outros 14 travam só na TELA (useRequireModule): quem não tem o
-- módulo não abre a página, mas pela API (/api/rest/v1, o mesmo caminho que a
-- tela usa) uma conta lê e escreve nas tabelas de um módulo que não tem.
--
-- A decisão dele (21/09/2026, "modo log: sim"): antes de fechar a porta, medir
-- 30 dias quem bateria nela. Cada tabela dos 14 módulos ganha uma policy
-- RESTRITIVA (soma-se às que já existem, não as substitui) que chama
-- rls_modulo_ok(módulo, tabela):
--   • quem TEM o módulo (Admin, modulos_permitidos NULL = herda todos, ou o
--     módulo na lista) → passa, sem custo além de 1 leitura de usuarios por
--     módulo por requisição (memorizada na transação);
--   • quem NÃO tem → anota 1 linha em rls_modulo_log (conta × módulo × tabela ×
--     dia, com método e caminho da requisição) e, em modo LOG, DEIXA PASSAR;
--     em modo TRAVA, barra.
-- A chave modo LOG/TRAVA fica em rls_modulo_config (1 linha). Virar a chave é
-- operação de banco (não tem botão): update rls_modulo_config set modo='trava'.
-- O card em Sistema › Funções mostra o modo, desde quando, quantas tentativas
-- e a data de revisão (desde + 30 dias) — é ele quem lembra a todos.
--
-- Por que dblink: o PostgREST roda todo GET em transação READ ONLY (medido em
-- 21/09: 25006 "cannot execute INSERT in a read-only transaction"). Anotar a
-- tentativa de LEITURA — a que mais importa, porque é a que quebra tela — só
-- dá por uma conexão autônoma. dblink fica no schema ext, sem USAGE para
-- anon/authenticated; só a função (security definer) usa. Custa ~10 ms por
-- tabela negada por requisição; quem tem o módulo não paga nada disso.
--
-- Fora da trava (tabelas COMPARTILHADAS entre módulos, medidas no código):
-- empresas, unidades, usuarios, setores, cargos, responsaveis, fotos, anexos,
-- acoes_5w2h, pdfs_*, textos_padrao, configuracoes. E os 3 módulos que já
-- travam (transferencias, equipamentos, frota) e a Gestão Chabra (gestao_*,
-- que tem acesso próprio por quadro — frente do outro dev).
-- Fora também: RPCs security definer (set_elaboracao_documento etc.) — elas
-- passam por cima de qualquer policy, como hoje.
--
-- Depende da v229 (modulos_permitidos por função) e da v231 (caller_ve_presenca).
-- Reversível: scripts/sql/v236_rollback_rls_modulo.sql (derruba policies,
-- funções, tabelas e a extensão; nenhuma policy existente é tocada aqui).

-- NO JCN: SEM dblink. No painel self-host a anotacao sai por uma conexao
-- autonoma (ext.dblink_exec sem senha), que exige superusuario; o 'postgres'
-- do Supabase nao e, e a propria extensao nao instala aqui. Sobrou a gravacao
-- direta: pega as ESCRITAS; num GET o PostgREST abre a transacao READ ONLY, o
-- insert falha e a tentativa se perde em silencio. Ou seja, o modo log aqui
-- mede MENOS que no painel — e justamente nao mede a leitura, que e a que
-- mais interessa. Antes de virar a chave para 'trava' isso precisa ser
-- resolvido (credencial no Vault para o dblink, ou contagem pelo front).
-- Em modo log nada e barrado, e falha de anotacao nunca altera o resultado
-- da requisicao.

begin;


-- ── 1) A chave (1 linha) ────────────────────────────────────────────────────
create table if not exists public.rls_modulo_config (
  chave        text        primary key default 'unico' check (chave = 'unico'),
  modo         text        not null default 'log' check (modo in ('log', 'trava')),
  desde        timestamptz not null default now(),
  revisar_em   date        not null,
  alterado_em  timestamptz,
  alterado_por text
);
comment on table public.rls_modulo_config is
  'v236: modo da trava por módulo no banco — log (anota e deixa passar) ou trava (barra). 1 linha. Muda por SQL.';
insert into public.rls_modulo_config (chave, modo, desde, revisar_em)
values ('unico', 'log', now(), ((now() at time zone 'America/Sao_Paulo')::date + 30))
on conflict (chave) do nothing;

-- ── 2) Tabela × módulo (o mapa que gera as policies e rotula o log) ─────────
create table if not exists public.rls_modulo_tabelas (
  tabela text primary key,
  modulo text not null
);
comment on table public.rls_modulo_tabelas is
  'v236: a que módulo do hub cada tabela pertence. Só tabelas de UM módulo; as compartilhadas ficam fora.';
insert into public.rls_modulo_tabelas (tabela, modulo) values
  -- Painel SST (inspeções): dado e catálogos do motor de inspeção.
  ('inspecoes','painel'), ('riscos','painel'), ('extintores','painel'),
  ('pae_contatos','painel'), ('complementos','painel'), ('epi_epc','painel'),
  ('inspecao_associados','painel'), ('inspecao_maquinas','painel'),
  ('inspecao_maquinas_setores','painel'),
  ('treinamentos_cargo','painel'), ('treinamentos_nr','painel'),
  ('treinamentos_risco','painel'), ('treinamentos_setor','painel'),
  ('tipos_risco','painel'), ('itens_catalogo_tipo','painel'),
  ('modelos_risco','painel'), ('itens_modelo_risco','painel'),
  ('matrizes_risco','painel'), ('perguntas_modelo_risco','painel'),
  ('perguntas_tipo_risco','painel'), ('triagens_modelo','painel'),
  ('triagens_opcao','painel'), ('triagens_tipo','painel'),
  -- Conformidade / Não conformidade
  ('relatorios_conformidade','conformidade'), ('relatorios_conformidade_itens','conformidade'),
  ('relatorios_nao_conformidade','nao_conformidade'), ('relatorios_nao_conformidade_itens','nao_conformidade'),
  -- Apreciação de máquinas
  ('apreciacoes_maquinas','apreciacao_maquinas'), ('apreciacoes_maquinas_itens','apreciacao_maquinas'),
  ('apreciacao_acoes','apreciacao_maquinas'), ('apreciacao_fichas_maquina','apreciacao_maquinas'),
  ('apreciacao_perigos_catalogo','apreciacao_maquinas'), ('apreciacao_riscos_hrn','apreciacao_maquinas'),
  -- Análise de químicos
  ('analises_quimicos','analise_quimicos'), ('base_referencia_quimicos','analise_quimicos'),
  -- AET
  ('aet_relatorios','aet'), ('aet_acoes','aet'), ('aet_textos_padrao','aet'),
  ('aet_13fatores_config','aet'), ('aet_13fatores_perguntas','aet'), ('aet_13fatores_semaforo','aet'),
  ('aet_checklist_perguntas','aet'), ('aet_laudo_fatores_psi','aet'),
  ('aet_laudo_qps_meta','aet'), ('aet_laudo_qps_respostas','aet'),
  ('aet_owas_categorias','aet'), ('aet_owas_select_campos','aet'), ('aet_perfis_owas','aet'),
  -- AEP
  ('aep_relatorios','aep'), ('aep_textos_padrao','aep'),
  -- Investigação de acidente
  ('investigacoes_acidente','investigacao_acidente'), ('investigacao_acoes','investigacao_acidente'),
  -- Psicossocial (DRPS)
  ('drps_relatorios','psicossocial'), ('drps_respondentes','psicossocial'),
  ('drps_probabilidades','psicossocial'), ('drps_probabilidades_unidade','psicossocial'),
  ('drps_monitoramento','psicossocial'), ('drps_monitoramento_unidade','psicossocial'),
  ('drps_plano_acao_5w2h','psicossocial'), ('drps_plano_medidas','psicossocial'),
  ('drps_medidas_recomendadas','psicossocial'), ('drps_agravos','psicossocial'),
  ('drps_acao_como','psicossocial'), ('drps_acao_oque','psicossocial'),
  ('drps_empresa_config','psicossocial'), ('drps_texto_padrao','psicossocial'),
  ('drps_revisao','psicossocial'),
  -- Questionários psicossociais (QPS)
  ('qps_aplicacoes','questionarios_psicossociais'), ('qps_respondentes','questionarios_psicossociais'),
  ('qps_tipos','questionarios_psicossociais'), ('qps_categorias','questionarios_psicossociais'),
  ('qps_perguntas','questionarios_psicossociais'), ('qps_probabilidades','questionarios_psicossociais'),
  ('qps_monitoramento','questionarios_psicossociais'), ('qps_plano_acao_5w2h','questionarios_psicossociais'),
  ('qps_plano_medidas','questionarios_psicossociais'), ('qps_revisao','questionarios_psicossociais'),
  -- Gestão de EPI (epi_epc é da inspeção — o gatilho da auditoria erra isso)
  ('epi_catalogo','epi'), ('epi_colaboradores','epi'), ('epi_entregas','epi'),
  ('epi_entregas_itens','epi'), ('epi_entrega_assinaturas','epi'), ('epi_movimentacoes','epi'),
  ('epi_importacoes_nfe','epi'), ('epi_importacoes_nfe_itens','epi'),
  ('epi_transferencias','epi'), ('epi_transferencias_itens','epi'),
  -- Produtividade
  ('prod_unidades','produtividade'), ('prod_colaboradores','produtividade'),
  ('prod_colaborador_unidade','produtividade'), ('prod_documentos_sst','produtividade'),
  ('prod_registros_mensais','produtividade'), ('prod_snapshot_mensal','produtividade'),
  ('prod_projecoes_salvas','produtividade'),
  -- Gestão gerencial
  ('gg_profissionais','gestao_gerencial'), ('gg_profissional_unidades','gestao_gerencial'),
  ('gg_turnos','gestao_gerencial'), ('gg_categorias','gestao_gerencial'),
  ('gg_escala_padrao','gestao_gerencial'), ('gg_ausencias','gestao_gerencial'),
  ('gg_substituicoes','gestao_gerencial'),
  -- Escala de supervisores
  ('escala_supervisores','escala_supervisores'), ('escala_dias','escala_supervisores'),
  ('escala_padrao_semanal','escala_supervisores'), ('escala_regras','escala_supervisores'),
  ('escala_feriados','escala_supervisores'), ('escala_unidade_config','escala_supervisores'),
  ('escala_log','escala_supervisores')
on conflict (tabela) do update set modulo = excluded.modulo;

-- Toda tabela do mapa tem que existir e ter RLS ligada — senão a policy
-- restritiva não faria nada e o log mentiria.
do $$
declare r record; faltam text := '';
begin
  for r in select t.tabela from public.rls_modulo_tabelas t
            left join pg_class c on c.relname = t.tabela and c.relnamespace = 'public'::regnamespace
           where c.oid is null or not c.relrowsecurity
  loop faltam := faltam || ' ' || r.tabela; end loop;
  if faltam <> '' then
    raise exception 'v236: tabela inexistente ou sem RLS:%', faltam;
  end if;
end $$;

-- ── 3) O log (1 linha por conta × módulo × tabela × dia) ────────────────────
create table if not exists public.rls_modulo_log (
  email         text        not null,
  id_usuario    text,
  modulo        text        not null,
  tabela        text        not null,
  dia           date        not null default (now() at time zone 'America/Sao_Paulo')::date,
  vezes         integer     not null default 1,
  primeira_em   timestamptz not null default now(),
  ultima_em     timestamptz not null default now(),
  ultimo_metodo text,
  ultimo_path   text,
  bloqueado     boolean     not null default false,
  primary key (email, modulo, tabela, dia)
);
comment on table public.rls_modulo_log is
  'v236: tentativas de ler/escrever tabela de módulo que a conta NÃO tem. bloqueado=false → modo log (passou); true → modo trava (barrou). Escrita só pela rls_modulo_ok.';
create index if not exists rls_modulo_log_dia_idx on public.rls_modulo_log (dia desc);

alter table public.rls_modulo_config  enable row level security;
alter table public.rls_modulo_tabelas enable row level security;
alter table public.rls_modulo_log     enable row level security;
drop policy if exists rls_modulo_config_sel  on public.rls_modulo_config;
drop policy if exists rls_modulo_tabelas_sel on public.rls_modulo_tabelas;
drop policy if exists rls_modulo_log_sel     on public.rls_modulo_log;
create policy rls_modulo_config_sel  on public.rls_modulo_config  for select to authenticated using (public.caller_ve_presenca());
create policy rls_modulo_tabelas_sel on public.rls_modulo_tabelas for select to authenticated using (public.caller_ve_presenca());
create policy rls_modulo_log_sel     on public.rls_modulo_log     for select to authenticated using (public.caller_ve_presenca());
revoke all on public.rls_modulo_config, public.rls_modulo_tabelas, public.rls_modulo_log from public, authenticated, anon;
grant select on public.rls_modulo_config, public.rls_modulo_tabelas, public.rls_modulo_log to authenticated;

-- ── 4) A função que as policies chamam ──────────────────────────────────────
-- Memória por transação em GUCs locais (SET LOCAL): rls.m_<modulo> = 't'/'f'
-- (a conta tem o módulo?) e rls.l_<tabela> = '1' (já anotei esta tabela nesta
-- requisição). Um GUC local some no fim da transação, e o PostgREST abre uma
-- transação por requisição — então nada vaza entre pessoas na mesma conexão.
-- Nunca lança erro: qualquer falha ao anotar vira `raise log` e a decisão segue.
create or replace function public.rls_modulo_ok(p_modulo text, p_tabela text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_memo   text;
  v_tem    boolean;
  v_email  text;
  v_id     text;
  v_modo   text;
  v_bloq   boolean;
begin
  v_memo := current_setting('rls.m_' || p_modulo, true);
  if v_memo = 't' then return true; end if;

  if v_memo is null or v_memo = '' then
    v_email := lower(nullif(auth.jwt() ->> 'email', ''));
    select (u.perfil = 'Admin' or u.modulos_permitidos is null or p_modulo = any(u.modulos_permitidos)),
           u.id_usuario
      into v_tem, v_id
      from public.usuarios u
     where lower(u.email) = v_email and u.ativo_sistema = true
     limit 1;
    v_tem := coalesce(v_tem, false);
    perform set_config('rls.m_' || p_modulo, case when v_tem then 't' else 'f' end, true);
    if v_tem then return true; end if;
  end if;

  -- Não tem o módulo. Decide pelo modo e anota 1x por tabela por requisição.
  select modo into v_modo from public.rls_modulo_config where chave = 'unico';
  v_bloq := coalesce(v_modo, 'log') = 'trava';

  if coalesce(current_setting('rls.l_' || p_tabela, true), '') <> '1' then
    perform set_config('rls.l_' || p_tabela, '1', true);
    if v_email is null then
      v_email := coalesce(lower(nullif(auth.jwt() ->> 'email', '')), '(sem e-mail)');
      select u.id_usuario into v_id from public.usuarios u where lower(u.email) = v_email limit 1;
    end if;
    begin
      insert into public.rls_modulo_log (email, id_usuario, modulo, tabela, ultimo_metodo, ultimo_path, bloqueado)
      values (v_email, v_id, p_modulo, p_tabela,
              left(current_setting('request.method', true), 10),
              left(current_setting('request.path', true), 200),
              v_bloq)
        on conflict (email, modulo, tabela, dia) do update
          set vezes = public.rls_modulo_log.vezes + 1, ultima_em = now(),
              ultimo_metodo = excluded.ultimo_metodo, ultimo_path = excluded.ultimo_path,
              bloqueado = excluded.bloqueado;
    exception when others then
      raise log 'rls_modulo_ok: não anotou % % (%: %)', p_modulo, p_tabela, sqlstate, sqlerrm;
    end;
  end if;

  return not v_bloq;
end $$;
revoke all on function public.rls_modulo_ok(text, text) from public, anon;
grant execute on function public.rls_modulo_ok(text, text) to authenticated;
comment on function public.rls_modulo_ok(text, text) is
  'v236: a conta do JWT tem o módulo? Admin/NULL/na lista → true. Senão anota em rls_modulo_log e devolve true (modo log) ou false (modo trava).';

-- ── 5) Uma policy RESTRITIVA por tabela do mapa ─────────────────────────────
-- Restritiva = É EXIGIDA além das permissivas que já existem. Quem hoje passa
-- pela regra de unidade/editor continua tendo que passar por ela; esta só
-- acrescenta "e tem o módulo" (que em modo log é sempre verdade).
do $$
declare r record; n int := 0;
begin
  for r in select tabela, modulo from public.rls_modulo_tabelas order by 1 loop
    execute format('drop policy if exists rls_modulo on public.%I', r.tabela);
    execute format(
      'create policy rls_modulo on public.%I as restrictive for all to authenticated '
      'using (public.rls_modulo_ok(%L, %L)) with check (public.rls_modulo_ok(%L, %L))',
      r.tabela, r.modulo, r.tabela, r.modulo, r.tabela);
    n := n + 1;
  end loop;
  raise notice 'v236: policy restritiva de módulo em % tabela(s), modo LOG.', n;
end $$;

-- ── 6) Resumo para o card (Sistema › Funções) ───────────────────────────────
create or replace function public.rls_modulo_resumo()
returns table (
  modo text, desde timestamptz, revisar_em date, tabelas int, modulos int,
  tentativas bigint, contas bigint, ultima_em timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.modo, c.desde, c.revisar_em,
         (select count(*) from public.rls_modulo_tabelas)::int,
         (select count(distinct modulo) from public.rls_modulo_tabelas)::int,
         coalesce((select sum(vezes) from public.rls_modulo_log), 0)::bigint,
         (select count(distinct email) from public.rls_modulo_log)::bigint,
         (select max(ultima_em) from public.rls_modulo_log)
    from public.rls_modulo_config c
   where c.chave = 'unico' and public.caller_ve_presenca();
$$;
revoke all on function public.rls_modulo_resumo() from public, anon;
grant execute on function public.rls_modulo_resumo() to authenticated;


commit;

notify pgrst, 'reload schema';
