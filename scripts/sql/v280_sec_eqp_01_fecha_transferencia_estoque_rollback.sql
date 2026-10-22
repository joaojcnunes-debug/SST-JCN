-- ROLLBACK da v280 (SEC-EQP-01): devolve o estado medido em 22/10/2026.
-- Atenção: reabre as brechas fechadas pela v280. Só usar se algo quebrar.
begin;

-- 1) ACL padrão das 13 funções (PUBLIC, anon e authenticated executam)
grant execute on function public.epi_assinar_entrega(text,text,text,text,text,text,text,text,text,boolean,boolean,integer) to public, anon, authenticated;
grant execute on function public.transferencia_abrir(text) to public, anon, authenticated;
grant execute on function public.transferencia_aceitar(text,text,text,text,text,boolean) to public, anon, authenticated;
grant execute on function public.transferencia_recusar(text,text) to public, anon, authenticated;
grant execute on function public.transferencia_cancelar(text,text) to public, anon, authenticated;
grant execute on function public.equipamento_lancar_entrada(text,text,numeric,text,text,text) to public, anon, authenticated;
grant execute on function public.equipamento_ajustar_saldo(text,text,numeric,text) to public, anon, authenticated;
grant execute on function public.equipamento_importar_nfe(text,text,text,text,text,date,numeric,text,jsonb) to public, anon, authenticated;
grant execute on function public.equipamento_registrar_entrega(text,text,date,text,text,jsonb) to public, anon, authenticated;
grant execute on function public.equipamento_mudar_status(text,text,text,text,text) to public, anon, authenticated;
grant execute on function public.equipamento_registrar_devolucao(text,text,text,date,text,text,jsonb) to public, anon, authenticated;
grant execute on function public.equipamento_transferir_estoque(text,text,text,numeric,text,text,text) to public, anon, authenticated;
grant execute on function public.equipamento_estornar_transferencia(text) to public, anon, authenticated;

-- 2) aceitar/recusar sem a guarda de e-mail: reaplicar os corpos anteriores
--    (estão em pg_get_functiondef de 22/10/2026, iguais à v280 sem o primeiro IF).
--    A guarda só recusa sessão sem e-mail; mantê-la é seguro mesmo no rollback.

-- 3) transferencias: volta a policy FOR ALL e os grants da tabela
drop policy if exists transferencias_ins on public.transferencias;
drop policy if exists transferencias_rw on public.transferencias;
create policy transferencias_rw on public.transferencias
  for all to authenticated
  using (caller_pode_editar() and caller_pode_transferir())
  with check (caller_pode_editar() and caller_pode_transferir());
grant insert, update, delete on public.transferencias to anon, authenticated;

-- 4) equipamentos_movimentacoes: volta a policy de INSERT e os grants
drop policy if exists equipamentos_movimentacoes_ins on public.equipamentos_movimentacoes;
create policy equipamentos_movimentacoes_ins on public.equipamentos_movimentacoes
  for insert to authenticated
  with check (caller_pode_editar() and caller_pode_equipamentos() and (caller_eh_admin() or (id_unidade = any (caller_unidades()))));
grant insert, update, delete on public.equipamentos_movimentacoes to anon, authenticated;

commit;
