import { useState } from 'react';
import { Tag, Package, Plus, Trash2, Save, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { DiscountPackage, DiscountPreset, PricingModel } from '@/types/gallery';
import { sanitizeExtraPrice } from '@/lib/pricingUtils';
import { generateId } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { toast } from 'sonner';

interface PricingModelEditorProps {
  pricingModel: PricingModel;
  onPricingModelChange: (model: PricingModel) => void;
  fixedPrice: number;
  onFixedPriceChange: (price: number) => void;
  discountPackages: DiscountPackage[];
  onDiscountPackagesChange: (packages: DiscountPackage[]) => void;
  disabled?: boolean;
  /**
   * Quando true, oculta o RadioGroup interno de seleção de modo.
   * Usado pela tela de edição, onde o modo é controlado por cards colapsáveis externos.
   */
  hideModeSelector?: boolean;
}

/**
 * Editor de modelo de preço + tabela progressiva, reutilizável entre
 * GalleryCreate e GalleryEdit. Mantém a MESMA lógica de manipulação de
 * faixas, presets e validações para garantir paridade entre os dois fluxos.
 */
export function PricingModelEditor({
  pricingModel,
  onPricingModelChange,
  fixedPrice,
  onFixedPriceChange,
  discountPackages,
  onDiscountPackagesChange,
  disabled = false,
  hideModeSelector = false,
}: PricingModelEditorProps) {
  const { settings } = useSettings();
  const { createDiscountPreset, updateDiscountPreset, deleteDiscountPreset } = useGallerySettings();

  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [renamingPreset, setRenamingPreset] = useState<DiscountPreset | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const addDiscountPackage = () => {
    const updated = [...discountPackages];
    // Fecha automaticamente a faixa anterior "infinita" para permitir uma nova faixa depois.
    if (updated.length > 0) {
      const lastIdx = updated.length - 1;
      const last = updated[lastIdx];
      if (last.maxPhotos === null) {
        // Fecha em (min + 4) para 5-faixa por padrão; usuário revisa depois.
        updated[lastIdx] = { ...last, maxPhotos: Math.max(last.minPhotos, last.minPhotos + 4) };
      }
    }
    const last = updated[updated.length - 1];
    // "De" = último "Até" + 1. Preço novo fica vazio (0) para o usuário digitar.
    const minPhotos = last ? (last.maxPhotos as number) + 1 : 1;
    onDiscountPackagesChange([
      ...updated,
      {
        id: generateId(),
        minPhotos,
        maxPhotos: null,
        pricePerPhoto: 0,
      },
    ]);
  };

  const updatePackage = (id: string, field: keyof DiscountPackage, value: number | null) => {
    const idx = discountPackages.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const next = discountPackages.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg));

    // Auto-propaga: ao editar "Até" de uma faixa intermediária, ajusta "De" da próxima
    // se ela ficou <= novo Até. Assim o usuário nunca precisa recalcular manualmente.
    if (field === 'maxPhotos' && typeof value === 'number' && idx < next.length - 1) {
      const nextIdx = idx + 1;
      const nextPkg = next[nextIdx];
      if (nextPkg.minPhotos <= value) {
        next[nextIdx] = { ...nextPkg, minPhotos: value + 1 };
      }
    }

    onDiscountPackagesChange(next);
  };

  const removePackage = (id: string) => {
    onDiscountPackagesChange(discountPackages.filter((pkg) => pkg.id !== id));
  };

  const loadPreset = (presetId: string) => {
    const preset = settings.discountPresets?.find((p) => p.id === presetId);
    if (preset) {
      const cloned = preset.packages.map((pkg) => ({ ...pkg, id: generateId() }));
      onDiscountPackagesChange(cloned);
      toast.success(`Predefinição "${preset.name}" carregada`);
    }
  };

  const savePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) {
      toast.error('Digite um nome para a predefinição');
      return;
    }
    const existing = settings.discountPresets || [];
    if (existing.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma predefinição com esse nome');
      return;
    }
    createDiscountPreset(
      { name: trimmed, packages: discountPackages },
      {
        onSuccess: () => {
          toast.success('Predefinição salva');
          setPresetName('');
          setShowSavePresetDialog(false);
        },
        onError: () => toast.error('Erro ao salvar predefinição'),
      } as any,
    );
  };

  const renamePreset = () => {
    if (!renamingPreset) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error('Digite um nome');
      return;
    }
    const others = (settings.discountPresets || []).filter((p) => p.id !== renamingPreset.id);
    if (others.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma predefinição com esse nome');
      return;
    }
    updateDiscountPreset(
      { ...renamingPreset, name: trimmed },
      {
        onSuccess: () => {
          toast.success('Predefinição renomeada');
          setRenamingPreset(null);
          setRenameValue('');
        },
        onError: () => toast.error('Erro ao renomear'),
      } as any,
    );
  };

  const confirmDeletePreset = () => {
    if (!deletingPresetId) return;
    deleteDiscountPreset(deletingPresetId, {
      onSuccess: () => {
        toast.success('Predefinição excluída');
        setDeletingPresetId(null);
      },
      onError: () => toast.error('Erro ao excluir'),
    } as any);
  };

  return (
    <div className="space-y-4">
      {!hideModeSelector && (
        <div className="space-y-4">
          <Label className="text-base font-medium">Qual formato de preço?</Label>
          <RadioGroup
            value={pricingModel}
            onValueChange={(v) => onPricingModelChange(v as PricingModel)}
            className="flex flex-col gap-3"
            disabled={disabled}
          >
            <div>
              <RadioGroupItem value="fixed" id="pricing-fixed-edit" className="peer sr-only" />
              <Label
                htmlFor="pricing-fixed-edit"
                className={cn(
                  'flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  'hover:border-primary/50 hover:bg-muted/50',
                  pricingModel === 'fixed' ? 'border-primary bg-primary/5' : 'border-border',
                  disabled && 'opacity-60 pointer-events-none',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      pricingModel === 'fixed' ? 'bg-primary/20' : 'bg-muted',
                    )}
                  >
                    <Tag
                      className={cn(
                        'h-4 w-4',
                        pricingModel === 'fixed' ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                  </div>
                  <div>
                    <p className="font-medium">Preço único por foto</p>
                    <p className="text-xs text-muted-foreground">
                      Defina um valor fixo para cada foto
                    </p>
                  </div>
                </div>

                {pricingModel === 'fixed' && (
                  <div className="pt-3 border-t border-border/50">
                    <Label htmlFor="fixedPrice-edit" className="text-sm">
                      Valor por foto (R$)
                    </Label>
                    <Input
                      id="fixedPrice-edit"
                      type="number"
                      min={0}
                      max={999.99}
                      step={0.01}
                      value={fixedPrice || ''}
                      onChange={(e) =>
                        onFixedPriceChange(
                          e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                        )
                      }
                      onBlur={(e) => {
                        const sanitized = sanitizeExtraPrice(e.target.value);
                        if (sanitized !== fixedPrice) onFixedPriceChange(sanitized);
                      }}
                      className="mt-2"
                      onClick={(e) => e.stopPropagation()}
                      disabled={disabled}
                    />
                  </div>
                )}
              </Label>
            </div>

            <div>
              <RadioGroupItem value="packages" id="pricing-packages-edit" className="peer sr-only" />
              <Label
                htmlFor="pricing-packages-edit"
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all relative',
                  'hover:border-primary/50 hover:bg-muted/50',
                  pricingModel === 'packages' ? 'border-primary bg-primary/5' : 'border-border',
                  disabled && 'opacity-60 pointer-events-none',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    pricingModel === 'packages' ? 'bg-primary/20' : 'bg-muted',
                  )}
                >
                  <Package
                    className={cn(
                      'h-4 w-4',
                      pricingModel === 'packages' ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium">Pacotes com descontos</p>
                  <p className="text-xs text-muted-foreground">
                    Descontos progressivos por quantidade
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {pricingModel === 'packages' && (
        <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-medium">Configurar faixas</Label>
            <div className="flex gap-2 flex-wrap">
              {discountPackages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSavePresetDialog(true)}
                  className="gap-1"
                  disabled={disabled}
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDiscountPackage}
                className="gap-1"
                disabled={disabled}
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>

          {discountPackages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Adicione faixas para definir preços por quantidade
            </p>
          ) : (
            <div className="space-y-3">
              {discountPackages.map((pkg, index) => (
                <div
                  key={pkg.id}
                  className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border/50"
                >
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">De</Label>
                      <Input
                        type="number"
                        min={1}
                        value={pkg.minPhotos}
                        onChange={(e) =>
                          updatePackage(pkg.id, 'minPhotos', parseInt(e.target.value) || 1)
                        }
                        className="h-8"
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Até</Label>
                      {index === discountPackages.length - 1 ? (
                        <Input
                          type="text"
                          value={pkg.maxPhotos === null ? '∞' : pkg.maxPhotos}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '∞') {
                              updatePackage(pkg.id, 'maxPhotos', null);
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) updatePackage(pkg.id, 'maxPhotos', num);
                            }
                          }}
                          placeholder="∞"
                          className="h-8 text-center"
                          disabled={disabled}
                        />
                      ) : (
                        <Input
                          type="number"
                          min={pkg.minPhotos}
                          value={pkg.maxPhotos ?? ''}
                          onChange={(e) =>
                            updatePackage(
                              pkg.id,
                              'maxPhotos',
                              parseInt(e.target.value) || pkg.minPhotos,
                            )
                          }
                          className="h-8"
                          disabled={disabled}
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">R$</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={pkg.pricePerPhoto || ''}
                        onChange={(e) =>
                          updatePackage(pkg.id, 'pricePerPhoto', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))
                        }
                        className="h-8"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePackage(pkg.id)}
                    className="text-destructive hover:text-destructive h-8 w-8"
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {settings.discountPresets && settings.discountPresets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Predefinições salvas
              </Label>
              <div className="space-y-1.5">
                {settings.discountPresets.map((preset) => {
                  const prices = preset.packages
                    .map((p) => p.pricePerPhoto)
                    .filter((v) => typeof v === 'number');
                  const minP = prices.length ? Math.min(...prices) : 0;
                  const maxP = prices.length ? Math.max(...prices) : 0;
                  const priceLabel = prices.length
                    ? minP === maxP
                      ? `R$ ${minP.toFixed(2)}`
                      : `R$ ${minP.toFixed(2)}–${maxP.toFixed(2)}`
                    : '—';
                  return (
                    <div
                      key={preset.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{preset.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {preset.packages.length} faixa
                          {preset.packages.length !== 1 ? 's' : ''} · {priceLabel}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadPreset(preset.id)}
                        className="h-7 text-xs"
                        disabled={disabled}
                      >
                        Carregar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setRenamingPreset(preset);
                          setRenameValue(preset.name);
                        }}
                        disabled={disabled}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletingPresetId(preset.id)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showSavePresetDialog} onOpenChange={setShowSavePresetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar predefinição de faixas</DialogTitle>
            <DialogDescription>
              Salve esta configuração de faixas para reutilizar em outras galerias
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="presetName-edit">Nome da predefinição</Label>
              <Input
                id="presetName-edit"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Ex: Casamentos, Ensaios..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSavePresetDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={savePreset}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renamingPreset} onOpenChange={(open) => !open && setRenamingPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear predefinição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Novo nome"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingPreset(null)}>
              Cancelar
            </Button>
            <Button onClick={renamePreset}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPresetId} onOpenChange={(open) => !open && setDeletingPresetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir predefinição?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A predefinição será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePreset}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
