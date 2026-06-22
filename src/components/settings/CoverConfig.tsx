import { CoverCatalog } from '@/components/deliver/CoverCatalog';
import { DEFAULT_COVER_ID } from '@/components/deliver/covers/registry';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Props {
  defaultCoverId: string;
  onUpdate: (data: { defaultCoverId: string }) => void;
}

export function CoverConfig({ defaultCoverId, onUpdate }: Props) {
  const current = defaultCoverId || DEFAULT_COVER_ID;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Label className="text-base font-medium">Capa padrão</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Apresentação inicial (Hero) aplicada automaticamente em novas Galerias de Entrega.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">Apenas Galerias de Entrega</Badge>
      </div>

      <CoverCatalog
        selectedCoverId={current}
        onSelect={(id) => onUpdate({ defaultCoverId: id || DEFAULT_COVER_ID })}
        allowInherit={false}
      />
    </div>
  );
}
