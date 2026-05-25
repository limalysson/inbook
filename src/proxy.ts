import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware global do Next.js.
 * Intercepta as rotas mapeadas no matcher e atualiza a sessão do Supabase de forma transparente.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Mapeia todas as rotas do Next.js exceto arquivos estáticos, favicon e imagens
     * para otimizar a performance e evitar chamadas redundantes à API do Supabase.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
