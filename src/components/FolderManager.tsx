import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, FolderOpen, Check, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGalleryFolders, GalleryFolderRow } from '@/hooks/useGalleryFolders';

interface FolderManagerProps {
  galleryId: string | null;
  activeFolderId: string | null;
  onActiveFolderChange: (folderId: string | null) => void;
  onFoldersChange?: (folders: GalleryFolderRow[]) => void;
  /** Photos in gallery (used for cover photo selection) */
  photos?: Array<{ id: string; pastaId?: string | null; thumbnailUrl?: string; originalFilename?: string }>;
  /** Show cover photo selector */
  showCoverSelect?: boolean;
}

export function FolderManager({
  galleryId,
  activeFolderId,
  onActiveFolderChange,
  onFoldersChange,
  photos = [],
  showCoverSelect = false,
}: FolderManagerProps) {
  const { folders, fetchFolders, createFolder, updateFolder, deleteFolder, reorderFolders, setCoverPhoto } =
    useGalleryFolders(galleryId);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showCoverPicker, setShowCoverPicker] = useState<string | null>(null);

  useEffect(() => {
    if (galleryId) fetchFolders();
  }, [galleryId, fetchFolders]);

  useEffect(() => {
    onFoldersChange?.(folders);
  }, [folders, onFoldersChange]);

  // Auto-select first folder if folders exist and none selected
  useEffect(() => {
    if (folders.length > 0 && activeFolderId === null) {
      onActiveFolderChange(folders[0].id);
    }
    if (folders.length > 0 && activeFolderId && !folders.find(f => f.id === activeFolderId)) {
      onActiveFolderChange(folders[0].id);
    }
  }, [folders, activeFolderId, onActiveFolderChange]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const folder = await createFolder(newName.trim());
    if (folder) {
      setNewName('');
      setIsAdding(false);
      onActiveFolderChange(folder.id);
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    await updateFolder(id, editingName.trim());
    setEditingId(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...folders];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    reorderFolders(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index === folders.length - 1) return;
    const reordered = [...folders];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    reorderFolders(reordered);
  };

  const handleSetCover = async (folderId: string, photoId: string | null) => {
    await setCoverPhoto(folderId, photoId);
    setShowCoverPicker(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Pastas</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="gap-1 h-7 text-xs"
        >
          <Plus className="h-3 w-3" />
          Nova pasta
        </Button>
      </div>

      {/* Add new folder inline */}
      {isAdding && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
            }}
            placeholder="Nome da pasta"
            className="h-8 text-sm"
          />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleAdd}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setIsAdding(false); setNewName(''); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Folder tabs */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {folders.map((folder, index) => {
            const coverPhoto = photos.find(p => p.id === folder.cover_photo_id);
            return (
              <div key={folder.id} className="group relative flex items-center">
                {editingId === folder.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(folder.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="h-8 w-32 text-sm"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRename(folder.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onActiveFolderChange(folder.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
                      activeFolderId === folder.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                    )}
                  >
                    {coverPhoto?.thumbnailUrl ? (
                      <img src={coverPhoto.thumbnailUrl} alt="" className="h-4 w-4 rounded object-cover" />
                    ) : (
                      <FolderOpen className="h-3.5 w-3.5" />
                    )}
                    {folder.nome}
                  </button>
                )}

                {/* Actions on hover */}
                {editingId !== folder.id && (
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => { setEditingId(folder.id); setEditingName(folder.nome); }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      title="Renomear"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {showCoverSelect && (
                      <button
                        type="button"
                        onClick={() => setShowCoverPicker(showCoverPicker === folder.id ? null : folder.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Definir capa"
                      >
                        <ImageIcon className="h-3 w-3" />
                      </button>
                    )}
                    {index > 0 && (
                      <button type="button" onClick={() => handleMoveUp(index)} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Mover para cima">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                    )}
                    {index < folders.length - 1 && (
                      <button type="button" onClick={() => handleMoveDown(index)} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Mover para baixo">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteFolder(folder.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                      title="Excluir pasta"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cover photo picker */}
      {showCoverPicker && (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Selecione a capa da pasta</p>
          <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
            {photos
              .filter(p => p.pastaId === showCoverPicker)
              .map(photo => {
                const isCurrentCover = folders.find(f => f.id === showCoverPicker)?.cover_photo_id === photo.id;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => handleSetCover(showCoverPicker, isCurrentCover ? null : photo.id)}
                    className={cn(
                      'relative aspect-square rounded overflow-hidden border-2 transition-colors',
                      isCurrentCover ? 'border-primary' : 'border-transparent hover:border-primary/50'
                    )}
                  >
                    <img src={photo.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    {isCurrentCover && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Warning: folders exist but none selected */}
      {folders.length > 0 && !activeFolderId && (
        <p className="text-xs text-destructive">Selecione uma pasta para enviar fotos</p>
      )}
    </div>
  );
}
