import { indiciPerNome, tintaCategoria, TINTA_NEUTRA, type CategoriaImpilata, type Tinta } from "@/components/Grafici";
import { periodoValidita, tintaMeccanica } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import type { FasciaSconto } from "../../../lib/insightVolantino/tipi";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type { CodiceRegione } from "../../../lib/consultazione/regioni";
import type {
  KitPromozioneConsultazione,
  MeccanichePerCanale,
  PromoConsultazione,
  PuntoVenditaPromozioneConsultazione,
  Riferimento,
} from "../../../lib/consultazione/tipi";
import { tempoDellaPromo } from "../VolantiniKit/testi";

/**
 * Logica della pagina di consultazione di una promozione (/volantini/promozioni/:idPromo, contratto
 * in lib/consultazione/tipi.ts): testi della banda, muro delle copertine, griglia canali × aree,
 * conteggi per regione e località, filtri dell'elenco dei punti vendita, ordinamento del confronto
 * fra i kit. Funzioni pure, provate in analisi.test.ts.
 */

type Kit = KitPromozioneConsultazione;
type RigaPv = PuntoVenditaPromozioneConsultazione;

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
 * Tinta di ogni insegna (canale) della promozione, per nome: la stessa nelle miniature, nella griglia,
 * nei grafici, nella mappa e nella tabella. Si calcola su tutte le insegne della promo, non sui kit
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

const perNome = (a: Riferimento, b: Riferimento) => a.nome.localeCompare(b.nome, "it") || a.id.localeCompare(b.id);

/* ---------- Regioni ---------- */

/** Posizione di una regione nel cartogramma a tessere: colonna e riga da 0, su 6 colonne e 8 righe. */
export interface TesseraRegione {
  codice: CodiceRegione;
  colonna: number;
  riga: number;
}

export const COLONNE_CARTOGRAMMA = 6;
export const RIGHE_CARTOGRAMMA = 8;

/** Le 20 regioni come tessere, disposte come la penisola (nord in alto, isole in basso a sinistra e a destra). */
export const CARTOGRAMMA: readonly TesseraRegione[] = [
  { codice: "VDA", colonna: 0, riga: 0 },
  { codice: "LOM", colonna: 1, riga: 0 },
  { codice: "TAA", colonna: 2, riga: 0 },
  { codice: "FVG", colonna: 3, riga: 0 },
  { codice: "PIE", colonna: 0, riga: 1 },
  { codice: "EMR", colonna: 1, riga: 1 },
  { codice: "VEN", colonna: 2, riga: 1 },
  { codice: "LIG", colonna: 0, riga: 2 },
  { codice: "TOS", colonna: 1, riga: 2 },
  { codice: "UMB", colonna: 2, riga: 2 },
  { codice: "MAR", colonna: 3, riga: 2 },
  { codice: "LAZ", colonna: 2, riga: 3 },
  { codice: "ABR", colonna: 3, riga: 3 },
  { codice: "SAR", colonna: 0, riga: 4 },
  { codice: "CAM", colonna: 3, riga: 4 },
  { codice: "MOL", colonna: 4, riga: 4 },
  { codice: "BAS", colonna: 4, riga: 5 },
  { codice: "PUG", colonna: 5, riga: 5 },
  { codice: "CAL", colonna: 4, riga: 6 },
  { codice: "SIC", colonna: 3, riga: 7 },
];

export interface ConteggioRegioni {
  perRegione: ReadonlyMap<CodiceRegione, number>;
  /** Righe con la regione null: non stanno in nessuna tessera e si contano a parte. */
  senzaRegione: number;
  /** Righe della regione che ne ha di più (0 senza righe con la regione). */
  massimo: number;
}

export const contaPerRegione = (righe: readonly Pick<RigaPv, "regione">[]): ConteggioRegioni => {
  const perRegione = new Map<CodiceRegione, number>();
  let senzaRegione = 0;
  for (const riga of righe) {
    if (riga.regione) perRegione.set(riga.regione, (perRegione.get(riga.regione) ?? 0) + 1);
    else senzaRegione++;
  }
  return { perRegione, senzaRegione, massimo: Math.max(0, ...perRegione.values()) };
};

/** Passi della scala delle tessere: pochi, perché la legenda resti leggibile accanto al cartogramma. */
export const PASSI_SCALA_REGIONI = 5;

/** Righe per passo: intere, perché la legenda dica numeri di punti vendita. */
export const ampiezzaScalaRegioni = (massimo: number): number => Math.max(1, Math.ceil(massimo / PASSI_SCALA_REGIONI));

/** Passo della scala di una tessera (da 0); -1 per una regione senza punti vendita. */
export const passoRegione = (puntiVendita: number, ampiezza: number): number =>
  puntiVendita > 0 ? Math.min(PASSI_SCALA_REGIONI - 1, Math.floor((puntiVendita - 1) / Math.max(1, ampiezza))) : -1;

export interface ClasseScala {
  passo: number;
  da: number;
  a: number;
}

/** Le classi della legenda, fino a quella del massimo: 1–20, 21–40… */
export const classiScalaRegioni = (massimo: number): ClasseScala[] => {
  if (massimo <= 0) return [];
  const ampiezza = ampiezzaScalaRegioni(massimo);
  const ultimo = passoRegione(massimo, ampiezza);
  return Array.from({ length: ultimo + 1 }, (_, passo) => ({
    passo,
    da: passo * ampiezza + 1,
    a: passo === ultimo ? massimo : (passo + 1) * ampiezza,
  }));
};

/**
 * Colori della scala delle tessere, dal chiaro allo scuro della tinta del tema (nel tema scuro dal
 * fondo al chiaro). Il testo cambia colore dove il fondo diventa scuro, per restare leggibile.
 */
export const TINTE_REGIONI: ReadonlyArray<{ sfondo: string; testo: string }> = [
  { sfondo: "bg-theme-1/15 dark:bg-indigo-300/15", testo: "text-slate-800 dark:text-slate-100" },
  { sfondo: "bg-theme-1/30 dark:bg-indigo-300/30", testo: "text-slate-800 dark:text-slate-100" },
  { sfondo: "bg-theme-1/50 dark:bg-indigo-300/50", testo: "text-slate-900 dark:text-slate-100" },
  { sfondo: "bg-theme-1/75 dark:bg-indigo-300/75", testo: "text-white dark:text-slate-900" },
  { sfondo: "bg-theme-1 dark:bg-indigo-300", testo: "text-white dark:text-slate-900" },
];

/* ---------- Località e punti vendita ---------- */

/** Testo per confronti e ricerche: minuscolo, senza accenti, con gli spazi ridotti a uno. */
export const testoConfrontabile = (testo: string | null | undefined): string =>
  (testo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/\s+/g, " ")
    .trim();

export interface ConteggioLocalita {
  /** La località senza distinguere maiuscole, accenti e spazi. */
  chiave: string;
  /** Come la stampa la prima riga che la nomina. */
  nome: string;
  puntiVendita: number;
}

/** Località nelle barre "Località con più punti vendita". */
export const LOCALITA_IN_CLASSIFICA = 6;

/**
 * Le località con più righe, nella regione scelta (o in tutte con regione null): "LUCCA" e "Lucca"
 * sono la stessa. Le righe senza località non contano. A parità di righe, per nome.
 */
export const localitaConPiuPuntiVendita = (
  righe: readonly Pick<RigaPv, "localita" | "regione">[],
  regione: CodiceRegione | null,
  quante = LOCALITA_IN_CLASSIFICA
): ConteggioLocalita[] => {
  const perChiave = new Map<string, ConteggioLocalita>();
  for (const riga of righe) {
    if (regione && riga.regione !== regione) continue;
    const chiave = testoConfrontabile(riga.localita);
    if (!chiave) continue;
    const voce = perChiave.get(chiave);
    if (voce) voce.puntiVendita++;
    else perChiave.set(chiave, { chiave, nome: (riga.localita ?? "").trim().replace(/\s+/g, " "), puntiVendita: 1 });
  }
  return [...perChiave.values()]
    .sort((a, b) => b.puntiVendita - a.puntiVendita || a.nome.localeCompare(b.nome, "it"))
    .slice(0, quante);
};

export interface FiltroPuntiVendita {
  /** Solo le righe di questa regione: quelle senza regione restano fuori. */
  regione: CodiceRegione | null;
  /** Nella località, nell'indirizzo o nella riga stampata, senza badare a maiuscole e accenti. */
  cerca: string;
}

export const filtraPuntiVendita = <T extends Pick<RigaPv, "regione" | "localita" | "indirizzo" | "riga">>(
  righe: readonly T[],
  { regione, cerca }: FiltroPuntiVendita
): T[] => {
  const cercato = testoConfrontabile(cerca);
  return righe.filter(
    riga =>
      (!regione || riga.regione === regione) &&
      (!cercato || testoConfrontabile(`${riga.localita ?? ""} ${riga.indirizzo ?? ""} ${riga.riga}`).includes(cercato))
  );
};

/**
 * Punti vendita per canale (dai kit che stampano ciascuno), dal più alto; a parità per nome. Un punto
 * vendita conta una volta per ogni canale dei suoi kit, non una volta per kit.
 */
export const puntiVenditaPerCanale = (
  kit: readonly Pick<Kit, "id" | "canale">[],
  puntiVendita: readonly Pick<RigaPv, "idKit">[]
): Array<{ canale: Riferimento; puntiVendita: number }> => {
  const canaleDelKit = new Map(kit.map(k => [k.id, k.canale]));
  const perCanale = new Map<string, { canale: Riferimento; puntiVendita: number }>();
  for (const pv of puntiVendita) {
    const canali = new Map(pv.idKit.flatMap(id => canaleDelKit.get(id) ?? []).map(canale => [canale.id, canale]));
    for (const canale of canali.values()) {
      const voce = perCanale.get(canale.id);
      if (voce) voce.puntiVendita++;
      else perCanale.set(canale.id, { canale, puntiVendita: 1 });
    }
  }
  return [...perCanale.values()].sort((a, b) => b.puntiVendita - a.puntiVendita || perNome(a.canale, b.canale));
};

export interface PuntoSullaMappa {
  /** Id del punto vendita dell'anagrafica. */
  id: string;
  nome: string;
  lat: number;
  lon: number;
  /** I kit che lo stampano, nell'ordine delle righe: il primo dà il colore. */
  idKit: string[];
}

/**
 * I punti vendita da mettere sulla mappa: solo quelli riconosciuti nell'anagrafica con le coordinate,
 * un punto per punto vendita dell'anagrafica con tutti i kit che lo stampano. `fuoriMappa` conta i
 * punti vendita rimasti fuori.
 */
export const puntiSullaMappa = (puntiVendita: readonly Pick<RigaPv, "idKit" | "puntoVendita">[]): { punti: PuntoSullaMappa[]; fuoriMappa: number } => {
  const perId = new Map<string, PuntoSullaMappa>();
  let fuoriMappa = 0;
  for (const stampato of puntiVendita) {
    const pv = stampato.puntoVendita;
    if (!pv?.coordinate) {
      fuoriMappa++;
      continue;
    }
    const punto = perId.get(pv.id);
    if (punto) {
      for (const idKit of stampato.idKit) if (!punto.idKit.includes(idKit)) punto.idKit.push(idKit);
    } else {
      perId.set(pv.id, { id: pv.id, nome: pv.nome, lat: pv.coordinate.lat, lon: pv.coordinate.lon, idKit: [...stampato.idKit] });
    }
  }
  return { punti: [...perId.values()], fuoriMappa };
};

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
