
# Plano: Salvamento de Rascunho de Galeria e Melhorias na Tela de Edição

## Resumo

Este plano cobre três áreas principais:
1. **Permitir salvamento de rascunho** em qualquer etapa da criação de galeria (sem fotos ou cliente)
2. **Reorganizar a tela de edição** (mover botões, estilizar "excluir" como texto vermelho)
3. **Corrigir bug do prazo de seleção** que não está sendo salvo

---

## Problema 1: Rascunho de Galeria

### Situação Atual
A galeria só é criada no banco de dados quando o fotógrafo avança do **Passo 3 → Passo 4 (Fotos)**, e há validação obrigatória de cliente para galerias privadas.

### Solução
Adicionar botão "Salvar Rascunho" disponível em todas as etapas, que cria ou atualiza a galeria no banco com `status: 'rascunho'`, sem exigir cliente ou fotos.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GalleryCreate.tsx` | Adicionar botão "Salvar Rascunho" no footer fixo; criar função `handleSaveDraft()` |
| `src/hooks/useSupabaseGalleries.ts` | Garantir que `createGallery` e `updateGallery` aceitem todos campos como opcionais |

### Detalhes Técnicos

**Nova função em GalleryCreate.tsx:**
```typescript
const handleSaveDraft = async () => {
  try {
    if (supabaseGalleryId) {
      // Atualizar galeria existente
      await updateGallery({
        id: supabaseGalleryId,
        data: {
          nomeSessao: sessionName || undefined,
          nomePacote: packageName || undefined,
          clienteNome: selectedClient?.name,
          clienteEmail: selectedClient?.email,
          fotosIncluidas: includedPhotos,
          valorFotoExtra: saleMode !== 'no_sale' ? fixedPrice : 0,
          prazoSelecaoDias: customDays,
          permissao: galleryPermission,
          configuracoes: { ... },
        }
      });
    } else {
      // Criar nova galeria como rascunho
      const result = await createSupabaseGallery({
        clienteId: selectedClient?.id || null,
        clienteNome: selectedClient?.name || undefined,
        clienteEmail: selectedClient?.email || undefined,
        nomeSessao: sessionName || 'Rascunho',
        // ... demais campos opcionais
      });
      if (result?.id) setSupabaseGalleryId(result.id);
    }
    toast.success('Rascunho salvo!');
    navigate('/');
  } catch (error) {
    toast.error('Erro ao salvar rascunho');
  }
};
```

**Novo botão no footer fixo:**
- Posição: Entre "Voltar" e "Próximo"
- Ícone: Save
- Texto: "Salvar Rascunho"
- Variante: outline

---

## Problema 2: Layout da Tela de Edição

### Situação Atual (conforme imagem)
- Botão "Excluir Galeria" está no header (canto superior direito) com estilo vermelho chamativo
- Botão "Salvar Alterações" está no final do card de informações básicas

### Solução Proposta
1. **Mover "Salvar Alterações"** para o header (onde estava "Excluir")
2. **Mover "Excluir Galeria"** para dentro do card de "Ações da Galeria"
3. **Estilizar "Excluir"** como texto vermelho simples (sem botão vermelho)

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GalleryEdit.tsx` | Reorganizar header e cards |
| `src/components/DeleteGalleryDialog.tsx` | Adicionar suporte para trigger customizado (já existe) |

### Mudanças de Layout

**Header (linhas 254-274):**
```tsx
<div className="flex items-center justify-between gap-4">
  <div className="flex items-center gap-4">
    <Button variant="ghost" size="icon" onClick={() => navigate(`/gallery/${id}`)}>
      <ArrowLeft className="h-5 w-5" />
    </Button>
    <div>
      <h1>Editar Galeria</h1>
      <p>{gallery.nomeSessao || 'Galeria'}</p>
    </div>
  </div>
  
  {/* NOVO: Botão Salvar no header */}
  <Button onClick={handleSave} disabled={isUpdating} variant="terracotta">
    {isUpdating ? <Loader2 /> : <Save />}
    Salvar Alterações
  </Button>
</div>
```

**Remover botão salvar do card de informações (linhas 411-429)**

**Novo card de Ações com Excluir (após card de fotos):**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Ações da Galeria</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Reativar - se aplicável */}
    {canReactivate && (
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div>
          <p className="font-medium">Reativar Galeria</p>
          <p className="text-sm text-muted-foreground">...</p>
        </div>
        <ReactivateGalleryDialog ... />
      </div>
    )}
    
    {/* NOVO: Excluir como texto vermelho */}
    <div className="pt-4 border-t">
      <DeleteGalleryDialog
        galleryName={gallery.nomeSessao || 'Esta galeria'}
        onDelete={handleDelete}
        trigger={
          <button className="text-sm text-destructive hover:underline">
            Excluir galeria permanentemente
          </button>
        }
      />
    </div>
  </CardContent>
</Card>
```

---

## Problema 3: Prazo de Seleção Não Salva

### Causa Raiz
O `handleSave` em `GalleryEdit.tsx` **não inclui** o campo `prazoSelecao` na chamada de `updateGallery`. Além disso, a mutation só aceita `prazoSelecaoDias` (número de dias), mas a tela de edição trabalha com a data final diretamente.

### Solução
1. Adicionar campo `prazoSelecao` (Date) ao `CreateGaleriaData` interface
2. Atualizar `updateGalleryMutation` para aceitar e salvar `prazo_selecao` como timestamp
3. Passar `prazoSelecao` no `handleSave`

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSupabaseGalleries.ts` | Adicionar `prazoSelecao?: Date` à interface e mutation |
| `src/pages/GalleryEdit.tsx` | Incluir `prazoSelecao` no `handleSave` |

### Detalhes Técnicos

**Interface CreateGaleriaData (adicionar campo):**
```typescript
export interface CreateGaleriaData {
  // ... campos existentes
  prazoSelecaoDias?: number;
  prazoSelecao?: Date;  // NOVO: Data limite direta
  // ...
}
```

**Mutation updateGalleryMutation (adicionar handling):**
```typescript
if (data.prazoSelecao !== undefined) {
  updateData.prazo_selecao = data.prazoSelecao.toISOString();
}
```

**handleSave em GalleryEdit.tsx:**
```typescript
const handleSave = async () => {
  const cleanPhone = clienteTelefone.replace(/\D/g, '');
  
  await updateGallery({
    id: gallery.id,
    data: {
      nomeSessao,
      clienteNome,
      clienteEmail,
      clienteTelefone: cleanPhone || undefined,
      nomePacote: nomePacote || undefined,
      fotosIncluidas,
      valorFotoExtra,
      prazoSelecao,  // NOVO: incluir prazo
    }
  });
  toast.success('Galeria atualizada!');
};
```

**Também remover toast duplicado em handleExtendDeadline:**
O toast "Prazo estendido" é enganoso pois não salva automaticamente. Duas opções:
- Opção A: Chamar save automaticamente após estender
- Opção B: Mudar texto para "Prazo ajustado. Clique em Salvar para confirmar."

Recomendo **Opção A** para melhor UX.

---

## Resumo de Arquivos

| Arquivo | Modificações |
|---------|--------------|
| `src/pages/GalleryCreate.tsx` | Adicionar `handleSaveDraft` e botão no footer |
| `src/pages/GalleryEdit.tsx` | Reorganizar layout, mover botões, incluir `prazoSelecao` no save |
| `src/hooks/useSupabaseGalleries.ts` | Adicionar `prazoSelecao?: Date` à interface e mutation |
| `src/components/DeleteGalleryDialog.tsx` | Nenhuma mudança (já aceita trigger customizado) |

---

## Ordem de Implementação

1. **useSupabaseGalleries.ts** - Adicionar suporte a `prazoSelecao`
2. **GalleryEdit.tsx** - Corrigir bug do prazo + reorganizar layout
3. **GalleryCreate.tsx** - Adicionar funcionalidade de salvar rascunho
