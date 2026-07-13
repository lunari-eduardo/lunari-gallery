import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { ArrowLeft, Loader2, ShieldCheck, User, Mail, Phone, IdCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LightPaymentSurface } from '@/components/gallery/LightPaymentSurface';
import { isValidCpfCnpj, maskCpfCnpj, onlyDigits } from '@/lib/validateCpfCnpj';
import { validatePhoneBR, maskPhoneBR } from '@/lib/phoneBR';
import { validateEmailStrict } from '@/lib/emailStrict';
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

type FieldKey = 'nome' | 'email' | 'phone' | 'cpfCnpj';
type FieldErrors = Partial<Record<FieldKey, string>>;

interface Props {
  valorTotal: number;
  provider: PaymentMethod | null;
  studioName?: string;
  photographerFirstName?: string;
  prefill?: PayerHintsPrefill;
  missing?: Missing;
  isSubmitting?: boolean;
  /**
   * Erros injetados pelo backend após tentativa de checkout (ex.: Asaas
   * rejeitou o e-mail). Reabrem a etapa com a mensagem no campo certo em
   * vez de mostrar toast genérico "Erro ao processar pagamento".
   */
  externalErrors?: FieldErrors;
  onBack: () => void;
  onSubmit: (values: PreCheckoutContactValues) => Promise<void> | void;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

const nomeSchema = z.string().trim().min(3, { message: 'Informe seu nome completo.' }).max(80);

const PROVIDER_LABEL: Record<string, string> = {
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  asaas: 'Asaas',
  pix_manual: 'PIX',
};

/**
 * Tela intermediária de dados de cobrança. Aparece antes de qualquer redirect
 * para checkout quando falta algum campo obrigatório em `payerHints`.
 *
 * Novidades desta versão:
 *  - Validação BR estrita de telefone (detecta DDD faltando, país duplicado, 9º dígito, etc.)
 *  - Validação ASCII-only de e-mail (mesma do backend/Asaas)
 *  - Feedback por campo em `onBlur`, foco no primeiro erro após submit
 *  - Marcadores visuais de obrigatoriedade (`*`) em todos os campos
 *  - `externalErrors` reflete erros do provedor de pagamento no campo certo
 */
export function PreCheckoutContactStep({
  valorTotal,
  provider,
  photographerFirstName,
  prefill,
  missing,
  isSubmitting = false,
  externalErrors,
  onBack,
  onSubmit,
  themeStyles = {},
  backgroundMode = 'light',
}: Props) {
  const [nome, setNome] = useState(prefill?.fullName || '');
  const [email, setEmail] = useState(prefill?.email || '');
  const [phone, setPhone] = useState(prefill?.phone ? maskPhoneBR(prefill.phone) : '');
  const [cpfCnpj, setCpfCnpj] = useState(prefill?.cpfCnpj ? maskCpfCnpj(prefill.cpfCnpj) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    nome: false, email: false, phone: false, cpfCnpj: false,
  });

  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const refs: Record<FieldKey, React.RefObject<HTMLInputElement>> = {
    nome: nomeRef, email: emailRef, phone: phoneRef, cpfCnpj: cpfRef,
  };

  const needs = {
    name: missing?.name ?? !prefill?.fullName,
    email: missing?.email ?? !prefill?.email,
    phone: missing?.phone ?? !prefill?.phone,
    cpfCnpj: missing?.cpfCnpj ?? !prefill?.cpfCnpj,
  };

  const providerLabel = provider ? PROVIDER_LABEL[provider] || provider : 'pagamento';

  // Validador por campo — retorna string de erro ou undefined.
  const validateField = (key: FieldKey, value: string): string | undefined => {
    if (key === 'nome') {
      const r = nomeSchema.safeParse(value);
      return r.success ? undefined : r.error.issues[0].message;
    }
    if (key === 'email') {
      const r = validateEmailStrict(value);
      return r.ok ? undefined : r.message;
    }
    if (key === 'phone') {
      const r = validatePhoneBR(value);
      return r.ok ? undefined : r.message;
    }
    if (key === 'cpfCnpj') {
      if (!value.trim()) return 'Informe seu CPF ou CNPJ.';
      return isValidCpfCnpj(value) ? undefined : 'CPF ou CNPJ inválido. Confira os números digitados.';
    }
    return undefined;
  };

  // Erros externos (vindos do backend após tentar checkout).
  useEffect(() => {
    if (!externalErrors) return;
    const keys = Object.keys(externalErrors) as FieldKey[];
    if (keys.length === 0) return;
    setErrors((prev) => ({ ...prev, ...externalErrors }));
    setTouched((prev) => keys.reduce((acc, k) => ({ ...acc, [k]: true }), prev));
    // Foca o primeiro campo com erro externo.
    const first = keys[0];
    setTimeout(() => {
      refs[first]?.current?.focus();
      refs[first]?.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalErrors]);

  const isFormValid = useMemo(() => {
    return (
      !validateField('nome', nome) &&
      !validateField('email', email) &&
      !validateField('phone', phone) &&
      !validateField('cpfCnpj', cpfCnpj)
    );
  }, [nome, email, phone, cpfCnpj]);

  const handleBlur = (key: FieldKey, value: string) => {
    setTouched((t) => ({ ...t, [key]: true }));
    const msg = validateField(key, value);
    setErrors((prev) => ({ ...prev, [key]: msg }));
  };

  const clearError = (key: FieldKey) => {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const focusFirstError = (errs: FieldErrors) => {
    const order: FieldKey[] = ['nome', 'email', 'phone', 'cpfCnpj'];
    const first = order.find((k) => errs[k]);
    if (!first) return;
    setTimeout(() => {
      refs[first]?.current?.focus();
      refs[first]?.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 20);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const nextErrors: FieldErrors = {
      nome: validateField('nome', nome),
      email: validateField('email', email),
      phone: validateField('phone', phone),
      cpfCnpj: validateField('cpfCnpj', cpfCnpj),
    };
    // Marca tudo como tocado ao submeter.
    setTouched({ nome: true, email: true, phone: true, cpfCnpj: true });
    setErrors(nextErrors);

    const hasError = (Object.values(nextErrors) as (string | undefined)[]).some(Boolean);
    if (hasError) {
      toast.error('Revise os campos destacados.');
      focusFirstError(nextErrors);
      return;
    }

    const phoneR = validatePhoneBR(phone);
    const emailR = validateEmailStrict(email);
    if (!phoneR.ok || !emailR.ok) return; // não deveria acontecer — já validado.

    await onSubmit({
      nome: nome.trim(),
      email: emailR.value,
      phone: phoneR.digits,
      cpfCnpj: onlyDigits(cpfCnpj),
    });
  };

  const formattedValue = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;

  // Marcador de obrigatoriedade acessível.
  const RequiredMark = () => (
    <span className="text-destructive" aria-hidden="true">
      {' *'}
    </span>
  );

  return (
    <LightPaymentSurface
      themeStyles={themeStyles}
      className="flex flex-col text-foreground bg-background"
    >
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border/60">
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
            <h1 className="text-2xl font-semibold tracking-tight">Antes de continuar</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Confirme seus dados para finalizar seu pagamento
              {photographerFirstName ? <> de <strong className="text-foreground">{photographerFirstName}</strong></> : null}
              . Eles serão usados apenas para gerar a cobrança, facilitar o contato quando necessário e agilizar seus próximos pagamentos.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Todos os campos marcados com <span className="text-destructive">*</span> são obrigatórios.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="pc-nome" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome completo<RequiredMark />
              </Label>
              <Input
                id="pc-nome"
                ref={nomeRef}
                value={nome}
                onChange={(e) => { setNome(e.target.value); clearError('nome'); }}
                onBlur={(e) => handleBlur('nome', e.target.value)}
                placeholder="Ex.: Maria da Silva"
                maxLength={80}
                autoFocus={needs.name}
                aria-invalid={!!errors.nome && touched.nome}
                aria-required="true"
                aria-describedby={errors.nome && touched.nome ? 'pc-nome-err' : undefined}
                autoComplete="name"
              />
              {touched.nome && errors.nome && (
                <p id="pc-nome-err" role="alert" className="text-xs text-destructive">{errors.nome}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pc-email" className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail<RequiredMark />
                </Label>
                <Input
                  id="pc-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                  onBlur={(e) => handleBlur('email', e.target.value)}
                  placeholder="voce@email.com"
                  maxLength={160}
                  autoComplete="email"
                  aria-invalid={!!errors.email && touched.email}
                  aria-required="true"
                  aria-describedby={errors.email && touched.email ? 'pc-email-err' : undefined}
                  autoFocus={!needs.name && needs.email}
                />
                {touched.email && errors.email && (
                  <p id="pc-email-err" role="alert" className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-phone" className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  WhatsApp<RequiredMark />
                </Label>
                <Input
                  id="pc-phone"
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => { setPhone(maskPhoneBR(e.target.value)); clearError('phone'); }}
                  onBlur={(e) => handleBlur('phone', e.target.value)}
                  placeholder="(11) 98765-4321"
                  maxLength={20}
                  autoComplete="tel"
                  aria-invalid={!!errors.phone && touched.phone}
                  aria-required="true"
                  aria-describedby={errors.phone && touched.phone ? 'pc-phone-err' : undefined}
                />
                {touched.phone && errors.phone && (
                  <p id="pc-phone-err" role="alert" className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pc-cpf" className="flex items-center gap-2">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                CPF ou CNPJ<RequiredMark />
              </Label>
              <Input
                id="pc-cpf"
                ref={cpfRef}
                inputMode="numeric"
                value={cpfCnpj}
                onChange={(e) => { setCpfCnpj(maskCpfCnpj(e.target.value)); clearError('cpfCnpj'); }}
                onBlur={(e) => handleBlur('cpfCnpj', e.target.value)}
                placeholder="000.000.000-00"
                maxLength={18}
                aria-invalid={!!errors.cpfCnpj && touched.cpfCnpj}
                aria-required="true"
                aria-describedby={errors.cpfCnpj && touched.cpfCnpj ? 'pc-cpf-err' : undefined}
                autoComplete="off"
              />
              {touched.cpfCnpj && errors.cpfCnpj && (
                <p id="pc-cpf-err" role="alert" className="text-xs text-destructive">{errors.cpfCnpj}</p>
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

      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t border-border/60 p-4 z-50">
        <div className="max-w-xl mx-auto">
          <Button
            variant="terracotta"
            size="lg"
            className="w-full lg:max-w-md lg:mx-auto lg:flex gap-2"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || !isFormValid}
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
    </LightPaymentSurface>
  );
}
