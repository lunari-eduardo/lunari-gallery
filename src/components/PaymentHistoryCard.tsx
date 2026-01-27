import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CreditCard, 
  ExternalLink, 
  Receipt,
  Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Cobranca {
  id: string;
  valor: number;
  qtd_fotos: number | null;
  provedor: string | null;
  data_pagamento: string | null;
  ip_receipt_url: string | null;
  created_at: string;
}

interface PaymentHistoryCardProps {
  cobrancas: Cobranca[];
  valorTotalPago: number;
  totalFotosExtrasVendidas: number;
}

const provedorLabels: Record<string, string> = {
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  pix_manual: 'PIX Manual',
};

export function PaymentHistoryCard({
  cobrancas,
  valorTotalPago,
  totalFotosExtrasVendidas,
}: PaymentHistoryCardProps) {
  if (cobrancas.length === 0) {
    return null;
  }

  return (
    <Card className="lunari-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Histórico de Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total pago</p>
            <p className="text-lg font-semibold text-primary">
              R$ {valorTotalPago.toFixed(2)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm text-muted-foreground">Fotos extras pagas</p>
            <p className="text-lg font-semibold">{totalFotosExtrasVendidas}</p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {cobrancas.length} transação{cobrancas.length > 1 ? 'ões' : ''}
          </p>
          
          {cobrancas.map((cobranca) => (
            <div 
              key={cobranca.id} 
              className="p-3 rounded-lg border border-border/50 bg-background space-y-2"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {cobranca.data_pagamento 
                      ? format(new Date(cobranca.data_pagamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : format(new Date(cobranca.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    }
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {cobranca.qtd_fotos && cobranca.qtd_fotos > 0 && (
                      <span className="flex items-center gap-1">
                        <Image className="h-3 w-3" />
                        {cobranca.qtd_fotos} foto{cobranca.qtd_fotos > 1 ? 's' : ''} extra{cobranca.qtd_fotos > 1 ? 's' : ''}
                      </span>
                    )}
                    {cobranca.provedor && (
                      <span>• {provedorLabels[cobranca.provedor] || cobranca.provedor}</span>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-primary">
                  R$ {Number(cobranca.valor).toFixed(2)}
                </p>
              </div>

              {cobranca.ip_receipt_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs w-full justify-start"
                  asChild
                >
                  <a href={cobranca.ip_receipt_url} target="_blank" rel="noopener noreferrer">
                    <Receipt className="h-3 w-3 mr-1.5" />
                    Ver comprovante
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
