-- v79: unifica o Texto Padrão de AEP e AET na tabela textos_padrao.
-- PROBLEMA: as telas dedicadas aep/texto-padrao e aet/texto-padrao gravavam
-- em aep_textos_padrao / aet_textos_padrao, mas os PDFs (TextosPadraoPrint /
-- AepTemplate) leem de textos_padrao(modulo). Resultado: edições não apareciam
-- no laudo. As páginas foram repontadas para o editor compartilhado (grava em
-- textos_padrao). Aqui migramos o conteúdo existente. As tabelas dedicadas
-- ficam INTACTAS como backup (descontinuar depois de validado).
-- Já executado via SQL; arquivo para rastreabilidade.
-- Psicossocial/DRPS NÃO entra: editor e print já usam drps_texto_padrao.

delete from public.textos_padrao where modulo = 'aep';
insert into public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, bg_imagem_url, caixas_texto,
   ativo, created_at, updated_at, orientacao, quebra_pagina, posicao_pdf, tipo, slug_fixo)
select id_capitulo, 'aep', coalesce(ordem_global, ordem, 0), titulo, conteudo,
       bg_imagem_url, caixas_texto, coalesce(mostrar, true), created_at, updated_at,
       coalesce(orientacao,'retrato'), coalesce(quebra_pagina,'nova'),
       coalesce(posicao_pdf, case when titulo ~* 'final|conclus|consideraç' then 'fim' else 'inicio' end),
       tipo, slug_fixo
from public.aep_textos_padrao;

delete from public.textos_padrao where modulo = 'aet';
insert into public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, conteudo, bg_imagem_url, caixas_texto,
   ativo, created_at, updated_at, orientacao, quebra_pagina, posicao_pdf, tipo, slug_fixo)
select id_capitulo, 'aet', coalesce(ordem_global, ordem, 0), titulo, conteudo,
       bg_imagem_url, caixas_texto, coalesce(mostrar, true), created_at, updated_at,
       coalesce(orientacao,'retrato'), coalesce(quebra_pagina,'nova'),
       coalesce(posicao_pdf, case when titulo ~* 'final|conclus|consideraç' then 'fim' else 'inicio' end),
       tipo, slug_fixo
from public.aet_textos_padrao;
