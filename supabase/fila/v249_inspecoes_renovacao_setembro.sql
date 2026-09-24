-- v249 — as 49 "inspeções" de setembro que eram só registro viram RENOVAÇÃO.
--
-- O QUE ERAM. Concluídas entre 15 e 23/09 sem NADA em nenhuma aba, abertas
-- pelo administrativo só para cadastrar a empresa ou atualizar a data dos
-- documentos. A própria observação de cada uma diz: "Empresa cadastrada no
-- painel para fins de contabilidade de produção", "Apenas para efeito de
-- produtividade", "Inspeção já na pasta do cliente". Entravam nos gráficos
-- como trabalho de campo — 1 em cada 3 concluídas do mês.
--
-- O QUE MUDA. Só `tipo_criacao` → 'RENOVACAO', o mesmo valor que o botão
-- "Marcar como renovação" (v0.3.649) grava. Status, datas e documento ficam.
-- Saem dos gráficos de inspeção, da contagem por técnico e da produtividade;
-- continuam na lista (com selo), na ficha da empresa e nas métricas de
-- DOCUMENTO.
--
-- A lista é FECHADA por id, medida em 23/09 — nada de "toda concluída vazia".
-- A FRATELLO CAFETERIA (INS-6068FD4F), do mesmo padrão, entrou depois da
-- conferência e fica de fora de propósito.
--
-- Decisão dele em 23/09/2026: "pelo que analisei, essas 49 empresas são essa
-- situação mesmo. pode remover essa contabilidade do resultado do gráfico".
--
-- Aplicada pelo runner (.forgejo/workflows/migrate-v249.yml, descartável).
--
-- ROLLBACK (volta cada uma ao tipo que tinha):
--   update public.inspecoes set tipo_criacao = 'COPIA_EMPRESA' where tipo_criacao = 'RENOVACAO' and id_inspecao in (
--     'INS-035B1496', 'INS-0AD10597', 'INS-25B0D0FF', 'INS-26BC1AC4', 'INS-62CB6592',
--     'INS-7D6668C8', 'INS-8035A298', 'INS-A3F7E68E', 'INS-A810864E', 'INS-A97AD733',
--     'INS-B69BEB00', 'INS-C19B64EF', 'INS-C6334BB8', 'INS-C786CA71', 'INS-D895AC75',
--     'INS-DB5FF280', 'INS-DF629FEA', 'INS-E460A83F');
--   update public.inspecoes set tipo_criacao = 'BRANCO' where tipo_criacao = 'RENOVACAO' and id_inspecao in (
--     'INS-0F85CBED', 'INS-23029045', 'INS-2379700E', 'INS-259FA7C0', 'INS-32AD17AB',
--     'INS-34F214D7', 'INS-3C847577', 'INS-65CB1E2E', 'INS-6BCD0541', 'INS-99AD9827',
--     'INS-A15D27DF', 'INS-A301EEC8', 'INS-A5A58D90', 'INS-AA7462F2', 'INS-B0D51DE1',
--     'INS-B306268D', 'INS-BCD725BA', 'INS-CED573C0', 'INS-D1441DAA', 'INS-D14C2955',
--     'INS-DAE1EAC1', 'INS-DC869BB2', 'INS-E3DC1824', 'INS-E43F6200', 'INS-EACA3D71',
--     'INS-EEAFD81C', 'INS-EF79473F', 'INS-F2F46620', 'INS-F33D7347', 'INS-F65CEF03',
--     'INS-F7042227');
--   delete from public.schema_migrations where version = 'v249_inspecoes_renovacao_setembro';

begin;

create temp table v249_alvo (id_inspecao text primary key, tipo_original text not null) on commit drop;
insert into v249_alvo (id_inspecao, tipo_original) values
  ('INS-035B1496', 'COPIA_EMPRESA'),
  ('INS-0AD10597', 'COPIA_EMPRESA'),
  ('INS-0F85CBED', 'BRANCO'),
  ('INS-23029045', 'BRANCO'),
  ('INS-2379700E', 'BRANCO'),
  ('INS-259FA7C0', 'BRANCO'),
  ('INS-25B0D0FF', 'COPIA_EMPRESA'),
  ('INS-26BC1AC4', 'COPIA_EMPRESA'),
  ('INS-32AD17AB', 'BRANCO'),
  ('INS-34F214D7', 'BRANCO'),
  ('INS-3C847577', 'BRANCO'),
  ('INS-62CB6592', 'COPIA_EMPRESA'),
  ('INS-65CB1E2E', 'BRANCO'),
  ('INS-6BCD0541', 'BRANCO'),
  ('INS-7D6668C8', 'COPIA_EMPRESA'),
  ('INS-8035A298', 'COPIA_EMPRESA'),
  ('INS-99AD9827', 'BRANCO'),
  ('INS-A15D27DF', 'BRANCO'),
  ('INS-A301EEC8', 'BRANCO'),
  ('INS-A3F7E68E', 'COPIA_EMPRESA'),
  ('INS-A5A58D90', 'BRANCO'),
  ('INS-A810864E', 'COPIA_EMPRESA'),
  ('INS-A97AD733', 'COPIA_EMPRESA'),
  ('INS-AA7462F2', 'BRANCO'),
  ('INS-B0D51DE1', 'BRANCO'),
  ('INS-B306268D', 'BRANCO'),
  ('INS-B69BEB00', 'COPIA_EMPRESA'),
  ('INS-BCD725BA', 'BRANCO'),
  ('INS-C19B64EF', 'COPIA_EMPRESA'),
  ('INS-C6334BB8', 'COPIA_EMPRESA'),
  ('INS-C786CA71', 'COPIA_EMPRESA'),
  ('INS-CED573C0', 'BRANCO'),
  ('INS-D1441DAA', 'BRANCO'),
  ('INS-D14C2955', 'BRANCO'),
  ('INS-D895AC75', 'COPIA_EMPRESA'),
  ('INS-DAE1EAC1', 'BRANCO'),
  ('INS-DB5FF280', 'COPIA_EMPRESA'),
  ('INS-DC869BB2', 'BRANCO'),
  ('INS-DF629FEA', 'COPIA_EMPRESA'),
  ('INS-E3DC1824', 'BRANCO'),
  ('INS-E43F6200', 'BRANCO'),
  ('INS-E460A83F', 'COPIA_EMPRESA'),
  ('INS-EACA3D71', 'BRANCO'),
  ('INS-EEAFD81C', 'BRANCO'),
  ('INS-EF79473F', 'BRANCO'),
  ('INS-F2F46620', 'BRANCO'),
  ('INS-F33D7347', 'BRANCO'),
  ('INS-F65CEF03', 'BRANCO'),
  ('INS-F7042227', 'BRANCO');

do $$
declare
  n_alvo int;
  n_existe int;
  n_fora_do_estado int;
  n_com_conteudo int;
  n_marcadas int;
begin
  select count(*) into n_alvo from v249_alvo;
  if n_alvo <> 49 then
    raise exception 'v249 abortada: a lista tem % ids, e nao 49', n_alvo;
  end if;

  select count(*) into n_existe
    from v249_alvo a join public.inspecoes i using (id_inspecao);
  if n_existe <> 49 then
    raise exception 'v249 abortada: so % das 49 existem', n_existe;
  end if;

  -- Estado medido em 23/09: todas CONCLUIDA, 31 BRANCO + 18 COPIA_EMPRESA.
  -- Ja estar RENOVACAO (alguem usou o botao antes) tambem vale.
  select count(*) into n_fora_do_estado
    from v249_alvo a join public.inspecoes i using (id_inspecao)
   where i.status <> 'CONCLUIDA'
      or coalesce(i.tipo_criacao, '') not in (a.tipo_original, 'RENOVACAO');
  if n_fora_do_estado > 0 then
    raise exception 'v249 abortada: % das 49 mudaram de status ou de tipo desde a medicao', n_fora_do_estado;
  end if;

  -- Continuam VAZIAS? Se alguma ganhou conteudo, pode ter virado inspecao de
  -- verdade: ai e caso a caso, nao em bloco.
  select count(*) into n_com_conteudo
    from v249_alvo a
   where exists (select 1 from public.setores x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.cargos x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.riscos x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.epi_epc x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.fotos x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.complementos x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.pae_contatos x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.treinamentos_nr x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.extintores x where x.id_inspecao = a.id_inspecao)
      or exists (select 1 from public.inspecao_maquinas x where x.id_inspecao = a.id_inspecao);
  if n_com_conteudo > 0 then
    raise exception 'v249 abortada: % das 49 tem conteudo agora', n_com_conteudo;
  end if;

  -- `updated_at` fica como esta de proposito: mexer nele jogaria as 49 para o
  -- topo das listas "mais recentes" sem ninguem ter tocado nelas.
  update public.inspecoes i
     set tipo_criacao = 'RENOVACAO'
    from v249_alvo a
   where i.id_inspecao = a.id_inspecao
     and i.tipo_criacao is distinct from 'RENOVACAO';

  select count(*) into n_marcadas
    from v249_alvo a join public.inspecoes i using (id_inspecao)
   where i.tipo_criacao = 'RENOVACAO';
  if n_marcadas <> 49 then
    raise exception 'v249 abortada: % marcadas, e nao 49', n_marcadas;
  end if;
end $$;

insert into public.schema_migrations (version)
values ('v249_inspecoes_renovacao_setembro')
on conflict (version) do nothing;

commit;
