import type { ColorEntry, ColorStrategy } from "@/types/flyerInsights";

/**
 * Normalizza una stringa per il confronto: uppercase e trim degli spazi multipli
 */
function normalizeKey(str: string): string {
  return str.toUpperCase().trim().replace(/\s+/g, ' ');
}

export function resolveColor(value: string, strategy: ColorStrategy): ColorEntry {
  const normalizedValue = normalizeKey(value);

  if (strategy.type === 'static') {
    // Prima prova match esatto
    if (strategy.map[normalizedValue]) {
      return strategy.map[normalizedValue];
    }
    // Altrimenti cerca normalizzando anche le chiavi della mappa
    for (const [key, colorEntry] of Object.entries(strategy.map)) {
      if (normalizeKey(key) === normalizedValue) {
        return colorEntry;
      }
    }
    return strategy.default;
  }

  if (strategy.type === 'pattern') {
    for (const matcher of strategy.matchers) {
      if (matcher.patterns.some(p => normalizedValue.includes(p.toUpperCase()))) {
        return { hex: matcher.hex, tw: matcher.tw };
      }
    }
  }

  return strategy.default;
}

export function formatTooltip(format: string, value: number, percentage: number): string {
  return format
    .replace('{value}', String(value))
    .replace('{percentage}', percentage.toFixed(1));
}
