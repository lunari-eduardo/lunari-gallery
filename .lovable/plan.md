

# Plano Anti-Fraude: Prevenção de Contas Múltiplas

## Contexto do Problema

Hoje, qualquer pessoa pode criar infinitas contas e ganhar:
- **500 créditos Select grátis** por conta (via `handle_new_user_profile`)
- **0.5GB armazenamento grátis** por conta
- **+1.000 créditos** via auto-indicação (criando conta A, gerando link, criando conta B com link)
- **+10% storage** via auto-indicação com assinatura Transfer

## Estratégia de Defesa (3 camadas)

### Camada 1 — Fingerprint de Dispositivo (Frontend)

Capturar um hash de fingerprint do navegador no momento do signup e login, usando atributos como: canvas hash, WebGL renderer, timezone, idioma, resolução de tela, número de cores, plataforma, user agent. Isso gera um `device_fingerprint` (hash SHA-256) que é difícil de falsificar sem mudar de navegador/dispositivo.

**Implementação:**
- Criar `src/lib/deviceFingerprint.ts` — função pura que coleta ~10 sinais do navegador e retorna um hash determinístico
- Enviar o fingerprint como `user_metadata` no signup (email) e salvar no `localStorage` para OAuth
- Registrar na tabela de controle em cada login/signup

### Camada 2 — Tabela de Rastreamento `account_fingerprints` (Backend)

Nova tabela que registra cada par (user_id, fingerprint, IP) em signup e login:

```text
account_fingerprints
├── id (uuid, PK)
├── user_id (uuid, FK auth.users)
├── device_fingerprint (text, NOT NULL)
├── ip_address (text)
├── event_type (text: 'signup' | 'login')
├── user_agent (text)
├── created_at (timestamptz)
```

- Índice em `device_fingerprint` para busca rápida
- RLS: apenas o próprio usuário lê seus registros; inserção via SECURITY DEFINER

### Camada 3 — Bloqueios nas RPCs (Servidor)

**3a. `handle_new_user_profile` — Não conceder créditos se fingerprint já existe**

Modificar o trigger para verificar se o `device_fingerprint` (passado via `raw_user_meta_data`) já está associado a outra conta. Se sim:
- Criar o profile normalmente (não bloquear o cadastro — evita falsos positivos)
- **Não conceder** os 500 créditos e 0.5GB grátis
- Marcar a conta como `suspected_duplicate = true`

**3b. `register_referral` — Bloquear auto-indicação por fingerprint**

Além da verificação `referrer_id != auth.uid()`, adicionar:
- Verificar se o fingerprint do indicado já aparece em `account_fingerprints` associado ao indicador
- Se sim, **rejeitar a indicação** (mesma pessoa, contas diferentes)

**3c. `grant_referral_select_bonus` — Validar antes de conceder**

Adicionar verificação:
- Se o indicado está marcado como `suspected_duplicate`, não conceder bônus

### Camada 4 — Registro de IP via Edge Function

Criar uma Edge Function leve `record-auth-fingerprint` que:
1. Recebe `device_fingerprint` do frontend
2. Extrai o IP real do request (`x-forwarded-for`)
3. Insere na tabela `account_fingerprints`
4. Retorna se há suspeita de duplicação (para logging, não bloqueio no frontend)

Será chamada logo após signup e após cada login bem-sucedido.

## Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| `src/lib/deviceFingerprint.ts` | **Criar** — gera hash de fingerprint do dispositivo |
| `supabase/functions/record-auth-fingerprint/index.ts` | **Criar** — registra fingerprint + IP no banco |
| Migration SQL | **Criar** — tabela `account_fingerprints`, alterar `handle_new_user_profile`, alterar `register_referral` |
| `src/contexts/AuthContext.tsx` | **Editar** — chamar `record-auth-fingerprint` após login/signup |
| `src/hooks/useAuth.ts` | **Editar** — incluir fingerprint no metadata do signup |
| `src/components/auth/SignupForm.tsx` | **Editar** — gerar fingerprint antes do submit |

## Fluxo Resumido

```text
Signup/Login
    │
    ├─ Frontend gera device_fingerprint (hash)
    │
    ├─ Signup: fingerprint vai no user_metadata
    │   └─ handle_new_user_profile verifica fingerprint
    │       ├─ Novo dispositivo → 500 créditos + 0.5GB ✅
    │       └─ Dispositivo já usado → 0 créditos, flag suspected_duplicate ⚠️
    │
    ├─ Após auth: chama record-auth-fingerprint (Edge Function)
    │   └─ Registra (user_id, fingerprint, IP, event_type)
    │
    └─ Referral: register_referral verifica
        ├─ Fingerprint do indicado ≠ indicador → permite ✅
        └─ Fingerprint compartilhado → rejeita ❌
```

## Limitações Conhecidas (transparência)

- **Navegador anônimo/diferente**: fingerprint muda — mitigado parcialmente por IP
- **VPN**: IP diferente — mitigado pelo fingerprint
- **Mesmo Wi-Fi (pessoas diferentes)**: mesmo IP mas fingerprints diferentes — não gera falso positivo
- **Dispositivo compartilhado**: mesmo fingerprint legítimo — a flag `suspected_duplicate` permite revisão manual pelo admin sem bloqueio automático

## Resultado Esperado

1. Criar 2 contas no mesmo navegador → segunda conta não ganha créditos grátis
2. Gerar link de indicação e usar no mesmo dispositivo → indicação rejeitada
3. Usar VPN mas mesmo navegador → fingerprint idêntico, fraude detectada
4. Dois fotógrafos reais no mesmo Wi-Fi → fingerprints diferentes, ambos recebem normalmente

