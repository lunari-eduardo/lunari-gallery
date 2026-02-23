import { useState, useEffect } from 'react';

interface DeliverWelcomeModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
  sessionName?: string;
  clientName?: string;
  studioName?: string;
  isDark?: boolean;
}

export function DeliverWelcomeModal({ open, onClose, message, sessionName, clientName, studioName, isDark = true }: DeliverWelcomeModalProps) {
  const [stage, setStage] = useState<'visible' | 'closing'>('visible');

  useEffect(() => {
    if (open) setStage('visible');
  }, [open]);

  if (!open) return null;

  const formatted = message
    .replace(/\{cliente\}/gi, clientName || 'Cliente')
    .replace(/\{sessao\}/gi, sessionName || 'Sessão')
    .replace(/\{estudio\}/gi, studioName || 'Estúdio');

  const handleClose = () => {
    setStage('closing');
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const overlayBg = isDark ? 'bg-black/60' : 'bg-white/40';
  const cardBg = isDark ? 'bg-black/40' : 'bg-white/40';
  const textColor = isDark ? 'text-white/90' : 'text-stone-800';
  const btnColor = isDark
    ? 'text-white/70 hover:text-white border-white/20 hover:border-white/40'
    : 'text-stone-600 hover:text-stone-900 border-stone-300 hover:border-stone-500';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all ease-out ${
        stage === 'closing' ? 'duration-[2000ms] opacity-0' : 'duration-500 opacity-100'
      } ${overlayBg}`}
      style={{
        backdropFilter: stage === 'closing' ? 'blur(0px)' : 'blur(20px)',
        WebkitBackdropFilter: stage === 'closing' ? 'blur(0px)' : 'blur(20px)',
        transition: stage === 'closing'
          ? 'opacity 2s ease-out, backdrop-filter 2s ease-out, -webkit-backdrop-filter 2s ease-out'
          : 'opacity 0.5s ease-out',
      }}
    >
      <div
        className={`max-w-md w-full mx-6 p-8 ${cardBg} backdrop-blur-xl transition-all ${
          stage === 'closing' ? 'duration-700 opacity-0 translate-y-4' : 'duration-500 opacity-100 translate-y-0'
        }`}
        style={{ border: 'none', borderRadius: 0 }}
      >
        <div className="text-center space-y-8">
          <p className={`text-lg leading-relaxed whitespace-pre-line ${textColor}`}>
            {formatted}
          </p>

          <button
            onClick={handleClose}
            className={`text-sm tracking-wide px-6 py-2.5 border transition-all duration-300 ${btnColor}`}
            style={{ borderRadius: 0 }}
          >
            Ver minhas fotos
          </button>
        </div>
      </div>
    </div>
  );
}
