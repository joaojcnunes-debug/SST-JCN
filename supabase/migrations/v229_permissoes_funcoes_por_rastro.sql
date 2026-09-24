-- v229 — Permissões por FUNÇÃO, com os módulos definidos pelo RASTRO de uso.
--
-- Pedido dele (17 e 18/09/2026): permissões por setor, contas da mesma função com
-- as mesmas permissões, "hoje o painel é muito aberto". Ele definiu as funções e
-- pediu que o corte seguisse o RASTRO de uso de cada conta, não um desenho.
--
-- Regra aplicada, conta a conta (59 contas, medidas em 18/09 pela API do painel):
--   módulos = padrão da FUNÇÃO  ∪  módulos em que a conta JÁ GRAVOU (rastro ≥ 1)
-- Assim ninguém perde módulo em que trabalha. Rastro = autoria em 24 tabelas
-- (todo o histórico) + auditoria_eventos (desde 14/09). Leitura de tela não é
-- medida em lugar nenhum — o que a conta só ABRE e não grava não conta como uso.
--
-- O que muda (números conferidos no bloco final; a migration ABORTA se não bater):
--   • funcoes_painel: catálogo das 10 funções, com o padrão de módulos/nível/unidades
--     para CONTA NOVA. Migration de módulo novo deve conceder por função, nunca
--     "a todos" (v122/v127/v190/v211 fizeram isso e é a causa do "muito aberto").
--   • usuarios.funcao: cada conta ganha a sua.
--   • modulos_permitidos recalculado; 'inventario_maquinas' (id morto) sai de todas.
--   • perfil/flags: Técnico de campo = Tecnico criar+editar (excluir só quem assina);
--     Administrativo = Visualizador sem flags (a elaboração do SGG grava pelo RPC
--     set_elaboracao_documento, que aceita Visualizador — medido na auditoria: eles
--     só alteram elaboracao_*); RH = Tecnico (opera EPI); Comercial = Visualizador.
--     usuarios.nivel (Consulta/Operacao/Aprovacao/Admin): a tela (v0.3.619,
--     ehSupervisor) libera reabrir elaboração/inspeção de outro, trocar
--     responsável, associar e as telas de configuração dos módulos para o nível
--     Aprovação — antes só Admin. Com isso os 7 Admin por supervisão (supervisor
--     dos técnicos, psicossocial, supervisoras) DESCEM para Tecnico + Aprovação
--     com as 7 unidades explícitas. No banco eles não perdem nada que usem:
--     set_elaboracao_documento não exige Admin, na Gestão já são owner no
--     roster, e o resto que exige Admin é sistema (contas, presença, auditoria).
--     Admin: 13 -> 5 (TI x3, João Jefferson, conta Psicossocial).
--   • unidades: só quem vê "todas" e não é Admin recebe as 7 explícitas.
--     (para não-Admin, lista vazia = não vê empresa nenhuma — v75/v76)
--
-- ORDEM: aplicar esta migration ANTES do deploy da v0.3.619 (a tela le a coluna nivel;
-- sem a coluna o PostgREST devolve 400 no select do useAuth).
--
-- Não toca: a conta compartilhada "Psicossocial" (pedido dele), a 2ª conta do
-- suporte de TI e a conta de teste — decisões dele em aberto.
--
-- Reversível: backup_v229_usuarios_permissoes guarda a linha inteira de antes.
-- Desfazer: scripts/sql/v229_rollback_permissoes.sql.

-- NO JCN: aplicados SO o esquema (funcoes_painel, usuarios.funcao/nivel), o
-- catalogo de 10 funcoes e a limpeza do modulo inventario_maquinas — tudo
-- generico. Os ~60 UPDATEs por id_usuario (USR-...) com unidades UNI-... sao
-- dados do painel, e a guarda final afirma "59 contas ativas": no JCN
-- abortaria de cara. Quem atribui funcao a cada conta aqui e a tela /funcoes,
-- que e exatamente o que esta migration destrava (o useAuth ja pedia
-- funcao, nivel e funcoes_painel(ve_presenca_auditoria)).

begin;

-- 1) Catálogo de funções (padrão para conta nova; a tela de usuários ainda não o lê)
create table if not exists public.funcoes_painel (
  funcao              text primary key,
  ordem               int  not null,
  descricao           text not null,
  nivel               text not null check (nivel in ('Consulta','Operacao','Aprovacao','Admin')),
  perfil_padrao       text not null check (perfil_padrao in ('Admin','Tecnico','Visualizador','Cliente')),
  pode_criar_padrao   boolean,
  pode_editar_padrao  boolean,
  pode_excluir_padrao boolean,
  modulos_padrao      text[] not null,
  unidades_padrao     text not null check (unidades_padrao in ('da_base','todas')),
  criado_em           timestamptz not null default now()
);
alter table public.funcoes_painel enable row level security;
drop policy if exists funcoes_painel_sel on public.funcoes_painel;
create policy funcoes_painel_sel on public.funcoes_painel for select to authenticated using (true);
-- Admin edita as funções pela tela Sistema › Funções (v0.3.619); os outros só leem.
drop policy if exists funcoes_painel_adm on public.funcoes_painel;
create policy funcoes_painel_adm on public.funcoes_painel for all to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());
grant select, insert, update, delete on public.funcoes_painel to authenticated;

insert into public.funcoes_painel (funcao, ordem, descricao, nivel, perfil_padrao, pode_criar_padrao, pode_editar_padrao, pode_excluir_padrao, modulos_padrao, unidades_padrao) values
  ('Técnico de campo', 1, 'Abre inspeção, riscos, fotos, EPIs do setor, AEP/AET, laudos técnicos; Gestão de EPI.', 'Operacao', 'Tecnico', true, true, false, array['painel','conformidade','nao_conformidade','apreciacao_maquinas','aep','aet','investigacao_acidente','epi']::text[], 'da_base'),
  ('Administrativo', 2, 'Elabora o documento no SGG (lê a inspeção). Escreve químicos só com pode_escrever_quimicos.', 'Consulta', 'Visualizador', false, false, false, array['painel','analise_quimicos']::text[], 'da_base'),
  ('Psicossocial', 3, 'DRPS e questionários; consulta o capítulo psicossocial do AET.', 'Aprovacao', 'Tecnico', true, true, true, array['psicossocial','questionarios_psicossociais','aet']::text[], 'todas'),
  ('Supervisor dos técnicos', 4, 'Revisa e assina os laudos técnicos; vê todo o grupo Segurança do Trabalho (inclusive Gestão de EPI), escala, gestão e produtividade.', 'Aprovacao', 'Tecnico', true, true, true, array['painel','conformidade','nao_conformidade','apreciacao_maquinas','aep','aet','investigacao_acidente','analise_quimicos','epi','psicossocial','questionarios_psicossociais','gestao_gerencial','produtividade','escala_supervisores']::text[], 'todas'),
  ('Engenheiro', 5, 'Vê tudo do painel SST e assina como RT.', 'Aprovacao', 'Tecnico', true, true, true, array['painel','conformidade','nao_conformidade','apreciacao_maquinas','aep','aet','investigacao_acidente','analise_quimicos','psicossocial','questionarios_psicossociais','produtividade','escala_supervisores']::text[], 'todas'),
  ('Supervisora do administrativo', 6, 'Toma conta de uma unidade e dos documentos dela; vê tudo do painel SST, sua escala e a frota.', 'Aprovacao', 'Tecnico', true, true, true, array['painel','conformidade','nao_conformidade','apreciacao_maquinas','aep','aet','investigacao_acidente','analise_quimicos','escala_supervisores','frota']::text[], 'todas'),
  ('Gerente', 7, 'Vê todos os módulos da(s) unidade(s) que gerencia.', 'Aprovacao', 'Tecnico', true, true, true, array['painel','conformidade','nao_conformidade','apreciacao_maquinas','aep','aet','investigacao_acidente','analise_quimicos','psicossocial','questionarios_psicossociais','gestao_gerencial','produtividade','escala_supervisores','epi','equipamentos','transferencias','frota']::text[], 'da_base'),
  ('TI', 8, 'Administra o sistema e as contas.', 'Admin', 'Admin', null, null, null, array['painel','conformidade','nao_conformidade','apreciacao_maquinas','aep','aet','investigacao_acidente','analise_quimicos','psicossocial','questionarios_psicossociais','gestao_gerencial','produtividade','escala_supervisores','epi','equipamentos','transferencias','frota']::text[], 'todas'),
  ('RH', 9, 'Opera a Gestão de EPI; consulta escala e produtividade.', 'Operacao', 'Tecnico', true, true, false, array['epi','escala_supervisores','produtividade']::text[], 'da_base'),
  ('Comercial', 10, 'Consulta empresas e o status dos documentos.', 'Consulta', 'Visualizador', false, false, false, array['painel']::text[], 'todas')
on conflict (funcao) do update set ordem = excluded.ordem, descricao = excluded.descricao, nivel = excluded.nivel,
  perfil_padrao = excluded.perfil_padrao, pode_criar_padrao = excluded.pode_criar_padrao, pode_editar_padrao = excluded.pode_editar_padrao,
  pode_excluir_padrao = excluded.pode_excluir_padrao, modulos_padrao = excluded.modulos_padrao, unidades_padrao = excluded.unidades_padrao;

-- 2) A função de cada conta
alter table public.usuarios add column if not exists funcao text references public.funcoes_painel(funcao);
alter table public.usuarios add column if not exists nivel text check (nivel in ('Consulta','Operacao','Aprovacao','Admin'));

-- 3) Backup da linha inteira ANTES de mexer (fonte do rollback)

-- 4) Conta a conta (só id; o nome fica fora do repositório de propósito)

-- 5) O id morto sai de todas as contas (o módulo saiu do tipo em v0.3.595)
update public.usuarios
   set modulos_permitidos = array_remove(modulos_permitidos, 'inventario_maquinas')
 where 'inventario_maquinas' = any(modulos_permitidos);

-- 6) Conferência: se qualquer número não bater, a transação inteira volta
do $$
begin
  if (select count(*) from public.usuarios where modulos_permitidos is null) <> 0 then raise exception 'v229: modulos_permitidos NULL herda TODOS (v163) — nao pode'; end if;
  if (select count(*) from public.usuarios where 'inventario_maquinas' = any(modulos_permitidos)) <> 0 then raise exception 'v229: ainda ha inventario_maquinas'; end if;
end $$;


commit;

notify pgrst, 'reload schema';
