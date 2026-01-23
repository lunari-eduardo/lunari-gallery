import { useState } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { GestaoPackage } from '@/hooks/useGestaoPackages';

interface PackageSelectProps {
  packages: GestaoPackage[];
  selectedPackage: string;
  onSelect: (packageName: string, pkg?: GestaoPackage) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PackageSelect({
  packages,
  selectedPackage,
  onSelect,
  placeholder = 'Selecionar pacote...',
  disabled = false,
}: PackageSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (pkg: GestaoPackage) => {
    onSelect(pkg.nome, pkg);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedPackage && 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedPackage || placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar pacote..." />
          <CommandList>
            <CommandEmpty>Nenhum pacote encontrado.</CommandEmpty>
            <CommandGroup>
              {packages.map((pkg) => (
                <CommandItem
                  key={pkg.id}
                  value={pkg.nome}
                  onSelect={() => handleSelect(pkg)}
                  className="flex flex-col items-start gap-1 py-3"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">{pkg.nome}</span>
                    {selectedPackage === pkg.nome && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  {(pkg.fotosIncluidas || pkg.valorFotoExtra) && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {pkg.fotosIncluidas && (
                        <span>{pkg.fotosIncluidas} fotos</span>
                      )}
                      {pkg.valorFotoExtra && (
                        <span>R$ {pkg.valorFotoExtra.toFixed(2)}/extra</span>
                      )}
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
