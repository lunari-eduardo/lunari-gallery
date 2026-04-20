

# Plano: Remoção sistêmica de toasts de sucesso/informativos (mantendo erros)

## Diagnóstico

Mapeei **todos** os toasts do sistema:

- **96 toasts informativos** (`toast.success`, `toast.info`, `toast.loading`) em ~40 arquivos.
- **~70 toasts de erro** (`toast.error` e `toast({ variant: 'destructive' })`) — **manter intactos**.
- O `<Toaster />` (sonner) continua montado no app — apenas paramos de chamá-lo para sucesso/info.

## Regra única

**Remover** todas as chamadas `toast.success(...)`, `toast.info(...)`, `toast.loading(...)` e `toast({ ... })` informativos (sem `variant: 'destructive'`).
**Manter** todas as chamadas `toast.error(...)` e `toast({ variant: 'destructive' })`.

Quando a remoção deixa um bloco vazio (`try { toast.success(...) }` sem mais nada), eliminar o bloco inteiro mantendo apenas o `console.log` ou efeito útil.

## Arquivos e ações

### Hooks (lógica compartilhada — alto impacto)
| Arquivo | Toasts a remover |
|---|---|
| `src/hooks/useSupabaseGalleries.ts` | "Galeria excluída", "Seleção confirmada!", "Seleção reaberta!", "Foto excluída" |
| `src/hooks/useGalleryFolders.ts` | "Pasta excluída...", "Capa da pasta atualizada" |
| `src/hooks/useGallerySettings.ts` | "Tema salvo com sucesso!", "Tema removido..." |
| `src/hooks/usePaymentIntegration.ts` | 10 sucessos (PIX configurado, InfinitePay configurado, Asaas configurado, MP conectado, configs migradas etc.) |
| `src/hooks/useAsaasSubscription.ts` | "Upgrade realizado", "Assinatura cancelada", "Downgrade agendado", "Downgrade cancelado", "Assinatura reativada" |
| `src/hooks/useWatermarkSettings.ts` | "Configurações de marca d'água salvas", "Marca d'água personalizada removida" |

### Componentes do painel do fotógrafo
| Arquivo | Toasts a remover |
|---|---|
| `src/components/deliver/DeliverPhotoManager.tsx` | "Foto excluída", "Foto definida como capa", "Capa removida" |
| `src/components/PhotoUploader.tsx` | "X foto(s) enviada(s) com sucesso!", "X arquivos com erro. Tentando novamente..." |
| `src/components/PaymentStatusCard.tsx` | "Recebimento registrado!", "Link de cobrança gerado!", "Link copiado!" |
| `src/components/PhotoCodesModal.tsx` | "Código copiado!" |
| `src/components/SendGalleryModal.tsx` | "Mensagem copiada!", "Link copiado!" |
| `src/components/ReactivateGalleryDialog.tsx` | "Link copiado!" |
| `src/components/settings/LogoUploader.tsx` | "Logo atualizado!" |
| `src/components/admin/UserCreditsManager.tsx` | "X créditos adicionados com sucesso!" |

### Componentes de pagamento (manter erros, remover sucessos)
| Arquivo | Toasts a remover |
|---|---|
| `src/components/AsaasCheckout.tsx` | "Pagamento confirmado!", "Código PIX copiado!", "Pagamento aprovado!", "Processando pagamento...", "Pagamento enviado! Aguardando confirmação." (todas as variantes) |
| `src/components/PixPaymentScreen.tsx` | "Código PIX copiado!" |
| `src/components/credits/CreditCheckoutModal.tsx` | "Pagamento aprovado! Créditos adicionados.", "Pagamento confirmado! Créditos adicionados." |
| `src/components/credits/PixPaymentDisplay.tsx` | "Código PIX copiado!", "Pagamento ainda não confirmado" (info) |
| `src/components/DownloadModal.tsx` | "Download concluído!" |
| `src/components/FinalizedPreviewScreen.tsx` | "Download concluído!" |
| `src/components/Lightbox.tsx` | "Download iniciado!" |

### Auth (manter erros — login falhou, etc.)
| Arquivo | Toasts a remover |
|---|---|
| `src/components/auth/SignupForm.tsx` | "Email de confirmação enviado!", "Conta criada com sucesso!" |
| `src/components/auth/ResetPasswordForm.tsx` | "Email de recuperação enviado!" |
| `src/components/auth/UpdatePasswordForm.tsx` | "Senha atualizada com sucesso!" |
| `src/pages/Auth.tsx` | "Email alterado com sucesso!" |
| `src/components/account/ChangeEmailForm.tsx` | "Email de confirmação enviado" (toast legado sem variant); manter os 2 com `variant: 'destructive'` |

### Páginas
| Arquivo | Toasts a remover |
|---|---|
| `src/pages/GalleryDetail.tsx` | "Pagamento confirmado!", "Galeria enviada!" |
| `src/pages/GalleryEdit.tsx` | "Cliente criado!", "Galeria reativada!", "Senha copiada!", "Template aplicado" |
| `src/pages/GalleryCreate.tsx` | "Predefinição carregada", "Foto excluída e crédito devolvido", "X fotos excluídas e créditos devolvidos", "Carregando configurações..." (loading), "Galeria criada e publicada!", "Rascunho salvo!" (2x), "Cliente cadastrado", "Predefinição salva" |
| `src/pages/DeliverCreate.tsx` | "Galeria de entrega publicada!" |
| `src/pages/DeliverDetail.tsx` | "Entrega publicada!", "Capa atualizada/removida", "Link copiado!" |
| `src/pages/CreditsPayment.tsx` | "Pagamento confirmado! Créditos adicionados." (2x), "Upgrade realizado", "Assinatura anual ativada", "Plano ativado", "Assinatura ativada" |
| `src/pages/CreditsCheckout.tsx` | 2x `toast.info('Em breve!')` — substituir botões por `disabled` em vez do toast |
| `src/pages/Clients.tsx` | "Cliente atualizado", "Cliente cadastrado", "Nova senha enviada para X" |
| `src/pages/ClientProfile.tsx` | "Cliente atualizado com sucesso!" |
| `src/pages/Settings.tsx` | "Configurações salvas!" |
| `src/pages/Referrals.tsx` | "Link copiado!" |

### Lado do cliente (galeria pública) — também remover
| Arquivo | Toasts a remover |
|---|---|
| `src/pages/ClientGallery.tsx` | "Seleção confirmada!" (3 variantes), "Pagamento informado com sucesso!" (2x), "Comentário salvo!" |
| `src/pages/ClientDeliverGallery.tsx` | "X fotos baixadas!" |

## Considerações técnicas

1. **Imports**: onde após a remoção o import `toast`/`useToast` ficar sem uso, removo o import. Se ainda houver `toast.error`, mantenho.
2. **`toast.loading` em `GalleryCreate.tsx`** (`'Carregando configurações de preços...'`): remover. Se ele tinha `id` reutilizado para `toast.success` posterior com mesmo id, removo ambos.
3. **Blocos `try`/`then` que só faziam o toast**: deletar a linha; manter o restante do efeito (refetch, navigate, setState) intacto.
4. **Sem novos componentes nem novo tipo de feedback** — usuário já tem feedback visual em cada fluxo (redirect, badge, estado disabled, atualização da lista).
5. **`<Toaster />` permanece montado** — usado pelos `toast.error` que ficam.

## Resultado

- 96 chamadas removidas, 0 toast informativo restante em todo o sistema.
- ~70 toasts de erro mantidos para feedback de falha (login, pagamento, upload, RLS).
- Nenhuma regressão funcional: navegações, atualizações de lista e estados visuais permanecem.
- Interface mais limpa, sem pop-ups de confirmação cosmética em nenhuma jornada (fotógrafo ou cliente).

