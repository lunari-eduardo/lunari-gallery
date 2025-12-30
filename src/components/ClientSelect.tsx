import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Client } from '@/types/gallery';

interface ClientSelectProps {
  clients: Client[];
  selectedClient: Client | null;
  onSelect: (client: Client | null) => void;
  onCreateNew: () => void;
}

export function ClientSelect({ clients, selectedClient, onSelect, onCreateNew }: ClientSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal"
        >
          {selectedClient ? (
            <span className="truncate">{selectedClient.name}</span>
          ) : (
            <span className="text-muted-foreground">Selecione ou busque um cliente...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center">
                <User className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`${client.name} ${client.email}`}
                  onSelect={() => {
                    onSelect(client);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo cliente
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
