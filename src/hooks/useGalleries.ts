import { useState, useEffect, useCallback } from 'react';
import { Gallery, GalleryPhoto, GalleryAction, GallerySettings } from '@/types/gallery';
import { getStorageItem, setStorageItem, generateId, serializeWithDates, deserializeWithDates } from '@/lib/storage';
import { mockGalleries } from '@/data/mockData';

const STORAGE_KEY = 'galleries';

// Demo Package format for import/export
export interface DemoPackageV1 {
  version: 1;
  exportedAt: string;
  gallery: Gallery;
}

export interface CreateGalleryData {
  clientId: string;
  clientName: string;
  clientEmail: string;
  sessionName: string;
  packageName: string;
  includedPhotos: number;
  extraPhotoPrice: number;
  settings: GallerySettings;
  photos?: GalleryPhoto[];
  photoCount?: number; // For generating mock photos when testing
}

export interface UseGalleriesReturn {
  galleries: Gallery[];
  isLoading: boolean;
  getGallery: (id: string) => Gallery | undefined;
  getGalleriesByClient: (clientId: string) => Gallery[];
  createGallery: (data: CreateGalleryData) => Gallery;
  updateGallery: (id: string, data: Partial<Gallery>) => Gallery | undefined;
  deleteGallery: (id: string) => void;
  updatePhotoSelection: (galleryId: string, photoId: string, selected: boolean) => void;
  updatePhotoComment: (galleryId: string, photoId: string, comment: string) => void;
  confirmSelection: (galleryId: string) => void;
  reopenSelection: (galleryId: string) => void;
  sendGallery: (galleryId: string) => void;
  addGalleryAction: (galleryId: string, action: Omit<GalleryAction, 'id' | 'timestamp'>) => void;
  // Demo Mode functions
  exportGalleryPackage: (galleryId: string) => string | null;
  importGalleryPackage: (jsonText: string) => { galleryId: string; mode: 'created' | 'updated' } | { error: string };
}

export function useGalleries(): UseGalleriesReturn {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage (preferred) or seed with mock data
  useEffect(() => {
    const stored = getStorageItem<Gallery[]>(STORAGE_KEY);
    if (stored && stored.length > 0) {
      setGalleries(stored);
    } else {
      setStorageItem(STORAGE_KEY, mockGalleries);
      setGalleries(mockGalleries);
    }
    setIsLoading(false);
  }, []);

  // Persist changes to localStorage
  const persistGalleries = useCallback((newGalleries: Gallery[]) => {
    setStorageItem(STORAGE_KEY, newGalleries);
    setGalleries(newGalleries);
  }, []);

  const getGallery = useCallback((id: string) => {
    return galleries.find(g => g.id === id);
  }, [galleries]);

  const getGalleriesByClient = useCallback((clientId: string) => {
    // This matches by clientName for now - will use clientId after Supabase migration
    return galleries.filter(g => g.clientEmail === clientId || g.clientName === clientId);
  }, [galleries]);

  const createGallery = useCallback((data: CreateGalleryData): Gallery => {
    const now = new Date();
    
    // Generate mock photos if none provided (for testing purposes)
    let photos = data.photos || [];
    if (photos.length === 0) {
      const photoCount = data.photoCount || 20; // Default to 20 mock photos
      photos = Array.from({ length: photoCount }, (_, i) => {
        const seed = Date.now() + i;
        return {
          id: `photo-${generateId()}`,
          filename: `IMG_${String(i + 1).padStart(4, '0')}.jpg`,
          thumbnailUrl: `https://picsum.photos/seed/${seed}/400/300`,
          previewUrl: `https://picsum.photos/seed/${seed}/800/600`,
          originalUrl: `https://picsum.photos/seed/${seed}/1600/1200`,
          width: 800,
          height: 600,
          isSelected: false,
          order: i,
        };
      });
    }
    
    const newGallery: Gallery = {
      id: `gallery-${generateId()}`,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      sessionName: data.sessionName,
      packageName: data.packageName,
      includedPhotos: data.includedPhotos,
      extraPhotoPrice: data.extraPhotoPrice,
      status: 'created',
      selectionStatus: 'in_progress',
      settings: data.settings,
      photos,
      actions: [
        {
          id: `action-${generateId()}`,
          type: 'created',
          timestamp: now,
          description: 'Galeria criada',
        },
      ],
      createdAt: now,
      updatedAt: now,
      selectedCount: 0,
      extraCount: 0,
      extraTotal: 0,
    };

    persistGalleries([newGallery, ...galleries]);
    return newGallery;
  }, [galleries, persistGalleries]);

  const updateGallery = useCallback((id: string, data: Partial<Gallery>): Gallery | undefined => {
    let updatedGallery: Gallery | undefined;

    const newGalleries = galleries.map(g => {
      if (g.id === id) {
        updatedGallery = { ...g, ...data, updatedAt: new Date() };
        return updatedGallery;
      }
      return g;
    });

    if (updatedGallery) {
      persistGalleries(newGalleries);
    }

    return updatedGallery;
  }, [galleries, persistGalleries]);

  const deleteGallery = useCallback((id: string) => {
    persistGalleries(galleries.filter(g => g.id !== id));
  }, [galleries, persistGalleries]);

  const updatePhotoSelection = useCallback((galleryId: string, photoId: string, selected: boolean) => {
    const newGalleries = galleries.map(g => {
      if (g.id === galleryId) {
        const newPhotos = g.photos.map(p =>
          p.id === photoId ? { ...p, isSelected: selected } : p
        );
        const selectedCount = newPhotos.filter(p => p.isSelected).length;
        const extraCount = Math.max(0, selectedCount - g.includedPhotos);

        return {
          ...g,
          photos: newPhotos,
          selectedCount,
          extraCount,
          extraTotal: extraCount * g.extraPhotoPrice,
          updatedAt: new Date(),
        };
      }
      return g;
    });

    persistGalleries(newGalleries);
  }, [galleries, persistGalleries]);

  const updatePhotoComment = useCallback((galleryId: string, photoId: string, comment: string) => {
    const newGalleries = galleries.map(g => {
      if (g.id === galleryId) {
        const newPhotos = g.photos.map(p =>
          p.id === photoId ? { ...p, comment } : p
        );
        return { ...g, photos: newPhotos, updatedAt: new Date() };
      }
      return g;
    });

    persistGalleries(newGalleries);
  }, [galleries, persistGalleries]);

  const addGalleryAction = useCallback((galleryId: string, action: Omit<GalleryAction, 'id' | 'timestamp'>) => {
    const newGalleries = galleries.map(g => {
      if (g.id === galleryId) {
        return {
          ...g,
          actions: [
            ...g.actions,
            {
              id: `action-${generateId()}`,
              timestamp: new Date(),
              ...action,
            },
          ],
          updatedAt: new Date(),
        };
      }
      return g;
    });

    persistGalleries(newGalleries);
  }, [galleries, persistGalleries]);

  const confirmSelection = useCallback((galleryId: string) => {
    const newGalleries = galleries.map(g => {
      if (g.id === galleryId) {
        return {
          ...g,
          status: 'selection_completed' as const,
          selectionStatus: 'confirmed' as const,
          actions: [
            ...g.actions,
            {
              id: `action-${generateId()}`,
              type: 'client_confirmed' as const,
              timestamp: new Date(),
              description: 'Seleção confirmada pelo cliente',
            },
          ],
          updatedAt: new Date(),
        };
      }
      return g;
    });

    persistGalleries(newGalleries);
  }, [galleries, persistGalleries]);

  const reopenSelection = useCallback((galleryId: string) => {
    const newGalleries = galleries.map(g => {
      if (g.id === galleryId) {
        return {
          ...g,
          status: 'selection_started' as const,
          selectionStatus: 'in_progress' as const,
          actions: [
            ...g.actions,
            {
              id: `action-${generateId()}`,
              type: 'selection_reopened' as const,
              timestamp: new Date(),
              description: 'Seleção reaberta pelo fotógrafo',
            },
          ],
          updatedAt: new Date(),
        };
      }
      return g;
    });

    persistGalleries(newGalleries);
  }, [galleries, persistGalleries]);

  const sendGallery = useCallback((galleryId: string) => {
    const newGalleries = galleries.map(g => {
      if (g.id === galleryId) {
        return {
          ...g,
          status: 'sent' as const,
          actions: [
            ...g.actions,
            {
              id: `action-${generateId()}`,
              type: 'sent' as const,
              timestamp: new Date(),
              description: 'Link enviado para cliente',
            },
          ],
          updatedAt: new Date(),
        };
      }
      return g;
    });

    persistGalleries(newGalleries);
  }, [galleries, persistGalleries]);

  // Demo Mode: Export gallery as JSON package
  const exportGalleryPackage = useCallback((galleryId: string): string | null => {
    const gallery = galleries.find(g => g.id === galleryId);
    if (!gallery) return null;

    const pkg: DemoPackageV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      gallery,
    };

    return serializeWithDates(pkg);
  }, [galleries]);

  // Demo Mode: Import gallery from JSON package
  const importGalleryPackage = useCallback((jsonText: string): { galleryId: string; mode: 'created' | 'updated' } | { error: string } => {
    try {
      const pkg = deserializeWithDates<DemoPackageV1>(jsonText);

      // Validate package structure
      if (!pkg || typeof pkg !== 'object') {
        return { error: 'JSON inválido' };
      }
      if (pkg.version !== 1) {
        return { error: 'Versão do pacote não suportada' };
      }
      if (!pkg.gallery || !pkg.gallery.id) {
        return { error: 'Galeria inválida no pacote' };
      }
      if (!Array.isArray(pkg.gallery.photos)) {
        return { error: 'Fotos inválidas no pacote' };
      }

      const existingIndex = galleries.findIndex(g => g.id === pkg.gallery.id);
      const mode: 'created' | 'updated' = existingIndex >= 0 ? 'updated' : 'created';

      let newGalleries: Gallery[];
      if (existingIndex >= 0) {
        // Update existing gallery
        newGalleries = galleries.map((g, i) => i === existingIndex ? pkg.gallery : g);
      } else {
        // Add new gallery at the top
        newGalleries = [pkg.gallery, ...galleries];
      }

      persistGalleries(newGalleries);
      return { galleryId: pkg.gallery.id, mode };
    } catch (e) {
      console.error('Import error:', e);
      return { error: 'Erro ao processar JSON' };
    }
  }, [galleries, persistGalleries]);

  return {
    galleries,
    isLoading,
    getGallery,
    getGalleriesByClient,
    createGallery,
    updateGallery,
    deleteGallery,
    updatePhotoSelection,
    updatePhotoComment,
    confirmSelection,
    reopenSelection,
    sendGallery,
    addGalleryAction,
    exportGalleryPackage,
    importGalleryPackage,
  };
}
