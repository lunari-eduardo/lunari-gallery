
# Plano de Correção: Fotos Incluídas no Pacote não Puxando do Gestão

## Diagnóstico Completo

### Problema Identificado

Quando uma galeria é criada através do link do Gestão (modo assistido), o campo "Fotos Incluídas no Pacote" não está sendo preenchido com o valor correto que vem das **regras congeladas** (`regrasCongeladas.pacote.fotosIncluidas`).

### Causa Raiz

Existem **dois useEffects separados** com problema de **timing e falta de sincronização**:

```text
useEffect 1 (linhas 163-209)     useEffect 2 (linhas 213-309)
─────────────────────────────    ─────────────────────────────
Busca regrasCongeladas           Preenche campos do formulário
do banco de dados                (sessionName, packageName, etc.)
         │                                  │
         ▼                                  ▼
setRegrasCongeladas()            setIncludedPhotos() ← PROBLEMA!
setFixedPrice() ✓                           │
         │                                  │
         ▼                                  ▼
regrasLoaded = true              Usa apenas:
                                 - URL param (se existir)
                                 - Lookup no gestaoPackages
                                 
                                 NÃO USA regrasCongeladas!
```

**Problemas específicos:**

1. O useEffect 2 **não espera** `regrasLoaded` antes de processar
2. O useEffect 2 **não tem** `regrasCongeladas` nas dependências
3. O useEffect 2 **ignora** `regrasCongeladas.pacote.fotosIncluidas`

### Evidência no Banco de Dados

As regras congeladas contêm o valor correto:
```json
{
  "pacote": {
    "fotosIncluidas": 30,  // ← Valor correto que deveria ser usado
    "valorFotoExtra": 25,
    "nome": "Marca Essencial 30f"
  }
}
```

Mas o formulário mostra o valor padrão (30 hardcoded) ou outro valor incorreto.

## Solução Proposta

### Mudança Principal

Adicionar um **terceiro useEffect** dedicado para sincronizar `includedPhotos` com `regrasCongeladas` quando as regras são carregadas:

```typescript
// NOVO: Sincronizar includedPhotos e outros campos com regrasCongeladas
useEffect(() => {
  // Só executa quando regras são carregadas e há session_id
  if (!regrasLoaded || !regrasCongeladas || !gestaoParams?.session_id) return;
  
  // regrasCongeladas é a fonte de verdade para dados do pacote
  const { pacote } = regrasCongeladas;
  
  // Atualizar fotos incluídas (sempre do regras, pois é o valor congelado)
  if (pacote?.fotosIncluidas !== undefined && pacote.fotosIncluidas > 0) {
    console.log('🔗 Setting includedPhotos from regrasCongeladas:', pacote.fotosIncluidas);
    setIncludedPhotos(pacote.fotosIncluidas);
  }
  
  // Atualizar nome do pacote se disponível
  if (pacote?.nome && !packageName) {
    setPackageName(pacote.nome);
  }
  
  // Atualizar categoria/sessão se disponível
  if (pacote?.categoria && !sessionName) {
    setSessionName(pacote.categoria);
  }
  
}, [regrasLoaded, regrasCongeladas, gestaoParams?.session_id]);
```

### Hierarquia de Prioridade

A nova lógica segue esta ordem de prioridade:

```text
1. regrasCongeladas.pacote.fotosIncluidas (MAIOR PRIORIDADE)
   ↓ Se não existir...
2. gestaoParams.fotos_incluidas_no_pacote (URL param)
   ↓ Se não existir...
3. packageFromGestao.fotosIncluidas (lookup na tabela pacotes)
   ↓ Se não existir...
4. Valor padrão: 30
```

### Garantias Anti-Falha

| Cenário | Comportamento |
|---------|---------------|
| regrasCongeladas existe | Usa `pacote.fotosIncluidas` |
| regrasCongeladas não existe, URL param existe | Usa param da URL |
| Nenhum acima, pacote encontrado no DB | Usa `fotos_incluidas` do pacote |
| Nada disponível | Mantém valor padrão (30) |
| Usuário clica "Override" | Permite edição manual |

## Arquivos a Modificar

### 1. `src/pages/GalleryCreate.tsx`

**Mudança 1: Adicionar novo useEffect após o de fetch de regras (após linha 209)**

```typescript
// NEW: Sync includedPhotos, packageName, sessionName from regrasCongeladas
// This runs AFTER regrasCongeladas is loaded to ensure correct values
useEffect(() => {
  // Only run when regras are loaded and we have a session
  if (!regrasLoaded || !regrasCongeladas || !gestaoParams?.session_id) return;
  
  const { pacote } = regrasCongeladas;
  
  // fotosIncluidas from frozen rules is the source of truth
  if (pacote?.fotosIncluidas !== undefined && pacote.fotosIncluidas > 0) {
    console.log('🔗 Syncing includedPhotos from regrasCongeladas:', pacote.fotosIncluidas);
    setIncludedPhotos(pacote.fotosIncluidas);
  }
  
  // Package name from frozen rules (if not already set)
  if (pacote?.nome && !packageName) {
    console.log('🔗 Syncing packageName from regrasCongeladas:', pacote.nome);
    setPackageName(pacote.nome);
  }
  
  // Session name from category (if not already set)
  if (pacote?.categoria && !sessionName) {
    console.log('🔗 Syncing sessionName from regrasCongeladas:', pacote.categoria);
    setSessionName(pacote.categoria);
  }
  
}, [regrasLoaded, regrasCongeladas, gestaoParams?.session_id, packageName, sessionName]);
```

**Mudança 2: Ajustar o useEffect de pre-fill (linhas 213-309) para não sobrescrever valores de regrasCongeladas**

Na lógica de pre-fill, adicionar verificação:

```typescript
// Step 2: Package name and lookup package data
if (gestaoParams.pacote_nome) {
  setPackageName(gestaoParams.pacote_nome);
  
  // Lookup package to get fotos_incluidas and valor_foto_extra
  const packageFromGestao = gestaoPackages.find(
    pkg => pkg.nome.toLowerCase() === gestaoParams.pacote_nome?.toLowerCase()
  );
  
  if (packageFromGestao) {
    console.log('🔗 Found package:', packageFromGestao);
    
    // Use package fotos_incluidas ONLY if:
    // 1. Not explicitly provided in URL
    // 2. regrasCongeladas not loaded yet (will be overwritten when loaded)
    // regrasCongeladas.pacote.fotosIncluidas takes priority when available
    if (!gestaoParams.fotos_incluidas_no_pacote && packageFromGestao.fotosIncluidas) {
      // Only set if regrasCongeladas doesn't have the value
      // (regrasCongeladas useEffect will override this if needed)
      setIncludedPhotos(packageFromGestao.fotosIncluidas);
    }
    
    // ... resto do código
  }
}
```

**Mudança 3: Log adicional para debugging**

Adicionar log no fetch de regras para facilitar debug:

```typescript
if (data?.regras_congeladas) {
  const regras = data.regras_congeladas as unknown as RegrasCongeladas;
  console.log('🔗 regrasCongeladas loaded:', {
    fotosIncluidas: regras.pacote?.fotosIncluidas,
    valorFotoExtra: regras.pacote?.valorFotoExtra,
    pacoteNome: regras.pacote?.nome,
  });
  setRegrasCongeladas(regras);
}
```

## Fluxo Corrigido

```text
1. Usuário clica no link do Gestão
   URL: /galeria/nova?session_id=workflow-xxx&cliente_id=...&pacote_nome=Teste
                │
                ▼
2. useGestaoParams() captura params da URL
   gestaoParams = { session_id: 'workflow-xxx', pacote_nome: 'Teste', ... }
                │
                ▼
3. useEffect 1: Fetch regrasCongeladas do banco
   SELECT regras_congeladas FROM clientes_sessoes WHERE session_id = 'workflow-xxx'
   regrasCongeladas = { pacote: { fotosIncluidas: 5, ... }, ... }
   regrasLoaded = true
                │
                ▼
4. useEffect 2: Pre-fill básico (cliente, etc.)
   setSelectedClient(...)
   setPackageName('Teste')
   (includedPhotos pode receber valor temporário)
                │
                ▼
5. ✨ NOVO useEffect 3: Sync com regrasCongeladas ✨
   if (regrasLoaded && regrasCongeladas) {
     setIncludedPhotos(regrasCongeladas.pacote.fotosIncluidas)  // 5
   }
                │
                ▼
6. Formulário exibe valor correto: "Fotos Incluídas no Pacote: 5"
```

## Testes Recomendados

1. **Teste com sessão existente**: Criar galeria via link do Gestão com session_id válido
2. **Teste sem regras congeladas**: Criar galeria via link do Gestão sem regras_congeladas no banco
3. **Teste com URL param explícito**: Link com `fotos_incluidas_no_pacote=10` deve usar 10
4. **Teste manual**: Criar galeria manualmente (sem Gestão) deve usar valor padrão
5. **Teste Override**: Ativar override e verificar se edição manual funciona

## Benefícios

- Valor das fotos incluídas sempre correto quando vem do Gestão
- Fonte de verdade única: `regrasCongeladas`
- Compatibilidade mantida com fluxo manual
- Logs detalhados para debugging
- Código mais previsível e fácil de manter
