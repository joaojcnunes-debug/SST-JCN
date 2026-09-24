-- ============================================================
-- V8: Triagem → Modelos (M:N direto)
-- ============================================================
-- Simplifica a arquitetura V7. Antes: cada triagem tinha "opções"
-- (texto livre) que opcionalmente apontavam pra um modelo. Agora:
-- triagem é apenas a pergunta, e suas "opções" SÃO os modelos
-- associados a ela diretamente. Sem mais texto livre — usuário
-- vê o nome do agente do modelo como label do checkbox.
--
-- Tabela `triagens_opcao` é mantida pra compat retroativa, mas
-- nenhum código novo escreve nela.
-- Idempotente.
-- ============================================================

create table if not exists public.triagens_modelo (
  id_triagem text not null references public.triagens_tipo(id_triagem) on delete cascade,
  id_modelo  text not null references public.modelos_risco(id_modelo) on delete cascade,
  ordem      int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (id_triagem, id_modelo)
);

create index if not exists idx_triagens_modelo_triagem
  on public.triagens_modelo (id_triagem, ordem);

alter table public.triagens_modelo enable row level security;

drop policy if exists "auth read triagens_modelo" on public.triagens_modelo;
create policy "auth read triagens_modelo"
  on public.triagens_modelo for select
  to authenticated using (true);

drop policy if exists "auth write triagens_modelo" on public.triagens_modelo;
create policy "auth write triagens_modelo"
  on public.triagens_modelo for all
  to authenticated using (true) with check (true);

-- Migra triagens_opcao que tinham id_modelo pro novo modelo (silencia
-- opções de texto livre sem modelo — usuário vai re-cadastrar).
INSERT INTO public.triagens_modelo (id_triagem, id_modelo, ordem)
SELECT id_triagem, id_modelo, ordem
FROM public.triagens_opcao
WHERE id_modelo IS NOT NULL
ON CONFLICT (id_triagem, id_modelo) DO NOTHING;
