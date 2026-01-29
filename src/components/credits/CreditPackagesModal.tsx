import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreditPackageCard } from './CreditPackageCard';
import { CreditPackage } from '@/hooks/useCreditPackages';
import { Skeleton } from '@/components/ui/skeleton';

interface CreditPackagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: CreditPackage[] | undefined;
  isLoading: boolean;
  onSelectPackage: (pkg: CreditPackage) => void;
}

export function CreditPackagesModal({
  open,
  onOpenChange,
  packages,
  isLoading,
  onSelectPackage,
}: CreditPackagesModalProps) {
  // Pacote mais popular (Pro - 10.000 créditos)
  const popularPackageId = packages?.[2]?.id;

  const handleSelect = (pkg: CreditPackage) => {
    onSelectPackage(pkg);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Escolha um pacote de créditos</DialogTitle>
          <DialogDescription>
            Selecione o pacote que melhor atende suas necessidades
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {packages?.map((pkg) => (
              <CreditPackageCard
                key={pkg.id}
                package_={pkg}
                isSelected={false}
                onSelect={() => handleSelect(pkg)}
                isPopular={pkg.id === popularPackageId}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
