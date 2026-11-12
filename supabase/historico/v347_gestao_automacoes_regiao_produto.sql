-- v347 — Gestão: automações por região e produto, montadas no JCN para validar antes do Painel (11/11/2026).
--
-- Pedido do João (11/11/2026). Quando o cartão do Comercial entra em Concluído, cria cartões conforme os Produtos:
--   1) PGR, PCMSO, LTCAT, LI ou LP  → cartão na lista da unidade (pela Região = etiqueta), coluna Empresas Novas, com uma
--      subtarefa por produto marcado + Solicitação de quadro funcional, Procuração eletrônica e Envio do eSocial;
--   2) Treinamento                  → cartão na lista Treinamento;
--   3) CIPA/Designado               → cartão na lista CIPA/DESIGNADO;
--   4) Psicossocial                 → cartão separado na lista Psicossocial (além do cartão de Empresa Nova, se houver);
--   5) Avaliação de Vibração / Ruído / Agentes Químicos / Calor → lista da unidade, coluna Avaliações de Quantitativos.
-- Decisões: dispara na entrada em Concluído; Treinamento, CIPA/DESIGNADO e Psicossocial são listas separadas (uma só);
-- "Treinamento", "CIPA/Designado" e "Avaliação de Calor" são produtos do catálogo (os dois primeiros e o último entram
-- agora). As regras 1 e 5 usam "Quadro da unidade (etiqueta da cidade)", então valem para todas as regiões.
--
-- O que este script faz (só configuração, nenhuma tabela nova):
--   a) liga as listas Teresópolis, Petrópolis e Guapimirim à sua unidade (id_unidade), para o "Quadro da unidade";
--   b) nessas 3 listas, cria as colunas Empresas Novas (EMPRESAS_NOVAS) e Avaliações de Quantitativos
--      (AVAL_QUANTITATIVOS), os mesmos slugs do Painel, antes de "A fazer";
--   c) cria as listas Treinamento e CIPA/DESIGNADO no espaço SST, com as 4 colunas padrão;
--   d) acrescenta "Treinamento", "CIPA/Designado" e "Avaliação de Calor" ao campo Produtos;
--   e) cria as 5 automações "[Roteamento] …" no Comercial;
--   f) em cada lista de unidade, os modelos e as automações "[SST] Checklist …" (só no cartão que nasce em Empresas
--      Novas, para o cartão de Avaliações não ganhar a subtarefa PGR e vice-versa) e "[SST] Entrada de empresa nova".
--
-- REAPLICAR: idempotente (on conflict / where not exists). ROLLBACK: scripts/sql/v347_gestao_automacoes_regiao_produto_rollback.sql

begin;

create temp table v347_unidades (id_quadro text primary key, id_unidade text) on commit drop;
insert into v347_unidades values
  ('QDR-A8221591', 'UNI-B0CD2369'),  -- Teresópolis
  ('QDR-E28E4C68', 'UNI-27E8CEB6'),  -- Petrópolis
  ('QDR-8F094DA1', 'UNI-A7AF507F');  -- Guapimirim

do $$ declare n int; begin
  select count(*) into n from public.gestao_quadros q join v347_unidades u using (id_quadro) where q.dono_email is null;
  if n <> 3 then raise exception 'v347: esperava as 3 listas de unidade, achou %', n; end if;
  if not exists (select 1 from public.gestao_quadros where id_quadro = 'QDR-70A13B38') then raise exception 'v347: falta a lista Comercial'; end if;
  if not exists (select 1 from public.gestao_quadros where id_quadro = 'QDR-57484DC6') then raise exception 'v347: falta a lista Psicossocial'; end if;
  if not exists (select 1 from public.gestao_status where id_quadro = 'QDR-70A13B38' and slug = 'CONCLUIDO') then raise exception 'v347: Comercial sem a coluna CONCLUIDO'; end if;
end $$;

-- a) unidade de cada lista
update public.gestao_quadros q set id_unidade = u.id_unidade
  from v347_unidades u where q.id_quadro = u.id_quadro and q.id_unidade is distinct from u.id_unidade;

-- b) colunas das unidades (as existentes descem 2 posições, uma vez só)
update public.gestao_status s set ordem = s.ordem + 2
  from v347_unidades u
 where s.id_quadro = u.id_quadro
   and not exists (select 1 from public.gestao_status x where x.id_quadro = u.id_quadro and x.slug = 'EMPRESAS_NOVAS');
insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo)
select gen_random_uuid(), u.id_quadro, c.slug, c.nome, c.cor, c.ordem, 'nao_iniciado'
  from v347_unidades u
 cross join (values ('EMPRESAS_NOVAS', 'Empresas Novas', '#0ea5e9', 0), ('AVAL_QUANTITATIVOS', 'Avaliações de Quantitativos', '#8b5cf6', 1)) c(slug, nome, cor, ordem)
 where not exists (select 1 from public.gestao_status x where x.id_quadro = u.id_quadro and x.slug = c.slug);

-- c) listas Treinamento e CIPA/DESIGNADO
insert into public.gestao_quadros (id_quadro, nome, descricao, created_by, id_espaco, ordem)
select v.id, v.nome, v.descr, 'v347', '49a4d531-c5ad-4482-b6ee-201bc3b8dc84', v.ordem
  from (values ('QDR-TREINAME', 'Treinamento', 'Cartões criados pelo Comercial quando a venda tem o produto Treinamento (v347).', 10),
               ('QDR-CIPADESI', 'CIPA/DESIGNADO', 'Cartões criados pelo Comercial quando a venda tem o produto CIPA/Designado (v347).', 11)) v(id, nome, descr, ordem)
 where not exists (select 1 from public.gestao_quadros q where q.id_quadro = v.id);
insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo)
select gen_random_uuid(), q.id, c.slug, c.nome, c.cor, c.ordem, c.tipo
  from (values ('QDR-TREINAME'), ('QDR-CIPADESI')) q(id)
 cross join (values ('A_FAZER', 'A fazer', '#94a3b8', 0, 'nao_iniciado'), ('EM_ANDAMENTO', 'Em andamento', '#f59e0b', 1, 'ativo'),
                    ('EM_REVISAO', 'Em revisão', '#6366f1', 2, 'ativo'), ('CONCLUIDO', 'Concluído', '#16a34a', 3, 'concluido')) c(slug, nome, cor, ordem, tipo)
 where not exists (select 1 from public.gestao_status x where x.id_quadro = q.id and x.slug = c.slug);

-- d) produtos novos no catálogo
update public.gestao_campos
   set opcoes = opcoes || array(select p from unnest(array['Treinamento', 'CIPA/Designado', 'Avaliação de Calor']) p where not (p = any (opcoes)))
 where id = 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';

-- e) roteamento no Comercial: entrada em Concluído + produtos
create temp table v347_rotas (nome text primary key, produtos text, destino text, etapa text, ordem int) on commit drop;
insert into v347_rotas values
  ('[Roteamento] Empresa nova → unidade (Empresas Novas)', 'PGR, PCMSO, LTCAT, LI, LP', '@unidade', 'EMPRESAS_NOVAS', 1),
  ('[Roteamento] Treinamento → lista Treinamento', 'Treinamento', 'QDR-TREINAME', 'A_FAZER', 2),
  ('[Roteamento] CIPA/Designado → lista CIPA/DESIGNADO', 'CIPA/Designado', 'QDR-CIPADESI', 'A_FAZER', 3),
  ('[Roteamento] Psicossocial → lista Psicossocial', 'Psicossocial', 'QDR-57484DC6', 'A_FAZER', 4),
  ('[Roteamento] Avaliações → unidade (Avaliações de Quantitativos)', 'Avaliação de Vibração, Avaliação de Ruído, Avaliação de Agentes Químicos, Avaliação de Calor', '@unidade', 'AVAL_QUANTITATIVOS', 5);
insert into public.gestao_automacoes (id, id_quadro, nome, ativo, gatilho, condicao, acao, acoes, ordem)
select gen_random_uuid(), 'QDR-70A13B38', r.nome, true, 'status_muda',
       jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('campo', 'status_para', 'op', '=', 'valor', 'CONCLUIDO'),
         jsonb_build_object('campo', 'campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7', 'op', 'in', 'valor', r.produtos))),
       '{}'::jsonb,
       jsonb_build_array(jsonb_build_object('id', substr(md5(r.nome), 1, 8), 'tipo', 'criar_tarefa_quadro',
         'id_quadro_destino', r.destino, 'status_destino', r.etapa, 'copiar_campos', 'true')),
       r.ordem
  from v347_rotas r
 where not exists (select 1 from public.gestao_automacoes a where a.id_quadro = 'QDR-70A13B38' and a.nome = r.nome);

-- f) subtarefas na chegada do cartão em Empresas Novas, em cada lista de unidade
create temp table v347_modelos (slug text primary key, titulo text, itens jsonb, produto text) on commit drop;
insert into v347_modelos values
  ('pgr', 'PGR', '[{"texto":"PGR"}]', 'PGR'),
  ('pcmso', 'PCMSO', '[{"texto":"PCMSO"}]', 'PCMSO'),
  ('ltcat', 'LTCAT', '[{"texto":"LTCAT"}]', 'LTCAT'),
  ('li', 'LI', '[{"texto":"LI"}]', 'LI'),
  ('lp', 'LP', '[{"texto":"LP"}]', 'LP'),
  ('empresa_nova', 'Entrada de empresa nova',
   '[{"texto":"Solicitação de quadro funcional"},{"texto":"Procuração eletrônica"},{"texto":"Envio do eSocial"}]', null);
insert into public.gestao_subtarefa_modelos (id_quadro, slug, titulo, itens)
select u.id_quadro, m.slug, m.titulo, m.itens from v347_unidades u cross join v347_modelos m
on conflict (id_quadro, slug) do nothing;
insert into public.gestao_automacoes (id, id_quadro, nome, ativo, gatilho, condicao, acao, acoes, ordem)
select gen_random_uuid(), u.id_quadro,
       case when m.produto is null then '[SST] Entrada de empresa nova' else '[SST] Checklist ' || m.produto end,
       true, 'tarefa_criada',
       jsonb_build_object('all',
         jsonb_build_array(jsonb_build_object('campo', 'status', 'op', '=', 'valor', 'EMPRESAS_NOVAS'))
         || case when m.produto is null then '[]'::jsonb
                 else jsonb_build_array(jsonb_build_object('campo', 'campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7', 'op', 'contains', 'valor', m.produto)) end),
       '{}'::jsonb,
       jsonb_build_array(jsonb_build_object('id', substr(md5(u.id_quadro || m.slug), 1, 8), 'tipo', 'criar_subtarefas_modelo', 'modelo_slug', m.slug)),
       case when m.produto is null then 0 else 1 end
  from v347_unidades u cross join v347_modelos m
 where not exists (select 1 from public.gestao_automacoes a where a.id_quadro = u.id_quadro
                    and a.nome = case when m.produto is null then '[SST] Entrada de empresa nova' else '[SST] Checklist ' || m.produto end);

do $$ declare n int; begin
  select count(*) into n from public.gestao_automacoes where id_quadro = 'QDR-70A13B38' and nome like '[Roteamento]%' and ativo;
  if n <> 5 then raise exception 'v347: esperava 5 roteamentos ativos, achou %', n; end if;
  select count(*) into n from public.gestao_automacoes where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1') and nome like '[SST]%' and ativo;
  if n <> 18 then raise exception 'v347: esperava 18 automações [SST] ativas, achou %', n; end if;
end $$;

notify pgrst, 'reload schema';

commit;
