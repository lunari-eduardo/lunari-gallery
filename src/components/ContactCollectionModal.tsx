import { useMemo, useState } from 'react';
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
import { isValidCpfCnpj, maskCpfCnpj, onlyDigits } from '@/lib/validateCpfCnpj';

export interface ContactCollectionMissing {
  email: boolean;
  phone: boolean;
  name: boolean;
  cpfCnpj?: boolean;
  provider?: 'asaas' | 'infinitepay' | 'mercadopago' | null;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | null;
  cpfRequired?: boolean;
}

interface Props {
  open: boolean;
  missing: ContactCollectionMissing;
  requirePhone?: boolean;
  onCancel: () => void;
  onSubmit: (data: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => Promise<void>;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

const emailSchema = z.string().trim().toLowerCase().email({ message: 'Email inválido' }).max(160);
const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 13, { message: 'Telefone inválido' });
const nomeSchema = z.string().trim().min(2, { message: 'Informe seu nome' }).max(80);

/**
 * Modal que aparece antes do redirect ao checkout quando faltam dados
 * (email, telefone, nome ou CPF/CNPJ). CPF é obrigatório quando o provedor
 * ativo é o Asaas (exige `cpfCnpj` para gerar PIX/boleto/cartão).
 */
export function ContactCollectionModal({ open, missing, requirePhone, onCancel, onSubmit, themeStyles, backgroundMode }: Props) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Telefone é sempre obrigatório quando o provedor Asaas exige (PIX/Boleto).
  const asaasNeedsPhone = missing.cpfRequired && missing.billingType !== 'CREDIT_CARD';
  const needsEmail = missing.email;
  const needsPhone = missing.phone && (requirePhone || asaasNeedsPhone);
  const needsName = missing.name;
  const needsCpf = !!missing.cpfCnpj;

  const cpfValid = useMemo(() => (needsCpf ? isValidCpfCnpj(cpfCnpj) : true), [cpfCnpj, needsCpf]);

  const onlyCpfMissing = needsCpf && !needsEmail && !needsPhone && !needsName;

  const title = onlyCpfMissing ? 'Falta um dado para o pagamento' : 'Antes de continuar…';
  const description = onlyCpfMissing
    ? 'Precisamos do seu CPF ou CNPJ para emitir a cobrança. Exigido pelo Banco Central para gerar o PIX.'
    : 'Precisamos de alguns dados para gerar o pagamento e enviar o comprovante.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { email?: string; phone?: string; nome?: string; cpfCnpj?: string } = {};

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
    if (needsCpf) {
      if (!isValidCpfCnpj(cpfCnpj)) return toast.error('CPF ou CNPJ inválido');
      payload.cpfCnpj = onlyDigits(cpfCnpj);
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
      <DialogContent
        className={`sm:max-w-md bg-background text-foreground ${backgroundMode === 'dark' ? 'dark' : ''}`}
        style={themeStyles}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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

          {needsCpf && (
            <div className="space-y-1.5">
              <Label htmlFor="cc-cpf">CPF ou CNPJ</Label>
              <Input
                id="cc-cpf"
                inputMode="numeric"
                autoComplete="off"
                autoFocus={!needsName && !needsEmail}
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={18}
                aria-invalid={cpfCnpj.length > 0 && !cpfValid}
              />
              <p className="text-xs text-muted-foreground">
                Usado apenas na cobrança e no recibo. Seus dados não são compartilhados.
              </p>
              {cpfCnpj.length > 0 && !cpfValid && (
                <p className="text-xs text-destructive">Documento inválido.</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || (needsCpf && !cpfValid)}
            >
              {submitting ? 'Salvando…' : 'Continuar para pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
