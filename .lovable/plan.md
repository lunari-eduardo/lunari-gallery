

# Plano: limpar a aba "Geral" e simplificar a "Marca d'Água"

## Mudança 1 — remover "Método de Pagamento Padrão" da aba Geral

**Por quê:** já existe a aba **Pagamentos** onde cada provedor configurado pode ser marcado como **Padrão** (chip "⭐ Padrão" visível na imagem 1). Ter um segundo seletor em "Geral" duplica a configuração e gera inconsistência (um valor pode dizer "InfinitePay" enquanto o `is_default=true` no banco aponta para outro).

**O que sai de `src/components/settings/GeneralSettings.tsx`:**
- bloco completo "Método de Pagamento Padrão" (linhas 330-393) — todo o card com `RadioGroup` de `defaultPaymentMethod`;
- import `CreditCard` do lucide-react (deixa de ser usado);
- import do tipo `PaymentMethod`.

**Backend / dados:** o campo `defaultPaymentMethod` continua em `GlobalSettings` e na tabela (`useGallerySettings`) por **compatibilidade** com galerias antigas, mas deixa de ser editável pela UI. A fonte da verdade do "padrão" passa a ser exclusivamente `usuarios_integracoes.is_default`. Não é necessária migração — galerias futuras vão pegar o `is_default` da aba Pagamentos.

## Mudança 2 — remover bloco "Modelo de Preços Padrão" duplicado da aba Geral

**Achado adicional na imagem 2:** o bloco "Modelo de Preços Padrão" (linhas 289-328 do `GeneralSettings`) está **idêntico** ao mesmo card que aparece marcado em vermelho na sua imagem. Verificando, esse bloco já é configurável **por galeria** no fluxo de criação. Mantê-lo aqui faz sentido como default global — então **mantenho**, exceto se você confirmar que também quer remover.

> *Atenção:* a sua imagem 2 marcou tanto "Modelo de Preços Padrão" quanto "Método de Pagamento Padrão". Estou removendo apenas o **Método de Pagamento** (que é o que tem a duplicação real com a aba Pagamentos). Se quiser remover também o "Modelo de Preços Padrão", confirme — basta uma linha extra de exclusão.

## Mudança 3 — simplificar bloco de Marca d'Água em "Personalização"

**Por quê:** a opção "**Apenas em tela cheia**" (preview limpo, marca aparece ao ampliar) **não é funcional**. Confirmei no código:
- a marca d'água é **burn-in**: aplicada no Canvas durante o upload (`uploadPipeline.ts`) e gravada na imagem do R2;
- não existe nenhuma lógica em runtime que diferencie `watermarkDisplay === 'fullscreen'` de `'all'` — o valor é apenas persistido em `configuracoes` da galeria, mas nenhuma view o consulta para esconder/mostrar a marca;
- portanto, hoje "Apenas em tela cheia" se comporta exatamente igual a "Em todas as fotos", e "Nunca" só funciona quando o **modo de proteção** já é "Nenhuma" (que controla o burn-in real).

**Conclusão:** o bloco "Exibição Padrão da Marca d'Água" é redundante — quem decide se há ou não marca é o bloco superior ("Tipo de proteção": Padrão / Minha Marca / Nenhuma). O bloco inferior só confunde o fotógrafo prometendo um comportamento que o sistema não entrega.

**O que sai de `src/components/settings/PersonalizationSettings.tsx`:**
- card completo "Exibição Padrão da Marca d'Água" (linhas 92-126);
- import `WatermarkDisplay` do `@/types/gallery` (deixa de ser usado neste arquivo).

**Mantém:** o card superior "Proteção de Imagem" (`WatermarkSettings.tsx`) inteiro — Padrão do Sistema / Minha Marca / Nenhuma + slider de opacidade. É o único controle real.

**Backend / dados:** o campo `defaultWatermarkDisplay` permanece no schema e em `GlobalSettings` por compatibilidade, mas deixa de ser editável. Galerias novas usarão o default `'all'` (do `mockData`/`useGallerySettings`), que combinado com o modo de proteção dá o comportamento correto.

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `src/components/settings/GeneralSettings.tsx` | remover bloco "Método de Pagamento Padrão" (linhas 330-393); limpar imports `CreditCard` e `PaymentMethod` não utilizados |
| `src/components/settings/PersonalizationSettings.tsx` | remover card "Exibição Padrão da Marca d'Água" (linhas 92-126); limpar import `WatermarkDisplay` |
| Sem alteração em | `useGallerySettings.ts`, `useWatermarkSettings.ts`, `WatermarkSettings.tsx` (card superior fica intacto), `types/gallery.ts` (`WatermarkDisplay` e `defaultPaymentMethod` preservados para retrocompat), `GalleryCreate`/`GalleryEdit` (continuam respeitando defaults persistidos), webhooks, edge functions, RLS, fluxos de pagamento, integração Gestão, RPC `prepare_gallery_share` |
| Migração SQL | nenhuma — campos antigos permanecem no banco e seguem funcionando para galerias já criadas |

## Validação

1. abrir **Configurações → Geral**: lista contém apenas Estúdio, Permissão, Prazo, Modo de Venda, Tamanho de Imagens, Tipo de Cobrança, Modelo de Preços (sem mais Método de Pagamento);
2. abrir **Configurações → Pagamentos**: o chip "⭐ Padrão" continua sendo a única forma de definir o provedor padrão;
3. criar nova galeria → o método de pagamento pré-selecionado vem do `is_default` da aba Pagamentos (comportamento já existente em `usePaymentIntegration`);
4. abrir **Configurações → Personalização**: bloco superior "Proteção de Imagem" continua; bloco "Exibição Padrão da Marca d'Água" desaparece;
5. criar nova galeria → marca d'água respeita o modo de proteção configurado (Padrão/Minha Marca/Nenhuma) — comportamento idêntico ao de hoje;
6. galerias antigas com `defaultPaymentMethod` ou `defaultWatermarkDisplay` salvos: continuam funcionando, valores não são apagados;
7. `npm run build` sem erros TS.

## Resultado esperado

- aba **Geral** focada apenas em defaults sem duplicação;
- método de pagamento padrão tem **uma única fonte de verdade**: a aba Pagamentos;
- marca d'água tem **um único bloco** de configuração honesto, sem prometer "preview limpo / marca em tela cheia" que o sistema não entrega;
- nenhum impacto em pagamentos, webhooks, integração Gestão, créditos, ou no fluxo de upload com burn-in.

