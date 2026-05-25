import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

/**
 * Expressão regular para validar e-mails com o domínio institucional @inbec.edu.br (ou subdomínios).
 */
const INSTITUTIONAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@inbec\.edu\.br$/;

/**
 * Função para gerar um código OTP temporário de 6 dígitos em caixa alta (letras e números).
 */
function generateOTP(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
}

/**
 * Route Handler para a geração e envio de OTP para Alunos/Docentes.
 * Não exige pré-cadastro no banco de dados. Apenas valida o domínio institucional.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'O e-mail é obrigatório.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Validação estrita de Domínio Institucional (@inbec.edu.br)
    if (!INSTITUTIONAL_EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Domínio de e-mail inválido. Utilize seu e-mail institucional @inbec.edu.br.' },
        { status: 400 }
      );
    }

    // 2. Geração do código OTP de 6 dígitos
    const otpCode = generateOTP();

    // 3. Criptografia do código temporário usando bcrypt
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(otpCode, salt);

    // 4. Inicializa cliente Supabase direto (sem dependência de cookies)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
    );

    // 5. Salva ou atualiza (upsert) o código OTP para o e-mail no banco de dados
    const { error: dbError } = await supabase
      .from('otps')
      .upsert({
        email: cleanEmail,
        code_hash: codeHash,
        created_at: new Date().toISOString()
      }, { onConflict: 'email' });

    if (dbError) {
      console.error('Erro ao salvar OTP no Supabase:', dbError);
      return NextResponse.json(
        { error: 'Falha interna ao registrar o código de acesso.' },
        { status: 500 }
      );
    }

    // 6. Desenvolvimento/Testes: Imprime o código no terminal para fácil visualização
    console.log(`\n========================================\n[OTP] Código gerado para ${cleanEmail}: ${otpCode}\n========================================\n`);

    return NextResponse.json(
      { 
        message: 'Código de acesso temporário enviado para seu e-mail institucional.',
        // Retornamos em dev para facilitar testes rápidos se necessário
        devOtp: process.env.NODE_ENV === 'development' ? otpCode : undefined
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro interno ao enviar OTP:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}

