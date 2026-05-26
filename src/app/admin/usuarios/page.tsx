'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Usuario, UserType } from '@/types';
import { 
  Search, 
  Plus, 
  User, 
  Edit, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  Info,
  Settings
} from 'lucide-react';
import AnimatedCounter from '@/components/AnimatedCounter';

/**
 * Página de Gestão de Usuários (Diretório de Leitores).
 * Permite listar, filtrar, buscar, cadastrar novos membros e alterar
 * instantaneamente o status do leitor (Ativo/Inativo) no Supabase.
 */
export default function UsuariosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <UsuariosPageContent />
    </Suspense>
  );
}

function UsuariosPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Estados de dados
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [newName, setNewName] = useState('');
  const [newMatricula, setNewMatricula] = useState('');
  const [newType, setNewType] = useState<UserType>('estudante');
  const [newDepartment, setNewDepartment] = useState('');
  const [newEmail, setNewEmail] = useState(''); // Armazena apenas o prefixo
  const [newPhone, setNewPhone] = useState('');
  const [newStatus, setNewStatus] = useState(true);

  const resetForm = () => {
    setNewName('');
    setNewMatricula('');
    setNewType('estudante');
    setNewDepartment('');
    setNewEmail('');
    setNewPhone('');
    setNewStatus(true);
    setEditingUsuario(null);
  };

  const startEditUsuario = (user: Usuario) => {
    setEditingUsuario(user);
    setNewName(user.nome_completo);
    setNewMatricula(user.matricula);
    setNewType(user.tipo);
    setNewDepartment(user.curso_departamento || '');
    
    // Extrai apenas o prefixo do e-mail
    const prefix = user.email.split('@')[0];
    setNewEmail(prefix);
    
    setNewPhone(user.telefone || '');
    setNewStatus(user.status);
    setIsModalOpen(true);
  };

  // Estados das Regras Configuráveis (localStorage com fallbacks padrão)
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  
  const [ruleStudBooks, setRuleStudBooks] = useState('3');
  const [ruleStudDays, setRuleStudDays] = useState('14');
  const [ruleDocBooks, setRuleDocBooks] = useState('5');
  const [ruleDocDays, setRuleDocDays] = useState('21');
  const [ruleFinePerDay, setRuleFinePerDay] = useState('2.00');

  // Estados Temporários do Modal de Regras
  const [tempStudBooks, setTempStudBooks] = useState('3');
  const [tempStudDays, setTempStudDays] = useState('14');
  const [tempDocBooks, setTempDocBooks] = useState('5');
  const [tempDocDays, setTempDocDays] = useState('21');
  const [tempFinePerDay, setTempFinePerDay] = useState('2.00');

  // Efeito para carregar as regras salvas
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sb = localStorage.getItem('rule_stud_books') || '3';
      const sd = localStorage.getItem('rule_stud_days') || '14';
      const db = localStorage.getItem('rule_doc_books') || '5';
      const dd = localStorage.getItem('rule_doc_days') || '21';
      const fd = localStorage.getItem('rule_fine_per_day') || '2.00';

      setRuleStudBooks(sb);
      setRuleStudDays(sd);
      setRuleDocBooks(db);
      setRuleDocDays(dd);
      setRuleFinePerDay(fd);

      setTempStudBooks(sb);
      setTempStudDays(sd);
      setTempDocBooks(db);
      setTempDocDays(dd);
      setTempFinePerDay(fd);
    }
  }, []);

  // Carrega usuários do Supabase
  const fetchUsuarios = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      resetForm();
      setIsModalOpen(true);
    }
  }, [searchParams]);

  // Cadastra ou edita o leitor no Supabase
  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Formata o e-mail anexando o domínio institucional obrigatoriamente
      const fullEmail = `${newEmail.trim().toLowerCase()}@inbec.edu.br`;

      if (editingUsuario) {
        // Modo de Edição
        const { error } = await supabase
          .from('usuarios')
          .update({
            nome_completo: newName.trim(),
            matricula: newMatricula.trim(),
            tipo: newType,
            curso_departamento: newDepartment.trim() || null,
            email: fullEmail,
            telefone: newPhone.trim() || null,
            status: newStatus,
          })
          .eq('id', editingUsuario.id);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Matrícula ou E-mail já cadastrado no sistema.');
          }
          throw error;
        }

        setSuccessMsg('Perfil do leitor atualizado com sucesso!');
      } else {
        // Modo de Cadastro
        const randomUuid = crypto.randomUUID();

        const { error } = await supabase
          .from('usuarios')
          .insert([
            {
              id: randomUuid,
              nome_completo: newName.trim(),
              matricula: newMatricula.trim(),
              tipo: newType,
              curso_departamento: newDepartment.trim() || null,
              email: fullEmail,
              telefone: newPhone.trim() || null,
              status: newStatus,
            }
          ]);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Matrícula ou E-mail já cadastrado no sistema.');
          }
          throw error;
        }

        setSuccessMsg('Leitor cadastrado com sucesso!');
      }
      
      // Limpa formulário e fecha modal
      resetForm();
      setIsModalOpen(false);

      // Recarrega listagem
      fetchUsuarios();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar leitor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Alterna o status (Ativo/Inativo) de um leitor
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setUpdatingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ status: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      // Atualiza estado local de forma otimista
      setUsuarios((prev) =>
        prev.map((user) => (user.id === id ? { ...user, status: !currentStatus } : user))
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtros aplicados na listagem
  const filteredUsuarios = usuarios.filter((user) => {
    // 1. Filtro textual por Nome, Matrícula ou E-mail
    const matchesSearch = 
      user.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filtro dinâmico por Tipo de Vínculo
    const matchesType = !selectedType || user.tipo === selectedType;

    // 3. Filtro dinâmico por Curso / Departamento
    let matchesCourse = true;
    if (selectedCourse) {
      if (selectedCourse === 'ADS') {
        matchesCourse = 
          user.curso_departamento === 'Análise e Des. de Sistemas' || 
          user.curso_departamento === 'Análise e Desenvolvimento de Sistemas (ADS)';
      } else {
        matchesCourse = user.curso_departamento === selectedCourse;
      }
    }

    return matchesSearch && matchesType && matchesCourse;
  });

  // Estatísticas Rápidas (inicializadas em 0 e atualizadas de forma reativa)
  const totalMembros = usuarios.length;
  const totalEstudantes = usuarios.filter((u) => u.tipo === 'estudante').length;
  const totalDocentes = usuarios.filter((u) => u.tipo === 'docente').length;

  // Paginação
  const totalPages = Math.ceil(filteredUsuarios.length / itemsPerPage) || 1;
  const paginatedUsuarios = filteredUsuarios.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );



  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-bold text-primary">Gestão de Usuários</h2>
          <p className="text-sm text-on-surface-variant font-sans">
            Diretório de controle de cadastro de estudantes, docentes e funcionários.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Leitor</span>
        </button>
      </header>

      {/* Estatísticas Rápidas (Bento Style Lite) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-surface-container-low border border-outline-variant/20 p-5 rounded-xl flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Total de Leitores</span>
          <span className="font-serif text-3xl font-bold text-primary">
            <AnimatedCounter value={totalMembros} />
          </span>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/20 p-5 rounded-xl flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Alunos Ativos</span>
          <span className="font-serif text-3xl font-bold text-primary">
            <AnimatedCounter value={totalEstudantes} />
          </span>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/20 p-5 rounded-xl flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Docentes / Servidores</span>
          <span className="font-serif text-3xl font-bold text-primary">
            <AnimatedCounter value={totalDocentes} />
          </span>
        </div>
      </section>

      {/* Filtros e Pesquisa */}
      <section className="flex flex-col md:flex-row gap-4 items-center bg-surface-container/20 p-4 border border-outline-variant/30 rounded-lg">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar leitores por nome, matrícula ou e-mail..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          {/* Seletor de Vínculo */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 md:flex-initial py-2 px-3 border border-outline-variant bg-white text-sm rounded-md focus:outline-none focus:border-primary"
          >
            <option value="">Todos os Vínculos</option>
            <option value="estudante">Alunos</option>
            <option value="docente">Docentes</option>
            <option value="funcionario">Funcionários</option>
          </select>

          {/* Seletor de Curso / Departamento */}
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 md:flex-initial py-2 px-3 border border-outline-variant bg-white text-sm rounded-md focus:outline-none focus:border-primary"
          >
            <option value="">Todos os Cursos</option>
            <option value="ADS">ADS</option>
            <option value="Engenharia de Software">Eng. Software</option>
            <option value="Engenharia Civil">Eng. Civil</option>
            <option value="Direito">Direito</option>
            <option value="Departamento de TI">Dep. TI</option>
            <option value="Departamento de Engenharia">Dep. Engenharia</option>
            <option value="Ciência da Computação">Ciência da Computação</option>
          </select>
        </div>
      </section>

      {/* Tabela de Usuários */}
      <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Leitor</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">ID/Matrícula</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Curso / Departamento</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">E-mail</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-center">Status</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 font-semibold">Carregando diretório de leitores...</p>
                  </td>
                </tr>
              ) : usuarios.length > 0 ? (
                paginatedUsuarios.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-container/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shadow-sm">
                          {user.nome_completo.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-primary">{user.nome_completo}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                            {user.tipo}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface font-semibold">{user.matricula}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{user.curso_departamento || 'Sem curso'}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{user.email}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        disabled={updatingId === user.id}
                        className="inline-flex items-center justify-center gap-1.5 focus:outline-none disabled:opacity-50 cursor-pointer"
                        title={user.status ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        {updatingId === user.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : user.status ? (
                          <span className="inline-flex items-center gap-1 bg-surface-container-high border border-primary/20 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-error-container border border-error/20 text-on-error-container px-2.5 py-0.5 rounded-full text-xs font-bold">
                            <span className="w-1.5 h-1.5 bg-secondary rounded-full" />
                            Inativo
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => startEditUsuario(user)}
                          className="p-1.5 border border-outline text-primary rounded hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
                          title="Editar Perfil"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant font-semibold">
                    <User className="w-8 h-8 mx-auto text-primary/40 mb-2" />
                    <p>Nenhum usuário cadastrado.</p>
                    <p className="text-xs font-normal opacity-70 mt-1">Os leitores acadêmicos serão exibidos aqui à medida que logarem ou se registrarem na biblioteca.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="px-6 py-4 bg-surface-container-low flex justify-between items-center border-t border-outline-variant/40">
          <p className="text-xs text-on-surface-variant font-semibold">
            Exibindo {filteredUsuarios.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, filteredUsuarios.length)} de {filteredUsuarios.length} entradas
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors cursor-pointer mr-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded text-xs font-bold transition-all cursor-pointer ${
                  currentPage === page
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'border border-outline-variant hover:bg-surface-container-high text-primary'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors cursor-pointer ml-1"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Regras de Acesso e Limites de Empréstimo Editáveis */}
      <section className="bg-surface-container-low p-5 border border-outline-variant/20 rounded-lg flex items-start gap-4 select-none relative">
        <Info className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-primary">Regras de Acesso e Limites de Empréstimo</h4>
            <button
              onClick={() => {
                // Abre o modal de edição das regras
                setIsRulesModalOpen(true);
              }}
              className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Configurar Regras de Empréstimo"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <ul className="text-xs text-on-surface-variant space-y-1 list-disc pl-4 font-sans">
            <li>Alunos de Graduação/Estudantes podem retirar até **{ruleStudBooks} livros** simultâneos por até {ruleStudDays} dias.</li>
            <li>Professores/Docentes possuem limite estendido de até **{ruleDocBooks} livros** simultâneos por até {ruleDocDays} dias.</li>
            <li>Leitores inativos ou com multas ativas pendentes não podem realizar novas retiradas.</li>
            <li>A taxa de multa padrão para entregas em atraso é de **R$ {Number(ruleFinePerDay).toFixed(2)} por dia**.</li>
          </ul>
        </div>
      </section>

      {/* MODAL: Configurar Regras de Empréstimo */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col">
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <span>Configurações do Sistema</span>
              </h3>
              <button 
                onClick={() => setIsRulesModalOpen(false)}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-6 space-y-4">
              <div className="border-b border-outline-variant/30 pb-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Regras de Alunos / Estudantes</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Limite de Livros</label>
                  <input
                    type="number"
                    min="1"
                    value={tempStudBooks}
                    onChange={(e) => setTempStudBooks(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Prazo (Dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={tempStudDays}
                    onChange={(e) => setTempStudDays(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center"
                  />
                </div>
              </div>

              <div className="border-b border-outline-variant/30 pb-2 pt-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Regras de Professores / Docentes</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Limite de Livros</label>
                  <input
                    type="number"
                    min="1"
                    value={tempDocBooks}
                    onChange={(e) => setTempDocBooks(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Prazo (Dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={tempDocDays}
                    onChange={(e) => setTempDocDays(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center"
                  />
                </div>
              </div>

              <div className="border-b border-outline-variant/30 pb-2 pt-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Configuração Financeira</h4>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Multa por Dia de Atraso (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tempFinePerDay}
                  onChange={(e) => setTempFinePerDay(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <footer className="pt-4 flex gap-3 border-t border-outline-variant/30 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    // Descarta as alterações temporárias
                    setTempStudBooks(ruleStudBooks);
                    setTempStudDays(ruleStudDays);
                    setTempDocBooks(ruleDocBooks);
                    setTempDocDays(ruleDocDays);
                    setTempFinePerDay(ruleFinePerDay);
                    setIsRulesModalOpen(false);
                  }}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Grava as alterações no localStorage e atualiza o estado
                    localStorage.setItem('rule_stud_books', tempStudBooks);
                    localStorage.setItem('rule_stud_days', tempStudDays);
                    localStorage.setItem('rule_doc_books', tempDocBooks);
                    localStorage.setItem('rule_doc_days', tempDocDays);
                    localStorage.setItem('rule_fine_per_day', tempFinePerDay);

                    setRuleStudBooks(tempStudBooks);
                    setRuleStudDays(tempStudDays);
                    setRuleDocBooks(tempDocBooks);
                    setRuleDocDays(tempDocDays);
                    setRuleFinePerDay(tempFinePerDay);

                    setSuccessMsg('Regras do sistema salvas com sucesso!');
                    setIsRulesModalOpen(false);

                    setTimeout(() => {
                      setSuccessMsg(null);
                    }, 4000);
                  }}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer shadow"
                >
                  Salvar Regras
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cadastrar / Editar Leitor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col">
            
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary">
                {editingUsuario ? 'Editar Perfil do Leitor' : 'Cadastrar Novo Leitor'}
              </h3>
              <button 
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleSaveUsuario} className="p-6 space-y-4">
              {errorMsg && (
                <div className="bg-error-container border border-error/20 p-3 rounded flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-on-error-container">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva Santos"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Matrícula / ID</label>
                  <input
                    type="text"
                    required
                    placeholder="2024.1.0001"
                    value={newMatricula}
                    onChange={(e) => setNewMatricula(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tipo de Vínculo</label>
                  <select
                    required
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as UserType)}
                    className="w-full px-3 py-2 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm"
                  >
                    <option value="estudante">Estudante (Graduação)</option>
                    <option value="docente">Professor / Docente</option>
                    <option value="funcionario">Funcionário / Técnico</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Curso / Departamento</label>
                <select
                  required
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm text-primary"
                >
                  <option value="" disabled>Selecione seu Curso / Departamento</option>
                  <option value="Análise e Desenvolvimento de Sistemas (ADS)">Análise e Desenvolvimento de Sistemas (ADS)</option>
                  <option value="Engenharia de Software">Engenharia de Software</option>
                  <option value="Engenharia Civil">Engenharia Civil</option>
                  <option value="Direito">Direito</option>
                  <option value="Multidisciplinar / Geral">Multidisciplinar / Geral</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">E-mail Institucional</label>
                  <div className="flex items-stretch">
                    <input
                      type="text"
                      required
                      placeholder="Ex: joao.silva"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 h-9 px-3 border border-outline-variant rounded-l focus:outline-none focus:border-primary text-sm min-w-0"
                    />
                    <span className="bg-surface-container-high text-on-surface-variant px-3 border border-l-0 border-outline-variant rounded-r text-xs font-bold font-mono flex items-center justify-center shrink-0 select-none">
                      @inbec.edu.br
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Telefone de Contato</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-outline-variant/30 my-4 select-none">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Status Inicial da Conta</p>
                  <p className="text-[10px] text-on-surface-variant">Usuários inativos não podem efetuar empréstimos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewStatus(!newStatus)}
                  className="text-primary hover:opacity-85 transition-opacity focus:outline-none cursor-pointer"
                >
                  {newStatus ? (
                    <ToggleRight className="w-10 h-10 text-primary" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-on-surface-variant/40" />
                  )}
                </button>
              </div>

              <footer className="pt-4 flex gap-3 border-t border-outline-variant/30 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{editingUsuario ? 'Salvar Alterações' : 'Cadastrar Leitor'}</span>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
