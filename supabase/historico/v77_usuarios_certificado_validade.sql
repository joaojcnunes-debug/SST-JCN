-- v77: validade e titular do certificado A1, extraídos do .pfx quando a senha
-- é fornecida (na assinatura ou na verificação manual em /api/cert/validar).
-- A senha do certificado NUNCA é persistida.
alter table public.usuarios
  add column if not exists certificado_validade timestamptz,
  add column if not exists certificado_titular text;
