-- =====================================================================
-- EXECUTAR NO SQL EDITOR DO SUPABASE DASHBOARD
-- =====================================================================
-- Criação da tabela de configurações do sistema para persistência de regras
-- =====================================================================

-- 1. Criar a tabela public.configuracoes
CREATE TABLE IF NOT EXISTS public.configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas RLS
DROP POLICY IF EXISTS "Qualquer usuario autenticado pode ver configuracoes" ON public.configuracoes;
CREATE POLICY "Qualquer usuario autenticado pode ver configuracoes"
ON public.configuracoes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Gestores possuem controle total sobre configuracoes" ON public.configuracoes;
CREATE POLICY "Gestores possuem controle total sobre configuracoes"
ON public.configuracoes FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Inserir valores padrão iniciais de regras
INSERT INTO public.configuracoes (chave, valor)
VALUES 
  ('rule_stud_books', '3'),
  ('rule_stud_days', '14'),
  ('rule_doc_books', '5'),
  ('rule_doc_days', '21'),
  ('rule_fine_per_day', '2.00')
ON CONFLICT (chave) DO NOTHING;
