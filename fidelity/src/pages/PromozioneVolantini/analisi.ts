import { indiciPerNome, tintaCategoria, TINTA_NEUTRA, type CategoriaImpilata, type Tinta } from "@/components/Grafici";
import { periodoValidita, tintaMeccanica } from "@/pages/PuntiVenditaConsultazione/analisi";
import { ETICHETTA_MECCANICA } from "../../../lib/puntiVendita/analisi";
import { UNITA_ETTO } from "../../../lib/insightVolantino/unita";
import { formatNumero } from "@/utils/format";
import type { FasciaSconto } from "../../../lib/insightVolantino/tipi";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type {
  KitPromozioneConsultazione,
  MeccanichePerCanale,
  PromoConsultazione,
  ReferenzaPromozione,
  Riferimento,
} from "../../../lib/consultazione/tipi";
import { tempoDellaPromo } from "../VolantiniKit/testi";

/**
 * Logica della pagina di consultazione di una promozione (/volantini/promozioni/:idPromo, contratto
 * in lib/consultazione/tipi.ts): testi della banda, colori delle insegne, filtri, miniature,
 * assortimento a confronto per insegna e area, e ordinamento del confronto fra i kit.
 * Funzioni pure, provate in analisi.test.ts.
 */

type Kit = KitPromozioneConsultazione;

/* ---------- Testi ---------- */

/** "1 volantino", "12 volantini". */
export const plurale = (numero: number, singolare: string, plurale: string): string =>
  `${formatNumero(numero)} ${numero === 1 ? singolare : plurale}`;

/** Il kit nelle etichette: "Superstore · Toscana". */
export const nomeKit = (kit: Pick<Kit, "canale" | "area">): string => `${kit.canale.nome} · ${kit.area.nome}`;

/** "5 – 18 novembre 2026"; senza date lo dice, invece di un "N/D" grande quanto la banda. */
export const testoValidita = (promo: Pick<PromoConsultazione, "validitaDal" | "validitaAl">): string =>
  promo.validitaDal || promo.validitaAl ? periodoValidita(promo.validitaDal, promo.validitaAl) : "Validità non indicata";

/**
 * Quanto manca, nel cartellino della banda: lo stesso testo delle schede delle viste Volantini
 * (tempoDellaPromo), cosi' scheda e dettaglio dicono la stessa cosa. null senza la data che serve.
 */
export const testoQuantoManca = (
  periodo: PeriodoConsultazione,
  promo: Pick<PromoConsultazione, "validitaDal" | "validitaAl">,
  adesso: Date = new Date()
): string | null => tempoDellaPromo(periodo, promo, adesso)?.testo ?? null;

const distinti = (valori: readonly string[]): number => new Set(valori).size;

/** "12 volantini per 3 insegne in 5 aree". */
export const fraseKit = (kit: readonly Pick<Kit, "canale" | "area">[]): string => {
  const insegne = distinti(kit.map(k => k.canale.id));
  const aree = distinti(kit.map(k => k.area.id));
  return `${plurale(kit.length, "volantino", "volantini")} per ${plurale(insegne, "insegna", "insegne")} in ${plurale(aree, "area", "aree")}`;
};

/* ---------- Colori delle insegne ---------- */

/**
 * Tinta di ogni insegna (canale) della promozione, per nome: la stessa nelle miniature, nella banda,
 * nei grafici e nella tabella di confronto. Si calcola su tutte le insegne della promo, non sui kit
 * filtrati, cosi' un filtro non cambia i colori. Solo le insegne della promo (la rete delle insegne
 * chiederebbe "gdo.visualizza").
 */
export const tinteCanaliPromozione = (insegne: readonly Riferimento[]): ((idCanale: string) => Tinta) => {
  const indici = indiciPerNome(insegne);
  return (idCanale: string) => tintaCategoria(indici.get(idCanale) ?? -1);
};

/* ---------- Filtri ---------- */

/** Un id di area o di insegna nell'indirizzo: solo UUID, gli altri non arrivano al server. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idFiltro = (valore: string | null): string | undefined => (valore && UUID.test(valore) ? valore : undefined);

/**
 * Le opzioni di un filtro con il valore scelto: il server lo tiene fra le opzioni se e' della promo;
 * uno che non lo e' (indirizzo vecchio) si mostra in coda con un nome generico, per poterlo togliere.
 */
export const conValoreScelto = (opzioni: readonly Riferimento[], scelto: string | undefined, nomeGenerico: string): readonly Riferimento[] =>
  !scelto || opzioni.some(opzione => opzione.id.toLowerCase() === scelto.toLowerCase())
    ? opzioni
    : [...opzioni, { id: scelto, nome: nomeGenerico }];

/**
 * Le chiavi canale+area con piu' di un kit: nelle miniature quei kit dicono anche quale volantino
 * sono (numeriNellaCella), che altrimenti sarebbero indistinguibili.
 */
export const celleConPiuKit = (kit: readonly Pick<Kit, "canale" | "area">[]): ReadonlySet<string> => {
  const conteggi = new Map<string, number>();
  for (const k of kit) {
    const cella = chiaveCella(k.canale.id, k.area.id);
    conteggi.set(cella, (conteggi.get(cella) ?? 0) + 1);
  }
  return new Set([...conteggi].filter(([, numero]) => numero > 1).map(([cella]) => cella));
};

/**
 * Per i kit di un'insegna e un'area con piu' di un volantino, quale sono nell'ordine ricevuto e di
 * quanti: "volantino 2 di 2". Il titolo tecnico del kit non si mostra mai (spec insight-volantino,
 * "Nome leggibile del volantino"). Gli altri kit non ci sono.
 */
export const numeriNellaCella = (kit: readonly Pick<Kit, "id" | "canale" | "area">[]): ReadonlyMap<string, { numero: number; di: number }> => {
  const perCella = new Map<string, string[]>();
  for (const k of kit) {
    const cella = chiaveCella(k.canale.id, k.area.id);
    perCella.set(cella, [...(perCella.get(cella) ?? []), k.id]);
  }
  const numeri = new Map<string, { numero: number; di: number }>();
  for (const ids of perCella.values()) {
    if (ids.length > 1) ids.forEach((id, indice) => numeri.set(id, { numero: indice + 1, di: ids.length }));
  }
  return numeri;
};

/** Chiave di insegna e area di un kit. */
export const chiaveCella = (idCanale: string, idArea: string): string => `${idCanale}\u0000${idArea}`;

/* ---------- Assortimento ---------- */

/** "10–20%", "≥ 50%", come nelle fasce degli insight del volantino. */
export const etichettaFascia = (fascia: Pick<FasciaSconto, "da" | "a">): string =>
  fascia.a === null ? `≥ ${formatNumero(fascia.da)}%` : `${formatNumero(fascia.da)}–${formatNumero(fascia.a)}%`;

/**
 * Le meccaniche per canale come barre impilate: le categorie nell'ordine di MECCANICHE (come arrivano
 * dal server), la meccanica non riconosciuta per ultima, con i colori delle meccaniche delle altre
 * pagine. valori[canale][categoria] in %, 0 dove il canale non ha quella meccanica.
 */
export const meccanicheImpilate = (
  perCanale: readonly MeccanichePerCanale[]
): { righe: Array<{ id: string; etichetta: string }>; categorie: CategoriaImpilata[]; valori: number[][] } => {
  const categorie = new Map<string, CategoriaImpilata & { riconosciuta: boolean }>();
  for (const canale of perCanale) {
    for (const quota of canale.quote) {
      const id = quota.meccanica ?? "non_riconosciuta";
      if (!categorie.has(id)) {
        categorie.set(id, {
          id,
          etichetta: quota.etichetta,
          tinta: quota.meccanica ? tintaMeccanica(quota.meccanica) : TINTA_NEUTRA,
          riconosciuta: quota.meccanica !== null,
        });
      }
    }
  }
  // Le riconosciute restano nell'ordine in cui arrivano; quella non riconosciuta va in fondo
  const ordinate = [...categorie.values()].sort((a, b) => Number(b.riconosciuta) - Number(a.riconosciuta));
  return {
    righe: perCanale.map(canale => ({ id: canale.canale.id, etichetta: canale.canale.nome })),
    categorie: ordinate.map(({ id, etichetta, tinta }) => ({ id, etichetta, tinta })),
    valori: perCanale.map(canale =>
      ordinate.map(categoria => canale.quote.find(q => (q.meccanica ?? "non_riconosciuta") === categoria.id)?.quota ?? 0)
    ),
  };
};

/* ---------- Assortimento a confronto ---------- */

/** Testo per confronti e ricerche: minuscolo, senza accenti, con gli spazi ridotti a uno. */
export const testoConfrontabile = (testo: string | null | undefined): string =>
  (testo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/\s+/g, " ")
    .trim();

const chiaveId = (id: string) => id.toLowerCase();

/**
 * I volantini come caselle insegna × area: le insegne e le aree dei kit mostrati, per nome. La casella
 * di un kit è `indice insegna * numero di aree + indice area`; una casella può non avere kit (quella
 * combinazione non ha un volantino) o averne più d'uno (stessa insegna e area, titoli diversi).
 */
export interface GrigliaVolantini {
  insegne: Riferimento[];
  aree: Riferimento[];
  /** Per id del kit (minuscolo). */
  casellaDelKit: ReadonlyMap<string, number>;
  /** Le caselle che hanno almeno un kit. */
  esistenti: ReadonlySet<number>;
  numeroKit: number;
}

const unici = (valori: readonly Riferimento[]): Riferimento[] =>
  [...new Map(valori.map(v => [chiaveId(v.id), v])).values()].sort((a, b) => a.nome.localeCompare(b.nome, "it") || a.id.localeCompare(b.id));

export const grigliaVolantini = (kit: readonly Pick<Kit, "id" | "canale" | "area">[]): GrigliaVolantini => {
  const insegne = unici(kit.map(k => k.canale));
  const aree = unici(kit.map(k => k.area));
  const indiceInsegna = new Map(insegne.map((v, i) => [chiaveId(v.id), i]));
  const indiceArea = new Map(aree.map((v, i) => [chiaveId(v.id), i]));
  const casellaDelKit = new Map(
    kit.map(k => [chiaveId(k.id), (indiceInsegna.get(chiaveId(k.canale.id)) ?? 0) * aree.length + (indiceArea.get(chiaveId(k.area.id)) ?? 0)])
  );
  return { insegne, aree, casellaDelKit, esistenti: new Set(casellaDelKit.values()), numeroKit: kit.length };
};

export const insegnaDellaCasella = (griglia: GrigliaVolantini, casella: number): Riferimento | undefined =>
  griglia.insegne[Math.floor(casella / Math.max(1, griglia.aree.length))];
export const areaDellaCasella = (griglia: GrigliaVolantini, casella: number): Riferimento | undefined =>
  griglia.aree[casella % Math.max(1, griglia.aree.length)];
export const nomeCasella = (griglia: GrigliaVolantini, casella: number): string =>
  `${insegnaDellaCasella(griglia, casella)?.nome ?? "Insegna"} · ${areaDellaCasella(griglia, casella)?.nome ?? "Area"}`;

/** Un prodotto della promozione con quello che serve al confronto, calcolato una volta. */
export interface ProdottoConfronto {
  referenza: ReferenzaPromozione;
  /** Le caselle in cui compare, in ordine e senza ripetizioni. */
  caselle: number[];
  /** I kit che lo stampano. */
  numeroKit: number;
  /** Prezzo più basso e più alto fra i kit; null senza prezzi. */
  min: number | null;
  max: number | null;
  /** max − min in euro, a due decimali; 0 con un prezzo solo. */
  differenza: number;
  /** La differenza in % del prezzo più basso, intera. */
  percentuale: number;
}

const due = (valore: number) => Math.round(valore * 100) / 100;

export const prodottiConfronto = (referenze: readonly ReferenzaPromozione[], griglia: GrigliaVolantini): ProdottoConfronto[] =>
  referenze.map(referenza => {
    const caselle = [...new Set(referenza.presenze.flatMap(p => griglia.casellaDelKit.get(chiaveId(p.idKit)) ?? []))].sort((a, b) => a - b);
    const prezzi = referenza.presenze.flatMap(p => (p.prezzo !== null && Number.isFinite(p.prezzo) ? [p.prezzo] : []));
    const min = prezzi.length > 0 ? Math.min(...prezzi) : null;
    const max = prezzi.length > 0 ? Math.max(...prezzi) : null;
    const differenza = min !== null && max !== null ? due(max - min) : 0;
    return { referenza, caselle, numeroKit: referenza.presenze.length, min, max, differenza, percentuale: min ? Math.round((differenza / min) * 100) : 0 };
  });

/** "City", "City e Conad", "City, Conad e Superstore". */
export const elenco = (nomi: readonly string[]): string =>
  nomi.length <= 1 ? (nomi[0] ?? "") : `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;

/** Le insegne e le aree delle caselle, nell'ordine della griglia. */
const insegneEAree = (caselle: ReadonlySet<number>, griglia: GrigliaVolantini) => {
  const n = griglia.aree.length;
  const insegne = griglia.insegne.filter((_, a) => griglia.aree.some((__, b) => caselle.has(a * n + b)));
  const aree = griglia.aree.filter((_, b) => griglia.insegne.some((__, a) => caselle.has(a * n + b)));
  return { insegne, aree };
};

/** Le caselle esistenti di un rettangolo insegne × aree. */
const rettangolo = (insegne: readonly Riferimento[], aree: readonly Riferimento[], griglia: GrigliaVolantini): number[] => {
  const n = griglia.aree.length;
  const ai = insegne.map(i => griglia.insegne.findIndex(x => x.id === i.id));
  const bi = aree.map(a => griglia.aree.findIndex(x => x.id === a.id));
  return ai.flatMap(a => bi.map(b => a * n + b)).filter(c => griglia.esistenti.has(c));
};

/** Le aree mancanti, a parole: "Sardegna", "Sardegna e Toscana". */
const areeMancanti = (presenti: readonly Riferimento[], griglia: GrigliaVolantini) =>
  elenco(griglia.aree.filter(a => !presenti.some(p => p.id === a.id)).map(a => a.nome));

export interface DescrizionePresenze {
  testo: string;
  /** false solo per i prodotti in tutti i volantini. */
  eccezione: boolean;
}

/**
 * Dove compare un prodotto, nella forma più breve (spec volantini-pop): "In tutti i 15 volantini",
 * "Solo Superstore", "Tutti tranne Sardegna", "Solo Conad e Superstore · Sardegna", "Solo City · Sardegna",
 * "Manca in City · Sardegna"; altrimenti quanti volantini.
 */
export const descriviPresenze = (prodotto: Pick<ProdottoConfronto, "caselle" | "numeroKit">, griglia: GrigliaVolantini): DescrizionePresenze => {
  const caselle = new Set(prodotto.caselle);
  if (prodotto.numeroKit >= griglia.numeroKit && [...griglia.esistenti].every(c => caselle.has(c))) {
    return { testo: griglia.numeroKit === 1 ? "Nel volantino" : `In tutti i ${formatNumero(griglia.numeroKit)} volantini`, eccezione: false };
  }
  const { insegne, aree } = insegneEAree(caselle, griglia);
  const pieno = rettangolo(insegne, aree, griglia);
  if (pieno.length === caselle.size && pieno.every(c => caselle.has(c))) {
    const tutteLeInsegne = insegne.length === griglia.insegne.length;
    const tutteLeAree = aree.length === griglia.aree.length;
    // Mancano poche aree: si dice quali mancano
    const diAree = aree.length > 1 && aree.length >= griglia.aree.length - 2 ? `tutte tranne ${areeMancanti(aree, griglia)}` : elenco(aree.map(a => a.nome));
    if (tutteLeInsegne && !tutteLeAree) {
      return { testo: aree.length > 1 && aree.length >= griglia.aree.length - 2 ? `Tutti tranne ${areeMancanti(aree, griglia)}` : `Solo ${elenco(aree.map(a => a.nome))}`, eccezione: true };
    }
    if (tutteLeAree) return { testo: `Solo ${elenco(insegne.map(i => i.nome))}`, eccezione: true };
    return { testo: `Solo ${elenco(insegne.map(i => i.nome))} · ${diAree}`, eccezione: true };
  }
  const mancano = [...griglia.esistenti].filter(c => !caselle.has(c)).sort((a, b) => a - b);
  if (mancano.length <= 2) return { testo: `Manca in ${elenco(mancano.map(c => nomeCasella(griglia, c)))}`, eccezione: true };
  if (caselle.size <= 3) return { testo: `Solo ${elenco([...caselle].map(c => nomeCasella(griglia, c)))}`, eccezione: true };
  return { testo: `In ${formatNumero(prodotto.numeroKit)} volantini su ${formatNumero(griglia.numeroKit)}`, eccezione: true };
};

export interface PrezzoPerLuogo {
  prezzo: number;
  /** Dove vale: aree o insegne intere del prodotto, o i volantini; "altrove" per il prezzo più diffuso. */
  luogo: string;
  /** Più alto del prezzo più basso del prodotto. */
  piuAlto: boolean;
  /** Stampato all'etto in almeno un volantino: si scrive "€ 0,99 all'etto" (unitaPrezzo). */
  allEtto: boolean;
}

/**
 * I prezzi del prodotto raggruppati per luogo, dal più basso: "6,79 € Toscana · 7,19 € Emilia · 7,99 €
 * altrove". Un elemento solo quando il prezzo è uguale ovunque; nessuno senza prezzi.
 */
export const prezziPerLuogo = (prodotto: ProdottoConfronto, griglia: GrigliaVolantini): PrezzoPerLuogo[] => {
  const perPrezzo = new Map<number, Set<number>>();
  const allEtto = new Set<number>();
  for (const presenza of prodotto.referenza.presenze) {
    const casella = griglia.casellaDelKit.get(chiaveId(presenza.idKit));
    if (presenza.prezzo === null || casella === undefined) continue;
    const caselle = perPrezzo.get(presenza.prezzo) ?? new Set<number>();
    caselle.add(casella);
    perPrezzo.set(presenza.prezzo, caselle);
    if (presenza.prezzoAllEtto) allEtto.add(presenza.prezzo);
  }
  const voci = [...perPrezzo].sort((a, b) => a[0] - b[0]);
  if (voci.length === 0) return [];
  const minimo = voci[0]?.[0] ?? 0;
  if (voci.length === 1) return [{ prezzo: minimo, luogo: "", piuAlto: false, allEtto: allEtto.has(minimo) }];
  const piuDiffuso = voci.reduce((scelto, voce) => (voce[1].size > scelto[1].size ? voce : scelto))[0];
  const tutte = new Set(prodotto.caselle);
  return voci.map(([prezzo, caselle]) => ({
    prezzo,
    luogo: prezzo === piuDiffuso ? "altrove" : luogoDelleCaselle(caselle, tutte, griglia),
    piuAlto: prezzo > minimo,
    allEtto: allEtto.has(prezzo),
  }));
};

/** Dove vale un gruppo di caselle, fra quelle del prodotto: aree intere, insegne intere, o le caselle. */
const luogoDelleCaselle = (caselle: ReadonlySet<number>, tutte: ReadonlySet<number>, griglia: GrigliaVolantini): string => {
  const { insegne, aree } = insegneEAree(caselle, griglia);
  const delProdotto = [...tutte];
  const areeIntere = aree.every(area => delProdotto.filter(c => areaDellaCasella(griglia, c)?.id === area.id).every(c => caselle.has(c)));
  if (areeIntere) return elenco(aree.map(a => a.nome));
  const insegneIntere = insegne.every(i => delProdotto.filter(c => insegnaDellaCasella(griglia, c)?.id === i.id).every(c => caselle.has(c)));
  if (insegneIntere) return elenco(insegne.map(i => i.nome));
  return caselle.size <= 3 ? elenco([...caselle].map(c => nomeCasella(griglia, c))) : `${formatNumero(caselle.size)} volantini`;
};

/** I numeri del confronto: tutti calcolati sui prodotti dei kit mostrati. */
export interface SintesiConfronto {
  totale: number;
  /** In tutti i kit (con più di un kit). */
  base: number;
  /** A marchio del distributore: con una linea del distributore. */
  aMarchio: number;
  /** I prodotti a marchio per linea, dalla linea con più prodotti, a parità per nome. */
  perLinea: Array<{ linea: string; prodotti: number }>;
  /** Con la meccanica Prezzo Fidelity in almeno uno dei kit mostrati. */
  fidelity: number;
  /** Prodotti di una sola insegna, nell'ordine della griglia. */
  perInsegna: Array<{ insegna: Riferimento; prodotti: number }>;
  perArea: Array<{ area: Riferimento; prodotti: number }>;
  /** Prodotti di una sola casella. */
  perCasella: ReadonlyMap<number, number>;
}

/** La parte sul totale in percentuale intera; 0 senza totale. */
export const percentualeDi = (parte: number, totale: number): number => (totale > 0 ? Math.round((parte / totale) * 100) : 0);

/**
 * La percentuale da scrivere (spec volantini-pop): "27%"; "meno dell'1%" quando la parte c'è ma
 * arrotondata all'intero sarebbe 0%, così una linea con un prodotto non si legge come assente.
 */
export const testoPercentuale = (parte: number, totale: number): string => {
  const percentuale = percentualeDi(parte, totale);
  return parte > 0 && percentuale === 0 ? "meno dell'1%" : `${formatNumero(percentuale)}%`;
};

/** Le linee del distributore mostrate una per una; le altre vanno insieme in "altre N linee". */
export const LINEE_IN_VISTA = 4;

/**
 * Le linee del distributore da mostrare sotto la percentuale a marchio: le LINEE_IN_VISTA con più
 * prodotti, nell'ordine di perLinea, e le altre sommate; `altre` è null quando non ce ne sono.
 */
export const lineeInVista = (
  perLinea: SintesiConfronto["perLinea"],
  quante = LINEE_IN_VISTA
): { linee: SintesiConfronto["perLinea"]; altre: { linee: number; prodotti: number } | null } => {
  if (perLinea.length <= quante) return { linee: [...perLinea], altre: null };
  const resto = perLinea.slice(quante);
  return { linee: perLinea.slice(0, quante), altre: { linee: resto.length, prodotti: resto.reduce((somma, voce) => somma + voce.prodotti, 0) } };
};

/** A marchio del distributore: il prodotto ha una linea del distributore. */
const aMarchio = (p: ProdottoConfronto): boolean => Boolean(p.referenza.linea);

/** Con Prezzo Fidelity in almeno uno dei kit mostrati. */
const conFidelity = (p: ProdottoConfronto): boolean => (p.referenza.meccaniche ?? []).includes("fidelity");

export const sintesiConfronto = (prodotti: readonly ProdottoConfronto[], griglia: GrigliaVolantini): SintesiConfronto => {
  const perInsegna = new Map(griglia.insegne.map((_, i) => [i, 0]));
  const perArea = new Map(griglia.aree.map((_, i) => [i, 0]));
  const perCasella = new Map<number, number>();
  const perLinea = new Map<string, number>();
  const n = Math.max(1, griglia.aree.length);
  let base = 0;
  let marchio = 0;
  let fidelity = 0;
  for (const p of prodotti) {
    if (griglia.numeroKit > 1 && descriviPresenze(p, griglia).eccezione === false) base++;
    if (aMarchio(p)) {
      marchio++;
      const linea = p.referenza.linea ?? "";
      perLinea.set(linea, (perLinea.get(linea) ?? 0) + 1);
    }
    if (conFidelity(p)) fidelity++;
    const insegne = new Set(p.caselle.map(c => Math.floor(c / n)));
    const aree = new Set(p.caselle.map(c => c % n));
    if (insegne.size === 1) perInsegna.set([...insegne][0] ?? 0, (perInsegna.get([...insegne][0] ?? 0) ?? 0) + 1);
    if (aree.size === 1) perArea.set([...aree][0] ?? 0, (perArea.get([...aree][0] ?? 0) ?? 0) + 1);
    if (p.caselle.length === 1) perCasella.set(p.caselle[0] ?? 0, (perCasella.get(p.caselle[0] ?? 0) ?? 0) + 1);
  }
  return {
    totale: prodotti.length,
    base,
    aMarchio: marchio,
    perLinea: [...perLinea]
      .map(([linea, numero]) => ({ linea, prodotti: numero }))
      .sort((a, b) => b.prodotti - a.prodotti || a.linea.localeCompare(b.linea, "it")),
    fidelity,
    perInsegna: griglia.insegne.map((insegna, i) => ({ insegna, prodotti: perInsegna.get(i) ?? 0 })),
    perArea: griglia.aree.map((area, i) => ({ area, prodotti: perArea.get(i) ?? 0 })),
    perCasella,
  };
};

/**
 * Cosa mostra l'elenco: uno dei numeri del confronto (base comune, a marchio, Fidelity), i prodotti di
 * una sola insegna o di una sola area (i margini della mappa), una casella della mappa.
 */
export type VistaConfronto =
  | { tipo: "base" }
  | { tipo: "marchio" }
  | { tipo: "fidelity" }
  | { tipo: "insegna"; id: string }
  | { tipo: "area"; id: string }
  | { tipo: "casella"; casella: number };

/** Nell'indirizzo (?vista=): "base", "marchio", "fidelity", "insegna:<id>", "area:<id>", "casella:<insegna>:<area>". */
export const vistaInIndirizzo = (vista: VistaConfronto, griglia: GrigliaVolantini): string => {
  switch (vista.tipo) {
    case "insegna":
    case "area":
      return `${vista.tipo}:${vista.id}`;
    case "casella":
      return `casella:${insegnaDellaCasella(griglia, vista.casella)?.id ?? ""}:${areaDellaCasella(griglia, vista.casella)?.id ?? ""}`;
    default:
      return vista.tipo;
  }
};

/** Dall'indirizzo: un valore storpiato, o di un'insegna o un'area che non ci sono più, non è una vista. */
export const vistaDaIndirizzo = (valore: string | null, griglia: GrigliaVolantini): VistaConfronto | null => {
  if (!valore) return null;
  // Le viste dei numeri tolti (prezzi diversi, una sola insegna, una sola area) non lo sono più: tutti i prodotti
  if (valore === "base" || valore === "marchio" || valore === "fidelity") return { tipo: valore };
  const [tipo, primo = "", secondo = ""] = valore.split(":");
  const insegna = griglia.insegne.findIndex(i => chiaveId(i.id) === chiaveId(primo));
  if (tipo === "insegna" && insegna >= 0) return { tipo, id: griglia.insegne[insegna]?.id ?? primo };
  const area = griglia.aree.findIndex(a => chiaveId(a.id) === chiaveId(tipo === "area" ? primo : secondo));
  if (tipo === "area" && area >= 0) return { tipo, id: griglia.aree[area]?.id ?? primo };
  if (tipo === "casella" && insegna >= 0 && area >= 0) {
    const casella = insegna * griglia.aree.length + area;
    return griglia.esistenti.has(casella) ? { tipo, casella } : null;
  }
  return null;
};

export const stessaVista = (a: VistaConfronto | null, b: VistaConfronto | null): boolean =>
  !!a && !!b && a.tipo === b.tipo && ("id" in a ? chiaveId(a.id) === chiaveId((b as { id: string }).id) : true) && ("casella" in a ? a.casella === (b as { casella: number }).casella : true);

/** Il prodotto senza reparto, nel filtro per reparto. */
export const SENZA_REPARTO = "senza-reparto";

/** Il prodotto senza ruolo, nel filtro per ruolo. */
export const SENZA_RUOLO = "senza-ruolo";

export interface FiltroConfronto {
  vista: VistaConfronto | null;
  /** Il punto di vista: i soli prodotti che questa insegna stampa. */
  punto: string | null;
  cerca: string;
  /** Codice del reparto, SENZA_REPARTO o null per tutti. */
  reparto: string | null;
  /**
   * I ruoli scelti come li scrive il server (già leggibili) o SENZA_RUOLO; nessuno vuol dire tutti. Più
   * ruoli valgono in alternativa: il prodotto risponde con almeno uno.
   */
  ruoli: readonly string[];
}

/** Nessun filtro: tutti i prodotti. */
export const SENZA_FILTRI: FiltroConfronto = { vista: null, punto: null, cerca: "", reparto: null, ruoli: [] };

/** I ruoli del prodotto nei kit mostrati; il ?? tiene in piedi la pagina con un server che non li manda. */
const ruoliDi = (p: ProdottoConfronto): readonly string[] => p.referenza.ruoli ?? [];

/** Un ruolo del prodotto: in quanti volantini lo ha (null senza il ruolo per volantino) su quanti lo stampano. */
export interface RuoloDelProdotto {
  ruolo: string;
  volantini: number | null;
  /** I volantini in cui il prodotto compare. */
  su: number;
}

/**
 * I ruoli del prodotto con il numero di volantini in cui li ha, nell'ordine dei ruoli del prodotto (dal
 * più frequente). Senza il ruolo per volantino (server non aggiornato) il numero è null.
 */
export const ruoliDelProdotto = (referenza: Pick<ReferenzaPromozione, "ruoli" | "presenze">): RuoloDelProdotto[] => {
  const conti = new Map<string, number>();
  for (const presenza of referenza.presenze) if (presenza.ruolo) conti.set(presenza.ruolo, (conti.get(presenza.ruolo) ?? 0) + 1);
  return (referenza.ruoli ?? []).map(ruolo => ({ ruolo, volantini: conti.get(ruolo) ?? null, su: referenza.presenze.length }));
};

/**
 * Il conteggio da scrivere sull'etichetta del ruolo (spec volantini-pop, "Ruolo e filtri dei prodotti
 * della promozione"): "13/15" quando il prodotto ha ruoli diversi nei volantini mostrati e il server
 * dice il ruolo per volantino; null con un ruolo solo, che vale ovunque.
 */
export const conteggioRuolo = (voce: RuoloDelProdotto, ruoliDelProdotto: number): string | null =>
  ruoliDelProdotto > 1 && voce.volantini !== null ? `${formatNumero(voce.volantini)}/${formatNumero(voce.su)}` : null;

/** "Star in 13 dei 15 volantini in cui compare", per il suggerimento e per chi non vede. */
export const descrizioneRuolo = (voce: RuoloDelProdotto, ruoliDelProdotto: number): string =>
  ruoliDelProdotto > 1 && voce.volantini !== null
    ? `${voce.ruolo} in ${formatNumero(voce.volantini)} ${voce.su === 1 ? "volantino" : `dei ${formatNumero(voce.su)} volantini`} in cui compare`
    : voce.ruolo;

const nellaVista = (p: ProdottoConfronto, vista: VistaConfronto, griglia: GrigliaVolantini): boolean => {
  switch (vista.tipo) {
    case "base":
      return griglia.numeroKit > 1 && !descriviPresenze(p, griglia).eccezione;
    case "marchio":
      return aMarchio(p);
    case "fidelity":
      return conFidelity(p);
    case "insegna":
      return p.caselle.length > 0 && p.caselle.every(c => chiaveId(insegnaDellaCasella(griglia, c)?.id ?? "") === chiaveId(vista.id));
    case "area":
      return p.caselle.length > 0 && p.caselle.every(c => chiaveId(areaDellaCasella(griglia, c)?.id ?? "") === chiaveId(vista.id));
    case "casella":
      return p.caselle.length === 1 && p.caselle[0] === vista.casella;
  }
};

export const filtraConfronto = (prodotti: readonly ProdottoConfronto[], griglia: GrigliaVolantini, filtro: FiltroConfronto): ProdottoConfronto[] => {
  const cercato = testoConfrontabile(filtro.cerca);
  return prodotti.filter(p => {
    if (filtro.vista && !nellaVista(p, filtro.vista, griglia)) return false;
    if (filtro.punto && !p.caselle.some(c => chiaveId(insegnaDellaCasella(griglia, c)?.id ?? "") === chiaveId(filtro.punto ?? ""))) return false;
    const reparto = p.referenza.reparto;
    if (filtro.reparto && (filtro.reparto === SENZA_REPARTO ? reparto !== null : reparto?.codice !== filtro.reparto)) return false;
    const ruoli = ruoliDi(p);
    if (filtro.ruoli.length > 0 && !filtro.ruoli.some(scelto => (scelto === SENZA_RUOLO ? ruoli.length === 0 : ruoli.includes(scelto)))) return false;
    if (!cercato) return true;
    const r = p.referenza;
    return testoConfrontabile(`${r.nome} ${r.marca ?? ""} ${r.codice ?? ""} ${r.ean ?? ""}`).includes(cercato);
  });
};

const perNomeProdotto = (a: ProdottoConfronto, b: ProdottoConfronto) =>
  a.referenza.nome.localeCompare(b.referenza.nome, "it") || (a.referenza.marca ?? "").localeCompare(b.referenza.marca ?? "", "it");

/**
 * L'ordine di apertura dell'elenco e quello dei prodotti in comune: prima i prezzi diversi, dalla
 * differenza più grande in % e poi in euro, poi gli altri; a parità per nome e marca.
 */
export const ordinaConfronto = (prodotti: readonly ProdottoConfronto[]): ProdottoConfronto[] =>
  [...prodotti].sort((a, b) => b.percentuale - a.percentuale || b.differenza - a.differenza || perNomeProdotto(a, b));

/** Le colonne dell'elenco di tutti i prodotti che si ordinano scegliendo l'intestazione. */
export type ColonnaElenco = "prodotto" | "volantini" | "prezzo" | "differenza";

export interface OrdinamentoElenco {
  colonna: ColonnaElenco;
  verso: VersoOrdinamento;
}

const COLONNE_ELENCO: readonly ColonnaElenco[] = ["prodotto", "volantini", "prezzo", "differenza"];

/** Il verso della prima scelta: il nome dalla A e il prezzo dal più basso; volantini e differenza dal più alto. */
const VERSO_NATURALE: Readonly<Record<ColonnaElenco, VersoOrdinamento>> = {
  prodotto: "crescente",
  volantini: "decrescente",
  prezzo: "crescente",
  differenza: "decrescente",
};

/** Nell'indirizzo (?ordina=prezzo:crescente). Un valore storpiato, o di prima ("nome"), non è un ordine: vale quello di apertura. */
export const ordinamentoElencoDaIndirizzo = (valore: string | null): OrdinamentoElenco | null => {
  const [colonna, verso] = (valore ?? "").split(":");
  if (!COLONNE_ELENCO.includes(colonna as ColonnaElenco) || (verso !== "crescente" && verso !== "decrescente")) return null;
  return { colonna: colonna as ColonnaElenco, verso };
};

export const ordinamentoElencoInIndirizzo = ({ colonna, verso }: OrdinamentoElenco): string => `${colonna}:${verso}`;

/** Scegliendo un'intestazione: sulla colonna già scelta il verso si inverte; su un'altra parte dal suo verso naturale. */
export const prossimoOrdinamentoElenco = (attuale: OrdinamentoElenco | null, colonna: ColonnaElenco): OrdinamentoElenco =>
  attuale?.colonna === colonna
    ? { colonna, verso: attuale.verso === "crescente" ? "decrescente" : "crescente" }
    : { colonna, verso: VERSO_NATURALE[colonna] };

export const ariaSortElenco = (ordinamento: OrdinamentoElenco | null, colonna: ColonnaElenco): "ascending" | "descending" | "none" =>
  ordinamento?.colonna !== colonna ? "none" : ordinamento.verso === "crescente" ? "ascending" : "descending";

const valoreElenco = (p: ProdottoConfronto, colonna: Exclude<ColonnaElenco, "prodotto">): number | null => {
  switch (colonna) {
    case "volantini":
      return p.numeroKit;
    case "prezzo":
      return p.min;
    case "differenza":
      return p.differenza > 0 ? p.percentuale : 0;
  }
};

/**
 * L'elenco nell'ordine scelto dalle intestazioni (spec volantini-pop); senza scelta l'ordine di
 * apertura (ordinaConfronto). Un prezzo mancante resta in fondo in entrambi i versi; a parità decide
 * l'ordine di apertura, così l'elenco non salta.
 */
export const ordinaElenco = (prodotti: readonly ProdottoConfronto[], ordinamento: OrdinamentoElenco | null): ProdottoConfronto[] => {
  const base = ordinaConfronto(prodotti);
  if (!ordinamento) return base;
  const posizione = new Map(base.map((p, i) => [p, i]));
  const segno = ordinamento.verso === "crescente" ? 1 : -1;
  const { colonna } = ordinamento;
  return [...base].sort((a, b) => {
    const pari = (posizione.get(a) ?? 0) - (posizione.get(b) ?? 0);
    if (colonna === "prodotto") return segno * perNomeProdotto(a, b) || pari;
    const va = valoreElenco(a, colonna);
    const vb = valoreElenco(b, colonna);
    if (va === null || vb === null) return va === vb ? pari : va === null ? 1 : -1;
    return segno * (va - vb) || (colonna === "differenza" ? segno * (a.differenza - b.differenza) : 0) || pari;
  });
};

/** Le schede dei prodotti in comune mostrate prima di "Mostra tutti". */
export const LIMITE_IN_COMUNE = 36;

/**
 * I prodotti in comune (spec volantini-pop): quelli stampati in tutti i volantini mostrati, prima quelli
 * con prezzi diversi, dalla differenza più grande, poi per nome. Nessuno con un solo volantino. I loro
 * filtri (testo, reparto, ruolo) sono propri e non cambiano l'elenco di tutti i prodotti.
 */
export const prodottiInComune = (
  prodotti: readonly ProdottoConfronto[],
  griglia: GrigliaVolantini,
  filtri: Pick<FiltroConfronto, "cerca" | "reparto" | "ruoli"> = SENZA_FILTRI
): ProdottoConfronto[] => ordinaConfronto(filtraConfronto(prodotti, griglia, { ...SENZA_FILTRI, ...filtri, vista: { tipo: "base" } }));

/** I reparti dei prodotti, per nome; `senzaReparto` se qualcuno non ne ha. */
export const repartiDelConfronto = (prodotti: readonly ProdottoConfronto[]): { reparti: Array<{ codice: string; nome: string }>; senzaReparto: boolean } => {
  const reparti = new Map<string, string>();
  let senzaReparto = false;
  for (const { referenza } of prodotti) {
    if (!referenza.reparto) senzaReparto = true;
    else if (!reparti.has(referenza.reparto.codice)) reparti.set(referenza.reparto.codice, referenza.reparto.descrizione || referenza.reparto.codice);
  }
  return {
    reparti: [...reparti].map(([codice, nome]) => ({ codice, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    senzaReparto,
  };
};

/** I ruoli dei prodotti, per nome, con quanti prodotti ha ciascuno; `senzaRuolo` è quanti non ne hanno. */
export const ruoliDelConfronto = (prodotti: readonly ProdottoConfronto[]): { ruoli: Array<{ ruolo: string; prodotti: number }>; senzaRuolo: number } => {
  const ruoli = new Map<string, number>();
  let senzaRuolo = 0;
  for (const p of prodotti) {
    const suoi = ruoliDi(p);
    if (suoi.length === 0) senzaRuolo++;
    for (const ruolo of new Set(suoi)) ruoli.set(ruolo, (ruoli.get(ruolo) ?? 0) + 1);
  }
  return {
    ruoli: [...ruoli].map(([ruolo, numero]) => ({ ruolo, prodotti: numero })).sort((a, b) => a.ruolo.localeCompare(b.ruolo, "it")),
    senzaRuolo,
  };
};

/**
 * Le voci dei filtri a faccette (spec volantini-pop, "Ruolo e filtri dei prodotti della promozione"):
 * i reparti dei prodotti che rispondono a tutti gli altri filtri (vista, punto di vista, testo, ruoli)
 * e i ruoli, con i loro conteggi, di quelli che rispondono a tutti gli altri (testo e reparto compresi).
 * Così scegliendo un ruolo il filtro dei reparti propone solo i reparti che hanno quel ruolo.
 */
export const facceConfronto = (
  prodotti: readonly ProdottoConfronto[],
  griglia: GrigliaVolantini,
  filtro: FiltroConfronto
): ReturnType<typeof repartiDelConfronto> & ReturnType<typeof ruoliDelConfronto> => ({
  ...repartiDelConfronto(filtraConfronto(prodotti, griglia, { ...filtro, reparto: null })),
  ...ruoliDelConfronto(filtraConfronto(prodotti, griglia, { ...filtro, ruoli: [] })),
});

/** "1,19" per Excel: virgola decimale, niente simbolo. */
const numeroExcel = (valore: number | null) => (valore === null ? "" : formatNumero(valore, 2).replace(/\./g, ""));
const cellaCsv = (valore: string | number) => `"${String(valore).replace(/"/g, '""')}"`;

/**
 * L'elenco per Excel: punto e virgola, BOM per gli accenti, una riga per prodotto e una colonna di
 * prezzo per ogni casella insegna × area esistente.
 */
export const csvConfronto = (prodotti: readonly ProdottoConfronto[], griglia: GrigliaVolantini): string => {
  const caselle = [...griglia.esistenti].sort((a, b) => a - b);
  const testa = ["Prodotto", "Marca", "Formato", "Codice", "EAN", "Reparto", "Ruolo", "Meccanica", "Dove", "Unità del prezzo", ...caselle.map(c => `Prezzo ${nomeCasella(griglia, c)}`), "Differenza €", "Differenza %"];
  const righe = prodotti.map(p => {
    const r = p.referenza;
    const prezzoNellaCasella = (c: number) =>
      r.presenze.find(presenza => griglia.casellaDelKit.get(chiaveId(presenza.idKit)) === c)?.prezzo ?? null;
    return [
      r.nome,
      r.marca ?? "",
      r.formato ?? "",
      r.codice ?? "",
      r.ean ?? "",
      r.reparto?.descrizione || r.reparto?.codice || "",
      (r.ruoli ?? []).join(", "),
      (r.meccaniche ?? []).map(m => ETICHETTA_MECCANICA[m]).join(" + "),
      descriviPresenze(p, griglia).testo,
      // L'unità vale per tutti i prezzi della riga: un prodotto stampato all'etto lo è ovunque
      r.presenze.some(presenza => presenza.prezzoAllEtto) ? UNITA_ETTO : "",
      ...caselle.map(c => numeroExcel(prezzoNellaCasella(c))),
      numeroExcel(p.differenza),
      String(p.percentuale),
    ];
  });
  return `\uFEFF${[testa, ...righe].map(riga => riga.map(cellaCsv).join(";")).join("\r\n")}`;
};

/* ---------- Confronto fra i kit ---------- */

export type ColonnaConfronto = "volantino" | "puntiVendita" | "referenze" | "pagine" | "scontoMedio" | "quotaFidelity" | "sottocosto";

export type VersoOrdinamento = "crescente" | "decrescente";

export interface OrdinamentoConfronto {
  colonna: ColonnaConfronto;
  verso: VersoOrdinamento;
}

/** All'apertura i kit che arrivano a più punti vendita stanno in cima. */
export const ORDINAMENTO_INIZIALE: OrdinamentoConfronto = { colonna: "puntiVendita", verso: "decrescente" };

const valoreConfronto = (kit: Kit, colonna: Exclude<ColonnaConfronto, "volantino">): number | null => {
  switch (colonna) {
    case "puntiVendita":
      return kit.numeroPuntiVendita;
    case "referenze":
      return kit.referenze;
    case "pagine":
      return kit.pagine;
    case "scontoMedio":
      return kit.scontoMedio;
    case "quotaFidelity":
      return kit.quotaFidelity;
    case "sottocosto":
      return kit.sottocosto;
  }
};

const perNomeKit = (a: Kit, b: Kit) =>
  a.canale.nome.localeCompare(b.canale.nome, "it") || a.area.nome.localeCompare(b.area.nome, "it") || a.titolo.localeCompare(b.titolo, "it");

/**
 * I kit nell'ordine della colonna scelta. Un valore mancante (lo sconto medio senza box scontati)
 * resta in fondo in entrambi i versi; a parità decide il nome (canale, area, titolo).
 */
export const ordinaKit = (kit: readonly Kit[], { colonna, verso }: OrdinamentoConfronto): Kit[] => {
  const segno = verso === "crescente" ? 1 : -1;
  return [...kit].sort((a, b) => {
    if (colonna === "volantino") return segno * perNomeKit(a, b);
    const va = valoreConfronto(a, colonna);
    const vb = valoreConfronto(b, colonna);
    if (va === null || vb === null) return va === vb ? perNomeKit(a, b) : va === null ? 1 : -1;
    return segno * (va - vb) || perNomeKit(a, b);
  });
};

/** Clic su un'intestazione: sulla colonna già scelta inverte il verso; su un'altra parte dal suo verso naturale (il nome dalla A, i numeri dal più alto). */
export const prossimoOrdinamento = (attuale: OrdinamentoConfronto, colonna: ColonnaConfronto): OrdinamentoConfronto =>
  attuale.colonna === colonna
    ? { colonna, verso: attuale.verso === "crescente" ? "decrescente" : "crescente" }
    : { colonna, verso: colonna === "volantino" ? "crescente" : "decrescente" };

export const ariaSort = (ordinamento: OrdinamentoConfronto, colonna: ColonnaConfronto): "ascending" | "descending" | "none" =>
  ordinamento.colonna !== colonna ? "none" : ordinamento.verso === "crescente" ? "ascending" : "descending";
