-- V42 — Adiciona 'nao_conformidade' ao default de modulos_habilitados das empresas
--
-- Empresas pré-existentes recebem o novo módulo no array (zero breaking change:
-- ficam visíveis no novo quadro). Admin pode editar depois pra restringir.
-- Também atualiza o DEFAULT da coluna pra novas empresas.

alter table public.empresas
  alter column modulos_habilitados set default
    array['sst', 'psicossocial', 'conformidade', 'nao_conformidade', 'analise_quimicos'];

update public.empresas
  set modulos_habilitados = array_append(modulos_habilitados, 'nao_conformidade')
  where not ('nao_conformidade' = any(modulos_habilitados));
