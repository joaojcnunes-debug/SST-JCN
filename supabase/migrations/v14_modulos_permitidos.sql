-- V14 — Permissões por módulo (Painel SST / Psicossocial / Conformidade / Não Conformidade)
--
-- Cada usuário guarda em `modulos_permitidos` a lista de módulos a que tem
-- acesso. Admins têm acesso a todos os módulos independentemente do conteúdo
-- desta coluna (regra aplicada no frontend e em RLS futuras se necessário).
--
-- Valores possíveis: 'painel', 'psicossocial', 'conformidade', 'nao_conformidade'.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS modulos_permitidos text[] NOT NULL
  DEFAULT ARRAY['painel','psicossocial','conformidade','nao_conformidade']::text[];

-- Reaplica o default para usuários antigos que ficaram com NULL ou array vazio
-- (não afeta novas inserções porque o NOT NULL + DEFAULT cuidam disso).
UPDATE public.usuarios
   SET modulos_permitidos = ARRAY['painel','psicossocial','conformidade','nao_conformidade']::text[]
 WHERE modulos_permitidos IS NULL
    OR cardinality(modulos_permitidos) = 0;
