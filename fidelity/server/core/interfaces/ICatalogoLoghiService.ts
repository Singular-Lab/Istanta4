import type { Request } from 'express';

/** Una voce del catalogo dei loghi e bolli di Istanta (FicoProcess/getLoghiBolli). */
export interface LogoDelCatalogo {
  sigla: string;
  /** Id del file in Olimpo: l'immagine si chiede a /olimpo/foto/getThumbNailOnDemand. */
  guidId: string;
  /** TipoFoto di Istanta: 2 bollino, 3 logo, 5 sfondo, 6 artwork. */
  tipo: number | null;
}

/**
 * Il catalogo dei loghi e bolli del cliente, letto da Istanta e tenuto in cache. Le sigle si
 * confrontano senza distinguere maiuscole (il catalogo di Istanta ha conad_11P, le regole conad_11p).
 * Se Istanta non risponde il catalogo e' vuoto: le linee compaiono senza logo, mai un errore.
 *
 * Istanta si chiama con il passaporto Olimpo dell'utente della richiesta, come ogni lettura di
 * Fidelity verso Istanta: senza richiesta vale solo il catalogo gia' in cache (o vuoto).
 */
export interface ICatalogoLoghiService {
  /** Sigla in minuscolo -> voce del catalogo. */
  catalogo(richiesta?: Request): Promise<Map<string, LogoDelCatalogo>>;
  /** URL dell'immagine (proxy pubblico /olimpo) della sigla, o null. */
  urlLogo(sigla: string, larghezza?: number, richiesta?: Request): Promise<string | null>;
}
