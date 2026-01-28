import { useAuthContext } from '@/contexts/AuthContext';
import { usePhotoCredits } from '@/hooks/usePhotoCredits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Infinity } from 'lucide-react';

export default function Credits() {
  const { isAdmin } = useAuthContext();
  const { photoCredits, isLoading } = usePhotoCredits();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Créditos</h1>
        <p className="text-muted-foreground">
          Gerencie seus créditos de foto
        </p>
      </div>

      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Créditos de Foto
            </CardTitle>
            <CardDescription>1 foto = 1 crédito ao enviar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-4xl font-bold text-primary">
                  <Infinity className="h-10 w-10" />
                </div>
                <p className="text-muted-foreground mt-2">Créditos ilimitados</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Como administrador, você tem acesso ilimitado
                </p>
              </div>
            ) : (
              <>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-primary">
                    {isLoading ? '...' : photoCredits}
                  </div>
                  <p className="text-muted-foreground">créditos disponíveis</p>
                </div>

                <Button className="w-full" variant="default" disabled>
                  <Camera className="h-4 w-4 mr-2" />
                  Comprar Créditos (Em breve)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
