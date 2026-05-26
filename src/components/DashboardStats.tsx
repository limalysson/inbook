'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, TrendingUp, AlertTriangle } from 'lucide-react';
import AnimatedCounter from '@/components/AnimatedCounter';

interface DashboardStatsProps {
  totalTitulos: number;
  totalAtivos: number;
  totalAtrasados: number;
}

export default function DashboardStats({
  totalTitulos,
  totalAtivos,
  totalAtrasados,
}: DashboardStatsProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
      
      {/* Total de Títulos */}
      <Link
        href="/admin/acervo"
        className="md:col-span-2 bg-primary-container text-on-primary-container p-6 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:opacity-95 transition-all cursor-pointer"
      >
        <div className="relative z-10 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-primary-container/85">
            Total de Títulos Cadastrados
          </h3>
          <p className="font-serif text-5xl font-bold tracking-tight text-white leading-none">
            <AnimatedCounter value={totalTitulos} />
          </p>
          <p className="text-xs text-on-primary-container/70 font-sans">
            +12 novos adicionados este mês no acervo
          </p>
        </div>
        <BookOpen className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 group-hover:scale-105 transition-transform duration-500 text-white" />
      </Link>

      {/* Empréstimos Ativos */}
      <Link
        href="/admin/circulacao?status=ativo"
        className="bg-surface-container border border-outline-variant/20 p-6 rounded-xl flex flex-col justify-between hover:bg-surface-container-high hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Empréstimos Ativos
          </h3>
          <p className="font-serif text-4xl font-bold text-primary leading-none">
            <AnimatedCounter value={totalAtivos} />
          </p>
        </div>
        <div className="flex items-center gap-2 text-primary mt-4">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-semibold">Uso frequente do acervo</span>
        </div>
      </Link>

      {/* Livros Atrasados */}
      <Link
        href="/admin/circulacao?status=atrasado"
        className="bg-error-container border border-error/20 p-6 rounded-xl flex flex-col justify-between hover:opacity-95 hover:shadow-md hover:border-error/40 transition-all cursor-pointer group"
      >
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-error-container">
            Livros Atrasados
          </h3>
          <p className="font-serif text-4xl font-bold text-on-error-container leading-none">
            <AnimatedCounter value={totalAtrasados} />
          </p>
        </div>
        <div className="flex items-center gap-2 text-on-error-container mt-4">
          <AlertTriangle className="w-4 h-4 text-on-error-container" />
          <span className="text-xs font-semibold">Exige cobrança ativa</span>
        </div>
      </Link>

    </section>
  );
}
