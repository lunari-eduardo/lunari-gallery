import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const signupSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { signUpWithEmail } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nome: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    const { error, needsEmailConfirmation } = await signUpWithEmail(
      values.email,
      values.password,
      values.nome
    );
    
    if (error) {
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está cadastrado');
      } else if (error.message?.includes('signup_not_allowed')) {
        toast.error('Cadastro não permitido. Entre em contato para solicitar acesso.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } else if (needsEmailConfirmation) {
      setEmailSent(true);
      toast.success('Email de confirmação enviado!');
    } else {
      toast.success('Conta criada com sucesso!');
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
            Enviamos um link de confirmação para{' '}
            <span className="font-medium text-foreground">{form.getValues('email')}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Clique no link para ativar sua conta.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setEmailSent(false)}
          className="mt-4"
        >
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input
                  placeholder="Seu nome"
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...field}
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar Senha</FormLabel>
              <FormControl>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Criar Conta
        </Button>
      </form>
    </Form>
  );
}
