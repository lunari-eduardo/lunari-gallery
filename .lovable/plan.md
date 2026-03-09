

## Correção: Campo de email ausente no checkout Asaas

### Problema
O formulário de cartão de crédito não possui campo de email do titular. O `creditCardHolderInfo.email` é enviado como string vazia (`''`), mas a API do Asaas **exige** esse campo para pagamentos com cartão de crédito.

### Correção em `src/components/AsaasCheckout.tsx`

1. **Adicionar estado** `cardEmail` (junto dos outros estados de cartão, linha ~166)
2. **Adicionar campo de input** "Email do titular" no formulário de cartão (entre CPF e número do cartão)
3. **Adicionar validação** no `handleCardSubmit`: verificar formato de email antes de submeter
4. **Passar o valor** no payload: `email: cardEmail` ao invés de `email: ''`

### Alteração mínima — 4 pontos no arquivo:
- Linha ~166: `const [cardEmail, setCardEmail] = useState('');`
- Validação (~linha 354): `if (!cardEmail || !/\S+@\S+\.\S+/.test(cardEmail)) { setCardError('Informe o email do titular do cartão.'); return; }`
- Campo no formulário (na seção de inputs do cartão)
- Linha 385: `email: cardEmail,`

