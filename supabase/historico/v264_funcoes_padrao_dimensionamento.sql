-- v264 — Gerente e supervisores passam a ter o módulo Dimensionamento por padrão (v263).
-- Vale para contas NOVAS dessas funções; contas existentes: marcar o módulo em Sistema › Usuários.
-- Rollback: update funcoes_painel set modulos_padrao = array_remove(modulos_padrao, 'dimensionamento')
--           where funcao in ('Gerente','Supervisor dos técnicos','Supervisora do administrativo');
update public.funcoes_painel
   set modulos_padrao = array_append(coalesce(modulos_padrao, '{}'), 'dimensionamento')
 where funcao in ('Gerente', 'Supervisor dos técnicos', 'Supervisora do administrativo')
   and not ('dimensionamento' = any(coalesce(modulos_padrao, '{}')));
