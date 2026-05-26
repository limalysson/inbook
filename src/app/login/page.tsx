'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  BookOpen, 
  Mail, 
  Lock, 
  KeyRound, 
  Loader2, 
  ShieldAlert, 
  ArrowRight, 
  UserCheck,
  User,
  Phone,
  GraduationCap
} from 'lucide-react';

/**
 * Página de Login Unificada do INBOOK.
 * Oferece dois fluxos:
 * 1. Alunos/Docentes: Autenticação Passwordless via OTP de 6 dígitos gerado e verificado no servidor,
 *    com provisionamento de perfil sob demanda (JIT / Upsert) no primeiro acesso.
 * 2. Gestores: Autenticação convencional (E-mail + Senha).
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // Estados de navegação e inputs
  const [activeTab, setActiveTab] = useState<'leitor' | 'gestor'>('leitor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // Estado para fluxo JIT de Autoprovisionamento
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [matricula, setMatricula] = useState('');
  const [tipoLeitor, setTipoLeitor] = useState<'estudante' | 'docente'>('estudante');
  const [cursoDepartamento, setCursoDepartamento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [savedSession, setSavedSession] = useState<any>(null);

  // Estados de controle de fluxo
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /**
   * Dispara a solicitação do código OTP para o backend.
   */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao solicitar código de acesso.');
      }

      setOtpSent(true);
      setSuccessMsg(result.message);
      
      // Armazena temporariamente em logs visuais do dev em ambiente local
      if (result.devOtp) {
        console.log(`[DEV] Seu OTP de testes é: ${result.devOtp}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reenvia o código OTP para o mesmo e-mail sem exigir redigitação.
   */
  const handleResendOtp = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao reenviar o código.');
      }

      setOtpCode('');
      setSuccessMsg('Um novo código de acesso foi enviado com sucesso para o seu e-mail!');
      
      if (result.devOtp) {
        console.log(`[DEV] Seu novo OTP de testes é: ${result.devOtp}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao tentar reenviar o código.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Valida o código OTP e cria a sessão e perfil JIT se necessário.
   */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = otpCode.trim().toUpperCase();

      const response = await fetch('/api/auth/autenticar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, tempPassword: cleanCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Código inválido ou expirado.');
      }

      const { session, isNewUser } = result;

      // Cria a sessão ativa do Supabase no lado do cliente
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (sessionError) {
        throw sessionError;
      }

      if (isNewUser) {
        // Fluxo de Autoprovisionamento: Exibe formulário para preencher os dados
        setSavedSession(session);
        setShowProfileForm(true);
        setSuccessMsg('Código validado! Complete seus dados para o primeiro acesso.');
      } else {
        setSuccessMsg('Autenticação concluída! Redirecionando...');
        setTimeout(() => {
          router.push('/portal');
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de verificação do código.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Finaliza o preenchimento do perfil sob demanda (JIT Upsert).
   */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!nomeCompleto.trim() || !matricula.trim() || !cursoDepartamento.trim()) {
        throw new Error('Nome, Matrícula e Curso são obrigatórios.');
      }

      // Executa o upsert direto no Supabase, garantido pela RLS para o usuário logado
      const { error: upsertError } = await supabase
        .from('usuarios')
        .upsert({
          id: savedSession.user.id,
          nome_completo: nomeCompleto.trim(),
          matricula: matricula.trim(),
          tipo: tipoLeitor,
          curso_departamento: cursoDepartamento.trim(),
          email: savedSession.user.email,
          telefone: telefone.trim() || null,
          status: true,
        });

      if (upsertError) {
        throw new Error(`Erro ao salvar perfil: ${upsertError.message}`);
      }

      setSuccessMsg('Cadastro concluído com sucesso! Entrando no portal...');
      
      setTimeout(() => {
        router.push('/portal');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar informações de perfil.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Autentica o gestor usando e-mail e senha convencionais.
   */
  const handleGestorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        throw new Error('Credenciais de acesso incorretas.');
      }

      // Verifica se o usuário tem privilégio administrativo
      const { data: profile } = await supabase
        .from('usuarios')
        .select('tipo')
        .eq('id', data.user.id)
        .single();

      if (profile?.tipo !== 'administrador') {
        await supabase.auth.signOut();
        throw new Error('Este fluxo é restrito para gestores do sistema.');
      }

      setSuccessMsg('Login efetuado com sucesso! Entrando no painel...');

      // Redireciona o gestor para o dashboard administrativo
      setTimeout(() => {
        router.push('/admin/dashboard');
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao efetuar o login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      
      {/* Detalhes estéticos de fundo (Padrão Acadêmico/Premium) */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full filter blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        
        {/* Logotipo Acadêmico */}
        <div className="flex justify-center items-center h-16">
          <img 
            src="/marca.JPG" 
            alt="INBOOK Logo" 
            className="h-14 w-auto object-contain" 
          />
        </div>
        
        <h2 className="mt-6 text-center font-serif text-3xl font-bold tracking-tight text-primary">
          Acesso ao Sistema
        </h2>
        <p className="mt-2 text-center text-sm text-on-surface-variant font-sans">
          Controle de Acervo e Circulação Institucional
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-surface-container-lowest py-8 px-4 border border-outline-variant shadow-sm rounded-lg sm:px-10">
          
          {/* Abas Alternadoras (Apenas se o código OTP ainda não tiver sido enviado e não estiver preenchendo perfil) */}
          {!otpSent && !showProfileForm && (
            <div className="flex border-b border-outline-variant mb-6" role="tablist">
              <button
                className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors border-b-2 outline-none ${
                  activeTab === 'leitor'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => {
                  setActiveTab('leitor');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                role="tab"
                aria-selected={activeTab === 'leitor'}
              >
                Sou Aluno/Docente
              </button>
              <button
                className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors border-b-2 outline-none ${
                  activeTab === 'gestor'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => {
                  setActiveTab('gestor');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                role="tab"
                aria-selected={activeTab === 'gestor'}
              >
                Sou Gestor
              </button>
            </div>
          )}

          {/* Mensagens de Alerta (Feedback visual limpo) */}
          {errorMsg && (
            <div className="mb-4 bg-error-container border border-error/20 p-3 rounded flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-on-error-container">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-surface-container border border-primary/20 p-3 rounded flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-primary">{successMsg}</p>
            </div>
          )}

          {/* FLUXO 1: LEITOR - ETAPA 1 (Pedir OTP) */}
          {activeTab === 'leitor' && !otpSent && !showProfileForm && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label htmlFor="email-leitor" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  E-mail Institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email-leitor"
                    type="email"
                    required
                    disabled={loading}
                    placeholder="usuario@inbec.edu.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Receber Código de Acesso</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FLUXO 1: LEITOR - ETAPA 2 (Confirmar OTP de 6 dígitos) */}
          {activeTab === 'leitor' && otpSent && !showProfileForm && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="otp-code" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Código de Acesso (6 Dígitos)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-secondary hover:underline cursor-pointer"
                  >
                    Alterar E-mail
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    id="otp-code"
                    type="text"
                    required
                    maxLength={6}
                    disabled={loading}
                    placeholder="ABC123"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                    className="block w-full pl-10 pr-3 py-3 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50 tracking-widest text-center font-bold disabled:opacity-50"
                  />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant italic text-center">
                  O código expira em 5 minutos. Verifique sua caixa de entrada e spam.
                </p>
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleResendOtp}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50 active:scale-95 transition-all duration-100"
                  >
                    Não recebeu o código? Reenviar Código
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Verificar Código e Acessar</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FLUXO 1: LEITOR - ETAPA 3 (Formulário JIT de Autoprovisionamento) */}
          {showProfileForm && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="border-b border-outline-variant/30 pb-3 mb-2">
                <h3 className="text-sm font-bold text-primary">Informações Básicas do Perfil</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Por favor, complete as informações da sua conta institucional.
                </p>
              </div>

              <div>
                <label htmlFor="jit-nome" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="jit-nome"
                    type="text"
                    required
                    disabled={loading}
                    placeholder="João da Silva"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="jit-matricula" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Matrícula
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      id="jit-matricula"
                      type="text"
                      required
                      disabled={loading}
                      placeholder="MAT-12345"
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="jit-tipo" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Vínculo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <select
                      id="jit-tipo"
                      disabled={loading}
                      value={tipoLeitor}
                      onChange={(e) => setTipoLeitor(e.target.value as 'estudante' | 'docente')}
                      className="block w-full pl-10 pr-3 py-2 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm text-primary"
                    >
                      <option value="estudante">Estudante</option>
                      <option value="docente">Docente</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="jit-curso" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Curso / Departamento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <select
                    id="jit-curso"
                    required
                    disabled={loading}
                    value={cursoDepartamento}
                    onChange={(e) => setCursoDepartamento(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm text-primary"
                  >
                    <option value="" disabled>Selecione seu Curso / Departamento</option>
                    <option value="Análise e Desenvolvimento de Sistemas (ADS)">Análise e Desenvolvimento de Sistemas (ADS)</option>
                    <option value="Engenharia de Software">Engenharia de Software</option>
                    <option value="Engenharia Civil">Engenharia Civil</option>
                    <option value="Direito">Direito</option>
                    <option value="Multidisciplinar / Geral">Multidisciplinar / Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="jit-tel" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Telefone (Opcional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="jit-tel"
                    type="tel"
                    disabled={loading}
                    placeholder="(85) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Salvar e Entrar no Portal</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FLUXO 2: GESTOR (E-mail + Senha) */}
          {activeTab === 'gestor' && !showProfileForm && (
            <form onSubmit={handleGestorLogin} className="space-y-6">
              <div>
                <label htmlFor="email-gestor" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email-gestor"
                    type="email"
                    required
                    disabled={loading}
                    placeholder="gestor@inbec.edu.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="senha-gestor" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="senha-gestor"
                    type="password"
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-outline-variant bg-surface rounded-md focus:outline-none focus:border-primary text-sm placeholder:text-on-surface-variant/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Entrar no Painel Administrativo</span>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </main>
  );
}

