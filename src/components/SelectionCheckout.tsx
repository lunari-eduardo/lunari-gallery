import { ArrowLeft, Camera, Check, AlertTriangle, CreditCard, Receipt, TrendingDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Gallery } from '@/types/gallery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularPrecoProgressivo, RegrasCongeladas } from '@/lib/pricingUtils';

interface SelectionCheckoutProps {
  gallery: Gallery;
  selectedCount: number;
  extraCount: number;
  regrasCongeladas?: RegrasCongeladas | null;
  hasPaymentProvider?: boolean;
  isConfirming?: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export function SelectionCheckout({ 
  gallery, 
  selectedCount, 
  extraCount,
  regrasCongeladas,
  hasPaymentProvider = false,
  isConfirming = false,
  onBack, 
  onConfirm 
}: SelectionCheckoutProps) {
  const currentDate = new Date();
  const { saleSettings } = gallery;
  const isNoSale = saleSettings?.mode === 'no_sale';
  const isWithPayment = saleSettings?.mode === 'sale_with_payment';
  
  // Calculate prices using progressive pricing
  const { valorUnitario, valorTotal, economia } = calcularPrecoProgressivo(
    extraCount,
    regrasCongeladas,
    gallery.extraPhotoPrice
  );
  
  // Build priceInfo for template compatibility
  const priceInfo = {
    chargeableCount: extraCount,
    total: valorTotal,
    pricePerPhoto: valorUnitario,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          
          <h1 className="font-display text-lg font-semibold">Confirmar Seleção</h1>
          
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-28">
        <div className="max-w-md mx-auto space-y-6">
          {/* Selection Summary Card */}
          <div className="lunari-card overflow-hidden">
            {/* Card Header */}
            <div className="bg-primary/10 p-4 flex items-center gap-3 border-b border-border/50">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Resumo da Seleção</h3>
                <p className="text-sm text-muted-foreground">
                  {format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Client Info */}
            <div className="p-4 border-b border-border/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{gallery.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sessão</span>
                <span className="font-medium">{gallery.sessionName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacote</span>
                <span className="font-medium">{gallery.packageName}</span>
              </div>
            </div>

            {/* Photo Breakdown */}
            <div className="p-4 border-b border-border/50 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fotos incluídas no pacote</span>
                <span className="font-medium">{gallery.includedPhotos}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fotos selecionadas</span>
                <span className="font-medium">{selectedCount}</span>
              </div>
              {!isNoSale && priceInfo.chargeableCount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {saleSettings?.chargeType === 'all_selected' ? 'Fotos cobradas' : 'Fotos extras'}
                    </span>
                    <span className="font-medium text-primary">{priceInfo.chargeableCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor por foto</span>
                    <span className="font-medium">R$ {priceInfo.pricePerPhoto.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Total - Only show if not no_sale and has chargeable photos */}
            {!isNoSale && priceInfo.chargeableCount > 0 && (
              <div className="p-4 bg-primary/5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-lg">Valor Adicional</p>
                    <p className="text-sm text-muted-foreground">
                      {priceInfo.chargeableCount} fotos × R$ {priceInfo.pricePerPhoto.toFixed(2)}
                    </p>
                  </div>
                  <p className="font-display text-2xl font-bold text-primary">
                    R$ {priceInfo.total.toFixed(2)}
                  </p>
                </div>
                
                {/* Savings indicator for progressive pricing */}
                {economia && economia > 0 && (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm">
                    <TrendingDown className="h-4 w-4 flex-shrink-0" />
                    <span>Você economizou R$ {economia.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* No extra charge message */}
            {(isNoSale || priceInfo.chargeableCount === 0) && (
              <div className="p-4 bg-green-500/10">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      {isNoSale ? 'Seleção concluída' : 'Seleção dentro do pacote'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isNoSale ? 'Sua seleção foi registrada' : 'Sem valor adicional a cobrar'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Notice - Only show if has chargeable photos */}
          {!isNoSale && priceInfo.chargeableCount > 0 && (
            <div className="lunari-card p-4 border-primary/30 bg-primary/5">
              <div className="flex gap-3">
                {isWithPayment ? (
                  <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                ) : (
                  <Receipt className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {isWithPayment ? 'Pagamento Online' : 'Cobrança Posterior'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isWithPayment 
                      ? (hasPaymentProvider 
                          ? 'Você será redirecionado para concluir o pagamento após confirmar.' 
                          : 'Pagamento online não disponível. O fotógrafo entrará em contato para cobrança.')
                      : `O valor adicional de R$ ${priceInfo.total.toFixed(2)} será cobrado posteriormente pelo fotógrafo.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning Notice */}
          <div className="lunari-card p-4 border-warning/30 bg-warning/5">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Atenção</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Após confirmar, você não poderá alterar sua seleção. 
                  Certifique-se de que escolheu todas as fotos desejadas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/50 p-4 z-50">
        <div className="max-w-md mx-auto">
          <Button 
            variant="terracotta" 
            size="xl" 
            className="w-full gap-2"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                {isWithPayment && hasPaymentProvider && priceInfo.chargeableCount > 0
                  ? 'Confirmar e Pagar'
                  : 'Confirmar Seleção Final'
                }
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
