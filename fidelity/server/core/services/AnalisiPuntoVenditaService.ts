import type {
  AnalisiPuntoVendita,
  DettaglioReferenzaPv,
  DettaglioVolantinoPv,
  PaginaRigheNonAbbinate,
  QualitaPuntiVendita,
  ReteInsegne,
} from '../../../lib/puntiVendita/analisi';
import { DIMENSIONI_PAGINA_STORIA } from '../../../lib/puntiVendita/storia';
import { NotFoundError } from '../../../lib/errors';
import type { IAnalisiPuntoVenditaService } from '../interfaces/IAnalisiPuntoVenditaService';
import { log } from '../logger';
import type { IAnalisiPuntiVenditaRepository, RiepilogoDaSalvare, RigaReferenzaKit } from '../repositories/AnalisiPuntiVenditaRepository';
import type { IPuntiVenditaVolantinoRepository, PuntoVenditaDellaStoria } from '../repositories/PuntiVenditaVolantinoRepository';
import { AGGREGATI_VUOTI, aggregatiDi, type AggregatiKit, boxDelKit, riassumiKit, VERSIONE_ANALISI_KIT } from '../utils/analisiKit';
import {
  calcolaAnalisiPuntoVendita,
  calcolaReteInsegne,
  chiaveDescrizione,
  coperturaDi,
  coppieDaDescrivere,
  descrizioniRicorrenti,
  dettaglioReferenza,
  type EdizionePuntoVendita,
  edizioniDelPuntoVendita,
  kitDaDescrivere,
  MARCHE_IN_EVIDENZA,
  NUMERO_PRODOTTI_RICORRENTI,
  numeroPagine,
  pagineDelVolantino,
  presenzeDelProdotto,
  rigaDelPuntoVendita,
  scontoMedio,
  SOGLIA_PRODOTTO_FREQUENTE,
  spazioPerMeccanica,
} from '../utils/analisiPuntoVendita';
import { MINUTI_DISPOSITIVO_OFFLINE, raggruppaRigheNonAbbinate, righeDaRevisionare } from '../utils/gestionePuntiVendita';
import { leggiReferenza, type ReferenzaStampata } from '../utils/referenzaStampata';

/**
 * Le pagine del punto vendita costruite sulla timeline dei volantini (contratto in
 * lib/puntiVendita/analisi.ts): scheda del PV, volantino, referenza, rete per insegna e qualita'
 * dei dati nella gestione.
 *
 * I volantini del PV sono le sue apparizioni nelle liste (storia del PV, stessi kit validi e stessa
 * data dell'edizione). Ogni kit ha il suo riepilogo in analisi_kit; quelli che mancano o non valgono
 * piu' si calcolano dalle referenze, a blocchi, e si salvano prima di rispondere: prodotti e marche
 * si aggregano in SQL sui riepiloghi salvati. La prima scheda di un PV con molti volantini mai letti
 * e' lenta, le altre (e quelle dei PV con gli stessi volantini) no. Un salvataggio che non riesce
 * fa fallire la richiesta: senza, le statistiche dei prodotti sarebbero incomplete.
 *
 * Della scheda escono dal database solo gli aggregati di ogni kit, i risultati delle aggregazioni
 * e le descrizioni dei prodotti ricorrenti (un PV con 250 volantini: qualche centinaio di KB).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Le chiavi di ProdottoRicorrente e ReferenzaSintesi (referenzaStampata.chiaveProdotto). */
const CHIAVE_PRODOTTO = /^[cd]-[A-Za-z0-9_.~-]{1,1000}$/;

/** Kit le cui referenze si leggono in una volta quando i riepiloghi mancano. */
export const KIT_PER_LETTURA = 25;

export interface OpzioniAnalisiPuntoVendita {
  /** Il campo dei meta con cui la GDO riconosce i suoi PV (agenzia lib, import dei PV); senza, conta se i meta sono vuoti. */
  chiaveMetaPuntoVendita?: string | null;
  /** Il giorno di oggi nel calendario di Roma (YYYY-MM-DD). */
  oggi?: () => string;
}

export const oggiARoma = (adesso: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);

const leggi = (righe: readonly RigaReferenzaKit[]): ReferenzaStampata[] =>
  righe.map(riga => leggiReferenza(riga, { storico: riga.storico === true }));

/** L'ultima modifica fra le referenze lette, null se non ce ne sono. */
function ultimaModifica(righe: readonly RigaReferenzaKit[]): Date | null {
  let ultima: number | null = null;
  for (const riga of righe) {
    const istante = riga.aggiornata_il ? new Date(riga.aggiornata_il).getTime() : Number.NaN;
    if (Number.isFinite(istante) && (ultima === null || istante > ultima)) ultima = istante;
  }
  return ultima === null ? null : new Date(ultima);
}

export class AnalisiPuntoVenditaService implements IAnalisiPuntoVenditaService {
  private readonly chiaveMeta: string | null;
  private readonly oggi: () => string;

  constructor(
    private readonly repository: IAnalisiPuntiVenditaRepository,
    private readonly storia: Pick<IPuntiVenditaVolantinoRepository, 'trovaPuntoVendita' | 'apparizioni'>,
    opzioni: OpzioniAnalisiPuntoVendita = {},
  ) {
    this.chiaveMeta = opzioni.chiaveMetaPuntoVendita?.trim() || null;
    this.oggi = opzioni.oggi ?? (() => oggiARoma());
  }

  // ─── PV e kit ──────────────────────────────────────────────────────

  /** Il PV, se esiste ed e' della GDO indicata: un PV di un'altra GDO risponde come inesistente. */
  private async puntoVenditaDellaGdo(idPuntoVendita: string, idGdo: string | null): Promise<PuntoVenditaDellaStoria> {
    const puntoVendita = UUID.test(idPuntoVendita) ? await this.storia.trovaPuntoVendita(idPuntoVendita) : null;
    if (!puntoVendita || (idGdo !== null && puntoVendita.idGdo !== idGdo)) {
      throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: idPuntoVendita });
    }
    return puntoVendita;
  }

  private async edizioni(idPuntoVendita: string): Promise<EdizionePuntoVendita[]> {
    return edizioniDelPuntoVendita(await this.storia.apparizioni(idPuntoVendita));
  }

  /**
   * Gli aggregati dei kit: quelli dei riepiloghi salvati e validi, gli altri da riepiloghi calcolati
   * ora e salvati. All'uscita ogni kit indicato ha il suo riepilogo valido in analisi_kit.
   */
  private async aggregati(idKit: readonly string[]): Promise<Map<string, AggregatiKit>> {
    const unici = [...new Set(idKit)];
    if (unici.length === 0) return new Map();
    const aggregati = await this.repository.aggregatiKit(unici, VERSIONE_ANALISI_KIT);
    const mancanti = unici.filter(id => !aggregati.has(id));
    if (mancanti.length > 0) log.info('Analisi PV: riepiloghi dei kit da calcolare', { kit: mancanti.length });
    for (let inizio = 0; inizio < mancanti.length; inizio += KIT_PER_LETTURA) {
      const blocco = mancanti.slice(inizio, inizio + KIT_PER_LETTURA);
      const perKit = new Map<string, RigaReferenzaKit[]>();
      for (const riga of await this.repository.referenzeDeiKit(blocco)) {
        const delKit = perKit.get(riga.id_runtime_kit);
        if (delKit) delKit.push(riga);
        else perKit.set(riga.id_runtime_kit, [riga]);
      }
      const nuovi: RiepilogoDaSalvare[] = blocco.map((id) => {
        const righe = perKit.get(id) ?? [];
        const riepilogo = riassumiKit(leggi(righe));
        aggregati.set(id, aggregatiDi(riepilogo.dati));
        return { idKit: id, versione: VERSIONE_ANALISI_KIT, riepilogo, referenzeAl: ultimaModifica(righe) };
      });
      await this.repository.salvaRiepiloghi(nuovi);
    }
    return aggregati;
  }

  // ─── Scheda, volantino, referenza ──────────────────────────────────

  async analisi(idPuntoVendita: string, idGdo: string | null): Promise<AnalisiPuntoVendita> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const edizioni = await this.edizioni(puntoVendita.id);
    const aggregati = await this.aggregati(edizioni.map(edizione => edizione.idKit));
    const statistiche = await this.repository.statisticheProdotti(
      edizioni.map(edizione => ({ idKit: edizione.idKit, data: edizione.data })),
      { soglia: SOGLIA_PRODOTTO_FREQUENTE, ricorrenti: NUMERO_PRODOTTI_RICORRENTI, marche: MARCHE_IN_EVIDENZA },
    );
    const descrizioni = descrizioniRicorrenti(statistiche.ricorrenti, await this.repository.descrizioniProdotti(coppieDaDescrivere(statistiche.ricorrenti)));
    return calcolaAnalisiPuntoVendita(puntoVendita.id, edizioni, aggregati, statistiche, descrizioni, this.oggi());
  }

  async volantino(idPuntoVendita: string, idKit: string, idGdo: string | null): Promise<DettaglioVolantinoPv> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const edizioni = UUID.test(idKit) ? await this.edizioni(puntoVendita.id) : [];
    const indice = edizioni.findIndex(edizione => edizione.idKit.toLowerCase() === idKit.toLowerCase());
    const nonTrovato = () => new NotFoundError({ message: 'Volantino non trovato nella storia del punto vendita', entityType: 'RuntimeKit', entityId: idKit });
    if (indice < 0) throw nonTrovato();
    const edizione = edizioni[indice];
    const precedente = indice > 0 ? edizioni[indice - 1] : null;
    const successivo = indice < edizioni.length - 1 ? edizioni[indice + 1] : null;

    const [kit, righe, lista, riepiloghiPrecedente] = await Promise.all([
      this.repository.kitDelVolantino(edizione.idKit),
      this.repository.referenzeDeiKit([edizione.idKit]),
      this.repository.listaDelVolantino(edizione.idKit),
      precedente ? this.aggregati([precedente.idKit]) : Promise.resolve(new Map<string, AggregatiKit>()),
    ]);
    if (!kit) throw nonTrovato();
    const referenze = leggi(righe);
    const box = boxDelKit(referenze);
    const { dati: riepilogo } = riassumiKit(referenze, box);
    const pagine = numeroPagine(kit.pdf?.pagine ?? null, box);
    const manuali = kit.storico ? kit.manuali ?? 0 : null;

    return {
      kit: { id: kit.id, titolo: kit.titolo },
      promo: edizione.promo,
      canale: edizione.canale,
      area: edizione.area,
      pdf: kit.pdf,
      numeri: {
        pagine,
        referenze: riepilogo.referenze,
        // Import precedenti senza il conteggio: dal listino sono quelle non compilate a mano
        daListino: kit.storico ? kit.daListino ?? Math.max(0, riepilogo.referenze - (manuali ?? 0)) : null,
        manuali,
        scontoMedio: scontoMedio(riepilogo.sconto),
        scontoMedioPrecedente: precedente ? scontoMedio((riepiloghiPrecedente.get(precedente.idKit) ?? AGGREGATI_VUOTI).sconto) : null,
        fidelity: riepilogo.fidelity,
        puntiVenditaInLista: lista.length,
        puntiVenditaAbbinati: lista.filter(riga => riga.idPuntoVendita !== null).length,
      },
      pagine: pagineDelVolantino(box, pagine),
      meccaniche: spazioPerMeccanica(box),
      rigaPuntoVendita: rigaDelPuntoVendita(lista, puntoVendita.id),
      precedente: precedente ? { idKit: precedente.idKit, dal: precedente.promo.validitaDal ?? precedente.data } : null,
      successivo: successivo ? { idKit: successivo.idKit, dal: successivo.promo.validitaDal ?? successivo.data } : null,
      copertura: coperturaDi(riepilogo.copertura, riepilogo.referenze),
    };
  }

  async referenza(idPuntoVendita: string, chiave: string, idGdo: string | null): Promise<DettaglioReferenzaPv> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const nonTrovata = () => new NotFoundError({ message: 'Referenza non trovata nei volantini del punto vendita', entityType: 'Referenza', entityId: chiave });
    if (!CHIAVE_PRODOTTO.test(chiave)) throw nonTrovata();
    const edizioni = await this.edizioni(puntoVendita.id);
    const idKit = edizioni.map(edizione => edizione.idKit);
    // I riepiloghi di tutti i volantini del PV, poi solo il prodotto cercato in ognuno
    await this.aggregati(idKit);
    const presenze = presenzeDelProdotto(edizioni, await this.repository.presenzeProdotto(idKit, chiave));
    if (presenze.length === 0) throw nonTrovata();

    // Intestazione e posizione dall'ultimo volantino che la contiene, riletto per intero; le foto
    // delle presenze dalle descrizioni dei volantini piu' recenti che ne hanno una
    const ultimo = presenze[0].edizione.idKit;
    const [righe, kit, trovate] = await Promise.all([
      this.repository.referenzeDeiKit([ultimo]),
      this.repository.kitDelVolantino(ultimo),
      this.repository.descrizioniProdotti(kitDaDescrivere(presenze).map(id => ({ idKit: id, chiave }))),
    ]);
    const descrizioni = new Map(presenze.flatMap(({ edizione }) => {
      const descrizione = trovate.get(chiaveDescrizione(edizione.idKit, chiave));
      return descrizione ? [[edizione.idKit, descrizione] as const] : [];
    }));
    const box = boxDelKit(leggi(righe));
    return dettaglioReferenza(chiave, presenze, { box, pagine: numeroPagine(kit?.pdf?.pagine ?? null, box) }, descrizioni);
  }

  // ─── Elenco e gestione ─────────────────────────────────────────────

  async reteInsegne(idGdo: string): Promise<ReteInsegne> {
    const [canali, liste] = await Promise.all([
      this.repository.canaliConPuntiVendita(idGdo),
      this.repository.puntiVenditaNelleListe(idGdo),
    ]);
    return calcolaReteInsegne(canali, liste);
  }

  async qualita(idGdo: string): Promise<QualitaPuntiVendita> {
    const grezza = await this.repository.qualita(idGdo, this.chiaveMeta, MINUTI_DISPOSITIVO_OFFLINE);
    return {
      totale: grezza.totale,
      senzaCoordinate: grezza.senzaCoordinate,
      senzaCodice: grezza.senzaCodice,
      righeDaRevisionare: righeDaRevisionare(grezza.ultimoImport),
      conStoria: grezza.conStoria,
      dispositiviOffline: grezza.dispositiviOffline,
    };
  }

  async righeNonAbbinate(idGdo: string, pagina = 1, dimensione = DIMENSIONI_PAGINA_STORIA[0]): Promise<PaginaRigheNonAbbinate> {
    const perPagina = DIMENSIONI_PAGINA_STORIA.includes(dimensione) ? dimensione : DIMENSIONI_PAGINA_STORIA[0];
    const numeroPagina = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
    const [righe, edizioni, puntiVendita] = await Promise.all([
      this.repository.righeSenzaPuntoVendita(idGdo),
      this.repository.edizioniConLista(idGdo),
      this.repository.puntiVenditaConTelefono(idGdo),
    ]);
    const gruppi = raggruppaRigheNonAbbinate(righe, edizioni, puntiVendita);
    return {
      righe: gruppi.slice((numeroPagina - 1) * perPagina, numeroPagina * perPagina),
      totale: gruppi.length,
      pagina: numeroPagina,
      dimensione: perPagina,
    };
  }
}
