# Plano: Corrigir abertura do WhatsApp nos fluxos de compartilhamento

## Diagnóstico

O botão "WhatsApp" no modal de compartilhar galeria está abrindo o seletor de conversas do WhatsApp Web (tela "Enviar mensagem para") em vez de abrir a conversa direta do cliente. Investigando os três pontos que usam `wa.me`:

1. **`SendGalleryModal.tsx`** (modal "Compartilhar Galeria" — o do screenshot)
   - Código: `phone ? wa.me/55{phone}?text=... : wa.me/?text=...`
   - No screenshot do usuário, o cabeçalho mostra apenas "Até 01 de mai" e "Senha" — **não exibe o telefone**. Isso confirma que `gallery.clienteTelefone` está vazio/nulo para esse cliente, então cai no fallback `wa.me/?text=...`, que por design do WhatsApp abre o seletor de conversas.
   - Causa raiz: a galeria foi criada/vinculada sem o telefone do cliente (campo opcional em `clientes.telefone` / `galerias.cliente_telefone`).

2. **`ReactivateSuccessModal.tsx`** (modal de reativação)
   - Usa a mesma lógica — funciona corretamente quando o telefone existe, mas tem o mesmo fallback silencioso.

3. **`DeliverDetail.tsx`** (galerias Transfer/entrega)
   - `openWhatsApp` **sempre** usa `wa.me/?text=...`, ignorando completamente o telefone do cliente mesmo quando existe. Bug explícito.

Além disso, hoje o número é prefixado com `55` de forma cega. Se o cliente já tiver telefone salvo com DDI (ex.: colado como `+55 11 ...` e o sanitize deixar `5511...`), o resultado vira `555511...`, link inválido que também cai no seletor. Precisamos normalizar.

## O que vamos corrigir

### 1. `SendGalleryModal.tsx` — UX quando não há telefone
- Se `gallery.clienteTelefone` estiver vazio: em vez de abrir o seletor do WhatsApp silenciosamente, exibir um **toast informativo** ("Cliente sem telefone cadastrado. A mensagem será copiada e o WhatsApp abrirá para você escolher o contato.") e **copiar a mensagem automaticamente** para a área de transferência antes de abrir o `wa.me/?text=...`. Assim o usuário entende o porquê e já tem a mensagem pronta para colar.
- Adicionar indicador visual: quando não há telefone, mostrar um pequeno texto auxiliar abaixo do botão WhatsApp: "Sem telefone — escolha o contato".
- Quando há telefone: manter comportamento atual (abre conversa direta) e mostrar o número ao lado do botão (já existe esse padrão no `ReactivateSuccessModal`, aplicar aqui também — o screenshot mostra que hoje não aparece).

### 2. `ReactivateSuccessModal.tsx` — consistência
- Aplicar a mesma UX de fallback (toast + auto-copiar mensagem) para alinhar os dois modais.

### 3. `DeliverDetail.tsx` — bug de telefone ignorado
- Alterar `openWhatsApp` para usar `gallery.clienteTelefone` quando disponível, com a mesma regra de normalização dos outros fluxos.
- Aplicar o mesmo fallback com toast + auto-copiar.

### 4. Normalização do telefone (utilitário novo)
- Criar `src/lib/whatsappUrl.ts` com função `buildWhatsAppUrl(phone, message)` que:
  - Remove tudo que não é dígito.
  - Se começar com `55` e tiver 12 ou 13 dígitos: usa como está (já tem DDI).
  - Se tiver 10 ou 11 dígitos (formato BR sem DDI): prefixa `55`.
  - Caso contrário (formato inesperado): retorna `null` para cair no fallback controlado.
  - Retorna a URL `https://wa.me/{digits}?text={encoded}` pronta.
- Substituir as três ocorrências atuais por esta função centralizada.

### 5. Sugestão preventiva (opcional, baixo custo)
- Na tela de edição da galeria (`GalleryEdit.tsx`), adicionar um aviso discreto ao lado do campo Telefone: "Necessário para abrir conversa direta no WhatsApp." — ajuda o fotógrafo a entender que não preencher o campo leva ao comportamento de seletor.

## Arquivos afetados

- `src/lib/whatsappUrl.ts` (novo)
- `src/components/SendGalleryModal.tsx` (handleWhatsApp + exibição do telefone)
- `src/components/ReactivateSuccessModal.tsx` (handleWhatsApp)
- `src/pages/DeliverDetail.tsx` (openWhatsApp)
- `src/pages/GalleryEdit.tsx` (hint opcional no campo Telefone)

## Fora do escopo

- Nenhuma mudança em backend, edge functions, banco de dados ou integrações de pagamento.
- Nada relacionado a InfinitePay/Asaas/Mercado Pago.
- Nenhuma alteração na lógica de publicação (`prepare_gallery_share`).

## Resultado esperado

- Quando o cliente tiver telefone: clicar em "WhatsApp" abre **direto a conversa** com a mensagem preenchida.
- Quando não tiver telefone: o usuário recebe feedback claro, a mensagem é copiada automaticamente, e o WhatsApp abre no seletor — sem surpresa.
- Telefones já salvos com DDI não geram mais links quebrados.
