# Plano: Bloquear edição de parâmetros de cobrança em galerias concluídas

## Objetivo

Impedir edição dos campos que afetam a cobrança quando a galeria está **concluída** (seleção finalizada). A edição continua liberada quando a galeria está **em seleção** ou foi **reativada** — fluxos onde já funciona corretamente.

## Definição de "concluída" (locked)

Considera-se a galeria travada quando:
- `status_selecao = 'selecao_completa'`, OU
- `finalized_at IS NOT NULL`

Ao reativar, ambos voltam ao estado inicial (`em_andamento` / `null`), então o lock cai automaticamente. Sem necessidade de lógica extra.

## Campos travados quando concluída

Apenas os parâmetros que mudam o cálculo de extras/cobrança:

| Campo | Coluna |
|---|---|
| Fotos Incluídas | `fotos_incluidas` |
| Valor Foto Extra | `valor_foto_extra` |
| Pacote (autofill) | preenche os dois acima |
| Template de Desconto | `regras_congeladas` |

Todos os outros campos (nome, cliente, e-mail, telefone, senha, prazo, tema, mensagem, configurações de venda visuais) **continuam editáveis** — não afetam histórico de cobrança.

## Alterações

### `src/pages/GalleryEdit.tsx`

1. Calcular `const isLocked = gallery.statusSelecao === 'selecao_completa' || gallery.finalizedAt != null`.
2. Quando `isLocked`:
   - Inputs **Fotos Incluídas** e **Valor Foto Extra** → `disabled` (já existe estilo `disabled:opacity-50` no componente `Input`).
   - `PackageSelect` → passar `disabled={isLocked}` (prop já existe).
   - `Select` de Template de Desconto → `disabled`.
   - Renderizar um **callout glass** acima do bloco "Informações da Galeria":
     > 🔒 **Galeria concluída** — Os parâmetros de cobrança (fotos incluídas, valor extra, pacote e desconto) estão bloqueados para preservar o histórico de pagamentos. Para alterá-los, **reative a seleção** usando o botão "Reativar" na tela da galeria.
3. No `handleSave`, guard final: se `isLocked`, não enviar `fotosIncluidas`, `valorFotoExtra` nem mexer em `regras_congeladas` no payload — usa os valores originais de `gallery`.

## Fora do escopo

- Sem mudanças no banco (sem trigger de bloqueio — confiamos na UI já que a edição via fluxo legítimo passa pela reativação).
- Sem mudanças em edge functions, RPCs ou webhooks de pagamento.
- Sem alterações no `ReactivateGalleryDialog` (já cumpre o papel de reabrir e liberar edição).

## Arquivos afetados

- `src/pages/GalleryEdit.tsx` (único arquivo)

## Resultado

- Galeria **em seleção** ou **reativada**: edição funciona como hoje.
- Galeria **concluída**: campos de cobrança aparecem desabilitados com explicação clara orientando a reativação como caminho correto.
