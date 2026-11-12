import { indiciPerNome, tintaCategoria, TINTA_NEUTRA, type CategoriaImpilata, type Tinta } from "@/components/Grafici";
import { periodoValidita, tintaMeccanica } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import type { FasciaSconto } from "../../../lib/insightVolantino/tipi";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type {
  KitPromozioneConsultazione,
  MeccanichePerCanale,
  PromoConsultazione,
  Riferimento,
} from "../../../lib/consultazione/tipi";
import { tempoDellaPromo } from "../VolantiniKit/testi";

/**
 * Logica della pagina di consultazione di una promozione (/volantini/promozioni/:idPromo, contratto
 * in lib/consultazione/tipi.ts): testi della banda, colori delle insegne, filtri, miniature,
 * assortimento e ordinamento del confronto fra i kit. Funzioni pure, provate in analisi.test.ts.
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
 * Le chiavi canale+area con piu' di un kit: nelle miniature quei kit dicono anche il titolo, che
 * altrimenti sarebbero indistinguibili.
 */
export const celleConPiuKit = (kit: readonly Pick<Kit, "canale" | "area">[]): ReadonlySet<string> => {
  const conteggi = new Map<string, number>();
  for (const k of kit) {
    const cella = chiaveCella(k.canale.id, k.area.id);
    conteggi.set(cella, (conteggi.get(cella) ?? 0) + 1);
  }
  return new Set([...conteggi].filter(([, numero]) => numero > 1).map(([cella]) => cella));
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
