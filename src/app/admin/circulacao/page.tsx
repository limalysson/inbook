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
  DollarSign,
  Plus,
  X,
  FileText,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Edit
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
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico' | 'reservas'>('ativos');
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // Estados de visualização de detalhes (Fichas Estáticas)
  const [selectedUsuarioForDetails, setSelectedUsuarioForDetails] = useState<Usuario | null>(null);
  const [selectedMaterialForDetails, setSelectedMaterialForDetails] = useState<Material | null>(null);
  const [updatingReaderId, setUpdatingReaderId] = useState<string | null>(null);

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
      if (params.get('add') === 'true') {
        setIsModalOpen(true);
      }
    }
  }, []);

  // Carrega todos os dados iniciais do Supabase
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1, 2, 3, 4 e 5. Dispara as consultas ao Supabase em PARALELO usando Promise.all
      // Isso otimiza drasticamente a performance, reduzindo o tempo de carregamento
      const [loansResult, usersResult, booksResult, reservationsResult, configsResult] = await Promise.all([
        supabase
          .from('circulacao')
          .select(`
            *,
            usuario:usuarios (*),
            material:acervo (*)
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
            usuario:usuarios (*),
            material:acervo (*)
          `)
          .order('data_solicitacao', { ascending: false }),

        supabase
          .from('configuracoes')
          .select('chave, valor')
      ]);

      if (loansResult.error) throw loansResult.error;
      if (usersResult.error) throw usersResult.error;
      if (booksResult.error) throw booksResult.error;
      if (reservationsResult.error) throw reservationsResult.error;

      const loansData = loansResult.data;
      const usersData = usersResult.data;
      const booksData = booksResult.data;
      const reservationsData = reservationsResult.data;
      const configsData = configsResult.data;

      // Obtém a taxa de multa da tabela configuracoes
      let dbFineRate = 2.00;
      if (configsData && configsData.length > 0) {
        const rateConfig = configsData.find((c: any) => c.chave === 'rule_fine_per_day');
        if (rateConfig) {
          dbFineRate = parseFloat(rateConfig.valor);
        }
      }
      setFineRate(dbFineRate);

      // Calcula as multas de atrasos ativas de forma dinâmica no carregamento se houver atraso físico real
      const processedLoans = (loansData || []).map((loan: any) => {
        if (loan.status === 'atrasado' || (loan.status === 'ativo' && new Date(loan.data_devolucao_prevista).getTime() < Date.now())) {
          // Calcula dias de atraso
          const diffTime = Date.now() - new Date(loan.data_devolucao_prevista).getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 0) {
            const calculatedFine = diffDays * dbFineRate;
            
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
      setIsModalOpen(false);
      
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

  /**
   * Altera dinamicamente o status do leitor direto no Supabase
   * e atualiza o estado local e global correspondente.
   */
  const handleToggleReaderStatus = async (id: string, currentStatus: boolean) => {
    setUpdatingReaderId(id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ status: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setSuccessMsg(`Status do leitor atualizado com sucesso!`);
      
      // Atualiza o estado local do modal de detalhes se estiver aberto
      if (selectedUsuarioForDetails && selectedUsuarioForDetails.id === id) {
        setSelectedUsuarioForDetails({
          ...selectedUsuarioForDetails,
          status: !currentStatus
        });
      }

      // Recarrega todos os dados
      loadData();
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar o status do leitor.');
    } finally {
      setUpdatingReaderId(null);
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer shrink-0"
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Novo Empréstimo</span>
        </button>
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
      <nav className="flex border-b border-outline-variant/40 animate-in fade-in duration-300" role="tablist">
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

          {loading ? (
            <div className="text-center py-12 text-on-surface-variant bg-white border border-outline-variant rounded-xl shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="mt-2 font-semibold text-sm">Carregando circulação ativa...</p>
            </div>
          ) : ativos.length > 0 ? (
            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Leitor</th>
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Material</th>
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs hidden md:table-cell">Data Empréstimo</th>
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Prazo Limite / Status</th>
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-center hidden sm:table-cell">Renovações</th>
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {ativos.map((loan) => {
                      const isOverdue = new Date(loan.data_devolucao_prevista) < new Date();
                      
                      return (
                        <tr key={loan.id} className="hover:bg-surface-container/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container hidden sm:flex items-center justify-center font-bold text-xs shrink-0 select-none border border-outline-variant/50">
                                {loan.usuario?.nome_completo ? loan.usuario.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'LE'}
                              </div>
                              <div>
                                <p 
                                  onClick={() => loan.usuario && setSelectedUsuarioForDetails(loan.usuario)}
                                  className="font-bold text-primary cursor-pointer hover:underline select-none"
                                  title="Clique para ver ficha de cadastro do leitor"
                                >
                                  {loan.usuario?.nome_completo}
                                </p>
                                <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
                                  Matrícula: {loan.usuario?.matricula}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p 
                              onClick={() => loan.material && setSelectedMaterialForDetails(loan.material)}
                              className="font-bold text-primary hover:underline cursor-pointer select-none line-clamp-1" 
                              title="Clique para ver ficha técnica do livro"
                            >
                              {loan.material?.titulo}
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-semibold">
                              {loan.material?.autor}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-on-surface-variant font-semibold hidden md:table-cell">
                            {formatDate(loan.data_emprestimo)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className={`font-semibold text-xs ${isOverdue ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
                                {formatDate(loan.data_devolucao_prevista)}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  isOverdue 
                                    ? 'bg-error-container border border-error/20 text-on-error-container'
                                    : 'bg-primary/5 border border-primary/20 text-primary'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-secondary animate-pulse' : 'bg-primary'}`} />
                                  {isOverdue ? 'Atrasado' : 'No Prazo'}
                                </span>
                                {isOverdue && loan.multa_acumulada > 0 && (
                                  <span className="text-[10px] font-bold text-secondary flex items-center gap-0.5" title="Multa acumulada por atraso">
                                    <span className="text-[9px] font-extrabold uppercase shrink-0">R$</span>
                                    <span>{Number(loan.multa_acumulada).toFixed(2)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center hidden sm:table-cell">
                            <span className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-0.5 rounded-md ${
                              loan.renovacoes_contagem >= 3 
                                ? 'bg-error-container/30 text-on-error-container/80'
                                : loan.renovacoes_contagem > 0
                                ? 'bg-primary/5 text-primary font-bold'
                                : 'bg-surface-container text-on-surface-variant/75 font-semibold'
                            }`}>
                              {loan.renovacoes_contagem} / 3
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-1.5 sm:gap-2">
                              <button
                                onClick={() => handleReturnBook(loan)}
                                className="px-3 py-1.5 bg-primary text-on-primary text-[11px] font-bold rounded hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm inline-flex items-center justify-center gap-1 shrink-0"
                                title="Registrar Devolução Física"
                              >
                                <CheckCircle className="w-3.5 h-3.5 animate-pulse" />
                                <span>Devolver</span>
                              </button>
                              <button
                                onClick={() => handleRenewBook(loan)}
                                disabled={loan.renovacoes_contagem >= 3}
                                className="px-3 py-1.5 border border-outline text-primary text-[11px] font-bold rounded hover:bg-surface-container active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1 shrink-0 bg-white"
                                title="Estender Prazo em +7 dias"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Renovar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center bg-white border border-outline-variant rounded-xl p-8 shadow-sm">
              <History className="w-12 h-12 mx-auto text-primary/40 mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-primary">Nenhum empréstimo ativo registrado</h3>
              <p className="text-xs text-on-surface-variant mt-2 max-w-sm mx-auto font-normal leading-normal">
                Não há empréstimos de materiais em andamento no momento. 
                Clique na aba "Novo Empréstimo" acima para registrar uma transação.
              </p>
            </div>
          )}
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
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs hidden sm:table-cell">Data Empréstimo</th>
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
                        <p 
                          onClick={() => loan.usuario && setSelectedUsuarioForDetails(loan.usuario)}
                          className="font-bold text-primary cursor-pointer hover:underline select-none"
                          title="Clique para ver ficha de cadastro do leitor"
                        >
                          {loan.usuario?.nome_completo}
                        </p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Matrícula: {loan.usuario?.matricula}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p 
                          onClick={() => loan.material && setSelectedMaterialForDetails(loan.material)}
                          className="font-bold text-primary hover:underline cursor-pointer select-none line-clamp-1"
                          title="Clique para ver ficha técnica do livro"
                        >
                          {loan.material?.titulo}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">{loan.material?.autor}</p>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant font-semibold hidden sm:table-cell">
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

      {/* MODAL: Registrar Novo Empréstimo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col">
            
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary flex items-center gap-2 select-none">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
                <span>Registrar Novo Empréstimo</span>
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedUsuarioId('');
                  setSelectedMaterialId('');
                  setErrorMsg(null);
                }}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer border-0 bg-transparent shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleCreateEmprestimo} className="p-6 space-y-6">
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
                  className="w-full px-3 py-3 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm text-primary font-semibold"
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
                  className="w-full px-3 py-3 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm text-primary font-semibold"
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
                  className="w-full px-3 py-3 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm font-bold text-primary"
                >
                  <option value="7">7 Dias (Uso Intensivo / Curto Prazo)</option>
                  <option value="14">14 Dias (Prazo Padrão Estudante)</option>
                  <option value="21">21 Dias (Prazo Estendido Docente)</option>
                </select>
              </div>

              <footer className="pt-4 flex gap-3 border-t border-outline-variant/30 mt-6 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedUsuarioId('');
                    setSelectedMaterialId('');
                  }}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>Confirmar Empréstimo</span>
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
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
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs hidden sm:table-cell">Solicitado em</th>
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
                          <p 
                            onClick={() => res.usuario && setSelectedUsuarioForDetails(res.usuario)}
                            className="font-bold text-primary cursor-pointer hover:underline select-none"
                            title="Clique para ver ficha de cadastro do leitor"
                          >
                            {res.usuario?.nome_completo}
                          </p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                            Matrícula: {res.usuario?.matricula}
                          </p>
                        </td>

                        {/* Livro */}
                        <td className="px-6 py-4">
                          <p 
                            onClick={() => res.material && setSelectedMaterialForDetails(res.material)}
                            className="font-bold text-primary hover:underline cursor-pointer select-none line-clamp-1"
                            title="Clique para ver ficha técnica do livro"
                          >
                            {res.material?.titulo}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            Estoque: {res.material?.exemplares_disponiveis} / {res.material?.exemplares_total} exemplares
                          </p>
                        </td>

                        {/* Data Solicitação */}
                        <td className="px-6 py-4 text-on-surface-variant font-semibold hidden sm:table-cell">
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

      {/* MODAL DETALHES: Ficha de Cadastro do Leitor (Estática) */}
      {selectedUsuarioForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col">
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <span>Ficha de Cadastro do Leitor</span>
              </h3>
              <button 
                onClick={() => setSelectedUsuarioForDetails(null)}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer border-0 bg-transparent shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {errorMsg && (
                <div className="bg-error-container border border-error/20 p-3 rounded flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-on-error-container">{errorMsg}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Coluna Esquerda: Avatar e Tipo de Vínculo */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-3xl shadow-md border border-outline-variant/30 select-none">
                    {selectedUsuarioForDetails.nome_completo ? selectedUsuarioForDetails.nome_completo.substring(0, 2).toUpperCase() : 'LE'}
                  </div>
                  <span className="px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-bold uppercase tracking-wider">
                    {selectedUsuarioForDetails.tipo}
                  </span>
                </div>

                {/* Coluna Direita (2/3): Dados em Mono */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-5 shadow-inner font-mono text-xs text-on-surface relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full translate-x-8 -translate-y-8" />
                    
                    <div className="space-y-3 relative z-10">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-primary font-bold block mb-0.5">Nome Completo</span>
                        <span className="text-sm font-bold font-serif text-primary block leading-snug">{selectedUsuarioForDetails.nome_completo}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Matrícula / ID</span>
                          <span className="font-semibold">{selectedUsuarioForDetails.matricula}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Telefone</span>
                          <span className="font-semibold">{selectedUsuarioForDetails.telefone || 'Sem contato cadastrado'}</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Curso / Departamento</span>
                        <span className="font-semibold text-secondary">{selectedUsuarioForDetails.curso_departamento || 'Sem curso/departamento definido'}</span>
                      </div>

                      <div className="pt-1">
                        <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">E-mail Institucional</span>
                        <span className="font-semibold text-on-surface select-all">{selectedUsuarioForDetails.email}</span>
                      </div>

                      <hr className="border-outline-variant/30 my-2" />

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Status do Leitor</span>
                          <span className="text-[10px] text-on-surface-variant">Inativos são bloqueados de realizar empréstimos.</span>
                        </div>
                        <div>
                          {selectedUsuarioForDetails.status ? (
                            <span className="inline-flex items-center gap-1.5 bg-surface-container-high border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold">
                              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                              Conta Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-error-container border border-error/20 text-on-error-container px-3 py-1 rounded-full text-xs font-bold">
                              <span className="w-2 h-2 bg-secondary rounded-full" />
                              Conta Inativa
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-outline-variant/30 mt-6 select-none font-sans">
                <button
                  type="button"
                  onClick={() => setSelectedUsuarioForDetails(null)}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer text-center bg-white"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  disabled={updatingReaderId === selectedUsuarioForDetails.id}
                  onClick={() => handleToggleReaderStatus(selectedUsuarioForDetails.id, selectedUsuarioForDetails.status)}
                  className="flex-1 py-3 border border-secondary/30 text-secondary text-sm font-semibold rounded hover:bg-secondary/5 active:scale-[0.98] transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 bg-white"
                >
                  {updatingReaderId === selectedUsuarioForDetails.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  ) : selectedUsuarioForDetails.status ? (
                    <span>Bloquear Acesso</span>
                  ) : (
                    <span>Habilitar Acesso</span>
                  )}
                </button>
                <a
                  href={`/admin/usuarios?search=${selectedUsuarioForDetails.matricula}`}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow"
                >
                  <Edit className="w-4 h-4" />
                  <span>Ver no Diretório</span>
                </a>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES: Ficha Técnica do Livro (Estática) */}
      {selectedMaterialForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <span>Ficha Técnica do Livro / Material</span>
              </h3>
              <button 
                onClick={() => setSelectedMaterialForDetails(null)}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer border-0 bg-transparent shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {errorMsg && (
                <div className="bg-error-container border border-error/20 p-3 rounded flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-on-error-container">{errorMsg}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Coluna Esquerda: Capa e Acesso a PDF */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-[160px] aspect-[2/3] bg-surface-container-high rounded-lg overflow-hidden border border-outline-variant/30 shadow-md flex items-center justify-center text-primary relative group">
                    {selectedMaterialForDetails.capa_url ? (
                      <img src={selectedMaterialForDetails.capa_url} alt="Capa" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-12 h-12 opacity-35" />
                    )}
                  </div>

                  {selectedMaterialForDetails.pdf_url ? (
                    <a
                      href={selectedMaterialForDetails.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full max-w-[160px] flex items-center justify-center gap-2 bg-primary/10 text-primary text-xs font-bold py-2 px-3 rounded hover:bg-primary/20 transition-all text-center border border-primary/20 shadow-sm cursor-pointer font-sans"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>Visualizar PDF</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-on-surface-variant/60 italic font-medium">Sem anexo digital (PDF)</span>
                  )}
                </div>

                {/* Coluna Direita (2/3): Ficha Catalográfica / Registro Técnico */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-5 shadow-inner font-mono text-xs text-on-surface relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full translate-x-8 -translate-y-8" />
                    
                    <div className="space-y-3 relative z-10">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-primary font-bold block mb-0.5">Título Principal</span>
                        <span className="text-sm font-bold font-serif text-primary block leading-snug">{selectedMaterialForDetails.titulo}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Autor</span>
                          <span className="font-semibold">{selectedMaterialForDetails.autor || 'N/C'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">ISBN / Código</span>
                          <span className="font-semibold">{selectedMaterialForDetails.isbn || 'N/C'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Categoria</span>
                          <span className="font-semibold bg-surface-container px-1.5 py-0.5 rounded text-[10px]">{selectedMaterialForDetails.categoria || 'N/C'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Ano Pub.</span>
                          <span className="font-semibold">{selectedMaterialForDetails.ano || 'N/C'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Exemplares</span>
                          <span className="font-semibold">{selectedMaterialForDetails.exemplares_disponiveis} de {selectedMaterialForDetails.exemplares_total} disp.</span>
                        </div>
                      </div>

                      {selectedMaterialForDetails.curso && (
                        <div className="pt-1">
                          <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5">Curso Associado</span>
                          <span className="font-semibold text-secondary">{selectedMaterialForDetails.curso}</span>
                        </div>
                      )}

                      <hr className="border-outline-variant/30 my-2" />

                      {/* Ficha catalográfica expandida */}
                      <div className="space-y-2 text-[11px] leading-relaxed">
                        {selectedMaterialForDetails.numero_chamada && (
                          <div>
                            <span className="text-on-surface-variant">Classificação / Chamada: </span>
                            <span className="font-semibold">{selectedMaterialForDetails.numero_chamada}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.titulo_original && (
                          <div>
                            <span className="text-on-surface-variant">Título Original: </span>
                            <span className="font-semibold italic">{selectedMaterialForDetails.titulo_original}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.publicacao && (
                          <div>
                            <span className="text-on-surface-variant">Publicação: </span>
                            <span className="font-semibold">{selectedMaterialForDetails.publicacao}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.descricao_fisica && (
                          <div>
                            <span className="text-on-surface-variant">Descrição Física: </span>
                            <span className="font-semibold">{selectedMaterialForDetails.descricao_fisica}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.serie && (
                          <div>
                            <span className="text-on-surface-variant">Série / Coleção: </span>
                            <span className="font-semibold">{selectedMaterialForDetails.serie}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.prateleira && (
                          <div>
                            <span className="text-on-surface-variant">Localização / Prateleira: </span>
                            <span className="font-semibold">{selectedMaterialForDetails.prateleira}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.assuntos && (
                          <div>
                            <span className="text-on-surface-variant">Assuntos / Indexadores: </span>
                            <span className="font-semibold text-primary/90">{selectedMaterialForDetails.assuntos}</span>
                          </div>
                        )}

                        {selectedMaterialForDetails.notas && (
                          <div className="bg-surface p-2 rounded border border-outline-variant/20 mt-1 font-sans">
                            <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold block mb-0.5 font-mono">Notas Gerais</span>
                            <p className="font-normal italic leading-snug">{selectedMaterialForDetails.notas}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-outline-variant/30 mt-6 select-none font-sans">
                <button
                  type="button"
                  onClick={() => setSelectedMaterialForDetails(null)}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer text-center bg-white"
                >
                  Fechar
                </button>
                <a
                  href={`/admin/acervo?search=${selectedMaterialForDetails.titulo}`}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow"
                >
                  <Edit className="w-4 h-4" />
                  <span>Ver no Acervo</span>
                </a>
              </footer>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
