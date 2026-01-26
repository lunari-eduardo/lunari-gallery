import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Smartphone, Zap, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentIntegration, PixManualData, InfinitePayData } from '@/hooks/usePaymentIntegration';

interface PaymentMethodSelectorProps {
  integrations: PaymentIntegration[];
  selectedMethod: string | null;
  onSelect: (method: string) => void;
}

export function PaymentMethodSelector({ 
  integrations, 
  selectedMethod, 
  onSelect 
}: PaymentMethodSelectorProps) {
  if (integrations.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Nenhum método de pagamento configurado.{' '}
          <a href="/settings" className="underline font-medium">
            Configurar agora
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Método de cobrança</Label>
      
      <RadioGroup 
        value={selectedMethod || ''} 
        onValueChange={onSelect}
        className="flex flex-col gap-2"
      >
        {integrations.map((integration) => {
          const isPixManual = integration.provedor === 'pix_manual';
          const isInfinitePay = integration.provedor === 'infinitepay';
          const isMercadoPago = integration.provedor === 'mercadopago';
          
          return (
            <div key={integration.id}>
              <RadioGroupItem 
                value={integration.provedor} 
                id={`payment-${integration.provedor}`} 
                className="peer sr-only" 
              />
              <Label 
                htmlFor={`payment-${integration.provedor}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  selectedMethod === integration.provedor 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/30"
                )}
              >
                {isPixManual && (
                  <>
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">PIX Manual</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(integration.dadosExtras as PixManualData)?.nomeTitular || 'Chave configurada'}
                      </p>
                    </div>
                  </>
                )}
                
                {isInfinitePay && (
                  <>
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">InfinitePay</p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{(integration.dadosExtras as InfinitePayData)?.handle || 'handle'}
                      </p>
                    </div>
                  </>
                )}
                
                {isMercadoPago && (
                  <>
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Mercado Pago</p>
                      <p className="text-xs text-muted-foreground">
                        Checkout automático
                      </p>
                    </div>
                  </>
                )}
                
                {integration.isDefault && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Padrão
                  </Badge>
                )}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      
      {/* Warning for PIX Manual */}
      {selectedMethod === 'pix_manual' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          Confirmação manual: você precisará verificar o recebimento
        </p>
      )}
    </div>
  );
}
