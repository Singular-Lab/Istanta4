import type { TonoStato } from "@/constants/stati";
import { formatNumero } from "@/utils/format";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type { MotivoVetrina, PromoConsultazione, PromozioneVolantiniConsultazione } from "../../../lib/consultazione/tipi";
import {
  GIORNI_SCADENZA_VICINA,
  giorniAllaScadenza,
  giorniAllInizio,
  testoInizio,
  testoScadenza,
} from "./scadenza";

/**
 * Testi delle pagine Volantini Attivi, Prossimi e Storico: periodi di validità in parole
 * ("5 – 18 novembre"), quanto manca, mesi dello Storico, numeri delle schede. Funzioni pure.
 */

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Giorno di una data ISO del contratto, o null se manca o non esiste (dayjs farebbe scorrere "2026-02-30"). */
const giornoIso = (data: string | null | undefined): dayjs.Dayjs | null => {
  if (!data || !DATA_ISO.test(data)) return null;
  const giorno = dayjs(data);
  return giorno.isValid() && giorno.format("YYYY-MM-DD") === data ? giorno.locale("it") : null;
};

export const plurale = (numero: number, singolare: string, plurale: string): string =>
  `${formatNumero(numero)} ${numero === 1 ? singolare : plurale}`;

/**
 * Validità in parole: "5 – 18 novembre", "26 ottobre – 12 novembre", "18 dicembre 2025 – 7 gennaio
 * 2026". L'anno si scrive solo se non è quello di `adesso`, o sempre con `conAnno` (per i nomi
 * dei collegamenti, che si leggono fuori contesto).
 */
export const periodoPromo = (
  dal: string | null | undefined,
  al: string | null | undefined,
  { adesso = new Date(), conAnno = false }: { adesso?: Date; conAnno?: boolean } = {}
): string => {
  const inizio = giornoIso(dal);
  const fine = giornoIso(al);
  const annoOggi = adesso.getFullYear();
  const giornoMese = (giorno: dayjs.Dayjs) =>
    giorno.format(conAnno || giorno.year() !== annoOggi ? "D MMMM YYYY" : "D MMMM");

  if (inizio && fine) {
    if (inizio.isSame(fine, "day")) return giornoMese(fine);
    if (inizio.year() !== fine.year()) return `${inizio.format("D MMMM YYYY")} – ${fine.format("D MMMM YYYY")}`;
    return `${inizio.format(inizio.month() === fine.month() ? "D" : "D MMMM")} – ${giornoMese(fine)}`;
  }
  if (inizio) return `dal ${giornoMese(inizio)}`;
  if (fine) return `fino al ${giornoMese(fine)}`;
  return "Validità non indicata";
};

/** "4 novembre", o "31 dicembre 2025" fuori dall'anno di `adesso`; null senza una data valida. */
export const dataInParole = (data: string | null | undefined, adesso: Date = new Date()): string | null => {
  const giorno = giornoIso(data);
  if (!giorno) return null;
  return giorno.format(giorno.year() !== adesso.getFullYear() ? "D MMMM YYYY" : "D MMMM");
};

/** Quanto manca, o quando è finita: badge delle schede e cartellino della vetrina. */
export interface TempoPromo {
  testo: string;
  tono: TonoStato;
  /** Nome canonico dell'icona Lucide. */
  icona: string;
}

/**
 * Attivi: giorni alla scadenza, in evidenza da GIORNI_SCADENZA_VICINA in giù. Prossimi: giorni
 * all'inizio, finché non è cominciata. Storico: "Conclusa il 4 novembre". Null senza la data.
 */
export const tempoDellaPromo = (
  periodo: PeriodoConsultazione,
  promo: Pick<PromoConsultazione, "validitaDal" | "validitaAl">,
  adesso: Date = new Date()
): TempoPromo | null => {
  if (periodo === "attivi") {
    const giorni = giorniAllaScadenza(promo.validitaAl, adesso);
    if (giorni === null) return null;
    const vicina = giorni >= 0 && giorni <= GIORNI_SCADENZA_VICINA;
    return { testo: testoScadenza(giorni), tono: vicina ? "warning" : "neutral", icona: "Clock" };
  }
  if (periodo === "prossimi") {
    const giorni = giorniAllInizio(promo.validitaDal, adesso);
    // Una promo dei Prossimi già cominciata (stato non ancora aggiornato) non ha nulla da contare
    if (giorni === null || giorni < 0) return null;
    return { testo: testoInizio(giorni), tono: "info", icona: "CalendarClock" };
  }
  const fine = dataInParole(promo.validitaAl, adesso);
  return fine ? { testo: `Conclusa il ${fine}`, tono: "neutral", icona: "History" } : null;
};

/** Didascalia della vetrina: perché c'è proprio quella promozione. */
export const MOTIVO_IN_VETRINA: Readonly<Record<MotivoVetrina, string>> = {
  piu_punti_vendita: "In vetrina perché raggiunge più punti vendita",
  prima_a_partire: "In vetrina perché è la prima che parte",
  ultima_conclusa: "In vetrina perché è l'ultima conclusa",
};

/** Mese di inizio della validità, per i gruppi dello Storico: chiave ordinabile ed etichetta "ottobre 2026". */
export const meseDiInizio = (dal: string | null | undefined): { chiave: string; etichetta: string } => {
  const inizio = giornoIso(dal);
  return inizio
    ? { chiave: inizio.format("YYYY-MM"), etichetta: inizio.format("MMMM YYYY") }
    : { chiave: "senza-data", etichetta: "Senza data di inizio" };
};

/** I numeri di una scheda o della vetrina, sui kit mostrati. */
export interface NumeriKit {
  volantini: number;
  insegne: number;
  aree: number;
  /**
   * Punti vendita diversi stampati nei kit mostrati, contati dal server: non la somma dei kit, perché
   * uno stampato in più kit conta una volta. 0 vuol dire che le liste non sono arrivate.
   */
  puntiVendita: number;
}

export const numeriDeiKit = ({ kit, numeroPuntiVendita }: Pick<PromozioneVolantiniConsultazione, "kit" | "numeroPuntiVendita">): NumeriKit => ({
  volantini: kit.length,
  insegne: new Set(kit.map((voce) => voce.canale.id)).size,
  aree: new Set(kit.map((voce) => voce.area.id)).size,
  puntiVendita: Math.max(0, numeroPuntiVendita || 0),
});

/** "3 volantini"; con i filtri, quando la promo ne ha altri, "2 di 5 volantini". */
export const testoVolantini = (mostrati: number, totali: number): string =>
  mostrati < totali
    ? `${formatNumero(mostrati)} di ${formatNumero(totali)} volantini`
    : plurale(mostrati, "volantino", "volantini");
