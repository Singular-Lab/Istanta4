import { STATO_PROMO } from '../enums';

/**
 * Contratto fra il server e la sezione "Storia" della scheda di un punto vendita.
 *
 * La storia nasce dalle liste dei punti vendita stampate nei volantini: il Plugin InDesign
 * manda il testo della lista (campo `pv` di /external/sync_json_plugin, o un export JSON
 * importato dalla gestione dei punti vendita), Fidelity ne ricava una riga per ogni punto
 * vendita di ogni volantino (tabella punti_vendita_volantino) e la abbina al punto vendita
 * dell'anagrafica. L'anagrafica non viene mai modificata dai volantini.
 *
 * Endpoint:
 * - GET  /api/punti-vendita/:id/storia                      "gdo.visualizza"  -> StoriaPuntoVendita
 * - GET  /api/punti-vendita/:id/storia/volantini            "gdo.visualizza"  pagina, dimensione -> PaginaVolantiniStoria
 * - POST /api/punti-vendita/storia/import-export            "gdo.gestisci_punti_vendita"
 *                                                            multipart, campo `file` ripetuto (export .json del Plugin)
 *                                                            -> EsitoImportExport
 * Un punto vendita di un'altra GDO risponde come inesistente (404).
 */

/** Come una riga del volantino e' stata collegata al punto vendita dell'anagrafica. */
export type TipoAbbinamento = 'telefono' | 'indirizzo' | 'probabile';

export interface RiferimentoStoria {
  id: string;
  nome: string;
}

export interface PromoStoria {
  id: string;
  nome: string;
  stato: STATO_PROMO;
  /** Date ISO (YYYY-MM-DD). */
  validitaDal: string | null;
  validitaAl: string | null;
}

/** Il punto vendita in un volantino: come era stampato e in quale edizione. */
export interface VolantinoNellaStoria {
  idKit: string;
  titoloKit: string;
  promo: PromoStoria;
  /** Il canale del kit: per le GDO come CONAD CNO e' l'insegna. */
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
  /** La riga della lista cosi' come era stampata. */
  rigaStampata: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  abbinamento: TipoAbbinamento;
  /** Referenze del kit, se si possono contare. */
  numeroReferenze: number | null;
  /** PDF del volantino nel kit, se c'e'. */
  pdf: { idFile: string; idOlimpoCloud: string; nome: string; pagine: number | null } | null;
}

/** Un tratto di tempo con la stessa insegna (canale) e la stessa area. */
export interface PeriodoInsegna {
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
  dal: string;
  al: string;
  volantini: number;
}

/** Un tratto di tempo con lo stesso indirizzo e lo stesso telefono stampati. */
export interface PeriodoRecapito {
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  dal: string;
  al: string;
  volantini: number;
  /** Indirizzo o telefono diversi da quelli attuali dell'anagrafica. */
  diversoDallAttuale: boolean;
}

export type EventoStoria =
  | { tipo: 'cambio_insegna'; data: string; da: RiferimentoStoria; a: RiferimentoStoria }
  | { tipo: 'cambio_area'; data: string; da: RiferimentoStoria; a: RiferimentoStoria }
  | { tipo: 'cambio_indirizzo'; data: string; da: string; a: string }
  | { tipo: 'cambio_telefono'; data: string; da: string; a: string }
  /** Non compare piu' negli ultimi volantini della sua insegna e della sua area, che invece continuano. */
  | { tipo: 'assente'; dal: string; volantiniSenza: number };

export interface AnnoStoria {
  anno: number;
  volantini: number;
  insegne: Array<{ canale: RiferimentoStoria; area: RiferimentoStoria; volantini: number }>;
}

export interface StoriaPuntoVendita {
  idPuntoVendita: string;
  /** Null se il punto vendita non compare in nessun volantino. */
  sintesi: {
    primoVolantino: string;
    ultimoVolantino: string;
    numeroVolantini: number;
    insegne: RiferimentoStoria[];
  } | null;
  anni: AnnoStoria[];
  insegne: PeriodoInsegna[];
  recapiti: PeriodoRecapito[];
  /** Dal piu' recente. */
  eventi: EventoStoria[];
}

export const DIMENSIONI_PAGINA_STORIA: readonly number[] = [10, 25, 50];

export interface PaginaVolantiniStoria {
  /** Dal piu' recente. */
  volantini: VolantinoNellaStoria[];
  totale: number;
  pagina: number;
  dimensione: number;
}

/** Esito di un export JSON importato dalla gestione dei punti vendita. */
export interface EsitoFileExport {
  nomeFile: string;
  esito: 'registrato' | 'scartato';
  /** Perche' il file e' stato scartato. */
  motivo?: string;
  promo?: RiferimentoStoria;
  kit?: RiferimentoStoria;
  righe: number;
  abbinate: number;
}

export interface EsitoImportExport {
  file: EsitoFileExport[];
  registrati: number;
  scartati: number;
  righe: number;
  abbinate: number;
}
