'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Material } from '@/types';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  BookOpen, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

/**
 * Página de Gestão de Acervo.
 * Permite listar, filtrar, buscar e adicionar novos materiais ao catálogo
 * diretamente no banco de dados do Supabase.
 */
export default function AcervoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <AcervoPageContent />
    </Suspense>
  );
}

function AcervoPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Estados de dados
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newIsbn, setNewIsbn] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newCopies, setNewCopies] = useState('1');
  const [newShelf, setNewShelf] = useState('');

  // Estados de Edição e Imagem
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreviewUrl, setCapaPreviewUrl] = useState<string | null>(null);

  // Carrega materiais do Supabase
  const fetchMateriais = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('acervo')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMateriais(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar o acervo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMateriais();
  }, []);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  // Manipula mudança de arquivo de imagem (Capa)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Apenas arquivos de imagem são permitidos.');
      return;
    }

    // Valida tamanho (5 MB limite)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('O tamanho da imagem não deve exceder 5 MB.');
      return;
    }

    setCapaFile(file);
    setCapaPreviewUrl(URL.createObjectURL(file));
  };

  // Upload da capa no Supabase Storage
  const handleUploadCapa = async (file: File): Promise<string | null> => {
    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('capas-livros')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('capas-livros')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err: any) {
      console.error('Erro no upload da capa:', err);
      throw new Error(`Falha ao subir imagem: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // Cadastra ou edita material no banco (Unificado)
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const total = parseInt(newCopies, 10);
      if (isNaN(total) || total < 0) {
        throw new Error('O número de exemplares deve ser maior ou igual a zero.');
      }

      let uploadedCapaUrl = editingMaterial?.capa_url || null;

      // 1. Faz upload do arquivo se selecionado
      if (capaFile) {
        const url = await handleUploadCapa(capaFile);
        if (url) {
          uploadedCapaUrl = url;
        }
      }

      const materialData: any = {
        titulo: newTitle.trim(),
        autor: newAuthor.trim(),
        isbn: newIsbn.trim(),
        categoria: newCategory,
        ano: parseInt(newYear, 10),
        exemplares_total: total,
        prateleira: newShelf.trim() || null,
        capa_url: uploadedCapaUrl,
      };

      if (editingMaterial) {
        // 2A. MODO EDIÇÃO
        // Calcula a nova quantidade disponível de forma dinâmica
        const diff = total - editingMaterial.exemplares_total;
        const disponiveis = Math.max(0, editingMaterial.exemplares_disponiveis + diff);
        materialData.exemplares_disponiveis = disponiveis;

        const { error } = await supabase
          .from('acervo')
          .update(materialData)
          .eq('id', editingMaterial.id);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Já existe um material cadastrado com este ISBN.');
          }
          throw error;
        }
      } else {
        // 2B. MODO CRIAÇÃO
        materialData.exemplares_disponiveis = total;

        const { error } = await supabase
          .from('acervo')
          .insert([materialData]);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Já existe um material cadastrado com este ISBN.');
          }
          throw error;
        }
      }

      // Limpa formulário e fecha modal
      setNewTitle('');
      setNewAuthor('');
      setNewIsbn('');
      setNewCategory('');
      setNewYear('');
      setNewCopies('1');
      setNewShelf('');
      setCapaFile(null);
      setCapaPreviewUrl(null);
      setEditingMaterial(null);
      setIsModalOpen(false);

      // Recarrega listagem
      fetchMateriais();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar material.');
    } finally {
      setSubmitting(false);
    }
  };

  // Exclui fisicamente um material do acervo
  const handleDeleteMaterial = async (id: string) => {
    const confirmDelete = window.confirm('Tem certeza de que deseja remover este livro do acervo permanentemente?');
    if (!confirmDelete) return;

    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('acervo')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === '23503') {
          throw new Error('Não é possível excluir este livro pois existem empréstimos vinculados a ele.');
        }
        throw error;
      }

      fetchMateriais();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao excluir material.');
    }
  };

  // Prepara o formulário para edição
  const startEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setNewTitle(material.titulo);
    setNewAuthor(material.autor);
    setNewIsbn(material.isbn);
    setNewCategory(material.categoria);
    setNewYear(String(material.ano));
    setNewCopies(String(material.exemplares_total));
    setNewShelf(material.prateleira || '');
    setCapaFile(null);
    setCapaPreviewUrl(material.capa_url || null);
    setIsModalOpen(true);
  };

  // Filtros aplicados na listagem
  const filteredMateriais = materiais.filter((item) => {
    const matchesSearch = 
      item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.autor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.isbn.includes(searchTerm);
    
    const matchesCategory = selectedCategory ? item.categoria === selectedCategory : true;

    return matchesSearch && matchesCategory;
  });

  // Paginação
  const totalPages = Math.ceil(filteredMateriais.length / itemsPerPage) || 1;
  const paginatedMateriais = filteredMateriais.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Lista de categorias distintas para o filtro
  const categoriasDisponiveis = Array.from(
    new Set(materiais.map((item) => item.categoria))
  ).filter(Boolean);

  // Dados mockados ilustrativos para demonstrar layout se o banco estiver vazio
  const ilustrativos = [
    {
      id: '1',
      titulo: 'The Archetype of Wisdom',
      autor: 'Dr. Elena Rostova',
      isbn: '978-3-16-148410-0',
      categoria: 'Filosofia',
      exemplares_disponiveis: 1,
      exemplares_total: 1,
      prateleira: 'Prateleira: A-102'
    },
    {
      id: '2',
      titulo: 'Quantum Linguistics',
      autor: 'Marcus Thorne',
      isbn: '978-0-262-13451-4',
      categoria: 'Ciência',
      exemplares_disponiveis: 0,
      exemplares_total: 2,
      prateleira: 'Prateleira: C-404'
    },
    {
      id: '3',
      titulo: 'Medieval Cartography',
      autor: 'Prof. Julian Sorel',
      isbn: '978-1-59420-229-2',
      categoria: 'História',
      exemplares_disponiveis: 5,
      exemplares_total: 5,
      prateleira: 'Ref.- R-002'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-bold text-primary">Gestão de Acervo</h2>
          <p className="text-sm text-on-surface-variant font-sans">
            Registro central de livros, ativos e volumes institucionais.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Novo Item</span>
        </button>
      </header>

      {/* Painel de Busca e Filtros */}
      <section className="flex flex-col md:flex-row gap-4 items-center bg-surface-container/20 p-4 border border-outline-variant/30 rounded-lg">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar por título, autor ou ISBN..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary transition-all"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          {/* Seletor de Categoria */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 md:flex-initial py-2 px-3 border border-outline-variant bg-white text-sm rounded-md focus:outline-none focus:border-primary"
          >
            <option value="">Todas as Categorias</option>
            {categoriasDisponiveis.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            {/* Fallbacks estéticos caso não haja nada cadastrado */}
            {categoriasDisponiveis.length === 0 && (
              <>
                <option value="Filosofia">Filosofia</option>
                <option value="Ciência">Ciência</option>
                <option value="História">História</option>
                <option value="Literatura">Literatura</option>
              </>
            )}
          </select>

          <button className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer">
            <Download className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </section>

      {/* Tabela de Dados */}
      <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Título</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Autor</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">ISBN</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs">Categoria</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-center">Disponíveis</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 font-semibold">Carregando acervo do Supabase...</p>
                  </td>
                </tr>
              ) : materiais.length > 0 ? (
                paginatedMateriais.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-12 bg-surface-container-high rounded-sm flex items-center justify-center text-primary border border-outline-variant/30 overflow-hidden shrink-0">
                          {item.capa_url ? (
                            <img src={item.capa_url} alt="Capa" className="w-full h-full object-cover" />
                          ) : (
                            <BookOpen className="w-4 h-4 opacity-50" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-primary line-clamp-1">{item.titulo}</p>
                          <p className="text-[10px] text-on-surface-variant italic">
                            {item.prateleira || 'Sem prateleira definida'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface">{item.autor}</td>
                    <td className="px-6 py-4 text-on-surface-variant font-mono text-xs">{item.isbn}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-xs font-bold">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.exemplares_disponiveis > 0 ? 'bg-primary' : 'bg-secondary'
                        }`} />
                        <span className="font-semibold text-xs">
                          {item.exemplares_disponiveis} de {item.exemplares_total}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => startEditMaterial(item)}
                          className="text-on-surface-variant hover:text-primary p-1.5 rounded transition-colors cursor-pointer hover:bg-surface-container-low"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(item.id)}
                          className="text-on-surface-variant hover:text-secondary p-1.5 rounded transition-colors cursor-pointer hover:bg-surface-container-low"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                // Fallback de dados ilustrativos caso o banco esteja limpo, para manter apelo premium
                ilustrativos.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container/10 transition-colors select-none">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-12 bg-surface-container-high rounded-sm flex items-center justify-center text-primary border border-outline-variant/30">
                          <BookOpen className="w-4 h-4 opacity-50" />
                        </div>
                        <div>
                          <p className="font-bold text-primary">{item.titulo}</p>
                          <p className="text-[10px] text-on-surface-variant italic">{item.prateleira}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface">{item.autor}</td>
                    <td className="px-6 py-4 text-on-surface-variant font-mono text-xs">{item.isbn}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-xs font-bold">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.exemplares_disponiveis > 0 ? 'bg-primary' : 'bg-secondary'
                        }`} />
                        <span className="font-semibold text-xs">
                          {item.exemplares_disponiveis} de {item.exemplares_total}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-on-surface-variant hover:text-primary p-1.5 rounded-full transition-colors cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação do Rodapé */}
        <div className="px-6 py-4 bg-surface-container-low flex justify-between items-center border-t border-outline-variant/40">
          <p className="text-xs text-on-surface-variant font-semibold">
            Exibindo {filteredMateriais.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, filteredMateriais.length)} de {filteredMateriais.length || ilustrativos.length} entradas
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

      {/* MODAL: Adicionar/Editar Livro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col">
            
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary">
                {editingMaterial ? 'Editar Material' : 'Cadastrar Novo Material'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingMaterial(null);
                  setNewTitle('');
                  setNewAuthor('');
                  setNewIsbn('');
                  setNewCategory('');
                  setNewYear('');
                  setNewCopies('1');
                  setNewShelf('');
                  setCapaFile(null);
                  setCapaPreviewUrl(null);
                  setErrorMsg(null);
                }}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleSaveMaterial} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              {errorMsg && (
                <div className="bg-error-container border border-error/20 p-3 rounded flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-on-error-container">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Título do Livro</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: O Nome da Rosa"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Autor</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">ISBN</label>
                  <input
                    type="text"
                    required
                    placeholder="978-0000000000"
                    value={newIsbn}
                    onChange={(e) => setNewIsbn(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Categoria</label>
                  <select
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="Filosofia">Filosofia</option>
                    <option value="Ciência">Ciência</option>
                    <option value="História">História</option>
                    <option value="Literatura">Literatura</option>
                    <option value="Tecnologia">Tecnologia</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Ano de Pub.</label>
                  <input
                    type="number"
                    required
                    placeholder="AAAA"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Exemplares</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newCopies}
                    onChange={(e) => setNewCopies(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Localização na Prateleira</label>
                <input
                  type="text"
                  placeholder="Ex: Prateleira B-201"
                  value={newShelf}
                  onChange={(e) => setNewShelf(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                />
              </div>

              {/* Upload de Capa do Livro */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Capa do Livro</label>
                <div className="flex gap-4 items-center">
                  {/* Preview Container */}
                  <div className="w-16 h-24 bg-surface-container border border-outline-variant/30 rounded flex items-center justify-center text-primary overflow-hidden shrink-0 shadow-sm">
                    {capaPreviewUrl ? (
                      <img src={capaPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 opacity-30 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <input
                        type="file"
                        id="capa-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="capa-upload"
                        className="flex items-center justify-center gap-2 border border-outline text-primary text-xs font-semibold py-2 px-3 rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer shadow-sm w-max"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{capaPreviewUrl ? 'Alterar Imagem' : 'Selecionar Capa'}</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-on-surface-variant italic leading-normal">
                      PNG, JPG ou WEBP. Tamanho máximo recomendado de 5MB.
                    </p>
                    {capaPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCapaFile(null);
                          setCapaPreviewUrl(null);
                        }}
                        className="text-[10px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Remover Capa</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <footer className="pt-4 flex gap-3 border-t border-outline-variant/30 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingMaterial(null);
                    setNewTitle('');
                    setNewAuthor('');
                    setNewIsbn('');
                    setNewCategory('');
                    setNewYear('');
                    setNewCopies('1');
                    setNewShelf('');
                    setCapaFile(null);
                    setCapaPreviewUrl(null);
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingFile}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadingFile ? 'Enviando Capa...' : 'Salvando...'}</span>
                    </>
                  ) : (
                    <span>{editingMaterial ? 'Salvar Alterações' : 'Salvar no Acervo'}</span>
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
