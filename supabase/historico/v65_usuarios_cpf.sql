-- Adiciona campo CPF à tabela de usuários para uso na FolhaAssinaturas dos laudos.
-- O CPF é exibido sempre mascarado (***.***.***-**) conforme LGPD.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf TEXT;
