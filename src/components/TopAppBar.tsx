'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Bell, LogOut, Menu, X } from 'lucide-react';

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

  const [reservas, setReservas] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Busca solicitações de reservas pendentes
  useEffect(() => {
    const fetchReservas = async () => {
      try {
        const { data, error } = await supabase
          .from('reservas')
          .select(`
            id,
            data_solicitacao,
            status,
            usuarios (nome_completo, email),
            acervo (titulo)
          `)
          .eq('status', 'pendente')
          .order('data_solicitacao', { ascending: false });

        if (error) throw error;
        setReservas(data || []);
      } catch (err) {
        console.error('Erro ao buscar reservas pendentes no cabeçalho:', err);
      }
    };

    fetchReservas();

    // Consulta periódica a cada 15 segundos para atualizar notificações em tempo real
    const interval = setInterval(fetchReservas, 15000);
    return () => clearInterval(interval);
  }, []);

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
        
        {/* Sino de Notificações - Solicitações de Reserva */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary px-3 py-1.5 hover:bg-surface-container-high transition-all rounded-full relative active:scale-95 duration-100 cursor-pointer font-sans text-xs font-bold"
            aria-label="Ver solicitações de reserva"
          >
            <Bell className="w-4 h-4" />
            <span className="hidden md:inline">Reservas Pendentes</span>
            {reservas.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-on-secondary animate-pulse shrink-0">
                {reservas.length}
              </span>
            )}
          </button>
          
          {/* Dropdown Popover */}
          {isOpen && (
            <div className="absolute right-0 top-12 w-80 bg-surface/90 backdrop-blur-md border border-outline-variant/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
              <header className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/30 flex justify-between items-center">
                <h5 className="text-xs font-bold uppercase tracking-wider text-primary">Solicitações de Reserva</h5>
                <span className="bg-secondary text-on-secondary text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  {reservas.length} pendentes
                </span>
              </header>
              <div className="max-h-64 overflow-y-auto divide-y divide-outline-variant/20 pr-1 hide-scrollbar">
                {reservas.length > 0 ? (
                  reservas.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setIsOpen(false);
                        router.push('/admin/circulacao?tab=reservas');
                        router.refresh();
                      }}
                      className="p-3 hover:bg-surface-container/60 transition-colors cursor-pointer text-left space-y-1 block"
                    >
                      <p className="text-xs font-bold text-primary line-clamp-1">
                        {res.usuarios?.nome_completo || 'Leitor'}
                      </p>
                      <p className="text-[11px] text-on-surface-variant line-clamp-1 italic">
                        {res.acervo?.titulo || 'Livro'}
                      </p>
                      <p className="text-[9px] text-on-surface-variant/70 font-semibold text-right">
                        {new Date(res.data_solicitacao).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-on-surface-variant/60 space-y-2">
                    <Bell className="w-8 h-8 mx-auto opacity-20 text-primary" />
                    <p className="text-xs font-medium">Nenhuma solicitação pendente</p>
                  </div>
                )}
              </div>
              <footer className="p-2 border-t border-outline-variant/30 bg-surface-container-low text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/admin/circulacao?tab=reservas');
                    router.refresh();
                  }}
                  className="text-[10px] uppercase font-bold tracking-wider text-primary hover:underline w-full py-1.5 cursor-pointer bg-transparent border-0"
                >
                  Ver Todas as Reservas
                </button>
              </footer>
            </div>
          )}
        </div>

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
