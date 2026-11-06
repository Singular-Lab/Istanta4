import {
  type CandidatoCollegamento,
  MASSIMO_CANDIDATI,
  MASSIMO_VARIANTI,
  type MotivoCandidato,
  type RigaNonAbbinata,
  type SuggerimentoRiga,
  type VolantinoDellaRiga,
} from '../../../lib/puntiVendita/analisi';
import type { RiferimentoStoria } from '../../../lib/puntiVendita/storia';
import { raggruppaPerChiavi } from './chiaviRigheVolantino';
import { chiaveIndirizzo, chiaveLocalita, chiaveTelefono, editDistance, normalizePuntoVenditaText } from './puntoVenditaNormalization';
import { MINIMO_VOLANTINI_ASSENZA } from './storiaPuntoVendita';

/**
 * La qualità dei dati dei punti vendita nella gestione (contratto in lib/puntiVendita/analisi.ts):
 * righe dell'ultimo import Excel da rivedere e righe dei volantini che non corrispondono a nessun
 * PV dell'anagrafica, raggruppate per punto vendita stampato. Funzioni pure.
 */

/** Oltre questi minuti senza segnale un dispositivo attivo è offline, come nella gestione del PV (fra 5 e 15 è "in allerta"). */
export const MINUTI_DISPOSITIVO_OFFLINE = 15;

/**
 * Righe da rivedere dell'ultimo import Excel dei PV, dal suo avanzamento: quelle scartate o non
 * scritte (errori con il numero di riga) e quella in attesa di una decisione.
 */
export function righeDaRevisionare(avanzamento: unknown): number {
  if (!avanzamento || typeof avanzamento !== 'object') return 0;
  const { errori, rigaInAttesa } = avanzamento as { errori?: unknown; rigaInAttesa?: unknown };
  const righe = new Set<number>();
  for (const errore of Array.isArray(errori) ? errori : []) {
    const riga = Number((errore as { row?: unknown } | null)?.row);
    // La riga 0 e' l'import intero (interrotto, Nominatim fermo): non una riga da rivedere
    if (Number.isInteger(riga) && riga > 0) righe.add(riga);
  }
  return righe.size + (rigaInAttesa ? 1 : 0);
}

/** Una riga senza PV di una lista dei volantini della GDO, con il suo kit. */
export interface RigaSenzaPuntoVendita {
  idKit: string;
  /** Giorno dell'edizione (YYYY-MM-DD). */
  data: string;
  idCanale: string | null;
  nomeCanale: string | null;
  idArea: string | null;
  posizione: number;
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
  /** Kit, promo e area: per dire in quali volantini compare la riga. */
  titoloKit?: string;
  idPromo?: string;
  nomePromo?: string | null;
  nomeArea?: string | null;
}

/** Un'edizione con la lista dei PV registrata: serve a dire se una riga non compare più. */
export interface EdizioneConLista {
  idCanale: string;
  idArea: string;
  data: string;
}

/** Un punto vendita dell'anagrafica della GDO, con i campi per i suggerimenti. */
export interface PuntoVenditaPerSuggerimenti {
  id: string;
  nome: string;
  telefono: string | null;
  citta?: string | null;
  indirizzo?: string | null;
  ragioneSociale?: string | null;
}

const confronta = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Distanza oltre la quale due indirizzi della stessa località non sono più "simili". */
const DISTANZA_INDIRIZZO_SIMILE = 3;

/** La via senza civici: "VIA MURTOLA 12 14" -> "VIA MURTOLA". */
const viaSenzaCivici = (chiave: string): string => chiave.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();

/** Le parole che dicono che tipo di strada e': il nome della via e' quello che viene dopo. */
const TOPONIMI = new Set([
  'VIA', 'VIALE', 'CORSO', 'PIAZZA', 'PIAZZALE', 'PIAZZETTA', 'LARGO', 'VICOLO', 'BORGO', 'CONTRADA', 'STRADA',
  'STATALE', 'PROVINCIALE', 'REGIONALE', 'LOCALITA', 'FRAZIONE', 'LUNGOMARE', 'SALITA', 'VICO', 'PASSO',
]);

/** Una localita' o una via piu' corta non basta a suggerire un PV dal nome. */
const MINIMO_TERMINE_NOME = 3;

/** Il nome della via, senza toponimo ne' civici: "VIA MURTOLA 12 14" -> "MURTOLA". */
const nomeDellaVia = (chiave: string | null): string | null => {
  const parole = viaSenzaCivici(chiave ?? '').split(' ').filter(Boolean);
  while (parole.length > 0 && TOPONIMI.has(parole[0])) parole.shift();
  const nome = parole.join(' ');
  return nome.length >= MINIMO_TERMINE_NOME ? nome : null;
};


const ORDINE_MOTIVO: Readonly<Record<MotivoCandidato, number>> = {
  stesso_telefono: 0,
  stesso_indirizzo: 1,
  indirizzo_simile: 2,
  nome_simile: 3,
  stessa_localita: 4,
};

interface PuntoVenditaIndicizzato {
  puntoVendita: PuntoVenditaPerSuggerimenti;
  localita: string | null;
  indirizzo: string | null;
  /** Nome e ragione sociale normalizzati, fra spazi: si cercano parole intere. */
  nomi: string;
}

/**
 * I punti vendita dell'anagrafica da suggerire per un gruppo di righe non abbinate, dal motivo più
 * forte: stesso telefono, stesso indirizzo (anche in un'altra località: il volantino stampa la
 * frazione), indirizzo simile nella stessa località (stessa via o pochi caratteri di differenza),
 * nome o ragione sociale che contengono la località o la via stampate, altri PV della stessa
 * località (un trasferimento). Al massimo MASSIMO_CANDIDATI. Sono solo suggerimenti: il nome non
 * collega mai una riga da solo.
 */
class IndiceCandidati {
  private readonly perTelefono = new Map<string, PuntoVenditaIndicizzato[]>();
  private readonly perIndirizzo = new Map<string, PuntoVenditaIndicizzato[]>();
  private readonly perLocalita = new Map<string, PuntoVenditaIndicizzato[]>();
  /** Per ogni parola del nome o della ragione sociale, i PV che la contengono. */
  private readonly perParolaDelNome = new Map<string, PuntoVenditaIndicizzato[]>();

  constructor(puntiVendita: readonly PuntoVenditaPerSuggerimenti[]) {
    const aggiungi = (mappa: Map<string, PuntoVenditaIndicizzato[]>, chiave: string | null, voce: PuntoVenditaIndicizzato) => {
      if (chiave) mappa.set(chiave, [...(mappa.get(chiave) ?? []), voce]);
    };
    for (const puntoVendita of [...puntiVendita].sort((a, b) => confronta(a.nome, b.nome) || confronta(a.id, b.id))) {
      const nomi = normalizePuntoVenditaText(`${puntoVendita.nome} ${puntoVendita.ragioneSociale ?? ''}`);
      const voce = {
        puntoVendita,
        localita: chiaveLocalita(puntoVendita.citta),
        indirizzo: chiaveIndirizzo(puntoVendita.indirizzo),
        nomi: ` ${nomi} `,
      };
      aggiungi(this.perTelefono, chiaveTelefono(puntoVendita.telefono), voce);
      aggiungi(this.perIndirizzo, voce.indirizzo, voce);
      aggiungi(this.perLocalita, voce.localita, voce);
      for (const parola of new Set(nomi.split(' ').filter(Boolean))) aggiungi(this.perParolaDelNome, parola, voce);
    }
  }

  /** I PV il cui nome o la cui ragione sociale contiene il termine come parole intere. */
  private conNomeCheContiene(termine: string): PuntoVenditaIndicizzato[] {
    const [prima] = termine.split(' ');
    return (this.perParolaDelNome.get(prima) ?? []).filter(voce => voce.nomi.includes(` ${termine} `));
  }

  /** Il primo PV con il telefono di una delle righe, dalla più recente. */
  stessoTelefono(righe: readonly RigaSenzaPuntoVendita[]): PuntoVenditaPerSuggerimenti | null {
    for (const riga of [...righe].reverse()) {
      const telefono = riga.chiaveTelefono ?? chiaveTelefono(riga.telefono);
      const trovato = telefono ? this.perTelefono.get(telefono)?.[0] : undefined;
      if (trovato) return trovato.puntoVendita;
    }
    return null;
  }

  candidati(righe: readonly RigaSenzaPuntoVendita[]): CandidatoCollegamento[] {
    const scelti = new Map<string, { voce: PuntoVenditaIndicizzato; motivo: MotivoCandidato; distanza: number }>();
    const proponi = (voce: PuntoVenditaIndicizzato, motivo: MotivoCandidato, distanza = 0) => {
      const gia = scelti.get(voce.puntoVendita.id);
      if (!gia || ORDINE_MOTIVO[motivo] < ORDINE_MOTIVO[gia.motivo] || (gia.motivo === motivo && distanza < gia.distanza)) {
        scelti.set(voce.puntoVendita.id, { voce, motivo, distanza });
      }
    };
    for (const riga of righe) {
      const telefono = riga.chiaveTelefono ?? chiaveTelefono(riga.telefono);
      for (const voce of telefono ? this.perTelefono.get(telefono) ?? [] : []) proponi(voce, 'stesso_telefono');
      const indirizzo = riga.chiaveIndirizzo;
      if (indirizzo) for (const voce of this.perIndirizzo.get(indirizzo) ?? []) proponi(voce, 'stesso_indirizzo');
      const localita = chiaveLocalita(riga.localita);
      // Il nome o la ragione sociale che contengono la localita' o la via stampate: "PRA" -> "Superstore Pra"
      const termini = [localita, nomeDellaVia(indirizzo)].filter((termine): termine is string => !!termine && termine.length >= MINIMO_TERMINE_NOME);
      for (const termine of new Set(termini)) {
        for (const voce of this.conNomeCheContiene(termine)) proponi(voce, 'nome_simile');
      }
      for (const voce of localita ? this.perLocalita.get(localita) ?? [] : []) {
        if (!indirizzo || !voce.indirizzo) {
          proponi(voce, 'stessa_localita', Number.MAX_SAFE_INTEGER);
          continue;
        }
        const distanza = editDistance(voce.indirizzo, indirizzo);
        const stessaVia = viaSenzaCivici(voce.indirizzo) !== '' && viaSenzaCivici(voce.indirizzo) === viaSenzaCivici(indirizzo);
        proponi(voce, stessaVia || distanza <= DISTANZA_INDIRIZZO_SIMILE ? 'indirizzo_simile' : 'stessa_localita', distanza);
      }
    }
    return [...scelti.values()]
      .sort((a, b) =>
        ORDINE_MOTIVO[a.motivo] - ORDINE_MOTIVO[b.motivo]
        || a.distanza - b.distanza
        || confronta(a.voce.puntoVendita.nome, b.voce.puntoVendita.nome)
        || confronta(a.voce.puntoVendita.id, b.voce.puntoVendita.id))
      .slice(0, MASSIMO_CANDIDATI)
      .map(({ voce: { puntoVendita }, motivo }) => ({
        puntoVendita: {
          id: puntoVendita.id,
          nome: puntoVendita.nome,
          ragioneSociale: puntoVendita.ragioneSociale ?? null,
          indirizzo: puntoVendita.indirizzo ?? null,
          citta: puntoVendita.citta ?? null,
        },
        motivo,
      }));
  }
}

/**
 * Le righe senza PV raggruppate per punto vendita stampato (chiavi in chiaviRigheVolantino.ts:
 * stesso telefono, o stessa località e stesso indirizzo; senza né l'uno né l'altro, stesso testo).
 * Per ogni gruppo il suggerimento:
 * - 'stesso_telefono': un PV dell'anagrafica ha lo stesso telefono;
 * - 'forse_chiuso': dopo la sua ultima volta, la sua insegna e area hanno avuto almeno
 *   MINIMO_VOLANTINI_ASSENZA edizioni con la lista senza di lui;
 * - 'da_aggiungere' altrimenti.
 * E i punti vendita a cui collegarlo a mano (candidati). Dal gruppo visto più di recente.
 */
export function raggruppaRigheNonAbbinate(
  righe: readonly RigaSenzaPuntoVendita[],
  edizioniConLista: readonly EdizioneConLista[],
  puntiVendita: readonly PuntoVenditaPerSuggerimenti[],
): RigaNonAbbinata[] {
  const indice = new IndiceCandidati(puntiVendita);
  const edizioniPerInsegna = new Map<string, Set<string>>();
  for (const edizione of edizioniConLista) {
    const chiave = `${edizione.idCanale}|${edizione.idArea}`;
    edizioniPerInsegna.set(chiave, (edizioniPerInsegna.get(chiave) ?? new Set<string>()).add(edizione.data));
  }

  const suggerimento = (gruppo: readonly RigaSenzaPuntoVendita[], ultima: RigaSenzaPuntoVendita): SuggerimentoRiga => {
    const trovato = indice.stessoTelefono(gruppo);
    if (trovato) return { tipo: 'stesso_telefono', puntoVendita: { id: trovato.id, nome: trovato.nome } };
    const dopo = [...(edizioniPerInsegna.get(`${ultima.idCanale ?? ''}|${ultima.idArea ?? ''}`) ?? [])].filter(data => data > ultima.data);
    return dopo.length >= MINIMO_VOLANTINI_ASSENZA ? { tipo: 'forse_chiuso' } : { tipo: 'da_aggiungere' };
  };

  return raggruppaPerChiavi(righe)
    .map(({ righe: gruppo, chiavi }) => {
      const ordinate = [...gruppo].sort((a, b) => confronta(a.data, b.data) || confronta(a.idKit, b.idKit) || a.posizione - b.posizione);
      const ultima = ordinate[ordinate.length - 1];
      const canale: RiferimentoStoria | null = ultima.idCanale ? { id: ultima.idCanale, nome: ultima.nomeCanale ?? '' } : null;
      const varianti = [...new Set([...ordinate].reverse().map(riga => riga.riga))].slice(0, MASSIMO_VARIANTI);
      return {
        chiave: chiavi[0],
        riga: ultima.riga,
        varianti,
        localita: ultima.localita,
        indirizzo: ultima.indirizzo,
        telefono: ultima.telefono ?? [...ordinate].reverse().find(riga => riga.telefono)?.telefono ?? null,
        volantini: new Set(ordinate.map(riga => riga.idKit)).size,
        primoVolantino: ordinate[0].data,
        ultimoVolantino: ultima.data,
        canale,
        suggerimento: suggerimento(ordinate, ultima),
        candidati: indice.candidati(ordinate),
      };
    })
    .sort((a, b) => confronta(b.ultimoVolantino, a.ultimoVolantino) || b.volantini - a.volantini || confronta(a.riga, b.riga));
}

/**
 * I volantini di una riga non abbinata: quelli delle righe del gruppo che ha quella chiave, uno per
 * kit, dal più recente, con la riga com'era stampata in ciascuno. Null se nessun gruppo ha la chiave.
 */
export function volantiniDelGruppo(righe: readonly RigaSenzaPuntoVendita[], chiave: string): VolantinoDellaRiga[] | null {
  const gruppo = raggruppaPerChiavi(righe).find(candidato => candidato.chiavi.includes(chiave));
  if (!gruppo) return null;
  const perKit = new Map<string, RigaSenzaPuntoVendita>();
  for (const riga of [...gruppo.righe].sort((a, b) => a.posizione - b.posizione)) {
    if (!perKit.has(riga.idKit)) perKit.set(riga.idKit, riga);
  }
  return [...perKit.values()]
    .sort((a, b) => confronta(b.data, a.data) || confronta(a.titoloKit ?? '', b.titoloKit ?? '') || confronta(a.idKit, b.idKit))
    .map(riga => ({
      idKit: riga.idKit,
      titoloKit: riga.titoloKit ?? '',
      promo: riga.idPromo ? { id: riga.idPromo, nome: riga.nomePromo ?? '' } : null,
      data: riga.data,
      canale: riga.idCanale ? { id: riga.idCanale, nome: riga.nomeCanale ?? '' } : null,
      area: riga.idArea ? { id: riga.idArea, nome: riga.nomeArea ?? '' } : null,
      rigaStampata: riga.riga,
    }));
}
