import { useEffect, useState } from 'react';
import { Copy, CheckCircle, Clock, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { generatePixPayload } from '@/lib/pixGenerator';

interface PixPaymentScreenProps {
  chavePix: string;
  nomeTitular: string;
  tipoChave?: string;
  valorTotal: number;
  studioName?: string;
  studioLogoUrl?: string;
  onBack?: () => void;
  onPaymentConfirmed?: () => void;
}

export function PixPaymentScreen({
  chavePix,
  nomeTitular,
  tipoChave,
  valorTotal,
  studioName,
  studioLogoUrl,
  onBack,
  onPaymentConfirmed,
}: PixPaymentScreenProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Generate valid PIX EMV payload with value
  const pixPayload = generatePixPayload({
    chavePix,
    nomeBeneficiario: nomeTitular,
    valor: valorTotal,
  });

  useEffect(() => {
    // Generate QR Code from PIX EMV payload
    QRCode.toDataURL(pixPayload, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Error generating QR Code:', err));
  }, [pixPayload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const getTipoChaveLabel = (tipo?: string) => {
    switch (tipo) {
      case 'cpf': return 'CPF';
      case 'cnpj': return 'CNPJ';
      case 'email': return 'E-mail';
      case 'telefone': return 'Telefone';
      case 'aleatoria': return 'Chave Aleatória';
      default: return 'Chave PIX';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Studio Logo/Name */}
        {studioLogoUrl ? (
          <img 
            src={studioLogoUrl} 
            alt={studioName || 'Estúdio'} 
            className="h-12 mx-auto object-contain"
          />
        ) : studioName ? (
          <h1 className="font-display text-xl font-semibold">{studioName}</h1>
        ) : null}

        {/* Title */}
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold">
            Pagamento via PIX
          </h2>
          <p className="text-muted-foreground">
            Escaneie o QR Code ou copie a chave para pagar
          </p>
        </div>

        {/* QR Code */}
        <div className="lunari-card p-6 inline-block mx-auto">
          {qrCodeUrl ? (
            <img 
              src={qrCodeUrl} 
              alt="QR Code PIX" 
              className="w-56 h-56 mx-auto"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center bg-muted rounded-lg">
              <QrCode className="h-12 w-12 text-muted-foreground animate-pulse" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="lunari-card p-4">
          <p className="text-sm text-muted-foreground mb-1">Valor do pagamento</p>
          <p className="font-display text-3xl font-bold text-green-600 dark:text-green-400">
            R$ {valorTotal.toFixed(2)}
          </p>
        </div>

        {/* PIX Copia e Cola */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            PIX Copia e Cola
          </p>
          <div className="relative">
            <div className="p-3 rounded-lg bg-muted/50 border max-h-24 overflow-y-auto">
              <code className="text-xs break-all text-left font-mono text-muted-foreground">
                {pixPayload}
              </code>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="absolute top-2 right-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {getTipoChaveLabel(tipoChave)}: {chavePix} • Titular: {nomeTitular}
          </p>
        </div>

        {/* Recipient Info */}
        <div className="text-sm text-muted-foreground">
          <p>Titular: <span className="font-medium text-foreground">{nomeTitular}</span></p>
        </div>

        {/* Waiting Notice */}
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-warning-foreground">
                Aguardando confirmação
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Após realizar o pagamento, o fotógrafo irá confirmar o recebimento 
                e liberar sua galeria. Isso pode levar algumas horas.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Confirmed Button */}
        {onPaymentConfirmed && (
          <Button
            variant="terracotta"
            onClick={onPaymentConfirmed}
            className="w-full"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Já realizei o pagamento
          </Button>
        )}

        {/* Back button */}
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-full"
          >
            Voltar para a galeria
          </Button>
        )}

        {/* Security notice */}
        <p className="text-xs text-muted-foreground">
          Pague diretamente ao fotógrafo via PIX.
          <br />
          Nunca compartilhe senhas ou dados sensíveis.
        </p>
      </div>
    </div>
  );
}
