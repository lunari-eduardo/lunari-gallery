

# Plano: Simplificação do Fluxo de Criação e Seleção de Galerias

## Resumo das Alterações

Este plano implementa 5 melhorias para reduzir etapas desnecessárias e melhorar a experiência do cliente:

1. **Publicação automática** ao criar galeria
2. **Unificar telas de revisão + checkout** do cliente
3. **Botão "Confirmar pagamento"** para PIX Manual (cliente)
4. **Tela de fotos confirmadas** após pagamento
5. **Bloqueio da galeria** após finalização

---

## 1. Publicação Automática da Galeria

### Problema Atual
- Galeria é criada com status `rascunho`
- Fotógrafo precisa clicar em "Enviar para Cliente"
- Modal mostra "Galeria não publicada" e exige clique em "Publicar Galeria"

### Solução
Ao finalizar a criação (Step 5), chamar automaticamente a função `sendGallery` antes de redirecionar para o detalhe.

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GalleryCreate.tsx` | Após `updateGallery`, chamar `sendSupabaseGallery` automaticamente |
| `src/components/SendGalleryModal.tsx` | Remover lógica de publicação; sempre mostrar conteúdo de compartilhamento |

### Detalhes Técnicos

**GalleryCreate.tsx (handleNext, Step 5):**
```typescript
// Após updateGallery bem-sucedido:
await sendSupabaseGallery(supabaseGalleryId);

// Navegar para detalhe
navigate(`/gallery/${supabaseGalleryId}`);
```

**SendGalleryModal.tsx:**
- Remover seção `needsToSend` que mostra "Galeria não publicada"
- Sempre exibir opções de compartilhamento (link, mensagem, WhatsApp)

---

## 2. Unificar Telas de Revisão + Checkout

### Problema Atual
O cliente passa por 3 cliques para confirmar:
1. Galeria → Clica "Confirmar"
2. Tela de Revisão → Clica "Continuar para Confirmação"
3. Tela de Checkout → Clica "Confirmar e Pagar"

### Solução
Criar componente único `SelectionConfirmation` que combina:
- Grid de fotos selecionadas (scrollável)
- Resumo de valores e informações
- Botão único de confirmação

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/SelectionReview.tsx` | Remover (será unificado) |
| `src/components/SelectionCheckout.tsx` | Substituir por `SelectionConfirmation.tsx` |
| `src/components/SelectionConfirmation.tsx` | CRIAR - componente unificado |
| `src/pages/ClientGallery.tsx` | Alterar fluxo para pular step `review` |

### Layout do Novo Componente

```text
┌─────────────────────────────────────────┐
│ Header: "Confirmar Seleção"             │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Fotos Selecionadas (scrollável) │    │
│  │ Grid 4-6 colunas com thumbnails │    │
│  │ "Você selecionou X fotos"       │    │
│  │ "Y incluídas • Z extras"        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Resumo da Seleção               │    │
│  │ • Cliente: Nome                 │    │
│  │ • Sessão: Nome                  │    │
│  │ • Fotos incluídas: X            │    │
│  │ • Fotos extras: Y               │    │
│  │ • Valor por foto: R$ Z          │    │
│  ├─────────────────────────────────┤    │
│  │ Valor Adicional: R$ XX.XX       │    │
│  │ (economizou R$ Y.YY)            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ⚠️ Após confirmar, não poderá         │
│     alterar sua seleção                 │
│                                         │
├─────────────────────────────────────────┤
│ [← Voltar]     [✓ Confirmar e Pagar]    │
└─────────────────────────────────────────┘
```

### Fluxo Simplificado

```text
ANTES:
Gallery → Review → Checkout → Payment/Confirmed

DEPOIS:
Gallery → Confirmation → Payment/Confirmed
```

---

## 3. Botão "Confirmar Pagamento" para PIX Manual

### Problema Atual
- Cliente vê tela de PIX com QR Code
- Após pagar, não tem como informar que pagou
- Fica apenas "Aguardando confirmação"

### Solução
Adicionar botão "Já realizei o pagamento" na tela de PIX que:
- Navega cliente para tela de fotos confirmadas
- Mantém status `aguardando_confirmacao` (fotógrafo ainda confirma)
- Exibe mensagem clara sobre aguardar liberação

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/PixPaymentScreen.tsx` | Adicionar botão "Já realizei o pagamento" |
| `src/pages/ClientGallery.tsx` | Passar callback `onPaymentConfirmed` |

### Detalhes Técnicos

**PixPaymentScreen.tsx:**
```typescript
interface PixPaymentScreenProps {
  // ... props existentes
  onPaymentConfirmed?: () => void;  // NOVO
}

// Novo botão após aviso:
<Button 
  variant="terracotta"
  onClick={onPaymentConfirmed}
  className="w-full"
>
  <CheckCircle className="h-4 w-4 mr-2" />
  Já realizei o pagamento
</Button>
```

---

## 4. Tela de Fotos Confirmadas Após Pagamento

### Problema Atual
- Após checkout externo (InfinitePay), não há retorno claro
- PIX Manual fica em loop na tela de pagamento

### Solução
Redirecionar para step `confirmed` após:
- Cliente clicar "Já realizei o pagamento" (PIX Manual)
- Retorno de checkout externo (via URL params)

A tela `confirmed` já existe e mostra:
- Banner de sucesso
- Grid read-only das fotos selecionadas
- Mensagem sobre aguardar liberação (se PIX pendente)

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ClientGallery.tsx` | Adicionar lógica para PIX → confirmed |
| `src/pages/ClientGallery.tsx` | Mostrar aviso de pagamento pendente se `aguardando_confirmacao` |

### Detalhes Técnicos

**ClientGallery.tsx (step confirmed com pagamento pendente):**
```typescript
// Se status_pagamento === 'aguardando_confirmacao', mostrar banner:
<div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
  <Clock className="h-5 w-5 text-warning" />
  <p>Aguardando confirmação do pagamento</p>
  <p className="text-sm text-muted-foreground">
    O fotógrafo irá confirmar o recebimento e liberar suas fotos.
  </p>
</div>
```

---

## 5. Bloqueio da Galeria Após Finalização

### Problema Atual
- Após confirmar seleção, cliente ainda pode acessar galeria
- Não há bloqueio visual/funcional

### Solução
Quando galeria estiver finalizada (`finalized_at` ou `status_selecao === 'confirmado'`):
- Mostrar APENAS as fotos selecionadas (step `confirmed`)
- Não permitir navegação para step `gallery`
- Exibir mensagem para contatar fotógrafo se precisar alterar

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ClientGallery.tsx` | Redirecionar para `confirmed` se galeria finalizada |
| `src/pages/ClientGallery.tsx` | Remover link "Voltar para a galeria" no step confirmed |

### Detalhes Técnicos

**ClientGallery.tsx (useEffect inicial):**
```typescript
useEffect(() => {
  if (photos.length > 0) {
    setLocalPhotos(photos);
    
    // Se galeria já finalizada, ir direto para confirmed
    const isFinalized = supabaseGallery?.status_selecao === 'confirmado' 
                     || supabaseGallery?.finalized_at;
    
    if (isFinalized) {
      setIsConfirmed(true);
      setCurrentStep('confirmed');
      setShowWelcome(false); // Pular welcome também
    }
  }
}, [photos, supabaseGallery]);
```

---

## Resumo dos Arquivos

| # | Arquivo | Tipo | Descrição |
|---|---------|------|-----------|
| 1 | `src/pages/GalleryCreate.tsx` | Modificar | Auto-publicar galeria no Step 5 |
| 2 | `src/components/SendGalleryModal.tsx` | Modificar | Remover seção "não publicada" |
| 3 | `src/components/SelectionReview.tsx` | Remover | Componente não mais necessário |
| 4 | `src/components/SelectionConfirmation.tsx` | Criar | Componente unificado Review + Checkout |
| 5 | `src/components/SelectionCheckout.tsx` | Remover | Substituído por SelectionConfirmation |
| 6 | `src/components/PixPaymentScreen.tsx` | Modificar | Adicionar botão "Já paguei" |
| 7 | `src/pages/ClientGallery.tsx` | Modificar | Simplificar fluxo e bloquear após finalização |

---

## Fluxo Final

```text
FOTÓGRAFO:
  GalleryCreate (5 steps)
       │
       ▼
  Galeria criada e publicada automaticamente
       │
       ▼
  "Enviar para Cliente" → Abre modal de compartilhamento direto

CLIENTE:
  Link → Senha (se privada) → Welcome → Galeria
       │
       ▼
  Seleciona fotos → Clica "Confirmar"
       │
       ▼
  Tela unificada (fotos + resumo + valores)
       │
       ▼
  Clica "Confirmar e Pagar"
       │
       ├─► Checkout externo → Retorna → Tela Confirmada
       │
       ├─► PIX Manual → Clica "Já paguei" → Tela Confirmada
       │                                    (com aviso de aguardando)
       │
       └─► Sem pagamento → Tela Confirmada
       
  Acessos futuros → Vai direto para Tela Confirmada (bloqueado)
```

