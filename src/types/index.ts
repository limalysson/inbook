export type UserType = 'estudante' | 'docente' | 'funcionario' | 'administrador';

export interface Usuario {
  id: string;
  nome_completo: string;
  matricula: string;
  tipo: UserType;
  curso_departamento?: string;
  email: string;
  telefone?: string;
  foto_url?: string;
  status: boolean;
  created_at: string;
}

export interface Material {
  id: string;
  titulo: string;
  autor: string;
  isbn: string;
  categoria: string;
  ano: number;
  exemplares_total: number;
  exemplares_disponiveis: number;
  prateleira?: string;
  capa_url?: string;
  created_at: string;
  pdf_url?: string;
  curso?: string;
  numero_chamada?: string;
  titulo_original?: string;
  publicacao?: string;
  descricao_fisica?: string;
  serie?: string;
  notas?: string;
  assuntos?: string;
}

export type LoanStatus = 'ativo' | 'atrasado' | 'devolvido';

export interface Circulacao {
  id: string;
  usuario_id: string;
  material_id: string;
  data_emprestimo: string;
  data_devolucao_prevista: string;
  data_devolucao_real?: string;
  status: LoanStatus;
  multa_acumulada: number;
  renovacoes_contagem: number;
  
  // Joins opcionais para listagens dinâmicas
  usuario?: {
    nome_completo: string;
    matricula: string;
    foto_url?: string;
  };
  material?: {
    titulo: string;
    autor: string;
    capa_url?: string;
  };
}
