import { useMemo, useState } from 'react';
import { z } from 'zod';
import { ArrowLeft, Loader2, ShieldCheck, User, Mail, Phone, IdCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isValidCpfCnpj, maskCpfCnpj, onlyDigits } from '@/lib/validateCpfCnpj';
import type { PaymentMethod } from '@/types/gallery';

export interface PreCheckoutContactValues {
  nome: string;
  email: string;
  phone: string;
  cpfCnpj: string;
}

interface PayerHintsPrefill {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
}

interface Missing {
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  cpfCnpj?: boolean;
}

interface Props {
  valorTotal: number;
  provider: PaymentMethod | null;
  studioName?: string;
  photographerFirstName?: string;
  prefill?: PayerHintsPrefill;
  missing?: Missing;
  isSubmitting?: boolean;
  onBack: () => void;
  onSubmit: (values: PreCheckoutContactValues) => Promise<void> | void;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}


const emailSchema = z.string().trim().toLowerCase().email({ message: 'E-mail inválido' }).max(160);
const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 13, { message: 'WhatsApp inválido' });
const nomeSchema = z.string().trim().min(3, { message: 'Informe seu nome completo' }).max(80);

function maskPhoneBR(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const PROVIDER_LABEL: Record<string, string> = {
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  asaas: 'Asaas',
  pix_manual: 'PIX',
};

/**
 * Tela intermediária de dados de cobrança — aparece antes de qualquer redirect
 * para checkout externo/inline sempre que existir pelo menos um campo obrigatório
 * ausente em `payerHints`. Pré-preenche o que já sabemos, persiste no CRM
 * (via RPC upsert_visitor_contact) e só depois libera o pagamento.
 */
export function PreCheckoutContactStep({
  valorTotal,
  provider,
  studioName,
  prefill,
  missing,
  isSubmitting = false,
  onBack,
  onSubmit,
  themeStyles = {},
  backgroundMode = 'light',
}: Props) {
  const [nome, setNome] = useState(prefill?.fullName || '');
  const [email, setEmail] = useState(prefill?.email || '');
  const [phone, setPhone] = useState(prefill?.phone ? maskPhoneBR(prefill.phone) : '');
  const [cpfCnpj, setCpfCnpj] = useState(prefill?.cpfCnpj ? maskCpfCnpj(prefill.cpfCnpj) : '');
  const [errors, setErrors] = useState<Partial<Record<keyof PreCheckoutContactValues, string>>>({});

  // Todos os campos são obrigatórios nesta tela. missing[] apenas orienta o foco.
  const needs = {
    name: missing?.name ?? !prefill?.fullName,
    email: missing?.email ?? !prefill?.email,
    phone: missing?.phone ?? !prefill?.phone,
    cpfCnpj: missing?.cpfCnpj ?? !prefill?.cpfCnpj,
  };

  const cpfValid = useMemo(() => (cpfCnpj ? isValidCpfCnpj(cpfCnpj) : false), [cpfCnpj]);

  const providerLabel = provider ? PROVIDER_LABEL[provider] || provider : 'pagamento';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: typeof errors = {};
    const nomeParsed = nomeSchema.safeParse(nome);
    if (!nomeParsed.success) nextErrors.nome = nomeParsed.error.issues[0].message;

    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) nextErrors.email = emailParsed.error.issues[0].message;

    const phoneParsed = phoneSchema.safeParse(phone);
    if (!phoneParsed.success) nextErrors.phone = phoneParsed.error.issues[0].message;

    if (!isValidCpfCnpj(cpfCnpj)) nextErrors.cpfCnpj = 'CPF ou CNPJ inválido';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Revise os campos destacados');
      return;
    }

    await onSubmit({
      nome: nomeParsed.data as string,
      email: emailParsed.data as string,
      phone: phoneParsed.data as string,
      cpfCnpj: onlyDigits(cpfCnpj),
    });
  };

  const formattedValue = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col bg-background text-foreground',
        backgroundMode === 'dark' && 'dark',
      )}
      style={themeStyles}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={isSubmitting} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <span className="text-sm font-medium tracking-wide">Dados de cobrança</span>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 px-4 py-8 pb-32">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Antes do pagamento</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Precisamos confirmar seus dados para gerar a cobrança de <strong className="text-foreground">{formattedValue}</strong>
              {studioName ? <> com <strong className="text-foreground">{studioName}</strong></> : null}
              . Eles serão usados apenas para emitir a cobrança e o recibo — e ficarão salvos para as próximas.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="pc-nome" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome completo
              </Label>
              <Input
                id="pc-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Maria da Silva"
                maxLength={80}
                autoFocus={needs.name}
                aria-invalid={!!errors.nome}
                autoComplete="name"
              />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pc-email" className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail
                </Label>
                <Input
                  id="pc-email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  maxLength={160}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  autoFocus={!needs.name && needs.email}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-phone" className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  WhatsApp
                </Label>
                <Input
                  id="pc-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
                  placeholder="(11) 98765-4321"
                  maxLength={20}
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pc-cpf" className="flex items-center gap-2">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                CPF ou CNPJ
              </Label>
              <Input
                id="pc-cpf"
                inputMode="numeric"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={18}
                aria-invalid={!!errors.cpfCnpj || (cpfCnpj.length > 0 && !cpfValid)}
                autoComplete="off"
              />
              {errors.cpfCnpj && <p className="text-xs text-destructive">{errors.cpfCnpj}</p>}
              {!errors.cpfCnpj && cpfCnpj.length > 0 && !cpfValid && (
                <p className="text-xs text-destructive">Documento inválido.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Exigido pelo Banco Central para gerar a cobrança. Não é compartilhado.
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
              <Lock className="h-3 w-3" />
              <span>Pagamento processado via {providerLabel}. Seus dados são criptografados.</span>
            </div>
          </form>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/30 p-4 z-50">
        <div className="max-w-xl mx-auto">
          <Button
            variant="terracotta"
            size="lg"
            className="w-full lg:max-w-md lg:mx-auto lg:flex gap-2"
            onClick={handleSubmit as unknown as () => void}
            disabled={isSubmitting || !cpfValid}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Continuar para pagamento • {formattedValue}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
