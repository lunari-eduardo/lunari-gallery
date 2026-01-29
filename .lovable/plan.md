
# Plano: Atualização de Domínios para Produção Lunari

## Resumo Executivo

Os projetos foram publicados em novos domínios padronizados:
- **Gestão**: `https://app.lunarihub.com`
- **Gallery**: `https://gallery.lunarihub.com` (com suporte a subdomínios `*.gallery.lunarihub.com`)

Este plano cobre todas as atualizações necessárias para garantir compatibilidade com os novos domínios enquanto mantém temporariamente os domínios antigos funcionando.

---

## Análise de Impacto

### URLs Hardcoded Encontradas

| Arquivo | Linha | URL Atual | Nova URL |
|---------|-------|-----------|----------|
| `supabase/functions/infinitepay-create-link/index.ts` | 122 | `https://lunari-gallery.lovable.app` | `https://gallery.lunarihub.com` |
| `src/pages/AccessDenied.tsx` | 19 | `https://app.lunari.com.br/settings` | `https://app.lunarihub.com/settings` |

### URLs Dinâmicas (Funcionam Automaticamente)

Os seguintes pontos usam `window.location.origin` e funcionarão automaticamente:
- `src/components/SendGalleryModal.tsx:49` - Link do cliente
- `src/pages/GalleryDetail.tsx:266` - Link do cliente
- `src/pages/GalleryEdit.tsx:595` - Link de reativação
- `src/hooks/useAuth.ts:40` - Redirect OAuth

### Configurações CORS (OK - Wildcard)

Todas as Edge Functions usam `Access-Control-Allow-Origin: '*'`, o que aceita qualquer origem:
- `infinitepay-create-link`
- `infinitepay-webhook`
- `check-payment-status`
- `confirm-selection`
- `gallery-access`
- `gallery-create-payment`
- `b2-upload`
- `delete-photos`
- `client-selection`

---

## Alterações Necessárias

### 1. Edge Function: InfinitePay Create Link

**Problema**: URL de redirect hardcoded para domínio antigo.

**Arquivo**: `supabase/functions/infinitepay-create-link/index.ts`

**Antes**:
```typescript
const baseUrl = 'https://lunari-gallery.lovable.app';
infinitePayload.redirect_url = `${baseUrl}/g/${galleryToken}?payment=success`;
```

**Depois**:
```typescript
// Support both old and new domains during transition
// Primary domain is now gallery.lunarihub.com
const baseUrl = 'https://gallery.lunarihub.com';
infinitePayload.redirect_url = `${baseUrl}/g/${galleryToken}?payment=success`;
```

### 2. Frontend: AccessDenied Upgrade Link

**Problema**: Link de upgrade aponta para domínio antigo do Gestão.

**Arquivo**: `src/pages/AccessDenied.tsx`

**Antes**:
```typescript
window.open('https://app.lunari.com.br/settings', '_blank');
```

**Depois**:
```typescript
window.open('https://app.lunarihub.com/settings', '_blank');
```

---

## Configurações Externas Necessárias

### 3. Supabase Auth - Redirect URLs

No painel Supabase (`Authentication > URL Configuration`), adicionar aos Redirect URLs:

```
https://app.lunarihub.com
https://app.lunarihub.com/**
https://gallery.lunarihub.com
https://gallery.lunarihub.com/**
```

**Manter temporariamente** (durante transição):
```
https://lunari-gallery.lovable.app
https://lunari-gallery.lovable.app/**
```

### 4. Google Cloud Console - OAuth

No Google Cloud Console, adicionar **Authorized redirect URIs**:

```
https://tlnjspsywycbudhewsfv.supabase.co/auth/v1/callback
```

E **Authorized JavaScript origins**:
```
https://app.lunarihub.com
https://gallery.lunarihub.com
```

### 5. InfinitePay - Webhook URL

A URL de webhook já é construída dinamicamente usando `SUPABASE_URL`:
```typescript
infinitePayload.webhook_url = `${supabaseUrl}/functions/v1/infinitepay-webhook`;
// Resulta em: https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook
```

**Nenhuma alteração necessária** - webhooks sempre apontam para o Supabase, não para o frontend.

---

## Diagrama de Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FLUXO DE PAGAMENTO INFINITEPAY                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Cliente finaliza seleção                                                │
│     └── gallery.lunarihub.com/g/{token}                                     │
│                                                                             │
│  2. confirm-selection → infinitepay-create-link                             │
│     └── redirect_url: gallery.lunarihub.com/g/{token}?payment=success       │
│     └── webhook_url: tlnjspsywycbudhewsfv.supabase.co/functions/v1/...      │
│                                                                             │
│  3. Cliente paga na InfinitePay                                             │
│                                                                             │
│  4A. Webhook InfinitePay → Supabase Edge Function                           │
│      └── infinitepay-webhook processa e atualiza DB                         │
│                                                                             │
│  4B. Redirect → Cliente volta para Gallery                                  │
│      └── gallery.lunarihub.com/g/{token}?payment=success                    │
│      └── ClientGallery.tsx captura parâmetros e verifica status             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração | Prioridade |
|---|---------|-----------|------------|
| 1 | `supabase/functions/infinitepay-create-link/index.ts` | Atualizar baseUrl para novo domínio | Alta |
| 2 | `src/pages/AccessDenied.tsx` | Atualizar link de upgrade para novo Gestão | Média |

---

## Configurações Manuais (Supabase Dashboard)

| # | Local | Ação |
|---|-------|------|
| 1 | Supabase Auth > URL Configuration | Adicionar novos domínios aos Redirect URLs |
| 2 | Google Cloud Console > OAuth | Adicionar novos domínios às origins autorizadas |

---

## Compatibilidade Durante Transição

### O que continuará funcionando automaticamente:

| Funcionalidade | Motivo |
|----------------|--------|
| Webhooks InfinitePay | Apontam para Supabase, não frontend |
| CORS em Edge Functions | Wildcard `*` aceita qualquer origem |
| Links dinâmicos do frontend | Usam `window.location.origin` |
| Autenticação Google | Redirect é dinâmico |

### O que precisa de atenção:

| Funcionalidade | Ação Necessária |
|----------------|-----------------|
| Redirect após pagamento InfinitePay | Atualizar código + usuários acessando via domínio antigo serão redirecionados para novo domínio |
| Link de upgrade em AccessDenied | Atualizar código |
| Supabase Redirect URLs | Configurar no dashboard |

---

## Plano de Rollback

Caso necessário reverter:
1. Alterar `baseUrl` de volta para `https://lunari-gallery.lovable.app`
2. Alterar link de upgrade de volta para `https://app.lunari.com.br/settings`
3. Manter URLs antigas no Supabase Auth

---

## Resumo das Alterações de Código

**Total de arquivos a modificar**: 2

1. **infinitepay-create-link**: Linha 122 - Trocar domínio de redirect
2. **AccessDenied.tsx**: Linha 19 - Trocar link do Gestão

**Configurações externas**: 
- Supabase Dashboard (Redirect URLs)
- Google Cloud Console (OAuth origins) - se aplicável
