import { Sparkles } from 'lucide-react';

interface Props {
  isDark: boolean;
  bgColor: string;
  sessionFont?: string;
  onOpen: () => void;
}

export function DeliverMemorySection({ isDark, bgColor, sessionFont, onOpen }: Props) {
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#78716C' : '#A8A29E';

  return (
    <section
      className="flex flex-col items-center justify-center py-24 px-6"
      style={{ backgroundColor: bgColor }}
    >
      <Sparkles className="w-5 h-5 mb-4 opacity-50" style={{ color: textColor }} />

      <p
        className="text-sm tracking-widest uppercase mb-3 opacity-70"
        style={{ color: mutedColor, fontFamily: sessionFont }}
      >
        Lembrança
      </p>

      <h2
        className="text-xl sm:text-2xl text-center mb-4 font-light"
        style={{ color: textColor, fontFamily: sessionFont }}
      >
        Crie uma lembrança desse momento
      </h2>

      <p
        className="text-base text-center mb-8 max-w-sm leading-relaxed opacity-70"
        style={{ color: mutedColor }}
      >
        Se quiser, escolha algumas fotos e crie algo bonito para guardar ou compartilhar.
      </p>

      <button
        onClick={onOpen}
        className="px-6 py-2.5 text-sm tracking-wide transition-all duration-500 hover:opacity-80"
        style={{
          backgroundColor: isDark ? '#F5F5F4' : '#1C1917',
          color: isDark ? '#1C1917' : '#F5F5F4',
        }}
      >
        Criar lembrança
      </button>
    </section>
  );
}
