-- v80: AEP vira laudo de blocos ordenáveis (rebuild). Remove placeholders
-- órfãos que não têm seção real no AepTemplate atual (aep_matriz_riscos,
-- aep_assinatura — capa e assinatura são estruturais, sempre nas pontas) e
-- normaliza a ordem inicial das 3 seções reais do sistema (Indicadores antes
-- da Triagem, Considerações por último). A partir daqui o laudo é montado pela
-- ordem única de textos_padrao(modulo='aep'). Já executado via SQL.
delete from public.textos_padrao
  where modulo='aep' and slug_fixo in ('aep_matriz_riscos','aep_assinatura');
update public.textos_padrao set ordem=3000 where modulo='aep' and slug_fixo='aep_escalonamento';
update public.textos_padrao set ordem=3500 where modulo='aep' and slug_fixo='aep_triagem';
update public.textos_padrao set ordem=5000 where modulo='aep' and slug_fixo='aep_consideracoes';
