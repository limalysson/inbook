import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'inbook-auth-secret-key-2026-production-super-secret';

/**
 * Deriva uma senha estável, segura e determinística para o e-mail informado.
 * Isso permite autenticar o aluno/docente no Supabase Auth sem exigir uma senha do usuário.
 */
function derivePassword(email: string): string {
  return crypto.createHmac('sha256', JWT_SECRET)
    .update(email)
    .digest('hex');
}

/**
 * Route Handler para autenticar o OTP e emitir o token de acesso (Sessão Supabase Auth).
 * Se o usuário não existir no Supabase Auth, ele é criado sob demanda (Autoprovisionamento JIT).
 */
export async function POST(request: Request) {
  try {
    const { email, tempPassword } = await request.json();

    if (!email || !tempPassword) {
      return NextResponse.json(
        { error: 'E-mail e código são obrigatórios.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = tempPassword.trim().toUpperCase();

    // Inicializa o cliente do Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
    );

    // 1. Busca o registro do OTP na tabela public.otps
    const { data: otpRecord, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (otpError || !otpRecord) {
      return NextResponse.json(
        { error: 'Código de acesso não solicitado ou expirado.' },
        { status: 401 }
      );
    }

    // 2. Validação da expiração (máximo 5 minutos de validade)
    const FIVE_MINUTES = 5 * 60 * 1000;
    const createdAtTime = new Date(otpRecord.created_at).getTime();
    if (Date.now() - createdAtTime > FIVE_MINUTES) {
      // Exclui o registro vencido para manter a tabela limpa
      await supabase.from('otps').delete().eq('email', cleanEmail);
      return NextResponse.json(
        { error: 'Código de acesso expirado. Por favor, solicite um novo.' },
        { status: 401 }
      );
    }

    // 3. Compara o código informado com o hash armazenado
    const isMatch = await bcrypt.compare(cleanCode, otpRecord.code_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Código de acesso inválido.' },
        { status: 401 }
      );
    }

    // 4. Remove o OTP utilizado para impedir qualquer tentativa de reuso
    await supabase.from('otps').delete().eq('email', cleanEmail);

    // 5. Deriva a senha estável e determinística do usuário
    const stablePassword = derivePassword(cleanEmail);

    // 6. Tenta realizar o login tradicional com a senha estável
    const authResult = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: stablePassword,
    });

    let session = authResult.data.session;

    // 7. JIT Autoprovisioning: se o login falhar por falta de registro ou credenciais incorretas,
    // significa que o usuário é novo. Registramos ele agora.
    if (authResult.error) {
      const errorMessage = authResult.error.message.toLowerCase();
      if (
        errorMessage.includes('invalid login credentials') || 
        errorMessage.includes('user not found') || 
        errorMessage.includes('email not confirmed')
      ) {
        // Cria a conta do usuário silenciosamente no Supabase Auth
        const signUpResult = await supabase.auth.signUp({
          email: cleanEmail,
          password: stablePassword,
        });

        if (signUpResult.error) {
          console.error('Erro ao cadastrar usuário JIT:', signUpResult.error);
          return NextResponse.json(
            { error: `Erro no autoprovisionamento: ${signUpResult.error.message}` },
            { status: 500 }
          );
        }

        // Recupera a sessão iniciada após o cadastro bem-sucedido
        session = signUpResult.data.session;
      } else {
        console.error('Erro na autenticação de login:', authResult.error);
        return NextResponse.json(
          { error: authResult.error.message },
          { status: 401 }
        );
      }
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Não foi possível iniciar a sessão de login.' },
        { status: 500 }
      );
    }

    // 8. Verifica se o usuário possui registro preenchido em public.usuarios
    const { data: profile } = await supabase
      .from('usuarios')
      .select('nome_completo, tipo, matricula')
      .eq('id', session.user.id)
      .single();

    const isNewUser = !profile;

    return NextResponse.json(
      {
        message: 'Acesso autorizado com sucesso!',
        session: session,
        isNewUser, // O frontend usará essa flag para decidir se exibe o formulário de perfil JIT
        profile
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Erro interno ao autenticar código:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar a autenticação.' },
      { status: 500 }
    );
  }
}
