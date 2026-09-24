-- ROLLBACK da v212 — tira o gatilho de todas as tabelas e apaga as funções.
--
-- A tabela `auditoria_eventos` (e a config `auditoria_tabelas`) FICAM: são o
-- registro do que aconteceu, e apagar registro é decisão do operador, não do
-- rollback. Para descartar de vez:
--   drop table public.auditoria_eventos; drop table public.auditoria_tabelas;
-- Rodar com `psql -1 -v ON_ERROR_STOP=1`.

do $$
declare r record; n int := 0;
begin
  for r in
    select c.relname as tabela
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and t.tgname = 'trg_auditoria' and not t.tgisinternal
  loop
    execute format('drop trigger if exists trg_auditoria on public.%I', r.tabela);
    n := n + 1;
  end loop;
  raise notice 'rollback v212: gatilho removido de % tabela(s).', n;
end $$;

drop function if exists public.auditoria_ativar(text, text);
drop function if exists public.auditoria_desativar(text);
drop function if exists public.auditoria_registrar();
drop function if exists public.auditoria_modulo_de(text);

update public.auditoria_tabelas set ativo = false;

delete from public.schema_migrations where version = 'v212_auditoria_eventos';

notify pgrst, 'reload schema';
