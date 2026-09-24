-- v246 — a assinatura de "quem entrega" e "quem valida" volta a funcionar.
--
-- O SINTOMA (Leandro, 22/09/2026 09:15): ao assinar a retirada, com a digital
-- lida e ele PRESENTE na equipe de entrega, o painel recusava com
--     Só a equipe de entrega ativa assina o papel "envia".
--
-- A CAUSA NÃO É DADO, É UM GRANT QUE FALTOU. A v189 criou a tabela e deu
-- `select` só a `authenticated` (linha 44). Em 31/08 a rota
-- `/api/equipamentos/biometria/verificar` passou a conferir a equipe ANTES de
-- decifrar o template — e ela lê pelo cliente de SERVIÇO, de propósito. Só que
-- `service_role` nunca teve `select` nesta tabela: o PostgREST responde
-- `42501 permission denied for table equip_equipe_entrega`, a rota descarta o
-- `error` e fica com `data = null`, e "não consegui ler" vira "você não é da
-- equipe". RLS não tem nada com isso — `service_role` é `bypassrls`.
--
-- ⚠️ MEDIDO, e é o que prova o diagnóstico: em
-- `equipamentos_entrega_assinaturas`, o papel `recebe` (o ÚNICO que não passa
-- por essa checagem) tem 7 assinaturas, a última de 22/09/2026. Os papéis
-- `envia` (3) e `valida` (1) pararam em 01/09/2026 — logo depois do deploy da
-- checagem. Ficaram três semanas recusando todo mundo, e a mensagem dizia que
-- o problema era a pessoa.
--
-- O QUE ESTA MIGRATION FAZ: um grant. Nada de policy, nada de dado, nada de
-- assinatura de função. `equip_definir_equipe_entrega` continua exigindo Admin
-- e a gravação da assinatura continua validada pelo banco — este `select` é só
-- o portão da rota conseguir ler a lista que ele mesmo precisa conferir.

begin;

grant select on public.equip_equipe_entrega to service_role;

-- Guarda: se o grant não pegou, aborta em vez de gravar a migration e deixar
-- todo mundo achando que está resolvido.
do $$
begin
  if not has_table_privilege('service_role', 'public.equip_equipe_entrega', 'SELECT') then
    raise exception 'v246 abortada: service_role continua sem select em equip_equipe_entrega';
  end if;
  -- A outra leitura do mesmo portão. Já existia; conferir é barato e evita o
  -- próximo susto pelo mesmo motivo do lado de cá.
  if not has_table_privilege('service_role', 'public.colaboradores_chabra', 'SELECT') then
    raise exception 'v246 abortada: service_role sem select em colaboradores_chabra';
  end if;
end $$;

insert into public.schema_migrations (version)
values ('v246_equipe_entrega_grant_service_role')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
