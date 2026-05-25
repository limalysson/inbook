-- =====================================================================
-- SEED DE DADOS COMPLETO - INBOOK LIBRARY SYSTEM
-- =====================================================================
-- Este script popula o banco de dados com 10 usuários reais (alunos/docentes)
-- com suas respectivas senhas estáveis derivadas já encriptadas com blowfish,
-- 7 livros no acervo, e 9 empréstimos históricos/ativos/atrasados,
-- deixando a aluna Ana Souza (u4) totalmente sem empréstimos.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  -- UUIDs dos Usuários
  u1_id UUID := gen_random_uuid();
  u2_id UUID := gen_random_uuid();
  u3_id UUID := gen_random_uuid();
  u4_id UUID := gen_random_uuid(); -- Sem empréstimo (Ana Souza)
  u5_id UUID := gen_random_uuid();
  u6_id UUID := gen_random_uuid();
  u7_id UUID := gen_random_uuid();
  u8_id UUID := gen_random_uuid();
  u9_id UUID := gen_random_uuid();
  u10_id UUID := gen_random_uuid();

  -- UUIDs dos Livros
  b1_id UUID := gen_random_uuid();
  b2_id UUID := gen_random_uuid();
  b3_id UUID := gen_random_uuid();
  b4_id UUID := gen_random_uuid();
  b5_id UUID := gen_random_uuid();
  b6_id UUID := gen_random_uuid();
  b7_id UUID := gen_random_uuid();
  b8_id UUID := gen_random_uuid();
  b9_id UUID := gen_random_uuid();
  b10_id UUID := gen_random_uuid();
BEGIN

  -- ==========================================
  -- 1. POPULANDO USUÁRIOS EM auth.users (Supabase)
  -- ==========================================

  -- Usuário 1: João Silva (Estudante) - Empréstimo Ativo
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joao.silva@inbec.edu.br', crypt('9c930a1ed8046a3a662835ec1e5af687cad922972fab208b886eba3d7e1b529f', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"João Silva","matricula":"MAT-202601"}', now(), now());

  -- Usuário 2: Maria Santos (Estudante) - Empréstimo Atrasado
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maria.santos@inbec.edu.br', crypt('f430b766a58dbe6f70ea11e32d0f67578217b81c77606b932e6454c50f908a0b', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Maria Santos","matricula":"MAT-202602"}', now(), now());

  -- Usuário 3: Carlos Oliveira (Docente) - Empréstimo Devolvido
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u3_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos.oliveira@inbec.edu.br', crypt('850e50b2710076fc9b535180d50646386a0ad2049f4f92bde84427c929ae5fe3', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Carlos Oliveira","matricula":"DOC-202603"}', now(), now());

  -- Usuário 4: Ana Souza (Estudante) - COMPLETAMENTE SEM EMPRÉSTIMOS (Teste de borda)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u4_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.souza@inbec.edu.br', crypt('eda5eabef1c7cd0d1342b00f739c3a33ec308cb64edc1f0b9bdd615469c92946', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Ana Souza","matricula":"MAT-202604"}', now(), now());

  -- Usuário 5: Pedro Lima (Estudante) - Empréstimo Ativo
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u5_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pedro.lima@inbec.edu.br', crypt('18a12c86591816fc583864bb68635f0445701d084a8676f586a1ed8154178e32', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Pedro Lima","matricula":"MAT-202605"}', now(), now());

  -- Usuário 6: Juliana Costa (Estudante) - Empréstimo Devolvido
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u6_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juliana.costa@inbec.edu.br', crypt('aaeb622f25f851a110912f654d0ad3618ad8669322ee297f79d913e4b6eec637', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Juliana Costa","matricula":"MAT-202606"}', now(), now());

  -- Usuário 7: Roberto Almeida (Docente) - Empréstimo Ativo
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u7_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roberto.almeida@inbec.edu.br', crypt('e361dcd8a4117da476861794afd98efac0ef9ec47cc4b5d68659589b1bfb02fa', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Roberto Almeida","matricula":"DOC-202607"}', now(), now());

  -- Usuário 8: Fernanda Pereira (Estudante) - Empréstimo Atrasado
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u8_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fernanda.pereira@inbec.edu.br', crypt('b96cd33f578400f471a3febca1e27cc4a1886e4035de7342fa9e36f7b8e63875', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Fernanda Pereira","matricula":"MAT-202608"}', now(), now());

  -- Usuário 9: Lucas Rodrigues (Estudante) - Empréstimo Devolvido
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u9_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucas.rodrigues@inbec.edu.br', crypt('f17bea4beca53da6cf7088548664b61563342f3bbfa4f789a12019022d46e5c9', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Lucas Rodrigues","matricula":"MAT-202609"}', now(), now());

  -- Usuário 10: Patrícia Gomes (Estudante) - Empréstimo Devolvido
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u10_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patricia.gomes@inbec.edu.br', crypt('eb4dc3e60768cff9f82cfc4ea9213aac55810de9c39502888c44f4e10855bb50', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nome_completo":"Patrícia Gomes","matricula":"MAT-202610"}', now(), now());


  -- ==========================================
  -- 2. POPULANDO TABELA public.usuarios
  -- ==========================================

  INSERT INTO public.usuarios (id, nome_completo, matricula, tipo, curso_departamento, email, telefone, status)
  VALUES 
    (u1_id, 'João Silva', 'MAT-202601', 'estudante', 'Análise e Des. de Sistemas', 'joao.silva@inbec.edu.br', '(85) 99111-2222', TRUE),
    (u2_id, 'Maria Santos', 'MAT-202602', 'estudante', 'Engenharia de Software', 'maria.santos@inbec.edu.br', '(85) 99222-3333', TRUE),
    (u3_id, 'Carlos Oliveira', 'DOC-202603', 'docente', 'Departamento de TI', 'carlos.oliveira@inbec.edu.br', '(85) 99333-4444', TRUE),
    (u4_id, 'Ana Souza', 'MAT-202604', 'estudante', 'Ciência da Computação', 'ana.souza@inbec.edu.br', '(85) 99444-5555', TRUE),
    (u5_id, 'Pedro Lima', 'MAT-202605', 'estudante', 'Sistemas de Informação', 'pedro.lima@inbec.edu.br', '(85) 99555-6666', TRUE),
    (u6_id, 'Juliana Costa', 'MAT-202606', 'estudante', 'Análise e Des. de Sistemas', 'juliana.costa@inbec.edu.br', '(85) 99666-7777', TRUE),
    (u7_id, 'Roberto Almeida', 'DOC-202607', 'docente', 'Departamento de Engenharia', 'roberto.almeida@inbec.edu.br', '(85) 99777-8888', TRUE),
    (u8_id, 'Fernanda Pereira', 'MAT-202608', 'estudante', 'Redes de Computadores', 'fernanda.pereira@inbec.edu.br', '(85) 99888-9999', TRUE),
    (u9_id, 'Lucas Rodrigues', 'MAT-202609', 'estudante', 'Ciência da Computação', 'lucas.rodrigues@inbec.edu.br', '(85) 99999-0000', TRUE),
    (u10_id, 'Patrícia Gomes', 'MAT-202610', 'estudante', 'Engenharia de Software', 'patricia.gomes@inbec.edu.br', '(85) 99000-1111', TRUE);


  -- ==========================================
  -- 3. POPULANDO TABELA public.acervo (Livros)
  -- ==========================================

  INSERT INTO public.acervo (id, titulo, autor, isbn, categoria, ano, exemplares_total, exemplares_disponiveis, prateleira)
  VALUES
    (b1_id, 'Código Limpo (Clean Code)', 'Robert C. Martin', '978-8576082675', 'Programação', 2009, 5, 2, 'A-01'),
    (b2_id, 'O Programador Pragmático', 'Andrew Hunt', '978-8573076103', 'Programação', 1999, 3, 2, 'A-02'),
    (b3_id, 'Padrões de Projetos (Design Patterns)', 'Erich Gamma', '978-8573076104', 'Programação', 1994, 2, 2, 'A-03'),
    (b4_id, 'Arquitetura Limpa', 'Robert C. Martin', '978-8550804606', 'Programação', 2017, 4, 3, 'B-01'),
    (b5_id, 'Introdução aos Algoritmos', 'Thomas H. Cormen', '978-8521617006', 'Banco de Dados', 2012, 2, 0, 'B-02'),
    (b6_id, 'SQL Prático', 'Anthony DeBarros', '978-8575227367', 'Banco de Dados', 2018, 4, 3, 'C-01'),
    (b7_id, 'Microsserviços Prontos para a Produção', 'Susan J. Fowler', '978-8575225882', 'Infraestrutura', 2016, 3, 3, 'D-01'),
    (b8_id, 'The Archetype of Wisdom', 'Dr. Elena Rostova', '978-3-16-148410-0', 'Filosofia', 2020, 1, 1, 'A-102'),
    (b9_id, 'Quantum Linguistics', 'Marcus Thorne', '978-0-262-13451-4', 'Ciência', 2018, 2, 0, 'C-404'),
    (b10_id, 'Medieval Cartography', 'Prof. Julian Sorel', '978-1-59420-229-2', 'História', 2015, 5, 5, 'R-002');


  -- ==========================================
  -- 4. POPULANDO TABELA public.circulacao (Empréstimos)
  -- ==========================================

  -- Empréstimo 1: João Silva (u1) pegou b1 (Código Limpo) -> Em andamento (Ativo), sem atraso
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u1_id, b1_id, now() - INTERVAL '3 days', now() + INTERVAL '11 days', 'ativo', 0);

  -- Empréstimo 2: Maria Santos (u2) pegou b5 (Algoritmos) -> ATRASADO
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, status, renovacoes_contagem, multa_acumulada)
  VALUES (gen_random_uuid(), u2_id, b5_id, now() - INTERVAL '20 days', now() - INTERVAL '6 days', 'atrasado', 1, 12.00);

  -- Empréstimo 3: Carlos Oliveira (u3) pegou b2 (Programador Pragmático) -> DEVOLVIDO
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, data_devolucao_real, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u3_id, b2_id, now() - INTERVAL '15 days', now() - INTERVAL '1 day', now() - INTERVAL '2 days', 'devolvido', 0);

  -- Empréstimo 4: Pedro Lima (u5) pegou b1 (Código Limpo) -> Em andamento (Ativo)
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u5_id, b1_id, now() - INTERVAL '5 days', now() + INTERVAL '9 days', 'ativo', 1);

  -- Empréstimo 5: Juliana Costa (u6) pegou b6 (SQL Prático) -> DEVOLVIDO
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, data_devolucao_real, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u6_id, b6_id, now() - INTERVAL '10 days', now() + INTERVAL '4 days', now() - INTERVAL '3 days', 'devolvido', 0);

  -- Empréstimo 6: Roberto Almeida (u7) pegou b4 (Arquitetura Limpa) -> Em andamento (Ativo)
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u7_id, b4_id, now() - INTERVAL '2 days', now() + INTERVAL '12 days', 'ativo', 0);

  -- Empréstimo 7: Fernanda Pereira (u8) pegou b5 (Algoritmos) -> ATRASADO
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, status, renovacoes_contagem, multa_acumulada)
  VALUES (gen_random_uuid(), u8_id, b5_id, now() - INTERVAL '25 days', now() - INTERVAL '11 days', 'atrasado', 2, 22.00);

  -- Empréstimo 8: Lucas Rodrigues (u9) pegou b1 (Código Limpo) -> DEVOLVIDO
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, data_devolucao_real, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u9_id, b1_id, now() - INTERVAL '12 days', now() + INTERVAL '2 days', now() - INTERVAL '5 days', 'devolvido', 0);

  -- Empréstimo 9: Patrícia Gomes (u10) pegou b4 (Arquitetura Limpa) -> DEVOLVIDO
  INSERT INTO public.circulacao (id, usuario_id, material_id, data_emprestimo, data_devolucao_prevista, data_devolucao_real, status, renovacoes_contagem)
  VALUES (gen_random_uuid(), u10_id, b4_id, now() - INTERVAL '7 days', now() + INTERVAL '7 days', now(), 'devolvido', 0);

END $$;
