-- Fix existing cobrança 06a37968 with the correct asaas_installment_id from webhook logs
UPDATE cobrancas 
SET asaas_installment_id = '8bf21696-9ed0-4f28-b800-c289b6a764eb'
WHERE id = '06a37968-9f8e-454a-b34e-55dc117dc3c3'
  AND asaas_installment_id IS NULL;