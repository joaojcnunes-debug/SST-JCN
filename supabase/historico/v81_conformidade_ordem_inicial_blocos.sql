-- v81: Conformidade vira laudo de blocos ordenáveis (igual AEP/AET). Os fixos
-- (conformidade_itens, conformidade_resultado, conformidade_assinatura) já
-- estavam semeados em textos_padrao; aqui só normaliza a ordem inicial pra um
-- laudo coerente (Resultado → Itens → Considerações Finais → Assinatura). O
-- usuário reordena livremente no editor (ordenacaoUnificada). Já executado.
update public.textos_padrao set ordem=2000 where modulo='conformidade' and slug_fixo='conformidade_resultado';
update public.textos_padrao set ordem=2500 where modulo='conformidade' and slug_fixo='conformidade_itens';
update public.textos_padrao set ordem=8000 where modulo='conformidade' and tipo='editavel' and titulo ilike '%considera%finais%';
