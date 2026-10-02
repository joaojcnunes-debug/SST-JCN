-- 2026-10-02: seções do sistema que faltavam no Texto Padrão de AET (tinha só
-- 1 de 6 — o laudo saía sem os dados), Inspeção (sst), Conformidade, Não
-- Conformidade e Análise de Químicos (esses 4 estavam no modo legado, sem
-- nenhuma). Mesmo conteúdo de MODULO_CONFIGS[...].fixos (lib/textos-padrao/
-- types.ts), igual ao botão de seções do sistema. Já executado via MCP.
insert into textos_padrao (id_capitulo, modulo, titulo, conteudo, ordem, tipo, slug_fixo, ativo, created_at)
select 'TXT-' || upper(substr(md5(random()::text || s.modulo || s.slug), 1, 8)), s.modulo, s.titulo, null, s.ordem, 'fixo', s.slug, true, now()
from (values
  ('sst','sst_corpo','Corpo do Relatório (inventário, riscos, plano)',2000),
  ('conformidade','conformidade_itens','Itens de Conformidade Avaliados',2000),
  ('conformidade','conformidade_resultado','Resultado Geral de Conformidade',3000),
  ('conformidade','conformidade_assinatura','Assinatura do Responsável Técnico',9000),
  ('nao_conformidade','nc_descricao','Descrição da Não Conformidade',2000),
  ('nao_conformidade','nc_plano','Plano de Ação Corretiva',3000),
  ('nao_conformidade','nc_assinatura','Assinatura do Responsável',9000),
  ('analise_quimicos','quimicos_analise','Análise Química (corpo do laudo)',2000),
  ('analise_quimicos','quimicos_assinatura','Assinatura do Responsável Técnico',9000),
  ('aet','aet_agentes_ambientais','Agentes Ambientais por Setor',1090),
  ('aet','aet_analise_ergonomica','Análise Ergonômica do Trabalho',1100),
  ('aet','aet_psicossocial','Fatores Psicossociais (QPS)',2000),
  ('aet','aet_consideracoes_finais','Considerações Finais',5000),
  ('aet','aet_assinatura','Assinatura do Responsável Técnico',5500)
) as s(modulo, slug, titulo, ordem)
where not exists (select 1 from textos_padrao t where t.modulo = s.modulo and t.slug_fixo = s.slug);
-- AET: Plano de Ação estava em 145 (antes de tudo); volta ao padrão 4500.
update textos_padrao set ordem = 4500 where id_capitulo = 'TXT-A7E1D4C0';
-- "3. Considerações Finais" (editável) depois do corpo; era ordem 2.
update textos_padrao set ordem = 4000 where id_capitulo in ('TXT-6FE752DB','TXT-77DE0DC2','TXT-5DAD4DCC','TXT-3A78FBBB');

-- ROLLBACK:
-- delete from textos_padrao where tipo = 'fixo' and slug_fixo in (
--   'sst_corpo','conformidade_itens','conformidade_resultado','conformidade_assinatura',
--   'nc_descricao','nc_plano','nc_assinatura','quimicos_analise','quimicos_assinatura',
--   'aet_agentes_ambientais','aet_analise_ergonomica','aet_psicossocial',
--   'aet_consideracoes_finais','aet_assinatura');
-- update textos_padrao set ordem = 145 where id_capitulo = 'TXT-A7E1D4C0';
-- update textos_padrao set ordem = 2 where id_capitulo in ('TXT-6FE752DB','TXT-77DE0DC2','TXT-5DAD4DCC','TXT-3A78FBBB');
