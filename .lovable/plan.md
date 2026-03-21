

# Redesign: Tela de Confirmação + Remoção de Tela de Redirect + Capa sem Watermark

## 3 problemas a resolver

### 1. SelectionConfirmation.tsx — visual pesado e redundante

**Estado atual**: 4 cards empilhados (Fotos Selecionadas, Resumo, Pagamento, Atenção), cada um com fundo, borda, sombra, ícones em círculos coloridos. Informação duplicada entre o primeiro card e o resumo.

**Novo layout**: coluna única sem cards, apenas tipografia e linhas finas.

```text
[Header: Voltar | Confirmar Seleção]

Sua seleção
─────────────────────────────
Selecionadas          7
Incluídas             5
Extras                2
Valor por foto        R$ 5,00
─────────────────────────────
Total adicional       R$ 10,00

Pagamento online após confirmar.

Não será possível alterar após confirmar.

[═══ Confirmar e Pagar ═══]
```

- Remover card "Fotos Selecionadas" (redundante)
- Remover card "Resumo da Seleção" com header/ícone Camera
- Remover info de Cliente/Sessão/Pacote (o cliente já sabe quem é)
- Remover data (desnecessária)
- Unificar tudo em bloco de texto com separadores `border-t`
- Aviso de atenção: frase curta inline, sem card
- Aviso de pagamento: frase curta inline, sem card

### 2. Eliminar tela intermediária de redirecionamento

**Estado atual**: Após confirmar, vai para `PaymentRedirect` com countdown de 3s, botão "Ir para pagamento agora", botão "Cancelar", texto de segurança.

**Novo comportamento**:
- Em `ClientGallery.tsx` (linhas 515-526): quando `data.requiresPayment && data.checkoutUrl`, redirecionar **imediatamente** com `window.location.href`
- Remover o toast "Seleção confirmada! Redirecionando..."
- Se o redirect demorar mais de 1s, mostrar um **overlay leve** sobre a tela atual: "Preparando pagamento..." com spinner
- Não renderizar mais o componente `PaymentRedirect` para checkouts externos

**Nota**: Manter `PaymentRedirect` como fallback para URLs inválidas (erro), mas nunca como tela intermediária normal.

### 3. Capa do album sem watermark para fotos existentes

**Problema**: O sistema de `cover_path` foi implementado na mensagem anterior, mas só funciona para **novas fotos**. Fotos já existentes não têm `cover_path`, então o fallback usa `thumbnailUrl` (com watermark).

**Solução prática**: Na tela de álbuns, quando `coverUrl` é null (sem cover_path), usar a URL da **preview** em vez do thumbnail. A preview tem watermark mais discreto e qualidade melhor para capa. Isso é um fallback visual imediato sem precisar reprocessar fotos.

Alternativamente, o fotógrafo pode re-enviar as fotos para gerar covers. Mas o fallback para preview é melhor que thumbnail com watermark pesado.

**Mudança**: Linha 1653 — fallback de `thumb.thumbnailUrl` para `thumb.previewUrl || thumb.thumbnailUrl`.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/SelectionConfirmation.tsx` | Redesign completo: layout flat, sem cards, tipografia + linhas finas |
| `src/pages/ClientGallery.tsx` | Redirect imediato sem tela intermediária (L515-526); remover toast; fallback overlay; cover fallback para previewUrl (L1653) |

