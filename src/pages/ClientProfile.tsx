import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Images, 
  Plus,
  Pencil,
  DollarSign,
  Camera,
  CreditCard,
  ExternalLink,
  Loader2,
  ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { useClientProfile } from '@/hooks/useClientProfile';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useState } from 'react';
import { toast } from 'sonner';
import { GalleryStatus } from '@/types/gallery';

import pixLogo from '@/assets/payment-logos/pix.png';
import infinitepayLogo from '@/assets/payment-logos/infinitepay.png';
import mercadopagoLogo from '@/assets/payment-logos/mercadopago.png';

export default function ClientProfile() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { client, galleries, payments, stats, isLoading } = useClientProfile(clientId);
  const { updateClient } = useGalleryClients();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditClient = async (data: ClientFormData) => {
    if (!clientId) return;
    try {
      await updateClient(clientId, data);
      toast.success('Cliente atualizado com sucesso!');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente');
    }
  };

  const getProviderLogo = (provedor: string | null) => {
    switch (provedor) {
      case 'pix_manual':
        return <img src={pixLogo} alt="PIX" className="h-5 w-5 object-contain" />;
      case 'infinitepay':
        return <img src={infinitepayLogo} alt="InfinitePay" className="h-5 w-5 object-contain" />;
      case 'mercadopago':
        return <img src={mercadopagoLogo} alt="Mercado Pago" className="h-5 w-5 object-contain" />;
      default:
        return <CreditCard className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getProviderLabel = (provedor: string | null) => {
    switch (provedor) {
      case 'pix_manual': return 'PIX Manual';
      case 'infinitepay': return 'InfinitePay';
      case 'mercadopago': return 'Mercado Pago';
      default: return provedor || 'Desconhecido';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{client.nome}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </span>
                )}
                {client.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {client.telefone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 ml-auto sm:ml-0">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button onClick={() => navigate(`/gallery/new?clientId=${clientId}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Galeria
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Images className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalGalleries}</p>
                <p className="text-xs text-muted-foreground">Galerias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Total pago</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <Camera className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalPhotosSelected}</p>
                <p className="text-xs text-muted-foreground">Fotos selecionadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalExtrasPhotos}</p>
                <p className="text-xs text-muted-foreground">Fotos extras</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="galleries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="galleries" className="flex items-center gap-2">
            <Images className="h-4 w-4" />
            Galerias ({galleries.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos ({payments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="galleries">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Galerias</CardTitle>
            </CardHeader>
            <CardContent>
              {galleries.length === 0 ? (
                <div className="text-center py-12">
                  <Images className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhuma galeria encontrada</p>
                  <Button onClick={() => navigate(`/gallery/new?clientId=${clientId}`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Galeria
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sessão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Fotos</TableHead>
                      <TableHead className="hidden md:table-cell">Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {galleries.map((gallery) => (
                      <TableRow key={gallery.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{gallery.nome_sessao || 'Sem nome'}</p>
                            {gallery.nome_pacote && (
                              <p className="text-sm text-muted-foreground">{gallery.nome_pacote}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={gallery.status as GalleryStatus} type="gallery" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-muted-foreground">
                            {gallery.fotos_selecionadas || 0}/{gallery.total_fotos || 0}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {gallery.valor_total_vendido 
                            ? formatCurrency(gallery.valor_total_vendido) 
                            : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {format(new Date(gallery.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            asChild
                          >
                            <Link to={`/gallery/${gallery.id}`}>
                              Ver
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhum pagamento registrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Fotos</TableHead>
                      <TableHead className="hidden md:table-cell">Galeria</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-muted-foreground">
                          {payment.data_pagamento 
                            ? format(new Date(payment.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })
                            : format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getProviderLogo(payment.provedor)}
                            <span className="hidden sm:inline">{getProviderLabel(payment.provedor)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {formatCurrency(payment.valor)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {payment.qtd_fotos ? `${payment.qtd_fotos} fotos` : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {payment.galeria_nome ? (
                            <Link 
                              to={`/gallery/${payment.galeria_id}`}
                              className="text-primary hover:underline"
                            >
                              {payment.galeria_nome}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.ip_receipt_url && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              asChild
                            >
                              <a href={payment.ip_receipt_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <ClientModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        client={client ? {
          id: client.id,
          name: client.nome,
          email: client.email || '',
          phone: client.telefone || undefined,
          galleryPassword: '',
          status: (client.gallery_status as 'ativo' | 'sem_galeria') || 'sem_galeria',
          totalGalleries: client.total_galerias || 0,
          createdAt: client.created_at ? new Date(client.created_at) : new Date(),
          updatedAt: new Date(),
        } : null}
        onSave={handleEditClient}
      />
    </div>
  );
}
