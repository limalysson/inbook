import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { 
  BookOpen, 
  Calendar, 
  Lightbulb, 
  ArrowRight, 
  Mail, 
  CheckCircle,
  Plus,
  History
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import EventsCard from '@/components/EventsCard';
import DashboardStats from '@/components/DashboardStats';

/**
 * Página do Dashboard Administrativo.
 * Roda no lado do servidor (Server Component).
 * Busca estatísticas reais do Supabase em tempo real para os cards Bento.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Busca estatísticas reais do banco de dados
  const { count: totalTitulos } = await supabase
    .from('acervo')
    .select('*', { count: 'exact', head: true });

  const { count: totalAtivos } = await supabase
    .from('circulacao')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ativo');

  const { count: totalAtrasados } = await supabase
    .from('circulacao')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'atrasado');

  // 2. Busca lista de empréstimos mais recentes realizados (limita a 3) com Joins
  const { data: ultimosEmprestimos } = await supabase
    .from('circulacao')
    .select(`
      id,
      data_emprestimo,
      data_devolucao_prevista,
      status,
      usuario_id,
      material_id,
      usuarios (nome_completo, email),
      acervo (titulo, autor, capa_url)
    `)
    .order('data_emprestimo', { ascending: false })
    .limit(3);

  // 3. Busca livros recentes do acervo para destaques
  const { data: livrosRecentes } = await supabase
    .from('acervo')
    .select('id, titulo, autor, categoria, capa_url')
    .order('created_at', { ascending: false })
    .limit(4);

  // 4. Busca eventos agendados reais da tabela public.eventos
  const { data: eventos } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento')
    .gte('data_evento', new Date().toISOString())
    .order('data_evento', { ascending: true });


  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Cabeçalho de Boas-vindas */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-sans">
            Painel Administrativo Geral — {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}
          </p>
          <h2 className="font-serif text-3xl font-bold text-primary mt-1">
            Visão Geral do Acervo
          </h2>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/acervo?add=true"
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Aquisição</span>
          </Link>
          <Link
            href="/admin/usuarios?add=true"
            className="flex items-center gap-2 border border-primary text-primary px-5 py-2.5 rounded text-sm font-semibold hover:bg-surface-container active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Leitor</span>
          </Link>
        </div>
      </header>

      {/* Grid de Estatísticas Bento Animados */}
      <DashboardStats 
        totalTitulos={totalTitulos || 0} 
        totalAtivos={totalAtivos || 0} 
        totalAtrasados={totalAtrasados || 0} 
      />

      {/* Conteúdo Secundário Dividido */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel Esquerdo: Lista de Últimos Empréstimos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl font-bold text-primary flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <span>Últimos Empréstimos Realizados</span>
            </h3>
            <Link
              href="/admin/circulacao"
              className="text-xs font-bold text-on-surface-variant hover:text-primary underline uppercase tracking-wider"
            >
              Ver Todos
            </Link>
          </div>

          <div className="space-y-3 bg-surface-container-low p-3 border border-outline-variant/30 rounded-lg">
            {ultimosEmprestimos && ultimosEmprestimos.length > 0 ? (
              ultimosEmprestimos.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-outline-variant/20 rounded hover:border-outline transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-14 bg-surface-container flex items-center justify-center rounded-sm font-bold text-primary border border-outline-variant/30 overflow-hidden">
                      {item.acervo.capa_url ? (
                        <img src={item.acervo.capa_url} alt="Capa" className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-5 h-5 opacity-40" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary">{item.acervo.titulo}</h4>
                      <p className="text-[11px] text-on-surface-variant leading-none mt-1">{item.acervo.autor}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold mt-2">Leitor: {item.usuarios?.nome_completo || 'Institucional'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        item.status === 'devolvido'
                          ? 'bg-surface-container border border-outline-variant/30 text-on-surface-variant'
                          : item.status === 'atrasado'
                          ? 'bg-error-container border border-error/20 text-on-error-container'
                          : 'bg-primary-container border border-primary/20 text-on-primary-container'
                      }`}>
                        {item.status === 'devolvido' ? 'Devolvido' : item.status === 'atrasado' ? 'Atrasado' : 'Em Andamento'}
                      </span>
                      <p className="text-[10px] text-on-surface-variant font-medium">Empréstimo: {formatDate(item.data_emprestimo)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white border border-outline-variant/20 rounded-md shadow-sm">
                <History className="w-10 h-10 mx-auto text-primary/40 mb-3 animate-pulse" />
                <h4 className="text-sm font-bold text-primary">Nenhum empréstimo registrado</h4>
                <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm mx-auto font-normal leading-normal">
                  As transações de empréstimo e devolução concluídas serão exibidas em tempo real nesta seção.
                </p>
              </div>
            )}
          </div>

          {/* Indicações Reativas (Dinâmicas / Lançamentos) */}
          <div className="pt-4 space-y-4">
            <h3 className="font-serif text-xl font-bold text-primary">Destaques e Adições Recentes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {livrosRecentes && livrosRecentes.length > 0 ? (
                livrosRecentes.map((book: any) => (
                  <div key={book.id} className="bg-surface border border-outline-variant/40 p-4 rounded-lg flex flex-col justify-between gap-3 hover:shadow-sm transition-all">
                    <div className="w-full aspect-[3/4] bg-surface-container flex items-center justify-center rounded border border-outline-variant/20 mb-2 overflow-hidden">
                      {book.capa_url ? (
                        <img src={book.capa_url} alt="Capa" className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-8 h-8 opacity-25 text-primary" />
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-primary line-clamp-1 leading-tight">{book.titulo}</h5>
                      <p className="text-[10px] text-on-surface-variant leading-none mt-1">{book.autor}</p>
                    </div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant/80 bg-surface-container px-2 py-0.5 rounded w-max mt-1">
                      {book.categoria}
                    </span>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-10 text-center bg-white border border-outline-variant/20 rounded-lg shadow-sm">
                  <BookOpen className="w-10 h-10 mx-auto text-primary/40 mb-3 animate-pulse" />
                  <h4 className="text-sm font-bold text-primary">Nenhum livro cadastrado</h4>
                  <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm mx-auto font-normal leading-normal">
                    Os últimos materiais adicionados ao acervo aparecerão em destaque aqui.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Painel Direito: Utilitários Laterais */}
        <div className="space-y-6">
          <EventsCard initialEvents={eventos || []} />
        </div>

      </div>

    </div>
  );
}
