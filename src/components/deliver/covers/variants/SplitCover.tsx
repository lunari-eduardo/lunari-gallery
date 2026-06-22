import { ChevronDown } from 'lucide-react';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import type { CoverVariantProps } from '../types';

export default function SplitCover({
  coverPhoto,
  sessionName,
  studioName,
  sessionFont,
  titleCaseMode = 'normal',
  isDark = true,
  onEnter,
}: CoverVariantProps) {
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const displayName = applyTitleCase(sessionName, titleCaseMode);
  const textColor = isDark ? 'text-white' : 'text-stone-900';
  const mutedColor = isDark ? 'text-white/60' : 'text-stone-500';
  const borderColor = isDark ? 'border-white/30' : 'border-stone-800/40';

  const handleScroll = () => {
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) gallerySection.scrollIntoView({ behavior: 'smooth' });
    onEnter();
  };

  return (
    <section className="relative min-h-screen w-full grid grid-cols-1 md:grid-cols-12">
      {/* Foto */}
      <div className="md:col-span-8 relative h-[70vh] md:h-screen">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
      </div>

      {/* Painel */}
      <div className={`md:col-span-4 flex flex-col justify-center px-8 md:px-12 py-12 md:py-0 ${textColor}`}>
        {studioName && (
          <p className={`text-xs tracking-[0.3em] uppercase mb-6 ${mutedColor}`}>{studioName}</p>
        )}

        <div className={`h-px w-12 mb-6 ${isDark ? 'bg-white/40' : 'bg-stone-900/40'}`} />

        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-light leading-tight"
          style={sessionFont ? { fontFamily: sessionFont } : undefined}
        >
          {displayName}
        </h1>

        <button
          onClick={handleScroll}
          className={`mt-10 self-start px-7 py-3 border text-xs tracking-[0.25em] uppercase transition-colors duration-300 ${borderColor} ${isDark ? 'hover:bg-white/10' : 'hover:bg-stone-900/5'}`}
        >
          Ver Galeria
        </button>

        <button
          onClick={handleScroll}
          className={`mt-8 self-start animate-bounce transition-colors ${mutedColor}`}
          aria-label="Rolar"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
}
