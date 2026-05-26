'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Circulacao, Usuario, Material } from '@/types';
import { 
  Search, 
  ArrowLeftRight, 
  User, 
  BookOpen, 
  History, 
  PlusCircle, 
  Calendar, 
  RefreshCw, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  DollarSign
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import AnimatedCounter from '@/components/AnimatedCounter';

/**
 * Página de Controle de Circulação.
 * Gerencia a realização de novos empréstimos (com transação atômica em TypeScript),
 * renovações de prazo, devolução física de materiais (com incremento automático de estoque)
 * e o histórico completo de transações da biblioteca.
 */
export default function CirculacaoPage() {
  const supabase = createClient();

  // Estados de dados
  const [emprestimos, setEmprestimos] = useState<Circulacao[]>([]);
  const [usuariosAtivos, setUsuariosAtivos] = useState<Usuario[]>([]);
  const [livrosDisponiveis, setLivrosDisponiveis] = useState<Material[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  
  // Estados de controle
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico' | 'novo' | 'reservas'>('ativos');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inputs do novo empréstimo
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [returnDays, setReturnDays] = useState('14');

  const [fineRate, setFineRate] = useState(2.00);

  // Filtro de status de empréstimos ativos (todos | ativo | atrasado) suportando query params
  const [filterType, setFilterType] = useState<'todos' | 'ativo' | 'atrasado'>('todos');

  // Calcula a posição da fila de espera no painel administrativo
  const getAdminQueuePosition = (bookId: string, resId: string) => {
    const bookReserves = reservas
      .filter(r => r.material_id === bookId && (r.status === 'espera' || r.status === 'pendente'))
      .sort((a, b) => new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime());
    
    const index = bookReserves.findIndex(r => r.id === resId);
    return index !== -1 ? index + 1 : bookReserves.length + 1;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      if (status === 'ativo' || status === 'atrasado') {
        setFilterType(status);
      }
      const tab = params.get('tab');
      if (tab === 'reservas') {
        setActiveTab('reservas');
      }
    }
  }, []);

  // Carrega todos os dados iniciais do Supabase
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Carrega taxa de multa do localStorage
      if (typeof window !== 'undefined') {
        const rate = localStorage.getItem('rule_fine_per_day') || '2.00';
        setFineRate(parseFloat(rate));
      }

      // 1, 2 e 3. Dispara as três consultas ao Supabase em PARALELO usando Promise.all
      // Isso otimiza drasticamente a performance, reduzindo o tempo de carregamento
      // de sequencial (uma após a outra) para paralelo (todas juntas)
      // 1, 2, 3 e 4. Dispara as consultas ao Supabase em PARALELO usando Promise.all
      // Isso otimiza drasticamente a performance, reduzindo o tempo de carregamento
      // de sequencial (uma após a outra) para paralelo (todas juntas)
      const [loansResult, usersResult, booksResult, reservationsResult] = await Promise.all([
        supabase
          .from('circulacao')
          .select(`
            *,
            usuario:usuarios (nome_completo, matricula),
            material:acervo (titulo, autor)
          `)
          .order('data_emprestimo', { ascending: false }),
        
        supabase
          .from('usuarios')
          .select('*')
          .eq('status', true)
          .order('nome_completo', { ascending: true }),
        
        supabase
          .from('acervo')
          .select('*')
          .gt('exemplares_disponiveis', 0)
          .order('titulo', { ascending: true }),

        supabase
          .from('reservas')
          .select(`
            *,
            usuario:usuarios (nome_completo, matricula),
            material:acervo (titulo, autor, exemplares_disponiveis, exemplares_total)
          `)
          .order('data_solicitacao', { ascending: false })
      ]);

      if (loansResult.error) throw loansResult.error;
      if (usersResult.error) throw usersResult.error;
      if (booksResult.error) throw booksResult.error;
      if (reservationsResult.error) throw reservationsResult.error;

      const loansData = loansResult.data;
      const usersData = usersResult.data;
      const booksData = booksResult.data;
      const reservationsData = reservationsResult.data;

      // Calcula as multas de atrasos ativas de forma dinâmica no carregamento se houver atraso físico real
      const processedLoans = (loansData || []).map((loan: any) => {
        if (loan.status === 'atrasado' || (loan.status === 'ativo' && new Date(loan.data_devolucao_prevista).getTime() < Date.now())) {
          // Calcula dias de atraso
          const diffTime = Date.now() - new Date(loan.data_devolucao_prevista).getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 0) {
            const savedRate = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('rule_fine_per_day') || '2.00') : 2.00;
            const calculatedFine = diffDays * savedRate;
            
            return {
              ...loan,
              status: 'atrasado',
              multa_acumulada: calculatedFine
            };
          }
        }
        return loan;
      });

      setEmprestimos(processedLoans);
      setUsuariosAtivos(usersData || []);
      setLivrosDisponiveis(booksData || []);
      setReservas(reservationsData || []);

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados de circulação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Lógica de Transação Atômica em TypeScript (Etapa 5):
   * 1. Insere o registro de empréstimo em `circulacao`.
   * 2. Decrementa o estoque `exemplares_disponiveis` em `acervo`.
   */
  const handleCreateEmprestimo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUsuarioId || !selectedMaterialId) {
      setErrorMsg('Selecione um leitor e um material.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Calcula data de devolução prevista
      const days = parseInt(returnDays, 10);
      const dataPrevista = new Date();
      dataPrevista.setDate(dataPrevista.getDate() + days);

      // A. Decrementa o exemplar do acervo
      // Primeiro, buscamos as informações atuais do material para garantir que ainda está disponível
      const { data: material, error: fetchError } = await supabase
        .from('acervo')
        .select('exemplares_disponiveis')
        .eq('id', selectedMaterialId)
        .single();

      if (fetchError || !material) throw new Error('Material não encontrado.');
      if (material.exemplares_disponiveis <= 0) {
        throw new Error('Não há exemplares disponíveis deste material no momento.');
      }

      // Decrementa de forma segura
      const { error: updateError } = await supabase
        .from('acervo')
        .update({ exemplares_disponiveis: material.exemplares_disponiveis - 1 })
        .eq('id', selectedMaterialId);

      if (updateError) throw updateError;

      // B. Insere o empréstimo na tabela circulacao
      const { error: insertError } = await supabase
        .from('circulacao')
        .insert([
          {
            usuario_id: selectedUsuarioId,
            material_id: selectedMaterialId,
            data_devolucao_prevista: dataPrevista.toISOString(),
            status: 'ativo',
          }
        ]);

      if (insertError) {
        // Fallback: se o insert falhar, reverte o decremento do acervo
        await supabase
          .from('acervo')
          .update({ exemplares_disponiveis: material.exemplares_disponiveis })
          .eq('id', selectedMaterialId);
        
        throw insertError;
      }

      setSuccessMsg('Empréstimo registrado com sucesso!');
      setSelectedUsuarioId('');
      setSelectedMaterialId('');
      setActiveTab('ativos');
      
      // Recarrega dados completos
      loadData();

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar transação de empréstimo.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Lógica de Devolução (Etapa 5):
   * 1. Altera status do empréstimo para 'devolvido'.
   * 2. Incrementa `exemplares_disponiveis` no acervo.
   */
  const handleReturnBook = async (loan: Circulacao) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // A. Atualiza status do empréstimo em circulacao
      const { error: returnError } = await supabase
        .from('circulacao')
        .update({ 
          status: 'devolvido', 
          data_devolucao_real: new Date().toISOString() 
        })
        .eq('id', loan.id);

      if (returnError) throw returnError;

      // B. Incrementa o estoque disponível no acervo
      const { data: material } = await supabase
        .from('acervo')
        .select('exemplares_disponiveis, exemplares_total')
        .eq('id', loan.material_id)
        .single();

      if (material) {
        const novoDisponivel = Math.min(material.exemplares_disponiveis + 1, material.exemplares_total);
        await supabase
          .from('acervo')
          .update({ exemplares_disponiveis: novoDisponivel })
          .eq('id', loan.material_id);
      }

      setSuccessMsg(`Livro "${loan.material?.titulo}" devolvido com sucesso!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar devolução.');
    }
  };

  /**
   * Lógica de Renovação de Prazo (Etapa 5):
   * Soma +7 dias ao prazo de devolução previsto.
   */
  const handleRenewBook = async (loan: Circulacao) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (loan.renovacoes_contagem >= 3) {
        throw new Error('Limite máximo de renovações atingido (máx: 3).');
      }

      const novaData = new Date(loan.data_devolucao_prevista);
      novaData.setDate(novaData.getDate() + 7);

      const { error } = await supabase
        .from('circulacao')
        .update({ 
          data_devolucao_prevista: novaData.toISOString(),
          renovacoes_contagem: loan.renovacoes_contagem + 1 
        })
        .eq('id', loan.id);

      if (error) throw error;

      setSuccessMsg(`Empréstimo renovado por mais 7 dias!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar renovação.');
    }
  };

  /**
   * Lógica de Aprovar Reserva:
   * 1. Altera status da reserva para 'aprovada' e define data limite.
   * 2. Decrementa o exemplar disponível no acervo.
   */
  const handleAprovarReserva = async (res: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data: material, error: materialError } = await supabase
        .from('acervo')
        .select('exemplares_disponiveis')
        .eq('id', res.material_id)
        .single();

      if (materialError || !material) throw new Error('Livro não encontrado no acervo.');
      if (material.exemplares_disponiveis <= 0) {
        throw new Error('Não há exemplares disponíveis deste livro no momento.');
      }

      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 3);

      const { error: updateError } = await supabase
        .from('acervo')
        .update({ exemplares_disponiveis: material.exemplares_disponiveis - 1 })
        .eq('id', res.material_id);

      if (updateError) throw updateError;

      const { error: reserveError } = await supabase
        .from('reservas')
        .update({
          status: 'aprovada',
          data_retirada_limite: limitDate.toISOString()
        })
        .eq('id', res.id);

      if (reserveError) {
        await supabase
          .from('acervo')
          .update({ exemplares_disponiveis: material.exemplares_disponiveis })
          .eq('id', res.material_id);
        throw reserveError;
      }

      setSuccessMsg(`Reserva de "${res.material?.titulo}" aprovada com sucesso! O leitor tem até 3 dias para retirar.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aprovar reserva.');
    }
  };

  /**
   * Lógica de Reprovar Reserva:
   * Solicita justificativa e altera status para 'rejeitada'.
   */
  const handleReprovarReserva = async (res: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const justificativa = window.prompt('Digite o motivo da rejeição da reserva:');
    if (justificativa === null) return;
    if (!justificativa.trim()) {
      setErrorMsg('É necessário fornecer uma justificativa para reprovar a reserva.');
      return;
    }

    try {
      const { error } = await supabase
        .from('reservas')
        .update({
          status: 'rejeitada',
          justificativa: justificativa.trim()
        })
        .eq('id', res.id);

      if (error) throw error;

      setSuccessMsg(`Reserva de "${res.material?.titulo}" rejeitada.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao reprovar reserva.');
    }
  };

  /**
   * Lógica de Confirmar Retirada:
   * Cria empréstimo ativo no circulacao e finaliza a reserva.
   */
  const handleConfirmarRetiradaReserva = async (res: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const dataPrevista = new Date();
      dataPrevista.setDate(dataPrevista.getDate() + 14);

      const { error: insertError } = await supabase
        .from('circulacao')
        .insert([
          {
            usuario_id: res.usuario_id,
            material_id: res.material_id,
            data_devolucao_prevista: dataPrevista.toISOString(),
            status: 'ativo'
          }
        ]);

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('reservas')
        .update({
          status: 'finalizada'
        })
        .eq('id', res.id);

      if (updateError) throw updateError;

      setSuccessMsg(`Retirada física confirmada! Empréstimo ativo gerado com devolução prevista para ${dataPrevista.toLocaleDateString('pt-BR')}.`);
      setActiveTab('ativos');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao confirmar retirada.');
    }
  };

  // Separação de abas para listagem com filtro dinâmico
  const todosAtivos = emprestimos.filter((e) => e.status !== 'devolvido');
  const ativos = todosAtivos.filter((e) => {
    if (filterType === 'ativo') return e.status === 'ativo';
    if (filterType === 'atrasado') return e.status === 'atrasado';
    return true;
  });
  
  const historico = emprestimos.filter((e) => e.status === 'devolvido');


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-bold text-primary">Controle de Circulação</h2>
          <p className="text-sm text-on-surface-variant font-sans">
            Gestão institucional de empréstimos, devoluções, renovações e pendências.
          </p>
        </div>
      </header>

      {/* Alertas Rápidos de Feedback */}
      {errorMsg && (
        <div className="bg-error-container border border-error/20 p-4 rounded-lg flex items-start gap-3 select-none">
          <AlertTriangle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-on-error-container">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-surface-container border border-primary/20 p-4 rounded-lg flex items-start gap-3 select-none">
          <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-primary">{successMsg}</p>
        </div>
      )}

      {/* Navegação de Abas */}
      <nav className="flex border-b border-outline-variant/40" role="tablist">
        <button
          onClick={() => setActiveTab('ativos')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 outline-none cursor-pointer ${
            activeTab === 'ativos'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Empréstimos Ativos (<AnimatedCounter value={ativos.length} />)
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 outline-none cursor-pointer ${
            activeTab === 'historico'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Histórico de Transações (<AnimatedCounter value={historico.length} />)
        </button>
        <button
          onClick={() => setActiveTab('novo')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 outline-none cursor-pointer ${
            activeTab === 'novo'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Novo Empréstimo
        </button>
        <button
          onClick={() => setActiveTab('reservas')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 outline-none cursor-pointer ${
            activeTab === 'reservas'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Reservas Online (<AnimatedCounter value={reservas.filter(r => r.status === 'pendente' || r.status === 'aprovada').length} />)
        </button>
      </nav>

      {/* ABA 1: EMPRÉSTIMOS ATIVOS */}
      {activeTab === 'ativos' && (
        <div className="space-y-6 col-span-full">
          {/* Filtros Rápidos Segmentados */}
          <div className="flex items-center gap-2 bg-surface-container-low p-1.5 border border-outline-variant/35 rounded-lg w-max select-none">
            {[
              { id: 'todos', label: 'Todos os Ativos' },
              { id: 'ativo', label: 'Regulares' },
              { id: 'atrasado', label: 'Atrasados' }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id as any)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterType === pill.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-2 text-center py-12 text-on-surface-variant">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="mt-2 font-semibold">Carregando circulação ativa...</p>
            </div>
          ) : ativos.length > 0 ? (
            ativos.map((loan) => {
              const isOverdue = new Date(loan.data_devolucao_prevista) < new Date();
              
              return (
                <div key={loan.id} className="bg-white border border-outline-variant rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
                  
                  {/* Cabeçalho do Card */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-primary">{loan.usuario?.nome_completo}</h3>
                        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
                          Matrícula: {loan.usuario?.matricula}
                        </p>
                      </div>
                    </div>
                    
                    {/* Pip Status */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isOverdue 
                        ? 'bg-error-container border border-error/20 text-on-error-container'
                        : 'bg-surface-container-high border border-primary/20 text-primary'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-secondary' : 'bg-primary'}`} />
                      {isOverdue ? 'Atrasado' : 'No Prazo'}
                    </span>
                  </div>

                  {/* Informações do Livro */}
                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-start gap-3">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-on-surface-variant/60 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-primary">{loan.material?.titulo}</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          Entrega prevista: {formatDate(loan.data_devolucao_prevista)} • Renovado ({loan.renovacoes_contagem}/3)
                        </p>
                      </div>
                    </div>

                    {isOverdue && loan.multa_acumulada > 0 && (
                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-secondary font-bold block uppercase tracking-wider">Multa</span>
                        <span className="text-xs font-bold text-secondary">R$ {Number(loan.multa_acumulada).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleReturnBook(loan)}
                      className="flex-1 py-2 bg-primary text-on-primary text-xs font-bold rounded hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm text-center"
                    >
                      Registrar Devolução
                    </button>
                    <button
                      onClick={() => handleRenewBook(loan)}
                      disabled={loan.renovacoes_contagem >= 3}
                      className="flex-1 py-2 border border-outline text-primary text-xs font-bold rounded hover:bg-surface-container active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer text-center"
                    >
                      Renovar Prazo
                    </button>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="col-span-2 py-12 text-center bg-white border border-outline-variant rounded-xl p-8 shadow-sm">
              <History className="w-12 h-12 mx-auto text-primary/40 mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-primary">Nenhum empréstimo ativo registrado</h3>
              <p className="text-xs text-on-surface-variant mt-2 max-w-sm mx-auto font-normal leading-normal">
                Não há empréstimos de materiais em andamento no momento. 
                Clique na aba "Novo Empréstimo" acima para registrar uma transação.
              </p>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ABA 2: HISTÓRICO DE TRANSAÇÕES */}
      {activeTab === 'historico' && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Leitor</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Material</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Data Empréstimo</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Data Devolução</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : historico.length > 0 ? (
                  historico.map((loan) => (
                    <tr key={loan.id} className="hover:bg-surface-container/10 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-primary">{loan.usuario?.nome_completo}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Matrícula: {loan.usuario?.matricula}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-primary">{loan.material?.titulo}</p>
                        <p className="text-[10px] text-on-surface-variant">{loan.material?.autor}</p>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant font-semibold">
                        {formatDate(loan.data_emprestimo)}
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant font-semibold">
                        {loan.data_devolucao_real ? formatDate(loan.data_devolucao_real) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-surface-container border border-primary/20 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Devolvido
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant italic font-semibold font-sans">
                      Nenhuma transação concluída encontrada no banco de dados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: REGISTRAR NOVO EMPRÉSTIMO */}
      {activeTab === 'novo' && (
        <div className="bg-white border border-outline-variant rounded-xl p-8 max-w-2xl mx-auto shadow-sm">
          <h3 className="font-serif text-xl font-bold text-primary mb-6 flex items-center gap-2 border-b border-outline-variant/30 pb-4">
            <PlusCircle className="w-6 h-6 text-primary" />
            <span>Registrar Nova Transação</span>
          </h3>

          <form onSubmit={handleCreateEmprestimo} className="space-y-6">
            
            {/* Escolher Leitor */}
            <div className="space-y-2">
              <label htmlFor="select-leitor" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Selecione o Leitor (Somente Usuários Ativos)
              </label>
              <select
                id="select-leitor"
                required
                value={selectedUsuarioId}
                onChange={(e) => setSelectedUsuarioId(e.target.value)}
                className="w-full px-3 py-3 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm"
              >
                <option value="">-- Escolher Membro --</option>
                {usuariosAtivos.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome_completo} (Matrícula: {u.matricula})
                  </option>
                ))}
              </select>
            </div>

            {/* Escolher Livro */}
            <div className="space-y-2">
              <label htmlFor="select-livro" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Selecione o Livro (Somente Itens com Estoque)
              </label>
              <select
                id="select-livro"
                required
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full px-3 py-3 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm"
              >
                <option value="">-- Escolher Livro --</option>
                {livrosDisponiveis.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.titulo} (Autor: {b.autor} | {b.exemplares_disponiveis} disponíveis)
                  </option>
                ))}
              </select>
            </div>

            {/* Prazo do Empréstimo */}
            <div className="space-y-2">
              <label htmlFor="select-prazo" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Prazo de Devolução Prevista
              </label>
              <select
                id="select-prazo"
                required
                value={returnDays}
                onChange={(e) => setReturnDays(e.target.value)}
                className="w-full px-3 py-3 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm font-semibold"
              >
                <option value="7">7 Dias (Uso Intensivo / Curto Prazo)</option>
                <option value="14">14 Dias (Prazo Padrão Estudante)</option>
                <option value="21">21 Dias (Prazo Estendido Docente)</option>
              </select>
            </div>

            {/* Botão de Envio */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Confirmar e Registrar Empréstimo</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ABA 4: RESERVAS ONLINE */}
      {activeTab === 'reservas' && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Leitor / Matrícula</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Livro / Estoque</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Solicitado em</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Status / Detalhes</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-right">Ações Operacionais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : reservas.length > 0 ? (
                  reservas.map((res) => {
                    const isPending = res.status === 'pendente';
                    const isWaitingQueue = res.status === 'espera';
                    const isApproved = res.status === 'aprovada';
                    const isRejected = res.status === 'rejeitada';
                    const isFinalized = res.status === 'finalizada';

                    return (
                      <tr key={res.id} className="hover:bg-surface-container/10 transition-colors">
                        {/* Leitor */}
                        <td className="px-6 py-4">
                          <p className="font-bold text-primary">{res.usuario?.nome_completo}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                            Matrícula: {res.usuario?.matricula}
                          </p>
                        </td>

                        {/* Livro */}
                        <td className="px-6 py-4">
                          <p className="font-bold text-primary">{res.material?.titulo}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            Estoque: {res.material?.exemplares_disponiveis} / {res.material?.exemplares_total} exemplares
                          </p>
                        </td>

                        {/* Data Solicitação */}
                        <td className="px-6 py-4 text-on-surface-variant font-semibold">
                          {formatDate(res.data_solicitacao)}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                : isWaitingQueue
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                                : isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isRejected
                                ? 'bg-error-container text-on-error-container border border-error/20'
                                : 'bg-surface-container border border-outline text-on-surface-variant'
                            }`}>
                              {isPending ? 'Pendente' : isWaitingQueue ? `Fila (Posição #${getAdminQueuePosition(res.material_id, res.id)})` : isApproved ? 'Aprovada' : isRejected ? 'Rejeitada' : 'Concluída'}
                            </span>
                            {isApproved && res.data_retirada_limite && (
                              <p className="text-[9px] text-emerald-700 font-bold">
                                Retirar até: {formatDate(res.data_retirada_limite)}
                              </p>
                            )}
                            {isRejected && res.justificativa && (
                              <p className="text-[9px] text-on-error-container font-semibold italic max-w-[200px] leading-tight">
                                Motivo: "{res.justificativa}"
                              </p>
                            )}
                            {isFinalized && (
                              <p className="text-[9px] text-on-surface-variant/60">
                                Retirado em empréstimo físico.
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {(isPending || isWaitingQueue) && (
                              <>
                                <button
                                  onClick={() => handleAprovarReserva(res)}
                                  className="px-3 py-1.5 bg-primary text-on-primary text-[11px] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => handleReprovarReserva(res)}
                                  className="px-3 py-1.5 border border-outline text-secondary hover:bg-error-container/20 text-[11px] font-bold rounded active:scale-95 transition-all cursor-pointer"
                                >
                                  Reprovar
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <button
                                onClick={() => handleConfirmarRetiradaReserva(res)}
                                className="px-3 py-1.5 bg-primary text-on-primary text-[11px] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                              >
                                Confirmar Retirada
                              </button>
                            )}

                            {!isPending && !isWaitingQueue && !isApproved && (
                              <span className="text-xs text-on-surface-variant/40 italic">Sem ações pendentes</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant italic font-semibold font-sans">
                      Nenhuma solicitação de reserva encontrada no banco de dados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
