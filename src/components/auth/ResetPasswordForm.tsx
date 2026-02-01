import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const resetSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ResetFormValues = z.infer<typeof resetSchema>;

interface ResetPasswordFormProps {
  onBack: () => void;
}

export function ResetPasswordForm({ onBack }: ResetPasswordFormProps) {
  const { resetPassword } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ResetFormValues) => {
    setIsLoading(true);
    const { error } = await resetPassword(values.email);
    
    if (error) {
      toast.error('Erro ao enviar email. Tente novamente.');
    } else {
      setEmailSent(true);
      toast.success('Email de recuperação enviado!');
    }
    setIsLoading(false);
  };

  if (emailSent) {
    return (
      <div className="text-center space-y-4 py-4">
        <CheckCircle className="h-12 w-12 text-primary mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Verifique seu email</h3>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de recuperação para{' '}
            <span className="font-medium text-foreground">{form.getValues('email')}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Clique no link para redefinir sua senha.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onBack}
          className="mt-4"
        >
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Recuperar senha</h3>
        <p className="text-sm text-muted-foreground">
          Digite seu email para receber o link de recuperação.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar link
          </Button>
        </form>
      </Form>
    </div>
  );
}
