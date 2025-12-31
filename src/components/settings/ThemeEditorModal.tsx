import { useState, useEffect } from 'react';
import { CustomTheme } from '@/types/gallery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ThemeEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme?: CustomTheme;
  onSave: (theme: Omit<CustomTheme, 'id'> & { id?: string }) => void;
}

export function ThemeEditorModal({
  open,
  onOpenChange,
  theme,
  onSave,
}: ThemeEditorModalProps) {
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#B87333');
  const [backgroundColor, setBackgroundColor] = useState('#FAFAF8');
  const [textColor, setTextColor] = useState('#2D2A26');
  const [accentColor, setAccentColor] = useState('#8B9A7D');

  useEffect(() => {
    if (theme) {
      setName(theme.name);
      setPrimaryColor(theme.primaryColor);
      setBackgroundColor(theme.backgroundColor);
      setTextColor(theme.textColor);
      setAccentColor(theme.accentColor);
    } else {
      setName('');
      setPrimaryColor('#B87333');
      setBackgroundColor('#FAFAF8');
      setTextColor('#2D2A26');
      setAccentColor('#8B9A7D');
    }
  }, [theme, open]);

  const handleSave = () => {
    onSave({
      id: theme?.id,
      name: name || 'Novo Tema',
      primaryColor,
      backgroundColor,
      textColor,
      accentColor,
      isDefault: theme?.isDefault || false,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{theme ? 'Editar Tema' : 'Novo Tema'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="themeName">Nome do Tema</Label>
            <Input
              id="themeName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Elegante, Moderno, Clássico..."
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="h-24 rounded-lg p-4 flex items-center justify-center"
              style={{ backgroundColor }}
            >
              <div className="text-center">
                <p className="font-medium" style={{ color: textColor }}>
                  Título da Galeria
                </p>
                <div className="flex gap-2 mt-2 justify-center">
                  <div
                    className="px-3 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Botão
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Destaque
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Color pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor Principal</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Cor de Fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="backgroundColor"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="textColor">Cor do Texto</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="textColor"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentColor">Cor de Destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accentColor"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="terracotta" onClick={handleSave}>
            Salvar Tema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
