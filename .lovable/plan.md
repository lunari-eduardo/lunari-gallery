

## Barra fixa inferior com botão Salvar

### Problema
O botão "Salvar Configurações" fica no final da página, exigindo scroll até o fim para salvar. UX ruim em páginas longas como Pagamentos.

### Solução
Substituir o bloco do botão por uma barra fixa (`fixed bottom-0`) que aparece na parte inferior da tela. A barra terá fundo com glassmorphism (`backdrop-blur`) e sombra superior para separação visual.

Adicionamos `pb-20` ao container principal para evitar que a barra sobreponha o conteúdo.

### Alteração em `src/pages/Settings.tsx`

1. Remover o `<div className="flex justify-end">` com o botão (linhas 52-58)
2. Adicionar barra fixa fora do container principal:
   ```tsx
   <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-lg">
     <div className="max-w-4xl mx-auto px-4 py-3 flex justify-end">
       <Button variant="terracotta" size="lg" onClick={handleSave}>
         <Save className="h-4 w-4 mr-2" />
         Salvar Configurações
       </Button>
     </div>
   </div>
   ```
3. Adicionar `pb-20` ao container principal para espaço da barra

