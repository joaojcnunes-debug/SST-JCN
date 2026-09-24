-- v233 — Cargo canônico: lista fixa de cargos + normalização das 59 contas.
--
-- Pedido dele (17/09 e 21/09/2026): padronizar cargo/função; "para padronizar
-- devemos ter essa lista com os cargos citados anteriormente. a escrita não
-- padroniza nada". Medido em 18/09: 22 grafias para ~15 cargos (5 contas sem
-- cargo). O cargo sai em laudo e assinatura, por isso a lista guarda o gênero.
--
-- Respostas dele (21/09): José Henrique = engenheiro (⚠️ NÃO aplicado aqui: ele
-- assina com CRM 52-27712-0 como Médico do Trabalho e a assinatura deduz o
-- registro pelo cargo — trocar o cargo tiraria o CRM do laudo; pendente dele);
-- Sarah e Ana Clara = psicólogas; Andrea, Fabio e Isaac = auxiliar
-- administrativo; Nikoly = junto dos auxiliares (rastro de uso ZERO — não faz o
-- que a Emilia faz); Emilia = supervisora (cargo "Supervisora Técnica").
--
-- Como padroniza de verdade: cargos_painel é a lista; o gatilho
-- usuarios_cargo_na_lista recusa cargo fora dela (com mensagem em português).
-- A tela de Usuários ainda é texto livre (tela do outro dev): até o menu de
-- escolha chegar, quem cria conta digita um nome EXATO da lista (Sistema ›
-- Funções mostra a lista). Admin edita a lista pela API/tela; os outros só leem.
--
-- 2 contas ficam sem cargo de propósito: a conta compartilhada "Psicossocial"
-- ("pode deixar intacta") e a conta de teste. detectRegistroTipo continua
-- deduzindo o conselho pelo texto: os nomes da lista casam como antes
-- (segur → MTE, medic → CRM, psicol → CRP). 🪤 Engenheiro cai em "MTE" (deveria
-- ser CREA) — já era assim; fora do escopo.
--
-- Reversível: backup_v233_usuarios_cargo guarda o cargo de antes;
-- scripts/sql/v233_rollback_cargos.sql.

-- NO JCN: aplicados o catalogo de cargos, o backup e o gatilho
-- usuarios_cargo_na_lista. Os ~18 UPDATEs por id_usuario e a guarda de
-- contagem sao do painel. No lugar deles, uma unica normalizacao: a conta
-- com cargo 'ti' minusculo virou 'TI'. Sem isso o gatilho novo travaria a
-- proxima edicao dessa conta, porque 'ti' nao esta no catalogo.

begin;

-- 1) A lista
create table if not exists public.cargos_painel (
  cargo     text primary key,
  ordem     int  not null,
  registro  text check (registro in ('MTE','CREA','CRM','CRP')),
  criado_em timestamptz not null default now()
);
comment on table public.cargos_painel is 'v233: lista fixa de cargos das contas do painel. usuarios.cargo só aceita valor daqui (gatilho usuarios_cargo_na_lista).';
alter table public.cargos_painel enable row level security;
drop policy if exists cargos_painel_sel on public.cargos_painel;
create policy cargos_painel_sel on public.cargos_painel for select to authenticated using (true);
drop policy if exists cargos_painel_adm on public.cargos_painel;
create policy cargos_painel_adm on public.cargos_painel for all to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());
grant select, insert, update, delete on public.cargos_painel to authenticated;

insert into public.cargos_painel (cargo, ordem, registro) values
  ('Técnico em Segurança do Trabalho', 1, 'MTE'),
  ('Técnica em Segurança do Trabalho', 2, 'MTE'),
  ('Supervisor Técnico em Segurança do Trabalho', 3, 'MTE'),
  ('Supervisora Técnica', 4, null),
  ('Engenheiro de Segurança do Trabalho', 5, 'CREA'),
  ('Médico do Trabalho', 6, 'CRM'),
  ('Psicólogo', 7, 'CRP'),
  ('Psicóloga', 8, 'CRP'),
  ('Auxiliar Administrativo', 9, null),
  ('Supervisora Administrativa', 10, null),
  ('Gerente', 11, null),
  ('Analista', 12, null),
  ('Comercial', 13, null),
  ('RH', 14, null),
  ('TI', 15, null)
on conflict (cargo) do update set ordem = excluded.ordem, registro = excluded.registro;

-- 2) Backup do cargo de antes
create table if not exists public.backup_v233_usuarios_cargo (
  id_usuario text primary key,
  cargo      text,
  gravado_em timestamptz not null default now()
);
insert into public.backup_v233_usuarios_cargo (id_usuario, cargo)
select id_usuario, cargo from public.usuarios
    on conflict (id_usuario) do nothing;

-- JCN: unica mudanca de dados aplicada aqui.
update public.usuarios set cargo = 'TI' where cargo = 'ti';

-- 3) Normalização, conta a conta (só id; o nome fica fora do repositório)

-- 4) O gatilho: daqui em diante só cargo da lista (NULL continua permitido)
create or replace function public.usuarios_cargo_na_lista()
returns trigger
language plpgsql
as $$
begin
  if new.cargo is not null and not exists (select 1 from public.cargos_painel c where c.cargo = new.cargo) then
    raise exception 'Cargo "%" não está na lista de cargos do painel. Escolha um dos cargos em Sistema › Funções.', new.cargo
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists usuarios_cargo_na_lista on public.usuarios;
create trigger usuarios_cargo_na_lista
  before insert or update of cargo on public.usuarios
  for each row execute function public.usuarios_cargo_na_lista();

-- 5) Conferência: se qualquer número não bater, a transação inteira volta
do $$
begin
  if (select count(*) from public.usuarios where cargo is not null and cargo not in (select cargo from public.cargos_painel)) <> 0 then raise exception 'v233: ainda ha cargo fora da lista'; end if;
end $$;


commit;

notify pgrst, 'reload schema';
