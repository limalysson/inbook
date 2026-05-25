-- =====================================================================
-- SEED DE USUÁRIO ADMINISTRADOR (GESTOR) PARA O INBOOK
-- =====================================================================
-- Execute este script no SQL Editor do seu Dashboard do Supabase.
-- Ele cria com segurança o usuário administrador padrão no painel de Auth
-- e o vincula com o perfil administrativo correspondente no banco.
-- =====================================================================

-- Extensão pgcrypto para permitir crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  admin_id UUID := gen_random_uuid();
  admin_email TEXT := 'admin@inbec.edu.br';
  -- Senha padrão: admin123
  admin_pass_hash TEXT := crypt('admin123', gen_salt('bf')); 
BEGIN
  -- 1. Insere o usuário na tabela interna auth.users se o email não estiver em uso
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      admin_pass_hash,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"nome_completo":"Administrador Inbook","matricula":"ADM-0001","tipo":"administrador"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- 2. Insere o perfil correspondente na tabela public.usuarios
    INSERT INTO public.usuarios (
      id,
      nome_completo,
      matricula,
      tipo,
      curso_departamento,
      email,
      telefone,
      status,
      created_at
    )
    VALUES (
      admin_id,
      'Administrador Inbook',
      'ADM-0001',
      'administrador',
      'Biblioteca Central',
      admin_email,
      '(85) 98888-8888',
      TRUE,
      now()
    );
    
    RAISE NOTICE 'Usuário Administrador cadastrado com sucesso: admin@inbec.edu.br';
  ELSE
    RAISE NOTICE 'O e-mail admin@inbec.edu.br já está cadastrado no sistema.';
  END IF;
END $$;
