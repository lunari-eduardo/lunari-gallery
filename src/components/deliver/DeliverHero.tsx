import { ChevronDown } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import { TitleCaseMode } from '@/types/gallery';

interface DeliverHeroProps {
  coverPhoto: PhotoPaths | null;
  sessionName: string;
  studioName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  isDark?: boolean;
  primaryColor?: string;
  onEnter: () => void;
}

export function DeliverHero({ coverPhoto, sessionName, studioName, sessionFont, titleCaseMode = 'normal', isDark = true, primaryColor, onEnter }: DeliverHeroProps) {
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const displayName = applyTitleCase(sessionName, titleCaseMode);

  const handleScroll = () => {
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
    }
    onEnter();
  };

  const overlayGradient = isDark
    ? 'from-black/40 via-black/20 to-black/60'
    : 'from-black/30 via-black/10 to-black/40';

  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
      />
      {/* Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-b ${overlayGradient}`} />

      {/* Studio name top */}
      {studioName && (
        <p className="absolute top-8 left-1/2 -translate-x-1/2 text-white/70 text-sm tracking-[0.25em] uppercase z-10">
          {studioName}
        </p>
      )}

      {/* Session title */}
      <h1
        className="relative z-10 text-white text-4xl md:text-6xl lg:text-7xl font-light text-center px-6 leading-tight"
        style={sessionFont ? { fontFamily: sessionFont } : undefined}
      >
        {displayName}
      </h1>

      {/* CTA */}
      <button
        onClick={handleScroll}
        className="relative z-10 mt-10 px-8 py-3 border border-white/50 text-white text-sm tracking-[0.2em] uppercase hover:bg-white/10 transition-colors duration-300"
      >
        Ver Galeria
      </button>

      {/* Chevron */}
      <button onClick={handleScroll} className="absolute bottom-10 z-10 animate-bounce text-white/60 hover:text-white transition-colors">
        <ChevronDown className="w-8 h-8" />
      </button>
    </section>
  );
}
