-- V16 — Adiciona módulos Apreciação de Máquinas e Inventário de Máquinas
--
-- Estende a coluna modulos_permitidos para incluir 'apreciacao_maquinas' e
-- 'inventario_maquinas'. Atualiza o DEFAULT e propaga para usuários
-- existentes (sem duplicar).

-- 1) Atualiza o DEFAULT da coluna
ALTER TABLE public.usuarios
  ALTER COLUMN modulos_permitidos
  SET DEFAULT ARRAY[
    'painel',
    'psicossocial',
    'conformidade',
    'nao_conformidade',
    'apreciacao_maquinas',
    'inventario_maquinas'
  ]::text[];

-- 2) Adiciona 'apreciacao_maquinas' para quem ainda não tem
UPDATE public.usuarios
   SET modulos_permitidos =
       modulos_permitidos || ARRAY['apreciacao_maquinas']::text[]
 WHERE NOT (modulos_permitidos @> ARRAY['apreciacao_maquinas']::text[]);

-- 3) Adiciona 'inventario_maquinas' para quem ainda não tem
UPDATE public.usuarios
   SET modulos_permitidos =
       modulos_permitidos || ARRAY['inventario_maquinas']::text[]
 WHERE NOT (modulos_permitidos @> ARRAY['inventario_maquinas']::text[]);
