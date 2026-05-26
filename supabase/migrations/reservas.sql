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
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'espera', 'aprovada', 'rejeitada', 'finalizada')),
    data_retirada_limite TIMESTAMP WITH TIME ZONE,
    justificativa TEXT,
    renovacoes_contagem INTEGER NOT NULL DEFAULT 0,
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
WITH CHECK (auth.uid() = usuario_id AND status IN ('pendente', 'espera'));

CREATE POLICY "Gestores possuem controle total sobre as reservas"
ON public.reservas FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================================
-- PATCH PARA BANCO DE DADOS EM PRODUÇÃO JÁ ATIVO:
-- =====================================================================
-- Se você já executou a versão anterior da tabela, por favor, execute as
-- seguintes instruções no seu Editor SQL do Supabase para atualizar a tabela:
--
-- ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_status_check;
-- ALTER TABLE public.reservas ADD CONSTRAINT reservas_status_check CHECK (status IN ('pendente', 'espera', 'aprovada', 'rejeitada', 'finalizada'));
-- ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS renovacoes_contagem INTEGER NOT NULL DEFAULT 0;
--
-- -- Atualizar a política de RLS para inserções de fila de espera:
-- DROP POLICY IF EXISTS "Leitores podem solicitar suas próprias reservas" ON public.reservas;
-- CREATE POLICY "Leitores podem solicitar suas próprias reservas" ON public.reservas FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id AND status IN ('pendente', 'espera'));
-- =====================================================================
