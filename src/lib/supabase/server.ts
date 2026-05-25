import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cria uma instância do cliente Supabase para uso no lado do servidor (Server Components, Route Handlers, Server Actions).
 * Gerencia a leitura e escrita de cookies de forma assíncrona, compatível com o Next.js 15.
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // O setAll pode ser chamado de dentro de um Server Component
            // onde cookies não podem ser modificados. Ignoramos com segurança.
          }
        },
      },
    }
  );
};
