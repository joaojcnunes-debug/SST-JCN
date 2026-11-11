-- DEMONSTRAÇÃO (11/11/2026): proposta de lista enxuta para a unidade, no lugar das 16 colunas do Painel.
-- Pedido do João: "a lista Teresópolis está muito poluída ... como seria a melhor forma de organizar?" — montar no JCN
-- e DEIXAR para ver como fica. Não mexe na lista Teresópolis real (QDR-A8221591) nem nas automações da v347.
--
-- Ideia (Kanban): coluna = ETAPA do trabalho (por onde o cartão passa), não o TIPO do serviço.
--   7 colunas: Entrada (triagem) → A agendar → Agendado → Em inspeção → Elaboração → Revisão e aprovação → Concluído.
--   O tipo (Empresa nova, Fiscalização, Fora da região, Serviço, Avaliação quantitativa, Doc. retroativa, Revisão de
--   documento) vira ETIQUETA colorida: aparece no cartão, filtra e dá para "Agrupar: Etiqueta".
--   "Aguardando cliente" vira etiqueta de BLOQUEIO (vermelha), em qualquer etapa — o cartão não muda de coluna.
--   "Inativas/Inadimplentes" vira etiqueta + Concluído (sai do fluxo; o filtro Situação esconde).
--   Política explícita: para entrar em "Revisão e aprovação" o checklist tem de estar completo (requer_checklist).
--   3 automações de gestão: cartão parado 7 dias na mesma coluna, etiqueta Aguardando cliente, Agendado sem data.
--   Filtros salvos (do João): Aguardando cliente, Atrasadas, Empresas novas, Avaliações.
--
-- Cartões "DEMO · …" são de mentira (empresas fictícias). Para remover tudo: demo_kanban_teresopolis_enxuto_remover.sql

begin;

do $$ begin
  if exists (select 1 from public.gestao_quadros where id_quadro = 'QDR-TERDEMO1') then
    raise exception 'demo: a lista QDR-TERDEMO1 já existe (rode o remover antes de recriar)';
  end if;
end $$;

insert into public.gestao_quadros (id_quadro, nome, descricao, created_by, id_espaco, ordem, id_unidade)
values ('QDR-TERDEMO1', 'Teresópolis — modelo enxuto (teste)',
        'Demonstração de 11/11/2026: 7 etapas; o tipo do serviço é etiqueta; Aguardando cliente é bloqueio. Cartões DEMO são fictícios.',
        'demo', '49a4d531-c5ad-4482-b6ee-201bc3b8dc84', 20, null);

-- A lista nasce com as 4 colunas padrão (gatilho); troca pelas 7 etapas.
delete from public.gestao_status where id_quadro = 'QDR-TERDEMO1';
insert into public.gestao_status (id, id_quadro, slug, nome, cor, ordem, tipo, requer_checklist) values
  (gen_random_uuid(), 'QDR-TERDEMO1', 'ENTRADA',           'Entrada (triagem)',   '#94a3b8', 0, 'nao_iniciado', false),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'A_AGENDAR',         'A agendar',           '#f59e0b', 1, 'ativo', false),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'AGENDADO',          'Agendado',            '#0ea5e9', 2, 'ativo', false),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'EM_INSPECAO',       'Em inspeção',         '#6366f1', 3, 'ativo', false),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'ELABORACAO',        'Elaboração',          '#8b5cf6', 4, 'ativo', false),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'REVISAO_APROVACAO', 'Revisão e aprovação', '#ec4899', 5, 'ativo', true),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'CONCLUIDO',         'Concluído',           '#16a34a', 6, 'concluido', false);

insert into public.gestao_etiquetas (id, id_quadro, nome, cor, ordem) values
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Empresa nova',           '#0ea5e9', 0),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Fiscalização',           '#f97316', 1),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Fora da região',         '#a16207', 2),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Serviço',                '#14b8a6', 3),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Avaliação quantitativa', '#8b5cf6', 4),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Doc. retroativa',        '#64748b', 5),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Revisão de documento',   '#2563eb', 6),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Aguardando cliente',     '#dc2626', 7),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'Inativa/Inadimplente',   '#475569', 8),
  (gen_random_uuid(), 'QDR-TERDEMO1', 'teresopolis',            '#10b981', 9);

-- Cartões fictícios, espalhados pelas etapas.
create temp table demo_cartoes (id text, titulo text, status text, prioridade text, prazo date, etiquetas text[], subs text[], feitas int) on commit drop;
insert into demo_cartoes values
  ('TRF-DEMO0001', 'DEMO · Padaria Serra Azul',           'ENTRADA',           'Media',   current_date + 5,  array['teresopolis','Empresa nova'],          array['PGR','PCMSO','Solicitação de quadro funcional','Procuração eletrônica','Envio do eSocial'], 0),
  ('TRF-DEMO0002', 'DEMO · Mercado Bom Preço',            'ENTRADA',           'Alta',    current_date + 2,  array['teresopolis','Fiscalização'],          array['Separar documentos da fiscalização'], 0),
  ('TRF-DEMO0003', 'DEMO · Oficina Dois Irmãos',          'A_AGENDAR',         'Media',   current_date + 7,  array['teresopolis','Empresa nova','Aguardando cliente'], array['PGR','LTCAT','Solicitação de quadro funcional'], 1),
  ('TRF-DEMO0004', 'DEMO · Escola Pequeno Príncipe',      'A_AGENDAR',         'Media',   current_date + 10, array['teresopolis','Revisão de documento'], array['Revisar PGR 2025'], 0),
  ('TRF-DEMO0005', 'DEMO · Metalúrgica Vale Verde',       'AGENDADO',          'Alta',    current_date + 1,  array['teresopolis','Avaliação quantitativa'], array['Avaliação de Ruído','Avaliação de Vibração'], 0),
  ('TRF-DEMO0006', 'DEMO · Clínica Bem Estar',            'AGENDADO',          'Media',   null,              array['teresopolis','Empresa nova'],          array['PGR','PCMSO'], 0),
  ('TRF-DEMO0007', 'DEMO · Hotel Mirante',                'EM_INSPECAO',       'Media',   current_date,      array['teresopolis','Serviço'],               array['Inspeção na pasta','Conferir inspeção na pasta'], 1),
  ('TRF-DEMO0008', 'DEMO · Construtora Pedra Branca',     'EM_INSPECAO',       'Urgente', current_date - 2,  array['teresopolis','Fiscalização'],          array['Inspeção na pasta'], 0),
  ('TRF-DEMO0009', 'DEMO · Laticínios Montanha',          'ELABORACAO',        'Media',   current_date + 3,  array['teresopolis','Empresa nova'],          array['PGR','PCMSO','LTCAT','Envio do eSocial'], 2),
  ('TRF-DEMO0010', 'DEMO · Transportadora Rota Serrana',  'ELABORACAO',        'Alta',    current_date - 1,  array['teresopolis','Doc. retroativa','Aguardando cliente'], array['LTCAT 2023','LTCAT 2024'], 1),
  ('TRF-DEMO0011', 'DEMO · Farmácia Central',             'REVISAO_APROVACAO', 'Media',   current_date + 4,  array['teresopolis','Empresa nova'],          array['PGR','PCMSO'], 2),
  ('TRF-DEMO0012', 'DEMO · Sítio Água Limpa (Petrópolis)', 'ENTRADA',          'Baixa',   current_date + 15, array['Fora da região'],                      array['Confirmar deslocamento'], 0),
  ('TRF-DEMO0013', 'DEMO · Restaurante Recanto',          'CONCLUIDO',         'Media',   current_date - 5,  array['teresopolis','Serviço'],               array['Entregar documentos'], 1),
  ('TRF-DEMO0014', 'DEMO · Loja Antiga Ltda',             'CONCLUIDO',         'Baixa',   null,              array['teresopolis','Inativa/Inadimplente'], array[]::text[], 0);

insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, prazo, etiquetas, campos, created_by, origem)
select d.id, 'QDR-TERDEMO1', d.titulo, 'Cartão de demonstração (fictício) do modelo enxuto.', d.status, d.prioridade, d.prazo, d.etiquetas,
       '{}'::jsonb, 'joaojcnunes@gmail.com', jsonb_build_object('tipo', 'demo')
  from demo_cartoes d;

insert into public.gestao_subtarefas (id, id_tarefa, texto, feito, ordem)
select 'SUB-' || upper(substr(md5(d.id || s.texto), 1, 8)), d.id, s.texto, s.n <= d.feitas, s.n - 1
  from demo_cartoes d cross join lateral unnest(d.subs) with ordinality as s(texto, n);

-- Checklist do cartão em "Revisão e aprovação" (completo, que é a regra para entrar lá) e de um em Elaboração (incompleto).
insert into public.gestao_checklist_itens (id, id_tarefa, texto, feito, ordem)
select 'CHK-' || upper(substr(md5(v.id || v.texto), 1, 8)), v.id, v.texto, v.feito, v.ordem from (values
  ('TRF-DEMO0011', 'Documentos assinados pelo responsável técnico', true, 0),
  ('TRF-DEMO0011', 'Cronograma do plano de ação revisado', true, 1),
  ('TRF-DEMO0009', 'Documentos assinados pelo responsável técnico', false, 0),
  ('TRF-DEMO0009', 'Cronograma do plano de ação revisado', true, 1)) v(id, texto, feito, ordem);

insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
select gen_random_uuid(), d.id, 'joaojcnunes@gmail.com', 'responsavel', 'manual' from demo_cartoes d
on conflict do nothing;

-- Automações de gestão do fluxo.
insert into public.gestao_automacoes (id, id_quadro, nome, ativo, gatilho, condicao, acao, acoes, ordem) values
  (gen_random_uuid(), 'QDR-TERDEMO1', '[Gestão] Cartão parado 7 dias na mesma coluna', true, 'tarefa_parada',
   '{"parada":{"quantidade":"7","unidade":"dias","base":"status"}}'::jsonb, '{}'::jsonb,
   '[{"id":"dm000001","tipo":"comentar","texto":"⚠️ Este cartão está há {dias_parada} dias nesta coluna. {responsavel}, atualize o andamento ou mova para a etapa certa."},{"id":"dm000002","tipo":"notificar","valor":"Cartão parado há {dias_parada} dias: {titulo}"}]'::jsonb, 0),
  (gen_random_uuid(), 'QDR-TERDEMO1', '[Gestão] Aguardando cliente: registrar a pausa', true, 'etiqueta_adicionada',
   '{"all":[{"campo":"etiqueta_nova","op":"=","valor":"Aguardando cliente"}]}'::jsonb, '{}'::jsonb,
   '[{"id":"dm000003","tipo":"comentar","texto":"⏸ Pausado em {data} aguardando o cliente. Ao receber o retorno, tire a etiqueta Aguardando cliente."}]'::jsonb, 1),
  (gen_random_uuid(), 'QDR-TERDEMO1', '[Gestão] Agendado sem data da visita', true, 'status_muda',
   '{"all":[{"campo":"status_para","op":"=","valor":"AGENDADO"},{"campo":"prazo_estado","op":"=","valor":"vazio"}]}'::jsonb, '{}'::jsonb,
   '[{"id":"dm000004","tipo":"comentar","texto":"📅 {responsavel}, o cartão foi para Agendado sem data. Coloque a data e a hora da visita no Término."}]'::jsonb, 2);

-- Filtros salvos do João nesta lista.
insert into public.gestao_filtros_salvos (id, usuario_email, id_quadro, nome, criterios) values
  (gen_random_uuid(), 'joaojcnunes@gmail.com', 'QDR-TERDEMO1', 'Aguardando cliente', '{"etiquetas":["Aguardando cliente"]}'::jsonb),
  (gen_random_uuid(), 'joaojcnunes@gmail.com', 'QDR-TERDEMO1', 'Atrasadas', '{"prazo":"atrasadas","situacao":"abertas"}'::jsonb),
  (gen_random_uuid(), 'joaojcnunes@gmail.com', 'QDR-TERDEMO1', 'Empresas novas', '{"etiquetas":["Empresa nova"],"situacao":"abertas"}'::jsonb),
  (gen_random_uuid(), 'joaojcnunes@gmail.com', 'QDR-TERDEMO1', 'Avaliações quantitativas', '{"etiquetas":["Avaliação quantitativa"],"situacao":"abertas"}'::jsonb);

commit;

-- ── Parte 2 (11/11/2026, depois da v348): limite por coluna (WIP) e roteamento com etiqueta, para testar ──
-- Valores de exemplo: Em inspeção 2 no total (já cheia), Elaboração 1 por pessoa (já estourada: o João tem 2),
-- Revisão e aprovação 3 no total.
begin;
update public.gestao_status set limite_wip = 2, limite_por_pessoa = false where id_quadro = 'QDR-TERDEMO1' and slug = 'EM_INSPECAO';
update public.gestao_status set limite_wip = 1, limite_por_pessoa = true  where id_quadro = 'QDR-TERDEMO1' and slug = 'ELABORACAO';
update public.gestao_status set limite_wip = 3, limite_por_pessoa = false where id_quadro = 'QDR-TERDEMO1' and slug = 'REVISAO_APROVACAO';

-- No Comercial: venda concluída também cria o cartão na lista enxuta, em Entrada, com a etiqueta do tipo (teste).
insert into public.gestao_automacoes (id, id_quadro, nome, ativo, gatilho, condicao, acao, acoes, ordem)
select gen_random_uuid(), 'QDR-70A13B38', v.nome, true, 'status_muda',
       jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('campo', 'status_para', 'op', '=', 'valor', 'CONCLUIDO'),
         jsonb_build_object('campo', 'campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7', 'op', 'in', 'valor', v.produtos))),
       '{}'::jsonb,
       jsonb_build_array(jsonb_build_object('id', substr(md5(v.nome), 1, 8), 'tipo', 'criar_tarefa_quadro',
         'id_quadro_destino', 'QDR-TERDEMO1', 'status_destino', 'ENTRADA', 'copiar_campos', 'true', 'etiquetas', jsonb_build_array(v.etiqueta))),
       v.ordem
  from (values
    ('[Teste modelo enxuto] Empresa nova → Entrada + etiqueta', 'PGR, PCMSO, LTCAT, LI, LP', 'Empresa nova', 20),
    ('[Teste modelo enxuto] Avaliações → Entrada + etiqueta', 'Avaliação de Vibração, Avaliação de Ruído, Avaliação de Agentes Químicos, Avaliação de Calor', 'Avaliação quantitativa', 21)
  ) v(nome, produtos, etiqueta, ordem)
 where not exists (select 1 from public.gestao_automacoes a where a.id_quadro = 'QDR-70A13B38' and a.nome = v.nome);
commit;

-- ── Parte 3 (11/11/2026): as SUBTAREFAS movem o cartão de coluna (a "esteira" do Painel, GE3/v222/v224) ──
-- Cada etapa tem uma subtarefa de CONTROLE. Concluir a subtarefa de controle move o cartão para a próxima coluna e cria a
-- subtarefa de controle seguinte. As subtarefas de PRODUTO (PGR, PCMSO…) não movem nada até a Elaboração, onde
-- "todas concluídas" leva o cartão para Revisão e aprovação, que pede a aprovação. Aprovada → Concluído; recusada →
-- volta para Elaboração com a subtarefa "Corrigir a recusa" (já existe no motor, v315).
begin;

insert into public.gestao_subtarefa_modelos (id_quadro, slug, titulo, itens) values
  ('QDR-TERDEMO1', 'ctl_triagem',  'Controle — Triagem',   '[{"texto":"Triagem: conferir dados, produtos e região","etapa":"ENTRADA"}]'),
  ('QDR-TERDEMO1', 'ctl_agendar',  'Controle — Agendar',   '[{"texto":"Agendar visita","etapa":"A_AGENDAR"}]'),
  ('QDR-TERDEMO1', 'ctl_visita',   'Controle — Visita',    '[{"texto":"Visita técnica","etapa":"AGENDADO"}]'),
  ('QDR-TERDEMO1', 'ctl_inspecao', 'Controle — Inspeção',  '[{"texto":"Inspeção na pasta","etapa":"EM_INSPECAO"},{"texto":"Conferir inspeção na pasta","etapa":"EM_INSPECAO"}]')
on conflict (id_quadro, slug) do nothing;

create temp table esteira (ordem int, nome text, gatilho text, condicao jsonb, acoes jsonb) on commit drop;
insert into esteira values
  (10, '[Esteira] 0. Cartão novo em Entrada → subtarefa de triagem', 'tarefa_criada',
   '{"all":[{"campo":"status","op":"=","valor":"ENTRADA"}]}',
   '[{"id":"es00a","tipo":"criar_subtarefas_modelo","modelo_slug":"ctl_triagem"}]'),
  (11, '[Esteira] 1. Triagem concluída → A agendar', 'subtarefa_concluida',
   '{"all":[{"campo":"subtarefa_texto","op":"=","valor":"Triagem: conferir dados, produtos e região"}]}',
   '[{"id":"es01a","tipo":"mover_status","valor":"A_AGENDAR"},{"id":"es01b","tipo":"criar_subtarefas_modelo","modelo_slug":"ctl_agendar"}]'),
  (12, '[Esteira] 2. Visita agendada → Agendado', 'subtarefa_concluida',
   '{"all":[{"campo":"subtarefa_texto","op":"=","valor":"Agendar visita"}]}',
   '[{"id":"es02a","tipo":"mover_status","valor":"AGENDADO"},{"id":"es02b","tipo":"criar_subtarefas_modelo","modelo_slug":"ctl_visita"},{"id":"es02c","tipo":"comentar","texto":"📅 Visita agendada. {responsavel}, ponha a data e a hora da visita na subtarefa Visita técnica."}]'),
  (13, '[Esteira] 3. Visita feita → Em inspeção', 'subtarefa_concluida',
   '{"all":[{"campo":"subtarefa_texto","op":"=","valor":"Visita técnica"}]}',
   '[{"id":"es03a","tipo":"mover_status","valor":"EM_INSPECAO"},{"id":"es03b","tipo":"criar_subtarefas_modelo","modelo_slug":"ctl_inspecao"}]'),
  (14, '[Esteira] 4. Inspeção conferida → Elaboração', 'subtarefa_concluida',
   '{"all":[{"campo":"subtarefa_texto","op":"=","valor":"Conferir inspeção na pasta"}]}',
   '[{"id":"es04a","tipo":"mover_status","valor":"ELABORACAO"}]'),
  (15, '[Esteira] 5. Elaboração: todas as subtarefas concluídas → Revisão e aprovação', 'subtarefa_concluida',
   '{"all":[{"campo":"status","op":"=","valor":"ELABORACAO"}]}',
   '[{"id":"es05a","tipo":"mover_status_se_completo","valor":"REVISAO_APROVACAO"}]'),
  (16, '[Esteira] 5b. Entrou em Elaboração já completa → Revisão e aprovação', 'status_muda',
   '{"all":[{"campo":"status_para","op":"=","valor":"ELABORACAO"}]}',
   '[{"id":"es05b","tipo":"mover_status_se_completo","valor":"REVISAO_APROVACAO"}]'),
  (17, '[Esteira] 6. Em Revisão e aprovação → pede a aprovação', 'status_muda',
   '{"all":[{"campo":"status_para","op":"=","valor":"REVISAO_APROVACAO"}]}',
   '[{"id":"es06a","tipo":"solicitar_aprovacao"}]'),
  (18, '[Esteira] 7. Aprovada → Concluído', 'tarefa_aprovada', '{}',
   '[{"id":"es07a","tipo":"mover_status","valor":"CONCLUIDO"}]'),
  (19, '[Esteira] 8. Recusada → volta para Elaboração', 'tarefa_rejeitada', '{}',
   '[{"id":"es08a","tipo":"mover_status","valor":"ELABORACAO"}]');
insert into public.gestao_automacoes (id, id_quadro, nome, ativo, gatilho, condicao, acao, acoes, ordem)
select gen_random_uuid(), 'QDR-TERDEMO1', e.nome, true, e.gatilho, e.condicao, '{}'::jsonb, e.acoes, e.ordem
  from esteira e
 where not exists (select 1 from public.gestao_automacoes a where a.id_quadro = 'QDR-TERDEMO1' and a.nome = e.nome);

-- Os cartões DEMO ganham a subtarefa de controle da coluna em que estão (para testar clicando).
create temp table controle (status text, texto text, ordem int) on commit drop;
insert into controle values
  ('ENTRADA', 'Triagem: conferir dados, produtos e região', 0),
  ('A_AGENDAR', 'Agendar visita', 0),
  ('AGENDADO', 'Visita técnica', 0),
  ('EM_INSPECAO', 'Inspeção na pasta', 0),
  ('EM_INSPECAO', 'Conferir inspeção na pasta', 1);
insert into public.gestao_subtarefas (id, id_tarefa, texto, feito, ordem, etapa)
select 'SUB-' || upper(substr(md5(t.id_tarefa || c.texto), 1, 8)), t.id_tarefa, c.texto, false, 100 + c.ordem, c.status
  from public.gestao_tarefas t join controle c on c.status = t.status
 where t.id_quadro = 'QDR-TERDEMO1' and t.titulo like 'DEMO ·%'
   and not exists (select 1 from public.gestao_subtarefas s where s.id_tarefa = t.id_tarefa and s.texto = c.texto);
-- Subtarefas de produto/controle que já existiam: marca a etapa em que contam (aparece na coluna Etapa da lista).
update public.gestao_subtarefas s set etapa = 'ELABORACAO'
  from public.gestao_tarefas t
 where t.id_tarefa = s.id_tarefa and t.id_quadro = 'QDR-TERDEMO1' and s.etapa is null;
update public.gestao_subtarefas s set etapa = 'EM_INSPECAO'
  from public.gestao_tarefas t
 where t.id_tarefa = s.id_tarefa and t.id_quadro = 'QDR-TERDEMO1' and s.texto in ('Inspeção na pasta', 'Conferir inspeção na pasta');
commit;
