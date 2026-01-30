import { Check, Sun, Moon } from 'lucide-react';
import { CustomTheme } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface ThemePreviewCardProps {
  theme: CustomTheme;
  isSelected: boolean;
  onSelect: () => void;
  size?: 'sm' | 'md';
  showName?: boolean;
}

export function ThemePreviewCard({ 
  theme, 
  isSelected, 
  onSelect, 
  size = 'md',
  showName = true,
}: ThemePreviewCardProps) {
  // Use backgroundMode to determine colors
  const isDarkMode = theme.backgroundMode === 'dark';
  const effectiveBackground = isDarkMode ? '#1C1917' : '#FAF9F7';
  const effectiveText = theme.emphasisColor;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border-2 transition-all cursor-pointer group relative overflow-hidden",
        "hover:shadow-md hover:scale-[1.02]",
        size === 'sm' ? 'p-2' : 'p-3',
        isSelected 
          ? "border-primary ring-2 ring-primary/20 shadow-md" 
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Theme Preview */}
      <div 
        className={cn(
          "rounded-lg flex flex-col items-center justify-center gap-2",
          size === 'sm' ? 'h-14' : 'h-20'
        )}
        style={{ backgroundColor: effectiveBackground }}
      >
        {/* Sample text */}
        <span 
          className={cn("font-medium", size === 'sm' ? 'text-sm' : 'text-base')}
          style={{ color: effectiveText }}
        >
          Aa
        </span>
        
        {/* Color swatches */}
        <div className="flex items-center gap-1.5">
          <div 
            className={cn("rounded-full", size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')}
            style={{ backgroundColor: theme.primaryColor }}
            title="Cor principal"
          />
          <div 
            className={cn("rounded-full", size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')}
            style={{ backgroundColor: theme.accentColor }}
            title="Cor de destaque"
          />
        </div>
        
        {/* Mode indicator */}
        <div className="absolute top-1.5 right-1.5">
          {isDarkMode ? (
            <Moon className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Sun className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {/* Theme name */}
      {showName && (
        <p className={cn(
          "font-medium mt-2 truncate",
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {theme.name}
        </p>
      )}
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  );
}
