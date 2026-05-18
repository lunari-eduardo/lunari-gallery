# Plano: Páginas de Privacidade e Termos

## Objetivo
Publicar duas páginas legais públicas em:
- `gallery.lunarihub.com/privacidade`
- `gallery.lunarihub.com/termos`

## Implementação

### 1. Criar componente compartilhado
`src/components/legal/LegalPageLayout.tsx` — layout reutilizável com:
- Header simples (logo + link voltar)
- Container centralizado (max-w-3xl), tipografia editorial
- Footer com links cruzados entre Privacidade ↔ Termos e contato
- Segue design system (glassmorphism leve, tokens semânticos do `index.css`)
- Responsivo, dark/light mode
- SEO via `react-helmet-async` se já instalado; caso não esteja, usar `<title>` direto no `document` via `useEffect` (evitar nova dependência)

### 2. Criar páginas
- `src/pages/Privacidade.tsx` — renderiza o texto da Política de Privacidade (9 seções)
- `src/pages/Termos.tsx` — renderiza o texto dos Termos de Serviço (9 seções)

Conteúdo exatamente como fornecido pelo usuário, estruturado com:
- `<h1>` único para título
- `<h2>` para cada seção numerada
- `<ul>` para listas de bullets
- `<p>` para parágrafos
- Data de última atualização visível no topo

### 3. Rotas públicas em `src/App.tsx`
Adicionar antes do catch-all `*`:
```tsx
<Route path="/privacidade" element={<Privacidade />} />
<Route path="/termos" element={<Termos />} />
```
Sem `ProtectedRoute` e sem `Layout` (páginas públicas, sem menu de fotógrafo).

### 4. SEO básico
Em cada página:
- `<title>` específico (< 60 chars)
- `<meta name="description">` (< 160 chars)
- `<link rel="canonical">` apontando para a URL em `gallery.lunarihub.com`
- H1 único e HTML semântico

### 5. Hosting
Lovable já faz fallback SPA automático — `/privacidade` e `/termos` funcionarão em refresh direto sem config extra.

## Fora do escopo
- Não adicionar links no header/menu (pode ser feito depois sob demanda)
- Não criar tabela de versionamento de políticas no banco
- Não enviar e-mail de notificação a usuários

## Arquivos
- `src/components/legal/LegalPageLayout.tsx` (novo)
- `src/pages/Privacidade.tsx` (novo)
- `src/pages/Termos.tsx` (novo)
- `src/App.tsx` (adicionar 2 rotas + imports)
