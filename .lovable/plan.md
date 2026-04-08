

# Fix: Substituir "checkout" por linguagem acessível ao cliente final

## Problema

O cliente final não entende "checkout". Termos técnicos como "Preparando checkout seguro", "Abrir checkout novamente" e "Abrir checkout" aparecem em 3 componentes voltados ao cliente.

## Alterações

### 1. `src/components/PaymentRedirect.tsx`

| Linha | Antes | Depois |
|---|---|---|
| 132 | `Preparando checkout seguro...` | `Preparando seu pagamento...` |

(O botão na linha 144 já diz "Ir para pagamento agora" — está OK.)

### 2. `src/components/PaymentPendingScreen.tsx`

| Linha | Antes | Depois |
|---|---|---|
| 204 | `Verificação automática a cada 30s` | `Verificação automática ativa` |
| 217 | `Abrir checkout novamente` | `Retomar pagamento` |
| 279 | `Abrir checkout` | `Retomar pagamento` |

### 3. Melhoria extra de UX sugerida

- **Mensagem de polling**: trocar `"Verificação automática a cada 30s (3)"` por `"Verificação automática ativa"` — o contador técnico `(3)` não significa nada para o cliente e gera ansiedade.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/PaymentRedirect.tsx` | 1 string |
| `src/components/PaymentPendingScreen.tsx` | 3 strings |

Nenhuma lógica alterada — apenas textos de interface.

