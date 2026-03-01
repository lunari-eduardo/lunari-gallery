import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, FolderOpen, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGalleryFolders, GalleryFolderRow } from '@/hooks/useGalleryFolders';

interface FolderManagerProps {
  galleryId: string | null;
  activeFolderId: string | null;
  onActiveFolderChange: (folderId: string | null) => void;
  onFoldersChange?: (folders: GalleryFolderRow[]) => void;
}

export function FolderManager({
  galleryId,
  activeFolderId,
  onActiveFolderChange,
  onFoldersChange,
}: FolderManagerProps) {
  const { folders, fetchFolders, createFolder, updateFolder, deleteFolder, reorderFolders } =
    useGalleryFolders(galleryId);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (galleryId) fetchFolders();
  }, [galleryId, fetchFolders]);

  useEffect(() => {
    onFoldersChange?.(folders);
  }, [folders, onFoldersChange]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const folder = await createFolder(newName.trim());
    if (folder) {
      setNewName('');
      setIsAdding(false);
      // Auto-select newly created folder
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
      <div className="flex flex-wrap gap-2">
        {/* "Geral" (all / no folder) */}
        <button
          type="button"
          onClick={() => onActiveFolderChange(null)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border',
            activeFolderId === null
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Geral
        </button>

        {folders.map((folder, index) => (
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
                <FolderOpen className="h-3.5 w-3.5" />
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
        ))}
      </div>
    </div>
  );
}
