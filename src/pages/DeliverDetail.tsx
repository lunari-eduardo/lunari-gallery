import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, Send, Trash2, Image, Upload, Link2, Copy, Eye,
  Lock, Unlock, Calendar as CalendarIcon, Download, Share2,
  MessageSquare, Mail, ExternalLink, Loader2, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { getPhotoUrl } from '@/lib/photoUrl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

  const [photos, setPhotos] = useState<GaleriaPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [sessionName, setSessionName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [shareMessage, setShareMessage] = useState('Suas fotos finais estão prontas para download.');

  const gallery = useMemo(() => getGallery(id || ''), [id, galleries]);

  // Load gallery data
  useEffect(() => {
    if (gallery) {
      setSessionName(gallery.nomeSessao || '');
      setWelcomeMessage(gallery.mensagemBoasVindas || '');
      setInternalNotes((gallery.configuracoes as any)?.notasInternas || '');
      setIsPrivate(gallery.permissao === 'private');
      setGalleryPassword(gallery.galleryPassword || '');
      setExpirationDate(gallery.prazoSelecao || undefined);
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
        <h2 className="font-display text-2xl font-semibold mb-2">Galeria não encontrada</h2>
        <Button variant="outline" onClick={() => navigate('/galleries/deliver')}>Voltar</Button>
      </div>
    );
  }

  const statusInfo = getDeliverStatusInfo(gallery.status, gallery.prazoSelecao);
  const isDraft = statusInfo.label === 'Rascunho';
  const isPublished = statusInfo.label === 'Publicada';
  const isExpired = statusInfo.label === 'Expirada';
  const galleryUrl = gallery.publicToken ? getGalleryUrl(gallery.publicToken) : '';

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateGallery({ id, data: {
        nomeSessao: sessionName,
        mensagemBoasVindas: welcomeMessage,
        permissao: isPrivate ? 'private' : 'public',
        configuracoes: {
          ...gallery.configuracoes,
          notasInternas: internalNotes,
        },
        prazoSelecao: expirationDate,
      }});
      toast.success('Alterações salvas');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    try {
      await sendGallery(id);
      toast.success('Entrega publicada!');
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
    await deletePhoto({ galleryId: id, photoId });
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleUploadComplete = (uploaded: UploadedPhoto[]) => {
    setShowUploader(false);
    if (id) {
      fetchGalleryPhotos(id).then(setPhotos);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(`${shareMessage}\n\n${galleryUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={() => navigate('/galleries/deliver')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-semibold">{gallery.nomeSessao || 'Sem título'}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {gallery.clienteNome || 'Sem cliente'} • {format(gallery.createdAt, "dd MMM yyyy", { locale: ptBR })} • {photos.length} fotos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <Button onClick={handlePublish} className="gap-2">
                <Send className="h-4 w-4" />
                Publicar entrega
              </Button>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <DeleteGalleryDialog galleryName={gallery.nomeSessao || 'esta galeria'} onDelete={handleDelete} />
          </div>
        </div>
      </div>

      {/* Internal Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="access">Acesso & Download</TabsTrigger>
          <TabsTrigger value="share">Compartilhamento</TabsTrigger>
        </TabsList>

        {/* === DETALHES === */}
        <TabsContent value="details" className="space-y-6 mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Client info */}
            <div className="space-y-4 p-4 rounded-xl border bg-card">
              <h3 className="font-display font-semibold text-lg">Cliente</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> {gallery.clienteNome || '—'}</div>
                <div><span className="text-muted-foreground">Email:</span> {gallery.clienteEmail || '—'}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {gallery.clienteTelefone || '—'}</div>
              </div>
            </div>

            {/* Session details */}
            <div className="space-y-4 p-4 rounded-xl border bg-card">
              <h3 className="font-display font-semibold text-lg">Sessão</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sessionName">Nome da sessão</Label>
                  <Input id="sessionName" value={sessionName} onChange={e => setSessionName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="welcomeMessage">Mensagem de boas-vindas</Label>
                  <Textarea id="welcomeMessage" value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          </div>

          {/* Internal notes */}
          <div className="p-4 rounded-xl border bg-card space-y-3">
            <h3 className="font-display font-semibold text-lg">Observações internas</h3>
            <Textarea
              placeholder="Anotações privadas sobre esta entrega..."
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">Estas notas são visíveis apenas para você.</p>
          </div>
        </TabsContent>

        {/* === FOTOS === */}
        <TabsContent value="photos" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-lg">{photos.length} fotos entregues</h3>
            <Button onClick={() => setShowUploader(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Adicionar fotos
            </Button>
          </div>

          {showUploader && (
            <div className="border rounded-xl p-4 bg-card">
              <PhotoUploader
                galleryId={id!}
                onUploadComplete={handleUploadComplete}
                skipCredits={true}
              />
            </div>
          )}

          {photosLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={getPhotoUrl({ storageKey: photo.storageKey }, 'thumbnail')}
                    alt={photo.originalFilename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePhotoDelete(photo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.originalFilename}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Image className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Nenhuma foto adicionada</h3>
              <p className="text-muted-foreground mb-4">Adicione as fotos finais para esta entrega.</p>
              <Button onClick={() => setShowUploader(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Adicionar fotos
              </Button>
            </div>
          )}
        </TabsContent>

        {/* === ACESSO & DOWNLOAD === */}
        <TabsContent value="access" className="space-y-6 mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Public link */}
            <div className="p-4 rounded-xl border bg-card space-y-4">
              <h3 className="font-display font-semibold text-lg">Link da galeria</h3>
              {galleryUrl ? (
                <div className="flex gap-2">
                  <Input value={galleryUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(galleryUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">O link será gerado ao publicar a entrega.</p>
              )}
            </div>

            {/* Privacy */}
            <div className="p-4 rounded-xl border bg-card space-y-4">
              <h3 className="font-display font-semibold text-lg">Privacidade</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPrivate ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  <span className="text-sm">{isPrivate ? 'Privada (com senha)' : 'Pública'}</span>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              {isPrivate && (
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="text" value={galleryPassword} onChange={e => setGalleryPassword(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Expiration */}
          <div className="p-4 rounded-xl border bg-card space-y-4">
            <h3 className="font-display font-semibold text-lg">Expiração</h3>
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {expirationDate ? format(expirationDate, "dd/MM/yyyy") : 'Definir data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus />
                </PopoverContent>
              </Popover>
              {expirationDate && (
                <Button variant="ghost" size="sm" onClick={() => setExpirationDate(undefined)}>Remover prazo</Button>
              )}
            </div>
          </div>

          {/* Download status */}
          <div className="p-4 rounded-xl border bg-card space-y-2">
            <h3 className="font-display font-semibold text-lg">Download</h3>
            <div className="flex items-center gap-2 text-sm">
              <Download className="h-4 w-4 text-primary" />
              <span>Download sempre ativo para galerias de entrega</span>
            </div>
          </div>
        </TabsContent>

        {/* === COMPARTILHAMENTO === */}
        <TabsContent value="share" className="space-y-6 mt-4">
          {isDraft ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Share2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Publique primeiro</h3>
              <p className="text-muted-foreground mb-6">Publique a entrega para habilitar o compartilhamento.</p>
              <Button onClick={handlePublish} className="gap-2">
                <Send className="h-4 w-4" />
                Publicar entrega
              </Button>
            </div>
          ) : (
            <>
              {/* Quick actions */}
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => copyToClipboard(galleryUrl)}>
                  <Copy className="h-5 w-5" />
                  <span className="text-sm">Copiar link</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={openWhatsApp}>
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm">WhatsApp</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" disabled>
                  <Mail className="h-5 w-5" />
                  <span className="text-sm">E-mail (em breve)</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => window.open(`/g/${gallery.publicToken}`, '_blank')}>
                  <ExternalLink className="h-5 w-5" />
                  <span className="text-sm">Ver como cliente</span>
                </Button>
              </div>

              {/* Custom message */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <h3 className="font-display font-semibold text-lg">Mensagem de compartilhamento</h3>
                <Textarea
                  value={shareMessage}
                  onChange={e => setShareMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Esta mensagem será usada ao compartilhar por WhatsApp.</p>
              </div>

              {/* Link display */}
              {galleryUrl && (
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <h3 className="font-display font-semibold text-lg">Link da galeria</h3>
                  <div className="flex gap-2">
                    <Input value={galleryUrl} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(galleryUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
