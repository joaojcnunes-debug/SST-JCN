-- v281 (JCN) — Inspeções: QUEM concluiu (concluida_por_email).
-- Replicado do Painel SST (v283, commit 4cd79ee6, v0.3.724), sem schema_migrations.
-- No JCN a auditoria de inspeções começou em 02/10/2026: o que foi concluído antes
-- fica NULO ("Não registrado").
--
-- PEDIDO (07/10): no Dashboard › Inspeções Concluídas, o gráfico "Por pessoa"
-- contava quem foi A CAMPO (aba Responsáveis). Decisão dele: "quem foi a campo
-- e quem concluiu são duas coisas separadas" — o gráfico passa a mostrar quem
-- CONCLUIU. Até aqui o painel guardava só QUANDO (`concluida_em`, v154), nunca
-- quem.
--
-- POR QUE GATILHO, E NÃO CÓDIGO: é a mesma lição da v212 — conclusão entra por
-- mais de um caminho (botão Concluir, assinatura, sincronização offline). O
-- gatilho carimba em todos, com o MESMO e-mail que a auditoria lê do JWT
-- (e, pelo token de serviço, o cabeçalho X-Painel-Ator da v256).
--
-- REGRA: passou para CONCLUIDA → grava quem; saiu de CONCLUIDA (reabriu) →
-- limpa, igual ao `concluida_em`. Inserção já concluída também carimba.
--
-- PASSADO: preenche pela auditoria (v212, ligada em 14/09/2026) — o último
-- evento que levou a inspeção para CONCLUIDA. O que foi concluído ANTES de
-- 14/09 não tem registro em lugar nenhum e fica NULO: a tela mostra "Não
-- registrado", e não inventa um nome.
--
-- Guarda o e-mail (chave da conta), não o nome: o nome muda, o e-mail é o que
-- o JWT e a auditoria carregam. A tela traduz para o nome pelo cadastro.
--
-- Aditiva e idempotente.
-- ROLLBACK (scripts/sql/v281_inspecoes_concluida_por_rollback.sql):
--           drop trigger inspecoes_concluida_por on public.inspecoes;
--           drop function public.inspecoes_carimba_concluida_por();
--           alter table public.inspecoes drop column concluida_por_email;

alter table public.inspecoes
  add column if not exists concluida_por_email text;

comment on column public.inspecoes.concluida_por_email is
  'v281 (painel v283) — e-mail de quem concluiu (gatilho). Nulo = reaberta, não concluída, ou concluída antes de 02/10/2026 (sem registro).';

create or replace function public.inspecoes_carimba_concluida_por()
returns trigger
language plpgsql
as $$
declare
  claims  jsonb;
  headers jsonb;
  v_email text;
  v_role  text;
begin
  if new.status is distinct from 'CONCLUIDA' then
    new.concluida_por_email := null;
    return new;
  end if;

  -- Já estava concluída: não troca o autor numa edição qualquer.
  if TG_OP = 'UPDATE' and old.status = 'CONCLUIDA' then
    new.concluida_por_email := old.concluida_por_email;
    return new;
  end if;

  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));
  v_role  := coalesce(claims ->> 'role', current_user::text);

  -- Mesma regra da v256: só o token de serviço pode dizer quem está por trás.
  if v_email is null and v_role = 'service_role' then
    headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
    v_email := left(lower(nullif(btrim(headers ->> 'x-painel-ator'), '')), 200);
  end if;

  new.concluida_por_email := v_email;
  return new;
end;
$$;

drop trigger if exists inspecoes_concluida_por on public.inspecoes;
create trigger inspecoes_concluida_por
  before insert or update of status on public.inspecoes
  for each row execute function public.inspecoes_carimba_concluida_por();

-- Passado: o último evento da auditoria que levou cada inspeção a CONCLUIDA.
-- Só as que estão concluídas hoje e ainda sem autor (não sobrescreve nada).
-- `update ... from` não dispara o carimbo de autor errado: o gatilho é
-- `update of status`, e aqui só `concluida_por_email` muda.
update public.inspecoes i
   set concluida_por_email = ev.usuario_email
  from (
    select distinct on (registro_id) registro_id, usuario_email
      from public.auditoria_eventos
     where tabela = 'inspecoes'
       and usuario_email is not null
       and (
         (acao = 'editou' and 'status' = any(campos_alterados) and depois ->> 'status' = 'CONCLUIDA')
         or (acao = 'criou' and depois ->> 'status' = 'CONCLUIDA')
       )
     order by registro_id, ocorrido_em desc
  ) ev
 where ev.registro_id = i.id_inspecao
   and i.status = 'CONCLUIDA'
   and i.concluida_por_email is null;

do $$
declare
  n_total int;
  n_com   int;
begin
  select count(*), count(concluida_por_email)
    into n_total, n_com
    from public.inspecoes where status = 'CONCLUIDA';
  raise notice 'v281 OK: % concluídas, % com autor (o resto é anterior a 02/10 ou sem e-mail)', n_total, n_com;
end $$;

notify pgrst, 'reload schema';
