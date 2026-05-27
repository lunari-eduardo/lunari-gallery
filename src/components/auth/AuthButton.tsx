import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'outline';
}

export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(
  ({ loading, variant = 'primary', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'w-full h-12 rounded-xl font-medium text-sm transition-all duration-150',
          'flex items-center justify-center gap-2',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          variant === 'primary' &&
            'bg-gradient-to-b from-[#C97A4A] to-[#A8633A] text-white shadow-[0_8px_24px_-8px_rgba(201,122,74,0.6)] hover:from-[#D4845A] hover:to-[#B66E40] active:scale-[0.99]',
          variant === 'outline' &&
            'bg-white/[0.04] border border-white/10 text-white hover:bg-white/[0.08]',
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
      </button>
    );
  },
);
AuthButton.displayName = 'AuthButton';
