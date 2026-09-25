-- v261 — imagens de referência do OWAS quebradas no JCN.
--
-- As 4 linhas de aet_owas_categorias vieram da equalização com imagem_url
-- apontando para o storage do projeto antigo (vifatwpfqhhantordxlq), que não
-- responde mais. Com imagem_url NULL, as telas e o PDF usam as imagens padrão
-- do próprio site (/owas/<slug>.svg). Para usar uma imagem própria, envie pela
-- tela AET › Configuração OWAS.
-- Rollback: não há — os links antigos não funcionam.

update public.aet_owas_categorias
   set imagem_url = null
 where imagem_url like '%vifatwpfqhhantordxlq%';
