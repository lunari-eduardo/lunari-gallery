import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  AlertCircle,
  Calendar as CalendarIcon,
  Image,
  Plus,
  Upload,
  Eye,
  EyeOff,
  Copy,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal } from '@/components/ClientModal';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Client } from '@/types/gallery';
import { getGalleryUrl } from '@/lib/galleryUrl';

// Format phone to Brazilian format (XX) XXXXX-XXXX
function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function GalleryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { 
    getGallery,
    updateGallery,
    deleteGallery,
    reopenSelection,
    fetchGalleryPhotos,
    getPhotoUrl,
    deletePhoto,
    isLoading: isSupabaseLoading,
    isUpdating,
    isDeleting,
    isDeletingPhoto
  } = useSupabaseGalleries();

  const {
    clients,
    isLoading: isClientsLoading,
    createClient,
    refetch: refetchClients
  } = useGalleryClients();

  const gallery = getGallery(id || '');

  // Fetch gallery photos
  const { data: photos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!gallery && !!id,
  });
  
  // Local photo count for immediate UI update
  const [localPhotoCount, setLocalPhotoCount] = useState<number | null>(null);
  
  // Form state
  const [nomeSessao, setNomeSessao] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [nomePacote, setNomePacote] = useState('');
  const [fotosIncluidas, setFotosIncluidas] = useState(0);
  const [valorFotoExtra, setValorFotoExtra] = useState(0);
  const [prazoSelecao, setPrazoSelecao] = useState<Date | undefined>();
  
  // UI state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);

  // Initialize form with gallery data
  useEffect(() => {
    if (gallery) {
      setNomeSessao(gallery.nomeSessao || '');
      setClienteNome(gallery.clienteNome || '');
      setClienteEmail(gallery.clienteEmail || '');
      setClienteTelefone(gallery.clienteTelefone ? formatPhoneBR(gallery.clienteTelefone) : '');
      setNomePacote(gallery.nomePacote || '');
      setFotosIncluidas(gallery.fotosIncluidas);
      setValorFotoExtra(gallery.valorFotoExtra);
      setPrazoSelecao(gallery.prazoSelecao || undefined);
      
      // Initialize local photo count
      if (localPhotoCount === null) {
        setLocalPhotoCount(gallery.totalFotos);
      }
      
      // Try to find matching client
      if (gallery.clienteId) {
        const matchingClient = clients.find(c => c.id === gallery.clienteId);
        if (matchingClient) {
          setSelectedClient(matchingClient);
        }
      }
    }
  }, [gallery, clients]);

  // Handle upload complete - update local count immediately
  const handleUploadComplete = (photos: UploadedPhoto[]) => {
    setLocalPhotoCount(prev => (prev || 0) + photos.length);
    // Invalidate queries to sync with database
    queryClient.invalidateQueries({ queryKey: ['galerias'] });
    queryClient.invalidateQueries({ queryKey: ['galeria-fotos', id] });
  };

  // Handle client selection
  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      setClienteNome(client.name);
      setClienteEmail(client.email);
      setClienteTelefone(client.phone ? formatPhoneBR(client.phone) : '');
    }
  };

  // Handle creating new client
  const handleCreateClient = async (data: { name: string; email: string; phone?: string; galleryPassword: string }) => {
    try {
      const newClient = await createClient(data);
      setSelectedClient(newClient);
      setClienteNome(newClient.name);
      setClienteEmail(newClient.email);
      setClienteTelefone(newClient.phone ? formatPhoneBR(newClient.phone) : '');
      setIsClientModalOpen(false);
      toast.success('Cliente criado!');
      refetchClients();
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Erro ao criar cliente');
    }
  };

  // Loading state
  if (isSupabaseLoading || isClientsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  // Gallery not found
  if (!gallery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-2xl font-semibold mb-2">
          Galeria não encontrada
        </h2>
        <p className="text-muted-foreground mb-4">
          A galeria solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Voltar às Galerias
        </Button>
      </div>
    );
  }

  const canReactivate = gallery.status === 'selecao_completa' || 
                        gallery.status === 'confirmada' || 
                        gallery.status === 'expirado' ||
                        gallery.status === 'expirada';

  const handleSave = async () => {
    try {
      // Clean phone number for storage
      const cleanPhone = clienteTelefone.replace(/\D/g, '');
      
      await updateGallery({
        id: gallery.id,
        data: {
          nomeSessao,
          clienteNome,
          clienteEmail,
          clienteTelefone: cleanPhone || undefined,
          nomePacote: nomePacote || undefined,
          fotosIncluidas,
          valorFotoExtra,
          prazoSelecao,  // Now saving the deadline
        }
      });
      toast.success('Galeria atualizada!');
    } catch (error) {
      console.error('Error updating gallery:', error);
    }
  };

  const handleExtendDeadline = (days: number) => {
    const newDeadline = addDays(prazoSelecao || new Date(), days);
    setPrazoSelecao(newDeadline);
    // No toast here - user needs to save to persist
  };

  const handleDelete = async () => {
    await deleteGallery(gallery.id);
    navigate('/');
  };

  const handleReactivate = async (days: number = 7) => {
    try {
      await reopenSelection({ id: gallery.id, days });
      toast.success('Galeria reativada!', {
        description: 'O cliente pode fazer seleções novamente.',
      });
    } catch (error) {
      console.error('Error reactivating gallery:', error);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClienteTelefone(formatPhoneBR(e.target.value));
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto({ galleryId: gallery.id, photoId });
    setLocalPhotoCount(prev => Math.max(0, (prev || 1) - 1));
  };

  const handleCopyPassword = () => {
    if (gallery.galleryPassword) {
      navigator.clipboard.writeText(gallery.galleryPassword);
      toast.success('Senha copiada!');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/gallery/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold">
              Editar Galeria
            </h1>
            <p className="text-muted-foreground">
              {gallery.nomeSessao || 'Galeria'}
            </p>
          </div>
        </div>
        
        {/* Save button in header */}
        <Button 
          onClick={handleSave}
          disabled={isUpdating}
          variant="terracotta"
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Info & Deadline */}
        <div className="space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Informações da Galeria
              </CardTitle>
              <CardDescription>
                Dados básicos e configurações de preço
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nomeSessao">Nome da Sessão</Label>
                  <Input
                    id="nomeSessao"
                    value={nomeSessao}
                    onChange={(e) => setNomeSessao(e.target.value)}
                    placeholder="Ex: Ensaio Família Silva"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nomePacote">Pacote (opcional)</Label>
                  <Input
                    id="nomePacote"
                    value={nomePacote}
                    onChange={(e) => setNomePacote(e.target.value)}
                    placeholder="Ex: Premium"
                  />
                </div>
              </div>

              {/* Client Selection */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <ClientSelect
                  clients={clients}
                  selectedClient={selectedClient}
                  onSelect={handleClientSelect}
                  onCreateNew={() => setIsClientModalOpen(true)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clienteEmail">Email do Cliente</Label>
                  <Input
                    id="clienteEmail"
                    type="email"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="clienteTelefone">Telefone</Label>
                  <Input
                    id="clienteTelefone"
                    type="tel"
                    value={clienteTelefone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Gallery Password - Read Only */}
              <div className="space-y-2">
                <Label>Senha da Galeria</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={gallery.galleryPassword || ''}
                      readOnly
                      className="pr-10 bg-muted"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    disabled={!gallery.galleryPassword}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fotosIncluidas">Fotos Incluídas</Label>
                  <Input
                    id="fotosIncluidas"
                    type="number"
                    min="0"
                    value={fotosIncluidas}
                    onChange={(e) => setFotosIncluidas(parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="valorFotoExtra">Valor Foto Extra (R$)</Label>
                  <Input
                    id="valorFotoExtra"
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorFotoExtra}
                    onChange={(e) => setValorFotoExtra(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Save button removed - now in header */}
            </CardContent>
          </Card>

          {/* Deadline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Prazo de Seleção
              </CardTitle>
              <CardDescription>
                Defina até quando o cliente pode fazer a seleção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="space-y-2">
                  <Label>Data limite</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !prazoSelecao && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {prazoSelecao ? format(prazoSelecao, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={prazoSelecao}
                        onSelect={setPrazoSelecao}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExtendDeadline(7)}
                  >
                    +7 dias
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExtendDeadline(14)}
                  >
                    +14 dias
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExtendDeadline(30)}
                  >
                    +30 dias
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delete Gallery - Text link only */}
          <DeleteGalleryDialog
            galleryName={gallery.nomeSessao || 'Esta galeria'}
            onDelete={handleDelete}
            trigger={
              <button className="text-sm text-destructive hover:underline">
                Excluir galeria
              </button>
            }
          />
        </div>

        {/* Right Column - Photos & Actions */}
        <div className="space-y-6">
          {/* Photos Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Fotos da Galeria
              </CardTitle>
              <CardDescription>
                {photos.length || localPhotoCount || gallery.totalFotos} fotos nesta galeria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo List */}
              {isLoadingPhotos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : photos.length > 0 ? (
                <ScrollArea className="h-[450px] rounded-md border">
                  <Table>
                    <TableBody>
                      {photos.map((photo) => (
                        <TableRow key={photo.id}>
                          <TableCell className="w-14 p-2">
                            <img
                              src={getPhotoUrl(photo, gallery, 'thumbnail')}
                              alt={photo.originalFilename}
                              className="w-10 h-10 rounded object-cover"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <span className="text-sm truncate block max-w-[200px]">
                              {photo.originalFilename}
                            </span>
                          </TableCell>
                          <TableCell className="w-10 p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeletePhoto(photo.id)}
                              disabled={isDeletingPhoto}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma foto nesta galeria
                </p>
              )}

              {/* Upload Button / Uploader */}
              {!showPhotoUploader ? (
                <Button 
                  variant="outline" 
                  onClick={() => setShowPhotoUploader(true)}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar Fotos
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Carregar novas fotos</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowPhotoUploader(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                  <PhotoUploader galleryId={gallery.id} onUploadComplete={handleUploadComplete} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reactivate Card - Only if applicable */}
          {canReactivate && (
            <Card>
              <CardHeader>
                <CardTitle>Reativar Galeria</CardTitle>
                <CardDescription>
                  Permite que o cliente faça novas seleções
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReactivateGalleryDialog
                  galleryName={gallery.nomeSessao || 'Esta galeria'}
                  clientLink={gallery.publicToken ? getGalleryUrl(gallery.publicToken) : null}
                  onReactivate={handleReactivate}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Client Modal */}
      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        onSave={handleCreateClient}
      />
    </div>
  );
}
