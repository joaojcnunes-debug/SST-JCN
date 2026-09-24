-- V203 — passa os documentos da elaboração de Ana Luiza para Paulina Cunha
--
-- ⚠️ NASCEU COMO v202 E FOI RENUMERADA para v203 em 2026-09-09. Outra sessão
-- commitou `v202_gestao_aprovacoes.sql` no mesmo número (c149be9). O runner
-- (`deploy/migrate.ps1`) controla por NOME de arquivo, então as duas conviviam
-- sem quebrar — a colisão era de leitura humana. Renumerei esta porque a outra
-- já estava na história do git e esta ainda não tinha sido commitada.
--
-- O que NÃO mudou de nome, de propósito, porque JÁ EXISTE na produção:
--   • a tabela `backup_v202_transferencia_elaboracao` (97 linhas gravadas);
--   • o carimbo `created_by = 'Transferencia v202 (...)'` nas 86 linhas de
--     associado — é por ele que o rollback sabe o que apagar.
-- Renomear qualquer um dos dois cegaria o desfazer.
--
-- Em `schema_migrations` a produção tem a linha antiga
-- `v202_transferencia_elaboracao_ana_para_paulina`. O migrate.ps1 vai ver
-- `v203_...` como pendente e rodar de novo — isso é INOFENSIVO: os dois
-- `insert` têm `on conflict do nothing` e o `update` casa 0 linhas (não existe
-- mais 'Ana Luiza' responsável). O efeito é só uma segunda linha em
-- schema_migrations. Para evitar até isso, basta rodar antes, na .107:
--   update public.schema_migrations set version =
--     'v203_transferencia_elaboracao_ana_para_paulina'
--    where version = 'v202_transferencia_elaboracao_ana_para_paulina';
--
-- ─── O pedido ──────────────────────────────────────────────────────────────
--
-- Pedido do Sanmyo em 2026-09-08: "passar todos os documentos em aberto e
-- concluídos da colaboradora Ana Luiza para a Paulina". São os documentos do
-- SGG — a etapa de elaboração que o administrativo toca depois da visita.
--
-- ─── O que se mediu na produção ANTES (2026-09-08) ─────────────────────────
--
--   Ana Luiza (USR-8D34C221) é a responsável de 97 documentos:
--        60 CONCLUIDO  +  37 EM_ELABORACAO   (nenhuma inspeção DELETADA)
--   Paulina Cunha (USR-E1553F49) tem hoje 63:
--        36 CONCLUIDO  +  27 EM_ELABORACAO
--   Depois desta migration a Paulina fica com 160 e a Ana Luiza com 0.
--
--   Só existem essas duas grafias no banco ("Ana Luiza" e "Paulina Cunha"),
--   por isso a comparação é por igualdade e não por ILIKE: não há homônimo
--   nem variação de caixa para acertar por engano.
--
-- ─── O que MUDA, e o que fica de propósito ─────────────────────────────────
--
-- MUDA: `inspecoes.elaboracao_responsavel`. É esse campo que decide as duas
--       coisas que o Sanmyo pediu — o CRÉDITO no dashboard (a regra dele de
--       27/08: o documento conta para quem está com ele AGORA, ver
--       lib/dashboard/documentos.ts) e o NOME que aparece dentro do documento.
--       A busca da listagem por associado também casa este campo, então
--       filtrar por "Paulina" já traz os 97.
--
-- NÃO MUDA: `inspecao_associados` — as 86 linhas da Ana Luiza ficam onde
--       estão. Essa tabela é o histórico de quem passou pelo documento, não
--       título de propriedade, e é ela que deixa saber depois que a Ana Luiza
--       trabalhou nesses documentos. Decisão do Sanmyo nesta mesma conversa:
--       "só o crédito e o nome do documento, deixe um rastro".
--
-- NÃO MUDA: `updated_at` (a tabela não tem trigger, o UPDATE não o toca),
--       `elaboracao_concluida_em`, `elaboracao_status` e a data de conclusão.
--       Nenhum documento muda de estado: concluído continua concluído, em
--       aberto continua em aberto. Só troca a pessoa.
--
-- ─── O rastro ──────────────────────────────────────────────────────────────
--
-- `backup_v202_transferencia_elaboracao` guarda uma linha por documento com o
-- nome de antes, o de depois e o status na hora da troca. Serve para responder
-- "o que foi trocado" e é a fonte do desfazer, em
-- scripts/sql/v202_rollback_transferencia_elaboracao.sql.

begin;

create table if not exists public.backup_v202_transferencia_elaboracao (
  id_inspecao        text primary key,
  responsavel_antes  text not null,
  responsavel_depois text not null,
  -- Status da elaboração no momento da troca: é o que separa "em aberto" de
  -- "concluído" na hora de conferir o antes e o depois.
  elaboracao_status  text,
  motivo             text not null,
  transferido_em     timestamptz not null default now()
);

insert into public.backup_v202_transferencia_elaboracao
       (id_inspecao, responsavel_antes, responsavel_depois, elaboracao_status, motivo)
select i.id_inspecao,
       i.elaboracao_responsavel,
       'Paulina Cunha',
       i.elaboracao_status,
       'Transferencia de documentos Ana Luiza -> Paulina Cunha (pedido de 2026-09-08)'
  from public.inspecoes i
 where i.elaboracao_responsavel = 'Ana Luiza'
    -- Reaplicar não deve inventar linha nova nem sobrescrever o nome de antes.
    on conflict (id_inspecao) do nothing;

update public.inspecoes
   set elaboracao_responsavel = 'Paulina Cunha'
 where elaboracao_responsavel = 'Ana Luiza';

-- ─── Parte 2: a data de entrada, para o gráfico por mês ────────────────────
--
-- Medido na prévia (cópia da produção, 2026-09-08): trocar SÓ o responsável
-- acerta o total (Paulina 160) e erra o recorte por mês. O gráfico usa a data
-- em que a pessoa ENTROU no documento, que só existe em `inspecao_associados`
-- — e a Paulina não tem linha nesses 97. Sem esta parte:
--
--     julho  153 → 109      agosto  127 → 85
--     aviso "documentos sem registro de associação"  108 → 194
--
-- e os 86 documentos não apareceriam em mês nenhum, só no acumulado. Como as
-- duas telas abrem no MÊS CORRENTE (v0.3.547), na prática eles sumiriam da
-- vista. Com esta parte, julho e agosto voltam a 153 e 127 — os mesmos de
-- hoje, agora no nome da Paulina (59 e 60).
--
-- A data copiada é a da Ana Luiza, de propósito: com `now()` os 86 sairiam de
-- julho/agosto e desabariam todos em setembro, inventando um pico de produção
-- que não aconteceu.
--
-- A linha da Ana Luiza NÃO é apagada — as duas ficam. É isso que deixa saber
-- depois quem passou pelo documento, e é o rastro pedido pelo Sanmyo.
--
-- Os 11 documentos em que ela era responsável sem ter linha de associado
-- continuam sem data de entrada: já contavam assim antes, e não há data para
-- copiar. São eles a maior parte do aviso de 108, que não muda.

insert into public.inspecao_associados (id, id_inspecao, id_usuario, nome, created_by, created_at)
select 'IAS-' || upper(substring(md5(random()::text || a.id_inspecao) for 8)),
       a.id_inspecao,
       'USR-E1553F49',
       'Paulina Cunha',
       'Transferencia v202 (Ana Luiza -> Paulina Cunha)',
       a.created_at
  from public.inspecao_associados a
  join public.backup_v202_transferencia_elaboracao b on b.id_inspecao = a.id_inspecao
 where a.id_usuario = 'USR-8D34C221'
    -- Se a Paulina já estiver associada, a linha dela vale (hoje são 0 casos).
    on conflict (id_inspecao, id_usuario) do nothing;

commit;
