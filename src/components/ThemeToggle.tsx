import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const cycleOrder = ['light', 'dark', 'system'] as const;
const labels: Record<string, string> = { light: 'Claro', dark: 'Escuro', system: 'Sistema' };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleCycle = () => {
    const currentIndex = cycleOrder.indexOf(theme as any);
    const next = cycleOrder[(currentIndex + 1) % cycleOrder.length];
    setTheme(next);
  };

  const Icon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={handleCycle} className="relative">
          <Icon className="h-5 w-5 transition-all" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{labels[theme] || 'Claro'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
