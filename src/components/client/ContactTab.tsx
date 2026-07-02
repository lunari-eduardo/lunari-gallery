import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User,
  Phone,
  MapPin,
  FileText,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Save,
} from 'lucide-react';
import { isValidCpfCnpj, maskCpfCnpj, onlyDigits } from '@/lib/validateCpfCnpj';
import { ClientProfileData } from '@/hooks/useClientProfile';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useAuth } from '@/hooks/useAuth';

interface ContactTabProps {
  client: ClientProfileData;
  onSaved?: () => void;
}

const ufList = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const schema = z.object({
  nome: z.string().trim().min(1, 'Nome obrigatório').max(120),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail inválido'),
  telefone: z.string().trim().max(30).optional().or(z.literal('')),
  whatsapp: z.string().trim().max(30).optional().or(z.literal('')),
  data_nascimento: z.string().optional().or(z.literal('')),
  cpf_cnpj: z
    .string()
    .optional()
    .refine((v) => !v || isValidCpfCnpj(v), 'CPF/CNPJ inválido'),
  cep: z
    .string()
    .optional()
    .refine((v) => !v || onlyDigits(v).length === 8, 'CEP deve ter 8 dígitos'),
  endereco: z.string().max(200).optional().or(z.literal('')),
  endereco_numero: z.string().max(20).optional().or(z.literal('')),
  endereco_complemento: z.string().max(100).optional().or(z.literal('')),
  bairro: z.string().max(100).optional().or(z.literal('')),
  cidade: z.string().max(100).optional().or(z.literal('')),
  uf: z
    .string()
    .optional()
    .refine((v) => !v || ufList.includes(v.toUpperCase()), 'UF inválida'),
  gallery_password: z.string().max(60).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

const maskPhone = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const maskCep = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
};

export function ContactTab({ client, onSaved }: ContactTabProps) {
  const { user } = useAuth();
  const { updateClient } = useGalleryClients();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const defaults: FormValues = useMemo(
    () => ({
      nome: client.nome || '',
      email: client.email || '',
      telefone: client.telefone || '',
      whatsapp: client.whatsapp || '',
      data_nascimento: client.data_nascimento || '',
      cpf_cnpj: client.cpf_cnpj ? maskCpfCnpj(client.cpf_cnpj) : '',
      cep: client.cep ? maskCep(client.cep) : '',
      endereco: client.endereco || '',
      endereco_numero: client.endereco_numero || '',
      endereco_complemento: client.endereco_complemento || '',
      bairro: client.bairro || '',
      cidade: client.cidade || '',
      uf: client.uf || '',
      gallery_password: client.gallery_password || '',
    }),
    [client],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onBlur',
  });

  useEffect(() => {
    form.reset(defaults);
  }, [defaults]);

  const suffix = useMemo(() => Math.random().toString(36).slice(2, 10), [client.id]);

  const handleCepBlur = async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    try {
      setCepLoading(true);
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (data?.erro) return;
      const cur = form.getValues();
      if (!cur.endereco && data.logradouro) form.setValue('endereco', data.logradouro, { shouldDirty: true });
      if (!cur.bairro && data.bairro) form.setValue('bairro', data.bairro, { shouldDirty: true });
      if (!cur.cidade && data.localidade) form.setValue('cidade', data.localidade, { shouldDirty: true });
      if (!cur.uf && data.uf) form.setValue('uf', data.uf, { shouldDirty: true });
    } catch (e) {
      // silencioso — CEP é conveniência
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    // Blindagem: nunca aceitar a senha do próprio fotógrafo como senha de galeria.
    if (
      user?.email &&
      values.gallery_password &&
      values.gallery_password.toLowerCase() === user.email.toLowerCase()
    ) {
      toast.error('Senha de galeria não pode ser igual ao seu e-mail.');
      return;
    }
    // Se o e-mail digitado é o do próprio fotógrafo, provavelmente é autofill.
    if (user?.email && values.email && values.email.toLowerCase() === user.email.toLowerCase()) {
      toast.error('Este e-mail pertence à sua conta. Digite o e-mail do cliente.');
      return;
    }

    try {
      setSaving(true);
      await updateClient(client.id, {
        name: values.nome.trim(),
        email: (values.email || '').trim(),
        phone: values.telefone?.trim() || undefined,
        whatsapp: values.whatsapp?.trim() || null,
        dataNascimento: values.data_nascimento || null,
        cpfCnpj: values.cpf_cnpj ? onlyDigits(values.cpf_cnpj) : null,
        cep: values.cep ? onlyDigits(values.cep) : null,
        endereco: values.endereco?.trim() || null,
        enderecoNumero: values.endereco_numero?.trim() || null,
        enderecoComplemento: values.endereco_complemento?.trim() || null,
        bairro: values.bairro?.trim() || null,
        cidade: values.cidade?.trim() || null,
        uf: values.uf ? values.uf.toUpperCase() : null,
        galleryPassword: values.gallery_password?.trim() || null,
      });
      toast.success('Cliente atualizado com sucesso');
      form.reset(values);
      onSaved?.();
    } catch (e: any) {
      console.error('[ContactTab] update error', e);
      toast.error(e?.message || 'Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const dirty = form.formState.isDirty;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      {/* Decoys anti-autofill */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <input type="text" name="username" tabIndex={-1} autoComplete="username" />
        <input type="password" name="password" tabIndex={-1} autoComplete="new-password" />
      </div>

      <Accordion type="multiple" defaultValue={['identificacao', 'contato']} className="space-y-2">
        {/* Identificação */}
        <AccordionItem value="identificacao" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">Identificação</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor={`nome_${suffix}`}>Nome completo *</Label>
              <Input
                id={`nome_${suffix}`}
                {...form.register('nome')}
                autoComplete="off"
                spellCheck={false}
              />
              {form.formState.errors.nome && (
                <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`nasc_${suffix}`}>Data de nascimento</Label>
              <Input
                id={`nasc_${suffix}`}
                type="date"
                {...form.register('data_nascimento')}
                autoComplete="off"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Contato */}
        <AccordionItem value="contato" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Phone className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="font-medium">Contato</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`tel_${suffix}`}>Telefone</Label>
                <Input
                  id={`tel_${suffix}`}
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  value={form.watch('telefone') || ''}
                  onChange={(e) => form.setValue('telefone', maskPhone(e.target.value), { shouldDirty: true })}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`wpp_${suffix}`}>WhatsApp</Label>
                <Input
                  id={`wpp_${suffix}`}
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  value={form.watch('whatsapp') || ''}
                  onChange={(e) => form.setValue('whatsapp', maskPhone(e.target.value), { shouldDirty: true })}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`email_${suffix}`}>E-mail</Label>
              <Input
                id={`email_${suffix}`}
                type="text"
                inputMode="email"
                placeholder="cliente@email.com"
                {...form.register('email')}
                autoComplete="off"
                spellCheck={false}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Endereço */}
        <AccordionItem value="endereco" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-sky-600" />
              </div>
              <span className="font-medium">Endereço</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="grid gap-2 md:grid-cols-[180px_1fr]">
              <div className="grid gap-2">
                <Label htmlFor={`cep_${suffix}`}>CEP</Label>
                <div className="relative">
                  <Input
                    id={`cep_${suffix}`}
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.watch('cep') || ''}
                    onChange={(e) => form.setValue('cep', maskCep(e.target.value), { shouldDirty: true })}
                    onBlur={(e) => handleCepBlur(e.target.value)}
                    autoComplete="off"
                  />
                  {cepLoading && (
                    <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
                {form.formState.errors.cep && (
                  <p className="text-xs text-destructive">{form.formState.errors.cep.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`end_${suffix}`}>Endereço</Label>
                <Input
                  id={`end_${suffix}`}
                  placeholder="Rua / Avenida"
                  {...form.register('endereco')}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`num_${suffix}`}>Número</Label>
                <Input id={`num_${suffix}`} {...form.register('endereco_numero')} autoComplete="off" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor={`comp_${suffix}`}>Complemento</Label>
                <Input id={`comp_${suffix}`} {...form.register('endereco_complemento')} autoComplete="off" />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`bai_${suffix}`}>Bairro</Label>
                <Input id={`bai_${suffix}`} {...form.register('bairro')} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`cid_${suffix}`}>Cidade</Label>
                <Input id={`cid_${suffix}`} {...form.register('cidade')} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`uf_${suffix}`}>UF</Label>
                <Input
                  id={`uf_${suffix}`}
                  maxLength={2}
                  value={form.watch('uf') || ''}
                  onChange={(e) => form.setValue('uf', e.target.value.toUpperCase().slice(0, 2), { shouldDirty: true })}
                  autoComplete="off"
                />
                {form.formState.errors.uf && (
                  <p className="text-xs text-destructive">{form.formState.errors.uf.message}</p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Documentos fiscais */}
        <AccordionItem value="fiscal" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
              <span className="font-medium">Documentos fiscais</span>
              {client.cpf_cnpj && (
                <span className="text-xs text-muted-foreground">• {maskCpfCnpj(client.cpf_cnpj)}</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-2">
            <Label htmlFor={`doc_${suffix}`}>CPF ou CNPJ</Label>
            <Input
              id={`doc_${suffix}`}
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={form.watch('cpf_cnpj') || ''}
              onChange={(e) => form.setValue('cpf_cnpj', maskCpfCnpj(e.target.value), { shouldDirty: true })}
              autoComplete="off"
            />
            {form.formState.errors.cpf_cnpj && (
              <p className="text-xs text-destructive">{form.formState.errors.cpf_cnpj.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Necessário para PIX e Boleto no Asaas, e para antecipação de recebíveis.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Acesso à galeria */}
        <AccordionItem value="acesso" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-purple-600" />
              </div>
              <span className="font-medium">Acesso à galeria</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-2">
            <Label htmlFor={`gpass_${suffix}`}>Senha compartilhada com o cliente</Label>
            <div className="relative">
              <Input
                id={`gpass_${suffix}`}
                type="text"
                style={showPassword ? undefined : ({ WebkitTextSecurity: 'disc' } as any)}
                placeholder="Ex: familia2026"
                {...form.register('gallery_password')}
                autoComplete="off"
                spellCheck={false}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Chave curta para o cliente acessar a galeria. Não use senhas pessoais.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => form.reset(defaults)} disabled={!dirty || saving}>
          Descartar
        </Button>
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
