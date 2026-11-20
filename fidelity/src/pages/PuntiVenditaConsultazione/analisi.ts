import {
  indiciPerNome,
  isoData,
  MASSIMO_CATEGORIE,
  msData,
  msOggi,
  MS_GIORNO,
  passoSequenziale,
  PASSI_SEQUENZIALI,
  tintaCategoria,
  tintaSequenziale,
  TINTA_NEUTRA,
  type EventoTimeline,
  type FasciaTimeline,
  type FasciaTempo,
  type FormaEvento,
  type RigaFasce,
  type Tinta,
  type TracciaTimeline,
  type VoceLegenda,
} from "@/components/Grafici";
import type { AssenzaTimeline, BarraTimeline } from "@/components/Grafici/TimelineVolantini";
import { useFetchReteInsegne } from "@/query/query";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { useMemo } from "react";
import {
  edizioneNelPeriodo,
  ETICHETTA_MECCANICA,
  MECCANICHE,
  type AnalisiPuntoVendita,
  type BoxVolantino,
  type EdizioneTimeline,
  type MeccanicaReferenza,
  type PeriodoAnalisi,
  type VolantinoAssente,
} from "../../../lib/puntiVendita/analisi";
import type { EventoStoria, PeriodoRecapito, RiferimentoStoria, TipoAbbinamento } from "../../../lib/puntiVendita/storia";

/**
 * Supporto comune alle pagine del punto vendita costruite sulla timeline dei volantini (scheda e
 * referenza; contratto in lib/puntiVendita/analisi.ts): formati, percorsi, colori e
 * dati dei grafici. Funzioni pure salvo useTinteCanali.
 */

/* ---------- Formati ---------- */

/** "27,8%"; "N/D" senza valore. */
export const formatPercentuale = (valore: number | null | undefined, decimali = 1): string =>
  valore === null || valore === undefined || !Number.isFinite(valore) ? VALORE_ASSENTE : `${formatNumero(valore, Number.isInteger(valore) ? 0 : decimali)}%`;

/** "€ 1,69", come nei volantini; "N/D" senza valore. */
export const formatEuro = (valore: number | null | undefined): string =>
  valore === null || valore === undefined || !Number.isFinite(valore) ? VALORE_ASSENTE : `€ ${formatNumero(valore, 2)}`;

/** Differenza in punti percentuali, col segno: "+6,9 punti", "−2,4 punti", "stabile". */
export const formatDifferenzaPunti = (differenza: number): string => {
  const arrotondata = Math.round(differenza * 10) / 10;
  if (arrotondata === 0) return "stabile";
  return `${arrotondata > 0 ? "+" : "−"}${formatNumero(Math.abs(arrotondata), Number.isInteger(arrotondata) ? 0 : 1)} punti`;
};

/** "gen 2021". */
export const meseAnnoBreve = (dataIso: string): string => {
  const data = dayjs(dataIso);
  return data.isValid() ? data.locale("it").format("MMM YYYY") : dataIso;
};

/** "23 ottobre – 5 novembre 2026", "3 – 16 marzo 2026", "dal 3 marzo 2026" senza la fine. */
export const periodoValidita = (dal: string | null | undefined, al: string | null | undefined): string => {
  const inizio = dal ? dayjs(dal).locale("it") : null;
  const fine = al ? dayjs(al).locale("it") : null;
  if (inizio?.isValid() && fine?.isValid()) {
    const formato = inizio.year() !== fine.year() ? "D MMMM YYYY" : inizio.month() !== fine.month() ? "D MMMM" : "D";
    return `${inizio.format(formato)} – ${fine.format("D MMMM YYYY")}`;
  }
  if (inizio?.isValid()) return `dal ${inizio.format("D MMMM YYYY")}`;
  if (fine?.isValid()) return `fino al ${fine.format("D MMMM YYYY")}`;
  return VALORE_ASSENTE;
};

export const testoReferenze = (numero: number): string => (numero === 1 ? "1 referenza" : `${formatNumero(numero)} referenze`);

/**
 * I codici GDO che identificano il punto vendita (ID MURO, ID ANACAN, CODICE…), per la testata: i
 * meta descrittivi, come l'insegna, ripeterebbero i badge e restano nei dati.
 */
export const identificativiGdo = <T extends { etichetta: string }>(codici: readonly T[]): T[] =>
  codici.filter(codice => /(^|\s)(ID|COD|CODICE)(\s|$)/.test(codice.etichetta));

/* ---------- Percorsi ---------- */

/**
 * Parametri nell'indirizzo: periodo e volantino scelti nella scheda. Il periodo è un anno
 * (`?anno=2025`), gli ultimi 12 mesi (`?anno=ultimi12mesi`), gli ultimi 3 mesi
 * (`?anno=ultimi3mesi`) o, senza il parametro, tutto.
 */
export const PARAMETRO_ANNO = "anno";
export const PARAMETRO_VOLANTINO = "volantino";
/** Valore di PARAMETRO_ANNO per gli ultimi 12 mesi. */
export const ULTIMI_12_MESI = "ultimi12mesi";
/** Valore di PARAMETRO_ANNO per gli ultimi 3 mesi. */
export const ULTIMI_3_MESI = "ultimi3mesi";

export const percorsoScheda = (idPv: string): string => `/punti-vendita/${encodeURIComponent(idPv)}`;

export const percorsoReferenza = (idPv: string, chiave: string): string => `${percorsoScheda(idPv)}/referenze/${encodeURIComponent(chiave)}`;

/* ---------- Copertura dei dati ---------- */

/** Sotto questa percentuale di referenze con il dato, il grafico lo dice: il dato è parziale. */
export const SOGLIA_COPERTURA = 60;

export const coperturaParziale = (percentuale: number | null | undefined): boolean =>
  typeof percentuale === "number" && percentuale < SOGLIA_COPERTURA;

/* ---------- Colori delle insegne ---------- */

/**
 * Tinta di ogni canale (insegna), uguale in tutte le pagine: l'ordine è quello dei nomi delle
 * insegne della rete (GET /punti-vendita/rete/insegne), più quelle locali che mancassero. Se la
 * rete ha più insegne dei colori distinti, si colorano solo quelle della pagina, sempre per nome.
 */
export const tinteCanali = (
  rete: ReadonlyArray<RiferimentoStoria>,
  locali: ReadonlyArray<RiferimentoStoria>
): ((idCanale: string) => Tinta) => {
  const globali = indiciPerNome([...rete, ...locali]);
  const indici = globali.size <= MASSIMO_CATEGORIE ? globali : indiciPerNome(locali);
  return (idCanale: string) => tintaCategoria(indici.get(idCanale) ?? -1);
};

/**
 * Le tinte dei canali con la rete delle insegne della GDO (cache condivisa con l'elenco).
 * `locali` va memorizzato dal chiamante (useMemo): cambiandolo si ricalcolano i colori.
 */
export function useTinteCanali(locali: ReadonlyArray<RiferimentoStoria>): (idCanale: string) => Tinta {
  const rete = useFetchReteInsegne();
  return useMemo(() => tinteCanali(rete.data?.insegne.map(i => i.canale) ?? [], locali), [rete.data, locali]);
}

/* ---------- Timeline della scheda ---------- */

export const annoEdizione = (edizione: Pick<EdizioneTimeline, "dal">): number => Number(edizione.dal.slice(0, 4));

/** Ultimo giorno di validità dell'edizione (ISO): senza la fine, o con la fine prima dell'inizio, il primo. */
export const fineEdizione = (edizione: Pick<EdizioneTimeline, "dal" | "al">): string =>
  edizione.al && edizione.al > edizione.dal ? edizione.al : edizione.dal;

/** Periodo della scheda: un anno, gli ultimi 12 mesi, gli ultimi 3 mesi o (null) tutto. */
export type PeriodoStoria = number | typeof ULTIMI_12_MESI | typeof ULTIMI_3_MESI | null;

/** Il periodo scritto nell'indirizzo: un anno dei dati, gli ultimi 12 o 3 mesi, altrimenti tutto. */
export const periodoDaParametro = (valore: string | null, anni: readonly number[]): PeriodoStoria => {
  if (valore === ULTIMI_3_MESI || valore === ULTIMI_12_MESI) return valore;
  const anno = Number(valore);
  return valore && anni.includes(anno) ? anno : null;
};

/** Oggi, la data locale, in ISO (YYYY-MM-DD). */
export const oggiIso = (): string => isoData(msOggi());

/** Primo giorno degli ultimi 3 mesi: lo stesso giorno di tre mesi fa (ISO). */
export const inizioUltimi3Mesi = (oggi: string): string => dayjs(oggi).subtract(3, "month").format("YYYY-MM-DD");

/** Primo giorno degli ultimi 12 mesi: lo stesso giorno di un anno fa (ISO). */
export const inizioUltimi12Mesi = (oggi: string): string => dayjs(oggi).subtract(12, "month").format("YYYY-MM-DD");

const mesiDelPeriodo = (periodo: typeof ULTIMI_12_MESI | typeof ULTIMI_3_MESI): number => (periodo === ULTIMI_12_MESI ? 12 : 3);

/**
 * I giorni del periodo, per il server (GET .../analisi?dal=&al=) e per i filtri della pagina: un
 * anno intero; gli ultimi 12 o 3 mesi senza fine, perché comprendano i volantini attivi e quelli
 * in arrivo; null per tutto.
 */
export const periodoAnalisi = (periodo: PeriodoStoria, oggi: string = oggiIso()): PeriodoAnalisi | null => {
  if (periodo === null) return null;
  if (periodo === ULTIMI_3_MESI) return { dal: inizioUltimi3Mesi(oggi), al: null };
  if (periodo === ULTIMI_12_MESI) return { dal: inizioUltimi12Mesi(oggi), al: null };
  return { dal: `${periodo}-01-01`, al: `${periodo}-12-31` };
};

/**
 * Il periodo con cui confrontare quello scelto, della stessa durata e subito prima: l'anno prima,
 * oppure i 12 o 3 mesi prima. Null per tutta la storia, che non ha un "prima".
 */
export const periodoPrecedente = (periodo: PeriodoStoria, oggi: string = oggiIso()): PeriodoAnalisi | null => {
  if (periodo === null) return null;
  if (periodo === ULTIMI_3_MESI || periodo === ULTIMI_12_MESI) {
    const inizio = dayjs(periodoAnalisi(periodo, oggi)!.dal!);
    return { dal: inizio.subtract(mesiDelPeriodo(periodo), "month").format("YYYY-MM-DD"), al: inizio.subtract(1, "day").format("YYYY-MM-DD") };
  }
  return { dal: `${periodo - 1}-01-01`, al: `${periodo - 1}-12-31` };
};

/** Il periodo nelle frasi: "dal marzo 2025", "nel 2025", "negli ultimi 12 mesi". */
export const nomePeriodo = (periodo: PeriodoStoria, primoVolantino: string | null): string => {
  if (periodo === ULTIMI_3_MESI) return "negli ultimi 3 mesi";
  if (periodo === ULTIMI_12_MESI) return "negli ultimi 12 mesi";
  if (periodo !== null) return `nel ${periodo}`;
  if (!primoVolantino) return "in tutta la storia";
  const mese = dayjs(primoVolantino).locale("it").format("MMMM YYYY");
  return /^[aeiou]/i.test(mese) ? `dall'${mese}` : `dal ${mese}`;
};

/**
 * Il periodo del confronto nelle frasi: `nel` accanto a un valore ("nel 2024", "nei 12 mesi
 * prima"), `rispetto` dopo una differenza ("rispetto al 2024"). Null per tutta la storia.
 */
export const nomeConfronto = (periodo: PeriodoStoria): { nel: string; rispetto: string } | null => {
  if (periodo === null) return null;
  if (periodo === ULTIMI_3_MESI) return { nel: "nei 3 mesi prima", rispetto: "rispetto ai 3 mesi prima" };
  if (periodo === ULTIMI_12_MESI) return { nel: "nei 12 mesi prima", rispetto: "rispetto ai 12 mesi prima" };
  return { nel: `nel ${periodo - 1}`, rispetto: `rispetto al ${periodo - 1}` };
};

/** Il periodo scelto, con i giorni, il periodo prima e i nomi per le frasi: lo stesso per tutta la scheda. */
export interface ContestoPeriodo {
  periodo: PeriodoStoria;
  /** I giorni del periodo (null: tutto). */
  giorni: PeriodoAnalisi | null;
  /** I giorni del periodo prima, per i confronti (null: nessun confronto). */
  precedente: PeriodoAnalisi | null;
  /** "dal marzo 2025", "nel 2025", "negli ultimi 3 mesi". */
  nome: string;
  confronto: { nel: string; rispetto: string } | null;
  oggi: string;
}

export const contestoPeriodo = (periodo: PeriodoStoria, primoVolantino: string | null, oggi: string = oggiIso()): ContestoPeriodo => ({
  periodo,
  giorni: periodoAnalisi(periodo, oggi),
  precedente: periodoPrecedente(periodo, oggi),
  nome: nomePeriodo(periodo, primoVolantino),
  confronto: nomeConfronto(periodo),
  oggi,
});

/** "+5", "−12", "±0": la differenza di un conteggio, col segno. */
export const formatDifferenza = (differenza: number): string => {
  const arrotondata = Math.round(differenza);
  return arrotondata === 0 ? "±0" : `${arrotondata > 0 ? "+" : "−"}${formatNumero(Math.abs(arrotondata))}`;
};

/**
 * Le edizioni del periodo, nell'ordine della timeline (dal più vecchio): un volantino è del periodo
 * se la sua validità inizia nel periodo (edizioneNelPeriodo, la stessa regola del server).
 */
export const edizioniDelPeriodo = <T extends Pick<EdizioneTimeline, "dal">>(edizioni: readonly T[], periodo: PeriodoAnalisi | null): T[] =>
  edizioni.filter(e => edizioneNelPeriodo(e.dal, periodo));

/** Giorni dopo oggi sempre in vista negli ultimi mesi, perché la linea di oggi non stia sul bordo. */
const GIORNI_DOPO_OGGI = 7;

/**
 * I giorni dell'asse della timeline (primo e ultimo compresi) per il periodo: l'anno intero, oppure
 * dall'inizio degli ultimi 12 o 3 mesi a una settimana dopo oggi, o fino alla fine dell'ultima
 * edizione se va oltre. Undefined per tutto: l'asse lo decide la timeline dai dati.
 */
export const intervalloPeriodo = (
  periodo: PeriodoStoria,
  edizioni: readonly Pick<EdizioneTimeline, "dal" | "al">[],
  oggi: string = oggiIso()
): { dal: string; al: string } | undefined => {
  if (periodo === null) return undefined;
  if (periodo === ULTIMI_3_MESI || periodo === ULTIMI_12_MESI) {
    const fine = Math.max(msData(oggi) + GIORNI_DOPO_OGGI * MS_GIORNO, ...edizioni.map(e => msData(fineEdizione(e))));
    return { dal: periodoAnalisi(periodo, oggi)!.dal!, al: isoData(fine) };
  }
  return { dal: `${periodo}-01-01`, al: `${periodo}-12-31` };
};

/* ---------- Il periodo in sintesi ---------- */

/** Quanto pesa ogni meccanica, ogni reparto e lo sconto nei volantini di un periodo. */
export interface SintesiPeriodo {
  volantini: number;
  referenze: number;
  mediaReferenze: number | null;
  /** Sconto medio delle referenze col prezzo barrato, pesato su quante sono in ogni volantino. */
  scontoMedio: number | null;
  /** Quota delle referenze (0–100) per meccanica, sulle referenze con una meccanica. */
  meccaniche: Map<MeccanicaReferenza, number>;
  /** Quota dello spazio dei box (0–100) per reparto, dal più grande; vuota se il reparto non è noto. */
  reparti: Array<{ reparto: string; quota: number }>;
}

/** Le quote per meccanica di un volantino (0–100), sulle sue referenze con una meccanica. */
/**
 * Arrotonda come il server (quote con un decimale, sconti con due): senza, 1100 su 2000 fa
 * 55,00000000000001 e la pagina scrive "55,0%" accanto a "45%".
 */
export const arrotonda = (valore: number, cifre = 1): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

export const quoteMeccaniche = (meccaniche: ReadonlyArray<{ meccanica: MeccanicaReferenza; referenze: number }>): Map<MeccanicaReferenza, number> => {
  const totale = meccaniche.reduce((somma, voce) => somma + voce.referenze, 0);
  return new Map(totale > 0 ? meccaniche.map(voce => [voce.meccanica, arrotonda((voce.referenze / totale) * 100)] as const) : []);
};

export const sintesiPeriodo = (edizioni: readonly EdizioneTimeline[]): SintesiPeriodo => {
  const referenze = edizioni.reduce((somma, e) => somma + e.numeroReferenze, 0);
  const conSconto = edizioni.filter(e => e.scontoMedio !== null && e.referenzeConSconto > 0);
  const pesoSconto = conSconto.reduce((somma, e) => somma + e.referenzeConSconto, 0);
  const meccaniche = new Map<MeccanicaReferenza, number>();
  for (const e of edizioni) for (const voce of e.meccaniche) meccaniche.set(voce.meccanica, (meccaniche.get(voce.meccanica) ?? 0) + voce.referenze);
  const reparti = new Map<string, number>();
  for (const e of edizioni) for (const voce of e.reparti) reparti.set(voce.reparto, (reparti.get(voce.reparto) ?? 0) + voce.spazio);
  const spazio = [...reparti.values()].reduce((somma, valore) => somma + valore, 0);
  return {
    volantini: edizioni.length,
    referenze,
    mediaReferenze: edizioni.length > 0 ? referenze / edizioni.length : null,
    scontoMedio: pesoSconto > 0 ? arrotonda(conSconto.reduce((somma, e) => somma + (e.scontoMedio ?? 0) * e.referenzeConSconto, 0) / pesoSconto, 2) : null,
    meccaniche: quoteMeccaniche([...meccaniche].map(([meccanica, n]) => ({ meccanica, referenze: n }))),
    reparti:
      spazio > 0
        ? [...reparti].map(([reparto, valore]) => ({ reparto, quota: arrotonda((valore / spazio) * 100) })).sort((a, b) => b.quota - a.quota || a.reparto.localeCompare(b.reparto, "it"))
        : [],
  };
};

/**
 * Quanti giorni del periodo hanno almeno un volantino valido: dal primo volantino del punto vendita
 * (o dall'inizio del periodo, se viene dopo) fino a oggi (o alla fine del periodo, se viene prima).
 * Contano tutti i volantini, anche quelli iniziati prima del periodo e ancora validi. Null se il
 * periodo non ha giorni da contare (tutto nel futuro, o prima del primo volantino).
 */
export const giorniCoperti = (
  edizioni: readonly Pick<EdizioneTimeline, "dal" | "al">[],
  periodo: PeriodoAnalisi | null,
  oggi: string = oggiIso()
): { quota: number; giorni: number; scoperti: number } | null => {
  if (edizioni.length === 0) return null;
  const primo = Math.min(...edizioni.map(e => msData(e.dal)));
  const inizio = Math.max(primo, periodo?.dal ? msData(periodo.dal) : primo);
  const fine = Math.min(msData(oggi), periodo?.al ? msData(periodo.al) : Infinity);
  if (fine < inizio) return null;
  const giorni = Math.round((fine - inizio) / MS_GIORNO) + 1;
  // Validità come intervalli di giorni [da, a], tagliati sul periodo e uniti dove si sovrappongono
  const intervalli = edizioni
    .map(e => [Math.max(inizio, msData(e.dal)), Math.min(fine, msData(fineEdizione(e)))] as const)
    .filter(([da, a]) => a >= da)
    .sort((x, y) => x[0] - y[0]);
  let coperti = 0;
  let corrente: [number, number] | null = null;
  for (const [da, a] of intervalli) {
    if (corrente && da <= corrente[1] + MS_GIORNO) corrente[1] = Math.max(corrente[1], a);
    else {
      if (corrente) coperti += Math.round((corrente[1] - corrente[0]) / MS_GIORNO) + 1;
      corrente = [da, a];
    }
  }
  if (corrente) coperti += Math.round((corrente[1] - corrente[0]) / MS_GIORNO) + 1;
  return { quota: (coperti / giorni) * 100, giorni, scoperti: giorni - coperti };
};

/**
 * Il volantino da mostrare nella scheda: quello richiesto se è nel periodo, altrimenti il più
 * recente del periodo. Null se il periodo non ne ha.
 */
export const edizioneScelta = (edizioni: readonly EdizioneTimeline[], richiesta: string | null): EdizioneTimeline | null =>
  edizioni.find(e => e.idKit === richiesta) ?? edizioni[edizioni.length - 1] ?? null;

/**
 * Barre della timeline: una per volantino, dal primo all'ultimo giorno di validità (senza la fine,
 * il primo giorno solo), colorata per insegna, con area e stato nel tooltip (referenze, sconto e
 * meccaniche arrivano dalle corsie sotto).
 */
export const barreTimeline = (edizioni: readonly EdizioneTimeline[]): BarraTimeline[] =>
  edizioni.map(edizione => ({
    id: edizione.idKit,
    dal: edizione.dal,
    al: edizione.al,
    gruppo: edizione.canale.id,
    titolo: edizione.promo.nome,
    sottotitolo: periodoValidita(edizione.dal, edizione.al),
    dettagli: [
      { etichetta: "Area", valore: edizione.area.nome },
      ...(edizione.attivo ? [{ etichetta: "Stato", valore: "attivo" }] : []),
    ],
  }));

/** I volantini della sua insegna e area senza il punto vendita, come contorni sulla timeline. */
export const assenzeTimeline = (assenze: readonly VolantinoAssente[]): AssenzaTimeline[] =>
  assenze.map(assenza => ({ id: assenza.idKit, dal: assenza.dal, al: assenza.al, titolo: assenza.promo.nome }));

/**
 * Le corsie sotto la timeline, sullo stesso asse: referenze, sconto medio e meccaniche di ogni
 * volantino, poi indirizzo e telefono come erano stampati (dai recapiti della storia).
 */
export const tracceStoria = (edizioni: readonly EdizioneTimeline[], recapiti: readonly PeriodoRecapito[] = []): TracciaTimeline[] => {
  const presenti = MECCANICHE.filter(m => edizioni.some(e => e.meccaniche.some(voce => voce.meccanica === m && voce.referenze > 0)));
  const tracce: TracciaTimeline[] = [
    {
      tipo: "colonne",
      id: "referenze",
      etichetta: "Referenze",
      valori: Object.fromEntries(edizioni.map(e => [e.idKit, e.numeroReferenze])),
      formatta: valore => formatNumero(valore),
    },
  ];
  if (edizioni.some(e => e.scontoMedio !== null)) {
    tracce.push({
      tipo: "linea",
      id: "sconto",
      etichetta: "Sconto medio",
      valori: Object.fromEntries(edizioni.map(e => [e.idKit, e.scontoMedio])),
      formatta: valore => formatPercentuale(valore),
    });
  }
  if (presenti.length > 0) {
    tracce.push({
      tipo: "impilate",
      id: "meccaniche",
      etichetta: "Meccaniche",
      categorie: presenti.map(m => ({ id: m, etichetta: ETICHETTA_MECCANICA[m], tinta: tintaMeccanica(m) })),
      valori: Object.fromEntries(edizioni.map(e => [e.idKit, Object.fromEntries(quoteMeccaniche(e.meccaniche))])),
      formatta: valore => formatPercentuale(Math.round(valore)),
    });
  }
  for (const riga of righeRecapiti(recapiti)) {
    tracce.push({
      tipo: "fasce",
      id: `recapito-${riga.id}`,
      etichetta: riga.id === "indirizzo" ? "Indirizzo stampato" : "Telefono stampato",
      fasce: riga.fasce,
      nomiToni: NOMI_TONI_RECAPITI,
    });
  }
  return tracce;
};

/**
 * Fascia delle insegne: i tratti consecutivi di volantini con la stessa insegna e la stessa area,
 * dal primo giorno del primo all'ultimo giorno dell'ultimo.
 */
export const fasceInsegne = (edizioni: readonly EdizioneTimeline[]): FasciaTimeline[] => {
  const fasce: Array<FasciaTimeline & { volantini: number; area: string }> = [];
  for (const edizione of edizioni) {
    const ultima = fasce[fasce.length - 1];
    const fine = fineEdizione(edizione);
    if (ultima && ultima.gruppo === edizione.canale.id && ultima.area === edizione.area.id) {
      ultima.al = fine > ultima.al ? fine : ultima.al;
      ultima.volantini++;
      continue;
    }
    fasce.push({
      id: `${edizione.canale.id}-${edizione.area.id}-${edizione.dal}`,
      dal: edizione.dal,
      al: fine,
      gruppo: edizione.canale.id,
      area: edizione.area.id,
      etichetta: `${edizione.canale.nome} · ${edizione.area.nome}`,
      volantini: 1,
    });
  }
  return fasce.map(({ volantini, area: _area, ...fascia }) => ({
    ...fascia,
    dettagli: [{ etichetta: "Volantini", valore: formatNumero(volantini) }],
  }));
};

/** Forma del marcatore di ogni tipo di evento, e il suo nome in legenda. */
export const FORMA_EVENTO: Readonly<Record<EventoStoria["tipo"], FormaEvento>> = {
  cambio_insegna: "cerchio",
  cambio_indirizzo: "rombo",
  cambio_telefono: "quadrato",
  cambio_area: "triangolo",
  assente: "croce",
};

export const NOMI_EVENTI: Readonly<Partial<Record<FormaEvento, string>>> = {
  cerchio: "cambio di insegna",
  rombo: "indirizzo cambiato",
  quadrato: "telefono cambiato",
  triangolo: "cambio di area",
  croce: "non compare più",
};

/** Gli eventi della storia sulla riga della timeline, con un'etichetta breve. */
export const eventiTimeline = (eventi: readonly EventoStoria[]): EventoTimeline[] =>
  eventi.map((evento, i) => {
    const data = evento.tipo === "assente" ? evento.dal : evento.data;
    const base = { id: `${evento.tipo}-${data}-${i}`, data, forma: FORMA_EVENTO[evento.tipo] };
    switch (evento.tipo) {
      case "cambio_insegna":
        return { ...base, etichetta: `Diventa ${evento.a.nome}`, dettaglio: `Da ${evento.da.nome} a ${evento.a.nome}.` };
      case "cambio_area":
        return { ...base, etichetta: `Passa all'area ${evento.a.nome}`, dettaglio: `Da ${evento.da.nome} a ${evento.a.nome}.` };
      case "cambio_indirizzo":
        return { ...base, etichetta: "Nuovo indirizzo", dettaglio: `Da «${evento.da}» a «${evento.a}».` };
      case "cambio_telefono":
        return { ...base, etichetta: "Nuovo telefono", dettaglio: `Da ${evento.da} a ${evento.a}.` };
      case "assente":
        return { ...base, etichetta: "Non compare più", dettaglio: `Manca negli ultimi ${evento.volantiniSenza} volantini della sua insegna e della sua area.` };
    }
  });

/* ---------- Indirizzo e telefono stampati ---------- */

/**
 * Chiave di confronto di un indirizzo stampato: senza maiuscole, accenti, punteggiatura e "snc"
 * (senza numero civico). Le abbreviazioni le riconosce gia' il server, che unisce i periodi uguali
 * (spec anagrafica-punti-vendita, "Recapiti stampati confrontati senza differenze di scrittura").
 */
export const chiaveConfrontoIndirizzo = (testo: string | null): string | null =>
  testo
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/(^| )snc(?= |$)/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;

/** Chiave di confronto di un telefono stampato: le sole cifre, senza prefisso internazionale. */
export const chiaveConfrontoTelefono = (testo: string | null): string | null => {
  let cifre = (testo ?? "").replace(/\D/g, "");
  if (cifre.startsWith("0039")) cifre = cifre.slice(4);
  else if (cifre.startsWith("39") && cifre.length >= 11) cifre = cifre.slice(2);
  return cifre || null;
};

/**
 * Unisce i periodi consecutivi con lo stesso valore, confrontato con `confronto` (due scritture dello
 * stesso recapito sono un periodo solo, con il testo del primo). Un tratto è "diverso
 * dall'anagrafica" se il suo valore non è quello del recapito più recente uguale all'anagrafica;
 * senza un recapito così vale il segnale del server, che però riguarda indirizzo e telefono insieme.
 */
const tratti = (
  recapiti: readonly PeriodoRecapito[],
  valore: (r: PeriodoRecapito) => string | null,
  confronto: (testo: string | null) => string | null
): FasciaTempo[] => {
  const ordinati = [...recapiti].sort((a, b) => a.dal.localeCompare(b.dal));
  const comeOggi = [...ordinati].reverse().find(r => !r.diversoDallAttuale);
  const chiaveDi = (r: PeriodoRecapito) => confronto(valore(r)) ?? "";
  const diverso = (r: PeriodoRecapito) => (comeOggi ? chiaveDi(r) !== chiaveDi(comeOggi) : r.diversoDallAttuale);
  const risultato: Array<FasciaTempo & { chiave: string; volantini: number }> = [];
  for (const recapito of ordinati) {
    const chiave = chiaveDi(recapito);
    const ultimo = risultato[risultato.length - 1];
    if (ultimo && ultimo.chiave === chiave) {
      ultimo.al = recapito.al > ultimo.al ? recapito.al : ultimo.al;
      ultimo.volantini += recapito.volantini;
      continue;
    }
    risultato.push({
      id: `${chiave}-${recapito.dal}`,
      chiave,
      dal: recapito.dal,
      al: recapito.al,
      etichetta: (chiave && valore(recapito)) || "non stampato",
      tono: !chiave ? "neutro" : diverso(recapito) ? "attenzione" : "evidenza",
      volantini: recapito.volantini,
    });
  }
  return risultato.map(({ chiave: _chiave, volantini, ...fascia }) => ({
    ...fascia,
    dettagli: [{ etichetta: "Volantini", valore: formatNumero(volantini) }],
  }));
};

/** Nomi dei toni dei tratti dei recapiti, per la legenda. */
export const NOMI_TONI_RECAPITI = {
  evidenza: "come in anagrafica",
  attenzione: "diverso dall'anagrafica",
  neutro: "non stampato",
} as const;

/** Le due righe "Indirizzo" e "Telefono" dai recapiti stampati della storia. */
export const righeRecapiti = (recapiti: readonly PeriodoRecapito[]): RigaFasce[] => {
  const indirizzo = (r: PeriodoRecapito) => [r.indirizzo, r.localita].filter(Boolean).join(", ") || null;
  return [
    { id: "indirizzo", etichetta: "Indirizzo", fasce: tratti(recapiti, indirizzo, chiaveConfrontoIndirizzo) },
    { id: "telefono", etichetta: "Telefono", fasce: tratti(recapiti, r => (r.telefono ? `tel. ${r.telefono}` : null), chiaveConfrontoTelefono) },
  ].filter(riga => riga.fasce.some(f => f.etichetta !== "non stampato"));
};

/* ---------- Infografiche della scheda ---------- */

/** Niente meccaniche ("Come si promuove") né marche più presenti: le ha tolte l'utente il 2026-11-19. */
export type InfograficaScheda = "reparti" | "prodotti";

/** Le infografiche del periodo nell'ordine della scheda, con il titolo del riquadro e perché manca il grafico. */
export const INFOGRAFICHE_SCHEDA: ReadonlyArray<{ id: InfograficaScheda; titolo: string; senzaDati: string }> = [
  { id: "reparti", titolo: "Spazio per reparto", senzaDati: "il reparto non è arrivato da DB1 né da Istanta" },
  { id: "prodotti", titolo: "Prodotti che tornano", senzaDati: "nessun prodotto compare in almeno 2 volantini del periodo" },
];

/**
 * Quali infografiche del periodo hanno qualcosa da disegnare: quelle senza dati non diventano un
 * riquadro con lo stato vuoto, ma una riga della nota "senza grafico".
 */
export const infograficheConDati = (
  sintesi: Pick<SintesiPeriodo, "reparti">,
  analisi: Pick<AnalisiPuntoVendita, "prodottiRicorrenti">
): Record<InfograficaScheda, boolean> => ({
  reparti: sintesi.reparti.length > 0,
  prodotti: analisi.prodottiRicorrenti.length > 0,
});

export const ETICHETTA_ALTRI_REPARTI = "Altri reparti";

/**
 * I reparti del periodo come barre: i più grandi (fino a MASSIMO_CATEGORIE - 1) e gli altri sommati in
 * "Altri reparti", in fondo. Accanto a ognuno la quota del periodo prima (0 se allora mancava),
 * con "Altri reparti" che somma quelli prima fuori dai più grandi di adesso; null senza periodo prima.
 */
export const repartiInBarre = (
  attuali: SintesiPeriodo["reparti"],
  prima: SintesiPeriodo["reparti"] | null
): Array<{ reparto: string; quota: number; prima: number | null; altri: boolean }> => {
  const principali = attuali.length > MASSIMO_CATEGORIE ? attuali.slice(0, MASSIMO_CATEGORIE - 1) : attuali;
  const nomi = new Set(principali.map(r => r.reparto));
  const quotaPrima = (reparto: string) => (prima ? (prima.find(r => r.reparto === reparto)?.quota ?? 0) : null);
  const voci = principali.map(r => ({ reparto: r.reparto, quota: r.quota, prima: quotaPrima(r.reparto), altri: false }));
  if (principali.length === attuali.length) return voci;
  const somma = (reparti: SintesiPeriodo["reparti"]) => arrotonda(reparti.filter(r => !nomi.has(r.reparto)).reduce((s, r) => s + r.quota, 0));
  return [...voci, { reparto: ETICHETTA_ALTRI_REPARTI, quota: somma(attuali), prima: prima ? somma(prima) : null, altri: true }];
};

/** Differenza fra due quote in punti, col segno, per la nota accanto alla barra: "+4,1 punti", "stabile". */
export const notaDifferenza = (attuale: number, prima: number | null | undefined): string | undefined =>
  prima === null || prima === undefined ? undefined : formatDifferenzaPunti(attuale - prima);

/* ---------- Pagina del volantino ---------- */

export type ColorePagina = "sconto" | "meccanica" | "reparto";

export const OPZIONI_COLORE_PAGINA: Array<{ valore: ColorePagina; etichetta: string }> = [
  { valore: "sconto", etichetta: "Sconto" },
  { valore: "meccanica", etichetta: "Meccanica" },
  { valore: "reparto", etichetta: "Reparto" },
];

/** Classi dello sconto dei box: 8 punti ciascuna, l'ultima da 48% in su. */
export const AMPIEZZA_SCONTO = 8;

export const tintaMeccanica = (meccanica: MeccanicaReferenza | null): Tinta =>
  meccanica ? tintaCategoria(MECCANICHE.indexOf(meccanica)) : TINTA_NEUTRA;

/** I reparti del volantino con il loro colore: per nome, fino a MASSIMO_CATEGORIE - 1, gli altri neutri. */
export const tinteReparti = (boxes: ReadonlyArray<Pick<BoxVolantino, "reparto" | "spazio">>): Map<string, Tinta> => {
  const spazio = new Map<string, number>();
  for (const box of boxes) if (box.reparto) spazio.set(box.reparto, (spazio.get(box.reparto) ?? 0) + box.spazio);
  const perSpazio = [...spazio].sort((a, b) => b[1] - a[1]).map(([nome]) => nome);
  const conColore = (perSpazio.length > MASSIMO_CATEGORIE ? perSpazio.slice(0, MASSIMO_CATEGORIE - 1) : perSpazio).sort((a, b) => a.localeCompare(b, "it"));
  return new Map(conColore.map((nome, i) => [nome, tintaCategoria(i)]));
};

/** Colore di un box nel modo scelto. */
export const tintaBox = (box: Pick<BoxVolantino, "sconto" | "meccanica" | "reparto">, modo: ColorePagina, reparti: Map<string, Tinta>): Tinta => {
  if (modo === "sconto") return tintaSequenziale(passoSequenziale(box.sconto, AMPIEZZA_SCONTO));
  if (modo === "meccanica") return tintaMeccanica(box.meccanica);
  return (box.reparto && reparti.get(box.reparto)) || TINTA_NEUTRA;
};

/** Legenda della pagina nel modo scelto, con la voce dei box senza il dato. */
export const legendaPagina = (modo: ColorePagina, reparti: Map<string, Tinta>, conAltriReparti: boolean): VoceLegenda[] => {
  if (modo === "sconto") {
    const ultimo = PASSI_SEQUENZIALI.length - 1;
    return [
      ...PASSI_SEQUENZIALI.map((tinta, i) => ({
        id: `s${i}`,
        etichetta: i === ultimo ? `≥ ${i * AMPIEZZA_SCONTO}%` : `${i * AMPIEZZA_SCONTO}–${(i + 1) * AMPIEZZA_SCONTO}%`,
        forma: "quadrato" as const,
        tinta,
      })),
      { id: "senza", etichetta: "senza sconto", forma: "quadrato", tinta: TINTA_NEUTRA },
    ];
  }
  if (modo === "meccanica") {
    return [
      ...MECCANICHE.map(m => ({ id: m, etichetta: ETICHETTA_MECCANICA[m], forma: "quadrato" as const, tinta: tintaMeccanica(m) })),
      { id: "senza", etichetta: "non riconosciuta", forma: "quadrato", tinta: TINTA_NEUTRA },
    ];
  }
  return [
    ...[...reparti].map(([nome, tinta]) => ({ id: nome, etichetta: nome, forma: "quadrato" as const, tinta })),
    { id: "senza", etichetta: conAltriReparti ? "altri o non noto" : "reparto non noto", forma: "quadrato", tinta: TINTA_NEUTRA },
  ];
};

/** Etichetta breve dentro il box: lo sconto, la meccanica o il reparto. */
export const etichettaBox = (box: Pick<BoxVolantino, "sconto" | "meccanica" | "reparto">, modo: ColorePagina): string | undefined => {
  if (modo === "sconto") return box.sconto !== null ? `−${formatNumero(Math.round(box.sconto))}%` : undefined;
  if (modo === "meccanica") return box.meccanica ? ETICHETTA_MECCANICA[box.meccanica] : undefined;
  return box.reparto ?? undefined;
};

/* ---------- Testi ---------- */

export const ETICHETTA_ABBINAMENTO: Readonly<Record<TipoAbbinamento, string>> = {
  telefono: "per telefono",
  indirizzo: "per indirizzo",
  probabile: "abbinamento probabile",
  manuale: "collegato a mano",
};

export const ETICHETTA_FONTE: Readonly<Record<"db1" | "istanta" | "testo", string>> = {
  db1: "DB1",
  istanta: "Istanta",
  testo: "Testo stampato",
};

/** "Granarolo · conf. 100 g × 3": marca e formato, quelli che ci sono. */
export const marcaFormato = (referenza: { marca: string | null; formato: string | null }): string =>
  [referenza.marca, referenza.formato].filter(Boolean).join(" · ");
