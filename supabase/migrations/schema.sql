-- =====================================================================
-- SCHEMA DE BANCO DE DADOS - SCHOLARLY ARCHIVE SYSTEM (SUPABASE)
-- =====================================================================
-- Este script realiza a migração estrutural para o Supabase.
-- Execute este script no SQL Editor do seu Dashboard do Supabase.
-- =====================================================================

-- 1. Habilitar a extensão uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpeza preventiva de tabelas anteriores (se existirem)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP TABLE IF EXISTS public.circulacao CASCADE;
DROP TABLE IF EXISTS public.acervo CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- 2. Tabela public.usuarios (Membros da Biblioteca)
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('estudante', 'docente', 'funcionario', 'administrador')),
    curso_departamento TEXT,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    foto_url TEXT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela public.acervo (Livros e Materiais)
CREATE TABLE public.acervo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    autor TEXT NOT NULL,
    isbn TEXT UNIQUE NOT NULL,
    categoria TEXT NOT NULL,
    ano INTEGER NOT NULL,
    exemplares_total INTEGER NOT NULL DEFAULT 1 CHECK (exemplares_total >= 0),
    exemplares_disponiveis INTEGER NOT NULL DEFAULT 1 CHECK (exemplares_disponiveis >= 0),
    prateleira TEXT,
    capa_url TEXT,
    pdf_url TEXT,
    curso TEXT DEFAULT 'Multidisciplinar / Geral',
    numero_chamada TEXT,
    titulo_original TEXT,
    publicacao TEXT,
    descricao_fisica TEXT,
    serie TEXT,
    notas TEXT,
    assuntos TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_disponiveis CHECK (exemplares_disponiveis <= exemplares_total)
);

-- 4. Tabela public.circulacao (Controle de Empréstimos)
CREATE TABLE public.circulacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.acervo(id) ON DELETE RESTRICT,
    data_emprestimo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data_devolucao_prevista TIMESTAMP WITH TIME ZONE NOT NULL,
    data_devolucao_real TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'atrasado', 'devolvido')),
    multa_acumulada NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    renovacoes_contagem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acervo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circulacao ENABLE ROW LEVEL SECURITY;

-- 6. Funções Utilitárias e Políticas RLS

-- Função auxiliar para verificar se o usuário autenticado é administrador (gestor)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND tipo = 'administrador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para a tabela 'usuarios'
CREATE POLICY "Gestores possuem controle total sobre usuarios"
ON public.usuarios FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuarios podem ver apenas o próprio perfil"
ON public.usuarios FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Políticas para a tabela 'acervo'
CREATE POLICY "Gestores possuem controle total sobre acervo"
ON public.acervo FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Todos os usuários autenticados podem ver o acervo"
ON public.acervo FOR SELECT
TO authenticated
USING (true);

-- Políticas para a tabela 'circulacao'
CREATE POLICY "Gestores possuem controle total sobre circulacao"
ON public.circulacao FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuarios podem ver apenas os próprios empréstimos"
ON public.circulacao FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

-- 7. Gatilho automático de Sincronização entre Auth.Users e Public.Usuarios
-- Facilita o cadastro usando a API do Supabase Auth Admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome_completo, matricula, tipo, email, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome_completo', 'Novo Usuário'),
    COALESCE(new.raw_user_meta_data->>'matricula', 'MAT-' || upper(substring(new.id::text from 1 for 8))),
    COALESCE(new.raw_user_meta_data->>'tipo', 'estudante'),
    new.email,
    TRUE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
