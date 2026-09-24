-- v59: bucket privado para certificados A1 e coluna no perfil do usuário
-- O arquivo .pfx nunca fica exposto publicamente — bucket não-público com
-- políticas que só permitem leitura a usuários autenticados.

-- Coluna no perfil
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS certificado_pfx_path TEXT;

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth read certificados"   ON storage.objects;
DROP POLICY IF EXISTS "Auth write certificados"  ON storage.objects;
DROP POLICY IF EXISTS "Auth update certificados" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete certificados" ON storage.objects;

CREATE POLICY "Auth read certificados"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'certificados');

CREATE POLICY "Auth write certificados"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificados');

CREATE POLICY "Auth update certificados"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'certificados');

CREATE POLICY "Auth delete certificados"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificados');
