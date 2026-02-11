

# Notificacoes no canto inferior direito

## Problema

O Sonner (toast) esta aparecendo no topo central da tela, cobrindo os itens do menu de navegacao.

## Solucao

Adicionar a prop `position="bottom-right"` no componente `Sonner` em `src/components/ui/sonner.tsx`.

## Arquivo

| Arquivo | Mudanca |
|---------|---------|
| `src/components/ui/sonner.tsx` | Adicionar `position="bottom-right"` ao componente `Sonner` |

## Detalhe tecnico

Linha 10 do arquivo, adicionar a prop:

```text
<Sonner
  position="bottom-right"
  theme={...}
  ...
/>
```

Isso move todas as notificacoes (toast) do app para o canto inferior direito, sem afetar nenhum outro comportamento.

