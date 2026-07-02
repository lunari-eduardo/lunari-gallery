import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Client } from '@/types/gallery';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ClientFormData {
  name: string;
  email: string;
  phone?: string;
  galleryPassword?: string;
}

interface ClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (data: ClientFormData) => void;
}

/**
 * Modal enxuto para criação/edição rápida de cliente (nome, email, telefone).
 *
 * SEGURANÇA:
 *  - Removido o campo de senha (era `type="password"`) que permitia ao gerenciador
 *    de senhas do navegador injetar credenciais do próprio fotógrafo.
 *  - Inputs decoy no topo do form e nomes randômicos quebram o heurístico
 *    email+password do Chrome/Safari.
 *  - Senha de acesso à galeria agora só pode ser editada dentro do perfil do
 *    cliente (aba Contato), onde o contexto é seguro e explícito.
 */
export function ClientModal({ open, onOpenChange, client, onSave }: ClientModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const isEditing = !!client;

  // Sufixo único por abertura → impede o autofill de "reconhecer" os campos.
  const nameSuffix = useMemo(
    () => Math.random().toString(36).slice(2, 10),
    // regenera a cada abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
    }
  }, [client, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return;

    // Cinto extra: se o email igualar ao email do fotógrafo autenticado,
    // é forte indício de autofill do navegador.
    if (user?.email && trimmedEmail && trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      toast.error('Este e-mail pertence à sua conta. Digite o e-mail do cliente.');
      return;
    }

    onSave({
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim() || undefined,
    });
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Dados adicionais (endereço, documentos, senha da galeria) ficam no perfil do cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4" autoComplete="off">
          {/* Decoys: absorvem o autofill do gerenciador de senhas */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <input type="text" name="username" tabIndex={-1} autoComplete="username" />
            <input type="password" name="password" tabIndex={-1} autoComplete="new-password" />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cli_name_${nameSuffix}`}>Nome do cliente *</Label>
            <Input
              id={`cli_name_${nameSuffix}`}
              name={`cli_name_${nameSuffix}`}
              placeholder="Ex: Maria Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cli_email_${nameSuffix}`}>E-mail do cliente</Label>
            <Input
              id={`cli_email_${nameSuffix}`}
              name={`cli_email_${nameSuffix}`}
              type="text"
              inputMode="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cli_phone_${nameSuffix}`}>Telefone (opcional)</Label>
            <Input
              id={`cli_phone_${nameSuffix}`}
              name={`cli_phone_${nameSuffix}`}
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
            />
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
