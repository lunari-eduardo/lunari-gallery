
# Remover Lembranca + Redesign Welcome Modal + Toggle de Boas-Vindas para Entrega

## 1. Remover modulo Lembranca do frontend de entrega

**Arquivo: `src/pages/ClientDeliverGallery.tsx`**
- Remover imports: `DeliverMemorySection`, `MemoryCreator`
- Remover estado `showMemoryCreator`
- Remover o bloco `<DeliverMemorySection>` do JSX (linhas 182-188)
- Remover o bloco `<MemoryCreator>` condicional (linhas 191-207)

Os arquivos em `src/components/deliver/memory/` continuam existindo no projeto (sem deletar), apenas nao sao mais referenciados.

---

## 2. Redesign do Welcome Modal (experiencia premium)

**Arquivo: `src/components/deliver/DeliverWelcomeModal.tsx`** -- reescrever completamente

Novo design:
- Substituir `Dialog`/`DialogContent` por um overlay fullscreen customizado (`position: fixed inset-0`)
- Fundo: `backdrop-filter: blur(20px)` com overlay escuro semi-transparente
- Card central: bordas retas (sem rounded), sem borda/contorno visivel, fundo translucido com `backdrop-blur` (`bg-black/40 backdrop-blur-xl` no dark, `bg-white/40 backdrop-blur-xl` no light)
- Texto da mensagem com tipografia elegante, tamanho `text-lg`, `leading-relaxed`
- Botao "Ver minhas fotos" em vez de "Continuar" -- estilo minimalista (sem bg pesado, texto com underline sutil ou botao ghost elegante)
- Sem botao X de fechar (o unico CTA e "Ver minhas fotos")

Ao fechar (clicar "Ver minhas fotos"):
- Animar saida do desfoque: `transition-all duration-[2000ms]` no overlay
- Usar estado intermediario `closing` que aplica `backdrop-filter: blur(0px)` e `opacity: 0` com transicao de 2s
- Apos 2s, chamar `onClose()` de fato

Novas props necessarias: `isDark` (para adaptar cores do card)

**Arquivo: `src/pages/ClientDeliverGallery.tsx`**
- Passar `isDark` para o `DeliverWelcomeModal`

---

## 3. Toggle para desabilitar mensagem de boas-vindas na entrega

**Arquivo: `src/pages/DeliverCreate.tsx`** (Passo 3 -- Mensagem)
- Adicionar `Switch` para ativar/desativar a mensagem de boas-vindas (similar ao que ja existe em `GalleryCreate.tsx`)
- Estado: `welcomeMessageEnabled` (boolean, default baseado nas configuracoes globais)
- Quando desativado: limpar `welcomeMessage` e esconder textarea
- Quando ativado: restaurar template global (se existir)
- **Texto nao pre-preenchido**: na inicializacao, nao preencher com template global. O textarea comeca vazio, e o usuario escreve se quiser. Remover o `useEffect` das linhas 80-87 que faz o pre-fill automatico.

**Arquivo: `src/pages/DeliverDetail.tsx`** (aba Detalhes)
- Adicionar campo para editar/desabilitar a mensagem de boas-vindas no bloco de configuracoes (Block 2), com Switch + Textarea condicional

---

## 4. Detalhes tecnicos

### Animacao de saida do blur (DeliverWelcomeModal)

```text
Estado: 'visible' | 'closing' | 'closed'

visible:
  overlay: opacity-100, backdrop-blur-xl
  card: opacity-100, scale-100

closing (apos clicar "Ver minhas fotos"):
  overlay: opacity-0, backdrop-blur-0 (transition 2s ease-out)
  card: opacity-0, translate-y-4 (transition 0.6s)

closed (apos 2s): chamar onClose(), remover do DOM
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/ClientDeliverGallery.tsx` | Remover Lembranca (imports, estado, JSX). Passar isDark ao WelcomeModal |
| `src/components/deliver/DeliverWelcomeModal.tsx` | Reescrever: overlay fullscreen com blur, card translucido sem bordas, botao "Ver minhas fotos", animacao de saida 2s |
| `src/pages/DeliverCreate.tsx` | Adicionar Switch para ativar/desativar mensagem. Remover pre-fill automatico do template global |
| `src/pages/DeliverDetail.tsx` | Adicionar edicao de mensagem de boas-vindas com Switch na aba Detalhes |
