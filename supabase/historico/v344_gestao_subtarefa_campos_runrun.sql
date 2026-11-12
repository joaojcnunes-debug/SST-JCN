-- v344 — Gestão: as colunas do Runrun na lista de subtarefas (11/11/2026, 0.3.273).
--
-- Trazida das v357 e v358 do Painel (0.3.929 e 0.3.933), juntas. A aba Subtarefas da tarefa vira tabela com Etapa,
-- Tipo (cor), Alocados, Horas trabalhadas, Progresso, Início desejado e Entrega desejada, como no Runrun.
-- No Painel quem preenche é a sincronização com o Runrun (modelo/subcampos.mjs no servidor llm-box). O JCN não tem essa
-- sincronização: as colunas ficam vazias e a tela usa o que já existe (feito como status, responsável como alocado).
-- A edição da subtarefa (título, feito, responsável, ordem) não mexe nestas colunas.
--   etapa_nome           nome da etapa como está no Runrun
--   tipo_cor             cor do tipo no Runrun (#RRGGBB) — o nome vai em tipo (já existia, vazio)
--   alocados             [{email, nome, feito}] — todas as pessoas alocadas
--   tempo_trabalhado_seg horas trabalhadas, em segundos
--   progresso            % do Runrun (tempo trabalhado / estimado; passa de 100 quando estoura)
--   inicio_desejado      início desejado (data e hora)
--   entrega_desejada     entrega desejada (data e hora; 23:59 quando é "só o dia")
-- Sem gatilho novo e sem mudança de acesso: as políticas e os grants da tabela valem para as colunas novas.
-- ROLLBACK: scripts/sql/v344_gestao_subtarefa_campos_runrun_rollback.sql

begin;

do $$ begin
  if to_regclass('public.gestao_subtarefas') is null then
    raise exception 'v344: gestao_subtarefas não existe';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'gestao_subtarefas'
                and column_name in ('etapa_nome', 'tipo_cor', 'alocados', 'tempo_trabalhado_seg', 'progresso', 'inicio_desejado', 'entrega_desejada')) then
    raise exception 'v344: já aplicada (alguma das colunas novas já existe)';
  end if;
  if exists (select 1 from public.gestao_subtarefas where tipo is not null) then
    raise exception 'v344: a coluna tipo já tem dado — conferir antes de usar para o tipo do Runrun';
  end if;
end $$;

alter table public.gestao_subtarefas
  add column etapa_nome text,
  add column tipo_cor text,
  add column alocados jsonb not null default '[]'::jsonb,
  add column tempo_trabalhado_seg integer,
  add column progresso numeric(8,1),
  add column inicio_desejado timestamptz,
  add column entrega_desejada timestamptz;

alter table public.gestao_subtarefas
  add constraint gestao_subtarefas_alocados_lista check (jsonb_typeof(alocados) = 'array'),
  add constraint gestao_subtarefas_tipo_cor_hex check (tipo_cor is null or tipo_cor ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint gestao_subtarefas_tempo_pos check (tempo_trabalhado_seg is null or tempo_trabalhado_seg >= 0);

comment on column public.gestao_subtarefas.etapa_nome is 'v344: nome da etapa da subtarefa no Runrun (sincronização).';
comment on column public.gestao_subtarefas.tipo is 'v344: nome do tipo da subtarefa no Runrun (sincronização).';
comment on column public.gestao_subtarefas.tipo_cor is 'v344: cor do tipo no Runrun, #RRGGBB (sincronização).';
comment on column public.gestao_subtarefas.alocados is 'v344: pessoas alocadas no Runrun: [{email, nome, feito}] (sincronização).';
comment on column public.gestao_subtarefas.tempo_trabalhado_seg is 'v344: horas trabalhadas no Runrun, em segundos (sincronização).';
comment on column public.gestao_subtarefas.progresso is 'v344: progresso do Runrun em % (tempo trabalhado / estimado; sincronização).';
comment on column public.gestao_subtarefas.inicio_desejado is 'v344: início desejado no Runrun (sincronização).';
comment on column public.gestao_subtarefas.entrega_desejada is 'v344 (= v358 do Painel): entrega desejada no Runrun, data e hora.';

notify pgrst, 'reload schema';

commit;
