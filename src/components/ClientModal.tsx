import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Client } from '@/types/gallery';

interface ClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (data: Omit<Client, 'id' | 'status' | 'linkedGalleries' | 'createdAt' | 'updatedAt'>) => void;
}

export function ClientModal({ open, onOpenChange, client, onSave }: ClientModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isEditing = !!client;

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone || '');
      setPassword(client.galleryPassword);
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
    }
  }, [client, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      galleryPassword: password,
    });
  };

  const isValid = name.trim() && email.trim() && password.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do cliente *</Label>
            <Input
              id="name"
              placeholder="Ex: Maria Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email do cliente *</Label>
            <Input
              id="email"
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha de acesso à galeria *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha do cliente"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usada pelo cliente para acessar suas fotos
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid}>
              {isEditing ? 'Salvar Alterações' : 'Salvar Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
