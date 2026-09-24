-- v161_epi_sugestoes.sql — 2026-08-06
--
-- Ponto 3 do PAINEL SST MUDANCAS.txt, sub-item "EPIs utilizados".
--
-- Cria a lista de sugestoes do campo de EPI/EPC da inspecao, derivada do que JA
-- foi cadastrado em epi_epc (4.945 linhas na producao). Decisoes do usuario em
-- 2026-08-06:
--   * sugerir SEM travar -- o campo continua aceitando texto livre, porque o
--     tecnico em campo precisa registrar equipamento que nao esta na lista;
--   * NAO reescrever nada -- as 4.945 linhas existentes ficam intocadas, a
--     funcionalidade vale so para o que for cadastrado dali para frente.
--
-- Por que o corte em 3 usos: dos 281 nomes distintos de EPI, 90 aparecem UMA
-- vez e 35 aparecem duas -- 125 nomes (45% da lista) que respondem por ~3% do
-- uso. Sao digitacao avulsa e erro de grafia, nao item de catalogo. Os 156 que
-- sobram cobrem ~97% do uso real.
--
-- Por que security_invoker: epi_epc tem RLS (policy caller_pode_ver_empresa).
-- Uma view comum roda com os direitos do DONO e furaria a policy, passando a
-- expor nomes de empresas que o usuario nao pode ver. Com security_invoker a
-- view respeita a RLS de quem consulta -- ninguem passa a ver nada novo.
--
-- Esta migration e 100% ADITIVA e nao toca em dado nenhum. Reversao:
--   drop view if exists public.v_epi_sugestoes;

begin;

set lock_timeout = '5s';

-- Trava: aborta a transacao inteira em vez de criar uma view quebrada.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'epi_epc'
  ) then
    raise exception 'epi_epc nao existe -- migration v161 abortada';
  end if;
end $$;

-- `mode()` e nao `min()`: dentro do grupo (mesma grafia ignorando maiuscula)
-- pega a forma MAIS USADA, nao a primeira em ordem alfabetica. Com min() a
-- lista saia gritando -- "PROTETOR AURICULAR" ao lado de "Luvas de Proteção" --
-- porque caixa alta ordena antes.
create or replace view public.v_epi_sugestoes
with (security_invoker = true) as
select
  tipo,
  mode() within group (order by btrim(descricao)) as descricao,
  count(*)::int                                   as usos
from public.epi_epc
where btrim(coalesce(descricao, '')) <> ''
group by tipo, lower(btrim(descricao))
having count(*) >= 3;

comment on view public.v_epi_sugestoes is
  'Sugestoes de EPI/EPC do formulario da inspecao, agregadas de epi_epc (>= 3 usos, agrupadas por grafia minuscula). NAO e catalogo oficial: o campo aceita texto livre e nada aqui reescreve epi_epc. Respeita RLS via security_invoker. v161, 2026-08-06.';

grant select on public.v_epi_sugestoes to authenticated, service_role;

commit;
