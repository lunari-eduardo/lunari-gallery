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
  Trash2,
  RotateCcw,
  Palette,
  Sun,
  Moon,
  Play,
  CheckSquare,
  Square,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal } from '@/components/ClientModal';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { FolderManager } from '@/components/FolderManager';
import { PackageSelect } from '@/components/PackageSelect';
import { FontSelect } from '@/components/FontSelect';
import { Slider } from '@/components/ui/slider';
import { TitleCaseMode } from '@/types/gallery';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useAuthContext } from '@/contexts/AuthContext';
import { useGestaoPackages } from '@/hooks/useGestaoPackages';
import { useSettings } from '@/hooks/useSettings';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Client } from '@/types/gallery';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { supabase } from '@/integrations/supabase/client';
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
  const { hasGestaoIntegration } = useAuthContext();
  const { packages: gestaoPackages, isLoading: isLoadingPackages } = useGestaoPackages();
  const { settings } = useSettings();
  
  const { 
    getGallery,
    updateGallery,
    deleteGallery,
    reopenSelection,
    fetchGalleryPhotos,
    getPhotoUrl,
    deletePhoto,
    deletePhotos,
    isLoading: isSupabaseLoading,
    isUpdating,
    isDeleting,
    isDeletingPhoto,
    isDeletingPhotos
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

  // Theme state for client gallery
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('light');
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  
  // Font state
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [photoSpacing, setPhotoSpacing] = useState(6);
  
  // UI state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);



  // Reset selection when switching folders
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeFolderId]);

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

      // Hydrate theme settings from configuracoes
      const cfg = gallery.configuracoes || {};
      if (cfg.clientMode === 'dark' || cfg.clientMode === 'light') {
        setClientMode(cfg.clientMode);
      }
      if (cfg.themeId) {
        setSelectedThemeId(cfg.themeId);
      }
      if (cfg.sessionFont) {
        setSessionFont(cfg.sessionFont);
      }
      if (cfg.titleCaseMode) {
        setTitleCaseMode(cfg.titleCaseMode as TitleCaseMode);
      }
      if (cfg.photoSpacing !== undefined) {
        setPhotoSpacing(cfg.photoSpacing);
      } else if (settings?.defaultPhotoSpacing !== undefined) {
        setPhotoSpacing(settings.defaultPhotoSpacing);
      }

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

  // Migrate orphan photos (pasta_id = null) to first folder
  useEffect(() => {
    if (!id || !photos.length) return;
    const orphans = photos.filter(p => !p.pastaId);
    if (orphans.length === 0) return;

    const migrateOrphans = async () => {
      // Find or create a default folder
      const { data: existingFolders } = await supabase
        .from('galeria_pastas')
        .select('id')
        .eq('galeria_id', id)
        .order('ordem')
        .limit(1);

      let targetFolderId = existingFolders?.[0]?.id;

      if (!targetFolderId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: newFolder } = await supabase
          .from('galeria_pastas')
          .insert({
            galeria_id: id,
            user_id: user.id,
            nome: gallery?.nomeSessao || 'Todas as fotos',
            ordem: 0,
          })
          .select()
          .single();
        targetFolderId = newFolder?.id;
      }

      if (!targetFolderId) return;

      // Batch update orphans
      const orphanIds = orphans.map(p => p.id);
      await supabase
        .from('galeria_fotos')
        .update({ pasta_id: targetFolderId })
        .in('id', orphanIds);

      // Refresh photos
      queryClient.invalidateQueries({ queryKey: ['galeria-fotos', id] });
      console.log(`📁 Migrated ${orphanIds.length} orphan photos to folder ${targetFolderId}`);
    };

    migrateOrphans();
  }, [id, photos, gallery?.nomeSessao, queryClient]);

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
      refetchClients();
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Erro ao criar cliente');
    }
  };

  // Loading state — only block on initial load when no data exists yet.
  // Transient refetches (e.g. after auth token refresh) must NOT unmount
  // the page, otherwise active uploads get destroyed.
  const isInitialLoading = (isSupabaseLoading && !gallery) || (isClientsLoading && clients.length === 0);
  if (isInitialLoading) {
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
        <h2 className="text-2xl font-bold mb-2">
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

  // Galeria concluída: bloqueia edição de parâmetros que afetam cobrança.
  // Reativar a seleção libera novamente esses campos.
  const isBillingLocked = gallery.statusSelecao === 'selecao_completa' || gallery.finalizedAt != null;

  // Galeria vinculada ao Lunari Studio (sessão do projeto Studio).
  const isLunariLinked = !!gallery.sessionId;

  // Mínimo permitido para "Fotos Incluídas": não pode ficar abaixo de
  // (selecionadas - extras já vendidas). Reduzir abaixo disso transformaria
  // fotos já cobradas como "incluídas" em extras a recobrar.
  const minFotosIncluidasPermitido = Math.max(
    0,
    (gallery.fotosSelecionadas ?? 0) - (gallery.totalFotosExtrasVendidas ?? 0)
  );
  const fotosIncluidasAbaixoDoMinimo =
    !isBillingLocked
    && (gallery.totalFotosExtrasVendidas ?? 0) > 0
    && fotosIncluidas < minFotosIncluidasPermitido;

  const persistGallery = async () => {
    try {
      const cleanPhone = clienteTelefone.replace(/\D/g, '');
      const existingConfig = gallery.configuracoes || {};
      const mergedConfig = {
        ...existingConfig,
        clientMode,
        themeId: selectedThemeId,
        sessionFont,
        titleCaseMode,
        photoSpacing,
      };

      const saleSettings = existingConfig.saleSettings as any;

      await updateGallery({
        id: gallery.id,
        data: {
          nomeSessao,
          clienteNome,
          clienteEmail,
          clienteTelefone: cleanPhone || undefined,
          // Quando a galeria está concluída, preserva os parâmetros de cobrança originais.
          nomePacote: isBillingLocked ? (gallery.nomePacote || undefined) : (nomePacote || undefined),
          fotosIncluidas: isBillingLocked ? gallery.fotosIncluidas : fotosIncluidas,
          valorFotoExtra: isBillingLocked ? gallery.valorFotoExtra : valorFotoExtra,
          prazoSelecao,
          configuracoes: mergedConfig,
          venda_modo: saleSettings?.mode,
          venda_pagamento_provedor: saleSettings?.paymentMethod,
          venda_tipo_cobranca: saleSettings?.chargeType,
          themeId: selectedThemeId || null,
          useCustomTheme: !!selectedThemeId,
          themeOverrides: {
            ...(gallery as any).themeOverrides || {},
            layout: {
              ...((gallery as any).themeOverrides as any)?.layout || {},
              gap: photoSpacing
            }
          }
        }
      });
      navigate(`/gallery/${gallery.id}`);
    } catch (error) {
      console.error('Error updating gallery:', error);
    }
  };

  const handleSave = async () => {
    if (fotosIncluidasAbaixoDoMinimo) {
      toast.error(
        `Não é possível reduzir as fotos incluídas abaixo de ${minFotosIncluidasPermitido}: existem fotos já pagas como extras nesta galeria.`
      );
      return;
    }

    await persistGallery();
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
      await reopenSelection({ id: gallery.id, days } as any);
      // Aguarda o refetch para garantir que publicToken esteja atualizado.
      await queryClient.invalidateQueries({ queryKey: ['galerias'] });
      await queryClient.refetchQueries({ queryKey: ['galerias'] });
    } catch (error) {
      console.error('Error reactivating gallery:', error);
      throw error;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClienteTelefone(formatPhoneBR(e.target.value));
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto({ photoId } as any);
    setLocalPhotoCount(prev => Math.max(0, (prev || 1) - 1));
    setSelectedIds(prev => {
      if (!prev.has(photoId)) return prev;
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
  };

  const toggleSelect = (photoId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const toggleSelectAll = (visibleIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await deletePhotos({ photoIds: ids } as any);
      setLocalPhotoCount(prev => Math.max(0, (prev || ids.length) - ids.length));
      toast.success(`${ids.length} foto${ids.length !== 1 ? 's' : ''} excluída${ids.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setConfirmBulkDeleteOpen(false);
    } catch (err) {
      // Toast já tratado no hook; manter seleção e modal aberto para retry
    }
  };

  const handleCopyPassword = () => {
    if (gallery.galleryPassword) {
      navigator.clipboard.writeText(gallery.galleryPassword);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/gallery/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Editar Galeria
            </h1>
            <p className="text-muted-foreground">
              {gallery.nomeSessao || 'Galeria'}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Info & Deadline */}
        <div className="space-y-6">
          {/* Basic Info Card */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Informações da Galeria
              </CardTitle>
              <CardDescription>
                Dados básicos e configurações de preço
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Photo Spacing Control */}
              <div className="space-y-4 pb-4 border-b">
                <div>
                  <Label className="text-base font-medium">Espaçamento entre fotos (Grid)</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajuste a borda entre as fotos nesta galeria específica
                  </p>
                </div>
                <div className="flex items-center gap-6 max-w-sm pt-2">
                  <Slider
                    value={[photoSpacing]}
                    onValueChange={(vals) => setPhotoSpacing(vals[0])}
                    min={0}
                    max={40}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-10 text-right">{photoSpacing}px</span>
                </div>
              </div>
              {isBillingLocked && (
                <div className="glass rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
                  <Lock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">Galeria concluída</p>
                    <p className="text-muted-foreground">
                      Os parâmetros de cobrança (pacote, fotos incluídas, valor da foto extra e template de desconto) estão bloqueados para preservar o histórico de pagamentos. Para alterá-los, <span className="font-medium text-foreground">reative a seleção</span> usando o botão "Reativar" no topo da página.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Fonte do Título</Label>
                <FontSelect 
                  value={sessionFont} 
                  onChange={setSessionFont} 
                  previewText={nomeSessao || 'Ensaio Gestante'} 
                  titleCaseMode={titleCaseMode} 
                  onTitleCaseModeChange={setTitleCaseMode} 
                />
              </div>
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
                  {hasGestaoIntegration && gestaoPackages.length > 0 ? (
                    <PackageSelect
                      packages={gestaoPackages}
                      selectedPackage={nomePacote}
                      onSelect={(name, pkg) => {
                        setNomePacote(name);
                        if (pkg) {
                          if (pkg.fotosIncluidas) setFotosIncluidas(pkg.fotosIncluidas);
                          if (pkg.valorFotoExtra) setValorFotoExtra(pkg.valorFotoExtra);
                        }
                      }}
                      placeholder="Selecionar pacote..."
                      disabled={isBillingLocked}
                    />
                  ) : (
                    <Input
                      id="nomePacote"
                      value={nomePacote}
                      onChange={(e) => setNomePacote(e.target.value)}
                      placeholder="Ex: Premium"
                      disabled={isBillingLocked}
                    />
                  )}
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
                  <p className="text-xs text-muted-foreground">
                    Necessário para abrir a conversa direta com o cliente no WhatsApp.
                  </p>
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

              {isLunariLinked && !isBillingLocked && (
                <div className="glass rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm space-y-1">
                  <p className="font-medium text-foreground">Galeria vinculada ao Lunari Studio</p>
                  <p className="text-muted-foreground">
                    O valor da foto extra é compartilhado com a sessão. Alterações feitas aqui refletem imediatamente no Lunari Studio. Demais regras (pacote, faixas e descontos progressivos) permanecem inalteradas.
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fotosIncluidas">Fotos Incluídas</Label>
                  <Input
                    id="fotosIncluidas"
                    type="number"
                    min="0"
                    value={fotosIncluidas || ''}
                    onChange={(e) => setFotosIncluidas(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))}
                    disabled={isBillingLocked}
                    aria-invalid={fotosIncluidasAbaixoDoMinimo}
                  />
                  {isLunariLinked && !isBillingLocked && (
                    <p className="text-xs text-muted-foreground">
                      Compartilhado com a sessão do Lunari Studio. Alterações refletem na sessão.
                    </p>
                  )}
                  {fotosIncluidasAbaixoDoMinimo && (
                    <p className="text-xs text-destructive">
                      Esta galeria já tem {gallery.totalFotosExtrasVendidas} foto{gallery.totalFotosExtrasVendidas !== 1 ? 's' : ''} extra{gallery.totalFotosExtrasVendidas !== 1 ? 's' : ''} paga{gallery.totalFotosExtrasVendidas !== 1 ? 's' : ''}. O mínimo permitido aqui é <span className="font-medium">{minFotosIncluidasPermitido}</span> para preservar o histórico de pagamentos.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorFotoExtra">Valor da foto extra (R$)</Label>
                  <Input
                    id="valorFotoExtra"
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorFotoExtra || ''}
                    onChange={(e) => setValorFotoExtra(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                    disabled={isBillingLocked}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isLunariLinked
                      ? 'Este valor é compartilhado com a sessão.'
                      : 'Este valor vale apenas para esta galeria.'}
                  </p>
                </div>
              </div>

              {/* Discount Presets - only for users without Gestão integration */}
              {!hasGestaoIntegration && settings.discountPresets && settings.discountPresets.length > 0 && (
                <div className="space-y-2">
                  <Label>Template de Desconto (opcional)</Label>
                  <Select
                    disabled={isBillingLocked}
                    onValueChange={(presetId) => {
                      const preset = settings.discountPresets.find(p => p.id === presetId);
                      if (preset && preset.packages.length > 0) {
                        // Use the first tier's price as the extra photo price
                        setValorFotoExtra(preset.packages[0].pricePerPhoto);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar template de desconto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.discountPresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name} ({preset.packages.length} faixa{preset.packages.length !== 1 ? 's' : ''})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Save button removed - now in header */}
            </CardContent>
          </Card>

          {/* Deadline Card */}
          <Card className="glass">
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
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Fotos da Galeria
              </CardTitle>
              <CardDescription>
                {(() => {
                  const total = photos.length || localPhotoCount || gallery.totalFotos;
                  if (activeFolderId) {
                    const folderCount = photos.filter(p => p.pastaId === activeFolderId).length;
                    return `${folderCount} fotos nesta pasta (${total} total)`;
                  }
                  return `${total} fotos nesta galeria`;
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Folder Manager */}
              <FolderManager
                galleryId={gallery.id}
                activeFolderId={activeFolderId}
                onActiveFolderChange={setActiveFolderId}
                photos={photos.map(p => ({
                  id: p.id,
                  pastaId: p.pastaId,
                  thumbnailUrl: getPhotoUrl(p, gallery, 'thumbnail'),
                  originalFilename: p.originalFilename,
                }))}
                showCoverSelect
              />

              {/* Photo List - filtered by active folder */}
              {(() => {
                const filteredPhotos = activeFolderId
                  ? photos.filter((p) => p.pastaId === activeFolderId)
                  : photos;
                const visibleIds = filteredPhotos.map(p => p.id);
                const selectedVisibleCount = visibleIds.filter(id => selectedIds.has(id)).length;
                const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
                const anyDeleting = isDeletingPhoto || isDeletingPhotos;

                return isLoadingPhotos ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPhotos.length > 0 ? (
                  <div className="space-y-2">
                    {/* Selection action bar */}
                    <div className="flex items-center justify-between gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(visibleIds)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        disabled={anyDeleting}
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {allVisibleSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                      </button>
                      {selectedVisibleCount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {selectedVisibleCount} selecionada{selectedVisibleCount !== 1 ? 's' : ''}
                          </span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 gap-1"
                            onClick={() => setConfirmBulkDeleteOpen(true)}
                            disabled={anyDeleting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </div>
                      )}
                    </div>

                    <ScrollArea className="h-[450px] rounded-md border">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-2">
                        {filteredPhotos.map((photo) => {
                          const isSelected = selectedIds.has(photo.id);
                          const isVideo = photo.mimeType?.startsWith('video/');
                          return (
                            <div
                              key={photo.id}
                              className={cn(
                                "group relative aspect-square rounded-md overflow-hidden border-2 transition-all cursor-pointer bg-muted/20",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-transparent hover:border-border"
                              )}
                              onClick={() => !anyDeleting && toggleSelect(photo.id)}
                            >
                              <img
                                src={getPhotoUrl(photo, gallery, 'thumbnail')}
                                alt={photo.originalFilename}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />

                              {/* Video badge */}
                              {isVideo && (
                                <div className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full pointer-events-none">
                                  <Play className="h-3 w-3 fill-current" />
                                </div>
                              )}

                              {/* Selection checkbox */}
                              <div
                                className={cn(
                                  "absolute top-1.5 left-1.5 transition-opacity",
                                  isSelected || selectedIds.size > 0
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(photo.id)}
                                  disabled={anyDeleting}
                                  className="bg-background/90 border-background"
                                />
                              </div>

                              {/* Hover overlay + filename + delete */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between gap-1 p-1.5 pointer-events-none">
                                <span className="text-[10px] text-white truncate flex-1" title={photo.originalFilename}>
                                  {photo.originalFilename}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePhoto(photo.id);
                                  }}
                                  disabled={anyDeleting}
                                  className="pointer-events-auto p-1 rounded bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors disabled:opacity-50"
                                  title="Excluir foto"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {activeFolderId ? 'Nenhuma foto nesta pasta' : 'Nenhuma foto nesta galeria'}
                  </p>
                );
              })()}

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
                  <PhotoUploader galleryId={gallery.id} folderId={activeFolderId} onUploadComplete={handleUploadComplete} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reactivate Card - Only if applicable */}
          {canReactivate && (
            <Card className="glass">
              <CardHeader>
                <CardTitle>Reativar Galeria</CardTitle>
                <CardDescription>
                  Permite que o cliente faça novas seleções
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={() => setReactivateOpen(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reativar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reactivate Gallery Dialog (always mounted to survive status changes) */}
      <ReactivateGalleryDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        galleryName={gallery.nomeSessao || 'Esta galeria'}
        onReactivate={handleReactivate}
        onSuccess={(days) => {
          setReactivateDays(days);
          setReactivateSuccessOpen(true);
        }}
      />

      {/* Reactivate Success / Share Modal */}
      {settings && (
        <ReactivateSuccessModal
          isOpen={reactivateSuccessOpen}
          onOpenChange={setReactivateSuccessOpen}
          gallery={gallery}
          settings={settings}
          clientLink={gallery.publicToken ? getGalleryUrl(gallery.publicToken) : null}
          newDeadline={(() => {
            const d = new Date();
            d.setDate(d.getDate() + reactivateDays);
            return d;
          })()}
          daysGranted={reactivateDays}
        />
      )}

      {/* Client Modal */}
      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        onSave={handleCreateClient}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={confirmBulkDeleteOpen} onOpenChange={setConfirmBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.size} foto{selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As fotos serão removidas permanentemente da galeria e do armazenamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPhotos}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              disabled={isDeletingPhotos}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPhotos ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Save Button (anchor) */}

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={isUpdating || fotosIncluidasAbaixoDoMinimo}
          variant="terracotta"
          size="lg"
          className="shadow-2xl gap-2 rounded-full px-6 h-12 backdrop-blur-xl"
        >
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}

