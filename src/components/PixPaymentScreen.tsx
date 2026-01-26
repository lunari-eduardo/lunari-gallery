import { useEffect, useState } from 'react';
import { Copy, CheckCircle, Clock, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface PixPaymentScreenProps {
  chavePix: string;
  nomeTitular: string;
  tipoChave?: string;
  valorTotal: number;
  studioName?: string;
  studioLogoUrl?: string;
  onBack?: () => void;
}

export function PixPaymentScreen({
  chavePix,
  nomeTitular,
  tipoChave,
  valorTotal,
  studioName,
  studioLogoUrl,
  onBack,
}: PixPaymentScreenProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Generate PIX payload (simplified - real implementation would use BR Code standard)
  const pixPayload = `${chavePix}`;

  useEffect(() => {
    // Generate QR Code from PIX key
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
      await navigator.clipboard.writeText(chavePix);
      setCopied(true);
      toast.success('Chave PIX copiada!');
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

        {/* PIX Key Copy */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {getTipoChaveLabel(tipoChave)}
          </p>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <code className="flex-1 text-sm break-all text-left">
              {chavePix}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className={cn(
                "shrink-0 transition-colors",
                copied && "text-green-600"
              )}
            >
              {copied ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
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
