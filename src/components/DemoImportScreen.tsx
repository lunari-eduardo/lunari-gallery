import { useState } from 'react';
import { Upload, Package, AlertCircle, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/Logo';

interface DemoImportScreenProps {
  galleryId: string;
  onImport: (jsonText: string) => { galleryId: string; mode: 'created' | 'updated' } | { error: string };
}

export function DemoImportScreen({ galleryId, onImport }: DemoImportScreenProps) {
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    if (!importText.trim()) {
      setError('Cole o JSON antes de importar');
      return;
    }

    setIsImporting(true);
    setError(null);
    
    const result = onImport(importText);
    setIsImporting(false);

    if ('error' in result) {
      setError(result.error);
    }
    // Se sucesso, o componente pai vai re-renderizar e mostrar a galeria
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      setError(null);
    };
    reader.onerror = () => {
      setError('Erro ao ler arquivo');
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-center p-4 border-b border-border/50">
        <Logo size="sm" />
      </header>
      
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 animate-slide-up">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <Package className="h-10 w-10 text-warning" />
            </div>
            
            <h1 className="font-display text-2xl font-semibold mb-2">
              Galeria não encontrada
            </h1>
            <p className="text-muted-foreground text-sm">
              Este projeto está em modo local (sem banco de dados).
            </p>
          </div>

          <div className="lunari-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium">ID da galeria solicitada:</p>
                <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block break-all">
                  {galleryId}
                </code>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Para acessar a galeria:</p>
              <p className="text-xs text-muted-foreground">
                Peça ao fotógrafo para exportar o JSON da galeria e cole abaixo, 
                ou faça upload do arquivo .json.
              </p>
            </div>

            <Textarea
              placeholder='{"version": 1, "exportedAt": "...", "gallery": {...}}'
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setError(null);
              }}
              rows={6}
              className="font-mono text-xs"
            />

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                className="flex-1" 
                onClick={handleImport} 
                disabled={isImporting || !importText.trim()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? 'Importando...' : 'Importar e Abrir'}
              </Button>
              
              <label className="flex-1">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <FileJson className="h-4 w-4 mr-2" />
                    Upload .json
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Após importar, você poderá selecionar as fotos normalmente.
          </p>
        </div>
      </main>
    </div>
  );
}