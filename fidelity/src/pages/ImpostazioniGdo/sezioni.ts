/** Indirizzo della pagina Impostazioni GDO (rotta "impostazioni-gdo" del router). */
export const PERCORSO_PAGINA_IMPOSTAZIONI_GDO = "/impostazioni-gdo";

/** Sezioni della pagina, nell'ordine in cui compaiono: l'id è l'ancora e il valore di ?sezione=. */
export const SEZIONI_IMPOSTAZIONI_GDO = [
  { id: "identita", etichetta: "Identità della GDO", icona: "Fingerprint" },
  { id: "loghi-insegne", etichetta: "Loghi delle insegne", icona: "Image" },
  { id: "reparti", etichetta: "Reparti", icona: "Tags" },
  { id: "marchi-distributore", etichetta: "Marchi del distributore", icona: "BadgeCheck" },
  { id: "campi-referenze", etichetta: "Campi delle referenze", icona: "ArrowLeftRight" },
  { id: "insight-volantino", etichetta: "Insight del volantino", icona: "FileJson" },
  { id: "aspetto-sito-web", etichetta: "Aspetto del sito web", icona: "Palette" },
] as const;

export type IdSezioneImpostazioniGdo = (typeof SEZIONI_IMPOSTAZIONI_GDO)[number]["id"];

/** Indirizzo di una sezione delle Impostazioni GDO, per i collegamenti da altre pagine. */
export const percorsoSezioneImpostazioniGdo = (sezione: IdSezioneImpostazioniGdo) =>
  `${PERCORSO_PAGINA_IMPOSTAZIONI_GDO}?sezione=${sezione}`;
