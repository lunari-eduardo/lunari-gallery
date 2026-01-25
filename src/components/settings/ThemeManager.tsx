import { useState } from 'react';
import { Palette, Plus, Sun, Moon, AlertCircle } from 'lucide-react';
import { CustomTheme } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ThemeCard } from './ThemeCard';
import { ThemeEditorModal } from './ThemeEditorModal';
import { cn } from '@/lib/utils';

const MAX_THEMES = 3;

interface ThemeManagerProps {
  themes: CustomTheme[];
  activeThemeId?: string;
  clientDefaultMode?: 'light' | 'dark';
  // Mutations específicas
  onCreateTheme: (theme: Omit<CustomTheme, 'id'>) => void;
  onUpdateTheme: (theme: CustomTheme) => void;
  onDeleteTheme: (themeId: string) => void;
  onSetDefaultTheme: (themeId: string) => void;
  onActiveThemeChange: (themeId: string) => void;
  onClientDefaultModeChange?: (mode: 'light' | 'dark') => void;
}

export function ThemeManager({
  themes,
  activeThemeId,
  clientDefaultMode = 'light',
  onCreateTheme,
  onUpdateTheme,
  onDeleteTheme,
  onSetDefaultTheme,
  onActiveThemeChange,
  onClientDefaultModeChange,
}: ThemeManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | undefined>();

  const canCreateTheme = themes.length < MAX_THEMES;

  const handleCreateTheme = () => {
    if (!canCreateTheme) return;
    setEditingTheme(undefined);
    setIsModalOpen(true);
  };

  const handleEditTheme = (theme: CustomTheme) => {
    setEditingTheme(theme);
    setIsModalOpen(true);
  };

  const handleSaveTheme = (themeData: Omit<CustomTheme, 'id'> & { id?: string }) => {
    if (themeData.id) {
      // Edit existing theme - call update mutation
      onUpdateTheme({
        id: themeData.id,
        name: themeData.name,
        primaryColor: themeData.primaryColor,
        backgroundColor: themeData.backgroundColor,
        textColor: themeData.textColor,
        accentColor: themeData.accentColor,
        isDefault: themeData.isDefault,
      });
    } else {
      // Create new theme - call create mutation
      onCreateTheme({
        name: themeData.name || 'Novo Tema',
        primaryColor: themeData.primaryColor,
        backgroundColor: themeData.backgroundColor,
        textColor: themeData.textColor,
        accentColor: themeData.accentColor,
        isDefault: themes.length === 0, // First theme is default
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteTheme = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (theme?.isDefault && themes.length > 1) return; // Can't delete default if others exist
    onDeleteTheme(themeId);
  };

  const handleSetDefault = (themeId: string) => {
    onSetDefaultTheme(themeId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Temas da Galeria do Cliente</h3>
            <p className="text-sm text-muted-foreground">
              Personalize as cores que o cliente verá
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCreateTheme}
          disabled={!canCreateTheme}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Tema ({themes.length}/{MAX_THEMES})
        </Button>
      </div>

      {/* Theme limit warning */}
      {!canCreateTheme && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Limite de {MAX_THEMES} temas atingido. Exclua um tema para criar outro.</span>
        </div>
      )}

      {/* Theme grid */}
      {themes.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
      ) : (
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
          <Palette className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium mb-1">Nenhum tema criado</p>
          <p className="text-sm text-muted-foreground mb-4">
            Crie um tema para personalizar a aparência da galeria do cliente
          </p>
          <Button variant="outline" size="sm" onClick={handleCreateTheme}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeiro tema
          </Button>
        </div>
      )}

      {/* Client Default Mode */}
      {onClientDefaultModeChange && (
        <div className="pt-4 border-t border-border space-y-3">
          <Label className="text-base font-medium">Modo padrão do cliente</Label>
          <p className="text-sm text-muted-foreground">
            Define se a galeria abrirá em modo claro ou escuro por padrão
          </p>
          
          <RadioGroup 
            value={clientDefaultMode} 
            onValueChange={(v) => onClientDefaultModeChange(v as 'light' | 'dark')}
            className="flex gap-4"
          >
            <div className="flex items-center">
              <RadioGroupItem value="light" id="mode-light" className="peer sr-only" />
              <Label 
                htmlFor="mode-light" 
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:border-primary/50 hover:bg-muted/50",
                  clientDefaultMode === 'light' 
                    ? "border-primary bg-primary/5" 
                    : "border-border"
                )}
              >
                <Sun className={cn(
                  "h-4 w-4",
                  clientDefaultMode === 'light' ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={clientDefaultMode === 'light' ? 'font-medium' : ''}>
                  Modo Claro
                </span>
              </Label>
            </div>
            
            <div className="flex items-center">
              <RadioGroupItem value="dark" id="mode-dark" className="peer sr-only" />
              <Label 
                htmlFor="mode-dark" 
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:border-primary/50 hover:bg-muted/50",
                  clientDefaultMode === 'dark' 
                    ? "border-primary bg-primary/5" 
                    : "border-border"
                )}
              >
                <Moon className={cn(
                  "h-4 w-4",
                  clientDefaultMode === 'dark' ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={clientDefaultMode === 'dark' ? 'font-medium' : ''}>
                  Modo Escuro
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      <ThemeEditorModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        theme={editingTheme}
        onSave={handleSaveTheme}
      />
    </div>
  );
}
