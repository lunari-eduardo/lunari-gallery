/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONTRATO COMPARTILHADO — NÃO MODIFICAR SEM COORDENAÇÃO    ║
 * ║                                                              ║
 * ║  Esta função é chamada internamente por confirm-selection    ║
 * ║  usando SUPABASE_SERVICE_ROLE_KEY (não JWT de usuário).      ║
 * ║                                                              ║
 * ║  REGRAS IMUTÁVEIS:                                           ║
 * ║  1. NÃO adicionar verificação de JWT (auth.getUser)          ║
 * ║  2. userId DEVE ser aceito no body da request                ║
 * ║  3. verify_jwt DEVE ser false no config.toml                 ║
 * ║  4. Autenticação do fotógrafo é via userId no body           ║
 * ║                                                              ║
 * ║  Projetos: Gallery (Select) + Gestão                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { resolvePayerHints, payerHintsFlags } from '../_shared/payer-hints.ts';
import { enrichClienteIfMissing } from '../_shared/enrich-cliente.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Asaas rejeita emails com caracteres não-ASCII (ex.: "joão@gmail.com").
// Validamos localmente para evitar que o PUT/POST do customer seja invalidado
// como um todo — o que também impediria a gravação de campos críticos como cpfCnpj.
function isAsaasSafeEmail(e?: string | null): boolean {
  if (!e) return false;
  const s = String(e).trim();
  if (!/^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)) return false;
  return !/[^\x00-\x7F]/.test(s);
}

// PUT resiliente: se o Asaas responder invalid_email, retira o email e tenta
// de novo — assim os demais campos (cpfCnpj, phone, endereço) são gravados.
// Retorna { ok, invalidEmail } para o chamador decidir se propaga erro.
async function putAsaasCustomer(
  asaasBaseUrl: string,
  asaasApiKey: string,
  customerId: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; invalidEmail: boolean; body?: string }> {
  const doPut = async (payload: Record<string, unknown>) =>
    fetch(`${asaasBaseUrl}/v3/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
      body: JSON.stringify(payload),
    });

  let resp = await doPut(updates);
  if (resp.ok) return { ok: true, invalidEmail: false };
  const text = await resp.text();
  const isInvalidEmail = /invalid_email/i.test(text);
  if (isInvalidEmail && 'email' in updates) {
    console.warn('Asaas rejeitou email — retrying customer PUT sem email.');
    const { email: _drop, ...rest } = updates;
    if (Object.keys(rest).length === 0) return { ok: false, invalidEmail: true, body: text };
    const retry = await doPut(rest);
    if (retry.ok) return { ok: true, invalidEmail: true };
    return { ok: false, invalidEmail: true, body: await retry.text() };
  }
  return { ok: false, invalidEmail: isInvalidEmail, body: text };
}


async function notifyPaymentConfirmed(supabaseUrl: string, serviceKey: string, paymentId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'payment_confirmed', paymentId }),
    });
    if (!response.ok) console.warn('⚠️ payment email notification failed:', response.status, await response.text());
  } catch (error) {
    console.warn('⚠️ payment email notification exception:', error);
  }
}

interface RequestBody {
  userId: string;
  clienteId?: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  galeriaId?: string;
  qtdFotos?: number;
  galleryToken?: string;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  visitorId?: string;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    postalCode: string;
    addressNumber: string;
  };
  remoteIp?: string;
  installmentCount?: number;
  snapshotFotosIncluidas?: number;
  snapshotRegrasCongeladas?: any;
  correlationId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { userId, clienteId, sessionId, valor, descricao, galeriaId, qtdFotos, galleryToken, billingType } = body;

    if (!userId || !valor || valor <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId e valor são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch photographer's Asaas integration
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      console.error('Asaas integration not found:', integError);
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada', code: 'ASAAS_NOT_CONFIGURED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasApiKey = integracao.access_token;
    const rawSettings = (integracao.dados_extras || {}) as Record<string, any>;
    const settings = ({ ...rawSettings, ...(rawSettings.gallery_settings || {}) }) as {
      environment?: string;
      habilitarPix?: boolean;
      habilitarCartao?: boolean;
      habilitarBoleto?: boolean;
      maxParcelas?: number;
      absorverTaxa?: boolean;
      incluirTaxaAntecipacao?: boolean;
      centralizarEmailsLunari?: boolean;
    };
    const centralizarEmailsLunari = settings.centralizarEmailsLunari !== false;

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Determine billing type
    const finalBillingType = billingType || (settings.habilitarPix ? 'PIX' : settings.habilitarCartao ? 'CREDIT_CARD' : 'BOLETO');

    // Validate billing type is enabled
    if (finalBillingType === 'PIX' && !settings.habilitarPix) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIX não está habilitado', code: 'PIX_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (finalBillingType === 'CREDIT_CARD' && !settings.habilitarCartao) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cartão de crédito não está habilitado', code: 'CARD_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (finalBillingType === 'BOLETO' && !settings.habilitarBoleto) {
      return new Response(
        JSON.stringify({ success: false, error: 'Boleto não está habilitado', code: 'BOLETO_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Find or create Asaas customer (prioritize externalReference over email)
    let asaasCustomerId: string | null = null;

    // 🎯 Resolve payer hints (nome, email, telefone) para prefill do checkout Asaas.
    //    Ordem: cliente → visitante. Falha silenciosa nunca bloqueia o fluxo.
    let payerHints: Awaited<ReturnType<typeof resolvePayerHints>> = {};
    try {
      payerHints = await resolvePayerHints(supabase, { clienteId, visitorId: body.visitorId });
      console.log(`[ASAAS_PREFILL] ${payerHintsFlags(payerHints)}`);
    } catch (e) {
      console.warn('[ASAAS_PREFILL] falha:', e instanceof Error ? e.message : e);
    }

    // 🔒 GUARD: Asaas exige CPF/CNPJ do pagador para gerar QR PIX, boleto ou
    // cobrança de cartão. Se não temos CPF no CRM E o cliente também não
    // enviou via `creditCardHolderInfo` (fluxo de cartão), retornamos 422
    // para o frontend abrir o modal de coleta.
    const cardHolderCpf = String(body.creditCardHolderInfo?.cpfCnpj || '').replace(/\D/g, '');
    const hasCardHolderCpf = cardHolderCpf.length === 11 || cardHolderCpf.length === 14;
    if (!payerHints.cpfCnpj && !hasCardHolderCpf) {
      console.warn('[ASAAS_GUARD] MISSING_CPF_CNPJ — abortando antes de chamar Asaas');
      return new Response(
        JSON.stringify({
          success: false,
          code: 'MISSING_CPF_CNPJ',
          error: 'CPF ou CNPJ do pagador é obrigatório para cobranças via Asaas.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (clienteId) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf')
        .eq('id', clienteId)
        .maybeSingle();

      if (cliente) {
        const clienteName = cliente.nome || 'Cliente';
        const bestPhone = cliente.telefone || cliente.whatsapp || payerHints.phone || undefined;
        const bestEmail = cliente.email || payerHints.email || undefined;
        const bestCpfCnpj = payerHints.cpfCnpj || undefined; // já normalizado pelo hint
        const addr = payerHints.address;

        // Helper: só preenche campos ausentes no Asaas — nunca sobrescreve.
        // Inclui CPF/CNPJ e endereço (obrigatórios/recomendados para antecipação).
        const buildFillUpdates = (existing: Record<string, unknown>): Record<string, unknown> => {
          const u: Record<string, unknown> = {};
          // Só envia email para o Asaas se for ASCII válido — evita bloquear
          // o PUT inteiro por causa de acento no email do CRM.
          if (bestEmail && !existing.email && isAsaasSafeEmail(bestEmail)) u.email = bestEmail;
          if (bestPhone && !existing.phone && !existing.mobilePhone) {
            u.mobilePhone = bestPhone;
            u.phone = bestPhone;
          }
          if (bestCpfCnpj && !existing.cpfCnpj) u.cpfCnpj = bestCpfCnpj;
          if (addr?.postalCode && !existing.postalCode) u.postalCode = addr.postalCode;
          if (addr?.street && !existing.address) u.address = addr.street;
          if (addr?.number && !existing.addressNumber) u.addressNumber = addr.number;
          if (addr?.complement && !existing.complement) u.complement = addr.complement;
          if (addr?.province && !existing.province) u.province = addr.province;
          if (addr?.city && !existing.city) u.cityName = addr.city;
          if (addr?.state && !existing.state) u.state = addr.state;
          return u;
        };

        // Step 1: Search by externalReference (clienteId) — most precise
        const refResp = await fetch(`${asaasBaseUrl}/v3/customers?externalReference=${encodeURIComponent(clienteId)}`, {
          headers: { access_token: asaasApiKey },
        });
        if (refResp.ok) {
          const refData = await refResp.json();
          if (refData.data && refData.data.length > 0) {
            const existing = refData.data[0];
            asaasCustomerId = existing.id;
            console.log(`📋 Found Asaas customer by externalReference: ${asaasCustomerId} (name: ${existing.name})`);

            const updates: Record<string, unknown> = { ...buildFillUpdates(existing) };
            if (existing.name !== clienteName) updates.name = clienteName;
            if (centralizarEmailsLunari) updates.notificationDisabled = true;
            if (Object.keys(updates).length > 0) {
              console.log(`📝 Updating Asaas customer:`, Object.keys(updates));
              const updateResp = await fetch(`${asaasBaseUrl}/v3/customers/${asaasCustomerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
                body: JSON.stringify(updates),
              });
              if (!updateResp.ok) console.warn('Failed to update Asaas customer:', await updateResp.text());
            }
          }
        }

        // Step 2: Fallback — search by email
        if (!asaasCustomerId && bestEmail) {
          const searchResp = await fetch(`${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(bestEmail)}`, {
            headers: { access_token: asaasApiKey },
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            if (searchData.data && searchData.data.length > 0) {
              const match = searchData.data.find((c: Record<string, unknown>) => c.externalReference === clienteId) || searchData.data[0];
              asaasCustomerId = match.id;
              console.log(`📋 Found Asaas customer by email: ${asaasCustomerId} (name: ${match.name})`);

              const updates: Record<string, unknown> = { ...buildFillUpdates(match) };
              if (match.name !== clienteName) updates.name = clienteName;
              if (match.externalReference !== clienteId) updates.externalReference = clienteId;
              if (centralizarEmailsLunari) updates.notificationDisabled = true;
              if (Object.keys(updates).length > 0) {
                console.log(`📝 Updating Asaas customer:`, Object.keys(updates));
                const updateResp = await fetch(`${asaasBaseUrl}/v3/customers/${asaasCustomerId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
                  body: JSON.stringify(updates),
                });
                if (!updateResp.ok) console.warn('Failed to update Asaas customer:', await updateResp.text());
              }
            }
          }
        }

        // Step 3: Create new customer if not found
        if (!asaasCustomerId) {
          const createPayload: Record<string, unknown> = {
            name: clienteName,
            email: bestEmail,
            phone: bestPhone,
            mobilePhone: bestPhone,
            cpfCnpj: bestCpfCnpj,
            postalCode: addr?.postalCode,
            address: addr?.street,
            addressNumber: addr?.number,
            complement: addr?.complement,
            province: addr?.province,
            cityName: addr?.city,
            state: addr?.state,
            externalReference: clienteId,
            ...(centralizarEmailsLunari ? { notificationDisabled: true } : {}),
          };
          // Remove chaves undefined para não poluir o payload.
          Object.keys(createPayload).forEach((k) => createPayload[k] === undefined && delete createPayload[k]);

          const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
            body: JSON.stringify(createPayload),
          });

          if (createResp.ok) {
            const createData = await createResp.json();
            asaasCustomerId = createData.id;
            console.log(`📋 Created Asaas customer: ${asaasCustomerId}`);
          } else {
            const errData = await createResp.json();
            console.error('Failed to create Asaas customer:', errData);
          }
        }
      }
    }



    // If no customer found/created, create a generic one
    if (!asaasCustomerId) {
      const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          name: 'Cliente Galeria',
          externalReference: galeriaId || 'gallery-client',
          ...(centralizarEmailsLunari ? { notificationDisabled: true } : {}),
        }),
      });

      if (createResp.ok) {
        const createData = await createResp.json();
        asaasCustomerId = createData.id;
      } else {
        const errData = await createResp.json();
        console.error('Failed to create fallback Asaas customer:', errData);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar cliente no Asaas', code: 'ASAAS_CUSTOMER_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Calculate fees using REAL Asaas API rates (server-side validation)
    let valorFinal = valor;
    let processingCost = 0;
    let anticipationCost = 0;

    const incluirAntecipacao = settings.incluirTaxaAntecipacao !== false;

    if (finalBillingType === 'CREDIT_CARD' && !settings.absorverTaxa) {
      const installments = body.installmentCount && body.installmentCount > 1 ? body.installmentCount : 1;

      try {
        const feesResp = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
          headers: { access_token: asaasApiKey },
        });

        if (feesResp.ok) {
          const feesData = await feesResp.json();
          const payment = feesData.payment || {};
          const ccFees = payment.creditCard || {};
          const anticipationCC = (feesData.anticipation || {}).creditCard || {};

          const operationValue = ccFees.operationValue ?? 0.49;
          let percentageFee = 0;

          const hasDiscount = ccFees.hasValidDiscount === true;
          const discountExpiration = ccFees.discountExpiration;
          const discountValid = hasDiscount && (!discountExpiration || new Date(discountExpiration) > new Date());

          if (discountValid) {
            if (installments === 1) {
              percentageFee = ccFees.discountOneInstallmentPercentage ?? ccFees.oneInstallmentPercentage ?? 2.99;
            } else if (installments <= 6) {
              percentageFee = ccFees.discountUpToSixInstallmentsPercentage ?? ccFees.upToSixInstallmentsPercentage ?? 3.49;
            } else if (installments <= 12) {
              percentageFee = ccFees.discountUpToTwelveInstallmentsPercentage ?? ccFees.upToTwelveInstallmentsPercentage ?? 3.99;
            } else {
              percentageFee = ccFees.discountUpToTwentyOneInstallmentsPercentage ?? ccFees.upToTwentyOneInstallmentsPercentage ?? 4.29;
            }
          } else {
            if (installments === 1) {
              percentageFee = ccFees.oneInstallmentPercentage ?? 2.99;
            } else if (installments <= 6) {
              percentageFee = ccFees.upToSixInstallmentsPercentage ?? 3.49;
            } else if (installments <= 12) {
              percentageFee = ccFees.upToTwelveInstallmentsPercentage ?? 3.99;
            } else {
              percentageFee = ccFees.upToTwentyOneInstallmentsPercentage ?? 4.29;
            }
          }

          processingCost = (valor * percentageFee / 100) + operationValue;
          processingCost = Math.round(processingCost * 100) / 100;

          if (incluirAntecipacao) {
            const detachedMonthlyFee = anticipationCC.detachedMonthlyFeeValue ?? 1.25;
            const installmentMonthlyFee = anticipationCC.installmentMonthlyFeeValue ?? 1.70;
            const taxaMensal = installments === 1 ? detachedMonthlyFee : installmentMonthlyFee;

            if (taxaMensal > 0) {
              const valorParcela = valor / installments;
              let valorLiquido = 0;
              for (let i = 1; i <= installments; i++) {
                const taxaTotal = taxaMensal * i;
                valorLiquido += valorParcela * (1 - taxaTotal / 100);
              }
              anticipationCost = Math.round((valor - valorLiquido) * 100) / 100;
            }
          }

          valorFinal = Math.round((valor + processingCost + anticipationCost) * 100) / 100;
          console.log(`📊 Server-side fee calc: processing=R$${processingCost} (${percentageFee}% + R$${operationValue}), anticipation=${incluirAntecipacao ? 'R$' + anticipationCost : 'disabled'}, total=R$${valorFinal}`);
        } else {
          console.warn('Failed to fetch Asaas fees for server-side validation, using valor as-is');
        }
      } catch (feeErr) {
        console.warn('Error fetching Asaas fees:', feeErr);
      }
    }

    // 4. Create payment in Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const paymentBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: finalBillingType,
      value: valorFinal,
      dueDate: dueDate.toISOString().split('T')[0],
      description: descricao || 'Pagamento galeria de fotos',
      externalReference: galeriaId || undefined,
      postalService: false,
    };

    if (finalBillingType === 'CREDIT_CARD' && body.installmentCount && body.installmentCount > 1) {
      const maxParcelas = settings.maxParcelas || 12;
      paymentBody.installmentCount = Math.min(body.installmentCount, maxParcelas);
      paymentBody.installmentValue = valorFinal / (paymentBody.installmentCount as number);
    }

    if (finalBillingType === 'CREDIT_CARD' && body.creditCard) {
      paymentBody.creditCard = body.creditCard;
      // Fallback server-side: preencher creditCardHolderInfo com dados do CRM
      // quando o frontend não enviou. Mantém elegibilidade de antecipação
      // (nome + CPF obrigatórios; endereço recomendado pelo antifraude).
      const holderInfo: Record<string, unknown> = { ...(body.creditCardHolderInfo || {}) };
      if (!holderInfo.name && (payerHints.fullName || payerHints.firstName)) {
        holderInfo.name = payerHints.fullName || payerHints.firstName;
      }
      if (!holderInfo.email && payerHints.email) holderInfo.email = payerHints.email;
      if (!holderInfo.phone && payerHints.phone) holderInfo.phone = payerHints.phone;
      if (!holderInfo.cpfCnpj && payerHints.cpfCnpj) holderInfo.cpfCnpj = payerHints.cpfCnpj;
      if (payerHints.address) {
        const a = payerHints.address;
        if (!holderInfo.postalCode && a.postalCode) holderInfo.postalCode = a.postalCode;
        if (!holderInfo.address && a.street) holderInfo.address = a.street;
        if (!holderInfo.addressNumber && a.number) holderInfo.addressNumber = a.number;
        if (!holderInfo.complement && a.complement) holderInfo.complement = a.complement;
        if (!holderInfo.province && a.province) holderInfo.province = a.province;
        if (!holderInfo.city && a.city) holderInfo.city = a.city;
        if (!holderInfo.state && a.state) holderInfo.state = a.state;
      }
      paymentBody.creditCardHolderInfo = holderInfo;

      // Sincroniza CPF/endereço do titular no cadastro do customer no Asaas
      // (necessário para antecipação) — só preenche campos vazios.
      if (asaasCustomerId && (holderInfo.cpfCnpj || holderInfo.postalCode)) {
        try {
          const custResp = await fetch(`${asaasBaseUrl}/v3/customers/${asaasCustomerId}`, {
            headers: { access_token: asaasApiKey },
          });
          if (custResp.ok) {
            const cur = await custResp.json();
            const custPatch: Record<string, unknown> = {};
            if (holderInfo.cpfCnpj && !cur.cpfCnpj) custPatch.cpfCnpj = holderInfo.cpfCnpj;
            if (holderInfo.postalCode && !cur.postalCode) custPatch.postalCode = holderInfo.postalCode;
            if (holderInfo.address && !cur.address) custPatch.address = holderInfo.address;
            if (holderInfo.addressNumber && !cur.addressNumber) custPatch.addressNumber = holderInfo.addressNumber;
            if (holderInfo.complement && !cur.complement) custPatch.complement = holderInfo.complement;
            if (holderInfo.province && !cur.province) custPatch.province = holderInfo.province;
            if (holderInfo.city && !cur.city) custPatch.cityName = holderInfo.city;
            if (holderInfo.state && !cur.state) custPatch.state = holderInfo.state;
            if (holderInfo.phone && !cur.phone && !cur.mobilePhone) {
              custPatch.phone = holderInfo.phone;
              custPatch.mobilePhone = holderInfo.phone;
            }
            if (Object.keys(custPatch).length > 0) {
              console.log(`🔄 Sync customer ${asaasCustomerId} from holderInfo:`, Object.keys(custPatch));
              await fetch(`${asaasBaseUrl}/v3/customers/${asaasCustomerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
                body: JSON.stringify(custPatch),
              });
            }
          }
        } catch (e) {
          console.warn('customer sync from holderInfo failed:', e instanceof Error ? e.message : e);
        }
      }

      // Enriquece o CRM com CPF/endereço digitados no titular do cartão.
      // Idempotente — não sobrescreve dados existentes.
      if (clienteId && (holderInfo.cpfCnpj || holderInfo.postalCode)) {
        try {
          await enrichClienteIfMissing(supabase, clienteId, {
            cpfCnpj: (holderInfo.cpfCnpj as string) || null,
            cep: (holderInfo.postalCode as string) || null,
            endereco: (holderInfo.address as string) || null,
            enderecoNumero: (holderInfo.addressNumber as string) || null,
            enderecoComplemento: (holderInfo.complement as string) || null,
            bairro: (holderInfo.province as string) || null,
            cidade: (holderInfo.city as string) || null,
            uf: (holderInfo.state as string) || null,
          });
        } catch (e) {
          console.warn('enrichClienteIfMissing (holderInfo) failed:', e instanceof Error ? e.message : e);
        }
      }

      if (body.remoteIp) {
        paymentBody.remoteIp = body.remoteIp;
      }
    }

    console.log(`💳 Creating Asaas payment: ${finalBillingType}, R$ ${valor}, customer: ${asaasCustomerId}`);

    const paymentResp = await fetch(`${asaasBaseUrl}/v3/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentResp.json();

    if (!paymentResp.ok) {
      const errorMsg = paymentData.errors?.[0]?.description || 'Erro ao criar pagamento no Asaas';
      console.error('Asaas payment creation error:', paymentData);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, code: 'ASAAS_PAYMENT_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Asaas payment created: ${paymentData.id}, status: ${paymentData.status}`);

    // 4b. Get PIX QR code if billing type is PIX
    let pixData: { encodedImage?: string; payload?: string; expirationDate?: string } | null = null;
    if (finalBillingType === 'PIX') {
      const pixResp = await fetch(`${asaasBaseUrl}/v3/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: asaasApiKey },
      });
      if (pixResp.ok) {
        pixData = await pixResp.json();
        console.log('📱 PIX QR code generated');
      } else {
        console.warn('Failed to get PIX QR code:', await pixResp.text());
      }
    }

    // 4c. Get boleto URL
    let boletoUrl: string | null = null;
    if (finalBillingType === 'BOLETO') {
      boletoUrl = paymentData.bankSlipUrl || null;
    }

    // 5. Save cobrança in database
    const tipoCobranca = finalBillingType === 'CREDIT_CARD' ? 'card' 
      : finalBillingType === 'PIX' ? 'pix' 
      : 'link';

    // REGRA IMUTÁVEL: sempre inserir como 'pendente'.
    const totalParcelas = (finalBillingType === 'CREDIT_CARD' && body.installmentCount && body.installmentCount > 1) 
      ? Math.min(body.installmentCount, settings.maxParcelas || 12) 
      : 1;

    const cobrancaData: Record<string, unknown> = {
      user_id: userId,
      cliente_id: clienteId || null,
      session_id: sessionId || null,
      galeria_id: galeriaId || null,
      visitor_id: body.visitorId || null,
      valor: valor,
      status: 'pendente',
      provedor: 'asaas',
      tipo_cobranca: tipoCobranca,
      finalidade: 'fotos_extras', // cobrança de fotos extras da galeria — separa de pagamentos de sessão (Studio)
      descricao: descricao || 'Pagamento galeria',
      qtd_fotos: qtdFotos || 0,
      mp_payment_id: paymentData.id,
      data_pagamento: null,
      total_parcelas: totalParcelas,
      asaas_installment_id: paymentData.installment || null,
      dados_extras: {
        repassarTaxasProcessamento: !settings.absorverTaxa,
        repassarTaxaAntecipacao: false,
      },
      // Guardar null em vez de 0 para evitar que finalize_gallery_payment trate "snapshot ausente" como zero (bug histórico).
      snapshot_fotos_incluidas: typeof body.snapshotFotosIncluidas === 'number' && body.snapshotFotosIncluidas > 0 ? body.snapshotFotosIncluidas : null,
      snapshot_regras_congeladas: body.snapshotRegrasCongeladas || null,
      correlation_id: body.correlationId || null,
    };

    if (finalBillingType === 'PIX' && pixData) {
      cobrancaData.mp_qr_code_base64 = pixData.encodedImage;
      cobrancaData.mp_pix_copia_cola = pixData.payload;
    }

    if (finalBillingType === 'BOLETO' && boletoUrl) {
      cobrancaData.ip_checkout_url = boletoUrl;
    }

    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert(cobrancaData)
      .select('id')
      .single();

    if (cobrancaError) {
      console.error('Error saving cobrança:', cobrancaError);
    }

    console.log(`📋 Cobrança ${cobranca?.id} criada como 'pendente'.`);

    // 6. For SINGLE card payments confirmed immediately: process inline
    //    For INSTALLMENT payments: DO NOT finalize — let webhook/polling handle all parcelas
    let cardConfirmed = false;
    const isInstallment = totalParcelas > 1;
    const isCardConfirmedImmediately = finalBillingType === 'CREDIT_CARD' && cobranca?.id &&
      (paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED');

    if (isCardConfirmedImmediately && !isInstallment) {
      // Single payment (à vista) — safe to finalize inline
      console.log('💳 Cartão à vista confirmado — processando inline...');

      try {
        const detailResp = await fetch(`${asaasBaseUrl}/v3/payments/${paymentData.id}`, {
          headers: { access_token: asaasApiKey },
        });

        if (detailResp.ok) {
          const detailData = await detailResp.json();
          const netValue = detailData.netValue;
          const valorBrutoParcela = valorFinal;
          const taxaGateway = Math.round((valorBrutoParcela - (netValue || valorBrutoParcela)) * 100) / 100;

          console.log(`📊 netValue=${netValue}, valorBruto=${valorBrutoParcela}, taxa=${taxaGateway}`);

          // Upsert parcela
          const { error: parcelaError } = await supabase
            .from('cobranca_parcelas')
            .upsert({
              cobranca_id: cobranca.id,
              numero_parcela: 1,
              asaas_payment_id: paymentData.id,
              valor_bruto: valorBrutoParcela,
              valor_liquido: netValue || valorBrutoParcela,
              taxa_gateway: taxaGateway >= 0 ? taxaGateway : 0,
              status: 'confirmado',
              billing_type: 'card',
              data_pagamento: new Date().toISOString().split('T')[0],
            }, { onConflict: 'asaas_payment_id' });

          if (parcelaError) {
            console.error('❌ Erro ao upsert parcela:', parcelaError);
          } else {
            await supabase
              .from('cobrancas')
              .update({ valor_liquido: netValue || valorBrutoParcela })
              .eq('id', cobranca.id);
          }

          // Finalize via RPC
          const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
            p_cobranca_id: cobranca.id,
            p_receipt_url: null,
            p_paid_at: new Date().toISOString(),
          });

          if (rpcError) {
            console.error('❌ RPC finalize error:', rpcError);
          } else {
            console.log('✅ Pagamento à vista finalizado inline:', JSON.stringify(rpcResult));
            await notifyPaymentConfirmed(supabaseUrl, supabaseServiceKey, cobranca.id);
            cardConfirmed = true;
          }
        }
      } catch (confirmErr) {
        console.error('❌ Erro ao confirmar cartão inline:', confirmErr);
      }
    } else if (isCardConfirmedImmediately && isInstallment) {
      // Installment payment — DO NOT finalize inline
      // The webhook or check-payment-status polling will handle all parcelas
      console.log(`⏳ Cartão parcelado (${totalParcelas}x) confirmado no Asaas, mas NÃO finalizando inline.`);
      console.log(`   Installment ID: ${paymentData.installment || 'N/A'}`);
      console.log(`   O polling/webhook processará todas as parcelas.`);
    }

    // 7. Build response
    const checkoutUrl = paymentData.invoiceUrl || null;

    const response: Record<string, unknown> = {
      success: true,
      cobrancaId: cobranca?.id,
      asaasPaymentId: paymentData.id,
      provedor: 'asaas',
      billingType: finalBillingType,
      status: paymentData.status,
      checkoutUrl,
      valorOriginal: valor,
      valorCobrado: valorFinal,
      custoAntecipacao: anticipationCost,
      custoProcessamento: processingCost,
    };

    if (finalBillingType === 'PIX' && pixData) {
      response.pixQrCode = pixData.encodedImage;
      response.pixCopiaECola = pixData.payload;
      response.pixExpirationDate = pixData.expirationDate;
    }

    if (finalBillingType === 'BOLETO') {
      response.boletoUrl = boletoUrl;
    }

    if (finalBillingType === 'CREDIT_CARD') {
      response.creditCardStatus = paymentData.status;
      // Only mark as paid if single payment was finalized inline
      if (cardConfirmed) {
        response.paid = true;
      } else {
        // For installments or unconfirmed: frontend should poll
        response.paid = false;
        response.requiresPolling = true;
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Asaas gallery payment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
