-- ROLLBACK da v309 — Documento: "Atribuído" separado de "Em elaboração". Rodar DEPOIS de voltar o código.
-- Volta a regra de 22/09 (quem está no documento conta como em elaboração) e apaga quando/quem/como
-- o documento começou. As inspeções que a 1ª edição levou para EM_ELABORACAO continuam assim.
drop trigger if exists trg_documento_inicio_automatico on public.auditoria_eventos;
drop function if exists public.documento_inicio_automatico_trg();
drop trigger if exists trg_inspecoes_elaboracao_inicio on public.inspecoes;
drop function if exists public.inspecoes_elaboracao_inicio_trg();
drop function if exists public.atribuido_em(public.inspecoes);

create or replace function public.situacao_documento(i inspecoes)
returns text language sql stable set search_path to 'public' as $$
  select case when i.elaboracao_status = 'CONCLUIDO' then 'ENTREGUE'
              when i.elaboracao_status = 'EM_ELABORACAO' or public.tem_associado(i) then 'EM_ELABORACAO'
              when i.status = 'CONCLUIDA' then 'PENDENTE' else null end
$$;

alter table public.inspecoes drop constraint if exists inspecoes_elaboracao_inicio_origem_check;
alter table public.inspecoes drop column if exists elaboracao_inicio_origem;
alter table public.inspecoes drop column if exists elaboracao_iniciada_por;
alter table public.inspecoes drop column if exists elaboracao_iniciada_em;
notify pgrst, 'reload schema';
