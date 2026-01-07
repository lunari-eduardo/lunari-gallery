import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGalleryAccess } from '@/hooks/useGalleryAccess';
import { Client, ClientGalleryStatus } from '@/types/gallery';

interface CreateClientData {
  name: string;
  email: string;
  phone?: string;
  galleryPassword: string;
}

interface UseGalleryClientsReturn {
  clients: Client[];
  isLoading: boolean;
  createClient: (data: CreateClientData) => Promise<Client>;
  updateClient: (id: string, data: Partial<CreateClientData>) => Promise<Client | undefined>;
  deleteClient: (id: string) => Promise<void>;
  searchClients: (query: string) => Client[];
  getClientById: (id: string) => Client | undefined;
  refetch: () => Promise<void>;
  hasGestaoIntegration: boolean;
  tableName: 'clientes' | 'gallery_clientes';
}

// Generate a random 6-character password
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useGalleryClients(): UseGalleryClientsReturn {
  const { user } = useAuth();
  const { hasGestaoIntegration, isLoading: accessLoading } = useGalleryAccess(user);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tableName = hasGestaoIntegration ? 'clientes' : 'gallery_clientes';

  // Map database row to Client interface
  const mapRowToClient = useCallback((row: any): Client => {
    if (hasGestaoIntegration) {
      // Mapping from 'clientes' table
      return {
        id: row.id,
        name: row.nome,
        email: row.email || '',
        phone: row.telefone || row.whatsapp || undefined,
        galleryPassword: row.gallery_password || generatePassword(),
        status: (row.gallery_status as ClientGalleryStatus) || 'sem_galeria',
        totalGalleries: row.total_galerias || 0,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } else {
      // Mapping from 'gallery_clientes' table
      return {
        id: row.id,
        name: row.nome,
        email: row.email,
        phone: row.telefone || undefined,
        galleryPassword: row.gallery_password,
        status: row.status as ClientGalleryStatus,
        totalGalleries: row.total_galerias || 0,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    }
  }, [hasGestaoIntegration]);

  // Fetch clients from the appropriate table
  const fetchClients = useCallback(async () => {
    if (!user || accessLoading) return;
    
    setIsLoading(true);
    try {
      if (hasGestaoIntegration) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome, email, telefone, whatsapp, gallery_password, gallery_status, total_galerias, created_at, updated_at')
          .eq('user_id', user.id)
          .order('nome', { ascending: true });

        if (error) throw error;
        setClients((data || []).map(mapRowToClient));
      } else {
        const { data, error } = await supabase
          .from('gallery_clientes')
          .select('*')
          .eq('user_id', user.id)
          .order('nome', { ascending: true });

        if (error) throw error;
        setClients((data || []).map(mapRowToClient));
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, accessLoading, hasGestaoIntegration, mapRowToClient]);

  useEffect(() => {
    if (!accessLoading) {
      fetchClients();
    }
  }, [fetchClients, accessLoading]);

  // Create a new client
  const createClient = useCallback(async (data: CreateClientData): Promise<Client> => {
    if (!user) throw new Error('User not authenticated');

    const password = data.galleryPassword || generatePassword();

    if (hasGestaoIntegration) {
      const { data: newRow, error } = await supabase
        .from('clientes')
        .insert({
          user_id: user.id,
          nome: data.name,
          email: data.email,
          telefone: data.phone || null,
          gallery_password: password,
          gallery_status: 'sem_galeria',
          total_galerias: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newClient = mapRowToClient(newRow);
      setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      return newClient;
    } else {
      const { data: newRow, error } = await supabase
        .from('gallery_clientes')
        .insert({
          user_id: user.id,
          nome: data.name,
          email: data.email,
          telefone: data.phone || null,
          gallery_password: password,
          status: 'sem_galeria',
          total_galerias: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newClient = mapRowToClient(newRow);
      setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      return newClient;
    }
  }, [user, hasGestaoIntegration, mapRowToClient]);

  // Update an existing client
  const updateClient = useCallback(async (id: string, data: Partial<CreateClientData>): Promise<Client | undefined> => {
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (data.name !== undefined) updateData.nome = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.telefone = data.phone;
    if (data.galleryPassword !== undefined) updateData.gallery_password = data.galleryPassword;

    if (hasGestaoIntegration) {
      const { data: updatedRow, error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedClient = mapRowToClient(updatedRow);
      setClients(prev => prev.map(c => c.id === id ? updatedClient : c));
      return updatedClient;
    } else {
      const { data: updatedRow, error } = await supabase
        .from('gallery_clientes')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedClient = mapRowToClient(updatedRow);
      setClients(prev => prev.map(c => c.id === id ? updatedClient : c));
      return updatedClient;
    }
  }, [user, hasGestaoIntegration, mapRowToClient]);

  // Delete a client
  const deleteClient = useCallback(async (id: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    const table = hasGestaoIntegration ? 'clientes' : 'gallery_clientes';
    
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    
    setClients(prev => prev.filter(c => c.id !== id));
  }, [user, hasGestaoIntegration]);

  // Search clients by name or email
  const searchClients = useCallback((query: string): Client[] => {
    const lowerQuery = query.toLowerCase();
    return clients.filter(
      client =>
        client.name.toLowerCase().includes(lowerQuery) ||
        client.email.toLowerCase().includes(lowerQuery)
    );
  }, [clients]);

  // Get client by ID
  const getClientById = useCallback((id: string): Client | undefined => {
    return clients.find(client => client.id === id);
  }, [clients]);

  return {
    clients,
    isLoading: isLoading || accessLoading,
    createClient,
    updateClient,
    deleteClient,
    searchClients,
    getClientById,
    refetch: fetchClients,
    hasGestaoIntegration,
    tableName,
  };
}
