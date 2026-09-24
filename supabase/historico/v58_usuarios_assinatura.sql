-- v58: campos de assinatura digital nos usuários
-- assinatura_url: URL pública da imagem no Storage (bucket fotos / assinaturas/)
-- tipo_certificado: A1 (software/arquivo) | A3 (token/hardware) | null (nenhum)

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS assinatura_url  TEXT,
  ADD COLUMN IF NOT EXISTS tipo_certificado TEXT CHECK (tipo_certificado IN ('A1', 'A3'));
