

# Correcao: Galeria privada "sem senha" bloqueia acesso do cliente

## Problema identificado

Quando o fotografo seleciona "Privada" + "Sem protecao por senha", a galeria e salva no banco com:
- `permissao = 'private'`
- `gallery_password = null`

Na Edge Function `gallery-access`, a logica verifica:
1. `gallery.permissao === 'private'` -> exige senha
2. Cliente nao envia senha -> retorna `requiresPassword: true`
3. Cliente digita qualquer senha -> compara com `null` -> sempre falha

O mesmo ocorre quando o cliente nao tem senha cadastrada e o fotografo nao digita nenhuma: `gallery_password` fica `null` mas `permissao` continua `'private'`.

## Causa raiz

A checkbox "Sem protecao por senha" apenas controla o estado local `passwordDisabled`, mas o campo `permissao` continua como `'private'`. O backend interpreta `'private'` como "exigir senha sempre".

## Solucao

Corrigir a Edge Function `gallery-access` para tratar galerias privadas **sem senha definida** como acesso livre (sem solicitar senha). Essa abordagem e mais segura que mudar o frontend, pois:
- Corrige galerias ja criadas com esse problema
- Mantem a distincao semantica entre publica/privada
- Nao quebra galerias existentes que tem senha

## Mudancas tecnicas

### 1. Edge Function `supabase/functions/gallery-access/index.ts`

Na secao de verificacao de senha para galerias de selecao (por volta da linha 160), adicionar uma condicao:

**Antes:**
```text
if (gallery.permissao === "private") {
  if (!password) {
    return { requiresPassword: true, ... };
  }
  if (password !== gallery.gallery_password) {
    return { error: "Senha incorreta" };
  }
}
```

**Depois:**
```text
if (gallery.permissao === "private" && gallery.gallery_password) {
  if (!password) {
    return { requiresPassword: true, ... };
  }
  if (password !== gallery.gallery_password) {
    return { error: "Senha incorreta" };
  }
}
// Se permissao = 'private' mas gallery_password e null/vazio,
// tratar como acesso livre (fotografo escolheu "sem senha")
```

### 2. Mesma correcao para galerias de entrega (deliver)

Na secao de verificacao de senha para galerias tipo `entrega` (por volta da linha 48), aplicar a mesma logica:

**Antes:**
```text
if (gallery.permissao === 'private') {
```

**Depois:**
```text
if (gallery.permissao === 'private' && gallery.gallery_password) {
```

### 3. Nenhuma mudanca no frontend

O frontend ja funciona corretamente:
- `passwordDisabled = true` faz `galleryPassword = undefined` ser salvo como `null`
- A UI mostra as opcoes corretas
- Apenas o backend precisa respeitar que `password = null` significa "sem protecao"

## Impacto

- Galerias ja criadas com esse bug serao corrigidas automaticamente
- Galerias com senha definida continuam protegidas normalmente
- Galerias publicas nao sao afetadas
- Galerias de entrega (deliver) tambem sao corrigidas

