import { Gallery } from '@/types/gallery';
import { Check, AlertCircle, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SelectionSummaryProps {
  gallery: Gallery;
  onConfirm?: () => void;
  onExport?: () => void;
  isClient?: boolean;
}

export function SelectionSummary({ gallery, onConfirm, onExport, isClient = false }: SelectionSummaryProps) {
  const { includedPhotos, selectedCount, extraCount, extraPhotoPrice, extraTotal, selectionStatus } = gallery;
  const isOverLimit = selectedCount > includedPhotos;
  const isConfirmed = selectionStatus === 'confirmed';
  const isBlocked = selectionStatus === 'blocked';

  return (
    <div className="lunari-card p-4 md:p-6 space-y-4">
      <h3 className="font-display text-lg font-semibold">Resumo da Seleção</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fotos incluídas</span>
          <span className="font-medium">{includedPhotos}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Selecionadas</span>
          <span className={cn(
            'font-medium',
            isOverLimit ? 'text-primary' : 'text-foreground'
          )}>
            {selectedCount}
          </span>
        </div>

        {isOverLimit && (
          <>
            <div className="h-px bg-border" />
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fotos extras</span>
              <span className="font-medium text-primary">+{extraCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor por extra</span>
              <span className="font-medium">R$ {extraPhotoPrice.toFixed(2)}</span>
            </div>
            
            <div className="h-px bg-border" />
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Valor adicional</span>
              <span className="text-lg font-bold text-primary">
                R$ {extraTotal.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      {isOverLimit && gallery.settings.allowExtraPhotos && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-primary">
            Você selecionou {extraCount} foto{extraCount > 1 ? 's' : ''} além do pacote. 
            O valor adicional será cobrado posteriormente.
          </p>
        </div>
      )}

      {isClient && !isConfirmed && !isBlocked && (
        <Button 
          onClick={onConfirm}
          variant="terracotta"
          className="w-full"
          size="lg"
        >
          <Check className="h-4 w-4 mr-2" />
          Confirmar Seleção
        </Button>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm">
          <Check className="h-4 w-4 flex-shrink-0" />
          <p>Seleção confirmada com sucesso!</p>
        </div>
      )}

      {!isClient && onExport && (
        <div className="flex gap-2">
          <Button 
            onClick={onExport}
            variant="outline"
            className="flex-1"
          >
            <FileText className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button 
            onClick={onExport}
            variant="outline"
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Lista de Arquivos
          </Button>
        </div>
      )}
    </div>
  );
}
