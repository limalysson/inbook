-- =====================================================================
-- CONFIGURAÇÃO DE AUTOPROVISIONAMENTO JIT & OTP (SUPABASE)
-- =====================================================================
-- Execute este script no SQL Editor do seu Dashboard do Supabase.
-- Ele remove a criação automática de perfis, cria a tabela de OTPs
-- e libera as políticas de RLS para o salvamento sob demanda.
-- =====================================================================

-- 1. Remover a trigger automática (Permite autoprovisionamento JIT)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Criar a tabela de códigos temporários (OTPs)
CREATE TABLE IF NOT EXISTS public.otps (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela de OTPs
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Como as operações de OTP são gerenciadas pelo servidor Next.js,
-- permitimos acesso amplo para simplificar o desenvolvimento (os dados sensíveis/códigos estão hashados com bcrypt).
CREATE POLICY "Permite gerenciar OTPs para todos os papeis" 
ON public.otps FOR ALL 
TO anon, authenticated, service_role 
USING (true) 
WITH CHECK (true);

-- 3. Adicionar políticas de RLS para Autoprovisionamento (JIT / Upsert)
-- Permite que alunos/professores insiram e atualizem seus próprios perfis em public.usuarios
CREATE POLICY "Leitores podem inserir seu próprio perfil"
ON public.usuarios FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Leitores podem atualizar seu próprio perfil"
ON public.usuarios FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
