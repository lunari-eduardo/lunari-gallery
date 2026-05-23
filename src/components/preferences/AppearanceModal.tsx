import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Monitor, Moon, Sun, RotateCcw } from 'lucide-react';
import { useVisualTheme } from '@/contexts/VisualThemeContext';
import { cn } from '@/lib/utils';
import type { VisualThemeMode } from '@/lib/visualTheme';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODES: { value: VisualThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Claro',   icon: <Sun className="h-3.5 w-3.5" /> },
  { value: 'dark',   label: 'Escuro',  icon: <Moon className="h-3.5 w-3.5" /> },
  { value: 'system', label: 'Sistema', icon: <Monitor className="h-3.5 w-3.5" /> },
];

export function AppearanceModal({ open, onOpenChange }: Props) {
  const { theme, presets, setPreset, setMode, reset } = useVisualTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Aparência</DialogTitle>
          <DialogDescription className="text-xs">
            Escolha a cor do seu Lunari. Sua preferência é sincronizada entre o Studio e o Gallery em todos os dispositivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">Cor do tema</div>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p) => {
                const selected = theme.presetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className={cn(
                      'group relative flex flex-col items-center gap-1.5 rounded-lg p-2 border transition-all',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-foreground/30 hover:bg-muted/40',
                    )}
                    aria-pressed={selected}
                    title={p.name}
                  >
                    <span
                      className="relative inline-flex h-9 w-9 rounded-full ring-1 ring-border/60"
                      style={{ background: p.hex }}
                    >
                      {selected && (
                        <Check
                          className="absolute inset-0 m-auto h-4 w-4"
                          style={{ color: needsDarkCheck(p.hex) ? '#111' : '#fff' }}
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    <span className="text-[10px] leading-tight text-foreground truncate w-full text-center">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">Modo</div>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => {
                const selected = theme.mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium border transition-all',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização</div>
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">Lunari Gallery</div>
                <Badge>Premium</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Textos, ícones e botões mantêm contraste em ambos os modos.
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm">Primário</Button>
                <Button size="sm" variant="outline">Secundário</Button>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Restaurar padrão
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>Concluir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function needsDarkCheck(hex: string): boolean {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m) return false;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}
