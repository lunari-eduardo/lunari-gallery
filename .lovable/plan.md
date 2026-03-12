

# Plano: Link de indicação com domínio oficial

## Problema
O link de indicação usa `window.location.origin` (ex: `https://8f0538c4...lovableproject.com`), mas deveria usar o domínio oficial `gallery.lunarihub.com`.

## Solução

### 1. Centralizar domínio em `src/lib/galleryUrl.ts`
Já existe `PRODUCTION_GALLERY_DOMAIN = 'https://gallery.lunarihub.com'`. Adicionar uma função reutilizável:

```ts
export function getReferralUrl(referralCode: string): string {
  const baseDomain = isProductionDomain() 
    ? PRODUCTION_GALLERY_DOMAIN 
    : window.location.origin;
  return `${baseDomain}/auth?ref=${referralCode}`;
}
```

Em produção usa o domínio oficial; em dev usa localhost/preview para testes.

### 2. Atualizar `useReferrals.ts`
Substituir a construção manual do link pela função centralizada:

```ts
import { getReferralUrl } from '@/lib/galleryUrl';
// ...
const referralLink = referralCode ? getReferralUrl(referralCode) : null;
```

**Resultado**: Link sempre com `gallery.lunarihub.com` em produção. Para mudar domínio no futuro, basta alterar `PRODUCTION_GALLERY_DOMAIN` em um único lugar.

