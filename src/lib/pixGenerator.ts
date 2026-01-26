/**
 * PIX BR Code (EMV) Generator
 * Generates valid PIX payment codes following Brazilian Central Bank standards
 */

// CRC16-CCITT calculation (required for PIX standard)
function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Format EMV field (ID + length + value)
function emvField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

// Remove accents and special characters
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

// Normalize PIX key - add country code for phone numbers
function normalizarChavePix(chave: string): string {
  let chaveLimpa = chave.trim();
  
  // If it looks like a phone number (starts with digit), format with country code
  if (/^[0-9]/.test(chaveLimpa)) {
    // Remove non-numeric characters
    chaveLimpa = chaveLimpa.replace(/\D/g, '');
    
    // If 10 or 11 digits (Brazilian phone), add +55 country code
    if (chaveLimpa.length === 10 || chaveLimpa.length === 11) {
      chaveLimpa = '+55' + chaveLimpa;
    }
  }
  
  return chaveLimpa;
}

export interface PixPayloadParams {
  chavePix: string;
  nomeBeneficiario: string;
  valor: number;
  cidade?: string;
  identificador?: string;
}

/**
 * Generates a valid PIX EMV payload (BR Code)
 * This payload can be used to generate QR codes or as "copia e cola"
 */
export function generatePixPayload({
  chavePix,
  nomeBeneficiario,
  valor,
  cidade = 'SAO PAULO',
  identificador = '***',
}: PixPayloadParams): string {
  // Normalize PIX key (add +55 for phone numbers)
  const chaveNormalizada = normalizarChavePix(chavePix);
  
  // Format and sanitize inputs
  const nomeFormatado = normalizeText(nomeBeneficiario).substring(0, 25);
  const cidadeFormatada = normalizeText(cidade).substring(0, 15);
  const valorFormatado = valor.toFixed(2);
  const txId = identificador.substring(0, 25);

  // Build EMV payload
  let payload = '';

  // 00 - Payload Format Indicator (mandatory)
  payload += emvField('00', '01');

  // 26 - Merchant Account Information (PIX)
  // GUI must be lowercase: br.gov.bcb.pix
  const pixAccountInfo = emvField('00', 'br.gov.bcb.pix') + emvField('01', chaveNormalizada);
  payload += emvField('26', pixAccountInfo);

  // 52 - Merchant Category Code (0000 = not specified)
  payload += emvField('52', '0000');

  // 53 - Transaction Currency (986 = BRL)
  payload += emvField('53', '986');

  // 54 - Transaction Amount
  if (valor > 0) {
    payload += emvField('54', valorFormatado);
  }

  // 58 - Country Code
  payload += emvField('58', 'BR');

  // 59 - Merchant Name
  payload += emvField('59', nomeFormatado);

  // 60 - Merchant City
  payload += emvField('60', cidadeFormatada);

  // 62 - Additional Data Field (transaction ID)
  const additionalData = emvField('05', txId);
  payload += emvField('62', additionalData);

  // 63 - CRC16 (checksum - MUST be the last field)
  payload += '6304';
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
