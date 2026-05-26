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
  Image as ImageIcon,
  FileText
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
  const [isDocumentMode, setIsDocumentMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newIsbn, setNewIsbn] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newCopies, setNewCopies] = useState('1');
  const [newShelf, setNewShelf] = useState('');

  // Novos Estados de Catalogação
  const [newCurso, setNewCurso] = useState('Multidisciplinar / Geral');
  const [newNumeroChamada, setNewNumeroChamada] = useState('');
  const [newTituloOriginal, setNewTituloOriginal] = useState('');
  const [newPublicacao, setNewPublicacao] = useState('');
  const [newDescricaoFisica, setNewDescricaoFisica] = useState('');
  const [newSerie, setNewSerie] = useState('');
  const [newNotas, setNewNotas] = useState('');
  const [newAssuntos, setNewAssuntos] = useState('');

  // Estados de Edição e Imagem/PDF
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreviewUrl, setCapaPreviewUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Filtro por Curso na Tabela
  const [selectedCourse, setSelectedCourse] = useState('');

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

  // Manipula mudança de arquivo PDF
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setErrorMsg('Apenas arquivos PDF são permitidos.');
      return;
    }

    // Valida tamanho (20 MB limite)
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('O tamanho do documento PDF não deve exceder 20 MB.');
      return;
    }

    setPdfFile(file);
  };

  // Upload do PDF no Supabase Storage
  const handleUploadPdf = async (file: File): Promise<string | null> => {
    setUploadingPdf(true);
    try {
      const fileName = `${crypto.randomUUID()}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos-academicos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documentos-academicos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err: any) {
      console.error('Erro no upload do PDF:', err);
      throw new Error(`Falha ao subir PDF: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setUploadingPdf(false);
    }
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
      let uploadedPdfUrl = pdfUrl;

      // 1. Faz upload da capa se selecionada
      if (capaFile) {
        const url = await handleUploadCapa(capaFile);
        if (url) {
          uploadedCapaUrl = url;
        }
      }

      // 2. Faz upload do PDF se selecionado
      if (pdfFile) {
        const url = await handleUploadPdf(pdfFile);
        if (url) {
          uploadedPdfUrl = url;
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
        pdf_url: uploadedPdfUrl,
        curso: newCurso,
        numero_chamada: newNumeroChamada.trim() || null,
        titulo_original: newTituloOriginal.trim() || null,
        publicacao: newPublicacao.trim() || null,
        descricao_fisica: newDescricaoFisica.trim() || null,
        serie: newSerie.trim() || null,
        notas: newNotas.trim() || null,
        assuntos: newAssuntos.trim() || null,
      };

      if (editingMaterial) {
        // 3A. MODO EDIÇÃO
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
        // 3B. MODO CRIAÇÃO
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
      setNewCurso('Multidisciplinar / Geral');
      setNewNumeroChamada('');
      setNewTituloOriginal('');
      setNewPublicacao('');
      setNewDescricaoFisica('');
      setNewSerie('');
      setNewNotas('');
      setNewAssuntos('');
      setCapaFile(null);
      setCapaPreviewUrl(null);
      setPdfFile(null);
      setPdfUrl(null);
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
    
    // Novos campos
    setNewCurso(material.curso || 'Multidisciplinar / Geral');
    setNewNumeroChamada(material.numero_chamada || '');
    setNewTituloOriginal(material.titulo_original || '');
    setNewPublicacao(material.publicacao || '');
    setNewDescricaoFisica(material.descricao_fisica || '');
    setNewSerie(material.serie || '');
    setNewNotas(material.notas || '');
    setNewAssuntos(material.assuntos || '');
    setCapaFile(null);
    setCapaPreviewUrl(material.capa_url || null);
    setPdfFile(null);
    setPdfUrl(material.pdf_url || null);
    
    // Define se é documento
    const isDoc = ['Monografia', 'TCC', 'Artigo Científico', 'Dissertação', 'Relatório Técnico'].includes(material.categoria);
    setIsDocumentMode(isDoc);
    
    setIsModalOpen(true);
  };

  // Filtros aplicados na listagem
  const filteredMateriais = materiais.filter((item) => {
    const matchesSearch = 
      item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.autor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.isbn.includes(searchTerm) ||
      (item.assuntos && item.assuntos.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.numero_chamada && item.numero_chamada.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory ? item.categoria === selectedCategory : true;
    const matchesCourse = selectedCourse ? item.curso === selectedCourse : true;

    return matchesSearch && matchesCategory && matchesCourse;
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
        <div className="flex gap-3">
          <button
            onClick={() => {
              setIsDocumentMode(true);
              setNewCategory('Monografia');
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 border border-primary text-primary hover:bg-primary/5 px-5 py-3 rounded text-sm font-semibold active:scale-95 transition-all shadow-sm cursor-pointer bg-white"
          >
            <FileText className="w-4 h-4" />
            <span>Novo Documento</span>
          </button>
          <button
            onClick={() => {
              setIsDocumentMode(false);
              setNewCategory('');
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Novo Livro</span>
          </button>
        </div>
      </header>

      {/* Painel de Busca e Filtros */}
      <section className="flex flex-col md:flex-row gap-4 items-center bg-surface-container/20 p-4 border border-outline-variant/30 rounded-lg">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar por título, autor, assunto, chamada..."
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
                <option value="Monografia">Monografia</option>
                <option value="TCC">TCC</option>
                <option value="Artigo Científico">Artigo Científico</option>
                <option value="Dissertação">Dissertação</option>
                <option value="Relatório Técnico">Relatório Técnico</option>
              </>
            )}
          </select>

          {/* Seletor de Curso */}
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 md:flex-initial py-2 px-3 border border-outline-variant bg-white text-sm rounded-md focus:outline-none focus:border-primary"
          >
            <option value="">Todos os Cursos</option>
            <option value="Multidisciplinar / Geral">Multidisciplinar / Geral</option>
            <option value="Análise e Desenvolvimento de Sistemas (ADS)">ADS</option>
            <option value="Engenharia de Software">Eng. Software</option>
            <option value="Engenharia Civil">Eng. Civil</option>
            <option value="Direito">Direito</option>
          </select>
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
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-primary line-clamp-1">{item.titulo}</p>
                            {item.pdf_url && (
                              <a 
                                href={item.pdf_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors shrink-0"
                                title="Visualizar PDF"
                              >
                                <FileText className="w-3 h-3" />
                                <span>PDF</span>
                              </a>
                            )}
                          </div>
                          <p className="text-[10px] text-on-surface-variant italic">
                            {item.numero_chamada ? `Chamada: ${item.numero_chamada}` : (item.prateleira || 'Sem localização definida')}
                          </p>
                          {item.curso && item.curso !== 'Multidisciplinar / Geral' && (
                            <span className="text-[9px] bg-secondary/10 text-secondary font-bold px-1 rounded shrink-0">
                              {item.curso.split(' (')[0]}
                            </span>
                          )}
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
          <div className="bg-white border border-outline-variant w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary">
                {editingMaterial 
                  ? (isDocumentMode ? 'Editar Documento Acadêmico' : 'Editar Livro') 
                  : (isDocumentMode ? 'Cadastrar Novo Documento Acadêmico' : 'Cadastrar Novo Livro')
                }
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
                  setNewCurso('Multidisciplinar / Geral');
                  setNewNumeroChamada('');
                  setNewTituloOriginal('');
                  setNewPublicacao('');
                  setNewDescricaoFisica('');
                  setNewSerie('');
                  setNewNotas('');
                  setNewAssuntos('');
                  setCapaFile(null);
                  setCapaPreviewUrl(null);
                  setPdfFile(null);
                  setPdfUrl(null);
                  setErrorMsg(null);
                }}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleSaveMaterial} className="p-6 space-y-6 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="bg-error-container border border-error/20 p-3 rounded flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-on-error-container">{errorMsg}</p>
                </div>
              )}

              {/* BLOCO 1: DADOS PRINCIPAIS */}
              <div className="space-y-4">
                <div className="border-b border-outline-variant pb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">1. Identificação Principal</h4>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {isDocumentMode ? 'Título Principal (TCC/Artigo)' : 'Título do Livro'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Core J2ME : tecnologia & MIDP..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Autor Principal *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Muchow, John W."
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">ISBN / Identificador *</label>
                    <input
                      type="text"
                      required
                      placeholder="978-0000000000"
                      value={newIsbn}
                      onChange={(e) => setNewIsbn(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Categoria *</label>
                    <select
                      required
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm text-on-surface h-9"
                    >
                      <option value="">Selecione</option>
                      <option value="Filosofia">Filosofia</option>
                      <option value="Ciência">Ciência</option>
                      <option value="História">História</option>
                      <option value="Literatura">Literatura</option>
                      <option value="Tecnologia">Tecnologia</option>
                      <option value="Programação">Programação</option>
                      <option value="Banco de Dados">Banco de Dados</option>
                      <option value="Infraestrutura">Infraestrutura</option>
                      <option value="Monografia">Monografia</option>
                      <option value="TCC">TCC</option>
                      <option value="Artigo Científico">Artigo Científico</option>
                      <option value="Dissertação">Dissertação</option>
                      <option value="Relatório Técnico">Relatório Técnico</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Curso *</label>
                    <select
                      required
                      value={newCurso}
                      onChange={(e) => setNewCurso(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant bg-white rounded focus:outline-none focus:border-primary text-sm text-on-surface h-9"
                    >
                      <option value="Multidisciplinar / Geral">Multidisciplinar / Geral</option>
                      <option value="Análise e Desenvolvimento de Sistemas (ADS)">ADS</option>
                      <option value="Engenharia de Software">Eng. Software</option>
                      <option value="Engenharia Civil">Eng. Civil</option>
                      <option value="Direito">Direito</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Ano Pub. *</label>
                    <input
                      type="number"
                      required
                      placeholder="AAAA"
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center bg-white text-on-surface h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Exemplares *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newCopies}
                      onChange={(e) => setNewCopies(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-center bg-white text-on-surface h-9"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 2: FICHA CATALOGRÁFICA AVANÇADA (OPCIONAL) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-outline-variant pb-1 flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">2. Ficha Catalográfica (Ficha Técnica)</h4>
                  <span className="text-[10px] text-on-surface-variant font-semibold bg-surface-container px-2 py-0.5 rounded">Opcional</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Número de Chamada (Localização)</label>
                    <input
                      type="text"
                      placeholder="Ex: 005.133 M915c"
                      value={newNumeroChamada}
                      onChange={(e) => setNewNumeroChamada(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Título Uniforme / Original</label>
                    <input
                      type="text"
                      placeholder="Ex: Core J2ME. Português"
                      value={newTituloOriginal}
                      onChange={(e) => setNewTituloOriginal(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Dados de Publicação</label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo : Pearson, 2004"
                      value={newPublicacao}
                      onChange={(e) => setNewPublicacao(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Descrição Física</label>
                    <input
                      type="text"
                      placeholder="Ex: xiv, 588 p. : il. ; 24 cm"
                      value={newDescricaoFisica}
                      onChange={(e) => setNewDescricaoFisica(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Série / Coleção</label>
                    <input
                      type="text"
                      placeholder="Ex: (Java)"
                      value={newSerie}
                      onChange={(e) => setNewSerie(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Assuntos / Indexadores</label>
                    <input
                      type="text"
                      placeholder="Ex: Java; Web; Mobile (separar por ponto e vírgula)"
                      value={newAssuntos}
                      onChange={(e) => setNewAssuntos(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Notas Gerais</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Inclui índice. A biblioteca possui a impressão de 2007."
                    value={newNotas}
                    onChange={(e) => setNewNotas(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm bg-white text-on-surface resize-none"
                  />
                </div>
              </div>

              {/* BLOCO 3: MÍDIAS E ARQUIVOS DIGITAIS */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-outline-variant pb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">3. Mídia e Arquivos Digitais</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Upload de Capa */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Capa do Livro / Documento</label>
                    <div className="flex gap-4 items-center bg-surface-container-low/20 p-3 rounded-lg border border-outline-variant/30 h-[96px]">
                      <div className="w-12 h-16 bg-surface-container border border-outline-variant/30 rounded flex items-center justify-center text-primary overflow-hidden shrink-0 shadow-sm">
                        {capaPreviewUrl ? (
                          <img src={capaPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 opacity-30 text-primary" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
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
                            className="flex items-center justify-center gap-1.5 border border-outline text-primary text-[10px] font-bold py-1.5 px-3 rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer shadow-sm w-max"
                          >
                            <Upload className="w-3 h-3" />
                            <span>{capaPreviewUrl ? 'Alterar Capa' : 'Selecionar Capa'}</span>
                          </label>
                        </div>
                        <p className="text-[9px] text-on-surface-variant italic leading-normal">
                          Formatos imagem. Máx 5MB.
                        </p>
                        {capaPreviewUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setCapaFile(null);
                              setCapaPreviewUrl(null);
                            }}
                            className="text-[9px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upload de PDF */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Documento Digital (PDF)</span>
                      {isDocumentMode && <span className="text-[10px] text-primary lowercase font-normal italic">(* recomendado)</span>}
                    </label>
                    <div className="flex gap-4 items-center bg-surface-container-low/20 p-3 rounded-lg border border-outline-variant/30 h-[96px]">
                      <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center text-primary shrink-0 shadow-sm">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id="pdf-upload"
                            accept="application/pdf"
                            onChange={handlePdfChange}
                            className="hidden"
                          />
                          <label
                            htmlFor="pdf-upload"
                            className="flex items-center justify-center gap-1.5 border border-outline text-primary text-[10px] font-bold py-1.5 px-3 rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer shadow-sm w-max shrink-0"
                          >
                            <Upload className="w-3 h-3" />
                            <span>{pdfFile || pdfUrl ? 'Substituir PDF' : 'Selecionar PDF'}</span>
                          </label>
                          
                          {(pdfFile || pdfUrl) && (
                            <span className="text-[10px] text-on-surface font-semibold truncate max-w-[90px]" title={pdfFile ? pdfFile.name : 'PDF Carregado'}>
                              {pdfFile ? pdfFile.name : 'Anexo PDF'}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-on-surface-variant italic leading-normal">
                          Documento PDF. Máx 20MB.
                        </p>
                        {(pdfFile || pdfUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPdfFile(null);
                              setPdfUrl(null);
                            }}
                            className="text-[9px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
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
                    setNewCurso('Multidisciplinar / Geral');
                    setNewNumeroChamada('');
                    setNewTituloOriginal('');
                    setNewPublicacao('');
                    setNewDescricaoFisica('');
                    setNewSerie('');
                    setNewNotas('');
                    setNewAssuntos('');
                    setCapaFile(null);
                    setCapaPreviewUrl(null);
                    setPdfFile(null);
                    setPdfUrl(null);
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingFile || uploadingPdf}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadingFile ? 'Enviando Capa...' : (uploadingPdf ? 'Enviando PDF...' : 'Salvando...')}</span>
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
