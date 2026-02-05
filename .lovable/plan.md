
# Plano: Corrigir Validação JWT Base64 e Sincronizar Pipeline de Upload

## Diagnóstico Completo

Analisei todos os arquivos relevantes e identifiquei **3 problemas críticos**:

### Problema 1: JWT Secret Base64 não decodificado
- O `SUPABASE_JWT_SECRET` é uma string Base64 (termina com `==`)
- O código atual usa `TextEncoder().encode(secret)` que trata como texto plano
- Isso gera uma chave de assinatura incorreta → 401 Signature verification failed

### Problema 2: Upload de fotos vai para B2, não para R2
- O `PhotoUploader` envia fotos para a Edge Function `b2-upload` (Supabase)
- As fotos vão para **Backblaze B2**, não para o R2 do Cloudflare
- O Worker de upload (`gallery-upload`) nunca é chamado pelo frontend
- Por isso o bucket R2 (`lunari-previews`) está vazio

### Problema 3: Upload de watermark já chama o Worker correto
- O `useWatermarkSettings.ts` chama `cdn.lunarihub.com/upload-watermark` ✓
- Mas falha por causa do Problema 1 (JWT inválido)

---

## Solução Proposta

### Parte 1: Corrigir validação JWT no Worker

Atualizar a função `validateAuth` em `cloudflare/workers/gallery-upload/index.ts` para:
1. Detectar automaticamente se o secret é Base64
2. Decodificar corretamente antes de usar na verificação
3. Adicionar logs detalhados para debug

```text
┌─────────────────────────────────────────────────────────┐
│  SUPABASE_JWT_SECRET (Base64)                           │
│  "abc123XYZ...==" (texto)                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  ERRADO: TextEncoder().encode("abc123XYZ...==")         │
│  → Bytes: [97, 98, 99, 49, 50, 51, ...]                 │
│  → Trata os caracteres ASCII como bytes                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  CORRETO: atob("abc123XYZ...==") → decode → Uint8Array  │
│  → Bytes: [Valores reais da chave HS256]                │
│  → Chave correta para verificar assinatura              │
└─────────────────────────────────────────────────────────┘
```

### Parte 2: Confirmar arquitetura de upload

A arquitetura atual é:

```text
┌──────────────────────────────────────────────────────────────────┐
│                    FLUXO DE UPLOAD DE FOTOS                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend (PhotoUploader)                                        │
│       │                                                          │
│       ▼                                                          │
│  Supabase Edge Function: b2-upload                               │
│       │                                                          │
│       ▼                                                          │
│  Backblaze B2 (originais privados)                               │
│       │                                                          │
│       ▼                                                          │
│  DB: galeria_fotos (processing_status = 'uploaded')              │
│       │                                                          │
│       ▼                                                          │
│  Edge Function: process-photos (orquestrador - via pg_cron)      │
│       │                                                          │
│       ▼                                                          │
│  Cloudflare Worker: lunari-image-processor                       │
│       │                                                          │
│       ├── Busca original do B2                                   │
│       ├── Gera: thumb (400px), preview (1200px), preview-wm      │
│       └── Upload para R2 (lunari-previews)                       │
│       │                                                          │
│       ▼                                                          │
│  DB: galeria_fotos (processing_status = 'ready')                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

O R2 está vazio porque:
- **O orquestrador `process-photos` precisa ser acionado** (via pg_cron ou manual)
- **O Worker `lunari-image-processor` precisa estar funcionando**

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `cloudflare/workers/gallery-upload/index.ts` | Corrigir decodificação Base64 do JWT secret |

---

## Código Corrigido

### Nova função validateAuth

```typescript
/**
 * Decode a base64 string to Uint8Array
 * Works with both standard base64 and base64url
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Handle base64url format (replace - with + and _ with /)
  const normalizedBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Decode base64 to binary string
  const binaryString = atob(normalizedBase64);
  
  // Convert to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Check if a string appears to be base64 encoded
 */
function isBase64(str: string): boolean {
  // Check for base64 patterns: ends with = or ==, or has valid base64 chars only
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return str.length > 20 && base64Regex.test(str);
}

// Validate Supabase JWT - com suporte a Base64 JWT Secret
async function validateAuth(
  request: Request,
  env: Env
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Auth failed: No Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Determine if secret is base64 encoded
    const rawSecret = env.SUPABASE_JWT_SECRET;
    let secret: Uint8Array;
    
    if (isBase64(rawSecret)) {
      // Decode base64 to bytes
      console.log('Using Base64-decoded JWT secret');
      secret = base64ToUint8Array(rawSecret);
    } else {
      // Use as plain text (fallback)
      console.log('Using plain text JWT secret');
      secret = new TextEncoder().encode(rawSecret);
    }
    
    // Verify JWT with explicit HS256 algorithm
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const userId = payload.sub;
    const email = payload.email as string;

    if (!userId) {
      console.log('Auth failed: No sub claim in JWT');
      return null;
    }

    console.log(`Auth OK: user=${userId}, iss=${payload.iss}`);
    return { userId, email: email || '' };
  } catch (error) {
    console.error('JWT validation error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      tokenLength: token.length,
      secretLength: env.SUPABASE_JWT_SECRET?.length || 0,
    });
    return null;
  }
}
```

---

## Verificações Pós-Deploy

### 1. Teste de upload de watermark
Após o redeploy, tente fazer upload de uma watermark PNG em **Configurações > Personalização**.

### 2. Verificar se fotos estão sendo processadas
Execute manualmente a função process-photos:
```bash
curl -X POST "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 3. Verificar logs do Worker
No Cloudflare Dashboard:
- Workers & Pages → gallery-upload → Logs → Real-time

Os logs devem mostrar:
- `Using Base64-decoded JWT secret`
- `Auth OK: user=xxx, iss=https://...`

---

## Resultado Esperado

Após a correção:

1. **Upload de watermark funciona** - JWT é validado corretamente
2. **O R2 começa a receber arquivos** - quando process-photos rodar
3. **Pipeline completo operacional** - fotos processadas e servidas via CDN

---

## Próximos Passos (Ação do Usuário)

1. **Redeploy do gallery-upload** com o código corrigido
2. **Testar upload de watermark** no frontend
3. **Verificar se process-photos está sendo executado** (pg_cron configurado?)
4. **Verificar se lunari-image-processor está funcionando** (testar /health)
