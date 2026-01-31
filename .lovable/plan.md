
# Plano: Bloquear Galeria Confirmada - Apenas Fotos Selecionadas

## Problema

Quando o cliente acessa uma galeria já confirmada pelo mesmo link de seleção:
1. Ele vê a tela de boas-vindas (showWelcome = true no primeiro acesso)
2. Após pular a tela de boas-vindas, ele vê TODAS as fotos com botões de seleção
3. Aparece apenas uma notificação ao tentar interagir

## Causa Raiz

A ordem de verificação no render está incorreta:

```text
if (showWelcome)         ← Verificado PRIMEIRO
if (currentStep === 'confirmation')
if (currentStep === 'payment')
if (currentStep === 'confirmed')  ← Verificado DEPOIS
return (galeria completa)
```

Quando `showWelcome = true`, a tela de boas-vindas é renderizada mesmo que `isConfirmed = true`.

## Solução

Mover a verificação de `isConfirmed` para **antes** de `showWelcome`, garantindo que galerias confirmadas sempre mostrem apenas as fotos selecionadas.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ClientGallery.tsx` | Reordenar verificações de renderização |

## Mudanças Detalhadas

### 1. Mover verificação de `isConfirmed` para ANTES de `showWelcome`

**Linha ~792 - Reorganizar lógica de renderização:**

```typescript
// ANTES (problemático):
if (showWelcome) {
  return <WelcomeScreen />;
}

if (currentStep === 'confirmation') { ... }
if (currentStep === 'payment') { ... }
if (currentStep === 'confirmed') { ... }

// DEPOIS (corrigido):
// ✨ PRIMEIRA verificação: galeria confirmada = modo read-only
if (isConfirmed && currentStep !== 'confirmation' && currentStep !== 'payment') {
  // Renderiza tela de fotos selecionadas (read-only)
  const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
  return (
    <div className="min-h-screen ...">
      <header>Logo + "Seleção confirmada"</header>
      <Banner verde de sucesso>
        Você selecionou {confirmedSelectedPhotos.length} fotos.
      </Banner>
      <MasonryGrid>
        {confirmedSelectedPhotos.map(...)} // APENAS selecionadas
      </MasonryGrid>
      <Lightbox disabled={true} photos={confirmedSelectedPhotos} />
    </div>
  );
}

// Depois: fluxos de confirmação/pagamento em andamento
if (currentStep === 'confirmation') { ... }
if (currentStep === 'payment') { ... }

// Depois: tela de boas-vindas (apenas para galerias não confirmadas)
if (showWelcome) {
  return <WelcomeScreen />;
}

// Default: galeria normal (seleção em andamento)
return <FullGallery />;
```

### 2. Mover o bloco de código da tela confirmada (linhas 945-1046)

O bloco `if (currentStep === 'confirmed')` será movido para cima e convertido em `if (isConfirmed && ...)`:

```typescript
// Renderização para galeria já confirmada - ANTES de showWelcome
if (isConfirmed && currentStep !== 'confirmation' && currentStep !== 'payment') {
  const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
  
  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background text-foreground",
        effectiveBackgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-center px-3 py-4">
          {/* Logo */}
        </div>
        <div className="text-center py-2 border-t border-border/30">
          <p className="text-sm font-medium">{gallery.sessionName}</p>
          <p className="text-xs text-muted-foreground">Seleção confirmada</p>
        </div>
      </header>
      
      <main className="flex-1 p-4 space-y-6">
        {/* Banner de sucesso */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Check className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-primary">
              Seleção Confirmada!
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Você selecionou {confirmedSelectedPhotos.length} fotos. 
            Para alterações, entre em contato com o fotógrafo.
          </p>
        </div>

        {/* Grid de APENAS fotos selecionadas */}
        {confirmedSelectedPhotos.length > 0 ? (
          <>
            <h3 className="font-medium text-sm text-muted-foreground">
              Suas fotos selecionadas ({confirmedSelectedPhotos.length})
            </h3>
            <MasonryGrid>
              {confirmedSelectedPhotos.map((photo, index) => (
                <MasonryItem key={photo.id}>
                  <div className="relative group cursor-pointer" onClick={() => setLightboxIndex(index)}>
                    <div className="aspect-square overflow-hidden rounded-lg">
                      <img 
                        src={photo.thumbnailUrl} 
                        alt={photo.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {/* Indicador de seleção */}
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                    {/* Indicador de favorito */}
                    {photo.isFavorite && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-md">
                        <Heart className="h-3 w-3 text-white fill-current" />
                      </div>
                    )}
                    {/* Indicador de comentário */}
                    {photo.comment && !photo.isFavorite && (
                      <div className="absolute top-2 right-2 bg-background/90 rounded-full p-1.5 shadow-sm">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </MasonryItem>
              ))}
            </MasonryGrid>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma foto foi selecionada.</p>
          </div>
        )}
      </main>

      {/* Lightbox read-only - apenas fotos selecionadas */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={confirmedSelectedPhotos}
          currentIndex={lightboxIndex}
          watermark={gallery.settings.watermark}
          watermarkDisplay={gallery.settings.watermarkDisplay}
          allowComments={false}
          allowDownload={gallery.settings.allowDownload}
          disabled={true}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={() => {}}
        />
      )}
    </div>
  );
}
```

### 3. Remover o bloco duplicado antigo

Após mover o código para cima, remover o bloco original `if (currentStep === 'confirmed')` (linhas 945-1046).

## Fluxo Corrigido

```text
Cliente acessa link de galeria
           │
           ▼
Verifica: isConfirmed? (status_selecao === 'confirmado')
           │
    ┌──────┴──────┐
    ▼             ▼
   SIM           NÃO
    │             │
    ▼             ▼
Renderiza      Continua fluxo normal:
tela READ-ONLY   1. confirmation?
(apenas fotos    2. payment?
selecionadas)    3. showWelcome?
                 4. galeria completa
```

## Resumo das Mudanças

| Antes | Depois |
|-------|--------|
| showWelcome verificado primeiro | isConfirmed verificado primeiro |
| currentStep === 'confirmed' verificado depois | Removido, substituído por isConfirmed |
| Cliente vê galeria completa após welcome | Cliente vê apenas fotos selecionadas |
| Botões de seleção visíveis | Nenhum botão de ação |

## Benefícios

1. Cliente vê APENAS fotos selecionadas após confirmação
2. Indicadores visuais de favoritos e comentários mantidos
3. Zero possibilidade de alteração
4. Lightbox navega apenas entre fotos selecionadas
5. Fluxo consistente independente de como o cliente acessa
