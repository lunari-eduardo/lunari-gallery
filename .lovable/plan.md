

# Correção: Upload de fotos não funciona ao trocar/criar pastas no GalleryEdit

## Causa Raiz

O `UploadPipeline` é criado uma vez (lazy init) com o `folderId` fixo no construtor. Quando o fotógrafo troca de pasta ou cria uma nova pasta, o `folderId` prop do `PhotoUploader` muda, mas o pipeline existente mantém o `folderId` antigo (possivelmente `null`).

O efeito de reset (linha ~133 do PhotoUploader) tenta destruir o pipeline quando `folderId` muda, mas **só funciona se o pipeline não estiver ativo**. E o `getPipeline()` verifica `if (!pipelineRef.current)` — ou seja, se o pipeline já existe, ele é reutilizado com o folderId desatualizado.

Resultado: fotos são enviadas com `pasta_id = null` ou com o ID da pasta anterior, nunca aparecendo na pasta correta.

## Correção

### 1. `PhotoUploader.tsx` — Forçar recriação do pipeline ao mudar folderId

Alterar o efeito de reset do pipeline para **sempre** destruir e recriar quando `folderId` mudar (se não houver upload ativo):

```typescript
useEffect(() => {
  if (pipelineRef.current) {
    if (!pipelineRef.current.isActive) {
      pipelineRef.current.destroy();
      pipelineRef.current = null;
    }
  }
}, [folderId]);
```

Isso já existe, mas o problema é que `getPipeline` também precisa reagir. A solução real é **remover o `if (!pipelineRef.current)` guard** e sempre recriar o pipeline quando `getPipeline` é chamado com um folderId diferente do atual. Ou, mais simples: destruir o pipeline no efeito acima E limpar os items quando não há upload ativo.

Mudança específica no `getPipeline`:
- Verificar se `pipelineRef.current` existe mas tem um `folderId` diferente do atual → destruir e recriar.

### 2. `UploadPipeline` — Expor folderId para comparação

Adicionar um getter público `get folderId()` no `UploadPipeline` para que o `PhotoUploader` possa comparar o folderId atual do pipeline com o novo.

### Resumo das mudanças:

| Arquivo | Mudança |
|---|---|
| `src/lib/uploadPipeline.ts` | Adicionar getter `folderId` público |
| `src/components/PhotoUploader.tsx` | No `getPipeline`, verificar se folderId mudou e recriar pipeline. No efeito de reset, garantir destruição. |

