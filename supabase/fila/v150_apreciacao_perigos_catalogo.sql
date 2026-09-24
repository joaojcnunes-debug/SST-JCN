-- v150 — Apreciação NR-12: catálogo de perigos reutilizável.
--
-- CONTEXTO: no handoff SST-JCN, escolher um perigo do catálogo PRÉ-PREENCHE a
-- linha HRN (tipo, origem/consequências, itens NR-12, medidas Eng./Adm. e os
-- fatores POD/FEP/GPD inicial e residual). É o que faz a tabela de risco deixar
-- de ser digitação em branco.
--
-- ⚠️ SOBRE O CONTEÚDO SEEDADO — LEIA ANTES DE USAR EM LAUDO:
--   O handoff diz "12 perigos seedados" mas NÃO traz o conteúdo deles, e o
--   código do SST-JCN não está nesta máquina. Os 12 registros abaixo foram
--   redigidos aqui a partir das categorias da NR-12 e dos perigos que aparecem
--   no laudo de referência TERE PÃO. São PONTO DE PARTIDA editável, não norma.
--   * `itens_nr12` só está preenchido nos perigos cujos itens aparecem
--     literalmente no laudo de referência. Nos demais fica VAZIO de propósito:
--     item de norma errado se replica em todo laudo emitido.
--   * Os POD/FEP/GPD são sugestões de partida. Quem assina decide, e o valor
--     gravado na linha é o que vale.
--   O responsável técnico deve revisar o catálogo antes do primeiro laudo.
--
-- Faixas de classificação NÃO mudam nesta migration: o painel segue com
-- ≤4 / ≤12 / ≤32, decisão tomada (duas vezes) em 2026-07-30. O handoff descreve
-- as faixas TERE PÃO (≤8 / ≤18 / ≤36) usadas na OUTRA instância — divergência
-- registrada e deixada para decisão do RT.
--
-- Idempotente: seed com `on conflict do nothing` por `nome`. Rodar com `psql -1`.

create table if not exists public.apreciacao_perigos_catalogo (
  id_perigo            text primary key,
  nome                 text not null unique,
  origem_consequencias text,
  itens_nr12           text[],
  medidas_eng          text,
  medidas_adm          text,
  pod_default          text,
  fep_default          text,
  gpd_default          text,
  pod_residual_default text,
  fep_residual_default text,
  gpd_residual_default text,
  categoria_seguranca_default text,
  ordem                integer not null default 0,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

comment on table public.apreciacao_perigos_catalogo is
  'Perigos NR-12 reutilizáveis. Escolher um pré-preenche a linha HRN da ficha. Conteúdo é ponto de partida editável — ver cabeçalho da migration v150.';

create index if not exists idx_perigos_catalogo_ordem
  on public.apreciacao_perigos_catalogo (ativo, ordem);

-- ── RLS: leitura livre (é catálogo), escrita só para quem edita ─────────────
alter table public.apreciacao_perigos_catalogo enable row level security;

drop policy if exists apreciacao_perigos_catalogo_sel on public.apreciacao_perigos_catalogo;
create policy apreciacao_perigos_catalogo_sel
  on public.apreciacao_perigos_catalogo for select using (true);

drop policy if exists apreciacao_perigos_catalogo_rw on public.apreciacao_perigos_catalogo;
create policy apreciacao_perigos_catalogo_rw
  on public.apreciacao_perigos_catalogo for all
  using (caller_pode_editar()) with check (caller_pode_editar());

grant select on public.apreciacao_perigos_catalogo to anon;
grant select, insert, update, delete on public.apreciacao_perigos_catalogo to authenticated;
grant select, insert, update, delete on public.apreciacao_perigos_catalogo to service_role;
grant select on public.apreciacao_perigos_catalogo to backup_operator;

-- ── Seed dos 12 perigos ─────────────────────────────────────────────────────
insert into public.apreciacao_perigos_catalogo
  (id_perigo, nome, origem_consequencias, itens_nr12, medidas_eng, medidas_adm,
   pod_default, fep_default, gpd_default,
   pod_residual_default, fep_residual_default, gpd_residual_default,
   categoria_seguranca_default, ordem)
values
  ('PRG-00000001', 'Agentes perfurocortantes',
   'Lâmina/zona de corte exposta na operação → cortes, amputações, perfurações',
   array['12.38 a 12.55','12.56 a 12.63'],
   'Proteção fixa ou móvel intertravada sobre a zona de corte; dispositivo de avanço/empurrador.',
   'Capacitação do operador; proibição de retirar proteção; uso de luva de malha.',
   'IMPROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE','3', 10),

  ('PRG-00000002', 'Prensamento e esmagamento',
   'Aproximação de partes móveis entre si ou contra parte fixa → esmagamento de mãos e dedos',
   array['12.38 a 12.55'],
   'Proteção fixa distanciadora; cortina de luz; comando bimanual.',
   'Procedimento de operação; capacitação; sinalização da zona de perigo.',
   'IMPROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE','3', 20),

  ('PRG-00000003', 'Aprisionamento por esteira ou transportador',
   'Contato com correia, tambor ou roletes em movimento → arrastamento e amputação',
   null,
   'Enclausuramento dos pontos de aprisionamento; cabo de emergência ao longo do transportador.',
   'Bloqueio para limpeza; proibição de intervir com a máquina em movimento.',
   'IMPROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE','3', 30),

  ('PRG-00000004', 'Movimento por inércia',
   'Continuidade do movimento após o desligamento → contato com peça ainda em movimento',
   array['12.46'],
   'Sistema de frenagem/parada controlada; intertravamento que impeça o acesso antes da parada total.',
   'Aguardar a parada completa antes de limpar ou ajustar.',
   'IMPROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE','3', 40),

  ('PRG-00000005', 'Projeção de partículas',
   'Fragmentos projetados durante a operação → lesões oculares e cutâneas',
   array['12.14 a 12.23'],
   'Anteparo ou defletor na zona de projeção; sistema de captação.',
   'Uso de óculos de proteção; delimitação da área.',
   'IMPROVAVEL','DIARIAMENTE','MODERADA','REMOTA','DIARIAMENTE','MODERADA','1', 50),

  ('PRG-00000006', 'Choque elétrico',
   'Partes energizadas acessíveis, aterramento inexistente ou cabeamento danificado → choque e queimadura',
   null,
   'Aterramento conforme norma; quadro elétrico fechado e identificado; proteção contra contato direto.',
   'Inspeção elétrica periódica; intervenção só por profissional habilitado (NR-10).',
   'IMPROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE','3', 60),

  ('PRG-00000007', 'Partida acidental durante manutenção',
   'Energização inesperada na manutenção ou limpeza → esmagamento e amputação',
   null,
   'Dispositivo de bloqueio e etiquetagem (LOTO); seccionador com cadeado.',
   'Procedimento de bloqueio de energias; capacitação da manutenção; ordem de serviço.',
   'IMPROVAVEL','MENSALMENTE','CATASTROFICA','REMOTA','MENSALMENTE','CATASTROFICA','3', 70),

  ('PRG-00000008', 'Ausência ou ineficácia da parada de emergência',
   'Impossibilidade de interromper o movimento em situação de risco → agravamento da lesão',
   array['12.56 a 12.63'],
   'Botão de emergência tipo soco, acessível de todos os postos, com rearme manual.',
   'Teste funcional periódico registrado.',
   'IMPROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE','3', 80),

  ('PRG-00000009', 'Superfície aquecida',
   'Contato com superfície ou produto aquecido → queimadura térmica',
   null,
   'Isolamento térmico; barreira física; sinalização de superfície quente.',
   'Uso de luva térmica; procedimento de operação a quente.',
   'IMPROVAVEL','DIARIAMENTE','MODERADA','REMOTA','DIARIAMENTE','MODERADA','1', 90),

  ('PRG-00000010', 'Ruído',
   'Exposição contínua ao ruído da máquina → perda auditiva induzida',
   null,
   'Enclausuramento acústico; manutenção de mancais e rolamentos.',
   'Protetor auricular; avaliação quantitativa e inclusão no PGR.',
   'PROVAVEL','DIARIAMENTE','MODERADA','IMPROVAVEL','DIARIAMENTE','MODERADA','B', 100),

  ('PRG-00000011', 'Posto de trabalho inadequado',
   'Altura, alcance ou postura impostos pela máquina → lesão musculoesquelética',
   null,
   'Ajuste de altura do posto; dispositivo de elevação de carga; apoio para os pés.',
   'Pausas; rodízio; análise ergonômica preliminar (NR-17).',
   'PROVAVEL','DIARIAMENTE','MODERADA','IMPROVAVEL','DIARIAMENTE','MODERADA','B', 110),

  ('PRG-00000012', 'Sinalização e capacitação insuficientes',
   'Ausência de sinalização, manual ou treinamento → operação insegura por desconhecimento',
   null,
   'Sinalização de segurança fixada na máquina; identificação dos comandos.',
   'Capacitação NR-12 registrada; manual de instruções em português disponível no posto.',
   'PROVAVEL','DIARIAMENTE','GRAVE','IMPROVAVEL','DIARIAMENTE','GRAVE','B', 120)
on conflict (nome) do nothing;

do $$
declare n integer;
begin
  select count(*) into n from public.apreciacao_perigos_catalogo where ativo;
  if n < 12 then
    raise exception 'v150 abortada: catalogo ficou com % perigos ativos (esperado >= 12)', n;
  end if;
  raise notice 'v150 OK: % perigos no catalogo', n;
end $$;
