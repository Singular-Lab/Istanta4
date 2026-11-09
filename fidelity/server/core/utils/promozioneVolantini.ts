import { regioneDa, testoNormalizzato } from '../../../lib/consultazione/regioni';
import {
  type AssortimentoPromozioneConsultazione,
  type KitPromozioneConsultazione,
  MAX_MARCHE_PROMOZIONE,
  type MarcaPromozione,
  type MeccanichePerCanale,
  type NumeriPromozioneConsultazione,
  type ProdottiComuniLocali,
  type PuntoVenditaPromozioneConsultazione,
  type QuotaMeccanica,
  type Riferimento,
  type VarianteConsultazione,
} from '../../../lib/consultazione/tipi';
import type { BoxInsight, SintesiVolantino } from '../../../lib/insightVolantino/tipi';
import { ETICHETTA_MECCANICA, MECCANICHE, type MeccanicaReferenza } from '../../../lib/puntiVendita/analisi';
import { fasceSconto, marcheDi, SENZA_MECCANICA, spazioPerReparto } from './insightVolantino';

/**
 * Il dettaglio di consultazione di una promozione (spec volantini-pop, "Dettaglio di consultazione
 * della promozione") dai suoi kit volantino pubblicati e dalle righe dei punti vendita stampate nei
 * loro volantini.
 *
 * I numeri di ogni kit sono quelli della sintesi dei suoi insight; quelli della promozione vengono
 * dai box di tutti i kit messi insieme, con le stesse regole degli insight del volantino (fasce di
 * sconto, spazio per reparto, marche): cosi' lo sconto medio della promozione e' la media degli
 * sconti di tutti i box, non la media delle medie dei kit. Un kit senza referenze analizzabili
 * arriva con zero box e conta solo fra i kit e le pagine.
 *
 * Funzione pura: kit, referenze, config degli insight e righe li legge ConsultazioneService. Per
 * decisione della direzione niente vendite, previsioni, calore o visibilita' stimata.
 */

/** Un kit della promozione con le sezioni dei suoi insight gia' calcolate (sezioniInsight). */
export interface KitConInsight {
  variante: VarianteConsultazione;
  sintesi: SintesiVolantino;
  /** Vuoto per un kit senza referenze analizzabili. */
  box: readonly BoxInsight[];
}

/** Una riga di punti_vendita_volantino di un kit della promo, con l'anagrafica del PV abbinato (se c'e'). */
export interface RigaPuntoVenditaPromozione {
  id: string;
  id_kit: string;
  /** Ordine nella lista stampata, da 1. */
  posizione: number;
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  /** Regione e provincia come le ha stampate il volantino. */
  regione: string | null;
  provincia: string | null;
  id_punto_vendita: string | null;
  nome_punto_vendita: string | null;
  /** Colonne DECIMAL: pg le restituisce come testo. */
  lat: number | string | null;
  lon: number | string | null;
  regione_anagrafica: string | null;
  provincia_anagrafica: string | null;
}

export interface PromozioneAggregata {
  /** Nell'ordine in cui arrivano i kit. */
  kit: KitPromozioneConsultazione[];
  numeri: NumeriPromozioneConsultazione;
  /** Nell'ordine dei kit, poi per posizione nella lista stampata. */
  puntiVendita: PuntoVenditaPromozioneConsultazione[];
  assortimento: AssortimentoPromozioneConsultazione;
}

// ─── Numeri ─────────────────────────────────────────────────────────

// Come negli insight del volantino: percentuali e medie con un decimale
const arrotonda = (valore: number): number => Math.round(valore * 10) / 10;

const somma = (valori: readonly number[]): number => valori.reduce((totale, valore) => totale + valore, 0);

const media = (valori: readonly number[]): number | null => (valori.length > 0 ? arrotonda(somma(valori) / valori.length) : null);

/** Percentuale 0-100 con un decimale; 0 se il totale e' 0. */
const quota = (parte: number, totale: number): number => (totale > 0 ? arrotonda((parte / totale) * 100) : 0);

const scontiDi = (box: readonly BoxInsight[]): number[] => box.flatMap(singolo => (singolo.sconto === null ? [] : [singolo.sconto]));

/** Gli id arrivano dall'SQL come testo: lo stesso UUID puo' avere maiuscole diverse. */
const chiaveId = (id: string): string => id.toLowerCase();

// ─── Punti vendita ──────────────────────────────────────────────────

const testo = (valore: string | null | undefined): string | null => valore?.trim() || null;

const coordinata = (valore: number | string | null): number | null => {
  if (valore === null || valore === '') return null;
  const numero = typeof valore === 'number' ? valore : Number(valore);
  return Number.isFinite(numero) ? numero : null;
};

/** La riga come la mostra la consultazione: regione normalizzata e, se abbinata, il PV dell'anagrafica. */
export function puntoVenditaDa(riga: RigaPuntoVenditaPromozione): PuntoVenditaPromozioneConsultazione {
  const lat = coordinata(riga.lat);
  const lon = coordinata(riga.lon);
  return {
    id: riga.id,
    idKit: riga.id_kit,
    riga: riga.riga,
    localita: testo(riga.localita),
    indirizzo: testo(riga.indirizzo),
    regione: regioneDa({
      regione: riga.regione,
      provincia: riga.provincia,
      regioneAnagrafica: riga.regione_anagrafica,
      provinciaAnagrafica: riga.provincia_anagrafica,
    }),
    puntoVendita: riga.id_punto_vendita
      ? {
        id: riga.id_punto_vendita,
        nome: riga.nome_punto_vendita ?? '',
        // Senza una delle due la mappa non ha un punto: 0,0 sarebbe in mare
        coordinate: lat !== null && lon !== null ? { lat, lon } : null,
      }
      : null,
  };
}

/** Le righe nell'ordine dei kit e per posizione; quelle di un kit che non e' fra i kit non si mostrano. */
function puntiVenditaNellOrdine(
  righe: readonly RigaPuntoVenditaPromozione[],
  kit: readonly KitConInsight[]
): PuntoVenditaPromozioneConsultazione[] {
  const ordineKit = new Map(kit.map((voce, indice) => [chiaveId(voce.variante.id), indice] as const));
  const indiceKit = (riga: RigaPuntoVenditaPromozione): number => ordineKit.get(chiaveId(riga.id_kit)) ?? -1;
  return righe
    .filter(riga => indiceKit(riga) >= 0)
    .sort((a, b) => indiceKit(a) - indiceKit(b) || Number(a.posizione) - Number(b.posizione) || a.id.localeCompare(b.id))
    .map(puntoVenditaDa);
}

// ─── Assortimento ───────────────────────────────────────────────────

/** In quanti kit compare ogni prodotto (chiave del prodotto pilota del box). */
function kitPerProdotto(kit: readonly KitConInsight[]): Map<string, number> {
  const presenze = new Map<string, number>();
  for (const voce of kit) {
    for (const chiave of new Set(voce.box.map(singolo => singolo.chiave).filter(Boolean))) {
      presenze.set(chiave, (presenze.get(chiave) ?? 0) + 1);
    }
  }
  return presenze;
}

/** Con un solo kit ogni prodotto e' "in uno solo": "in tutti" vale solo quando i kit sono piu' d'uno. */
function prodottiComuniLocali(presenze: ReadonlyMap<string, number>, totaleKit: number): ProdottiComuniLocali {
  const prodotti: ProdottiComuniLocali = { inTutti: 0, inAlcuni: 0, inUnoSolo: 0 };
  for (const kit of presenze.values()) {
    if (kit <= 1) prodotti.inUnoSolo += 1;
    else if (kit >= totaleKit) prodotti.inTutti += 1;
    else prodotti.inAlcuni += 1;
  }
  return prodotti;
}

/** La meccanica del box fra quelle note; null (non riconosciuta) altrimenti. */
const meccanicaDi = (singolo: BoxInsight): MeccanicaReferenza | null =>
  singolo.meccanica && MECCANICHE.includes(singolo.meccanica) ? singolo.meccanica : null;

/** Per ogni canale dei kit, nell'ordine in cui compare: le meccaniche dei suoi box, solo quelle con box. */
function meccanichePerCanale(kit: readonly KitConInsight[]): MeccanichePerCanale[] {
  const canali = new Map<string, { canale: Riferimento; box: BoxInsight[] }>();
  for (const voce of kit) {
    const chiave = chiaveId(voce.variante.canale.id);
    const gruppo = canali.get(chiave) ?? { canale: voce.variante.canale, box: [] };
    for (const singolo of voce.box) gruppo.box.push(singolo);
    canali.set(chiave, gruppo);
  }
  const ordine: ReadonlyArray<MeccanicaReferenza | null> = [...MECCANICHE, null];
  return [...canali.values()].map(({ canale, box }) => ({
    canale,
    box: box.length,
    quote: ordine.flatMap((meccanica): QuotaMeccanica[] => {
      const conta = box.filter(singolo => meccanicaDi(singolo) === meccanica).length;
      if (conta === 0) return [];
      return [{
        meccanica,
        etichetta: meccanica ? ETICHETTA_MECCANICA[meccanica] : SENZA_MECCANICA.etichetta,
        box: conta,
        quota: quota(conta, box.length),
      }];
    }),
  }));
}

/** Le marche con piu' spazio su tutti i box, senza "marca non indicata" (marcheDi la lascia fuori). */
function marchePromozione(box: readonly BoxInsight[]): MarcaPromozione[] {
  return marcheDi(box, [])
    .elenco
    .slice(0, MAX_MARCHE_PROMOZIONE)
    .map(marca => ({ nome: marca.nome, box: marca.box, quotaSpazio: marca.quotaSpazio, scontoMedio: marca.scontoMedio }));
}

// ─── Dettaglio ──────────────────────────────────────────────────────

/** Kit con i numeri dei loro insight, numeri e assortimento della promozione, righe dei punti vendita. */
export function aggregaPromozioneVolantini(
  kit: readonly KitConInsight[],
  righePuntiVendita: readonly RigaPuntoVenditaPromozione[]
): PromozioneAggregata {
  const tuttiIBox: BoxInsight[] = [];
  for (const voce of kit) for (const singolo of voce.box) tuttiIBox.push(singolo);
  const puntiVendita = puntiVenditaNellOrdine(righePuntiVendita, kit);
  const presenze = kitPerProdotto(kit);

  return {
    kit: kit.map(({ variante, sintesi }) => ({
      ...variante,
      referenze: sintesi.referenze,
      box: sintesi.box,
      pagine: sintesi.pagine,
      scontoMedio: sintesi.scontoMedio,
      quotaFidelity: sintesi.quotaFidelity,
      sottocosto: sintesi.sottocosto,
    })),
    numeri: {
      kit: kit.length,
      pagine: somma(kit.map(voce => voce.sintesi.pagine)),
      puntiVendita: puntiVendita.length,
      localita: new Set(puntiVendita.map(voce => testoNormalizzato(voce.localita)).filter(Boolean)).size,
      regioni: new Set(puntiVendita.flatMap(voce => (voce.regione ? [voce.regione] : []))).size,
      prodotti: presenze.size,
      referenze: somma(kit.map(voce => voce.sintesi.referenze)),
      scontoMedio: media(scontiDi(tuttiIBox)),
      sottocosto: somma(kit.map(voce => voce.sintesi.sottocosto)),
    },
    puntiVendita,
    assortimento: {
      prodotti: prodottiComuniLocali(presenze, kit.length),
      fasceSconto: fasceSconto(tuttiIBox),
      reparti: spazioPerReparto(tuttiIBox),
      meccanichePerCanale: meccanichePerCanale(kit),
      marche: marchePromozione(tuttiIBox),
    },
  };
}
