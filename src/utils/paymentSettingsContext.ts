/**
 * Payment Settings Context Utility
 * 
 * Manages per-project settings within the shared `dados_extras` JSON.
 * Each project (gestao/gallery) stores its own settings in a sub-object,
 * with root-level fields as fallback for backward compatibility.
 */

export type SettingsContext = 'gestao' | 'gallery';

/** Fields that can be migrated between projects (operational only, never credentials) */
const ASAAS_MIGRATABLE_FIELDS = [
  'habilitarPix', 'habilitarCartao', 'habilitarBoleto',
  'maxParcelas', 'absorverTaxa',
  'ireiAntecipar', 'repassarTaxaAntecipacao', 'incluirTaxaAntecipacao',
] as const;

const MP_MIGRATABLE_FIELDS = [
  'habilitarPix', 'habilitarCartao',
  'maxParcelas', 'absorverTaxa',
] as const;

type MigratableFields = Record<string, any>;

/**
 * Extracts settings for a specific context, falling back to root-level fields.
 */
export function getContextSettings<T extends MigratableFields>(
  dadosExtras: any,
  context: SettingsContext
): T {
  if (!dadosExtras) return {} as T;
  
  const contextKey = `${context}_settings`;
  const contextSettings = dadosExtras[contextKey];
  
  if (contextSettings && typeof contextSettings === 'object') {
    // Merge: context-specific overrides root-level
    const root = { ...dadosExtras };
    delete root.gestao_settings;
    delete root.gallery_settings;
    return { ...root, ...contextSettings } as T;
  }
  
  // No context-specific settings yet — use root as-is
  const root = { ...dadosExtras };
  delete root.gestao_settings;
  delete root.gallery_settings;
  return root as T;
}

/**
 * Writes settings for a specific context back into dados_extras.
 * Also syncs root-level fields for backward compatibility with webhooks/Edge Functions.
 */
export function setContextSettings(
  dadosExtras: any,
  context: SettingsContext,
  settings: MigratableFields,
  provider: 'asaas' | 'mercadopago'
): any {
  const result = { ...(dadosExtras || {}) };
  const contextKey = `${context}_settings`;
  const fields = provider === 'asaas' ? ASAAS_MIGRATABLE_FIELDS : MP_MIGRATABLE_FIELDS;
  
  // Extract only migratable fields for the context sub-object
  const contextObj: MigratableFields = {};
  for (const field of fields) {
    if (field in settings) {
      contextObj[field] = settings[field];
    }
  }
  
  // Store in context sub-object
  result[contextKey] = { ...(result[contextKey] || {}), ...contextObj };
  
  // Sync root-level fields (for webhooks/Edge Functions)
  for (const field of fields) {
    if (field in settings) {
      result[field] = settings[field];
    }
  }
  
  // Also propagate non-migratable fields to root (e.g., environment, taxaAntecipacao*)
  for (const [key, value] of Object.entries(settings)) {
    if (!(fields as readonly string[]).includes(key)) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Copies migratable settings from one context to another.
 * Returns the updated dados_extras.
 */
export function migrateSettings(
  dadosExtras: any,
  from: SettingsContext,
  to: SettingsContext,
  provider: 'asaas' | 'mercadopago'
): any {
  const sourceSettings = getContextSettings<MigratableFields>(dadosExtras, from);
  const fields = provider === 'asaas' ? ASAAS_MIGRATABLE_FIELDS : MP_MIGRATABLE_FIELDS;
  
  const migrated: MigratableFields = {};
  for (const field of fields) {
    if (field in sourceSettings) {
      migrated[field] = sourceSettings[field];
    }
  }
  
  return setContextSettings(dadosExtras, to, migrated, provider);
}

/**
 * Checks if settings for the "other" project exist (i.e., migration is possible).
 */
export function hasOtherContextSettings(
  dadosExtras: any,
  otherContext: SettingsContext
): boolean {
  if (!dadosExtras) return false;
  const contextKey = `${otherContext}_settings`;
  return dadosExtras[contextKey] && typeof dadosExtras[contextKey] === 'object' 
    && Object.keys(dadosExtras[contextKey]).length > 0;
}

/**
 * Checks if settings differ between two contexts.
 */
export function settingsDiverge(
  dadosExtras: any,
  provider: 'asaas' | 'mercadopago'
): boolean {
  if (!dadosExtras) return false;
  
  const gestao = dadosExtras.gestao_settings;
  const gallery = dadosExtras.gallery_settings;
  
  if (!gestao || !gallery) return false;
  
  const fields = provider === 'asaas' ? ASAAS_MIGRATABLE_FIELDS : MP_MIGRATABLE_FIELDS;
  
  for (const field of fields) {
    if (field in gestao && field in gallery && gestao[field] !== gallery[field]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Returns a human-readable summary of what differs between contexts.
 */
export function getDivergenceSummary(
  dadosExtras: any,
  provider: 'asaas' | 'mercadopago'
): string[] {
  if (!dadosExtras) return [];
  
  const gestao = dadosExtras.gestao_settings;
  const gallery = dadosExtras.gallery_settings;
  
  if (!gestao || !gallery) return [];
  
  const diffs: string[] = [];
  const fields = provider === 'asaas' ? ASAAS_MIGRATABLE_FIELDS : MP_MIGRATABLE_FIELDS;
  
  const labels: Record<string, string> = {
    habilitarPix: 'PIX',
    habilitarCartao: 'Cartão',
    habilitarBoleto: 'Boleto',
    maxParcelas: 'Parcelas',
    absorverTaxa: 'Absorver taxa',
    ireiAntecipar: 'Antecipação',
    repassarTaxaAntecipacao: 'Repassar antecipação',
    incluirTaxaAntecipacao: 'Incluir antecipação',
  };
  
  for (const field of fields) {
    if (field in gestao && field in gallery && gestao[field] !== gallery[field]) {
      diffs.push(labels[field] || field);
    }
  }
  
  return diffs;
}
