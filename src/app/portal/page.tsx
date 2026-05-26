'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  BookOpen, 
  Search, 
  LogOut, 
  User, 
  Calendar, 
  Clock, 
  Loader2, 
  Sparkles,
  Info,
  Library,
  BookMarked,
  UserCheck,
  AlertTriangle,
  FileText,
  X,
  RefreshCw
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Usuario, Material, Circulacao } from '@/types';

/**
 * Portal do Leitor (Aluno / Docente).
 * Interface Premium com Glassmorphism, micro-animações, pesquisa instantânea de livros
 * e visualização detalhada de empréstimos e histórico.
 */
export default function PortalPage() {
  const router = useRouter();
  const supabase = createClient();

  // Estados de dados
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [emprestimos, setEmprestimos] = useState<any[]>([]);
  const [acervo, setAcervo] = useState<Material[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  
  // Estados de controle de interface
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedCourse, setSelectedCourse] = useState('Todos');
  const [selectedMaterialDetails, setSelectedMaterialDetails] = useState<Material | null>(null);
  const [activeTab, setActiveTab] = useState<'catalogo' | 'meus-livros' | 'meus-reservas'>('catalogo');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Confirmações e fila de espera
  const [materialToReserve, setMaterialToReserve] = useState<any>(null);
  const [isWaitingListMode, setIsWaitingListMode] = useState(false);
  const [submittingReserva, setSubmittingReserva] = useState(false);

  // Categorias de livros para filtro rápido
  const categories = ['Todos', 'Programação', 'Banco de Dados', 'Infraestrutura', 'Monografia', 'TCC', 'Artigo Científico', 'Outros'];

  // Carrega os dados do Portal do Leitor
  const loadPortalData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Verifica autenticação do usuário
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);

      // 2. Busca perfil na tabela public.usuarios
      const { data: userProfile, error: profileError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        // Se a sessão existe mas o perfil ainda não foi provisionado (caso raro de bypass no login)
        router.push('/login');
        return;
      }
      setProfile(userProfile);

      // Inteligência de Recomendação de Curso
      if (userProfile && userProfile.curso_departamento) {
        const dept = userProfile.curso_departamento.toLowerCase();
        if (dept.includes('análise') || dept.includes('ads') || dept.includes('desenvolvimento')) {
          setSelectedCourse('Análise e Desenvolvimento de Sistemas (ADS)');
        } else if (dept.includes('software')) {
          setSelectedCourse('Engenharia de Software');
        } else if (dept.includes('civil')) {
          setSelectedCourse('Engenharia Civil');
        } else if (dept.includes('direito')) {
          setSelectedCourse('Direito');
        }
      }

      // 3. Busca livros no acervo
      const { data: booksData, error: booksError } = await supabase
        .from('acervo')
        .select('*')
        .order('titulo', { ascending: true });

      if (booksError) throw booksError;
      setAcervo(booksData || []);

      // 4. Busca empréstimos do usuário
      const { data: loansData, error: loansError } = await supabase
        .from('circulacao')
        .select(`
          *,
          material:acervo (titulo, autor, capa_url)
        `)
        .eq('usuario_id', user.id)
        .order('data_emprestimo', { ascending: false });

      if (loansError) throw loansError;
      setEmprestimos(loansData || []);

      // 5. Busca reservas do usuário
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservas')
        .select(`
          *,
          material:acervo (titulo, autor, capa_url, exemplares_disponiveis, exemplares_total)
        `)
        .eq('usuario_id', user.id)
        .order('data_solicitacao', { ascending: false });

      if (reservationsError) throw reservationsError;
      setReservas(reservationsData || []);

    } catch (err: any) {
      console.error('Erro ao carregar dados do portal:', err);
      setErrorMsg(err.message || 'Falha ao carregar informações da biblioteca.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  /**
   * Efetua o logout do portal.
   */
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Erro ao efetuar logout:', err);
    }
  };

  // Verifica o status de reserva ativa do leitor para um determinado livro
  const getBookReservationStatus = (bookId: string) => {
    const reservation = reservas.find(r => r.material_id === bookId && r.status !== 'finalizada' && r.status !== 'rejeitada');
    return reservation ? reservation.status : null;
  };

  // Calcula a posição do leitor na fila de espera para determinado livro
  const getQueuePosition = (bookId: string, resId?: string) => {
    // Busca todas as reservas ativas (espera ou pendente) ordenadas cronologicamente
    const activeReserves = reservas
      .filter(r => r.material_id === bookId && (r.status === 'espera' || r.status === 'pendente'))
      .sort((a, b) => new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime());
    
    if (!resId) {
      return activeReserves.length + 1;
    }
    
    const index = activeReserves.findIndex(r => r.id === resId);
    return index !== -1 ? index + 1 : activeReserves.length + 1;
  };

  // Solicita uma nova reserva de livro (ou fila de espera)
  const handleCreateReservation = async (bookId: string, customStatus?: string) => {
    if (!profile) return;
    setSubmittingReserva(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const initialStatus = customStatus || 'pendente';
      const { error } = await supabase
        .from('reservas')
        .insert([
          {
            usuario_id: profile.id,
            material_id: bookId,
            status: initialStatus
          }
        ]);

      if (error) throw error;
      
      // Recarrega os dados para atualizar instantaneamente na tela
      await loadPortalData();
      setSuccessMsg(
        initialStatus === 'espera'
          ? 'Você entrou na fila de espera com sucesso!'
          : 'Solicitação de reserva efetuada com sucesso!'
      );
    } catch (err: any) {
      console.error('Erro ao solicitar reserva:', err);
      setErrorMsg(err.message || 'Falha ao solicitar reserva.');
    } finally {
      setSubmittingReserva(false);
      setMaterialToReserve(null);
    }
  };

  // Renova o prazo de retirada de uma reserva aprovada
  const handleRenewReservation = async (reservaId: string, currentLimit: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const newLimitDate = new Date(currentLimit);
      newLimitDate.setDate(newLimitDate.getDate() + 3);

      const { error } = await supabase
        .from('reservas')
        .update({
          data_retirada_limite: newLimitDate.toISOString(),
          renovacoes_contagem: 1
        })
        .eq('id', reservaId);

      if (error) throw error;
      
      await loadPortalData();
      setSuccessMsg('Prazo de retirada da reserva renovado por mais 3 dias com sucesso!');
    } catch (err: any) {
      console.error('Erro ao renovar reserva:', err);
      setErrorMsg(err.message || 'Falha ao renovar reserva.');
    } finally {
      setLoading(false);
    }
  };

  // Filtragem inteligente de livros do acervo
  const filteredBooks = acervo.filter((book) => {
    const matchesSearch = 
      book.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.autor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.isbn.includes(searchTerm) ||
      (book.assuntos && book.assuntos.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (book.numero_chamada && book.numero_chamada.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = 
      selectedCategory === 'Todos' || 
      book.categoria.toLowerCase() === selectedCategory.toLowerCase();

    const matchesCourse = 
      selectedCourse === 'Todos' || 
      book.curso === selectedCourse;

    return matchesSearch && matchesCategory && matchesCourse;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-primary">Carregando seu Portal Inbook...</p>
      </div>
    );
  }

  // Estatísticas rápidas
  const activeLoansCount = emprestimos.filter(l => l.status === 'ativo' || l.status === 'atrasado').length;
  const overdueLoansCount = emprestimos.filter(l => l.status === 'atrasado').length;

  return (
    <div className="min-h-screen bg-surface-container-lowest flex flex-col font-sans select-none pb-12">
      
      {/* Barra de Cabeçalho Superior Premium */}
      <header className="fixed top-0 w-full z-40 bg-surface border-b border-outline-variant/40 flex justify-between items-center px-6 py-3 h-16 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <img 
            src="/marca.JPG" 
            alt="INBOOK Logo" 
            className="h-8 w-auto object-contain" 
          />
          <span className="h-4 w-px bg-outline-variant/60"></span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider hidden sm:inline">
            Portal do Leitor
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-primary">{profile?.nome_completo}</p>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-wider font-bold opacity-75">
              {profile?.tipo === 'estudante' ? 'Aluno' : 'Docente'} • {profile?.matricula}
            </p>
          </div>

          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shadow-sm border border-outline-variant/50">
            {profile?.nome_completo.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
          </div>

          <button
            onClick={handleLogout}
            className="text-on-surface-variant hover:text-secondary p-2 hover:bg-error-container/20 transition-colors rounded-full active:scale-95 duration-100 cursor-pointer"
            title="Sair do Portal"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 space-y-6">
        
        {/* Banner de Boas-vindas Glassmorphic */}
        <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/5 border border-outline-variant/40 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full filter blur-3xl pointer-events-none -mr-16 -mt-16"></div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
              <Sparkles className="w-4 h-4" />
              <span>Bem-vindo ao Inbook</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary">
              Olá, {profile?.nome_completo.split(' ')[0]}!
            </h1>
            <p className="text-sm text-on-surface-variant max-w-md">
              Consulte a disponibilidade de livros do acervo e acompanhe seus empréstimos ativos em tempo real.
            </p>
          </div>

          {/* Mini Cards de Estatísticas */}
          <div className="flex gap-4 w-full sm:w-auto">
            <div className="flex-1 sm:flex-initial bg-white border border-outline-variant/60 rounded-xl p-4 min-w-[120px] shadow-sm text-center">
              <BookMarked className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs text-on-surface-variant">Meus Empréstimos</p>
              <p className="text-xl font-bold text-primary mt-0.5">{activeLoansCount}</p>
            </div>
            <div className="flex-1 sm:flex-initial bg-white border border-outline-variant/60 rounded-xl p-4 min-w-[120px] shadow-sm text-center">
              <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${overdueLoansCount > 0 ? 'text-secondary' : 'text-on-surface-variant/40'}`} />
              <p className="text-xs text-on-surface-variant">Livros Atrasados</p>
              <p className={`text-xl font-bold mt-0.5 ${overdueLoansCount > 0 ? 'text-secondary' : 'text-primary'}`}>{overdueLoansCount}</p>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="bg-error-container border border-error/20 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-on-error-container">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-start gap-3 select-none animate-in fade-in duration-300">
            <UserCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-primary">{successMsg}</p>
          </div>
        )}

        {/* Abas de Navegação do Portal */}
        <div className="flex border-b border-outline-variant/60 gap-6">
          <button
            onClick={() => setActiveTab('catalogo')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'catalogo'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            Catálogo do Acervo ({filteredBooks.length})
          </button>
          <button
            onClick={() => setActiveTab('meus-livros')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'meus-livros'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            Meus Empréstimos ({emprestimos.length})
          </button>
          <button
            onClick={() => setActiveTab('meus-reservas')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'meus-reservas'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            Minhas Reservas ({reservas.length})
          </button>
        </div>

        {/* ABA 1: CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <div className="space-y-6">
            
            {/* Barra de Filtros e Pesquisa */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-outline-variant rounded-xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-xl">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Pesquisar por título, autor, assunto, chamada..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50"
                  />
                </div>
                
                {/* Filtro por Curso */}
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="py-2 px-3 border border-outline-variant bg-surface text-sm rounded-md focus:outline-none focus:border-primary shrink-0 text-on-surface"
                >
                  <option value="Todos">Todos os Cursos</option>
                  <option value="Multidisciplinar / Geral">Multidisciplinar</option>
                  <option value="Análise e Desenvolvimento de Sistemas (ADS)">ADS</option>
                  <option value="Engenharia de Software">Eng. Software</option>
                  <option value="Engenharia Civil">Eng. Civil</option>
                  <option value="Direito">Direito</option>
                </select>
              </div>

              {/* Filtro de Categoria Rolável */}
              <div className="flex gap-2 overflow-x-auto w-full md:w-auto scrollbar-none py-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Livros */}
            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBooks.map((book) => {
                  const isAvailable = book.exemplares_disponiveis > 0;
                  
                  return (
                    <div 
                      key={book.id} 
                      className="bg-white border border-outline-variant rounded-xl p-5 flex gap-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
                    >
                      {/* Capa do Livro com placeholder premium */}
                      <div className="w-20 h-28 bg-surface-container border border-outline-variant rounded-md overflow-hidden shrink-0 shadow-inner flex items-center justify-center relative">
                        {book.capa_url ? (
                          <img 
                            src={book.capa_url} 
                            alt={book.titulo} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <BookOpen className="w-8 h-8 text-on-surface-variant/30" />
                        )}
                      </div>

                      {/* Informações detalhadas */}
                      <div className="flex flex-col flex-1 justify-between py-0.5">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-1">
                            <span className="inline-block px-2 py-0.5 bg-primary/5 text-primary rounded text-[9px] font-bold uppercase tracking-wider">
                              {book.categoria}
                            </span>
                            <button
                              onClick={() => setSelectedMaterialDetails(book)}
                              className="text-[9px] text-primary font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                              title="Ver Ficha Técnica"
                            >
                              <Info className="w-3 h-3" />
                              <span>Ficha</span>
                            </button>
                          </div>
                          <h3 className="text-sm font-bold text-primary line-clamp-2 leading-snug" title={book.titulo}>
                            {book.titulo}
                          </h3>
                          <p className="text-xs text-on-surface-variant font-semibold leading-none">
                            {book.autor}
                          </p>
                          {book.numero_chamada && (
                            <p className="text-[9px] text-on-surface-variant font-mono">
                              Chamada: {book.numero_chamada}
                            </p>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-2 mt-1">
                          <span className="text-[10px] text-on-surface-variant font-bold">
                            Ano: {book.ano}
                          </span>

                          <div className="flex items-center gap-2">
                            {book.pdf_url && (
                              <a 
                                href={book.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded hover:bg-primary/20 transition-all cursor-pointer shrink-0"
                                title="Visualizar Documento"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>PDF</span>
                              </a>
                            )}
                            
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isAvailable
                                ? 'bg-primary/10 text-primary'
                                : 'bg-error-container text-on-error-container'
                            }`}>
                              {isAvailable 
                                ? `Disponível (${book.exemplares_disponiveis}/${book.exemplares_total})` 
                                : 'Indisponível'
                              }
                            </span>
                          </div>
                        </div>

                        {/* Botão de Reserva Online */}
                        <div className="mt-3 pt-2.5 border-t border-outline-variant/30 flex justify-end">
                          {(() => {
                            const userReserve = reservas.find(r => r.material_id === book.id && r.status !== 'finalizada' && r.status !== 'rejeitada');
                            const resStatus = userReserve ? userReserve.status : null;

                            if (resStatus === 'pendente') {
                              return (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-200 shadow-sm">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>Reserva Pendente</span>
                                </span>
                              );
                            }
                            if (resStatus === 'espera') {
                              const pos = getQueuePosition(book.id, userReserve?.id);
                              return (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-200 shadow-sm">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>Fila de Espera (Posição #{pos})</span>
                                </span>
                              );
                            }
                            if (resStatus === 'aprovada') {
                              return (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-md border border-emerald-200 shadow-sm">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Aprovada - Retirar</span>
                                </span>
                              );
                            }
                            if (!isAvailable) {
                              return (
                                <button
                                  onClick={() => {
                                    setMaterialToReserve(book);
                                    setIsWaitingListMode(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 active:scale-95 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-sm"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Fila de Espera</span>
                                </button>
                              );
                            }
                            return (
                              <button
                                onClick={() => {
                                  setMaterialToReserve(book);
                                  setIsWaitingListMode(false);
                                }}
                                className="inline-flex items-center gap-1.5 bg-primary text-on-primary hover:bg-primary/90 active:scale-95 text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-sm hover:shadow"
                              >
                                <BookMarked className="w-3.5 h-3.5" />
                                <span>Reservar Livro</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-outline-variant rounded-xl p-12 text-center shadow-sm">
                <Library className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-primary">Nenhum livro encontrado</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Experimente mudar sua busca ou selecionar outra categoria de filtros.
                </p>
              </div>
            )}

          </div>
        )}

        {/* ABA 2: MEUS EMPRÉSTIMOS */}
        {activeTab === 'meus-livros' && (
          <div className="space-y-6">
            
            {emprestimos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {emprestimos.map((loan) => {
                  const isOverdue = loan.status === 'atrasado';
                  const isReturned = loan.status === 'devolvido';

                  return (
                    <div 
                      key={loan.id} 
                      className={`bg-white border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all ${
                        isOverdue 
                          ? 'border-error/30 bg-gradient-to-b from-white to-error/5' 
                          : 'border-outline-variant'
                      }`}
                    >
                      {/* Cabeçalho do Card de Empréstimo */}
                      <div className="flex justify-between items-start border-b border-outline-variant/30 pb-3">
                        <div className="flex gap-2.5 items-center">
                          <BookOpen className="w-5 h-5 text-primary shrink-0" />
                          <div>
                            <h3 className="text-sm font-bold text-primary line-clamp-1">
                              {loan.material?.titulo}
                            </h3>
                            <p className="text-[10px] text-on-surface-variant font-semibold">
                              {loan.material?.autor}
                            </p>
                          </div>
                        </div>

                        {/* Status Tag */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isReturned
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : isOverdue
                            ? 'bg-error-container text-on-error-container border border-error/20'
                            : 'bg-surface-container border border-outline text-on-surface-variant'
                        }`}>
                          {isReturned ? 'Devolvido' : isOverdue ? 'Atrasado' : 'Em Andamento'}
                        </span>
                      </div>

                      {/* Corpo do Card: Datas de Controle */}
                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-on-surface-variant">
                        <div className="space-y-1">
                          <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/60 uppercase tracking-wider font-bold">
                            <Calendar className="w-3.5 h-3.5" />
                            Retirado em
                          </span>
                          <span>{formatDate(loan.data_emprestimo)}</span>
                        </div>

                        <div className="space-y-1">
                          <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/60 uppercase tracking-wider font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            {isReturned ? 'Devolvido em' : 'Devolver até'}
                          </span>
                          <span className={isOverdue ? 'text-secondary font-bold' : ''}>
                            {isReturned 
                              ? formatDate(loan.data_devolucao_real) 
                              : formatDate(loan.data_devolucao_prevista)
                            }
                          </span>
                        </div>
                      </div>

                      {/* Rodapé: Multas e Renovação */}
                      {!isReturned && (
                        <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-center">
                          <div className="text-xs">
                            <span className="text-[10px] text-on-surface-variant/60 block font-bold uppercase tracking-wider">
                              Renovações
                            </span>
                            <span className="font-bold text-primary">
                              {loan.renovacoes_contagem} / 3 vezes
                            </span>
                          </div>

                          {loan.multa_acumulada > 0 && (
                            <div className="text-right">
                              <span className="text-[10px] text-secondary font-bold block uppercase tracking-wider">
                                Multa Acumulada
                              </span>
                              <span className="font-bold text-secondary text-sm">
                                R$ {Number(loan.multa_acumulada).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-outline-variant rounded-xl p-12 text-center shadow-sm">
                <BookMarked className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-primary">Nenhum empréstimo registrado</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Quando você realizar empréstimos de livros com a equipe da biblioteca, eles aparecerão aqui.
                </p>
              </div>
            )}

          </div>
        )}

        {/* ABA 3: MINHAS RESERVAS */}
        {activeTab === 'meus-reservas' && (
          <div className="space-y-6">
            
            {reservas.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {reservas.map((res) => {
                  const isPending = res.status === 'pendente';
                  const isWaitingQueue = res.status === 'espera';
                  const isApproved = res.status === 'aprovada';
                  const isRejected = res.status === 'rejeitada';
                  const isFinalized = res.status === 'finalizada';

                  return (
                    <div 
                      key={res.id} 
                      className={`bg-white border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all ${
                        isPending || isWaitingQueue
                          ? 'border-amber-200 bg-gradient-to-b from-white to-amber-50/20' 
                          : isApproved
                          ? 'border-emerald-200 bg-gradient-to-b from-white to-emerald-50/20'
                          : isRejected
                          ? 'border-error/20 bg-gradient-to-b from-white to-error/5'
                          : 'border-outline-variant/60 bg-surface-container-lowest'
                      }`}
                    >
                      {/* Cabeçalho do Card de Reserva */}
                      <div className="flex justify-between items-start border-b border-outline-variant/30 pb-3">
                        <div className="flex gap-2.5 items-center">
                          <BookOpen className="w-5 h-5 text-primary shrink-0" />
                          <div>
                            <h3 className="text-sm font-bold text-primary line-clamp-1" title={res.material?.titulo}>
                              {res.material?.titulo}
                            </h3>
                            <p className="text-[10px] text-on-surface-variant font-semibold">
                              {res.material?.autor}
                            </p>
                          </div>
                        </div>

                        {/* Status Tag */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPending || isWaitingQueue
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : isApproved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse'
                            : isRejected
                            ? 'bg-error-container text-on-error-container border border-error/20'
                            : 'bg-surface-container border border-outline text-on-surface-variant'
                        }`}>
                          {isPending ? 'Pendente' : isWaitingQueue ? 'Em Fila de Espera' : isApproved ? 'Aprovada' : isRejected ? 'Rejeitada' : 'Retirado (Finalizado)'}
                        </span>
                      </div>

                      {/* Corpo do Card: Datas de Controle e Justificativa */}
                      <div className="flex-1 flex flex-col justify-between gap-3 text-xs font-semibold text-on-surface-variant">
                        <div className="space-y-1">
                          <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/60 uppercase tracking-wider font-bold">
                            <Calendar className="w-3.5 h-3.5" />
                            Data da Solicitação
                          </span>
                          <span>{formatDate(res.data_solicitacao)}</span>
                        </div>

                        {isWaitingQueue && (
                          <div className="space-y-1 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                            <span className="flex items-center gap-1.5 text-[10px] text-amber-800 uppercase tracking-wider font-bold">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              Fila de Espera
                            </span>
                            <span className="text-amber-900 font-bold text-sm">
                              Sua Posição: #{getQueuePosition(res.material_id, res.id)}
                            </span>
                            <p className="text-[9px] text-amber-700 font-normal leading-tight mt-0.5">
                              Aguardando a devolução de exemplares físicos para homologação.
                            </p>
                          </div>
                        )}

                        {isApproved && res.data_retirada_limite && (
                          <div className="space-y-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/60">
                            <div className="space-y-1">
                              <span className="flex items-center gap-1.5 text-[10px] text-emerald-700 uppercase tracking-wider font-bold">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                Retirar até
                              </span>
                              <span className="text-emerald-800 font-bold text-sm">
                                {formatDate(res.data_retirada_limite)}
                              </span>
                              <p className="text-[9px] text-emerald-600 font-normal leading-tight mt-0.5">
                                Dirija-se ao balcão de atendimento para retirar seu exemplar.
                              </p>
                            </div>
                            
                            {res.renovacoes_contagem === 0 ? (
                              <button
                                onClick={() => handleRenewReservation(res.id, res.data_retirada_limite)}
                                className="w-full flex items-center justify-center gap-1 border border-emerald-200 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 text-[10px] font-bold py-1.5 rounded transition-all cursor-pointer shadow-sm mt-1 animate-in fade-in duration-200"
                              >
                                <RefreshCw className="w-3 h-3 text-emerald-600" />
                                <span>Renovar Retirada (+3 dias)</span>
                              </button>
                            ) : (
                              <span className="block text-[9px] text-on-surface-variant/40 text-center italic font-semibold border-t border-emerald-100 pt-1.5">
                                Prazo Renovado (Limite Atingido)
                              </span>
                            )}
                          </div>
                        )}

                        {isRejected && res.justificativa && (
                          <div className="space-y-1 bg-error-container/40 p-2.5 rounded-lg border border-error/10">
                            <span className="flex items-center gap-1.5 text-[10px] text-on-error-container uppercase tracking-wider font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-error" />
                              Motivo da Rejeição
                            </span>
                            <p className="text-[11px] text-on-error-container/85 font-normal leading-normal whitespace-pre-line italic">
                              "{res.justificativa}"
                            </p>
                          </div>
                        )}

                        {isFinalized && (
                          <p className="text-[10px] text-on-surface-variant/50 font-normal italic">
                            Esta reserva foi convertida em um empréstimo ativo e o exemplar já foi retirado.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-outline-variant rounded-xl p-12 text-center shadow-sm">
                <BookMarked className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-primary">Nenhuma reserva registrada</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Você pode pesquisar livros no catálogo e realizar solicitações de reserva online para garantir sua leitura.
                </p>
              </div>
            )}

          </div>
        )}

      </main>

      {/* MODAL: Ficha Catalográfica / Ficha Técnica */}
      {selectedMaterialDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container-low">
              <h3 className="font-serif text-sm font-bold text-primary flex items-center gap-1.5">
                <Library className="w-4 h-4" />
                <span>Ficha Catalográfica / Registro Técnico</span>
              </h3>
              <button 
                onClick={() => setSelectedMaterialDetails(null)}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-6 space-y-4 text-sm overflow-y-auto flex-1">
              <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-lg font-mono text-xs text-on-surface-variant relative shadow-inner">
                <div className="absolute top-4 right-4 text-[9px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                  {selectedMaterialDetails.categoria}
                </div>
                
                <div className="space-y-3 leading-relaxed">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Código de Localização (Número de Chamada)</span>
                    <p className="font-semibold text-on-surface">{selectedMaterialDetails.numero_chamada || 'Não catalogado'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Autor Principal</span>
                    <p className="font-semibold text-on-surface">{selectedMaterialDetails.autor}</p>
                  </div>

                  {selectedMaterialDetails.titulo_original && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Título Uniforme / Original</span>
                      <p className="text-on-surface italic">{selectedMaterialDetails.titulo_original}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Título Principal</span>
                    <p className="font-bold text-primary text-sm">{selectedMaterialDetails.titulo}</p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Publicação</span>
                    <p className="text-on-surface">{selectedMaterialDetails.publicacao || `[S.l. : s.n.], ${selectedMaterialDetails.ano}`}</p>
                  </div>

                  {selectedMaterialDetails.descricao_fisica && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Descrição Física</span>
                      <p className="text-on-surface">{selectedMaterialDetails.descricao_fisica}</p>
                    </div>
                  )}

                  {selectedMaterialDetails.serie && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Série / Coleção</span>
                      <p className="text-on-surface">{selectedMaterialDetails.serie}</p>
                    </div>
                  )}

                  {selectedMaterialDetails.notas && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Notas / Observações</span>
                      <p className="text-on-surface bg-surface-container/30 p-2 rounded whitespace-pre-line text-[11px] leading-normal">{selectedMaterialDetails.notas}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">ISBN / Identificador</span>
                    <p className="text-on-surface font-semibold">{selectedMaterialDetails.isbn}</p>
                  </div>

                  {selectedMaterialDetails.assuntos && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Assunto(s) / Indexadores</span>
                      <div className="flex flex-wrap gap-1.5 mt-1 font-sans">
                        {selectedMaterialDetails.assuntos.split(';').map((t, idx) => (
                          <span key={idx} className="bg-primary/5 border border-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded">
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMaterialDetails.curso && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-primary font-sans block leading-none mb-1">Curso Relacionado</span>
                      <p className="text-on-surface font-semibold font-sans text-[11px]">{selectedMaterialDetails.curso}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className="px-6 py-4 border-t border-outline-variant/40 bg-surface flex gap-3">
              {selectedMaterialDetails.pdf_url && (
                <a 
                  href={selectedMaterialDetails.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 rounded font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow cursor-pointer text-center text-on-primary block hover:underline"
                >
                  <FileText className="w-4 h-4" />
                  <span>Visualizar Documento PDF</span>
                </a>
              )}
              <button 
                onClick={() => setSelectedMaterialDetails(null)}
                className={`py-2.5 rounded font-bold text-xs hover:bg-surface-container active:scale-95 transition-all cursor-pointer text-center border border-outline text-primary ${selectedMaterialDetails.pdf_url ? 'w-[100px]' : 'flex-1'}`}
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Reserva Online */}
      {materialToReserve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col">
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container-low">
              <h3 className="font-serif text-sm font-bold text-primary flex items-center gap-1.5">
                <BookMarked className="w-4 h-4 text-primary" />
                <span>Confirmar Reserva Online</span>
              </h3>
              <button 
                onClick={() => setMaterialToReserve(null)}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-6 space-y-4 text-center">
              <div className="w-20 h-28 bg-surface-container border border-outline-variant rounded-md overflow-hidden shadow-inner flex items-center justify-center mx-auto">
                {materialToReserve.capa_url ? (
                  <img 
                    src={materialToReserve.capa_url} 
                    alt={materialToReserve.titulo} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <BookOpen className="w-8 h-8 text-on-surface-variant/30" />
                )}
              </div>

              <div>
                <h4 className="font-bold text-primary text-sm leading-snug">{materialToReserve.titulo}</h4>
                <p className="text-xs text-on-surface-variant font-semibold mt-0.5">{materialToReserve.autor}</p>
              </div>

              <div className={`p-4 rounded-lg text-xs leading-relaxed font-semibold ${
                isWaitingListMode 
                  ? 'bg-amber-50 text-amber-900 border border-amber-100'
                  : 'bg-primary/5 text-primary border border-primary/10'
              }`}>
                {isWaitingListMode ? (
                  <p>
                    Este livro está esgotado no momento. Ao confirmar, você entrará na <strong>Fila de Espera</strong> na posição <strong>#{getQueuePosition(materialToReserve.id)}</strong>. 
                    A equipe irá analisar a solicitação quando novos exemplares forem devolvidos.
                  </p>
                ) : (
                  <p>
                    Esta reserva aguardará homologação da equipe da biblioteca. Após aprovada, você terá um prazo limite de <strong>3 dias corridos</strong> para retirar o exemplar físico no balcão de atendimento.
                  </p>
                )}
              </div>
            </div>

            <footer className="px-6 py-4 border-t border-outline-variant/40 bg-surface flex gap-3">
              <button 
                onClick={() => handleCreateReservation(materialToReserve.id, isWaitingListMode ? 'espera' : 'pendente')}
                disabled={submittingReserva}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 rounded font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow cursor-pointer text-center"
              >
                {submittingReserva ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <BookMarked className="w-4 h-4" />
                    <span>{isWaitingListMode ? 'Entrar na Fila' : 'Confirmar Reserva'}</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => setMaterialToReserve(null)}
                disabled={submittingReserva}
                className="py-2.5 px-4 border border-outline text-primary hover:bg-surface-container rounded font-bold text-xs active:scale-95 transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
