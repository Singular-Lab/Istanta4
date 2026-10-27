import dayjs from "dayjs";
import "dayjs/locale/it";
import relativeTime from "dayjs/plugin/relativeTime";

// Solo il metodo from(): la lingua resta quella globale, l'italiano si sceglie per singola data
dayjs.extend(relativeTime);

/** Testo mostrato al posto di un valore mancante, in tutte le pagine. */
export const VALORE_ASSENTE = "N/D";

type DataIngresso = string | number | Date | null | undefined;

const leggiData = (data: DataIngresso) => {
  if (data === null || data === undefined || data === "") {
    return null;
  }
  const giorno = dayjs(data);
  return !giorno.isValid() || traboccaData(data, giorno) ? null : giorno;
};

const formatta = (data: DataIngresso, formato: string) => leggiData(data)?.format(formato) ?? VALORE_ASSENTE;

const ISO_LOCALE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const FUSO_ORARIO = /(?:Z|[+-]\d{2}:?\d{2})$/i;

// dayjs fa scorrere i valori fuori intervallo ("2026-13-45" diventa febbraio 2027):
// una data ISO in ora locale vale solo se giorno e ora letti coincidono con quelli scritti.
// Con il fuso orario la conversione cambia legittimamente giorno e ora, e il controllo non si applica.
const traboccaData = (data: DataIngresso, giorno: dayjs.Dayjs) => {
  if (typeof data !== "string" || FUSO_ORARIO.test(data)) {
    return false;
  }
  const parti = ISO_LOCALE.exec(data);
  if (!parti) {
    return false;
  }
  const [, scrittoGiorno, ore, minuti] = parti;
  return (
    giorno.format("YYYY-MM-DD") !== scrittoGiorno ||
    (ore !== undefined && giorno.format("HH:mm") !== `${ore}:${minuti}`)
  );
};

// Solo data, per scadenze e validità che non hanno un orario significativo
export const formatData = (data: DataIngresso) => formatta(data, "DD/MM/YYYY");

// Data e ora compatte, per tabelle ed elenchi
export const formatDataOra = (data: DataIngresso) => formatta(data, "DD/MM/YYYY HH:mm");

// Data e ora per testi che la introducono con "il": "03/09/2026 alle 10:30"
export const formatDataOraEstesa = (data: DataIngresso) => formatta(data, "DD/MM/YYYY [alle] HH:mm");

// Data e ora con i secondi, per log ed eventi ravvicinati
export const formatDataOraSecondi = (data: DataIngresso) => formatta(data, "DD/MM/YYYY HH:mm:ss");

/**
 * Distanza dalla data in italiano ("3 ore fa", "tra 2 giorni"). Va affiancata alla data
 * completa, per esempio nel title: da sola non dice quando è successo.
 */
export const formatRelativo = (data: DataIngresso, rispettoA: DataIngresso = new Date()) => {
  const giorno = leggiData(data);
  const riferimento = leggiData(rispettoA);
  return giorno && riferimento ? giorno.locale("it").from(riferimento) : VALORE_ASSENTE;
};

/** Numero con il separatore delle migliaia italiano; `decimali` fissa le cifre dopo la virgola. */
export const formatNumero = (valore: number | string | null | undefined, decimali?: number) => {
  if (valore === null || valore === undefined || valore === "") {
    return VALORE_ASSENTE;
  }
  const numero = Number(valore);
  if (!Number.isFinite(numero)) {
    return VALORE_ASSENTE;
  }
  // useGrouping: true raggruppa anche le migliaia ("1.234"), che l'italiano altrimenti lascia unite
  return new Intl.NumberFormat("it-IT", {
    useGrouping: true,
    ...(decimali === undefined ? {} : { minimumFractionDigits: decimali, maximumFractionDigits: decimali }),
  }).format(numero);
};

/** Il valore stesso, oppure "N/D" se manca o è una stringa vuota. */
export const valoreOAssente = (valore: string | number | null | undefined) =>
  valore === null || valore === undefined || valore === "" ? VALORE_ASSENTE : String(valore);
