// Storage utilities for localStorage with Date serialization
// Designed for easy migration to Supabase later

const STORAGE_PREFIX = 'lunari_';

// Date serialization helpers - exported for Demo Mode
export const dateReplacer = (_key: string, value: unknown) => {
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() };
  }
  return value;
};

export const dateReviver = (_key: string, value: unknown) => {
  if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Date') {
    return new Date((value as { value: string }).value);
  }
  return value;
};

// Serialize/Deserialize with Date support - exported for Demo Mode
export function serializeWithDates<T>(value: T): string {
  return JSON.stringify(value, dateReplacer, 2);
}

export function deserializeWithDates<T>(text: string): T {
  return JSON.parse(text, dateReviver) as T;
}

export function getStorageItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (!item) return null;
    return JSON.parse(item, dateReviver) as T;
  } catch {
    console.error(`Error reading ${key} from localStorage`);
    return null;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value, dateReplacer));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage`, error);
  }
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export function isStorageInitialized(): boolean {
  return localStorage.getItem(STORAGE_PREFIX + 'initialized') === 'true';
}

export function setStorageInitialized(): void {
  localStorage.setItem(STORAGE_PREFIX + 'initialized', 'true');
}

// Generate unique IDs (similar to what Supabase would generate)
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Clear gallery storage (for migration cleanup)
export function clearGalleryStorage(): void {
  localStorage.removeItem(STORAGE_PREFIX + 'galleries');
}
