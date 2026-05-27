'use client';

import React, { useState } from 'react';
import TopAppBar from './TopAppBar';
import SidebarNavigation from './SidebarNavigation';
import BottomNavBar from './BottomNavBar';

interface AdminShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
}

/**
 * Shell Interativo Administrativo (AdminShell).
 * Componente do lado do cliente que envolve as rotas de administração,
 * mantendo o estado de abertura da navegação lateral em telas móveis e
 * estruturando as áreas de Grid do layout.
 */
export default function AdminShell({ children, userEmail, userName }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans select-none">
      
      {/* Barra de Cabeçalho Superior */}
      <TopAppBar 
        onMenuClick={() => setSidebarOpen(true)} 
        userEmail={userEmail}
        userName={userName}
      />

      <div className="flex flex-1 pt-16 pb-16 md:pb-0 min-h-screen">
        
        {/* Barra de Navegação Lateral */}
        <SidebarNavigation 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />

        {/* Contêiner Principal de Conteúdo Dinâmico */}
        <main className="flex-1 min-w-0 md:ml-64 p-6 bg-surface-container-lowest min-h-[calc(100vh-4rem)] print:ml-0 print:p-0 print:bg-white">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>

      {/* Navegação de Rodapé para Celulares */}
      <BottomNavBar />

    </div>
  );
}
