-- v73: FKs faltando + índices únicos para dedupe no banco.

-- inspecao_maquinas era a única tabela-filha de inspeção sem FK. Sem isso,
-- deletar uma inspeção deixava as máquinas NR-12 órfãs. id_setor já é text (v70).
alter table public.inspecao_maquinas
  add constraint inspecao_maquinas_id_inspecao_fkey
    foreign key (id_inspecao) references public.inspecoes(id_inspecao) on delete cascade,
  add constraint inspecao_maquinas_id_empresa_fkey
    foreign key (id_empresa) references public.empresas(id_empresa) on delete cascade,
  add constraint inspecao_maquinas_id_setor_fkey
    foreign key (id_setor) references public.setores(id_setor) on delete set null;

-- Capítulos fixos de texto-padrão: dedupe no banco (2 cliques/abas no
-- "criar seções do sistema" duplicavam). Modelo já usado em aet_textos_padrao.
create unique index if not exists ux_textos_padrao_slug_fixo
  on public.textos_padrao (modulo, slug_fixo) where slug_fixo is not null;
create unique index if not exists ux_aep_textos_padrao_slug_fixo
  on public.aep_textos_padrao (slug_fixo) where slug_fixo is not null;
create unique index if not exists ux_drps_texto_padrao_slug_fixo
  on public.drps_texto_padrao (slug_fixo) where slug_fixo is not null;

-- Categorias QPS: dedupe na importação de Excel concorrente.
create unique index if not exists ux_qps_categorias_tipo_nome
  on public.qps_categorias (id_tipo, lower(nome));
