import { cn } from '@/lib/utils';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean; // kept for API compatibility (unused now)
  variant?: 'default' | 'gallery';
  className?: string;
}

export function Logo({ size = 'md', className }: LogoProps) {
  const heights = {
    sm: 'h-5',
    md: 'h-7',
    lg: 'h-9',
  };

  return (
    <div className={cn('flex items-center', className)}>
      {/* Light mode */}
      <img
        src={logoLight}
        alt="Lunari"
        className={cn(heights[size], 'w-auto object-contain block dark:hidden select-none')}
        draggable={false}
      />
      {/* Dark mode */}
      <img
        src={logoDark}
        alt="Lunari"
        className={cn(heights[size], 'w-auto object-contain hidden dark:block select-none')}
        draggable={false}
      />
    </div>
  );
}
