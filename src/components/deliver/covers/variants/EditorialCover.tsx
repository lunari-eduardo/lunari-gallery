import { ChevronDown } from 'lucide-react';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import type { CoverVariantProps } from '../types';

export default function EditorialCover({
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
  const mutedColor = isDark ? 'text-white/50' : 'text-stone-500';
  const borderColor = isDark ? 'border-white/20' : 'border-stone-900/20';

  const handleScroll = () => {
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) gallerySection.scrollIntoView({ behavior: 'smooth' });
    onEnter();
  };

  const year = new Date().getFullYear();

  return (
    <section className={`relative min-h-screen w-full grid grid-cols-1 md:grid-cols-2 ${textColor}`}>
      {/* Coluna texto */}
      <div className="flex flex-col justify-between px-8 md:px-14 lg:px-20 py-10 md:py-16 order-2 md:order-1">
        <div className="flex items-center gap-3">
          <span className={`text-xs tracking-[0.3em] ${mutedColor}`}>01</span>
          <span className={`h-px w-8 ${isDark ? 'bg-white/30' : 'bg-stone-900/30'}`} />
          <span className={`text-xs tracking-[0.3em] uppercase ${mutedColor}`}>
            {studioName || 'Sessão'}
          </span>
        </div>

        <div className="my-12">
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-normal leading-[1.05] tracking-tight"
            style={sessionFont ? { fontFamily: sessionFont } : { fontFamily: 'Instrument Serif, serif' }}
          >
            {displayName}
          </h1>

          <div className={`mt-10 h-px w-24 ${isDark ? 'bg-white/40' : 'bg-stone-900/40'}`} />

          <div className="mt-10 flex items-center gap-6">
            <button
              onClick={handleScroll}
              className={`px-7 py-3 border text-xs tracking-[0.25em] uppercase transition-colors duration-300 ${borderColor} ${isDark ? 'hover:bg-white/10' : 'hover:bg-stone-900/5'}`}
            >
              Ver Galeria
            </button>
            <button onClick={handleScroll} className={`animate-bounce ${mutedColor}`} aria-label="Rolar">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className={`text-[10px] tracking-[0.3em] uppercase ${mutedColor}`}>{year} — Entrega Final</p>
      </div>

      {/* Coluna foto */}
      <div className="relative min-h-[50vh] md:min-h-screen order-1 md:order-2">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
      </div>
    </section>
  );
}
