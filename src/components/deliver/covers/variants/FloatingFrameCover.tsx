import { ChevronDown } from 'lucide-react';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import type { CoverVariantProps } from '../types';

export default function FloatingFrameCover({
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
  const mutedColor = isDark ? 'text-white/60' : 'text-stone-600';
  const borderColor = isDark ? 'border-white/30' : 'border-stone-800/40';

  const handleScroll = () => {
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) gallerySection.scrollIntoView({ behavior: 'smooth' });
    onEnter();
  };

  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-8 py-10">
      {studioName && (
        <p className={`text-xs sm:text-sm tracking-[0.3em] uppercase mb-6 ${mutedColor}`}>
          {studioName}
        </p>
      )}

      <div
        className="relative w-full max-w-[88%] mx-auto overflow-hidden shadow-2xl"
        style={{ aspectRatio: '16 / 10', maxHeight: '70vh' }}
      >
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
      </div>

      <h1
        className={`mt-10 text-3xl md:text-5xl lg:text-6xl font-light text-center px-6 leading-tight ${textColor}`}
        style={sessionFont ? { fontFamily: sessionFont } : undefined}
      >
        {displayName}
      </h1>

      <button
        onClick={handleScroll}
        className={`mt-8 px-8 py-3 border text-sm tracking-[0.2em] uppercase transition-colors duration-300 ${textColor} ${borderColor} ${isDark ? 'hover:bg-white/10' : 'hover:bg-stone-900/5'}`}
      >
        Ver Galeria
      </button>

      <button
        onClick={handleScroll}
        className={`mt-10 animate-bounce transition-colors ${mutedColor} hover:${textColor}`}
        aria-label="Rolar"
      >
        <ChevronDown className="w-7 h-7" />
      </button>
    </section>
  );
}
