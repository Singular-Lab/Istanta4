import { formatData } from "@/utils/format";
import dayjs from "dayjs";
import "dayjs/locale/it";
import type { EventoStoria, StoriaPuntoVendita } from "../../../lib/puntiVendita/storia";

/**
 * Testi della storia nella scheda del punto vendita (contratto in lib/puntiVendita/storia.ts),
 * in italiano semplice: date ISO in "marzo 2024", eventi in frasi, recapiti e PDF dei volantini.
 */

/** "marzo 2024"; una data illeggibile resta com'è. */
export const meseAnno = (dataIso: string): string => {
  const data = dayjs(dataIso);
  return data.isValid() ? data.locale("it").format("MMMM YYYY") : dataIso;
};

// Davanti a aprile, agosto e ottobre la preposizione si apostrofa: "dall'aprile", "all'ottobre"
const iniziaConVocale = (testo: string) => /^[aeiou]/i.test(testo);
const dal = (mese: string) => (iniziaConVocale(mese) ? `dall'${mese}` : `dal ${mese}`);
const al = (mese: string) => (iniziaConVocale(mese) ? `all'${mese}` : `al ${mese}`);

/** "dal marzo 2019 all'ottobre 2026", o "a marzo 2024" se il periodo sta in un mese. */
export const periodoMesi = (inizio: string, fine: string): string => {
  const primo = meseAnno(inizio);
  const ultimo = meseAnno(fine);
  return primo === ultimo ? `a ${primo}` : `${dal(primo)} ${al(ultimo)}`;
};

/** "Nei volantini dal marzo 2019 all'ottobre 2026". */
export const testoSintesi = (sintesi: NonNullable<StoriaPuntoVendita["sintesi"]>): string =>
  `Nei volantini ${periodoMesi(sintesi.primoVolantino, sintesi.ultimoVolantino)}`;

export const testoVolantini = (numero: number): string => (numero === 1 ? "1 volantino" : `${numero} volantini`);

export interface EventoDescritto {
  /** Data da mostrare (gg/mm/aaaa). */
  data: string;
  titolo: string;
  dettaglio: string;
  icona: string;
}

/** Un evento della storia in una frase. */
export const descriviEvento = (evento: EventoStoria): EventoDescritto => {
  switch (evento.tipo) {
    case "cambio_insegna":
      return {
        data: formatData(evento.data),
        titolo: "Cambio di insegna",
        dettaglio: `Da ${evento.da.nome} a ${evento.a.nome}.`,
        icona: "Store",
      };
    case "cambio_area":
      return {
        data: formatData(evento.data),
        titolo: "Cambio di area",
        dettaglio: `Da ${evento.da.nome} a ${evento.a.nome}.`,
        icona: "MapPin",
      };
    case "cambio_indirizzo":
      return {
        data: formatData(evento.data),
        titolo: "Cambio di indirizzo",
        dettaglio: `Nei volantini era «${evento.da}», poi «${evento.a}».`,
        icona: "House",
      };
    case "cambio_telefono":
      return {
        data: formatData(evento.data),
        titolo: "Cambio di telefono",
        dettaglio: `Nei volantini era ${evento.da}, poi ${evento.a}.`,
        icona: "Phone",
      };
    case "assente":
      return {
        data: formatData(evento.dal),
        titolo: "Non compare più nei volantini",
        dettaglio: `Manca negli ultimi ${testoVolantini(evento.volantiniSenza)} della sua insegna e della sua area, che invece continuano.`,
        icona: "CircleOff",
      };
  }
};

/** Chiave di un evento, per le liste: tipo e data bastano a distinguerli. */
export const chiaveEvento = (evento: EventoStoria, indice: number): string =>
  `${evento.tipo}-${evento.tipo === "assente" ? evento.dal : evento.data}-${indice}`;

/** Il recapito come era stampato: "Via Roma 1, Lucca · tel. 0583 123456". */
export const testoRecapito = (recapito: { localita: string | null; indirizzo: string | null; telefono: string | null }): string => {
  const luogo = [recapito.indirizzo, recapito.localita].filter(Boolean).join(", ");
  return [luogo, recapito.telefono && `tel. ${recapito.telefono}`].filter(Boolean).join(" · ") || "Senza indirizzo né telefono";
};

/** Il PDF del volantino servito dal proxy di Olimpo, come i volantini attivi. */
export const urlPdfVolantino = (idOlimpoCloud: string): string =>
  `/olimpo/materiali/getMaterialePDF?id=${encodeURIComponent(idOlimpoCloud)}`;

/** Nome con cui salvare il PDF: sempre con estensione .pdf. */
export const nomePdfVolantino = (nome: string | null | undefined, ripiego: string): string => {
  const base = (nome ?? "").trim() || ripiego.trim() || "volantino";
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
};
