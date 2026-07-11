import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  /**
   * Estilos vindos do tema do fotógrafo (ex.: --primary da marca).
   * São mesclados por último para preservar a cor de marca no botão principal.
   */
  themeStyles?: React.CSSProperties;
}

/**
 * Wrapper que força tokens **Light** no subtree, independentemente do tema
 * global (galeria em dark, preferência do usuário em dark, etc.).
 *
 * Usado nas telas de cobrança/pagamento/confirmação — que devem manter visual
 * limpo, claro e legível mesmo quando a galeria em si está em modo escuro.
 *
 * As variáveis abaixo espelham o bloco `:root` (light) de `index.css`, com
 * hue neutro (fixo) para não depender do preset de marca escolhido.
 */
export function LightPaymentSurface({ children, className, themeStyles }: Props) {
  const lightTokens: React.CSSProperties = {
    // Superfícies
    ['--background' as any]: '0 0% 100%',
    ['--foreground' as any]: '20 20% 12%',
    ['--card' as any]: '0 0% 100%',
    ['--card-foreground' as any]: '20 20% 12%',
    ['--popover' as any]: '0 0% 100%',
    ['--popover-foreground' as any]: '20 20% 12%',
    // Neutrals
    ['--secondary' as any]: '220 14% 96%',
    ['--secondary-foreground' as any]: '20 20% 12%',
    ['--muted' as any]: '220 14% 96%',
    ['--muted-foreground' as any]: '220 10% 45%',
    ['--accent' as any]: '220 14% 96%',
    ['--accent-foreground' as any]: '20 20% 12%',
    // Bordas finas / inputs
    ['--border' as any]: '220 13% 91%',
    ['--input' as any]: '220 13% 91%',
    // primary/ring continuam vindo do tema (marca do fotógrafo)
    ...(themeStyles || {}),
  };

  return (
    <div
      // Remove qualquer herança de .dark do ancestral aplicando color-scheme light
      // e um contêiner que NÃO tem a classe `dark`. Os tokens acima sobrescrevem
      // os que o `.dark` do <html> setou, porque estão inline neste elemento.
      className={cn('min-h-screen w-full [color-scheme:light]', className)}
      style={lightTokens}
    >
      {children}
    </div>
  );
}
