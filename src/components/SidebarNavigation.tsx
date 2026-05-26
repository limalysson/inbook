'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Library, 
  Users, 
  ArrowLeftRight,
  BarChart3
} from 'lucide-react';

interface SidebarNavigationProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Componente de Navegação Lateral (SidebarNavigation).
 * Apresenta o menu de gerenciamento da biblioteca para resoluções Desktop.
 * Utiliza o usePathname para aplicar estilos dinâmicos de rota ativa.
 */
export default function SidebarNavigation({ isOpen = false, onClose }: SidebarNavigationProps) {
  const pathname = usePathname();

  const menuItems = [
    {
      label: 'Início',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Acervo',
      href: '/admin/acervo',
      icon: Library,
    },
    {
      label: 'Usuários',
      href: '/admin/usuarios',
      icon: Users,
    },
    {
      label: 'Circulação',
      href: '/admin/circulacao',
      icon: ArrowLeftRight,
    },
    {
      label: 'Relatórios',
      href: '/admin/relatorios',
      icon: BarChart3,
    },
  ];

  return (
    <>
      {/* Overlay escuro para resoluções mobile quando o menu está aberto */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-30 bg-primary/20 backdrop-blur-sm md:hidden transition-opacity print:hidden"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 bg-surface-container-low border-r border-outline-variant/40 flex flex-col p-4 gap-2 transition-transform duration-300 md:translate-x-0 print:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex flex-col gap-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Informações Institucionais do Rodapé */}
        <div className="mt-auto p-4 border-t border-outline-variant/30 text-center select-none opacity-50">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Inbec Library System
          </p>
          <p className="text-[9px] text-on-surface-variant mt-0.5">
            Versão 1.0.0
          </p>
        </div>

      </aside>
    </>
  );
}
