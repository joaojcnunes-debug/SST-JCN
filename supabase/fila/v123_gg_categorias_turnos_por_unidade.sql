-- v123 — Gestão Gerencial: categorias e turnos POR UNIDADE.
--
-- Decisão de modelagem: cada unidade tem seu próprio cadastro de categorias e turnos
-- (a v122 os criou globais). Ajusta o modelo:
--   • id_unidade em gg_categorias e gg_turnos (escopo por unidade);
--   • a categoria do profissional vai para o VÍNCULO (gg_profissional_unidades.id_categoria),
--     porque categoria é por unidade e um profissional atua em várias (N:N);
--   • re-seed dos defaults (Manhã/Tarde, Médico/Técnico/Fono) PARA CADA unidade.
-- Sem dados reais ainda (só os seeds da v122) → limpa os globais e re-seeda. Idempotente.

-- 1) categorias/turnos ganham unidade ─────────────────────────────────────────
alter table public.gg_categorias add column if not exists id_unidade text references public.unidades(id_unidade) on delete cascade;
alter table public.gg_turnos     add column if not exists id_unidade text references public.unidades(id_unidade) on delete cascade;

-- 2) categoria do profissional passa para o vínculo ───────────────────────────
alter table public.gg_profissional_unidades add column if not exists id_categoria text references public.gg_categorias(id) on delete set null;
alter table public.gg_profissionais drop column if exists id_categoria;

-- 3) remove os seeds GLOBAIS da v122 (sem unidade) e torna id_unidade obrigatório ─
delete from public.gg_turnos     where id_unidade is null;
delete from public.gg_categorias where id_unidade is null;
do $$
begin
  if not exists (select 1 from public.gg_categorias where id_unidade is null) then
    alter table public.gg_categorias alter column id_unidade set not null;
  end if;
  if not exists (select 1 from public.gg_turnos where id_unidade is null) then
    alter table public.gg_turnos alter column id_unidade set not null;
  end if;
end $$;

-- unicidade e índices por unidade
create unique index if not exists uq_gg_categorias_unid_nome on public.gg_categorias (id_unidade, lower(nome));
create unique index if not exists uq_gg_turnos_unid_nome     on public.gg_turnos (id_unidade, lower(nome));
create index if not exists idx_gg_categorias_unid on public.gg_categorias(id_unidade);
create index if not exists idx_gg_turnos_unid     on public.gg_turnos(id_unidade);
create index if not exists idx_gg_pu_categoria    on public.gg_profissional_unidades(id_categoria);

-- 4) re-seed: turnos + categorias base PARA CADA unidade (idempotente) ─────────
insert into public.gg_turnos (id, nome, ordem, id_unidade)
  select 'TRN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), x.nome, x.ord, u.id_unidade
  from public.unidades u
  cross join (values ('Manhã',1),('Tarde',2)) as x(nome, ord)
  where not exists (select 1 from public.gg_turnos g where g.id_unidade = u.id_unidade and lower(g.nome) = lower(x.nome));

insert into public.gg_categorias (id, nome, ordem, id_unidade)
  select 'CAT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), x.nome, x.ord, u.id_unidade
  from public.unidades u
  cross join (values ('Médico',1),('Técnico',2),('Fonoaudiólogo',3)) as x(nome, ord)
  where not exists (select 1 from public.gg_categorias g where g.id_unidade = u.id_unidade and lower(g.nome) = lower(x.nome));
