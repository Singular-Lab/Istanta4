/**
 * CssParser.ts
 * Utility per parsare CSS text e convertire classi in stili inline
 */

export interface CssRule {
  selector: string;
  properties: Record<string, string>;
}

/**
 * Parsa una stringa CSS e restituisce una Map di classi -> proprietà
 * Supporta solo selettori di classe semplici (.className)
 */
export function parseCssText(cssText: string): Map<string, Record<string, string>> {
  const cssMap = new Map<string, Record<string, string>>();

  if (!cssText || typeof cssText !== 'string') {
    return cssMap;
  }

  // Rimuovi commenti CSS
  let cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // Rimuovi @import, @media, @keyframes e altre at-rules (semplificate)
  cleanCss = cleanCss.replace(/@[^{]+\{[^}]*\}/g, '');
  cleanCss = cleanCss.replace(/@import[^;]+;/g, '');
  cleanCss = cleanCss.replace(/@charset[^;]+;/g, '');

  // Regex per catturare regole CSS: selettore { proprietà }
  const ruleRegex = /([^{}]+)\s*\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(cleanCss)) !== null) {
    const selectorPart = match[1].trim();
    const propertiesPart = match[2].trim();

    // Gestisci selettori multipli separati da virgola
    const selectors = selectorPart.split(',').map(s => s.trim());

    for (const selector of selectors) {
      // Estrai solo selettori di classe semplici (es: .prezzo-grande)
      // Ignora selettori complessi, pseudo-classi, ecc.
      const classMatch = selector.match(/^\.([a-zA-Z_-][a-zA-Z0-9_-]*)$/);

      if (classMatch) {
        const className = classMatch[1];
        const properties = parseProperties(propertiesPart);

        // Merge con proprietà esistenti (per gestire regole duplicate)
        const existing = cssMap.get(className) || {};
        cssMap.set(className, { ...existing, ...properties });
      }
    }
  }

  return cssMap;
}

/**
 * Parsa le proprietà CSS da una stringa
 */
function parseProperties(propertiesStr: string): Record<string, string> {
  const properties: Record<string, string> = {};

  if (!propertiesStr) return properties;

  // Split per punto e virgola, gestendo valori con punto e virgola dentro (es: data URI)
  const declarations = propertiesStr.split(';');

  for (const declaration of declarations) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    // Trova il primo : per separare proprietà da valore
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const property = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();

    // Rimuovi !important se presente (lo gestiamo inline)
    value = value.replace(/\s*!important\s*$/i, '');

    if (property && value) {
      // Converti property da kebab-case a camelCase per inline styles
      properties[property] = value;
    }
  }

  return properties;
}

/**
 * Converte un array di nomi di classe in una stringa di stili inline
 * @param classNames Array di nomi di classe (senza il punto)
 * @param cssMap Map delle classi CSS parsate
 * @returns Stringa di stili inline (es: "font-size: 24px; color: red;")
 */
export function classesToInlineStyle(
  classNames: string[],
  cssMap: Map<string, Record<string, string>>
): string {
  if (!classNames || classNames.length === 0 || !cssMap) {
    return '';
  }

  const mergedProperties: Record<string, string> = {};

  for (const className of classNames) {
    // Rimuovi eventuale punto iniziale
    const cleanName = className.startsWith('.') ? className.substring(1) : className;
    const properties = cssMap.get(cleanName);

    if (properties) {
      Object.assign(mergedProperties, properties);
    }
  }

  // Converti in stringa inline
  return Object.entries(mergedProperties)
    .map(([prop, val]) => `${prop}: ${val}`)
    .join('; ');
}

/**
 * Converte un oggetto di stili React-like in stringa CSS inline
 * @param styleObj Oggetto con proprietà CSS (es: { fontSize: '24px', color: 'red' })
 * @returns Stringa di stili inline
 */
export function styleObjectToInline(styleObj: Record<string, string | number | undefined>): string {
  if (!styleObj || typeof styleObj !== 'object') {
    return '';
  }

  return Object.entries(styleObj)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([prop, value]) => {
      // Converti camelCase a kebab-case
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebabProp}: ${value}`;
    })
    .join('; ');
}

/**
 * Combina più stringhe di stili inline
 * @param styles Array di stringhe di stili inline
 * @returns Stringa combinata
 */
export function combineInlineStyles(...styles: (string | undefined | null)[]): string {
  return styles
    .filter(s => s && s.trim())
    .join('; ')
    .replace(/;+/g, ';')
    .replace(/;\s*$/, '');
}

/**
 * Escapa caratteri speciali per attributi HTML
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
