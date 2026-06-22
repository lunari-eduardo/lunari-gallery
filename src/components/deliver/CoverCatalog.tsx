import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { COVER_LIST, DEFAULT_COVER_ID } from './covers/registry';

interface Props {
  /** Valor atual. `null`/`undefined` representa "Usar padrão do fotógrafo". */
  selectedCoverId: string | null | undefined;
  onSelect: (coverId: string | null) => void;
  /** Se true, mostra a opção "Herdar padrão do fotógrafo". */
  allowInherit?: boolean;
  /** Texto da opção "herdar" (mostra qual é o default). */
  inheritLabel?: string;
}

export function CoverCatalog({
  selectedCoverId,
  onSelect,
  allowInherit = true,
  inheritLabel = 'Usar capa padrão do meu estúdio',
}: Props) {
  return (
    <div className="space-y-4">
      {allowInherit && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between',
            selectedCoverId == null
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border hover:bg-muted'
          )}
        >
          <div>
            <p className="text-sm font-medium">{inheritLabel}</p>
            <p className="text-xs text-muted-foreground">Acompanha o padrão definido em Configurações</p>
          </div>
          {selectedCoverId == null && <Check className="h-4 w-4 text-primary" />}
        </button>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {COVER_LIST.map((cover) => {
          const isSelected = selectedCoverId === cover.id;
          const Thumb = cover.Thumbnail;
          return (
            <button
              key={cover.id}
              type="button"
              onClick={() => onSelect(cover.id)}
              className={cn(
                'group text-left rounded-xl border overflow-hidden transition-all',
                isSelected
                  ? 'border-primary ring-2 ring-primary'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <div className="relative aspect-[16/10] bg-muted">
                <Thumb className="absolute inset-0 w-full h-full" />
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <p className="text-sm font-medium leading-tight">
                  {cover.name}
                  {cover.id === DEFAULT_COVER_ID && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                      padrão
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                  {cover.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
