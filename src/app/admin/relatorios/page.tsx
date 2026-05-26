'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw, 
  User, 
  BookOpen, 
  Loader2,
  CalendarDays,
  Clock
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import AnimatedCounter from '@/components/AnimatedCounter';

export default function RelatoriosPage() {
  const supabase = createClient();

  // Estados de dados
  const [circulacoes, setCirculacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de filtragem (Mês inicializa no mês corrente, Ano no ano corrente)
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number | 'todos'>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'no_prazo' | 'atrasado'>('todos');

  // Carrega as circulações do Supabase com joins dos leitores e livros
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('circulacao')
        .select(`
          *,
          usuario:usuarios (nome_completo, matricula),
          material:acervo (titulo, autor)
        `)
        .order('data_emprestimo', { ascending: false });

      if (error) throw error;

      // Processamento dinâmico de multas e status de prazo
      const today = new Date();
      const processed = (data || []).map((loan: any) => {
        const prevDate = new Date(loan.data_devolucao_prevista);
        
        let prazoStatus: 'no_prazo' | 'atrasado' = 'no_prazo';
        let computedFine = Number(loan.multa_acumulada) || 0;

        if (loan.status === 'devolvido') {
          if (loan.data_devolucao_real) {
            const realDate = new Date(loan.data_devolucao_real);
            // Se devolvido após o prazo
            if (realDate > prevDate) {
              prazoStatus = 'atrasado';
            } else {
              prazoStatus = 'no_prazo';
            }
          } else {
            prazoStatus = 'no_prazo';
          }
        } else {
          // Empréstimo ativo (em andamento)
          if (today > prevDate) {
            prazoStatus = 'atrasado';
            // Calcula multa diária reativa baseada nas regras de negócios locais
            const diffTime = today.getTime() - prevDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
              const savedRate = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('rule_fine_per_day') || '2.00') : 2.00;
              computedFine = diffDays * savedRate;
            }
          } else {
            prazoStatus = 'no_prazo';
          }
        }

        const loanDate = new Date(loan.data_emprestimo);

        return {
          ...loan,
          prazoStatus,
          computedFine,
          loanMonth: loanDate.getMonth() + 1,
          loanYear: loanDate.getFullYear()
        };
      });

      setCirculacoes(processed);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados dos relatórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lista de anos disponíveis
  const yearsList = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  // Lista de meses em português
  const mesesNomes = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  // 1. Filtra primeiro por período de data para alimentar as métricas do painel Bento
  const filteredByDate = circulacoes.filter(item => {
    const matchYear = item.loanYear === Number(selectedYear);
    const matchMonth = selectedMonth === 'todos' || item.loanMonth === Number(selectedMonth);
    return matchYear && matchMonth;
  });

  // Cálculos reativos dos Cards Bento
  const totalRetiradas = filteredByDate.length;
  const compliantCount = filteredByDate.filter(item => item.prazoStatus === 'no_prazo').length;
  const complianceRate = totalRetiradas > 0 ? (compliantCount / totalRetiradas) * 100 : 100;
  const totalMultas = filteredByDate.reduce((sum, item) => sum + item.computedFine, 0);

  // 2. Filtra pela auditoria selecionada para renderizar na tabela
  const filteredFinal = filteredByDate.filter(item => {
    if (filterStatus === 'todos') return true;
    return item.prazoStatus === filterStatus;
  });

  // Função de exportação para CSV com codificação segura de acentuação (BOM UTF-8)
  const handleExportCSV = () => {
    if (filteredFinal.length === 0) return;

    const headers = [
      'Leitor',
      'Matrícula',
      'Material (Livro)',
      'Autor',
      'Data Empréstimo',
      'Prazo Limite (Previsto)',
      'Data Devolução Real',
      'Status Empréstimo',
      'Status do Prazo',
      'Multa Acumulada (R$)'
    ];

    const rows = filteredFinal.map(item => [
      item.usuario?.nome_completo || 'Desconhecido',
      item.usuario?.matricula || '-',
      item.material?.titulo || 'Material Excluído',
      item.material?.autor || '-',
      item.data_emprestimo ? formatDate(item.data_emprestimo) : '-',
      item.data_devolucao_prevista ? formatDate(item.data_devolucao_prevista) : '-',
      item.data_devolucao_real ? formatDate(item.data_devolucao_real) : 'Em aberto',
      item.status === 'devolvido' ? 'Devolvido' : item.status === 'atrasado' ? 'Atrasado' : 'Em andamento',
      item.prazoStatus === 'no_prazo' ? 'No Prazo' : 'Atrasado',
      item.computedFine.toFixed(2).replace('.', ',')
    ]);

    const csvContent = 
      '\uFEFF' + // UTF-8 BOM para abrir acentos de forma correta no Microsoft Excel
      [headers.join(';'), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const mesNome = selectedMonth === 'todos' 
      ? 'todos_meses' 
      : mesesNomes.find(m => m.value === selectedMonth)?.label.toLowerCase() || 'mes';

    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_inbook_${mesNome}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Aciona o diálogo nativo de impressão
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-on-surface-variant">Carregando dados dos relatórios...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-error-container/20 border border-error/30 rounded-xl text-center max-w-xl mx-auto my-8">
        <AlertTriangle className="w-12 h-12 text-error mx-auto mb-3" />
        <h3 className="text-lg font-bold text-primary mb-1">Erro de Carregamento</h3>
        <p className="text-sm text-on-surface-variant mb-4">{errorMsg}</p>
        <button onClick={loadData} className="px-4 py-2 bg-primary text-on-primary rounded-md font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all">
          Tentar Novamente
        </button>
      </div>
    );
  }

  const selectedMonthLabel = selectedMonth === 'todos' 
    ? 'Todos os Meses' 
    : mesesNomes.find(m => m.value === selectedMonth)?.label;

  return (
    <div className="w-full">
      {/* ==================== VISTA DA TELA (HIDDEN ON PRINT) ==================== */}
      <div className="print:hidden space-y-6">
        
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-5">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <BarChart3 className="w-6 h-6 shrink-0" />
              <h1 className="text-2xl font-serif font-bold tracking-tight">Relatórios & Auditoria</h1>
            </div>
            <p className="text-sm text-on-surface-variant">
              Fechamento mensal consolidado, análise de pontualidade de devoluções e multas.
            </p>
          </div>
          
          {/* Ações */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredFinal.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-high text-xs font-bold uppercase tracking-wider text-on-surface transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Exportar registros filtrados para formato CSV"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredByDate.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary shadow-sm hover:opacity-95 text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Visualizar folha A4 timbrada de impressão institucional"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Relatório</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros Rápidos */}
        <div className="bg-surface-container border border-outline-variant/35 p-5 rounded-xl flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          
          {/* Mês */}
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Mês de Referência
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              className="h-10 px-3 bg-surface border border-outline-variant/60 rounded-md text-sm font-semibold text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="todos">Todos os Meses</option>
              {mesesNomes.map(mes => (
                <option key={mes.value} value={mes.value}>{mes.label}</option>
              ))}
            </select>
          </div>

          {/* Ano */}
          <div className="w-full md:w-36 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
              Ano Letivo
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-10 px-3 bg-surface border border-outline-variant/60 rounded-md text-sm font-semibold text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Status do Prazo */}
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Cumprimento do Prazo
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="h-10 px-3 bg-surface border border-outline-variant/60 rounded-md text-sm font-semibold text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="todos">Todos os Status (Auditoria Completa)</option>
              <option value="no_prazo">No Prazo (Ativos e Concluídos)</option>
              <option value="atrasado">Atrasados / Multados</option>
            </select>
          </div>

          {/* Resetar Filtros */}
          <div className="flex items-end justify-end md:self-end">
            <button
              onClick={() => {
                setSelectedMonth(currentMonth);
                setSelectedYear(currentYear);
                setFilterStatus('todos');
              }}
              className="h-10 px-4 flex items-center justify-center gap-2 rounded-md border border-outline-variant/60 hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors cursor-pointer"
              title="Limpar seletores e voltar para o mês corrente"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="md:hidden lg:inline">Mês Atual</span>
            </button>
          </div>
        </div>

        {/* Bento Grid - Métricas Rápidas do Período */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Total de Retiradas */}
          <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary" />
                Retiradas Efetuadas
              </h3>
              <p className="font-serif text-5xl font-bold tracking-tight text-primary leading-none">
                <AnimatedCounter value={totalRetiradas} />
              </p>
              <p className="text-[11px] text-on-surface-variant font-sans">
                Empréstimos iniciados em <span className="font-semibold text-primary">{selectedMonthLabel} / {selectedYear}</span>.
              </p>
            </div>
            <BookOpen className="absolute -right-4 -bottom-4 w-28 h-28 opacity-[0.03] group-hover:scale-105 transition-transform duration-500 text-primary" />
          </div>

          {/* Card 2: Taxa de Prazos Cumpridos */}
          <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Taxa de Pontualidade
              </h3>
              <p className="font-serif text-5xl font-bold tracking-tight text-emerald-600 leading-none">
                <AnimatedCounter value={Math.round(complianceRate)} />%
              </p>
              
              {/* Mini barra de progresso premium */}
              <div className="space-y-1">
                <div className="w-full bg-outline-variant/30 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-700" 
                    style={{ width: `${complianceRate}%` }}
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant font-sans">
                  <span className="font-semibold text-emerald-600">{compliantCount}</span> de {totalRetiradas} sem nenhuma notificação de atraso.
                </p>
              </div>
            </div>
            <TrendingUp className="absolute -right-4 -bottom-4 w-28 h-28 opacity-[0.03] group-hover:scale-105 transition-transform duration-500 text-emerald-500" />
          </div>

          {/* Card 3: Volume de Multas Acumuladas */}
          <div className={`p-6 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group border transition-all duration-300 ${
            totalMultas > 0 
              ? 'bg-error-container/10 border-error/20' 
              : 'bg-surface-container border-outline-variant/30'
          }`}>
            <div className="relative z-10 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <DollarSign className={`w-4 h-4 ${totalMultas > 0 ? 'text-error animate-pulse' : 'text-primary'}`} />
                Receita de Multas
              </h3>
              <p className={`font-serif text-4xl font-bold tracking-tight leading-none ${totalMultas > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                {totalMultas > 0 ? (
                  <>
                    R$&nbsp;
                    <AnimatedCounter value={Math.floor(totalMultas)} />
                    ,
                    {(Math.round((totalMultas - Math.floor(totalMultas)) * 100)).toString().padStart(2, '0')}
                  </>
                ) : (
                  'R$ 0,00'
                )}
              </p>
              <p className="text-[11px] text-on-surface-variant font-sans">
                Multas ativas calculadas para pendências no período.
              </p>
            </div>
            <AlertTriangle className={`absolute -right-4 -bottom-4 w-28 h-28 opacity-[0.03] group-hover:scale-105 transition-transform duration-500 ${
              totalMultas > 0 ? 'text-error' : 'text-primary'
            }`} />
          </div>

        </div>

        {/* Tabela de Auditoria Analítica */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          
          {/* Header da Tabela */}
          <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-high">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
              Auditoria de Prazos do Período ({selectedMonthLabel} / {selectedYear})
            </h2>
            <span className="text-xs font-semibold text-on-surface-variant bg-surface px-2.5 py-1 rounded-full border border-outline-variant/40">
              {filteredFinal.length} {filteredFinal.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
                  <th className="px-6 py-4">Leitor</th>
                  <th className="px-6 py-4">Livro / Material</th>
                  <th className="px-6 py-4">Empréstimo</th>
                  <th className="px-6 py-4">Prazo Limite / Devolução</th>
                  <th className="px-6 py-4">Status Prazo</th>
                  <th className="px-6 py-4 text-right">Multa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-sm">
                {filteredFinal.map((item) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-surface-container-high/40 transition-colors"
                  >
                    {/* Leitor */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center shrink-0 border border-primary/10">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-primary">{item.usuario?.nome_completo || 'Leitor Excluído'}</p>
                          <p className="text-xs text-on-surface-variant font-bold">{item.usuario?.matricula || '-'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Livro */}
                    <td className="px-6 py-4 max-w-[240px] truncate">
                      <p className="font-semibold text-on-surface">{item.material?.titulo || 'Material Excluído'}</p>
                      <p className="text-xs text-on-surface-variant">por {item.material?.autor || 'Desconhecido'}</p>
                    </td>

                    {/* Empréstimo */}
                    <td className="px-6 py-4 text-on-surface-variant font-medium">
                      {formatDate(item.data_emprestimo)}
                    </td>

                    {/* Devolução / Prazo */}
                    <td className="px-6 py-4">
                      {item.status === 'devolvido' && item.data_devolucao_real ? (
                        <div>
                          <p className="text-on-surface font-medium">
                            Devolvido em {formatDate(item.data_devolucao_real)}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            Prazo: {formatDate(item.data_devolucao_prevista)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-primary">
                            Vence em {formatDate(item.data_devolucao_prevista)}
                          </p>
                          <p className="text-[10px] text-error font-bold uppercase tracking-wider">
                            {item.prazoStatus === 'atrasado' && 'Atrasado (Pendente)'}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Status do Prazo */}
                    <td className="px-6 py-4">
                      {item.prazoStatus === 'no_prazo' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/10">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          No Prazo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-error/10 text-error border border-error/10">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Atrasado
                        </span>
                      )}
                    </td>

                    {/* Multa */}
                    <td className="px-6 py-4 text-right">
                      {item.computedFine > 0 ? (
                        <span className="font-bold text-error">
                          {formatCurrency(item.computedFine)}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant opacity-40">-</span>
                      )}
                    </td>

                  </tr>
                ))}

                {filteredFinal.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                        <BarChart3 className="w-12 h-12 text-outline" />
                        <p className="text-sm font-semibold">Nenhum registro encontrado para este fechamento.</p>
                        <p className="text-xs">Tente ajustar o mês de referência ou o status da auditoria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* ==================== VISTA EXCLUSIVA DE IMPRESSÃO A4 (HIDDEN ON SCREEN) ==================== */}
      <div className="hidden print:block font-sans text-black bg-white p-4">
        
        {/* Cabeçalho do Relatório Timbrado */}
        <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              INBEC - Instituto Brasileiro de Educação Continuada
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Sistema de Controle de Biblioteca - INBOOK Library System
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Documento Oficial
            </span>
            <span className="text-sm font-bold text-slate-800">
              Relatório de Circulação e Auditoria
            </span>
          </div>
        </div>

        {/* Ficha Resumo do Período */}
        <div className="grid grid-cols-2 gap-6 text-xs mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="space-y-1">
            <p>
              <span className="font-bold text-slate-700">Período de Apuração:</span>{' '}
              <span className="font-semibold">{selectedMonthLabel} de {selectedYear}</span>
            </p>
            <p>
              <span className="font-bold text-slate-700">Filtro de Auditoria:</span>{' '}
              <span>
                {filterStatus === 'todos' 
                  ? 'Filtro Completo (Todos os registros)' 
                  : filterStatus === 'no_prazo' 
                  ? 'Apenas transações dentro do prazo' 
                  : 'Apenas transações em atraso / multadas'}
              </span>
            </p>
            <p>
              <span className="font-bold text-slate-700">Geração do Documento:</span>{' '}
              <span>
                {new Date().toLocaleDateString('pt-BR')} às{' '}
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          <div className="text-right space-y-1 border-l border-slate-200 pl-6">
            <p>
              <span className="font-bold text-slate-700">Total de Registros Emitidos:</span>{' '}
              <span className="font-semibold">{filteredFinal.length}</span>
            </p>
            <p>
              <span className="font-bold text-slate-700">Volume Total de Multas:</span>{' '}
              <span className="font-bold text-slate-900">{formatCurrency(totalMultas)}</span>
            </p>
            <p>
              <span className="font-bold text-slate-700">Índice Geral de Pontualidade:</span>{' '}
              <span className="font-bold text-emerald-700">{Math.round(complianceRate)}%</span>
            </p>
          </div>
        </div>

        {/* Cards Compactos de Performance para o PDF */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border border-slate-300 p-3 rounded text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
              Total de Retiradas
            </p>
            <p className="text-lg font-bold text-slate-800">{totalRetiradas}</p>
          </div>
          <div className="border border-slate-300 p-3 rounded text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
              Pontualidade de Entrega
            </p>
            <p className="text-lg font-bold text-emerald-700">{Math.round(complianceRate)}%</p>
          </div>
          <div className="border border-slate-300 p-3 rounded text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
              Receita de Multas Faturada
            </p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(totalMultas)}</p>
          </div>
        </div>

        {/* Tabela do PDF */}
        <table className="w-full text-[9px] text-left border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-bold text-slate-700">
              <th className="p-2.5 border-r border-slate-400">Leitor</th>
              <th className="p-2.5 border-r border-slate-400">Livro / Material</th>
              <th className="p-2.5 border-r border-slate-400">Empréstimo</th>
              <th className="p-2.5 border-r border-slate-400">Vencimento / Retorno</th>
              <th className="p-2.5 border-r border-slate-400">Status</th>
              <th className="p-2.5 text-right">Multa</th>
            </tr>
          </thead>
          <tbody>
            {filteredFinal.map((item) => (
              <tr key={item.id} className="border-b border-slate-300">
                <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                  {item.usuario?.nome_completo || 'Leitor Excluído'}
                  <div className="text-[7px] text-slate-500 font-bold">MAT: {item.usuario?.matricula || '-'}</div>
                </td>
                <td className="p-2 border-r border-slate-300">
                  {item.material?.titulo || 'Material Excluído'}
                  <div className="text-[7px] text-slate-500">por {item.material?.autor || 'Desconhecido'}</div>
                </td>
                <td className="p-2 border-r border-slate-300 text-slate-600">
                  {formatDate(item.data_emprestimo)}
                </td>
                <td className="p-2 border-r border-slate-300 text-slate-700">
                  {item.status === 'devolvido' && item.data_devolucao_real
                    ? `Devolvido em ${formatDate(item.data_devolucao_real)}`
                    : `Vence em ${formatDate(item.data_devolucao_prevista)}`
                  }
                </td>
                <td className="p-2 border-r border-slate-300 font-bold">
                  {item.prazoStatus === 'no_prazo' ? (
                    <span className="text-emerald-700">NO PRAZO</span>
                  ) : (
                    <span className="text-rose-700 font-bold">ATRASADO</span>
                  )}
                </td>
                <td className="p-2 text-right font-bold text-slate-900">
                  {item.computedFine > 0 ? formatCurrency(item.computedFine) : '-'}
                </td>
              </tr>
            ))}
            {filteredFinal.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">
                  Nenhum registro encontrado para este fechamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Rodapé de Assinatura e Homologação Oficial */}
        <div className="mt-20 grid grid-cols-2 gap-16 text-center text-[9px]">
          <div className="space-y-1">
            <div className="border-t border-slate-400 w-44 mx-auto mt-6"></div>
            <p className="font-bold text-slate-800">Assinatura Bibliotecário Responsável</p>
            <p className="text-slate-400 uppercase tracking-widest font-semibold text-[8px]">
              INBEC Biblioteca Geral
            </p>
          </div>
          <div className="space-y-1">
            <div className="border-t border-slate-400 w-44 mx-auto mt-6"></div>
            <p className="font-bold text-slate-800">Diretoria Acadêmica Homologante</p>
            <p className="text-slate-400 uppercase tracking-widest font-semibold text-[8px]">
              INBEC Instituto Credenciado
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
