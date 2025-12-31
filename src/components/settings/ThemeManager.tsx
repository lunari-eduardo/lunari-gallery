import { useState } from 'react';
import { Palette, Plus } from 'lucide-react';
import { CustomTheme } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { ThemeCard } from './ThemeCard';
import { ThemeEditorModal } from './ThemeEditorModal';

interface ThemeManagerProps {
  themes: CustomTheme[];
  activeThemeId?: string;
  onThemesChange: (themes: CustomTheme[]) => void;
  onActiveThemeChange: (themeId: string) => void;
}

export function ThemeManager({
  themes,
  activeThemeId,
  onThemesChange,
  onActiveThemeChange,
}: ThemeManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | undefined>();

  const handleCreateTheme = () => {
    setEditingTheme(undefined);
    setIsModalOpen(true);
  };

  const handleEditTheme = (theme: CustomTheme) => {
    setEditingTheme(theme);
    setIsModalOpen(true);
  };

  const handleSaveTheme = (themeData: Omit<CustomTheme, 'id'> & { id?: string }) => {
    if (themeData.id) {
      // Edit existing theme
      const updated = themes.map((t) =>
        t.id === themeData.id ? { ...t, ...themeData } : t
      );
      onThemesChange(updated);
    } else {
      // Create new theme
      const newTheme: CustomTheme = {
        ...themeData,
        id: `theme-${Date.now()}`,
        isDefault: false,
      };
      onThemesChange([...themes, newTheme]);
    }
  };

  const handleDeleteTheme = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (theme?.isDefault) return; // Can't delete default theme

    const updated = themes.filter((t) => t.id !== themeId);
    onThemesChange(updated);

    // If deleted theme was active, switch to default
    if (activeThemeId === themeId) {
      const defaultTheme = updated.find((t) => t.isDefault);
      if (defaultTheme) onActiveThemeChange(defaultTheme.id);
    }
  };

  const handleSetDefault = (themeId: string) => {
    const updated = themes.map((t) => ({
      ...t,
      isDefault: t.id === themeId,
    }));
    onThemesChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Temas</h3>
            <p className="text-sm text-muted-foreground">
              Crie temas personalizados para suas galerias
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCreateTheme}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tema
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isActive={activeThemeId === theme.id}
            onSelect={() => onActiveThemeChange(theme.id)}
            onEdit={() => handleEditTheme(theme)}
            onDelete={() => handleDeleteTheme(theme.id)}
            onSetDefault={() => handleSetDefault(theme.id)}
          />
        ))}
      </div>

      <ThemeEditorModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        theme={editingTheme}
        onSave={handleSaveTheme}
      />
    </div>
  );
}
