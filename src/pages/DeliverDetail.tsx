import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, Send, Trash2, Image, Upload, Copy, Eye,
  Lock, Unlock, Calendar as CalendarIcon, Download,
  MessageSquare, Mail, ExternalLink, Loader2, Save, RotateCcw, Star, ImageIcon,
  Layers, Smartphone, Tablet, Monitor, CheckCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CoverCatalog } from '@/components/deliver/CoverCatalog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { supabase } from '@/integrations/supabase/client';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { useSettings } from '@/hooks/useSettings';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { buildWhatsAppUrl } from '@/lib/whatsappUrl';
import { getPhotoUrl } from '@/lib/photoUrl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { THEME_REGISTRY, DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';
import { ThemePreviewCanvas } from '@/components/dashboard/themes/ThemePreviewCanvas';

import { isPast } from 'date-fns';

function getDeliverStatusInfo(status: string, prazoSelecao: Date | null) {
  const isExpired = status === 'expirado' || status === 'expirada' || (prazoSelecao && isPast(prazoSelecao) && ['enviado', 'publicada'].includes(status));
  if (isExpired) return { label: 'Expirada', variant: 'destructive' as const, color: 'text-destructive' };
  if (status === 'enviado' || status === 'publicada') return { label: 'Publicada', variant: 'default' as const, color: 'text-primary' };
  return { label: 'Rascunho', variant: 'secondary' as const, color: 'text-muted-foreground' };
}

export default function DeliverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    galleries,
    getGallery,
    fetchGalleryPhotos,
    updateGallery,
    deleteGallery,
    sendGallery,
    deletePhoto,
    isLoading: galleriesLoading,
  } = useSupabaseGalleries();

  const transferStorage = useTransferStorage();
  const { settings } = useSettings();

  const [photos, setPhotos] = useState<GaleriaPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);

  // Editable fields
  const [sessionName, setSessionName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [shareMessage, setShareMessage] = useState('Suas fotos finais estão prontas para download.');
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photoSpacing, setPhotoSpacing] = useState(6);
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [themeOverrides, setThemeOverrides] = useState<any>({});
  const [coverId, setCoverId] = useState<string | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');


  const gallery = useMemo(() => getGallery(id || ''), [id, galleries]);

  // Load gallery data
  useEffect(() => {
    if (gallery) {
      setSessionName(gallery.nomeSessao || '');
      setWelcomeMessage(gallery.mensagemBoasVindas || '');
      setWelcomeEnabled(!!gallery.mensagemBoasVindas);
      setInternalNotes((gallery.configuracoes as any)?.notasInternas || '');
      setIsPrivate(gallery.permissao === 'private');
      setGalleryPassword(gallery.galleryPassword || '');
      setExpirationDate(gallery.prazoSelecao || undefined);
      setCoverPhotoId(gallery.configuracoes?.coverPhotoId || null);
      setActiveThemeId(gallery.themeId || DEFAULT_THEME_ID);
      setUseCustomTheme(gallery.useCustomTheme || false);
      setThemeOverrides(gallery.themeOverrides || {});
      setCoverId((gallery as any).coverId ?? null);
      
      // Migrate legacy gap to overrides if needed
      const legacyGap = gallery.configuracoes?.photoSpacing;
      if (legacyGap !== undefined && !gallery.themeOverrides?.layout?.gap) {
        setThemeOverrides((prev: any) => ({
          ...prev,
          layout: { ...(prev.layout || {}), gap: legacyGap }
        }));
      }
    }
  }, [gallery]);

  // Load photos
  useEffect(() => {
    if (!id) return;
    setPhotosLoading(true);
    fetchGalleryPhotos(id)
      .then(setPhotos)
      .catch(console.error)
      .finally(() => setPhotosLoading(false));
  }, [id]);

  if (galleriesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Galeria não encontrada</h2>
        <Button variant="outline" onClick={() => navigate('/galleries/deliver')}>Voltar</Button>
      </div>
    );
  }

  const statusInfo = getDeliverStatusInfo(gallery.status, gallery.prazoSelecao);
  const isDraft = statusInfo.label === 'Rascunho';
  const isExpired = statusInfo.label === 'Expirada';
  const galleryUrl = gallery.publicToken ? getGalleryUrl(gallery.publicToken) : '';

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateGallery({ id, data: {
        nomeSessao: sessionName,
        mensagemBoasVindas: welcomeEnabled ? (welcomeMessage.trim() || null) : null,
        permissao: isPrivate ? 'private' : 'public',
        configuracoes: {
          ...gallery.configuracoes,
          notasInternas: internalNotes,
          coverPhotoId: coverPhotoId || undefined,
          photoSpacing: themeOverrides?.layout?.gap ?? photoSpacing,
        },
        themeId: useCustomTheme ? activeThemeId : null,
        useCustomTheme: useCustomTheme,
        themeOverrides: themeOverrides,
        coverId: coverId,
        prazoSelecao: expirationDate,

      }});
      navigate('/galleries/deliver');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    try {
      await sendGallery(id);
    } catch {
      toast.error('Erro ao publicar');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteGallery(id);
    navigate('/galleries/deliver');
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!id) return;
    await deletePhoto({ photoId } as any);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    // Se a foto excluída era a capa, resetar
    if (coverPhotoId === photoId) {
      setCoverPhotoId(null);
      try {
        await updateGallery({ id, data: {
          configuracoes: { ...(gallery?.configuracoes as any), coverPhotoId: null },
        }});
      } catch (e) {
        console.error('Erro ao limpar capa após exclusão:', e);
      }
    }
  };

  const handleSetCover = async (photoId: string) => {
    if (!id) return;
    const newCoverId = coverPhotoId === photoId ? null : photoId;
    setCoverPhotoId(newCoverId);
    try {
      await updateGallery({ id, data: {
        configuracoes: { ...(gallery?.configuracoes as any), coverPhotoId: newCoverId },
      }});
    } catch {
      toast.error('Erro ao atualizar capa');
      setCoverPhotoId(coverPhotoId);
    }
  };

  const handleToggleHighlight = async (photoId: string, currentWeight: number) => {
    const newWeight = currentWeight > 0 ? 0 : 1;
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, pesoVisual: newWeight } : p));
    const { error } = await supabase
      .from('galeria_fotos')
      .update({ peso_visual: newWeight })
      .eq('id', photoId);
    if (error) {
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, pesoVisual: currentWeight } : p));
      toast.error('Erro ao atualizar destaque');
      return;
    }
    toast.success(newWeight > 0 ? 'Foto destacada' : 'Destaque removido');
  };


  const handleUploadComplete = (uploaded: UploadedPhoto[]) => {
    setShowUploader(false);
    if (id) {
      fetchGalleryPhotos(id).then(setPhotos);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openWhatsApp = async () => {
    const message = `${shareMessage}\n\n${galleryUrl}`;
    const { url, hasDirectContact } = buildWhatsAppUrl(gallery.clienteTelefone, message);
    if (!hasDirectContact) {
      try {
        await navigator.clipboard.writeText(message);
      } catch {
        // ignora
      }
      toast.info('Cliente sem telefone cadastrado. A mensagem foi copiada — escolha o contato no WhatsApp e cole.');
    }
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={() => navigate('/galleries/deliver')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold">{gallery.nomeSessao || 'Sem título'}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {gallery.clienteNome || 'Sem cliente'} · {format(gallery.createdAt, "dd MMM yyyy", { locale: ptBR })} · {photos.length} fotos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isExpired && (
              <Button variant="outline" onClick={() => setShowReactivateDialog(true)} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reativar
              </Button>
            )}
            {isDraft && (
              <Button onClick={handlePublish} className="gap-2">
                <Send className="h-4 w-4" />
                Publicar entrega
              </Button>
            )}
            <DeleteGalleryDialog galleryName={gallery.nomeSessao || 'esta galeria'} onDelete={handleDelete} />
          </div>

          {/* Reactivate Dialog */}
          <ReactivateGalleryDialog
            galleryName={gallery.nomeSessao || 'esta galeria'}
            onReactivate={async (days) => {
              const newExpiration = addDays(new Date(), days);
              await updateGallery({ id: id!, data: {
                prazoSelecao: newExpiration,
              }});
              const { supabase } = await import('@/integrations/supabase/client');
              await supabase.from('galerias').update({ status: 'enviado', updated_at: new Date().toISOString() }).eq('id', id!);
              setExpirationDate(newExpiration);
            }}
            open={showReactivateDialog}
            onOpenChange={setShowReactivateDialog}
            onSuccess={(days) => {
              setReactivateDays(days);
              setReactivateSuccessOpen(true);
            }}
          />

          {settings && (
            <ReactivateSuccessModal
              isOpen={reactivateSuccessOpen}
              onOpenChange={setReactivateSuccessOpen}
              gallery={gallery}
              settings={settings}
              clientLink={galleryUrl || null}
              newDeadline={addDays(new Date(), reactivateDays)}
              daysGranted={reactivateDays}
            />
          )}
        </div>
      </div>

      {/* Tabs: 3 abas — Compartilhamento | Fotos | Detalhes */}
      <Tabs defaultValue="share">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="share">Compartilhamento</TabsTrigger>
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="design">Design & Temas</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>

        </TabsList>

        {/* === COMPARTILHAMENTO === */}
        <TabsContent value="share" className="space-y-8 mt-6">
          {isDraft ? (
            <div className="text-center py-16">
              <Send className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Publique primeiro</h3>
              <p className="text-muted-foreground mb-6">Publique a entrega para habilitar o compartilhamento.</p>
              <Button onClick={handlePublish} className="gap-2">
                <Send className="h-4 w-4" />
                Publicar entrega
              </Button>
            </div>
          ) : (
            <>
              {/* Action buttons — inline, no cards */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" onClick={() => copyToClipboard(galleryUrl)}>
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
                <Button variant="outline" className="gap-2" onClick={openWhatsApp}>
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="outline" className="gap-2" disabled>
                  <Mail className="h-4 w-4" />
                  E-mail (em breve)
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => window.open(`/g/${gallery.publicToken}`, '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                  Ver como cliente
                </Button>
              </div>

              {/* Share message — simple block, no card wrapper */}
              <div className="space-y-2">
                <Label>Mensagem de compartilhamento</Label>
                <Textarea
                  value={shareMessage}
                  onChange={e => setShareMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Essa mensagem será usada ao compartilhar por WhatsApp.</p>
              </div>
            </>
          )}
        </TabsContent>

        {/* === DESIGN & TEMAS === */}
        <TabsContent value="design" className="space-y-8 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Herança de Tema</h3>
                <p className="text-sm text-muted-foreground">Decida se esta galeria segue as regras da sua conta ou tem estilo próprio.</p>
                
                <div className="space-y-3">
                  <div 
                    className={cn(
                      "p-4 border rounded-xl cursor-pointer transition-all",
                      !useCustomTheme ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                    )}
                    onClick={() => setUseCustomTheme(false)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", !useCustomTheme ? "border-primary" : "border-muted-foreground")}>
                        {!useCustomTheme && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Herdar tema padrão</p>
                        <p className="text-xs text-muted-foreground">Usa o tema definido nas configurações da sua conta.</p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={cn(
                      "p-4 border rounded-xl cursor-pointer transition-all",
                      useCustomTheme ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                    )}
                    onClick={() => setUseCustomTheme(true)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", useCustomTheme ? "border-primary" : "border-muted-foreground")}>
                        {useCustomTheme && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Personalizar esta galeria</p>
                        <p className="text-xs text-muted-foreground">Escolha um tema e ajustes específicos apenas para este trabalho.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {useCustomTheme && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Selecione o Preset</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.values(THEME_REGISTRY).map((t) => (
                        <div 
                          key={t.id}
                          onClick={() => setActiveThemeId(t.id)}
                          className={cn(
                            "flex flex-col gap-2 p-3 border rounded-xl cursor-pointer transition-all text-center",
                            activeThemeId === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
                          )}
                        >
                          <span className="text-sm font-medium">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{t.layout.engine === 'editorial-grid' ? 'Editorial' : 'Classic'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Label className="text-base font-semibold">Ajustes Visuais</Label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Espaçamento (Gap)</Label>
                        <span className="text-xs font-mono">{themeOverrides?.layout?.gap ?? 8}px</span>
                      </div>
                      <Slider
                        value={[themeOverrides?.layout?.gap ?? 8]}
                        onValueChange={(vals) => setThemeOverrides({
                          ...themeOverrides,
                          layout: { ...(themeOverrides.layout || {}), gap: vals[0] }
                        })}
                        min={0}
                        max={40}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Capa da Galeria de Entrega — independente do Tema */}
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <Label className="text-base font-semibold">Capa da Galeria</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apresentação inicial (Hero). Independe do Tema (grid).
                  </p>
                </div>
                <CoverCatalog
                  selectedCoverId={coverId}
                  onSelect={setCoverId}
                />
              </div>


              <div className="pt-4 border-t">
                <Button onClick={handleSave} className="w-full gap-2 rounded-xl" disabled={saving}>
                  <Save className="h-4 w-4" />
                  Salvar Design
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">
                  Preview: {useCustomTheme 
                    ? `${THEME_REGISTRY[activeThemeId]?.name} (personalizado)` 
                    : 'Herança da conta'}
                </h4>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button 
                    variant={previewViewport === 'mobile' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setPreviewViewport('mobile')}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={previewViewport === 'tablet' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setPreviewViewport('tablet')}
                  >
                    <Tablet className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={previewViewport === 'desktop' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8", previewViewport === 'desktop' && "bg-background shadow-sm")}
                    onClick={() => setPreviewViewport('desktop')}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="min-h-[600px] h-[70vh] bg-muted rounded-2xl border border-muted overflow-hidden relative group shadow-lg">
                <div className="absolute inset-0 bg-background overflow-hidden flex flex-col">
                   <ThemePreviewCanvas 
                     themeId={activeThemeId}
                     themeOverrides={themeOverrides}
                     viewport={previewViewport}
                     skipHero={true}
                     isBlueprint={false}
                     previewPhotos={photos.slice(0, 12)}
                   />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                   <Button variant="secondary" className="gap-2 rounded-full" onClick={() => window.open(`/g/${gallery.publicToken}`, '_blank')}>
                     <Eye className="h-4 w-4" />
                     Ver prévia completa
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>


        {/* === FOTOS === */}
        <TabsContent value="photos" className="space-y-4 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-lg">
                {photos.length} fotos entregues
              </h3>
              {coverPhotoId && (
                <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  Capa selecionada
                </span>
              )}
              {(THEME_REGISTRY[activeThemeId]?.featured?.enabled !== false) && photos.some(p => (p.pesoVisual ?? 0) > 0) && (
                <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-blue-400 text-blue-400" />
                  {photos.filter(p => (p.pesoVisual ?? 0) > 0).length} destaque{photos.filter(p => (p.pesoVisual ?? 0) > 0).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Button onClick={() => setShowUploader(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Adicionar fotos
            </Button>
          </div>


          {showUploader && (
            <div className="border rounded-lg p-4 bg-card">
              <PhotoUploader
                galleryId={id!}
                onUploadComplete={handleUploadComplete}
                skipCredits={true}
                storageLimit={transferStorage.storageLimitBytes}
                storageUsed={transferStorage.storageUsedBytes}
              />
            </div>
          )}

          {photosLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map(photo => {
                const isCover = coverPhotoId === photo.id;
                const weight = photo.pesoVisual ?? 0;
                const themeSupportsFeatured = THEME_REGISTRY[activeThemeId]?.featured?.enabled !== false;
                const showHighlight = themeSupportsFeatured && weight > 0;
                return (
                  <div
                    key={photo.id}
                    className={cn(
                      'group relative aspect-square rounded-lg overflow-hidden bg-muted border-2 transition-all',
                      isCover && 'border-amber-400 ring-2 ring-amber-400/30',
                      !isCover && showHighlight && 'border-blue-400 ring-1 ring-blue-400/30',
                      !isCover && !showHighlight && 'border-transparent'
                    )}
                  >

                    <img
                      src={getPhotoUrl({ storageKey: photo.storageKey }, 'thumbnail')}
                      alt={photo.originalFilename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Badge CAPA */}
                    {isCover && (
                      <div className="absolute top-1.5 left-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        CAPA
                      </div>
                    )}
                    
                    {/* Badge DESTAQUE — só quando tema suporta */}
                    {showHighlight && (
                      <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10 shadow-sm">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        DESTAQUE
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100">
                      {themeSupportsFeatured && (
                        <Button
                          variant={weight > 0 ? 'default' : 'secondary'}
                          size="icon"
                          className={cn('h-8 w-8', weight > 0 && 'bg-blue-500 hover:bg-blue-600 text-white')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleHighlight(photo.id, weight);
                          }}
                          title={weight > 0 ? 'Remover destaque' : 'Destacar na grade'}
                          aria-label={weight > 0 ? 'Remover destaque' : 'Destacar na grade'}
                        >
                          <Star className={cn('h-4 w-4', weight > 0 && 'fill-current')} />
                        </Button>
                      )}
                      <Button
                        variant={isCover ? 'default' : 'secondary'}
                        size="icon"
                        className={cn('h-8 w-8', isCover && 'bg-amber-400 hover:bg-amber-300 text-black')}
                        onClick={() => handleSetCover(photo.id)}
                        title={isCover ? 'Remover capa' : 'Definir como capa'}
                      >
                        <ImageIcon className={cn('h-4 w-4', isCover && 'fill-current')} />
                      </Button>
                      <a
                        href={getPhotoUrl({ storageKey: photo.storageKey }, 'original')}
                        download={photo.originalFilename}
                        onClick={e => e.stopPropagation()}
                      >
                        <Button variant="secondary" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePhotoDelete(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.originalFilename}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Image className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma foto adicionada</h3>
              <p className="text-muted-foreground mb-4">Adicione as fotos finais para esta entrega.</p>
              <Button onClick={() => setShowUploader(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Adicionar fotos
              </Button>
            </div>
          )}
        </TabsContent>

        {/* === DETALHES === */}
        <TabsContent value="details" className="space-y-6 mt-6">
          {/* Block 1 — Session info */}
          <div className="space-y-5 p-5 rounded-lg border">
            <div className="space-y-2">
              <Label htmlFor="sessionName">Nome da sessão</Label>
              <Input id="sessionName" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Cliente</h4>
              <div className="space-y-1 text-sm">
                <div>{gallery.clienteNome || '—'}</div>
                <div className="text-muted-foreground">{gallery.clienteEmail || '—'}</div>
                <div className="text-muted-foreground">{gallery.clienteTelefone || '—'}</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Observações internas</Label>
              <Textarea
                id="internalNotes"
                placeholder="Anotações privadas sobre esta entrega..."
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Visíveis apenas para você.</p>
            </div>
          </div>

          {/* Block 2 — Settings */}
          <div className="space-y-5 p-5 rounded-lg border">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPrivate ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  <span className="text-sm font-medium">{isPrivate ? 'Privada (com senha)' : 'Pública'}</span>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              {isPrivate && (
                <div className="space-y-1">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="text" value={galleryPassword} onChange={e => setGalleryPassword(e.target.value)} />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <span className="text-sm font-medium">Data de expiração</span>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {expirationDate ? format(expirationDate, "dd/MM/yyyy") : 'Definir data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus />
                  </PopoverContent>
                </Popover>
                {expirationDate && (
                  <Button variant="ghost" size="sm" onClick={() => setExpirationDate(undefined)}>Remover</Button>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Mensagem de boas-vindas</span>
                  <p className="text-xs text-muted-foreground">Exibida ao cliente ao abrir a galeria</p>
                </div>
                <Switch checked={welcomeEnabled} onCheckedChange={(checked) => {
                  setWelcomeEnabled(checked);
                  if (!checked) setWelcomeMessage('');
                }} />
              </div>
              {welcomeEnabled && (
                <Textarea
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  placeholder="Olá! Suas fotos estão prontas..."
                  rows={4}
                />
              )}
            </div>

            <Separator />
            

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Download</span>
                <p className="text-xs text-muted-foreground">Download sempre ativo para entregas</p>
              </div>
              <Download className="h-4 w-4 text-primary" />
            </div>
          </div>
      </TabsContent>
      </Tabs>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="terracotta"
          size="lg"
          className="shadow-2xl gap-2 rounded-full px-6 h-12 backdrop-blur-xl"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
