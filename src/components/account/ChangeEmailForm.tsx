import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';

const changeEmailSchema = z.object({
  newEmail: z.string().email('Digite um email válido'),
});

type ChangeEmailFormData = z.infer<typeof changeEmailSchema>;

interface ChangeEmailFormProps {
  currentEmail: string;
}

export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { updateEmail } = useAuthContext();
  const { toast } = useToast();

  const form = useForm<ChangeEmailFormData>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: '',
    },
  });

  const onSubmit = async (data: ChangeEmailFormData) => {
    if (data.newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast({
        title: 'Email igual',
        description: 'O novo email deve ser diferente do atual.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { error } = await updateEmail(data.newEmail);

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Erro ao alterar email',
        description: error.message || 'Não foi possível enviar o email de confirmação.',
        variant: 'destructive',
      });
      return;
    }

    setEmailSent(true);
    form.reset();
    toast({
      title: 'Email de confirmação enviado',
      description: `Um link de confirmação foi enviado para ${data.newEmail}.`,
    });
  };

  if (emailSent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Alterar Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Um email de confirmação foi enviado para o novo endereço. 
              Clique no link para confirmar a alteração. 
              Seu email atual permanece ativo até a confirmação.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setEmailSent(false)}
          >
            Alterar outro email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Alterar Email
        </CardTitle>
        <CardDescription>Atualize seu endereço de email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Email atual: </span>
          <span className="font-medium">{currentEmail}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Novo email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="novo@email.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Alterar Email'
              )}
            </Button>
          </form>
        </Form>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Um email de confirmação será enviado para o novo endereço. 
            O email atual permanece até a confirmação.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
