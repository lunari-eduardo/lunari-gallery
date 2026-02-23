import { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { MemoryPhotoSelector, type MemoryPhoto } from './MemoryPhotoSelector';
import { MemoryTextInput } from './MemoryTextInput';
import { MemoryLayoutPicker, type MemoryLayout } from './MemoryLayoutPicker';
import { MemoryCanvas } from './MemoryCanvas';

interface Props {
  photos: MemoryPhoto[];
  isDark: boolean;
  bgColor: string;
  sessionFont?: string;
  sessionName?: string;
  onClose: () => void;
}

const STEPS = ['fotos', 'frase', 'layout', 'preview'] as const;
type Step = typeof STEPS[number];

export function MemoryCreator({ photos, isDark, bgColor, sessionFont, sessionName, onClose }: Props) {
  const [step, setStep] = useState<Step>('fotos');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [layout, setLayout] = useState<MemoryLayout>('solo');

  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#78716C' : '#A8A29E';
  const stepIndex = STEPS.indexOf(step);

  const canAdvance = () => {
    if (step === 'fotos') return selectedIds.length >= 1;
    return true;
  };

  const next = () => {
    if (step === 'frase') {
      // Auto-select layout based on photo count
      if (selectedIds.length === 1) setLayout('solo');
      else if (selectedIds.length === 2) setLayout('dupla');
      else setLayout('colagem');
    }
    const i = stepIndex + 1;
    if (i < STEPS.length) setStep(STEPS[i]);
  };

  const prev = () => {
    const i = stepIndex - 1;
    if (i >= 0) setStep(STEPS[i]);
    else onClose();
  };

  const stepLabels: Record<Step, string> = {
    fotos: 'Escolha suas fotos',
    frase: 'Sua frase',
    layout: 'Layout',
    preview: 'Sua lembrança',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
        <button onClick={prev} className="p-2 -ml-2 opacity-60 hover:opacity-100 transition-opacity">
          <ArrowLeft className="w-5 h-5" style={{ color: textColor }} />
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-500"
              style={{
                backgroundColor: i <= stepIndex ? textColor : (isDark ? '#44403C' : '#D6D3D1'),
                opacity: i <= stepIndex ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        <button onClick={onClose} className="p-2 -mr-2 opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-5 h-5" style={{ color: textColor }} />
        </button>
      </div>

      {/* Step title */}
      <div className="text-center px-6 py-2 flex-shrink-0">
        <h3
          className="text-xl font-light tracking-wide"
          style={{ color: textColor, fontFamily: sessionFont }}
        >
          {stepLabels[step]}
        </h3>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="transition-all duration-500">
          {step === 'fotos' && (
            <MemoryPhotoSelector
              photos={photos}
              selected={selectedIds}
              onSelectionChange={setSelectedIds}
              isDark={isDark}
            />
          )}
          {step === 'frase' && (
            <MemoryTextInput
              value={text}
              onChange={setText}
              isDark={isDark}
            />
          )}
          {step === 'layout' && (
            <MemoryLayoutPicker
              selected={layout}
              onSelect={setLayout}
              photoCount={selectedIds.length}
              isDark={isDark}
            />
          )}
          {step === 'preview' && (
            <MemoryCanvas
              photos={photos}
              selectedIds={selectedIds}
              text={text}
              layout={layout}
              isDark={isDark}
              sessionFont={sessionFont}
              sessionName={sessionName}
            />
          )}
        </div>
      </div>

      {/* Bottom action */}
      {step !== 'preview' && (
        <div className="px-6 py-6 flex-shrink-0">
          <button
            onClick={next}
            disabled={!canAdvance()}
            className="w-full py-3 text-sm tracking-wide transition-all duration-300 disabled:opacity-20"
            style={{
              backgroundColor: isDark ? '#F5F5F4' : '#1C1917',
              color: isDark ? '#1C1917' : '#F5F5F4',
            }}
          >
            {step === 'layout' ? 'Gerar lembrança' : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
}
