import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FontOption {
  id: string;
  name: string;
  family: string;
}

export const GALLERY_FONTS: FontOption[] = [
  { id: 'playfair', name: 'Playfair Display', family: '"Playfair Display", serif' },
  { id: 'imperial', name: 'Imperial Script', family: '"Imperial Script", cursive' },
  { id: 'league', name: 'League Script', family: '"League Script", cursive' },
  { id: 'allura', name: 'Allura', family: '"Allura", cursive' },
  { id: 'amatic', name: 'Amatic SC', family: '"Amatic SC", cursive' },
  { id: 'shadows', name: 'Shadows Into Light', family: '"Shadows Into Light", cursive' },
  { id: 'source-serif', name: 'Source Serif 4', family: '"Source Serif 4", serif' },
  { id: 'cormorant', name: 'Cormorant', family: '"Cormorant", serif' },
  { id: 'bodoni', name: 'Bodoni Moda', family: '"Bodoni Moda", serif' },
  { id: 'raleway', name: 'Raleway', family: '"Raleway", sans-serif' },
  { id: 'quicksand', name: 'Quicksand', family: '"Quicksand", sans-serif' },
];

// Helper function to get font family from ID
export function getFontFamilyById(fontId: string | undefined): string {
  const font = GALLERY_FONTS.find(f => f.id === fontId);
  return font?.family || GALLERY_FONTS[0].family;
}

interface FontSelectProps {
  value: string;
  onChange: (value: string) => void;
  previewText?: string;
}

export function FontSelect({ value, onChange, previewText = 'Ensaio Gestante' }: FontSelectProps) {
  const selectedFont = GALLERY_FONTS.find(f => f.id === value) || GALLERY_FONTS[0];

  return (
    <div className="space-y-3">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione uma fonte">
            <span style={{ fontFamily: selectedFont.family }}>
              {selectedFont.name}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {GALLERY_FONTS.map((font) => (
            <SelectItem 
              key={font.id} 
              value={font.id}
              className="py-2"
            >
              <span 
                style={{ fontFamily: font.family }} 
                className="text-base"
              >
                {font.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Preview Box */}
      <div className="border rounded-lg bg-muted/30 p-6 text-center">
        <p 
          className="text-2xl uppercase tracking-wide"
          style={{ fontFamily: selectedFont.family }}
        >
          {previewText}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Prévia do título da galeria
        </p>
      </div>
    </div>
  );
}
