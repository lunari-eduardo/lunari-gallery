import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GalleryFolderRow {
  id: string;
  galeria_id: string;
  user_id: string;
  nome: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export function useGalleryFolders(galleryId: string | null) {
  const [folders, setFolders] = useState<GalleryFolderRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFolders = useCallback(async () => {
    if (!galleryId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('galeria_pastas')
      .select('*')
      .eq('galeria_id', galleryId)
      .order('ordem');
    if (error) {
      console.error('Error fetching folders:', error);
    } else {
      setFolders(data || []);
    }
    setIsLoading(false);
  }, [galleryId]);

  const createFolder = useCallback(async (name: string) => {
    if (!galleryId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const nextOrder = folders.length > 0 ? Math.max(...folders.map(f => f.ordem)) + 1 : 0;

    const { data, error } = await supabase
      .from('galeria_pastas')
      .insert({
        galeria_id: galleryId,
        user_id: user.id,
        nome: name,
        ordem: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      toast.error('Erro ao criar pasta');
      return null;
    }

    setFolders(prev => [...prev, data]);
    return data;
  }, [galleryId, folders]);

  const updateFolder = useCallback(async (folderId: string, name: string) => {
    const { error } = await supabase
      .from('galeria_pastas')
      .update({ nome: name, updated_at: new Date().toISOString() })
      .eq('id', folderId);

    if (error) {
      console.error('Error updating folder:', error);
      toast.error('Erro ao renomear pasta');
      return;
    }

    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, nome: name } : f));
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    const { error } = await supabase
      .from('galeria_pastas')
      .delete()
      .eq('id', folderId);

    if (error) {
      console.error('Error deleting folder:', error);
      toast.error('Erro ao excluir pasta');
      return;
    }

    setFolders(prev => prev.filter(f => f.id !== folderId));
    toast.success('Pasta excluída. Fotos movidas para "Geral".');
  }, []);

  const reorderFolders = useCallback(async (reordered: GalleryFolderRow[]) => {
    setFolders(reordered);
    // Update order in parallel
    await Promise.all(
      reordered.map((f, i) =>
        supabase
          .from('galeria_pastas')
          .update({ ordem: i })
          .eq('id', f.id)
      )
    );
  }, []);

  return {
    folders,
    isLoading,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
  };
}
