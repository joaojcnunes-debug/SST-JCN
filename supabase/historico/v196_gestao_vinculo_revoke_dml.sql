-- v196 — GESTAO-KANBAN-01-F1.3-C: revoga o DML direto de vinculo (SEPARADA da v195).
--
-- Ordem DURA (licao F1.2/F1.3-A): esta migration so entra DEPOIS que o front que escreve
-- vinculo pelo RPC (gestao_vincular/gestao_desvincular, v195) esta no ar. Aplicar antes
-- quebraria o front antigo, que faz delete-all + reinsert DML direto em
-- gestao_tarefa_vinculados.
--
-- Correcao: authenticated perde INSERT/DELETE na tabela e as policies de escrita
-- (gestao_tarefa_vinc_ins/_del da v187) somem. A escrita legitima passa 100% pelo RPC
-- SECURITY DEFINER (dono chabra_admin, v195). SELECT e a policy gestao_tarefa_vinc_sel
-- sao PRESERVADOS: os hooks useVinculados/useVinculadosQuadro leem direto.
--
-- Padrao identico ao v186/SEC-GESTAO-01 (que revogou DML de gestao_acessos -> RPC).
-- Idempotente: revoke/drop policy convergem; aplica 2x sem erro. begin;...commit; PROPRIO.

begin;

-- (0) Guardas — falha fechada. Sem o RPC, revogar o DML deixaria a Gestao sem caminho
--     de escrita de vinculo.
do $$
begin
  if to_regclass('public.gestao_tarefa_vinculados') is null then
    raise exception 'v196: public.gestao_tarefa_vinculados ausente — abortado';
  end if;
  if to_regprocedure('public.gestao_vincular(text,text,text)') is null then
    raise exception 'v196: gestao_vincular (v195) ausente — revogar o DML deixaria a Gestao sem escrita de vinculo';
  end if;
  if to_regprocedure('public.gestao_desvincular(text,text,text)') is null then
    raise exception 'v196: gestao_desvincular (v195) ausente — abortado';
  end if;
end $$;

-- (1) Tira o privilegio de escrita direta do papel do navegador (mantem SELECT).
revoke insert, delete on public.gestao_tarefa_vinculados from authenticated;
revoke insert, delete on public.gestao_tarefa_vinculados from anon;
revoke insert, delete on public.gestao_tarefa_vinculados from public;

-- (2) Preserva explicitamente a leitura (useVinculados/useVinculadosQuadro dependem).
grant select on public.gestao_tarefa_vinculados to authenticated;

-- (3) Remove as policies de escrita da v187. Sem policy permissiva de INSERT/DELETE, a
--     RLS nega por ausencia — segunda tranca, independente do grant. A policy de SELECT
--     (gestao_tarefa_vinc_sel) permanece INTACTA e nao e recriada aqui.
drop policy if exists gestao_tarefa_vinc_ins on public.gestao_tarefa_vinculados;
drop policy if exists gestao_tarefa_vinc_del on public.gestao_tarefa_vinculados;

comment on table public.gestao_tarefa_vinculados is
  'Vinculos multiplos por tarefa (responsavel|seguidor por e-mail). ESCRITA SOMENTE por '
  'public.gestao_vincular/gestao_desvincular (SECURITY DEFINER, dono chabra_admin, v195) — '
  'authenticated nao tem INSERT/DELETE desde a v196 (GESTAO-KANBAN-01-F1.3-C). '
  'gestao_tarefas.responsavel e espelhado do vinculo tipo=responsavel pelo trigger v187.';

commit;
