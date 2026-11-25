/** Indirizzo della pagina Impostazioni GDO (rotta "impostazioni-gdo" del router). */
export const PERCORSO_PAGINA_IMPOSTAZIONI_GDO = "/impostazioni-gdo";

/** Sezioni della pagina, nell'ordine in cui compaiono: l'id è l'ancora e il valore di ?sezione=. */
export const SEZIONI_IMPOSTAZIONI_GDO = [
  { id: "identita", etichetta: "Identità della GDO", icona: "Fingerprint" },
  { id: "loghi-insegne", etichetta: "Loghi delle insegne", icona: "Image" },
  { id: "reparti", etichetta: "Reparti", icona: "Tags" },
  { id: "marchi-distributore", etichetta: "Private Labels", icona: "BadgeCheck" },
  { id: "campi-referenze", etichetta: "Campi delle referenze", icona: "ArrowLeftRight" },
  { id: "insight-volantino", etichetta: "Insight del volantino", icona: "FileJson" },
  { id: "menabo-volantino", etichetta: "Menabò del volantino", icona: "LayoutGrid" },
  { id: "aspetto-sito-web", etichetta: "Aspetto del sito web", icona: "Palette" },
] as const;

/** Come l'indice raggruppa le sezioni: una sola sezione alla volta si apre dal suo id. */
export const GRUPPI_IMPOSTAZIONI_GDO: ReadonlyArray<{ titolo: string; sezioni: ReadonlyArray<(typeof SEZIONI_IMPOSTAZIONI_GDO)[number]["id"]> }> = [
  { titolo: "Generale", sezioni: ["identita", "loghi-insegne", "aspetto-sito-web"] },
  { titolo: "Dati", sezioni: ["reparti", "marchi-distributore", "campi-referenze"] },
  { titolo: "Volantino", sezioni: ["insight-volantino", "menabo-volantino"] },
];

export type IdSezioneImpostazioniGdo = (typeof SEZIONI_IMPOSTAZIONI_GDO)[number]["id"];

/** Indirizzo di una sezione delle Impostazioni GDO, per i collegamenti da altre pagine. */
export const percorsoSezioneImpostazioniGdo = (sezione: IdSezioneImpostazioniGdo) =>
  `${PERCORSO_PAGINA_IMPOSTAZIONI_GDO}?sezione=${sezione}`;
