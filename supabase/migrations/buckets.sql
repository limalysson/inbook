-- =====================================================================
-- CRIAÇÃO DE BUCKETS DE STORAGE (SUPABASE)
-- =====================================================================
-- Execute este script no SQL Editor do seu Dashboard do Supabase
-- para criar automaticamente os buckets de armazenamento público.
-- =====================================================================

-- 1. Inserir buckets públicos na tabela do Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('capas-livros', 'capas-livros', true, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('fotos-perfis', 'fotos-perfis', true, 2097152, '{image/jpeg,image/png,image/webp}'),
  ('documentos-academicos', 'documentos-academicos', true, 20971520, '{application/pdf}')
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas RLS para os Buckets de Storage
-- Permite que qualquer pessoa leia arquivos do Storage de forma pública
CREATE POLICY "Leitura pública de capas" ON storage.objects FOR SELECT TO public USING (bucket_id = 'capas-livros');
CREATE POLICY "Leitura pública de perfis" ON storage.objects FOR SELECT TO public USING (bucket_id = 'fotos-perfis');
CREATE POLICY "Leitura pública de documentos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'documentos-academicos');

-- Permite que apenas administradores autenticados façam upload/alteração nas pastas
CREATE POLICY "Gestores podem gerenciar capas" ON storage.objects FOR ALL TO authenticated 
USING (
  bucket_id = 'capas-livros' AND 
  (SELECT tipo FROM public.usuarios WHERE id = auth.uid()) = 'administrador'
);

CREATE POLICY "Gestores podem gerenciar perfis" ON storage.objects FOR ALL TO authenticated 
USING (
  bucket_id = 'fotos-perfis' AND 
  (SELECT tipo FROM public.usuarios WHERE id = auth.uid()) = 'administrador'
);

CREATE POLICY "Gestores podem gerenciar documentos" ON storage.objects FOR ALL TO authenticated 
USING (
  bucket_id = 'documentos-academicos' AND 
  (SELECT tipo FROM public.usuarios WHERE id = auth.uid()) = 'administrador'
);
