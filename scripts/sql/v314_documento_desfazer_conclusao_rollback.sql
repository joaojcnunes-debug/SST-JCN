-- Rollback da v314 (desfazer a conclusão por engano). Volta o gatilho da primeira conclusão à
-- versão sem a exceção do Desfazer e tira a coluna de quem concluiu.

DROP FUNCTION IF EXISTS public.documento_desfazer_conclusao(text);
DROP TRIGGER IF EXISTS trg_inspecoes_elaboracao_concluida_por ON public.inspecoes;
DROP FUNCTION IF EXISTS public.inspecoes_elaboracao_concluida_por_trg();
ALTER TABLE public.inspecoes DROP COLUMN IF EXISTS elaboracao_concluida_por;

CREATE OR REPLACE FUNCTION public.inspecoes_primeira_conclusao_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if tg_op = 'UPDATE' then
    new.primeira_conclusao_em       := old.primeira_conclusao_em;
    new.primeira_conclusao_por      := old.primeira_conclusao_por;
    new.primeira_conclusao_tecnicos := old.primeira_conclusao_tecnicos;
    new.primeira_elaboracao_em      := old.primeira_elaboracao_em;
    new.primeira_elaboracao_por     := old.primeira_elaboracao_por;
  else
    new.primeira_conclusao_em := null; new.primeira_conclusao_por := null; new.primeira_conclusao_tecnicos := null;
    new.primeira_elaboracao_em := null; new.primeira_elaboracao_por := null;
  end if;
  if new.primeira_conclusao_em is null and new.status = 'CONCLUIDA'
     and (tg_op = 'INSERT' or old.status is distinct from 'CONCLUIDA') then
    new.primeira_conclusao_em       := least(coalesce(new.concluida_em, now()), now());
    new.primeira_conclusao_por      := new.concluida_por_email;
    new.primeira_conclusao_tecnicos := public.inspecao_tecnicos_campo_json(new.id_inspecao);
  end if;
  if new.primeira_elaboracao_em is null and new.elaboracao_status = 'CONCLUIDO'
     and (tg_op = 'INSERT' or old.elaboracao_status is distinct from 'CONCLUIDO') then
    new.primeira_elaboracao_em  := least(coalesce(new.elaboracao_concluida_em, now()), now());
    new.primeira_elaboracao_por := new.elaboracao_responsavel;
  end if;
  return new;
end $$;

NOTIFY pgrst, 'reload schema';
