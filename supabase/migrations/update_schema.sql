-- =====================================================================
-- EXECUTAR NO SQL EDITOR DO SUPABASE DASHBOARD
-- =====================================================================
-- Este script realiza as alterações necessárias para o Repositório
-- Institucional e Catalogação Avançada da Biblioteca Inbook.
-- =====================================================================

-- 1. Alterar tabela public.acervo para adicionar novas colunas catalográficas e curso
ALTER TABLE public.acervo 
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS curso TEXT DEFAULT 'Multidisciplinar / Geral',
  ADD COLUMN IF NOT EXISTS numero_chamada TEXT,
  ADD COLUMN IF NOT EXISTS titulo_original TEXT,
  ADD COLUMN IF NOT EXISTS publicacao TEXT,
  ADD COLUMN IF NOT EXISTS descricao_fisica TEXT,
  ADD COLUMN IF NOT EXISTS serie TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS assuntos TEXT;

-- 2. Criar o bucket 'documentos-academicos' no Supabase Storage (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('documentos-academicos', 'documentos-academicos', true, 20971520, '{application/pdf}')
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS para o novo bucket de Storage
-- Permite leitura pública de documentos por qualquer pessoa
DROP POLICY IF EXISTS "Leitura pública de documentos" ON storage.objects;
CREATE POLICY "Leitura pública de documentos" 
  ON storage.objects FOR SELECT TO public 
  USING (bucket_id = 'documentos-academicos');

-- Permite controle total de documentos para administradores autenticados
DROP POLICY IF EXISTS "Gestores podem gerenciar documentos" ON storage.objects;
CREATE POLICY "Gestores podem gerenciar documentos" 
  ON storage.objects FOR ALL TO authenticated 
  USING (
    bucket_id = 'documentos-academicos' AND 
    (SELECT tipo FROM public.usuarios WHERE id = auth.uid()) = 'administrador'
  );
