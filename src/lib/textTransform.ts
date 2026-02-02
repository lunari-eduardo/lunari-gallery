import { TitleCaseMode } from '@/types/gallery';

// Conjunctions to keep lowercase in title case (Portuguese)
const CONJUNCTIONS = ['e', 'de', 'da', 'do', 'das', 'dos', 'com', 'em', 'para', 'a', 'o', 'as', 'os'];

/**
 * Applies text transformation based on the selected mode
 * - normal: Text as typed
 * - uppercase: ALL CAPS
 * - titlecase: Smart capitalization (first word + non-conjunctions capitalized)
 */
export function applyTitleCase(text: string, mode: TitleCaseMode = 'normal'): string {
  if (!text) return text;
  
  switch (mode) {
    case 'uppercase':
      return text.toUpperCase();
    case 'titlecase':
      return text
        .toLowerCase()
        .split(' ')
        .map((word, index) => {
          // First word is always capitalized
          if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
          // Conjunctions stay lowercase
          if (CONJUNCTIONS.includes(word)) return word;
          // Other words get capitalized
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    default:
      return text;
  }
}
