

# Plano de Correção: Sistema de Watermark e Autorização

## Resumo dos Problemas Identificados

| # | Problema | Causa Raiz |
|---|----------|------------|
| 1 | Worker image-processor retorna 503 | Limite de recursos do Cloudflare (plano grátis) |
| 2 | Upload de watermark retorna 401 | Worker gallery-upload não foi redeployado após mudança JWKS |
| 3 | Fotos presas em "processing" | Falharam no Worker e não voltaram para "uploaded" |

---

## Fase 1: Correção Imediata - Deploy dos Workers

### 1.1 Deploy do Worker `gallery-upload` com JWKS

Você **PRECISA** fazer o deploy manual do Worker atualizado. O código foi alterado, mas o Worker em produção ainda usa a versão antiga com HS256.

**Passos no terminal:**

```bash
# 1. Entre na pasta do worker
cd lunari-upload

# 2. Instale dependências (se não instalou)
npm install

# 3. Faça login no Cloudflare (se necessário)
wrangler login

# 4. Deploy do worker
wrangler deploy

# 5. (Opcional) Remova o secret antigo que não é mais necessário
wrangler secret delete SUPABASE_JWT_SECRET
```

Após o deploy, verifique que funciona:
```bash
curl https://cdn.lunarihub.com/health
# Deve retornar: {"status":"ok","timestamp":"..."}
```

### 1.2 Deploy do Worker `image-processor`

O Worker de processamento também precisa ser redeployado com as novas funcionalidades de tiling:

```bash
# 1. Entre na pasta do worker
cd lunari-image-processor

# 2. Instale dependências
npm install

# 3. Deploy
wrangler deploy
```

**IMPORTANTE:** O Worker vai continuar falhando com erro 503 (resource limits) até você fazer upgrade para o plano pago do Cloudflare Workers ($5/mês) ou usar imagens menores para teste.

---

## Fase 2: Correção de Dados - Fotos Presas

Após os deploys, precisamos corrigir as fotos que ficaram presas:

### SQL para executar no Supabase:

```sql
-- Resetar fotos presas em "processing" para "uploaded"
-- Assim serão reprocessadas na próxima execução do cron
UPDATE galeria_fotos
SET processing_status = 'uploaded',
    updated_at = now()
WHERE processing_status = 'processing';
```

---

## Fase 3: Upload do Pattern do Sistema

O Worker espera encontrar o pattern de linhas diagonais em:
```
system-assets/default-pattern.png
```

Você precisa fazer upload deste arquivo para o bucket R2 `lunari-previews`.

**Opção A: Via Dashboard do Cloudflare**
1. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Vá em R2 → lunari-previews
3. Crie a pasta `system-assets`
4. Faça upload do arquivo `default-pattern.png`

**Opção B: Via wrangler (CLI)**
```bash
# Na pasta do worker
wrangler r2 object put lunari-previews/system-assets/default-pattern.png --file=/caminho/para/default-pattern.png
```

### Especificações do Pattern:
- Dimensão: 2560x2560px (ou maior)
- Formato: PNG com transparência
- Conteúdo: Linhas diagonais finas
- Opacidade já aplicada: 30-40%

---

## Fase 4: Verificação Completa

### 4.1 Testar Upload de Watermark Personalizada

1. Faça login na aplicação
2. Vá em Configurações → Marca d'água
3. Selecione "Minha Marca"
4. Faça upload de um PNG
5. Se funcionar, o arquivo será salvo em `user-assets/{user_id}/watermark.png`

### 4.2 Testar Processamento de Fotos

1. Crie uma nova galeria
2. Faça upload de uma foto pequena (< 1MB)
3. Aguarde 1-2 minutos (cron executa a cada minuto)
4. Verifique se a foto foi processada (status = "ready")
5. Verifique se `preview_wm_path` foi preenchido

---

## Resumo de Ações Manuais

| Ordem | Ação | Comando/Local |
|-------|------|---------------|
| 1 | Deploy gallery-upload | `cd lunari-upload && wrangler deploy` |
| 2 | Deploy image-processor | `cd lunari-image-processor && wrangler deploy` |
| 3 | Resetar fotos presas | SQL no Supabase Dashboard |
| 4 | Upload default-pattern.png | R2 → system-assets/ |
| 5 | Testar upload de watermark | Configurações → Marca d'água |
| 6 | (Opcional) Upgrade Cloudflare | Workers & Pages → Plans |

---

## Notas Técnicas

### Por que o Worker precisa de deploy manual?

O Lovable não tem acesso ao CLI do Cloudflare (`wrangler`). Os Workers do Cloudflare são gerenciados separadamente do deploy da aplicação web.

Qualquer alteração em arquivos dentro de `cloudflare/workers/` requer:
1. `npm install` para instalar dependências
2. `wrangler deploy` para publicar no Cloudflare

### Por que ainda ocorre erro 503?

O plano gratuito do Cloudflare Workers tem limites rigorosos:
- 10ms de CPU time por request
- 128MB de memória

O processamento de imagens com WASM (Photon) é muito intensivo e excede esses limites facilmente. A solução é:
- **Plano Workers Paid**: $5/mês, 30 segundos de CPU, 128MB memória
- **Workers Unbound**: Mais limites ainda

### Arquivos que foram alterados (requerem deploy)

| Worker | Arquivo | Alteração |
|--------|---------|-----------|
| gallery-upload | `index.ts` | Autenticação JWKS (linhas 31-79) |
| image-processor | `index.ts` | Tiling watermark (funções novas) |

