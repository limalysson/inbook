import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { 
  BookOpen, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  Lightbulb, 
  ArrowRight, 
  Mail, 
  CheckCircle,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

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

  // 2. Busca lista de empréstimos atrasados reais (limita a 3) com Joins
  const { data: atrasados } = await supabase
    .from('circulacao')
    .select(`
      id,
      data_devolucao_prevista,
      usuario_id,
      material_id,
      usuarios (nome_completo, email),
      acervo (titulo, autor, capa_url)
    `)
    .eq('status', 'atrasado')
    .limit(3);

  // 3. Busca livros recentes do acervo para destaques
  const { data: livrosRecentes } = await supabase
    .from('acervo')
    .select('id, titulo, autor, categoria, capa_url')
    .order('created_at', { ascending: false })
    .limit(4);

  // Fallbacks ilustrativos caso o banco esteja vazio no primeiro acesso
  const ilustrativosAtrasados = [
    {
      id: '1',
      acervo: { titulo: 'O Leviatã e a Bomba de Ar', autor: 'Steven Shapin', capa_url: null },
      usuarios: { nome_completo: 'Marcos Hanson', email: 'm_hanson@inbec.edu.br' },
      dias: 5
    },
    {
      id: '2',
      acervo: { titulo: 'Crítica da Razão Pura', autor: 'Immanuel Kant', capa_url: null },
      usuarios: { nome_completo: 'Lucas Vaughn', email: 'l_vaughn@inbec.edu.br' },
      dias: 12
    }
  ];

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
            href="/admin/acervo"
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Aquisição</span>
          </Link>
        </div>
      </header>

      {/* Grid de Estatísticas (Bento Style) */}
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
              {(totalTitulos || 0).toLocaleString('pt-BR')}
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
              {totalAtivos || 0}
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
              {totalAtrasados || 0}
            </p>
          </div>
          <div className="flex items-center gap-2 text-on-error-container mt-4">
            <AlertTriangle className="w-4 h-4 text-on-error-container" />
            <span className="text-xs font-semibold">Exige cobrança ativa</span>
          </div>
        </Link>

      </section>

      {/* Conteúdo Secundário Dividido */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel Esquerdo: Lista de Livros Atrasados */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl font-bold text-primary flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-secondary" />
              <span>Atenção: Atrasos Pendentes</span>
            </h3>
            <Link
              href="/admin/circulacao"
              className="text-xs font-bold text-on-surface-variant hover:text-primary underline uppercase tracking-wider"
            >
              Ver Todos
            </Link>
          </div>

          <div className="space-y-3 bg-surface-container-low p-3 border border-outline-variant/30 rounded-lg">
            {atrasados && atrasados.length > 0 ? (
              atrasados.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-outline-variant/20 rounded hover:border-outline transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-14 bg-surface-container flex items-center justify-center rounded-sm font-bold text-primary border border-outline-variant/30">
                      {item.acervo.capa_url ? (
                        <img src={item.acervo.capa_url} alt="Capa" className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-5 h-5 opacity-40" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary">{item.acervo.titulo}</h4>
                      <p className="text-[11px] text-on-surface-variant">{item.acervo.autor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-secondary font-bold">Previsto: {formatDate(item.data_devolucao_prevista)}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold">Leitor: {item.usuarios?.nome_completo || 'Institucional'}</p>
                    </div>
                    <button className="p-2 hover:bg-error-container/20 rounded-full text-secondary transition-colors cursor-pointer">
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              // Exibição demonstrativa ilustrativa se não houver dados no banco ainda
              ilustrativosAtrasados.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-outline-variant/20 rounded hover:border-outline transition-all select-none">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-14 bg-surface-container flex items-center justify-center rounded-sm font-bold text-primary border border-outline-variant/30">
                      <BookOpen className="w-5 h-5 opacity-40" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary">{item.acervo.titulo}</h4>
                      <p className="text-[11px] text-on-surface-variant">{item.acervo.autor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-secondary font-bold">{item.dias} Dias de Atraso</p>
                      <p className="text-[10px] text-on-surface-variant font-bold">Leitor: {item.usuarios.nome_completo}</p>
                    </div>
                    <button className="p-2 hover:bg-error-container/20 rounded-full text-secondary transition-colors cursor-pointer">
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
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
                // Fallback ilustrativo caso a base esteja vazia
                [
                  { titulo: 'A Arqueologia do Saber', autor: 'Michel Foucault', categoria: 'Filosofia' },
                  { titulo: 'A Estrutura das Revoluções', autor: 'Thomas Kuhn', categoria: 'Ciência' },
                  { titulo: 'Dom Quixote de la Mancha', autor: 'Miguel de Cervantes', categoria: 'Literatura' },
                  { titulo: 'The Archetype of Wisdom', autor: 'Elena Rostova', categoria: 'História' },
                ].map((book, idx) => (
                  <div key={idx} className="bg-surface border border-outline-variant/40 p-4 rounded-lg flex flex-col justify-between gap-3 hover:shadow-sm transition-all">
                    <div className="w-full aspect-[3/4] bg-surface-container flex items-center justify-center rounded border border-outline-variant/20 mb-2">
                      <BookOpen className="w-8 h-8 opacity-25 text-primary" />
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
              )}
            </div>
          </div>

        </div>

        {/* Painel Direito: Utilitários Laterais */}
        <div className="space-y-6">
          
          {/* Card Literário Curiosidade */}
          <div className="bg-primary text-on-primary p-6 rounded-xl relative overflow-hidden shadow-sm select-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-10 -mt-10 rounded-full"></div>
            <Lightbulb className="w-8 h-8 mb-4 text-on-primary/95" />
            <h4 className="font-serif text-lg font-bold italic mb-3">Curiosidade do Dia</h4>
            <p className="text-xs leading-relaxed text-on-primary/90">
              A maior biblioteca física do mundo hoje é a Biblioteca do Congresso dos Estados Unidos, em Washington, com mais de 170 milhões de itens catalogados, incluindo mais de 39 milhões de livros.
            </p>
            <div className="mt-6 pt-4 border-t border-white/10 text-[10px] uppercase tracking-wider font-bold opacity-60">
              Fato Literário do Dia
            </div>
          </div>

          {/* Card Próximos Eventos */}
          <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Próximos Eventos</h4>
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-white border border-outline-variant/20 rounded border-l-4 border-l-primary">
                <p className="text-[10px] font-bold text-on-surface-variant">26 de Out, 14:00</p>
                <p className="text-xs font-bold text-primary mt-1">Tour de Manuscritos Raros</p>
              </div>
              <div className="p-3 bg-white border border-outline-variant/20 rounded border-l-4 border-l-outline">
                <p className="text-[10px] font-bold text-on-surface-variant">29 de Out, 09:00</p>
                <p className="text-xs font-bold text-primary mt-1">Reunião Mensal de Aquisições</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
