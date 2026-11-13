/**
 * Il nome leggibile di un volantino (spec insight-volantino, "Nome leggibile del volantino"):
 * insegna e area ("Superstore · Liguria"), o quella delle due che c'è; senza nessuna delle due il
 * nome della promozione. Mai il titolo tecnico del kit ("VOLANTINO_SSCNCY_SSLI_VOL_SSCNCY"), che la
 * produzione compone per i file. Null quando non c'è nessuno dei tre.
 */
export const nomeVolantino = ({ insegna, area, promo }: { insegna?: string | null; area?: string | null; promo?: string | null }): string | null =>
  [insegna, area].map(parte => parte?.trim()).filter(Boolean).join(" · ") || promo?.trim() || null;
