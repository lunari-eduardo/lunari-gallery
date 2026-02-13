/**
 * Retry utility with exponential backoff for resilient network operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryableErrors?: string[];
  signal?: AbortSignal;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const defaultRetryableErrors = [
  'FunctionsFetchError',
  'FunctionsHttpError', 
  'TIMEOUT',
  'NETWORK',
  'fetch',
  'Failed to fetch',
  '500',
  '502',
  '503',
  '504',
  'ECONNRESET',
  'ETIMEDOUT',
];

/**
 * Executes a function with automatic retry and exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryableErrors = defaultRetryableErrors,
    signal,
    onRetry,
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('Cancelado');
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const errorString = `${lastError.name} ${lastError.message}`;
      const isRetryable = retryableErrors.some(
        (e) => errorString.toLowerCase().includes(e.toLowerCase())
      );

      // Don't retry if not retryable or last attempt
      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      console.log(
        `[retryWithBackoff] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${Math.round(delay)}ms...`
      );

      onRetry?.(attempt, lastError, delay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Get user-friendly error message for upload errors
 */
export function getUploadErrorMessage(error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return 'Tempo esgotado. Tente com arquivos menores ou conexão mais estável.';
  }
  if (msg.includes('500') || msg.includes('internal')) {
    return 'Erro no servidor. Tentando novamente...';
  }
  if (msg.includes('413') || msg.includes('too large') || msg.includes('payload')) {
    return 'Arquivo muito grande. Máximo: 20MB';
  }
  if (msg.includes('401') || msg.includes('auth') || msg.includes('não autenticado')) {
    return 'Sessão expirada. Faça login novamente.';
  }
  if (msg.includes('403') || msg.includes('permission') || msg.includes('permissão')) {
    return 'Sem permissão para enviar fotos.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
    return 'Erro de conexão. Verifique sua internet.';
  }

  return 'Erro ao enviar. Verifique sua conexão.';
}

/**
 * Get optimal batch size based on network connection quality
 */
export function getOptimalBatchSize(): number {
  // Check if Network Information API is available
  const connection = (navigator as any).connection;

  if (!connection) {
    return 3; // Default fallback
  }

  const effectiveType = connection.effectiveType;

  switch (effectiveType) {
    case '4g':
      return 5;
    case '3g':
      return 2;
    case '2g':
    case 'slow-2g':
      return 1;
    default:
      return 3;
  }
}
