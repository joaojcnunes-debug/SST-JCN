-- 2026-10-02: o Texto Padrão da AEP estava só com os 3 capítulos editáveis
-- (Introdução, Metodologia, Considerações Finais) e o laudo saía sem os dados
-- da análise (Indicadores de AET, Triagem por setor, Encaminhamentos). Recria
-- as seções do sistema — o mesmo que o botão de seções do sistema em
-- Texto Padrão › AEP faz (useSeedCapitulosFixos). Já executado via MCP.
insert into textos_padrao (id_capitulo, modulo, titulo, conteudo, ordem, tipo, slug_fixo, ativo, created_at)
select 'TXT-' || upper(substr(md5(random()::text || s.slug), 1, 8)), 'aep', s.titulo, null, s.ordem, 'fixo', s.slug, true, now()
from (values
  ('aep_escalonamento', 'Indicadores de Necessidade de AET', 3000),
  ('aep_triagem', 'Triagem Ergonômica por Setor', 3500),
  ('aep_consideracoes', 'Considerações Finais e Encaminhamentos', 5000),
  ('aep_assinatura', 'Assinatura do Responsável Técnico', 9000)
) as s(slug, titulo, ordem)
where not exists (select 1 from textos_padrao t where t.modulo = 'aep' and t.slug_fixo = s.slug);
-- "3. Considerações Finais" (editável) depois da Triagem; era ordem 2.
update textos_padrao set ordem = 4000 where id_capitulo = 'TXT-8E05E8E9' and modulo = 'aep';

-- ROLLBACK:
-- delete from textos_padrao where modulo = 'aep' and tipo = 'fixo'
--   and slug_fixo in ('aep_escalonamento','aep_triagem','aep_consideracoes','aep_assinatura');
-- update textos_padrao set ordem = 2 where id_capitulo = 'TXT-8E05E8E9';
