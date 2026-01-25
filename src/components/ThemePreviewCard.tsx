import { Check, Sun, Moon } from 'lucide-react';
import { CustomTheme } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface ThemePreviewCardProps {
  theme: CustomTheme;
  isSelected: boolean;
  onSelect: () => void;
  clientMode?: 'light' | 'dark';
  size?: 'sm' | 'md';
  showName?: boolean;
}

export function ThemePreviewCard({ 
  theme, 
  isSelected, 
  onSelect, 
  clientMode = 'light',
  size = 'md',
  showName = true,
}: ThemePreviewCardProps) {
  // Calculate effective background based on client mode
  const effectiveBackground = clientMode === 'dark' 
    ? adjustColorForDarkMode(theme.backgroundColor) 
    : theme.backgroundColor;
  
  const effectiveText = clientMode === 'dark'
    ? adjustColorForDarkMode(theme.textColor, true)
    : theme.textColor;

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
          {clientMode === 'dark' ? (
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

// Simple color adjustment for dark mode preview
function adjustColorForDarkMode(hexColor: string, isText = false): string {
  // For dark mode, invert light backgrounds to dark and dark text to light
  if (!hexColor.startsWith('#')) return hexColor;
  
  // Parse hex
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  if (isText) {
    // If text is dark, make it light for dark mode
    if (luminance < 0.5) {
      return '#F5F5F4'; // Light text
    }
    return hexColor;
  } else {
    // If background is light, make it dark for dark mode
    if (luminance > 0.5) {
      return '#1C1917'; // Dark background
    }
    return hexColor;
  }
}
