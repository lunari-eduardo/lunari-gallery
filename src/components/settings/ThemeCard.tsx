import { Check, Star, Pencil, Trash2 } from 'lucide-react';
import { CustomTheme } from '@/types/gallery';
import { Button } from '@/components/ui/button';

interface ThemeCardProps {
  theme: CustomTheme;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

export function ThemeCard({
  theme,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
}: ThemeCardProps) {
  return (
    <div
      className={`
        relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-200
        ${isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}
      `}
      onClick={onSelect}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Default badge */}
      {theme.isDefault && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-medium">
          <Star className="h-3 w-3" />
          Padrão
        </div>
      )}

      {/* Color preview */}
      <div
        className="h-20 rounded-lg mb-3 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div className="flex gap-2">
          <div
            className="h-8 w-8 rounded-full shadow-sm"
            style={{ backgroundColor: theme.primaryColor }}
          />
          <div
            className="h-8 w-8 rounded-full shadow-sm"
            style={{ backgroundColor: theme.accentColor }}
          />
          <div
            className="h-8 w-8 rounded-full shadow-sm border"
            style={{ backgroundColor: theme.textColor }}
          />
        </div>
      </div>

      {/* Theme name */}
      <p className="font-medium text-sm mb-3 text-center">{theme.name}</p>

      {/* Actions */}
      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
        {!theme.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onSetDefault}
          >
            <Star className="h-3 w-3 mr-1" />
            Padrão
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
