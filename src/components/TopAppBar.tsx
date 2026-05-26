'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Bell, LogOut, Menu } from 'lucide-react';

interface TopAppBarProps {
  onMenuClick?: () => void;
  userEmail?: string;
  userName?: string;
}

/**
 * Componente de Cabeçalho Global (TopAppBar).
 * Exibe a identidade do sistema, alertas de notificação, avatar do usuário e botão de logout integrado ao Supabase.
 */
export default function TopAppBar({ onMenuClick, userEmail, userName }: TopAppBarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Erro ao efetuar logout:', error);
    }
  };

  // Iniciais do nome para exibir no avatar
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : 'AD';

  return (
    <header className="fixed top-0 w-full z-40 bg-surface border-b border-outline-variant/40 flex justify-between items-center px-6 py-3 h-16 shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none print:hidden">
      
      {/* Lado Esquerdo: Marca e Menu Sanduíche para Mobile */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="md:hidden text-primary p-2 hover:bg-surface-container-high transition-colors rounded-full active:scale-95 duration-100"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center h-8">
          <img 
            src="/logoinbook.png" 
            alt="INBOOK Logo" 
            className="h-8 w-auto object-contain" 
          />
        </div>
      </div>

      {/* Lado Direito: Ações do Usuário */}
      <div className="flex items-center gap-4">
        
        {/* Sino de Notificações */}
        <button 
          className="text-on-surface-variant hover:text-primary p-2 hover:bg-surface-container-high transition-colors rounded-full relative active:scale-95 duration-100 cursor-pointer"
          aria-label="Ver notificações"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full ring-2 ring-surface"></span>
        </button>

        {/* Separador vertical */}
        <span className="h-6 w-px bg-outline-variant/60"></span>

        {/* Informações do Usuário e Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:text-right lg:block">
            <p className="text-sm font-semibold text-primary">{userName || 'Administrador'}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold opacity-75">
              {userEmail || 'gestor@inbec.edu.br'}
            </p>
          </div>
          
          {/* Avatar Circular */}
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shadow-sm border border-outline-variant/50">
            {initials}
          </div>

          {/* Botão Logout */}
          <button
            onClick={handleLogout}
            className="text-on-surface-variant hover:text-secondary p-2 hover:bg-error-container/20 transition-colors rounded-full active:scale-95 duration-100 cursor-pointer"
            title="Efetuar Logout"
            aria-label="Sair da conta"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

      </div>

    </header>
  );
}
