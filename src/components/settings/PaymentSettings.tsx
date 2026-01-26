import { useState, useEffect } from 'react';
import { CreditCard, AlertTriangle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  usePaymentIntegration, 
  PixManualData, 
  InfinitePayData,
  PixKeyType,
  getProviderLabel,
  getPixKeyTypeLabel,
} from '@/hooks/usePaymentIntegration';
import { cn } from '@/lib/utils';

type PaymentMethod = 'none' | 'pix_manual' | 'infinitepay';

export function PaymentSettings() {
  const { 
    data, 
    isLoading, 
    savePixManual, 
    saveInfinitePay, 
    deactivateAll 
  } = usePaymentIntegration();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('none');
  
  // PIX Manual fields
  const [chavePix, setChavePix] = useState('');
  const [tipoChave, setTipoChave] = useState<PixKeyType>('email');
  const [nomeTitular, setNomeTitular] = useState('');

  // InfinitePay fields
  const [handle, setHandle] = useState('');

  // Load existing data when available
  useEffect(() => {
    if (data?.activeIntegration) {
      const integration = data.activeIntegration;
      
      if (integration.provedor === 'pix_manual') {
        setSelectedMethod('pix_manual');
        const pixData = integration.dadosExtras as PixManualData;
        if (pixData) {
          setChavePix(pixData.chavePix || '');
          setTipoChave(pixData.tipoChave || 'email');
          setNomeTitular(pixData.nomeTitular || '');
        }
      } else if (integration.provedor === 'infinitepay') {
        setSelectedMethod('infinitepay');
        const ipData = integration.dadosExtras as InfinitePayData;
        if (ipData) {
          setHandle(ipData.handle || '');
        }
      } else if (integration.provedor === 'mercadopago') {
        // Mercado Pago is read-only (configured via Gestão)
        setSelectedMethod('infinitepay');
      }
    }
  }, [data]);

  const handleSave = async () => {
    if (selectedMethod === 'none') {
      await deactivateAll.mutateAsync();
      return;
    }

    if (selectedMethod === 'pix_manual') {
      if (!chavePix.trim() || !nomeTitular.trim()) {
        return;
      }
      await savePixManual.mutateAsync({
        chavePix: chavePix.trim(),
        tipoChave,
        nomeTitular: nomeTitular.trim(),
      });
    } else if (selectedMethod === 'infinitepay') {
      if (!handle.trim()) {
        return;
      }
      await saveInfinitePay.mutateAsync({
        handle: handle.trim().replace('@', ''),
      });
    }
  };

  const isSaving = savePixManual.isPending || saveInfinitePay.isPending || deactivateAll.isPending;

  const canSave = () => {
    if (selectedMethod === 'none') return true;
    if (selectedMethod === 'pix_manual') return chavePix.trim() && nomeTitular.trim();
    if (selectedMethod === 'infinitepay') return handle.trim();
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if user has Mercado Pago configured via Gestão
  const hasMercadoPago = data?.allIntegrations.some(
    (i) => i.provedor === 'mercadopago' && i.status === 'ativo'
  );

  return (
    <div className="space-y-6">
      <div className="lunari-card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-full bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">
              Recebimento de Pagamentos
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure como você receberá pagamentos de fotos extras
            </p>
          </div>
        </div>

        {hasMercadoPago && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Mercado Pago configurado via Gestão</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Seu Mercado Pago está ativo. Alterar aqui irá substituir essa configuração.
            </p>
          </div>
        )}

        <RadioGroup
          value={selectedMethod}
          onValueChange={(value) => setSelectedMethod(value as PaymentMethod)}
          className="space-y-4"
        >
          {/* No payment option */}
          <div className={cn(
            "flex items-start space-x-3 p-4 rounded-lg border transition-colors",
            selectedMethod === 'none' 
              ? "border-primary bg-primary/5" 
              : "border-border hover:bg-muted/50"
          )}>
            <RadioGroupItem value="none" id="none" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="none" className="font-medium cursor-pointer">
                Sem método configurado
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Pagamentos serão tratados manualmente fora do sistema
              </p>
            </div>
          </div>

          {/* PIX Manual option */}
          <div className={cn(
            "rounded-lg border transition-colors",
            selectedMethod === 'pix_manual' 
              ? "border-primary bg-primary/5" 
              : "border-border hover:bg-muted/50"
          )}>
            <div className="flex items-start space-x-3 p-4">
              <RadioGroupItem value="pix_manual" id="pix_manual" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="pix_manual" className="font-medium cursor-pointer">
                  Chave PIX (Recebimento Direto)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Exibe QR Code e código PIX para o cliente. Você recebe sem taxas de gateway.
                </p>
              </div>
            </div>

            {selectedMethod === 'pix_manual' && (
              <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-warning-foreground">
                      <p className="font-medium">Confirmação manual necessária</p>
                      <p className="text-muted-foreground mt-1">
                        Você precisará verificar o recebimento e liberar a galeria manualmente 
                        após cada pagamento.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tipoChave">Tipo de Chave</Label>
                    <Select value={tipoChave} onValueChange={(v) => setTipoChave(v as PixKeyType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chavePix">Chave PIX</Label>
                    <Input
                      id="chavePix"
                      value={chavePix}
                      onChange={(e) => setChavePix(e.target.value)}
                      placeholder={
                        tipoChave === 'cpf' ? '000.000.000-00' :
                        tipoChave === 'email' ? 'seu@email.com' :
                        tipoChave === 'telefone' ? '+5511999999999' :
                        'Chave aleatória'
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomeTitular">Nome do Titular</Label>
                  <Input
                    id="nomeTitular"
                    value={nomeTitular}
                    onChange={(e) => setNomeTitular(e.target.value)}
                    placeholder="Nome completo conforme cadastrado no PIX"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este nome será exibido para o cliente no momento do pagamento
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* InfinitePay option */}
          <div className={cn(
            "rounded-lg border transition-colors",
            selectedMethod === 'infinitepay' 
              ? "border-primary bg-primary/5" 
              : "border-border hover:bg-muted/50"
          )}>
            <div className="flex items-start space-x-3 p-4">
              <RadioGroupItem value="infinitepay" id="infinitepay" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="infinitepay" className="font-medium cursor-pointer">
                  InfinitePay (Checkout Automático)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente é redirecionado para checkout seguro. Confirmação automática.
                </p>
              </div>
            </div>

            {selectedMethod === 'infinitepay' && (
              <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-green-700 dark:text-green-300">
                        Confirmação automática
                      </p>
                      <p className="text-green-600 dark:text-green-400 mt-1">
                        O sistema libera a galeria automaticamente após o pagamento ser confirmado.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="handle">Handle InfinitePay</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">@</span>
                    <Input
                      id="handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.replace('@', ''))}
                      placeholder="seuusuario"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Seu nome de usuário na InfinitePay (ex: @meuestudio)
                  </p>
                </div>

                <a
                  href="https://infinitepay.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Não tem conta? Criar conta InfinitePay
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </RadioGroup>

        <div className="mt-6 flex justify-end">
          <Button
            variant="terracotta"
            onClick={handleSave}
            disabled={isSaving || !canSave()}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </Button>
        </div>
      </div>

      {/* Current status display */}
      {data?.activeIntegration && (
        <div className="lunari-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                data.activeIntegration.status === 'ativo' ? "bg-green-500" : "bg-muted"
              )} />
              <div>
                <p className="font-medium">
                  {getProviderLabel(data.activeIntegration.provedor)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.activeIntegration.provedor === 'pix_manual' && (
                    <>
                      {getPixKeyTypeLabel((data.activeIntegration.dadosExtras as PixManualData)?.tipoChave)} • 
                      {(data.activeIntegration.dadosExtras as PixManualData)?.chavePix}
                    </>
                  )}
                  {data.activeIntegration.provedor === 'infinitepay' && (
                    <>@{(data.activeIntegration.dadosExtras as InfinitePayData)?.handle}</>
                  )}
                </p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Ativo
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
