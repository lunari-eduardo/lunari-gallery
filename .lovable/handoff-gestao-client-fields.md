# Handoff Gestão — Contrato de dados do Cliente (bidirecional)

Ambos os projetos (Lunari_gallery e Lunari_gestão) escrevem na **mesma linha** de
`public.clientes` (unificação já confirmada em memory:
`architecture/unified-client-table-consolidation-and-security`).

## Campos canônicos da tabela `public.clientes`

| Coluna                   | Tipo         | Quem escreve            | Observações |
|--------------------------|--------------|-------------------------|-------------|
| `nome`                   | text         | ambos                   | trim; obrigatório |
| `email`                  | text         | ambos                   | validado no client-side; nunca sobrescrever com valor vazio |
| `telefone`               | text         | ambos                   | máscara BR aplicada no UI |
| `whatsapp`               | text         | ambos                   | máscara BR aplicada no UI |
| `data_nascimento`        | date         | ambos                   | ISO `YYYY-MM-DD` |
| `cpf_cnpj`               | text         | ambos                   | **apenas dígitos** no banco; máscara só na UI |
| `cep`                    | text         | ambos                   | **apenas dígitos** no banco |
| `endereco`               | text         | ambos                   |             |
| `endereco_numero`        | text         | ambos                   |             |
| `endereco_complemento`   | text         | ambos                   |             |
| `bairro`                 | text         | ambos                   |             |
| `cidade`                 | text         | ambos                   |             |
| `uf`                     | text (2)     | ambos                   | maiúsculas |
| `gallery_password`       | text         | apenas Gallery          | Gestão não deve tocar |
| `gallery_status`         | text         | apenas Gallery          | Gestão não deve tocar |
| `total_galerias`         | int          | apenas Gallery          | contador |

## Regras de sobrescrita

1. **Nunca sobrescrever** um campo não-vazio com string vazia sem confirmação
   explícita do usuário. Enriquecimento automático (checkout, webhook) segue a
   regra do `_shared/enrich-cliente.ts`: só preenche campos vazios.
2. **CPF/CNPJ** sempre gravado como dígitos; validação de dígito verificador
   deve ocorrer no client-side antes de persistir.
3. **UF** sempre uppercase de 2 letras.

## Realtime

O Gallery agora subscreve `postgres_changes` (UPDATE) em `public.clientes`
filtrado por `id=<clientId>`. Se o Gestão editar um cliente enquanto o
fotógrafo está com a tela do Gallery aberta, a UI atualiza sozinha.

Recomenda-se ao Gestão fazer o mesmo para atualizações vindas do Gallery.

Requer que a publicação Realtime inclua a tabela:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
```

(Idempotente — verificar antes.)

## Segurança — bug do autofill (corrigido no Gallery)

O modal antigo do Gallery tinha `<input type="email">` seguido de
`<input type="password">`. O Chrome/Password Manager reconhecia esse par como
formulário de login e injetava as credenciais salvas do fotógrafo, gravando
o **e-mail do fotógrafo em `clientes.email`** e a **senha do fotógrafo em
`clientes.gallery_password`**.

Correções aplicadas no Gallery e recomendadas ao Gestão em qualquer form de
cliente:

- Nunca usar `type="password"` para senhas de galeria. Use `type="text"` com
  máscara CSS opcional (`-webkit-text-security: disc`) e toggle de
  visibilidade.
- Adicionar dois inputs decoy (`text` + `password`) hidden no topo do form
  com `autoComplete="username"` / `autoComplete="new-password"`.
- Todos os inputs sensíveis: `autoComplete="off"`, `spellCheck={false}`, e
  `name`/`id` com sufixo aleatório por sessão (quebra o heurístico do
  gerenciador).
- Guard no `onSubmit`: se `email` ou `gallery_password` == e-mail do usuário
  autenticado, abortar com toast de erro.

## Higienização retroativa

Sugestão de query para o Gestão executar uma única vez a fim de limpar dados
contaminados pelo bug de autofill:

```sql
UPDATE public.clientes c
SET gallery_password = NULL
FROM public.profiles p
WHERE c.user_id = p.id
  AND c.gallery_password IS NOT NULL
  AND LOWER(c.gallery_password) = LOWER(p.email);
```
