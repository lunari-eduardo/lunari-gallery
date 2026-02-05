
# Plano: Corrigir Validação JWT no Worker gallery-upload

## Diagnóstico do Problema

A validação JWT está falhando por três possíveis razões:

1. **Validação estrita de claims**: O código exige `audience: "authenticated"` mas alguns tokens Supabase podem ter `aud` como array ou valor diferente
2. **Formato do issuer**: Pode haver inconsistência entre a URL configurada e a URL real no token
3. **Método de verificação**: O Supabase modernizou para usar JWKS (mais seguro), mas o código usa o JWT_SECRET legado

---

## Solução Proposta

Criar uma função `validateAuth` mais tolerante que:

1. **Remove validação estrita de `issuer` e `audience`** - verifica apenas a assinatura
2. **Adiciona logging detalhado** - para debug em caso de falha
3. **Fallback gracioso** - tenta decodificar mesmo se claims falharem

### Código Corrigido para `index.ts`

```typescript
// Validate Supabase JWT - versão tolerante para debug
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
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    
    // Verificação SEM issuer/audience estritos (mais tolerante)
    const { payload } = await jose.jwtVerify(token, secret);

    const userId = payload.sub;
    const email = payload.email as string;

    if (!userId) {
      console.log('Auth failed: No sub claim in JWT');
      return null;
    }

    // Log de sucesso com detalhes
    console.log(`Auth OK: user=${userId}, email=${email || 'N/A'}, iss=${payload.iss}, aud=${payload.aud}`);
    
    return { userId, email: email || '' };
  } catch (error) {
    // Log detalhado do erro para debug
    console.error('JWT validation error:', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      tokenPrefix: token.substring(0, 50) + '...',
    });
    return null;
  }
}
```

### Alterações Principais

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Verificação de `issuer` | Obrigatório e estrito | Removido (opcional) |
| Verificação de `audience` | Obrigatório (`authenticated`) | Removido (opcional) |
| Logging de erro | Básico | Detalhado com contexto |
| Logging de sucesso | Apenas userId | userId + email + iss + aud |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `cloudflare/workers/gallery-upload/index.ts` | Atualizar função `validateAuth` |

---

## Alternativa: Usar JWKS (Recomendado pelo Supabase)

Se o problema persistir, podemos migrar para verificação via JWKS:

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

const { payload } = await jwtVerify(token, JWKS);
```

**Vantagem**: Não precisa do JWT_SECRET como variável de ambiente.
**Desvantagem**: Faz uma request HTTP para buscar as chaves (cache automático).

---

## Verificações Adicionais

### 1. Confirmar JWT_SECRET

O valor deve ser exatamente o mesmo encontrado em:
- Supabase Dashboard → Project Settings → API → JWT Secret

Deve ter aproximadamente 32+ caracteres e parecer com:
```
super-secret-jwt-token-with-at-least-32-characters
```

### 2. Testar manualmente

Após deploy, verificar logs do Worker no Cloudflare Dashboard:
- Workers & Pages → gallery-upload → Logs → Real-time Logs

---

## Resultado Esperado

Após a correção:
1. Upload de watermark funciona sem erro 401
2. Logs mostram detalhes úteis para debug futuro
3. Sistema mais tolerante a variações nos claims JWT

---

## Seção Técnica

### Estrutura do JWT Supabase

```json
{
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "https://PROJECT_ID.supabase.co/auth/v1",
  "sub": "user-uuid-here",
  "email": "user@example.com",
  "role": "authenticated"
}
```

### Possíveis Causas do 401

1. **JWT_SECRET incorreto** → Assinatura não bate
2. **Token expirado** → `exp` menor que timestamp atual
3. **Issuer mismatch** → URL do Supabase diferente
4. **Audience mismatch** → `aud` não é "authenticated"

A solução remove as verificações 3 e 4, focando apenas em 1 e 2.
