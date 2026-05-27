# 📖 INBOOK — Sistema de Gestão de Biblioteca e Acervo

O **INBOOK** é um sistema acadêmico moderno, premium e de alta performance projetado para controle de acervo bibliográfico, circulação de volumes (empréstimos/devoluções/renovações) e gerenciamento de leitores (estudantes e docentes). 

Desenvolvido com uma arquitetura robusta baseada em **Next.js (App Router)**, **TypeScript**, **Tailwind CSS v4** e integrado ao **Supabase (Database, Auth e Storage)** com suporte a Row Level Security (RLS) completo.

---

## 🌟 Recursos Principais

### 🔒 1. Autenticação Passwordless sem Pré-cadastro (Alunos/Docentes)
*   **Acesso Direto:** Estudantes e docentes não precisam estar previamente cadastrados por um gestor.
*   **Validação por Domínio:** Validação estrita do e-mail institucional (domínio `@inbec.edu.br`).
*   **OTP Temporário:** Geração e hashing seguro (com `bcryptjs`) de códigos de uso único de 6 dígitos em caixa alta, com expiração de 5 minutos.
*   **Autoprovisionamento JIT (Just-In-Time):** Criação silenciosa da conta do usuário no Supabase Auth e preenchimento guiado do perfil na primeira entrada (executando um `upsert` seguro de acordo com as RLS).

### 🎓 2. Portal do Leitor
*   **Painel Pessoal:** Exibição de estatísticas rápidas sobre empréstimos ativos e atrasados.
*   **Busca no Acervo:** Catálogo completo com pesquisa por título/autor/ISBN, filtros rápidos por categorias e contagem de exemplares disponíveis em tempo real.
*   **Minhas Leituras:** Acompanhamento dinâmico de empréstimos, datas de retirada, prazos previstos e visualização instantânea de multas ativas.

### 💼 3. Painel Administrativo do Gestor
*   **Dashboard Executivo:** Visão geral do acervo, leitores ativos, empréstimos no prazo e indicadores críticos de atrasos e pendências.
*   **Gestão de Acervo:** Cadastro de novos livros e inventários físicos com upload de capas e controle de prateleiras.
*   **Gestão de Usuários (Diretório):** Habilitação, desabilitação (Ativo/Inativo) reativa de leitores e configuração dinâmica de regras de negócio em tempo real.
*   **⚙️ Configurações Dinâmicas do Sistema:** Painel de engrenagem para editar os limites de livros permitidos e os prazos de devolução por vínculo (aluno vs. professor), além da taxa diária de multa.
*   **Controle de Circulação Transacional:**
    *   **Empréstimos Atômicos:** Lógica em TypeScript que insere o empréstimo e decrementa automaticamente o exemplar no estoque do acervo.
    *   **Devolução Física Dinâmica:** Registra o retorno, zera multas do card e devolve o exemplar ao estoque.
    *   **Renovação de Prazo:** Estende o prazo previsto em +7 dias (limite de até 3 renovações consecutivas).

---

## 🛠️ Tecnologias Utilizadas

*   **Frontend & Backend:** Next.js 15+ (App Router, Server e Client Components, Serverless API Routes)
*   **Linguagem:** TypeScript (Tipagem estrita para segurança de código)
*   **Design & Estilização:** Tailwind CSS v4, Lucide Icons (Design premium com harmonia de cores HSL, modo escuro implícito e responsividade total)
*   **Banco de Dados & Autenticação:** Supabase (PostgreSQL, Supabase Auth com persistência de cookies de 1 semana por middleware, Supabase Storage para capas de livros e fotos de perfil)
*   **Segurança:** Row Level Security (RLS) no banco PostgreSQL e barreira de proteção de rotas (`/admin/*`) via Next.js Middleware.

---

## 🚀 Como Iniciar Localmente

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/limalysson/inbook.git
cd inbook
npm install
```

### 2. Configurar as Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto e configure suas chaves do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=seu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_supabase_anon_key
JWT_SECRET=sua_frase_secreta_para_derivacao_de_senhas
```

### 3. Rodar as Migrações do Banco de Dados
Acesse o **SQL Editor** do seu Dashboard do Supabase e execute os scripts de migração localizados na pasta `supabase/migrations/`:
1.  **`schema.sql`:** Criação das tabelas centrais (`usuarios`, `acervo`, `circulacao`), políticas de RLS e funções auxiliares.
2.  **`autoprovision.sql`:** Configuração da tabela de OTPs (`public.otps`) e liberação de políticas de inserção e atualização JIT para os alunos.
3.  **`seed_admin.sql`:** Cadastra a conta administrativa genérica de testes.
4.  **`seed_data.sql`:** Popula o acervo, usuários institucionais e empréstimos realistas para testes.

### 4. Executar o Servidor de Desenvolvimento
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o sistema rodando.

---

## 🔑 Contas de Teste Recomendadas

### A. Conta Administrativa (Gestor)
*   **Acesso:** Aba **"Sou Gestor"** na tela de login.
*   **E-mail:** `admin@inbec.edu.br`
*   **Senha:** `admin123`

### B. Conta Estudantil / Docente (Passwordless)
*   **Acesso:** Aba **"Sou Aluno/Docente"** na tela de login.
*   **E-mail:** `joao.silva@inbec.edu.br` ou `maria.santos@inbec.edu.br`
*   **Código OTP:** Insira o e-mail, clique em receber código e **consulte o console/terminal onde o Next.js está rodando** para visualizar o OTP de testes gerado no log (Ex: `[OTP] Código gerado para joao.silva@inbec.edu.br: ABC123`).
