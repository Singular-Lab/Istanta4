import {
  indiciPerNome,
  MASSIMO_CATEGORIE,
  tintaCategoria,
  tintaSequenziale,
  TINTA_NEUTRA,
  type Tinta,
  type VoceLegenda,
} from "@/components/Grafici";
import type { ColorStrategy, FlyerInsightsConfig } from "@/types/flyerInsights";
import { resolveColor } from "@/utils/flyerInsightsHelpers";
import { formatNumero } from "@/utils/format";
import { FASCE_SCONTO, type BoxInsight, type RepartoInsight } from "../../../../lib/insightVolantino/tipi";
import { ETICHETTA_MECCANICA, MECCANICHE, type MeccanicaReferenza } from "../../../../lib/puntiVendita/analisi";

/**
 * Colori dei riquadri del volantino sfogliabile e la loro legenda. Funzioni pure.
 *
 * - reparto: il colore per il marketing impostato per la GDO (reparto.colore), poi i colori della
 *   config dell'installazione (mappa o reparti), altrimenti la palette automatica, per nome, ai
 *   reparti con più spazio;
 * - meccanica: la meccanica riconosciuta dalla lettura generica, uguale per tutte le GDO;
 * - sconto: la scala sequenziale, a fasce.
 * Gli stessi colori valgono per il volantino sfogliabile e per la distribuzione nelle pagine.
 */

export type ModoColore = "reparto" | "meccanica" | "sconto";

export const OPZIONI_COLORE: Array<{ valore: ModoColore; etichetta: string }> = [
  { valore: "reparto", etichetta: "Reparto" },
  { valore: "meccanica", etichetta: "Meccanica" },
  { valore: "sconto", etichetta: "Sconto" },
];

export const TITOLI_LEGENDA: Readonly<Record<ModoColore, string>> = {
  reparto: "Reparto",
  meccanica: "Meccanica",
  sconto: "Sconto",
};

/** Come si disegna un riquadro: la tinta del riempimento e della cornice; attenuato se non dice nulla. */
export interface StileRiquadro {
  tinta: Tinta;
  attenuato: boolean;
}

const stile = (tinta: Tinta, attenuato = false): StileRiquadro => ({ tinta, attenuato });

const tintaEsadecimale = (colore: string): Tinta => ({ colore, classeTesto: "fill-slate-900" });

/* ---------- Reparti ---------- */

export interface ColoriReparti {
  tinta: (reparto: RepartoInsight | null) => Tinta;
  /** Le voci dei reparti di questo volantino, con quella dei box senza reparto. */
  voci: VoceLegenda[];
  /** I colori vengono dalla config dell'installazione. */
  daConfigurazione: boolean;
}

interface ColoreConfigurato {
  colore: string;
  etichetta?: string;
  /** Il reparto non è nella config: prende il colore predefinito. */
  predefinito: boolean;
}

const normalizza = (valore: string): string => valore.toUpperCase().trim().replace(/\s+/g, " ");

const chiaveReparto = (reparto: RepartoInsight): string => reparto.codice || reparto.descrizione;

const nomeReparto = (reparto: RepartoInsight): string => reparto.descrizione || reparto.codice;

/** Il reparto si cerca per codice (il server lo riconduce già all'anagrafica), poi per descrizione. */
const valoriReparto = (reparto: RepartoInsight): string[] => [reparto.codice, reparto.descrizione].filter(Boolean);

const daStrategia = (strategia: ColorStrategy) => (reparto: RepartoInsight): ColoreConfigurato => {
  for (const valore of valoriReparto(reparto)) {
    const voce = resolveColor(valore, strategia);
    if (voce !== strategia.default) return { colore: voce.hex, predefinito: false };
  }
  return { colore: strategia.default.hex, predefinito: true };
};

/**
 * Il colore di un reparto secondo la config, come faceva la mappa di sempre: i colori dei reparti se
 * la mappa li richiama (colorSource "reparti"), poi quelli della mappa, poi quelli dei reparti.
 * Null se la config non ne ha.
 */
const coloreConfigurato = (configurazione?: FlyerInsightsConfig): ((reparto: RepartoInsight) => ColoreConfigurato) | null => {
  const strategiaReparti = configurazione?.reparti?.colorStrategy;
  const mappa = configurazione?.mappa;
  if (mappa?.colorSource === "reparti" && strategiaReparti) return daStrategia(strategiaReparti);
  const statica = mappa?.colorStrategy;
  if (statica?.map && Object.keys(statica.map).length > 0) {
    const voci = new Map(Object.entries(statica.map).map(([chiave, voce]) => [normalizza(chiave), voce]));
    return reparto => {
      for (const valore of valoriReparto(reparto)) {
        const voce = voci.get(normalizza(valore));
        if (voce) return { colore: voce.hex, etichetta: voce.label, predefinito: false };
      }
      return { colore: statica.default?.hex ?? "", etichetta: statica.default?.label, predefinito: true };
    };
  }
  return strategiaReparti ? daStrategia(strategiaReparti) : null;
};

const ordinaVoci = (voci: VoceLegenda[]): VoceLegenda[] => [...voci].sort((a, b) => a.etichetta.localeCompare(b.etichetta, "it"));

const ESADECIMALE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Il colore per il marketing impostato per la GDO (Impostazioni GDO), se è un colore valido. */
export const coloreMarketing = (reparto: Pick<RepartoInsight, "colore"> | null | undefined): string | null => {
  const colore = reparto?.colore?.trim();
  return colore && ESADECIMALE.test(colore) ? colore : null;
};

type RepartoPresente = { reparto: RepartoInsight; spazio: number };

/** Colori e legenda dei reparti senza colore per il marketing: dalla config o automatici. */
function coloriSenzaMarketing(
  presenti: ReadonlyMap<string, RepartoPresente>,
  senzaReparto: boolean,
  configurazione?: FlyerInsightsConfig
): ColoriReparti {
  const nonNoto: VoceLegenda[] = senzaReparto ? [{ id: "senza", etichetta: "Reparto non noto", forma: "quadrato", tinta: TINTA_NEUTRA }] : [];

  const configurato = coloreConfigurato(configurazione);
  if (configurato) {
    const tinta = (reparto: RepartoInsight | null): Tinta => {
      if (!reparto) return TINTA_NEUTRA;
      const { colore } = configurato(reparto);
      return colore ? tintaEsadecimale(colore) : TINTA_NEUTRA;
    };
    const voci = new Map<string, VoceLegenda>();
    let altri: VoceLegenda | null = null;
    for (const { reparto } of presenti.values()) {
      const colore = configurato(reparto);
      if (colore.predefinito) {
        altri ??= { id: "altri", etichetta: colore.etichetta || "Altri reparti", forma: "quadrato", tinta: tinta(reparto) };
        continue;
      }
      const etichetta = colore.etichetta || nomeReparto(reparto);
      voci.set(`${colore.colore}|${etichetta}`, { id: chiaveReparto(reparto), etichetta, forma: "quadrato", tinta: tinta(reparto) });
    }
    return { tinta, voci: [...ordinaVoci([...voci.values()]), ...(altri ? [altri] : []), ...nonNoto], daConfigurazione: true };
  }

  // Senza config: i reparti con più spazio hanno un colore, assegnato per nome perché resti lo stesso
  const perSpazio = [...presenti.values()].sort((a, b) => b.spazio - a.spazio);
  const conColore = perSpazio.length > MASSIMO_CATEGORIE ? perSpazio.slice(0, MASSIMO_CATEGORIE - 1) : perSpazio;
  const indici = indiciPerNome(conColore.map(({ reparto }) => ({ id: chiaveReparto(reparto), nome: nomeReparto(reparto) })));
  const tinta = (reparto: RepartoInsight | null): Tinta => (reparto ? tintaCategoria(indici.get(chiaveReparto(reparto)) ?? -1) : TINTA_NEUTRA);
  const altri = perSpazio.length > conColore.length;
  const voci: VoceLegenda[] = [...indici]
    .sort((a, b) => a[1] - b[1])
    .map(([chiave]) => {
      const { reparto } = presenti.get(chiave)!;
      return { id: chiave, etichetta: nomeReparto(reparto), forma: "quadrato" as const, tinta: tinta(reparto) };
    });
  if (altri || senzaReparto) {
    const etichetta = altri && senzaReparto ? "Altri reparti o non noto" : altri ? "Altri reparti" : "Reparto non noto";
    voci.push({ id: "senza", etichetta, forma: "quadrato", tinta: TINTA_NEUTRA });
  }
  return { tinta, voci, daConfigurazione: false };
}

/**
 * I colori dei reparti del volantino. Un reparto con il colore per il marketing della GDO prende
 * quello, con il suo nome per il marketing in legenda: vale più della config dell'installazione.
 * Gli altri prendono i colori della config se ne ha, altrimenti quelli automatici.
 */
export function coloriReparti(box: readonly Pick<BoxInsight, "reparto" | "spazio">[], configurazione?: FlyerInsightsConfig): ColoriReparti {
  const presenti = new Map<string, RepartoPresente>();
  const conMarketing = new Map<string, VoceLegenda>();
  let senzaReparto = false;
  for (const voce of box) {
    if (!voce.reparto) {
      senzaReparto = true;
      continue;
    }
    const colore = coloreMarketing(voce.reparto);
    if (colore) {
      // Un nome per il marketing condiviso da più codici è una voce sola
      const etichetta = nomeReparto(voce.reparto);
      const chiave = `${colore.toLowerCase()}|${etichetta}`;
      if (!conMarketing.has(chiave)) {
        conMarketing.set(chiave, { id: chiaveReparto(voce.reparto), etichetta, forma: "quadrato", tinta: tintaEsadecimale(colore) });
      }
      continue;
    }
    const chiave = chiaveReparto(voce.reparto);
    const attuale = presenti.get(chiave);
    if (attuale) attuale.spazio += voce.spazio;
    else presenti.set(chiave, { reparto: voce.reparto, spazio: voce.spazio });
  }

  const base = coloriSenzaMarketing(presenti, senzaReparto, configurazione);
  if (conMarketing.size === 0) return base;

  const tinta = (reparto: RepartoInsight | null): Tinta => {
    const colore = coloreMarketing(reparto);
    return colore ? tintaEsadecimale(colore) : base.tinta(reparto);
  };
  // Prima i reparti con un nome, in ordine alfabetico; in fondo gli altri e quelli senza reparto
  const inCoda = (voce: VoceLegenda) => voce.id === "altri" || voce.id === "senza";
  const nominate = ordinaVoci([...conMarketing.values(), ...base.voci.filter(voce => !inCoda(voce))]);
  return { tinta, voci: [...nominate, ...base.voci.filter(inCoda)], daConfigurazione: base.daConfigurazione };
}

/* ---------- Meccaniche ---------- */

export const tintaMeccanica = (meccanica: MeccanicaReferenza | null): Tinta =>
  meccanica ? tintaCategoria(MECCANICHE.indexOf(meccanica)) : TINTA_NEUTRA;

/* ---------- Sconto ---------- */

/** Fascia dello sconto (indice di FASCE_SCONTO); -1 senza sconto. */
export const fasciaSconto = (sconto: number | null): number => {
  if (sconto === null || !Number.isFinite(sconto)) return -1;
  let indice = 0;
  FASCE_SCONTO.forEach((limite, i) => {
    if (sconto >= limite) indice = i;
  });
  return indice;
};

/** Le fasce saltano il passo più chiaro della scala, che sopra un'immagine non si vedrebbe. */
export const tintaSconto = (sconto: number | null): Tinta => {
  const fascia = fasciaSconto(sconto);
  return fascia < 0 ? TINTA_NEUTRA : tintaSequenziale(fascia + 1);
};

/** "0–10%", "10–20%"... "≥ 50%": le etichette di fasce contigue, l'ultima aperta. */
const etichetteFasce = (limiti: readonly number[], unita: string): string[] =>
  limiti.map((da, i) => {
    const a = limiti[i + 1];
    return a === undefined ? `≥ ${formatNumero(da)}${unita}` : `${formatNumero(da)}–${formatNumero(a)}${unita}`;
  });

/* ---------- Stile e legenda ---------- */

/** Lo stile del riquadro di un box nel modo scelto. */
export const stileBox = (
  box: Pick<BoxInsight, "reparto" | "meccanica" | "sconto">,
  modo: ModoColore,
  reparti: ColoriReparti
): StileRiquadro => {
  switch (modo) {
    case "reparto":
      return stile(reparti.tinta(box.reparto), !box.reparto);
    case "meccanica":
      return stile(tintaMeccanica(box.meccanica), !box.meccanica);
    case "sconto":
      return stile(tintaSconto(box.sconto), box.sconto === null);
  }
};

/** La legenda nel modo scelto, con la voce dei box senza il dato quando ce ne sono. */
export const legendaModo = (
  modo: ModoColore,
  box: readonly Pick<BoxInsight, "meccanica" | "sconto">[],
  reparti: ColoriReparti
): VoceLegenda[] => {
  switch (modo) {
    case "reparto":
      return reparti.voci;
    case "meccanica": {
      const presenti = new Set(box.map(voce => voce.meccanica));
      return [
        ...MECCANICHE.filter(meccanica => presenti.has(meccanica)).map(meccanica => ({
          id: meccanica,
          etichetta: ETICHETTA_MECCANICA[meccanica],
          forma: "quadrato" as const,
          tinta: tintaMeccanica(meccanica),
        })),
        ...(presenti.has(null) ? [{ id: "senza", etichetta: "Non riconosciuta", forma: "quadrato" as const, tinta: TINTA_NEUTRA }] : []),
      ];
    }
    case "sconto":
      return [
        ...etichetteFasce(FASCE_SCONTO, "%").map((etichetta, i) => ({
          id: `sconto-${i}`,
          etichetta,
          forma: "quadrato" as const,
          tinta: tintaSequenziale(i + 1),
        })),
        ...(box.some(voce => voce.sconto === null) ? [{ id: "senza", etichetta: "Senza sconto", forma: "quadrato" as const, tinta: TINTA_NEUTRA }] : []),
      ];
  }
};

/** Il gruppo di un box nel modo scelto: per la ripartizione della pagina, con la tinta dei riquadri. */
export interface GruppoBox {
  /** Lo stesso id della voce di legenda, dove c'è; "senza" per i box senza il dato. */
  id: string;
  etichetta: string;
  tinta: Tinta;
}

/**
 * Reparto, meccanica o fascia di sconto del box, con la tinta del suo riquadro. Il reparto si chiama
 * col suo nome anche quando la legenda lo raccoglie fra gli "Altri reparti".
 */
export const gruppoBox = (box: Pick<BoxInsight, "reparto" | "meccanica" | "sconto">, modo: ModoColore, reparti: ColoriReparti): GruppoBox => {
  switch (modo) {
    case "reparto":
      return box.reparto
        ? { id: chiaveReparto(box.reparto), etichetta: nomeReparto(box.reparto), tinta: reparti.tinta(box.reparto) }
        : { id: "senza", etichetta: "Reparto non noto", tinta: TINTA_NEUTRA };
    case "meccanica":
      return box.meccanica
        ? { id: box.meccanica, etichetta: ETICHETTA_MECCANICA[box.meccanica], tinta: tintaMeccanica(box.meccanica) }
        : { id: "senza", etichetta: "Non riconosciuta", tinta: TINTA_NEUTRA };
    case "sconto": {
      const fascia = fasciaSconto(box.sconto);
      return fascia < 0
        ? { id: "senza", etichetta: "Senza sconto", tinta: TINTA_NEUTRA }
        : { id: `sconto-${fascia}`, etichetta: etichetteFasce(FASCE_SCONTO, "%")[fascia], tinta: tintaSequenziale(fascia + 1) };
    }
  }
};
