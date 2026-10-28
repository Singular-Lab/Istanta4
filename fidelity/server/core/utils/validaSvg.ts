/**
 * Controlla che un'icona SVG non contenga contenuto attivo prima di salvarla.
 *
 * L'icona e' resa con <img> e servita con CSP sandbox, quindi oggi gli script non
 * girerebbero comunque: il controllo evita di conservare file che diventerebbero
 * pericolosi se un giorno venissero inseriti inline o aperti in altro modo.
 * Restituisce il motivo del rifiuto, o null se l'SVG e' accettabile.
 */
export function motivoSvgNonValido(contenuto: string): string | null {
  const svg = contenuto.replace(/^\uFEFF/, '');

  if (!/<svg[\s>]/i.test(svg)) {
    return "Il file non contiene un elemento <svg>";
  }

  const vietati: Array<[RegExp, string]> = [
    [/<!DOCTYPE|<!ENTITY/i, 'dichiarazioni DOCTYPE o ENTITY'],
    [/<script[\s>/]/i, 'elementi <script>'],
    [/<(foreignObject|iframe|embed|object)[\s>/]/i, 'contenuti esterni incorporati'],
    [/\son[a-z]+\s*=/i, 'gestori di eventi (on...)'],
    [/javascript\s*:/i, 'URL javascript:'],
    [/@import/i, 'fogli di stile esterni'],
  ];
  for (const [regola, descrizione] of vietati) {
    if (regola.test(svg)) {
      return `L'SVG contiene ${descrizione}`;
    }
  }

  // Riferimenti ammessi solo interni al documento (#id) o immagini incorporate
  const href = /(?:xlink:)?href\s*=\s*["']\s*([^"']*)["']/gi;
  for (const [, valore] of svg.matchAll(href)) {
    if (!valore.startsWith('#') && !/^data:image\/(png|jpe?g|gif|webp);/i.test(valore)) {
      return "L'SVG contiene riferimenti a risorse esterne";
    }
  }

  return null;
}
