'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Library, 
  Users, 
  ArrowLeftRight 
} from 'lucide-react';

/**
 * Componente de Barra de Navegação Inferior (BottomNavBar).
 * Fornece navegação móvel de alta usabilidade, oculta em resoluções desktop.
 * Utiliza o usePathname para iluminar o item ativo com a cor de destaque institucional.
 */
export default function BottomNavBar() {
  const pathname = usePathname();

  const navItems = [
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
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 h-16 bg-surface border-t border-outline-variant/40 md:hidden flex justify-around items-center px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.01)] select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-lg transition-all duration-150 active:scale-95 ${
              isActive
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            {/* Ícone ativo ganha destaque visual de container circular sutil se desejar */}
            <div className={`p-1.5 rounded-full transition-colors ${
              isActive ? 'bg-primary/5 text-primary' : 'bg-transparent'
            }`}>
              <Icon className="w-5 h-5 shrink-0" />
            </div>
            <span className="text-[9px] font-sans tracking-wide mt-0.5 uppercase leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
