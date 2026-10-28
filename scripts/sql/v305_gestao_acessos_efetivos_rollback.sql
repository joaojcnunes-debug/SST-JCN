-- Rollback da v305 (acesso efetivo). Rodar DEPOIS de voltar o código. Só leitura: nada a desfazer nos dados.
drop function if exists public.gestao_acessos_efetivos(text, text);
