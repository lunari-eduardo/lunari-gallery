import { useNavigate } from 'react-router-dom';
import { ShieldX, Sparkles, LogOut, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AccessDenied() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const handleUpgrade = () => {
    // Link to Lunari Gestão for upgrade
    window.open('https://app.lunarihub.com/settings', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl border-border/50 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="lg" variant="gallery" />
          </div>
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">
              Acesso Não Disponível
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Sua conta ({user?.email}) não possui acesso ao Lunari Gallery
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Benefícios do Plano Pro + Gallery
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Galerias ilimitadas para seus clientes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Seleção de fotos online com aprovação
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Controle de fotos extras e pagamentos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Personalização completa do visual
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={handleUpgrade} className="w-full h-12">
              <ExternalLink className="h-4 w-4 mr-2" />
              Fazer Upgrade do Plano
            </Button>
            <Button 
              onClick={handleSignOut} 
              variant="ghost" 
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
