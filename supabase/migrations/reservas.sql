-- =====================================================================
-- SCHEMA DE BANCO DE DADOS - SISTEMA ONLINE DE RESERVAS (SUPABASE)
-- =====================================================================
-- Este script cria a tabela de reservas e políticas RLS correspondentes.
-- =====================================================================

-- 1. Criar tabela de reservas
CREATE TABLE IF NOT EXISTS public.reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.acervo(id) ON DELETE CASCADE,
    data_solicitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'finalizada')),
    data_retirada_limite TIMESTAMP WITH TIME ZONE,
    justificativa TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
CREATE POLICY "Leitores podem visualizar suas próprias reservas"
ON public.reservas FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id OR public.is_admin());

CREATE POLICY "Leitores podem solicitar suas próprias reservas"
ON public.reservas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id AND status = 'pendente');

CREATE POLICY "Gestores possuem controle total sobre as reservas"
ON public.reservas FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
