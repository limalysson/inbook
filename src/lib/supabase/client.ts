import { createBrowserClient } from '@supabase/ssr';

/**
 * Cria uma instância do cliente Supabase para uso no lado do cliente (Browser).
 * Utiliza as variáveis de ambiente públicas configuradas no .env.local.
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
