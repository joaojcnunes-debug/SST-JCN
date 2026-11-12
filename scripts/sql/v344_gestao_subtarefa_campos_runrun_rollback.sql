-- Desfaz a v344 (colunas do Runrun na lista de subtarefas). O que estiver gravado nelas se perde. A coluna tipo (da
-- v199) fica, mas é limpa e perde o comentário.
begin;
alter table public.gestao_subtarefas
  drop constraint if exists gestao_subtarefas_alocados_lista,
  drop constraint if exists gestao_subtarefas_tipo_cor_hex,
  drop constraint if exists gestao_subtarefas_tempo_pos,
  drop column if exists etapa_nome,
  drop column if exists tipo_cor,
  drop column if exists alocados,
  drop column if exists tempo_trabalhado_seg,
  drop column if exists progresso,
  drop column if exists inicio_desejado,
  drop column if exists entrega_desejada;
alter table public.gestao_subtarefas disable trigger gestao_subtarefa_espelho_trg;
update public.gestao_subtarefas set tipo = null where tipo is not null;
alter table public.gestao_subtarefas enable trigger gestao_subtarefa_espelho_trg;
comment on column public.gestao_subtarefas.tipo is null;
notify pgrst, 'reload schema';
commit;
