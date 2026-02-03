
# Plano: Corrigir Tela Branca e Adicionar Link no Nome do Cliente

## Problema Identificado

### Causa do Erro
O componente `StatusBadge` falha ao renderizar porque:
- O banco de dados armazena status em português: `enviado`, `selecao_iniciada`
- O código TypeScript espera status em inglês: `sent`, `selection_started`
- Quando o status não existe no `galleryStatusConfig`, retorna `undefined`
- Acessar `config.icon` de `undefined` causa o erro: `Cannot read properties of undefined (reading 'icon')`

```text
Fluxo do erro:
1. ClientProfile carrega galerias do banco
2. StatusBadge recebe status="enviado" 
3. galleryStatusConfig["enviado"] → undefined
4. config.icon → TypeError!
```

---

## Alterações Necessárias

### 1. Corrigir StatusBadge.tsx

Adicionar mapeamento para os status em português que existem no banco de dados:

| Status no Banco | Status Esperado | Precisa Adicionar |
|-----------------|-----------------|-------------------|
| `enviado` | `sent` | Sim |
| `selecao_iniciada` | `selection_started` | Sim |
| `selecao_concluida` | `selection_completed` | Sim |
| `rascunho` | `created` | Sim |
| `expirado` | `expired` | Sim |
| `cancelado` | `cancelled` | Sim |

**Solução**: Criar um objeto de mapeamento para traduzir os valores portugueses para inglês antes de buscar no config, ou adicionar os valores portugueses diretamente no config.

```typescript
// Opção 1: Mapeamento de tradução
const statusTranslation: Record<string, GalleryStatus> = {
  'enviado': 'sent',
  'selecao_iniciada': 'selection_started',
  'selecao_concluida': 'selection_completed',
  'rascunho': 'created',
  'expirado': 'expired',
  'cancelado': 'cancelled',
  // Valores em inglês mapeiam para si mesmos
  'sent': 'sent',
  'created': 'created',
  // ...
};

// Ou Opção 2: Adicionar valores em português ao config
const galleryStatusConfig = {
  // Inglês (existente)
  created: { label: 'Criada', ... },
  sent: { label: 'Enviada', ... },
  // Português (adicionar)
  enviado: { label: 'Enviada', ... },
  selecao_iniciada: { label: 'Em seleção', ... },
  // ...
};
```

**Solução adicional**: Garantir que o componente não quebre mesmo com status desconhecido (fallback):

```typescript
const config = type === 'gallery' 
  ? galleryStatusConfig[normalizedStatus] || defaultConfig
  : selectionStatusConfig[normalizedStatus] || defaultConfig;
```

### 2. Adicionar Link Clicável no Nome do Cliente (Clients.tsx)

Na tabela de clientes, tornar o nome clicável para navegar ao perfil:

```tsx
// ANTES
<p className="font-medium">{client.name}</p>

// DEPOIS
<p 
  className="font-medium text-primary hover:underline cursor-pointer"
  onClick={() => navigate(`/clients/${client.id}`)}
>
  {client.name}
</p>
```

Opcionalmente, adicionar um botão visual "Ver perfil" ou ícone ao lado do nome.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/StatusBadge.tsx` | Adicionar mapeamento de status em português e fallback seguro |
| `src/pages/Clients.tsx` | Tornar nome do cliente clicável para navegar ao perfil |

---

## Resultado Esperado

1. **Tela de perfil do cliente carrega corretamente** - Status das galerias exibidos sem erro
2. **Nome do cliente é clicável** - Permite navegação rápida ao perfil sem usar o menu dropdown
3. **Fallback seguro** - Mesmo status desconhecidos não causam crash na aplicação
