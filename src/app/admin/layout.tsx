import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminShell from '@/components/AdminShell';

/**
 * Layout Principal do Painel Administrativo.
 * Roda no lado do servidor. Executa autenticação e verificação de perfil
 * administrativa robusta diretamente no Supabase antes de carregar qualquer página.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // 1. Recupera o usuário logado de forma segura do Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Busca dados adicionais do perfil na tabela pública
  const { data: profile } = await supabase
    .from('usuarios')
    .select('nome_completo, tipo')
    .eq('id', user.id)
    .single();

  // 3. Segurança estrita: Redireciona leitores comuns de volta se tentarem acessar caminhos /admin
  if (profile?.tipo !== 'administrador') {
    redirect('/login?error=Acesso exclusivo para administradores.');
  }

  return (
    <AdminShell 
      userEmail={user.email} 
      userName={profile?.nome_completo}
    >
      {children}
    </AdminShell>
  );
}
