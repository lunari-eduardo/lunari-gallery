
# Plano: Investigacao Completa e Correcao do Sistema de Watermark

## Diagnostico - Situacao Atual

### Problema Identificado

O sistema de watermark **nunca foi funcional** porque existe uma falha fundamental na arquitetura de entrega de imagens.

### Cadeia de Erros Encontrada

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      FLUXO ATUAL (QUEBRADO)                             │
└─────────────────────────────────────────────────────────────────────────┘

   1. UPLOAD (Funciona)
   ┌─────────────────────────────────────────────────────────────────────┐
   │  PhotoUploader.tsx                                                  │
   │         │                                                           │
   │         ▼                                                           │
   │  supabase.functions.invoke('r2-upload')                            │
   │         │                                                           │
   │         ▼                                                           │
   │  Edge Function r2-upload                                            │
   │         │                                                           │
   │         ▼                                                           │
   │  R2 Bucket: lunari-previews ✓                                      │
   │  Path: galleries/{id}/1770489680545-e2e444b3.jpg                   │
   │         │                                                           │
   │         ▼                                                           │
   │  Supabase DB: galeria_fotos ✓                                      │
   │  storage_key = thumb_path = preview_path                           │
   └─────────────────────────────────────────────────────────────────────┘

   2. VISUALIZACAO (Quebrado)
   ┌─────────────────────────────────────────────────────────────────────┐
   │  getPhotoUrl() tenta construir URL:                                 │
   │                                                                     │
   │  https://lunarihub.com/cdn-cgi/image/                              │
   │    width=1920,                                                      │
   │    fit=scale-down,                                                  │
   │    quality=85,                                                      │
   │    draw=[{"url":"https://media.lunarihub.com/system-assets/..."}]  │
   │    /https://media.lunarihub.com/galleries/{id}/foto.jpg            │
   │         │                                                           │
   │         ▼                                                           │
   │  Cloudflare Image Resizing tenta buscar imagem                     │
   │         │                                                           │
   │         ▼                                                           │
   │  https://media.lunarihub.com/galleries/...  ❌ 404!                │
   │                                                                     │
   │  Por que? R2 bucket esta PRIVADO e nao ha Worker servindo!         │
   └─────────────────────────────────────────────────────────────────────┘
```

### Evidencias Coletadas

| Teste | Resultado | Conclusao |
|-------|-----------|-----------|
| Edge Function r2-upload logs | "R2 upload complete" | Upload funciona |
| `media.lunarihub.com/{path}` | Pagina em branco (404) | R2 nao e publico |
| `lunarihub.com/cdn-cgi/image/...` | Pagina em branco | Image Resizing nao encontra origem |
| `system-assets/default-pattern.png` | Nao existe | Asset de watermark nunca foi criado |
| Worker `gallery-upload` | Nunca deployado | Codigo existe, mas nao roda |

### Pontos de Falha

1. **R2 Bucket Privado**: O bucket `lunari-previews` nao tem acesso publico configurado
2. **Worker Nao Deployado**: O Worker `gallery-upload` nunca foi publicado via `wrangler deploy`
3. **Asset Inexistente**: O arquivo `system-assets/default-pattern.png` nao existe no R2
4. **Dominio Desconectado**: `media.lunarihub.com` nao esta conectado ao R2 ou Worker

---

## Arquitetura Correta (Como Deveria Funcionar)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      FLUXO CORRETO                                      │
└─────────────────────────────────────────────────────────────────────────┘

  OPCAO A: R2 com Acesso Publico
  ┌─────────────────────────────────────────────────────────────────────┐
  │  1. Configurar R2 bucket como PUBLICO                               │
  │  2. Conectar custom domain media.lunarihub.com ao R2 publico        │
  │  3. Imagens ficam acessiveis em media.lunarihub.com/{path}          │
  │  4. Cloudflare Image Resizing busca de media.lunarihub.com          │
  │  5. Watermark aplicado via parametro 'draw'                         │
  └─────────────────────────────────────────────────────────────────────┘

  OPCAO B: R2 Privado + Worker (Atual no codigo, nao deployado)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  1. R2 permanece privado                                            │
  │  2. Worker 'gallery-upload' serve imagens do R2                     │
  │  3. Custom domain cdn.lunarihub.com conectado ao Worker             │
  │  4. Cloudflare Image Resizing busca via Worker                      │
  │  5. Problema: Worker precisa deploy manual (wrangler)               │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Solucao Recomendada

### Opcao Escolhida: Tornar R2 Publico

Esta e a solucao mais simples porque:
- Nao requer deploy manual de Workers
- Usa infraestrutura nativa do Cloudflare
- Menos pontos de falha
- Lovable pode fazer apenas as mudancas no codigo

### Acoes Necessarias no Cloudflare Dashboard

Voce precisara fazer estas configuracoes manualmente no painel do Cloudflare:

1. **Tornar bucket R2 publico**
   - Cloudflare Dashboard → R2 → lunari-previews → Settings
   - Enable "Public access" (R2.dev subdomain ou custom domain)
   
2. **Conectar custom domain**
   - R2 → lunari-previews → Settings → Custom Domain
   - Adicionar: `media.lunarihub.com`
   - Isso automaticamente cria os DNS records

3. **Upload do asset de watermark**
   - Criar arquivo `system-assets/default-pattern.png`
   - Upload para o bucket R2

---

## Mudancas no Codigo

Uma vez que o R2 esteja publico com custom domain, as URLs vao funcionar automaticamente porque o codigo ja esta correto.

### Validacao do Codigo Existente

**photoUrl.ts** - Ja esta correto:
```typescript
const R2_PUBLIC_URL = 'https://media.lunarihub.com';
const CF_RESIZING_DOMAIN = 'https://lunarihub.com';

// Gera URL correta:
// https://lunarihub.com/cdn-cgi/image/width=1920,draw=[...]/https://media.lunarihub.com/galleries/...
```

**ClientGallery.tsx** - Ja busca watermark settings:
```typescript
const { data: photographerWatermark } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from('photographer_accounts')
      .select('watermark_mode, watermark_path, watermark_opacity, watermark_scale')
      .eq('user_id', photographerUserId)
      .single();
    return data;
  },
});

// Passa para getPhotoUrl:
const watermarkConfig: WatermarkConfig = {
  mode: photographerWatermark?.watermark_mode || 'system',
  path: photographerWatermark?.watermark_path || null,
};
```

### Unica Mudanca Necessaria no Codigo

Criar fallback caso o asset de watermark nao exista:

**src/lib/photoUrl.ts** - Adicionar fallback seguro:
```typescript
function getWatermarkOverlayUrl(config: WatermarkConfig): string | null {
  if (config.mode === 'none') return null;
  
  if (config.mode === 'custom' && config.path) {
    return `${R2_PUBLIC_URL}/${config.path}`;
  }
  
  // System default - usar padrao hospedado ou gerar via CSS
  // Por enquanto, retornar null se nao existir para evitar erros
  return `${R2_PUBLIC_URL}/system-assets/default-pattern.png`;
}
```

---

## Asset de Watermark Padrao

O sistema precisa de um arquivo PNG para aplicar como marca d'agua em mosaico.

### Especificacoes do Asset

| Propriedade | Valor |
|-------------|-------|
| Formato | PNG com transparencia |
| Dimensoes | ~200x200px (tile pequeno) |
| Conteudo | Linhas diagonais semi-transparentes |
| Opacidade | Embutida no PNG (~30-40%) |
| Path no R2 | `system-assets/default-pattern.png` |

### Como Criar e Subir

1. Criar imagem PNG com pattern diagonal
2. Subir para R2 via Cloudflare Dashboard:
   - R2 → lunari-previews → Upload
   - Path: `system-assets/default-pattern.png`

---

## Checklist de Correcao

### Acoes no Cloudflare (Voce)

- [ ] R2 → lunari-previews → Settings → Enable Public Access
- [ ] R2 → lunari-previews → Settings → Add Custom Domain: media.lunarihub.com
- [ ] Verificar DNS: media.lunarihub.com → R2 bucket
- [ ] Upload: system-assets/default-pattern.png para R2

### Validacao (Eu farei apos configuracao)

- [ ] Testar URL direta: `https://media.lunarihub.com/galleries/{id}/foto.jpg`
- [ ] Testar Image Resizing: `https://lunarihub.com/cdn-cgi/image/width=400/https://media.lunarihub.com/...`
- [ ] Testar Watermark: `https://lunarihub.com/cdn-cgi/image/width=1920,draw=[...]/https://media.lunarihub.com/...`

---

## Resumo

| Problema | Causa | Solucao |
|----------|-------|---------|
| Imagens nao carregam | R2 bucket privado | Tornar publico + custom domain |
| Watermark nao aparece | Asset nao existe | Upload do PNG pattern |
| Worker nao funciona | Nunca deployado | Nao necessario com R2 publico |

### Por Que Isso Aconteceu

O projeto foi arquitetado para usar Cloudflare Image Resizing com R2, mas a configuracao do bucket e dominio nunca foi concluida. O codigo esta correto, mas a infraestrutura nao foi provisionada.

### Proximos Passos

1. Voce configura R2 publico no Cloudflare Dashboard
2. Voce faz upload do asset de watermark
3. Eu valido que as URLs funcionam
4. Sistema de watermark funciona automaticamente
