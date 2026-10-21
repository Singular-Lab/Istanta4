/**
 * Legge il guidId da un URL di una foto Olimpo. Gli URL arrivano dal server in forma
 * relativa (/olimpo/foto/...?guidId=...) o, per dati vecchi, assoluta: new URL senza
 * base fallisce sui relativi, quindi si risolve rispetto all'origine della pagina.
 * Restituisce null se l'URL non e' leggibile o non ha guidId.
 */
export function guidIdDaUrlOlimpo(url: string, base: string = baseCorrente()): string | null {
  try {
    return new URL(url, base).searchParams.get('guidId');
  } catch {
    return null;
  }
}

function baseCorrente(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
}
