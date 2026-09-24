-- v197 — GESTAO-KANBAN-01-F1.3-B: o flip da visibilidade POR TAREFA.
--
-- Decisao 1 do briefing: usuario comum ve so as tarefas a que esta VINCULADO
-- (responsavel/seguidor, gestao_tarefa_vinculados), OU que CRIOU (created_by=e-mail),
-- OU de quadro/espaco que ele GERENCIA (nivel herdado 'full'); gestor global
-- (owner/admin, inclui perfil=Admin) ve TODAS. Hoje a visibilidade e por QUADRO
-- (gestao_pode_ver(id_quadro)), que em quadro aberto libera todas as tarefas para
-- qualquer membro. Esta migration instala public.gestao_ve_tarefa() e a COMPOE no
-- SELECT da tabela central (gestao_tarefas) e dos 6 satelites, mais uma policy NOVA
-- de INSERT de comentario para nivel 'comment'.
--
-- SQL-only (sem front): o front le por PostgREST e passa a receber menos linhas
-- (efeito desejado). O "deploy" de B E o apply desta migration.
--
-- >>> APLICAR EM JANELA SEM USUARIOS (gate do operador). A mudanca de LEITURA afeta
--     todo leitor no instante do apply; com gente logada, tarefas "somem" na tela ao
--     vivo. Detector C10 roda na janela; reprovou -> rollback SQL na hora.
--
-- HAZARD medido (Decisao 4): NAO compor gestao_ve_tarefa no WITH CHECK do INSERT de
-- gestao_tarefas/satelites — quebraria gestao-form-submit (created_by='Formulario' ->
-- ve_tarefa false -> INSERT rejeitado). Os WITH CHECK das _wr ficam INTOCADOS.
-- Correcao do veto revisor-seguranca: as policies _wr sao FOR ALL, e o USING de FOR ALL
-- TAMBEM incide no SELECT (OR permissivo com a _sel). Por isso o USING das 5 _wr que
-- vazam ganha AND gestao_ve_tarefa (secao 2.8); o WITH CHECK do INSERT segue so por
-- gestao_pode_editar_q. Ver secao (2.8) para o detalhe da semantica.
--
-- Idempotente: create or replace / drop policy if exists + create policy convergem;
-- aplica 2x sem erro. begin;...commit; PROPRIO. schema_migrations e inserido pelo
-- operador no apply (padrao v196 — migrate.ps1); o rollback remove a linha.

begin;

-- (0) Guardas — falha fechada. Sem baseline conhecido das 7 policies-alvo, ou sem ser
--     chabra_admin (dono da funcao SECURITY DEFINER), abortamos antes de tocar em nada.
do $$
declare
  -- 7 policies de SELECT (compostas) + 5 policies _wr FOR ALL cujo USING tambem incide no
  -- SELECT (furo de sobre-exposicao) e precisa ganhar gestao_ve_tarefa. col3: polcmd esperado.
  alvos text[][] := array[
    ['gestao_tarefas','gestao_tarefas_sel','r'],
    ['gestao_anexos','gestao_anexos_sel','r'],
    ['gestao_atividades','gestao_ativ_sel','r'],
    ['gestao_comentarios','gestao_coment_sel','r'],
    ['gestao_dependencias','gestao_dep_sel','r'],
    ['gestao_tempo','gestao_tempo_sel','r'],
    ['gestao_tarefa_vinculados','gestao_tarefa_vinc_sel','r'],
    ['gestao_tarefas','gestao_tarefas_wr','*'],
    ['gestao_anexos','gestao_anexos_wr','*'],
    ['gestao_comentarios','gestao_coment_wr','*'],
    ['gestao_dependencias','gestao_dep_wr','*'],
    ['gestao_tempo','gestao_tempo_wr','*']
  ];
  i int;
begin
  if current_user <> 'chabra_admin' then
    raise exception 'v197: precisa rodar como chabra_admin (dono da funcao SECURITY DEFINER) — abortado';
  end if;

  -- As funcoes que gestao_ve_tarefa compoe precisam existir (o corpo plpgsql so falharia
  -- em runtime; guarda torna o erro imediato e claro).
  if to_regprocedure('public.gestao_email()') is null
     or to_regprocedure('public.gestao_papel_de(text)') is null
     or to_regprocedure('public.gestao_resolver_nivel(text,public.gestao_recurso,text)') is null
     or to_regprocedure('public.gestao_nivel_ord(public.gestao_nivel)') is null then
    raise exception 'v197: dependencia (gestao_email/papel_de/resolver_nivel/nivel_ord) ausente — abortado';
  end if;

  -- As 7 policies de SELECT-alvo existem e a RLS esta ligada em cada tabela. Se alguma
  -- sumiu, NAO recomponho as cegas — abortar e reconferir o baseline.
  for i in 1 .. array_length(alvos,1) loop
    if not exists (
      select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
      where c.relnamespace = 'public'::regnamespace
        and c.relname = alvos[i][1] and p.polname = alvos[i][2] and p.polcmd = alvos[i][3]::"char"
    ) then
      raise exception 'v197: policy-alvo % (cmd=%) ausente em % — abortado (sem baseline, nao recomponho)',
        alvos[i][2], alvos[i][3], alvos[i][1];
    end if;
    if not (select relrowsecurity from pg_class
            where relnamespace = 'public'::regnamespace and relname = alvos[i][1]) then
      raise exception 'v197: RLS desligada em % — abortado', alvos[i][1];
    end if;
  end loop;
end $$;

-- (1) A funcao do flip. SECURITY DEFINER (dono chabra_admin) para ler gestao_acessos/
--     _tarefa_vinculados/_tarefas ignorando a RLS delas. STABLE, search_path=public.
--     Curto-circuito na ordem do desenho aprovado (rubrica §Desenho):
--       1 sem e-mail no JWT            -> false
--       2 gestor global (owner/admin)  -> true   (inclui perfil=Admin)
--       3 nao-membro (papel nulo)      -> false
--       4 nivel herdado 'full' (>=4)   -> true   (gestor DO quadro/espaco; quadro aberto=edit(3) NAO passa)
--       5 grant explicito de tarefa nao-restritivo -> true
--       6 vinculado (responsavel/seguidor)        -> true
--       7 criador (created_by = caller)           -> true
--       8 senao                        -> false
create or replace function public.gestao_ve_tarefa(p_id_tarefa text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  -- 1) sem e-mail no JWT -> nao ve
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;

  -- 2) gestor global (owner/admin; perfil=Admin vira owner) ve TODAS
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;

  -- 3) nao-membro (papel nulo) nao ve
  if v_papel is null then
    return false;
  end if;

  -- 4) gestor DO quadro/espaco da tarefa: nivel herdado 'full' (>=4). Membro de quadro
  --    ABERTO resolve 'edit' (3) e NAO passa aqui — e exatamente o ponto do flip.
  if public.gestao_nivel_ord(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     ) >= 4 then
    return true;
  end if;

  -- 5) grant explicito NAO-restritivo na PROPRIA tarefa (view/comment/edit/full)
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 6) vinculado (responsavel ou seguidor) a tarefa
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 7) criador da tarefa (created_by = e-mail do caller)
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;

  -- 8) senao, nao ve
  return false;
end
$fn$;

alter function public.gestao_ve_tarefa(text) owner to chabra_admin;

-- EXECUTE espelhando as funcoes-irmas (gestao_pode_ver/_resolver_nivel): PUBLIC ja recebe
-- =X na criacao; os grants explicitos abaixo replicam a convencao Supabase do projeto.
grant execute on function public.gestao_ve_tarefa(text) to anon, authenticated, service_role;

-- (2) Composicao no SELECT — a expressao ORIGINAL preservada VERBATIM, so acrescida de
--     "AND gestao_ve_tarefa(<id_tarefa>)". O write (gestao_*_wr / gestao_*_ins) NAO e tocado.

-- 2.1 gestao_tarefas (id-pai = a propria id_tarefa)
drop policy if exists gestao_tarefas_sel on public.gestao_tarefas;
create policy gestao_tarefas_sel on public.gestao_tarefas
  for select to authenticated
  using (
    gestao_pode_ver(id_quadro)
    and public.gestao_ve_tarefa(id_tarefa)
  );

-- 2.2 gestao_anexos
drop policy if exists gestao_anexos_sel on public.gestao_anexos;
create policy gestao_anexos_sel on public.gestao_anexos
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_anexos.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_anexos.id_tarefa)
  );

-- 2.3 gestao_atividades
drop policy if exists gestao_ativ_sel on public.gestao_atividades;
create policy gestao_ativ_sel on public.gestao_atividades
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_atividades.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_atividades.id_tarefa)
  );

-- 2.4 gestao_comentarios
drop policy if exists gestao_coment_sel on public.gestao_comentarios;
create policy gestao_coment_sel on public.gestao_comentarios
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_comentarios.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_comentarios.id_tarefa)
  );

-- 2.5 gestao_dependencias
drop policy if exists gestao_dep_sel on public.gestao_dependencias;
create policy gestao_dep_sel on public.gestao_dependencias
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_dependencias.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_dependencias.id_tarefa)
  );

-- 2.6 gestao_tempo
drop policy if exists gestao_tempo_sel on public.gestao_tempo;
create policy gestao_tempo_sel on public.gestao_tempo
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_tempo.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_tempo.id_tarefa)
  );

-- 2.7 gestao_tarefa_vinculados
drop policy if exists gestao_tarefa_vinc_sel on public.gestao_tarefa_vinculados;
create policy gestao_tarefa_vinc_sel on public.gestao_tarefa_vinculados
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_tarefa_vinculados.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_tarefa_vinculados.id_tarefa)
  );

-- (2.8) FURO DE SOBRE-EXPOSICAO (veto revisor-seguranca, EXPLAIN em producao):
--     as policies de ESCRITA _wr das tabelas centrais sao FOR ALL (polcmd='*'). No
--     Postgres o USING de uma policy FOR ALL TAMBEM incide no SELECT, combinado por OR
--     (permissivo) com a _sel. Sem tocar as _wr, o predicado efetivo de leitura seria
--       gestao_pode_editar_q(quadro) OR (gestao_pode_ver AND gestao_ve_tarefa)
--     e como quadro ABERTO resolve edit(3) -> pode_editar_q=TRUE, o comum de quadro
--     aberto veria TUDO e gestao_ve_tarefa ficaria irrelevante. Vazam 5 tabelas.
--     Correcao (opcao A, minimal): acrescentar AND gestao_ve_tarefa(<id_tarefa>) SO ao
--     USING das 5 _wr FOR ALL — NAO tocar o WITH CHECK (gestao-form-submit /
--     created_by='Formulario' segue inserindo; HAZARD/Decisao 4 respeitado). Com isso o
--     SELECT vira (pode_editar_q AND ve_tarefa) OR (pode_ver AND ve_tarefa) = ve_tarefa
--     AND pode_ver. UPDATE/DELETE (USING) passam a exigir ver a linha — endurecimento
--     desejavel; gestor nao sente (ve_tarefa=true para owner/admin/full).
--     NAO mexer em gestao_atividades (write so _ins) nem gestao_tarefa_vinculados (sem
--     policy de escrita) — nao vazam.

-- 2.8.1 gestao_tarefas_wr (id-pai = a propria id_tarefa). WITH CHECK original preservado.
drop policy if exists gestao_tarefas_wr on public.gestao_tarefas;
create policy gestao_tarefas_wr on public.gestao_tarefas
  for all to authenticated
  using (
    gestao_pode_editar_q(id_quadro)
    and public.gestao_ve_tarefa(id_tarefa)
  )
  with check (gestao_pode_editar_q(id_quadro));

-- 2.8.2 gestao_anexos_wr
drop policy if exists gestao_anexos_wr on public.gestao_anexos;
create policy gestao_anexos_wr on public.gestao_anexos
  for all to authenticated
  using (
    gestao_pode_editar_q(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_anexos.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_anexos.id_tarefa)
  )
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_anexos.id_tarefa))));

-- 2.8.3 gestao_coment_wr
drop policy if exists gestao_coment_wr on public.gestao_comentarios;
create policy gestao_coment_wr on public.gestao_comentarios
  for all to authenticated
  using (
    gestao_pode_editar_q(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_comentarios.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_comentarios.id_tarefa)
  )
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_comentarios.id_tarefa))));

-- 2.8.4 gestao_dep_wr
drop policy if exists gestao_dep_wr on public.gestao_dependencias;
create policy gestao_dep_wr on public.gestao_dependencias
  for all to authenticated
  using (
    gestao_pode_editar_q(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_dependencias.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_dependencias.id_tarefa)
  )
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_dependencias.id_tarefa))));

-- 2.8.5 gestao_tempo_wr
drop policy if exists gestao_tempo_wr on public.gestao_tempo;
create policy gestao_tempo_wr on public.gestao_tempo
  for all to authenticated
  using (
    gestao_pode_editar_q(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_tempo.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_tempo.id_tarefa)
  )
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_tempo.id_tarefa))));

-- (3) Comentar com nivel 'comment' (Decisao 3): policy NOVA, ADITIVA (OR com a
--     gestao_coment_wr recomposta acima). Quem tem nivel >= comment (2) na cadeia da
--     tarefa E ve a tarefa ganha INSERT de comentario — SEM ganhar edit. Editar
--     comentario/tarefa segue exigindo edit/full via gestao_coment_wr / gestao_tarefas_wr.
drop policy if exists gestao_coment_ins_comment on public.gestao_comentarios;
create policy gestao_coment_ins_comment on public.gestao_comentarios
  for insert to authenticated
  with check (
    public.gestao_nivel_ord(
      public.gestao_resolver_nivel(public.gestao_email(), 'task'::public.gestao_recurso, gestao_comentarios.id_tarefa)
    ) >= 2
    and public.gestao_ve_tarefa(gestao_comentarios.id_tarefa)
  );

commit;
