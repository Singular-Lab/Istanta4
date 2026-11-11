import {
  type CombinazioneRiga,
  type ConfrontoConPuntoVendita,
  DISTANZA_COERENTE_M,
  DISTANZA_INCONGRUENTE_COMUNE_M,
  DISTANZA_INCONGRUENTE_M,
  ESITI_VERIFICA,
  type EsitoVerifica,
  type GruppoCollegato,
  MASSIMO_VARIANTI,
  type MotivoVerifica,
  type PosizioneRiga,
  type PuntoVenditaConfrontato,
  type PuntoVenditaVicino,
  RAGGIO_VICINI_M,
  type TipoCollegamento,
} from '../../../lib/puntiVendita/analisi';
import type { TipoAbbinamento } from '../../../lib/puntiVendita/storia';
import { raggruppaPerChiavi, type RegolaCollegamento, RegoleCollegamento } from './chiaviRigheVolantino';
import {
  chiaveCombinazione,
  combinazioniDelleRighe,
  confronta,
  coordinate,
  datiStampati,
  formattaDistanza,
  nomeCombinazione,
  posizioneDelGruppo,
  type PuntoVenditaDaConfrontare,
  puntoVenditaConfrontato,
} from './confrontoPuntiVendita';
import { IndiceCandidati, ordinaRighe, type RigaSenzaPuntoVendita } from './gestionePuntiVendita';

/**
 * La verifica dei collegamenti fra le righe dei volantini e i punti vendita dell'anagrafica
 * (contratto in lib/puntiVendita/analisi.ts, GruppoCollegato): le righe collegate a un PV, a mano o
 * automaticamente, raggruppate per punto vendita stampato, con l'esito e i motivi. Funzioni pure:
 * la verifica non cambia collegamenti né anagrafica.
 *
 * Incongruente: il PV non ha la combinazione di nessuno dei volantini; la distanza supera
 * DISTANZA_INCONGRUENTE_M (DISTANZA_INCONGRUENTE_COMUNE_M con la sola posizione del comune); nello
 * stesso volantino un'altra riga stampata in modo diverso va allo stesso PV.
 * Da verificare: distanza fra DISTANZA_COERENTE_M e DISTANZA_INCONGRUENTE_M, località diversa, un
 * PV della stessa combinazione più vicino, abbinamento probabile, telefono e indirizzo diversi.
 */

/** Un PV più vicino conta solo se lo è di almeno tanto: nello stesso centro commerciale non dice niente. */
const SCARTO_PIU_VICINO_M = 100;
/** PV vicini mostrati per gruppo. */
const MASSIMO_VICINI = 3;

/** Una riga collegata a un PV, con il suo kit. */
export interface RigaCollegata extends RigaSenzaPuntoVendita {
  id: string;
  idPuntoVendita: string;
  abbinamento: TipoAbbinamento | null;
}

const ORDINE_ESITO: Readonly<Record<EsitoVerifica, number>> = { incongruente: 0, da_verificare: 1, coerente: 2 };
const ORDINE_ABBINAMENTO: readonly TipoAbbinamento[] = ['manuale', 'telefono', 'indirizzo', 'probabile'];

const confrontaTesto = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const ETICHETTA_PRECISIONE: Readonly<Record<string, string>> = {
  civico: 'al civico',
  via: 'della via',
  comune: 'del solo comune',
};

/** I dati di un gruppo che servono all'esito, oltre al confronto. */
export interface DatiEsito {
  confronto: ConfrontoConPuntoVendita;
  posizione: PosizioneRiga | null;
  puntoVendita: PuntoVenditaConfrontato;
  combinazioni: readonly CombinazioneRiga[];
  localita: string | null;
  abbinamenti: readonly TipoAbbinamento[];
  /** Le altre righe dello stesso volantino collegate allo stesso PV. */
  stessoVolantino: ReadonlyArray<{ riga: string; volantino: string }>;
  vicini: readonly PuntoVenditaVicino[];
}

/** L'esito di un gruppo e i suoi motivi, dal più grave. */
export function esitoDelGruppo(dati: DatiEsito): { esito: EsitoVerifica; motivi: MotivoVerifica[] } {
  const { confronto, posizione, puntoVendita } = dati;
  const motivi: MotivoVerifica[] = [];

  if (!confronto.stessaCombinazione) {
    const volantini = dati.combinazioni.map(nomeCombinazione).join(', ');
    motivi.push({
      tipo: 'combinazione_diversa',
      livello: 'incongruente',
      testo: `Il punto vendita è di ${nomeCombinazione(puntoVendita.combinazione)}, la riga è nei volantini di ${volantini}`,
    });
  }

  const metri = confronto.distanzaMetri;
  if (metri !== null && posizione) {
    const soloComune = posizione.precisione === 'comune';
    const precisione = posizione.fonte === 'manuale' ? 'corretta a mano' : ETICHETTA_PRECISIONE[posizione.precisione] ?? '';
    const testo = `${formattaDistanza(metri)} fra la posizione stampata (${precisione}) e il punto vendita`;
    if (metri > (soloComune ? DISTANZA_INCONGRUENTE_COMUNE_M : DISTANZA_INCONGRUENTE_M)) {
      motivi.push({ tipo: 'distanza', livello: 'incongruente', testo });
    } else if (!soloComune && metri > DISTANZA_COERENTE_M) {
      motivi.push({ tipo: 'distanza', livello: 'da_verificare', testo });
    }
  }

  for (const altra of dati.stessoVolantino) {
    motivi.push({
      tipo: 'stesso_volantino',
      livello: 'incongruente',
      testo: `Nello stesso volantino (${altra.volantino}) anche "${altra.riga}" è collegata a questo punto vendita`,
    });
  }

  if (confronto.localita === 'diverso') {
    motivi.push({
      tipo: 'localita_diversa',
      livello: 'da_verificare',
      testo: `Località stampata "${dati.localita ?? ''}", città del punto vendita "${puntoVendita.citta ?? ''}"`,
    });
  }

  const [piuVicino] = dati.vicini;
  if (metri !== null && piuVicino && piuVicino.metri + SCARTO_PIU_VICINO_M < metri) {
    motivi.push({
      tipo: 'piu_vicino',
      livello: 'da_verificare',
      testo: `${piuVicino.puntoVendita.nome} è a ${formattaDistanza(piuVicino.metri)} dalla posizione stampata, quello collegato a ${formattaDistanza(metri)}`,
      puntoVendita: { id: piuVicino.puntoVendita.id, nome: piuVicino.puntoVendita.nome },
    });
  }

  if (dati.abbinamenti.includes('probabile')) {
    motivi.push({ tipo: 'probabile', livello: 'da_verificare', testo: 'Abbinamento probabile: indirizzo quasi uguale o località diversa' });
  }

  if (confronto.telefono === 'diverso' && confronto.indirizzo === 'diverso') {
    motivi.push({ tipo: 'telefono_e_indirizzo_diversi', livello: 'da_verificare', testo: 'Telefono e indirizzo stampati sono diversi da quelli del punto vendita' });
  }

  if (!coordinate(posizione)) {
    const testo = !posizione
      ? 'Posizione della riga non ancora cercata'
      : `Posizione della riga non trovata${posizione.errore ? `: ${posizione.errore}` : ''}`;
    motivi.push({ tipo: 'posizione_mancante', livello: 'informazione', testo });
  }
  if (!coordinate(puntoVendita)) {
    motivi.push({ tipo: 'coordinate_pv_mancanti', livello: 'informazione', testo: 'Il punto vendita non ha coordinate in anagrafica' });
  }

  const livelli = new Set(motivi.map(motivo => motivo.livello));
  const esito: EsitoVerifica = livelli.has('incongruente') ? 'incongruente' : livelli.has('da_verificare') ? 'da_verificare' : 'coerente';
  const peso = (motivo: MotivoVerifica) => (motivo.livello === 'informazione' ? 3 : ORDINE_ESITO[motivo.livello]);
  return { esito, motivi: motivi.sort((a, b) => peso(a) - peso(b)) };
}

/**
 * Le righe collegate raggruppate per PV e, dentro il PV, per punto vendita stampato (le chiavi in
 * comune), ciascun gruppo con il confronto, l'esito e i PV vicini. Dal più grave e più recente.
 */
export function verificaCollegamenti(
  righe: readonly RigaCollegata[],
  puntiVendita: readonly PuntoVenditaDaConfrontare[],
  posizioni: ReadonlyMap<string, PosizioneRiga>,
  regole: readonly RegolaCollegamento[],
): GruppoCollegato[] {
  const perId = new Map(puntiVendita.map(puntoVendita => [puntoVendita.id, puntoVendita]));
  const indice = new IndiceCandidati(puntiVendita);
  const indiceRegole = new RegoleCollegamento(regole);

  const perPuntoVendita = new Map<string, RigaCollegata[]>();
  for (const riga of righe) {
    if (!perId.has(riga.idPuntoVendita)) continue;
    perPuntoVendita.set(riga.idPuntoVendita, [...(perPuntoVendita.get(riga.idPuntoVendita) ?? []), riga]);
  }

  const gruppi: GruppoCollegato[] = [];
  for (const [idPuntoVendita, righeDelPuntoVendita] of perPuntoVendita) {
    const puntoVendita = puntoVenditaConfrontato(perId.get(idPuntoVendita) as PuntoVenditaDaConfrontare);
    const combinazionePuntoVendita = chiaveCombinazione(puntoVendita.combinazione.canale?.id, puntoVendita.combinazione.area?.id);
    const raggruppate = raggruppaPerChiavi(righeDelPuntoVendita);

    // Per ogni kit, i gruppi di questo PV che vi compaiono: due righe diverse dello stesso volantino non sono lo stesso negozio
    const gruppiPerKit = new Map<string, Set<number>>();
    raggruppate.forEach((gruppo, indiceGruppo) => {
      for (const riga of gruppo.righe) gruppiPerKit.set(riga.idKit, (gruppiPerKit.get(riga.idKit) ?? new Set<number>()).add(indiceGruppo));
    });

    raggruppate.forEach(({ righe: gruppo, chiavi }, indiceGruppo) => {
      const ordinate = ordinaRighe(gruppo);
      const dallaPiuRecente = [...ordinate].reverse();
      const ultima = dallaPiuRecente[0];
      const dati = datiStampati(gruppo);
      const posizione = posizioneDelGruppo(dallaPiuRecente, posizioni);
      const combinazioni = combinazioniDelleRighe(dallaPiuRecente);

      const stessoVolantino: Array<{ riga: string; volantino: string }> = [];
      const kitVisti = new Set<string>();
      for (const riga of dallaPiuRecente) {
        if (kitVisti.has(riga.idKit)) continue;
        kitVisti.add(riga.idKit);
        for (const altro of gruppiPerKit.get(riga.idKit) ?? []) {
          if (altro === indiceGruppo) continue;
          const altraRiga = raggruppate[altro].righe.find(candidata => candidata.idKit === riga.idKit);
          if (altraRiga) stessoVolantino.push({ riga: altraRiga.riga, volantino: riga.titoloKit || riga.nomePromo || riga.idKit });
        }
      }

      const abbinamenti = ORDINE_ABBINAMENTO.filter(tipo => gruppo.some(riga => riga.abbinamento === tipo));
      const tipo: TipoCollegamento = abbinamenti.includes('manuale') ? 'manuale' : 'automatico';
      // Con la combinazione del PV: un collegamento fatto prima del vincolo su canale e area (riga di
      // un'altra combinazione) si ritrova lo stesso, e si può annullare
      const regola = gruppo
        .filter(riga => riga.abbinamento === 'manuale')
        .map(riga => indiceRegole.per({ ...riga, combinazione: combinazionePuntoVendita }))
        .find((trovata): trovata is RegolaCollegamento => trovata?.idPuntoVendita === idPuntoVendita);

      const confronto = confronta(dati, puntoVendita, posizione);
      const vicini = indice.vicini(dati, posizione, RAGGIO_VICINI_M, idPuntoVendita).slice(0, MASSIMO_VICINI);
      const { esito, motivi } = esitoDelGruppo({
        confronto,
        posizione,
        puntoVendita,
        combinazioni,
        localita: ultima.localita,
        abbinamenti,
        stessoVolantino,
        vicini,
      });

      gruppi.push({
        chiave: chiavi[0],
        riga: ultima.riga,
        varianti: [...new Set(dallaPiuRecente.map(riga => riga.riga))].slice(0, MASSIMO_VARIANTI),
        localita: ultima.localita,
        indirizzo: ultima.indirizzo,
        telefono: ultima.telefono ?? dallaPiuRecente.find(riga => riga.telefono)?.telefono ?? null,
        provincia: dallaPiuRecente.find(riga => riga.provincia)?.provincia ?? null,
        volantini: new Set(gruppo.map(riga => riga.idKit)).size,
        primoVolantino: ordinate[0].data,
        ultimoVolantino: ultima.data,
        combinazioni,
        tipo,
        abbinamenti,
        idCollegamento: regola?.id ?? null,
        posizione,
        puntoVendita,
        confronto,
        esito,
        motivi,
        vicini,
        candidati: indice.candidati(ordinate, posizione).filter(candidato => candidato.puntoVendita.id !== idPuntoVendita),
      });
    });
  }

  return gruppi.sort((a, b) =>
    ORDINE_ESITO[a.esito] - ORDINE_ESITO[b.esito]
    || confrontaTesto(b.ultimoVolantino, a.ultimoVolantino)
    || b.volantini - a.volantini
    || confrontaTesto(a.riga, b.riga)
    || confrontaTesto(a.puntoVendita.id, b.puntoVendita.id));
}

/** I gruppi per esito, per i filtri. */
export function contaPerEsito(gruppi: readonly GruppoCollegato[]): Record<EsitoVerifica, number> {
  const conteggi = Object.fromEntries(ESITI_VERIFICA.map(esito => [esito, 0])) as Record<EsitoVerifica, number>;
  for (const gruppo of gruppi) conteggi[gruppo.esito]++;
  return conteggi;
}
