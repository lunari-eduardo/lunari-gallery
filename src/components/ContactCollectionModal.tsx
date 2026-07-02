import { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export interface ContactCollectionMissing {
  email: boolean;
  phone: boolean;
  name: boolean;
}

interface Props {
  open: boolean;
  missing: ContactCollectionMissing;
  requirePhone?: boolean; // provedor PIX direto exige telefone
  onCancel: () => void;
  onSubmit: (data: { email?: string; phone?: string; nome?: string }) => Promise<void>;
}

const emailSchema = z.string().trim().toLowerCase().email({ message: 'Email inválido' }).max(160);
const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 13, { message: 'Telefone inválido' });
const nomeSchema = z.string().trim().min(2, { message: 'Informe seu nome' }).max(80);

/**
 * Modal que aparece antes do redirect ao checkout quando faltam dados
 * (email, telefone ou nome) para pré-preencher o pagamento e enriquecer o CRM.
 * Todos os campos coletados são gravados via RPC `upsert_visitor_contact`.
 */
export function ContactCollectionModal({ open, missing, requirePhone, onCancel, onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nome, setNome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsEmail = missing.email;
  const needsPhone = missing.phone && requirePhone;
  const needsName = missing.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { email?: string; phone?: string; nome?: string } = {};

    if (needsEmail) {
      const r = emailSchema.safeParse(email);
      if (!r.success) return toast.error(r.error.issues[0].message);
      payload.email = r.data;
    }
    if (needsPhone) {
      const r = phoneSchema.safeParse(phone);
      if (!r.success) return toast.error(r.error.issues[0].message);
      payload.phone = r.data;
    } else if (phone.trim()) {
      const r = phoneSchema.safeParse(phone);
      if (r.success) payload.phone = r.data;
    }
    if (needsName) {
      const r = nomeSchema.safeParse(nome);
      if (!r.success) return toast.error(r.error.issues[0].message);
      payload.nome = r.data;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Antes de continuar…</DialogTitle>
          <DialogDescription>
            Precisamos de um contato para enviar o comprovante e agilizar o pagamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {needsName && (
            <div className="space-y-1.5">
              <Label htmlFor="cc-nome">Seu nome</Label>
              <Input
                id="cc-nome"
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar"
                maxLength={80}
              />
            </div>
          )}

          {needsEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="cc-email">Email</Label>
              <Input
                id="cc-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus={!needsName}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                Usado para envio do comprovante de pagamento.
              </p>
            </div>
          )}

          {needsPhone && (
            <div className="space-y-1.5">
              <Label htmlFor="cc-phone">WhatsApp</Label>
              <Input
                id="cc-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                maxLength={20}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Continuar para pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
