import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  Pencil,
  Images,
  KeyRound,
  User,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { Client, ClientGalleryStatus } from '@/types/gallery';
import { toast } from 'sonner';

export default function Clients() {
  const navigate = useNavigate();
  const { clients, isLoading, createClient, updateClient } = useGalleryClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveClient = async (clientData: ClientFormData) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, clientData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await createClient(clientData);
        toast.success('Cliente cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      setEditingClient(null);
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('Erro ao salvar cliente');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleViewGalleries = (client: Client) => {
    navigate(`/clients/${client.id}`);
  };

  const handleResetPassword = (client: Client) => {
    toast.success(`Nova senha enviada para ${client.email}`);
  };

  const getStatusBadge = (status: ClientGalleryStatus) => {
    switch (status) {
      case 'ativo':
        return <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">Ativo</Badge>;
      case 'sem_galeria':
        return <Badge variant="secondary">Sem galeria</Badge>;
      default:
        return <Badge variant="secondary">Sem galeria</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os clientes das suas galerias
          </p>
        </div>
        <Button onClick={() => { setEditingClient(null); setIsModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="lunari-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div>
                      <p 
                        className="font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => handleViewGalleries(client)}
                      >
                        {client.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {client.phone || '—'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(client.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewGalleries(client)}>
                          <Images className="h-4 w-4 mr-2" />
                          Ver galerias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(client)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Redefinir senha
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <ClientModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        client={editingClient}
        onSave={handleSaveClient}
      />
    </div>
  );
}
