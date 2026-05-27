import { forwardRef, InputHTMLAttributes, ReactNode, useState } from 'react';
import { Eye, EyeOff, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  icon?: LucideIcon;
  type?: string;
  rightSlot?: ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ icon: Icon, type = 'text', className, rightSlot, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-white/40 pointer-events-none" />
        )}
        <input
          ref={ref}
          type={effectiveType}
          className={cn(
            'w-full h-12 rounded-xl bg-white/[0.04] border border-white/10',
            'text-white placeholder:text-white/40 text-sm',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[#C97A4A]/60 focus:bg-white/[0.06]',
            'disabled:opacity-50',
            Icon ? 'pl-11' : 'pl-4',
            isPassword || rightSlot ? 'pr-11' : 'pr-4',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {!isPassword && rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
    );
  },
);
AuthInput.displayName = 'AuthInput';
