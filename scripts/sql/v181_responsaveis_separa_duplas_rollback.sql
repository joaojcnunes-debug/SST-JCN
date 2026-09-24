-- ROLLBACK da V181 — volta os dois técnicos para o mesmo campo de texto.
--
-- Restaura a partir de `backup_v181_responsaveis_duplas`, que a v181 gravou
-- antes de tocar em qualquer linha. Não reconstrói nada por dedução.

-- 1) Apaga as linhas que a v181 criou (id determinístico derivado da origem).
DELETE FROM responsaveis r
WHERE EXISTS (
  SELECT 1 FROM backup_v181_responsaveis_duplas b
  WHERE r.id_responsavel =
    'RSP-' || upper(substring(md5(b.id_responsavel || '#v181') from 1 for 8))
);

-- 2) Devolve o texto original às linhas de origem.
UPDATE responsaveis r
SET tecnico_responsavel = b.tecnico_responsavel
FROM backup_v181_responsaveis_duplas b
WHERE r.id_responsavel = b.id_responsavel;

-- 3) A rede de segurança só sai depois de conferir o resultado acima.
-- DROP TABLE backup_v181_responsaveis_duplas;

DELETE FROM public.schema_migrations WHERE version = 'v181_responsaveis_separa_duplas';
