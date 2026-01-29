import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreditPackage } from '@/hooks/useCreditPackages';

interface CreditPackageCardProps {
  package_: CreditPackage;
  isSelected: boolean;
  onSelect: () => void;
  isPopular?: boolean;
}

export function CreditPackageCard({ 
  package_, 
  isSelected, 
  onSelect,
  isPopular 
}: CreditPackageCardProps) {
  const pricePerCredit = (package_.price_cents / 100) / package_.credits;
  const formattedPrice = (package_.price_cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <Card 
      className={cn(
        "relative cursor-pointer transition-all hover:shadow-md",
        isSelected 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-border hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      {isPopular && (
        <Badge 
          className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Mais Popular
        </Badge>
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg font-semibold">{package_.name}</span>
          <Camera className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {package_.credits.toLocaleString('pt-BR')}
          </div>
          <p className="text-sm text-muted-foreground">créditos</p>
        </div>
        
        <div className="text-center border-t pt-3">
          <div className="text-2xl font-bold">{formattedPrice}</div>
          <p className="text-xs text-muted-foreground">
            R$ {pricePerCredit.toFixed(4)} por crédito
          </p>
        </div>
        
        <Button 
          variant={isSelected ? "default" : "outline"} 
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? 'Selecionado' : 'Selecionar'}
        </Button>
      </CardContent>
    </Card>
  );
}
