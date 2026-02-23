interface Props {
  value: string;
  onChange: (val: string) => void;
  isDark: boolean;
  maxLength?: number;
}

export function MemoryTextInput({ value, onChange, isDark, maxLength = 80 }: Props) {
  const textColor = isDark ? '#F5F5F4' : '#2D2A26';
  const mutedColor = isDark ? '#78716C' : '#A8A29E';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-sm tracking-wide opacity-80" style={{ color: mutedColor }}>
        Opcional — adicione uma frase pessoal
      </p>

      <textarea
        value={value}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) onChange(e.target.value);
        }}
        placeholder="Um momento que vou guardar para sempre"
        rows={2}
        className="w-full text-center text-lg leading-relaxed resize-none border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:opacity-50"
        style={{
          color: textColor,
          caretColor: textColor,
        }}
      />

      <span className="text-xs opacity-60" style={{ color: mutedColor }}>
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
