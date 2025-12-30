import { useState, useEffect, useCallback } from 'react';
import { Client } from '@/types/gallery';
import { getStorageItem, setStorageItem, isStorageInitialized, setStorageInitialized, generateId } from '@/lib/storage';
import { mockClients } from '@/data/mockData';

const STORAGE_KEY = 'clients';

export type CreateClientData = Omit<Client, 'id' | 'status' | 'linkedGalleries' | 'createdAt' | 'updatedAt'>;

export interface UseClientsReturn {
  clients: Client[];
  isLoading: boolean;
  getClient: (id: string) => Client | undefined;
  getClientByEmail: (email: string) => Client | undefined;
  createClient: (data: CreateClientData) => Client;
  updateClient: (id: string, data: Partial<CreateClientData>) => Client | undefined;
  deleteClient: (id: string) => void;
  searchClients: (query: string) => Client[];
  linkGalleryToClient: (clientId: string, galleryId: string) => void;
  unlinkGalleryFromClient: (clientId: string, galleryId: string) => void;
}

export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage or mock data
  useEffect(() => {
    const loadClients = () => {
      if (!isStorageInitialized()) {
        // First time: populate with mock data
        setStorageItem(STORAGE_KEY, mockClients);
        setStorageInitialized();
        setClients(mockClients);
      } else {
        const stored = getStorageItem<Client[]>(STORAGE_KEY);
        setClients(stored || []);
      }
      setIsLoading(false);
    };

    loadClients();
  }, []);

  // Persist changes to localStorage
  const persistClients = useCallback((newClients: Client[]) => {
    setStorageItem(STORAGE_KEY, newClients);
    setClients(newClients);
  }, []);

  const getClient = useCallback((id: string) => {
    return clients.find(c => c.id === id);
  }, [clients]);

  const getClientByEmail = useCallback((email: string) => {
    return clients.find(c => c.email.toLowerCase() === email.toLowerCase());
  }, [clients]);

  const createClient = useCallback((data: CreateClientData): Client => {
    const newClient: Client = {
      id: `client-${generateId()}`,
      ...data,
      status: 'no_gallery',
      linkedGalleries: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    persistClients([newClient, ...clients]);
    return newClient;
  }, [clients, persistClients]);

  const updateClient = useCallback((id: string, data: Partial<CreateClientData>): Client | undefined => {
    let updatedClient: Client | undefined;
    
    const newClients = clients.map(c => {
      if (c.id === id) {
        updatedClient = { ...c, ...data, updatedAt: new Date() };
        return updatedClient;
      }
      return c;
    });
    
    if (updatedClient) {
      persistClients(newClients);
    }
    
    return updatedClient;
  }, [clients, persistClients]);

  const deleteClient = useCallback((id: string) => {
    persistClients(clients.filter(c => c.id !== id));
  }, [clients, persistClients]);

  const searchClients = useCallback((query: string): Client[] => {
    if (!query.trim()) return clients;
    
    const lowerQuery = query.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.email.toLowerCase().includes(lowerQuery)
    );
  }, [clients]);

  const linkGalleryToClient = useCallback((clientId: string, galleryId: string) => {
    const newClients = clients.map(c => {
      if (c.id === clientId && !c.linkedGalleries.includes(galleryId)) {
        return {
          ...c,
          linkedGalleries: [...c.linkedGalleries, galleryId],
          status: 'active' as const,
          updatedAt: new Date(),
        };
      }
      return c;
    });
    persistClients(newClients);
  }, [clients, persistClients]);

  const unlinkGalleryFromClient = useCallback((clientId: string, galleryId: string) => {
    const newClients = clients.map(c => {
      if (c.id === clientId) {
        const newLinked = c.linkedGalleries.filter(id => id !== galleryId);
        return {
          ...c,
          linkedGalleries: newLinked,
          status: newLinked.length > 0 ? 'active' as const : 'no_gallery' as const,
          updatedAt: new Date(),
        };
      }
      return c;
    });
    persistClients(newClients);
  }, [clients, persistClients]);

  return {
    clients,
    isLoading,
    getClient,
    getClientByEmail,
    createClient,
    updateClient,
    deleteClient,
    searchClients,
    linkGalleryToClient,
    unlinkGalleryFromClient,
  };
}
