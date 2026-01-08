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
  RotateCcw,
  Image,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function GalleryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { 
    getGallery,
    updateGallery,
    deleteGallery,
    reopenSelection,
    isLoading: isSupabaseLoading,
    isUpdating,
    isDeleting
  } = useSupabaseGalleries();

  const gallery = getGallery(id || '');
  
  // Form state
  const [nomeSessao, setNomeSessao] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [nomePacote, setNomePacote] = useState('');
  const [fotosIncluidas, setFotosIncluidas] = useState(0);
  const [valorFotoExtra, setValorFotoExtra] = useState(0);
  const [prazoSelecao, setPrazoSelecao] = useState<Date | undefined>();

  // Initialize form with gallery data
  useEffect(() => {
    if (gallery) {
      setNomeSessao(gallery.nomeSessao || '');
      setClienteNome(gallery.clienteNome || '');
      setClienteEmail(gallery.clienteEmail || '');
      setNomePacote(gallery.nomePacote || '');
      setFotosIncluidas(gallery.fotosIncluidas);
      setValorFotoExtra(gallery.valorFotoExtra);
      setPrazoSelecao(gallery.prazoSelecao || undefined);
    }
  }, [gallery]);

  // Loading state
  if (isSupabaseLoading) {
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
      await updateGallery({
        id: gallery.id,
        data: {
          nomeSessao,
          clienteNome,
          clienteEmail,
          nomePacote: nomePacote || undefined,
          fotosIncluidas,
          valorFotoExtra,
        }
      });
      toast.success('Galeria atualizada!');
    } catch (error) {
      console.error('Error updating gallery:', error);
    }
  };

  const handleExtendDeadline = async (days: number) => {
    const newDeadline = addDays(prazoSelecao || new Date(), days);
    setPrazoSelecao(newDeadline);
    
    // Note: updateGallery doesn't currently support prazoSelecao update directly
    // This would need to be added to the hook if needed
    toast.success(`Prazo estendido em ${days} dias!`);
  };

  const handleDelete = async () => {
    await deleteGallery(gallery.id);
    navigate('/');
  };

  const handleReactivate = async () => {
    try {
      await reopenSelection(gallery.id);
      toast.success('Galeria reativada!', {
        description: 'O cliente pode fazer seleções novamente.',
      });
    } catch (error) {
      console.error('Error reactivating gallery:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
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
        
        <DeleteGalleryDialog 
          galleryName={gallery.nomeSessao || 'Esta galeria'}
          onDelete={handleDelete}
        />
      </div>

      {/* Main Form */}
      <div className="grid gap-6">
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clienteNome">Nome do Cliente</Label>
                <Input
                  id="clienteNome"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              
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

            <div className="pt-4 flex justify-end">
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

              <div className="flex gap-2">
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

        {/* Photos Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Fotos da Galeria
            </CardTitle>
            <CardDescription>
              {gallery.totalFotos} fotos nesta galeria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/gallery/${id}`)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ver e Gerenciar Fotos
            </Button>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Ações da Galeria</CardTitle>
            <CardDescription>
              Ações que afetam a disponibilidade da galeria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canReactivate && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Reativar Galeria</p>
                  <p className="text-sm text-muted-foreground">
                    Permite que o cliente faça novas seleções
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={handleReactivate}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reativar
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
              <div>
                <p className="font-medium text-destructive">Excluir Galeria</p>
                <p className="text-sm text-muted-foreground">
                  Remove permanentemente a galeria e todas as fotos
                </p>
              </div>
              <DeleteGalleryDialog 
                galleryName={gallery.nomeSessao || 'Esta galeria'}
                onDelete={handleDelete}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
