/**
 * Formata um valor numérico para a moeda brasileira (BRL).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata uma string de data para o padrão brasileiro (DD/MM/AAAA).
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

/**
 * Junção condicional de classes CSS (substituto limpo para clsx/classnames).
 */
export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
