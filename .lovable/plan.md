

# Plano: Corrigir Autenticação JWT do Worker gallery-upload

## Problema Identificado

O Worker `gallery-upload` usa validação HS256 com `SUPABASE_JWT_SECRET`:

```typescript
// ATUAL (linhas 91-94) - INCORRETO
const { payload } = await jose.jwtVerify(token, secret, {
  algorithms: ['HS256'],
});
```

**Por que falha:**
- Projetos Supabase modernos usam **RS256** (chave assimétrica)
- O `SUPABASE_JWT_SECRET` pode não ser compatível com HS256
- A rotação de chaves não é suportada

## Solução: Usar JWKS (JSON Web Key Set)

A abordagem correta é usar o endpoint JWKS do Supabase para validar tokens:

```typescript
// CORRETO
const JWKS = jose.createRemoteJWKSet(
  new URL('https://tlnjspsywycbudhewsfv.supabase.co/auth/v1/.well-known/jwks.json')
);

const { payload } = await jose.jwtVerify(token, JWKS, {
  issuer: 'https://tlnjspsywycbudhewsfv.supabase.co/auth/v1',
});
```

**Vantagens:**
- Suporta RS256 automaticamente
- Chaves públicas são baixadas e cacheadas
- Rotação de chaves é transparente
- Mais seguro (não requer distribuir secrets)

---

## Alterações no Código

### Arquivo: `cloudflare/workers/gallery-upload/index.ts`

#### 1. Remover função `base64ToUint8Array` (linhas 32-52)
Não será mais necessária.

#### 2. Remover função `isBase64` (linhas 57-61)
Não será mais necessária.

#### 3. Atualizar interface `Env` (linhas 16-23)
```typescript
// ANTES
export interface Env {
  GALLERY_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;  // REMOVER
}

// DEPOIS
export interface Env {
  GALLERY_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // SUPABASE_JWT_SECRET removido - não é mais necessário
}
```

#### 4. Reescrever função `validateAuth` (linhas 63-115)

```typescript
// URL do JWKS (chaves públicas do Supabase)
const SUPABASE_JWKS_URL = 'https://tlnjspsywycbudhewsfv.supabase.co/auth/v1/.well-known/jwks.json';
const SUPABASE_ISSUER = 'https://tlnjspsywycbudhewsfv.supabase.co/auth/v1';

// Cache do JWKS (reutilizado entre requests)
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
  }
  return jwks;
}

// Validate Supabase JWT using JWKS
async function validateAuth(
  request: Request
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Auth failed: No Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify JWT using JWKS (supports RS256 automatically)
    const { payload } = await jose.jwtVerify(token, getJWKS(), {
      issuer: SUPABASE_ISSUER,
    });

    const userId = payload.sub;
    const email = payload.email as string;

    if (!userId) {
      console.log('Auth failed: No sub claim in JWT');
      return null;
    }

    console.log(`Auth OK: user=${userId}, alg=RS256`);
    return { userId, email: email || '' };
  } catch (error) {
    console.error('JWT validation error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
    });
    return null;
  }
}
```

#### 5. Atualizar chamadas de `validateAuth`

Remover o parâmetro `env` das chamadas:

```typescript
// ANTES (linha 122)
const user = await validateAuth(request, env);

// DEPOIS
const user = await validateAuth(request);
```

```typescript
// ANTES (linha 307)
const user = await validateAuth(request, env);

// DEPOIS
const user = await validateAuth(request);
```

---

## Atualização do wrangler.toml

O secret `SUPABASE_JWT_SECRET` pode ser removido:

```toml
# Secrets (set via wrangler secret put):
# wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_JWT_SECRET - NÃO É MAIS NECESSÁRIO
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `cloudflare/workers/gallery-upload/index.ts` | Substituir validação HS256 por JWKS |

### Código Removido
- Função `base64ToUint8Array()`
- Função `isBase64()`
- Propriedade `SUPABASE_JWT_SECRET` do `Env`
- Lógica de detecção Base64/texto do secret

### Código Adicionado
- Constantes `SUPABASE_JWKS_URL` e `SUPABASE_ISSUER`
- Função `getJWKS()` para cache do JWKS
- Nova implementação de `validateAuth()` usando JWKS

---

## Checklist Pós-Implementação

### Deploy
```bash
cd cloudflare/workers/gallery-upload
npm install
wrangler deploy
```

### Opcional: Remover Secret Antigo
```bash
wrangler secret delete SUPABASE_JWT_SECRET
```

### Teste
1. Fazer login na aplicação
2. Tentar fazer upload de uma foto
3. Verificar logs do Worker para confirmar `Auth OK: user=xxx, alg=RS256`

---

## Nota Técnica: Por que JWKS?

| Método | HS256 (Simétrico) | RS256/JWKS (Assimétrico) |
|--------|-------------------|--------------------------|
| Chave | Compartilhada (secret) | Pública + Privada |
| Distribuição | Precisa copiar o secret | Só precisa da URL pública |
| Rotação | Manual | Automática |
| Segurança | Se vazar, compromete tudo | Chave pública é... pública |
| Supabase | Projetos antigos | **Projetos modernos (padrão)** |

O Supabase moderno usa RS256 por padrão, e o endpoint JWKS está sempre disponível em:
```
https://{project_id}.supabase.co/auth/v1/.well-known/jwks.json
```

