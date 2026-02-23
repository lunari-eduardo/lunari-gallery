import { Type, CaseSensitive, CaseUpper } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger } from
'@/components/ui/tooltip';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';

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
{ id: 'quicksand', name: 'Quicksand', family: '"Quicksand", sans-serif' }];


// Helper function to get font family from ID
export function getFontFamilyById(fontId: string | undefined): string {
  const font = GALLERY_FONTS.find((f) => f.id === fontId);
  return font?.family || GALLERY_FONTS[0].family;
}

interface FontSelectProps {
  value: string;
  onChange: (value: string) => void;
  previewText?: string;
  titleCaseMode?: TitleCaseMode;
  onTitleCaseModeChange?: (mode: TitleCaseMode) => void;
}

const TITLE_CASE_MODES: {mode: TitleCaseMode;icon: typeof Type;label: string;}[] = [
{ mode: 'normal', icon: Type, label: 'Normal (como digitado)' },
{ mode: 'uppercase', icon: CaseSensitive, label: 'MAIÚSCULAS' },
{ mode: 'titlecase', icon: CaseUpper, label: 'Início De Palavras' }];


export function FontSelect({
  value,
  onChange,
  previewText = 'Ensaio Gestante',
  titleCaseMode = 'normal',
  onTitleCaseModeChange
}: FontSelectProps) {
  const selectedFont = GALLERY_FONTS.find((f) => f.id === value) || GALLERY_FONTS[0];

  const currentModeIndex = TITLE_CASE_MODES.findIndex((m) => m.mode === titleCaseMode);
  const currentModeConfig = TITLE_CASE_MODES[currentModeIndex] || TITLE_CASE_MODES[0];
  const IconComponent = currentModeConfig.icon;

  const handleToggleCaseMode = () => {
    if (!onTitleCaseModeChange) return;
    const nextIndex = (currentModeIndex + 1) % TITLE_CASE_MODES.length;
    onTitleCaseModeChange(TITLE_CASE_MODES[nextIndex].mode);
  };

  const displayText = applyTitleCase(previewText, titleCaseMode);

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
          {GALLERY_FONTS.map((font) =>
          <SelectItem
            key={font.id}
            value={font.id}
            className="py-2">

              <span
              style={{ fontFamily: font.family }}
              className="text-base">

                {font.name}
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      
      {/* Preview Box with Case Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted/30 rounded-lg p-4 min-h-[56px] flex items-center">
          <span
            style={{ fontFamily: selectedFont.family }}
            className="text-xl md:text-2xl leading-tight"
          >
            {displayText || 'Preview'}
          </span>
        </div>
        {onTitleCaseModeChange && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleToggleCaseMode}
                  className="shrink-0 h-10 w-10"
                >
                  <IconComponent className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{currentModeConfig.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

    </div>);

}