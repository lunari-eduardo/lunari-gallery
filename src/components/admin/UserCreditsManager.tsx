import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Search, Plus, User, Mail, Coins, History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserSearchResult {
  id: string;
  email: string;
  photoCredits: number;
  createdAt: string;
}

interface CreditGrant {
  id: string;
  amount: number;
  reason: string | null;
  granted_at: string;
  target_email: string;
}

export function UserCreditsManager() {
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Search for user by email
  const searchUser = async () => {
    if (!searchEmail.trim()) {
      toast.error('Digite um email para buscar');
      return;
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, email')
      .ilike('email', `%${searchEmail}%`)
      .limit(1);

    if (error) {
      console.error('Error searching user:', error);
      toast.error('Erro ao buscar usuário');
      return;
    }

    if (!profiles || profiles.length === 0) {
      toast.error('Usuário não encontrado');
      return;
    }

    const profile = profiles[0];
    
    // Get photo credits
    const { data: balance } = await supabase.rpc('get_photo_credit_balance', {
      _user_id: profile.user_id,
    });

    setSelectedUser({
      id: profile.user_id,
      email: profile.email || '',
      photoCredits: balance ?? 0,
      createdAt: new Date().toISOString(),
    });
  };

  // Fetch recent grants for selected user
  const { data: recentGrants } = useQuery({
    queryKey: ['admin-grants', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return [];

      const { data, error } = await supabase
        .from('admin_credit_grants')
        .select('id, amount, reason, granted_at, target_email')
        .eq('target_user_id', selectedUser.id)
        .order('granted_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching grants:', error);
        return [];
      }

      return data as CreditGrant[];
    },
    enabled: !!selectedUser?.id,
  });

  // Grant credits mutation
  const grantCreditsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('No user selected');
      
      const amount = parseInt(creditAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Quantidade inválida');
      }

      const { data, error } = await supabase.rpc('admin_grant_credits', {
        _target_user_id: selectedUser.id,
        _amount: amount,
        _reason: reason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`${creditAmount} créditos adicionados com sucesso!`);
      setCreditAmount('');
      setReason('');
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-grants', selectedUser?.id] });
      
      // Update selected user's balance
      if (selectedUser) {
        const newBalance = selectedUser.photoCredits + parseInt(creditAmount);
        setSelectedUser({ ...selectedUser, photoCredits: newBalance });
      }
    },
    onError: (error) => {
      console.error('Error granting credits:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar créditos');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Gerenciar Créditos de Foto
        </CardTitle>
        <CardDescription>
          Adicione créditos para usuários do Gallery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="search-email" className="sr-only">Email do usuário</Label>
            <Input
              id="search-email"
              placeholder="Digite o email do usuário..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUser()}
            />
          </div>
          <Button onClick={searchUser} variant="secondary">
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
        </div>

        {/* Selected User */}
        {selectedUser && (
          <>
            <Separator />
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span>Saldo atual:</span>
                <Badge variant="secondary" className="text-lg">
                  {selectedUser.photoCredits} créditos
                </Badge>
              </div>
            </div>

            {/* Add Credits Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="credit-amount">Quantidade de Créditos</Label>
                  <Input
                    id="credit-amount"
                    type="number"
                    min="1"
                    placeholder="100"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Bônus de boas-vindas, Promoção de janeiro..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              <Button 
                onClick={() => grantCreditsMutation.mutate()}
                disabled={grantCreditsMutation.isPending || !creditAmount}
                className="w-full"
              >
                {grantCreditsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar Créditos
              </Button>
            </div>

            {/* Recent Grants */}
            {recentGrants && recentGrants.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico Recente
                  </h4>
                  <div className="space-y-2">
                    {recentGrants.map((grant) => (
                      <div 
                        key={grant.id}
                        className="flex items-center justify-between text-sm bg-muted/30 rounded p-2"
                      >
                        <div>
                        <span className="text-primary font-medium">+{grant.amount}</span>
                          {grant.reason && (
                            <span className="text-muted-foreground ml-2">• {grant.reason}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(grant.granted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
