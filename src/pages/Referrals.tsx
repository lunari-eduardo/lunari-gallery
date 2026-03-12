import { Gift, Users, CreditCard, HardDrive, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReferrals } from '@/hooks/useReferrals';
import { formatStorageSize } from '@/lib/transferPlans';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Referrals() {
  const {
    referralCode,
    referralLink,
    referrals,
    totalReferrals,
    creditsEarned,
    storageBonusBytes,
    activeTransferReferrals,
    isLoading,
  } = useReferrals();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Indique e Ganhe
        </h1>
        <p className="text-muted-foreground mt-1">
          Indique amigos e ganhe bônus em créditos e armazenamento.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Indicados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {activeTransferReferrals > 0 && `${activeTransferReferrals} com plano ativo`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Créditos Ganhos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditsEarned.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              +1.000 por indicado que compra créditos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Armazenamento Bônus</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {storageBonusBytes > 0 ? `+${formatStorageSize(storageBonusBytes)}` : '0 GB'}
            </div>
            <p className="text-xs text-muted-foreground">
              +10% do plano de cada indicado ativo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle>Seu link de indicação</CardTitle>
          <CardDescription>
            Compartilhe este link com amigos fotógrafos. Quando eles se cadastrarem e fizerem a primeira compra, vocês dois ganham bônus!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralLink ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 rounded-lg bg-muted font-mono text-sm break-all">
                {referralLink}
              </div>
              <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Gerando código de indicação...</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border">
              <p className="text-sm font-medium">🎟 Gallery Select</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ambos recebem <strong>+1.000 créditos</strong> na primeira compra do indicado.
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-sm font-medium">☁ Gallery Transfer</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ambos recebem <strong>+10% do plano</strong> em armazenamento bônus enquanto ativo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Seus indicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.map((ref) => {
                const name = ref.referred_name || 'Usuário';
                const maskedName = name.length > 3
                  ? name.substring(0, 3) + '***'
                  : name;
                
                return (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{maskedName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ref.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ref.select_bonus_granted ? 'default' : 'secondary'}>
                        {ref.select_bonus_granted ? 'Créditos ✓' : 'Pendente'}
                      </Badge>
                      {ref.transfer_bonus_bytes > 0 && (
                        <Badge variant={ref.transfer_bonus_active ? 'default' : 'outline'}>
                          {ref.transfer_bonus_active
                            ? `+${formatStorageSize(ref.transfer_bonus_bytes)}`
                            : 'Cancelado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {referrals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Nenhum indicado ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Compartilhe seu link acima e comece a ganhar bônus!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
