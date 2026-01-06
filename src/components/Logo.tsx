import { Aperture } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'default' | 'gallery';
  className?: string;
}

export function Logo({ size = 'md', showText = true, variant = 'default', className }: LogoProps) {
  const sizes = {
    sm: { icon: 20, text: 'text-lg' },
    md: { icon: 28, text: 'text-2xl' },
    lg: { icon: 36, text: 'text-3xl' },
  };

  const text = variant === 'gallery' ? 'Lunari Gallery' : 'Lunari';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <Aperture 
          size={sizes[size].icon} 
          className="text-primary" 
          strokeWidth={1.5}
        />
        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
      </div>
      {showText && (
        <span className={cn('font-display font-semibold tracking-tight', sizes[size].text)}>
          {text}
        </span>
      )}
    </div>
  );
}
