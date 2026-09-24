-- v153 — Apreciação NR-12: escolher se o checklist sai no PDF (por laudo).
--
-- Depois da v152, o PDF passou a imprimir a ficha de risco HRN por máquina e
-- NÃO o checklist de 37 itens (igual ao SST-JCN). Esta coluna devolve a ESCOLHA:
-- por laudo, o técnico marca se quer o checklist impresso TAMBÉM (aditivo — não
-- substitui a ficha de risco).
--
-- Default false = mantém o comportamento atual (sem checklist no PDF). Quem quiser
-- marca a opção no editor. Aditiva e idempotente. Rodar com `psql -1`.

alter table public.apreciacoes_maquinas
  add column if not exists incluir_checklist_pdf boolean not null default false;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'apreciacoes_maquinas'
       and column_name = 'incluir_checklist_pdf'
  ) then
    raise exception 'v153 abortada: coluna incluir_checklist_pdf nao foi criada';
  end if;
  raise notice 'v153 OK: apreciacoes_maquinas.incluir_checklist_pdf disponivel';
end $$;
