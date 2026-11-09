import { PALETTE_REPORT_STANDARD, type ReportVolantino } from "../../../../lib/insightVolantino/report";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";

/**
 * Dati finti per i test del report PDF (non usati dall'applicazione): un box e un report minimi,
 * da completare caso per caso.
 */

export const boxDiProva = (id: string, campi: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id.toUpperCase(),
  pagina: 1,
  geometria: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 },
  spazio: 6,
  proporzionePagina: 0.707,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: "Marca A",
  formato: null,
  prezzo: 1.5,
  barrato: 2,
  sconto: 25,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: "sconto",
  meccanicaOriginale: null,
  reparto: { codice: "01", descrizione: "Drogheria" },
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  ...campi,
});

export const reportDiProva = (campi: Partial<ReportVolantino> = {}): ReportVolantino => ({
  generatoIl: "2026-11-09T10:00:00.000Z",
  idKit: "k1",
  titolo: "Volantino di novembre",
  sottotitolo: "Toscana · Conad City · dal 3 al 16 novembre 2026",
  intestazione: { cliente: "Conad", sottotitolo: null, logo: null, riservatezza: "Riservato - uso interno" },
  palette: PALETTE_REPORT_STANDARD,
  pdf: { idOlimpoCloud: "o1", pagine: 3 },
  box: [
    boxDiProva("b1", { pagina: 1, sconto: 30 }),
    boxDiProva("b2", { pagina: 1, sconto: 10, geometria: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 } }),
    boxDiProva("b3", { pagina: 2, sconto: 20 }),
    boxDiProva("b4", { pagina: 3, sconto: null }),
  ],
  totalePagine: 3,
  sezioni: [],
  ...campi,
});
