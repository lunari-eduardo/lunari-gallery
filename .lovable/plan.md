

# Correcao: Redirecionamento pos-criacao de galeria Deliver

## Problema

Em `src/pages/DeliverCreate.tsx`, linha 139, o `handlePublish` navega para `/gallery/${supabaseGalleryId}` (pagina de detalhes de **Selecao**) em vez de `/deliver/${supabaseGalleryId}` (pagina administrativa de **Deliver**).

Isso faz com que, apos publicar uma entrega, o fotografo veja a interface de selecao (com abas "Selecao", "Fotos", "Detalhes", "Historico") em vez da interface propria de entrega.

## Solucao

### 1. `src/pages/DeliverCreate.tsx` -- Corrigir rota de redirecionamento

Alterar a linha 139:

```
// De:
navigate(`/gallery/${supabaseGalleryId}`);

// Para:
navigate(`/deliver/${supabaseGalleryId}`);
```

### 2. Sobre o atraso no upload

O atraso observado antes do upload comecar e **comportamento esperado**. Para galerias Deliver (com `allowDownload=true`), o fluxo executa:

1. Upload do **original em alta resolucao** para o Cloudflare R2 (pode levar alguns segundos dependendo do tamanho do arquivo)
2. **Compressao client-side** do preview (2560px)
3. Upload do **preview** via Edge Function

O passo 1 e obrigatorio para garantir que o arquivo original esteja salvo antes de processar o preview. Nao ha problema no fluxo.

## Arquivo

| Arquivo | Acao |
|---------|------|
| `src/pages/DeliverCreate.tsx` | Corrigir navigate de `/gallery/` para `/deliver/` |

