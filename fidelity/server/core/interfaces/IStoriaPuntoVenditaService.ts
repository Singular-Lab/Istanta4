import type { EsitoImportExport, PaginaVolantiniStoria, StoriaPuntoVendita } from '../../../lib/puntiVendita/storia';

/** Lista dei punti vendita di un volantino da registrare: dal sync del Plugin o da un suo export. */
export interface ListaVolantinoDaRegistrare {
  idKit: string;
  /** Testo della lista come lo manda il Plugin. */
  pv?: unknown;
  /** Lista gia' divisa in gruppi, se un plugin la manda. */
  pvData?: unknown;
  nomeFile?: string | null;
  /** GDO della sessione: vale solo se quella del kit non si trova. */
  idGdoRiserva?: string | null;
}

export interface EsitoListaVolantino {
  /** False se la lista era vuota: le righe gia' registrate per il kit restano. */
  registrata: boolean;
  righe: number;
  abbinate: number;
  nonAbbinate: number;
}

export interface OpzioniRiabbinamento {
  /** Solo le righe di questi kit: liste appena registrate, l'anagrafica non e' cambiata. */
  soloKit?: readonly string[];
}

/** Un export JSON del Plugin caricato dalla gestione dei punti vendita. */
export interface FileExportPlugin {
  nomeFile: string;
  leggi(): Promise<string>;
}

/**
 * Chi deve sapere di dover riabbinare le righe dei volantini di una GDO: il servizio dei PV dopo
 * aver creato o modificato un punto vendita.
 */
export interface RiabbinamentoPuntiVenditaVolantino {
  /** Riabbinamento in background, raccolto con le altre richieste della stessa GDO; non lancia mai. */
  pianificaRiabbinamento(idGdo: string): void;
}

export interface IStoriaPuntoVenditaService extends RiabbinamentoPuntiVenditaVolantino {
  /**
   * Registra la lista di un volantino: sostituisce le righe del kit e le abbina all'anagrafica.
   * Una lista vuota (o senza voci riconosciute) non tocca le righe gia' registrate.
   */
  registraListaVolantino(lista: ListaVolantinoDaRegistrare): Promise<EsitoListaVolantino>;
  /**
   * Abbina le righe della GDO ancora senza PV (anche quelle rimaste senza perche' il loro PV e' stato
   * eliminato). Le righe gia' collegate non si toccano: quando il PV cambia indirizzo, telefono o
   * insegna la sua storia resta sua. Le richieste per la stessa GDO si eseguono una alla volta.
   */
  riabbina(idGdo: string, opzioni?: OpzioniRiabbinamento): Promise<{ esaminate: number; cambiate: number }>;
  /** NotFoundError se il PV non c'e' o non e' della GDO indicata (null: qualunque GDO). */
  getStoria(idPuntoVendita: string, idGdo: string | null): Promise<StoriaPuntoVendita>;
  getVolantini(idPuntoVendita: string, idGdo: string | null, pagina?: number, dimensione?: number): Promise<PaginaVolantiniStoria>;
  /** Registra le liste degli export JSON del Plugin: mai referenze, PDF o anagrafica. */
  importaExport(file: readonly FileExportPlugin[], idGdo: string): Promise<EsitoImportExport>;
}
