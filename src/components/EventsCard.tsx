'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, Plus, X, Loader2, AlertCircle } from 'lucide-react';

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
}

interface EventsCardProps {
  initialEvents: Evento[];
}

export default function EventsCard({ initialEvents }: EventsCardProps) {
  const supabase = createClient();
  const [eventos, setEventos] = useState<Evento[]>(initialEvents);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados do formulário
  const [titulo, setTitulo] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formata a data para "26 de mai, 14:00"
  const formatEventDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    // Remove o ponto final que o pt-BR costuma colocar na abreviação do mês (ex: "mai." -> "mai")
    const cleanDateStr = dateStr.replace('.', '');
    return `${cleanDateStr}, ${timeStr}`;
  };

  // Recarrega eventos do banco
  const refetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .gte('data_evento', new Date().toISOString())
        .order('data_evento', { ascending: true });

      if (error) throw error;
      setEventos(data || []);
    } catch (err) {
      console.error('Erro ao recarregar eventos:', err);
    }
  };

  // Envia novo evento para o Supabase
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !dataEvento) {
      setErrorMsg('Título e data são obrigatórios.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('eventos')
        .insert([
          {
            titulo: titulo.trim(),
            data_evento: new Date(dataEvento).toISOString(),
          }
        ]);

      if (error) throw error;

      // Limpa e fecha modal
      setTitulo('');
      setDataEvento('');
      setIsModalOpen(false);

      // Atualiza listagem
      await refetchEvents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao cadastrar evento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-xl space-y-4 shadow-sm animate-in fade-in duration-300">
      
      {/* Cabeçalho do Card */}
      <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          <span>Próximos Eventos</span>
        </h4>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-1 rounded bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer flex items-center justify-center"
          title="Cadastrar Novo Evento"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista de Eventos */}
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 hide-scrollbar">
        {eventos.length > 0 ? (
          eventos.map((evt) => (
            <div 
              key={evt.id} 
              className="p-3 bg-white border border-outline-variant/20 rounded border-l-4 border-l-primary hover:border-l-secondary hover:shadow-sm transition-all"
            >
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                {formatEventDate(evt.data_evento)}
              </p>
              <p className="text-xs font-bold text-primary mt-1 leading-snug">
                {evt.titulo}
              </p>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-on-surface-variant/60 space-y-2 border border-dashed border-outline-variant/40 rounded-lg bg-surface/50">
            <Calendar className="w-8 h-8 mx-auto opacity-20 text-primary" />
            <p className="text-xs font-medium">Nenhum evento agendado</p>
          </div>
        )}
      </div>

      {/* MODAL: Cadastrar Novo Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-outline-variant w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col">
            
            <header className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface">
              <h3 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Cadastrar Novo Evento</span>
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setErrorMsg(null);
                }}
                className="text-on-surface-variant hover:text-secondary p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              {errorMsg && (
                <div className="bg-error-container border border-error/20 p-3 rounded flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-on-error-container shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-on-error-container">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Título do Evento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Palestra sobre Acervo Raro"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Data e Hora</label>
                <input
                  type="datetime-local"
                  required
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:outline-none focus:border-primary text-sm text-primary"
                />
              </div>

              <footer className="pt-4 flex gap-3 border-t border-outline-variant/30 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 border border-outline text-primary text-sm font-semibold rounded hover:bg-surface-container active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-on-primary text-sm font-semibold rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Cadastrar Evento</span>
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
