import {
  indiciPerNome,
  MASSIMO_CATEGORIE,
  passoSequenziale,
  PASSI_SEQUENZIALI,
  tintaCategoria,
  tintaSequenziale,
  TINTA_NEUTRA,
  type ColonnaTimeline,
  type EventoTimeline,
  type FasciaTimeline,
  type FasciaTempo,
  type FormaEvento,
  type RigaFasce,
  type Tinta,
  type VoceLegenda,
} from "@/components/Grafici";
import { useFetchReteInsegne } from "@/query/query";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { useMemo } from "react";
import {
  ETICHETTA_MECCANICA,
  MECCANICHE,
  type AnalisiPuntoVendita,
  type BoxVolantino,
  type EdizioneTimeline,
  type MeccanicaReferenza,
} from "../../../lib/puntiVendita/analisi";
import type { EventoStoria, PeriodoRecapito, RiferimentoStoria, TipoAbbinamento } from "../../../lib/puntiVendita/storia";

/**
 * Supporto comune alle pagine del punto vendita costruite sulla timeline dei volantini (scheda,
 * volantino, referenza; contratto in lib/puntiVendita/analisi.ts): formati, percorsi, colori e
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

/** Parametri nell'indirizzo: anno e volantino scelti nella scheda, pagina e referenza nel volantino. */
export const PARAMETRO_ANNO = "anno";
export const PARAMETRO_VOLANTINO = "volantino";
export const PARAMETRO_PAGINA = "pagina";
export const PARAMETRO_REFERENZA = "referenza";

export const percorsoScheda = (idPv: string): string => `/punti-vendita/${encodeURIComponent(idPv)}`;

/** Il volantino nella storia del punto vendita, alla pagina indicata e con la referenza da evidenziare. */
export const percorsoVolantino = (idPv: string, idKit: string, pagina?: number | null, referenza?: string | null): string => {
  const parametri = new URLSearchParams();
  if (pagina) parametri.set(PARAMETRO_PAGINA, String(pagina));
  if (referenza) parametri.set(PARAMETRO_REFERENZA, referenza);
  const query = parametri.toString();
  return `${percorsoScheda(idPv)}/volantini/${encodeURIComponent(idKit)}${query ? `?${query}` : ""}`;
};

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

/** I canali distinti delle edizioni, nell'ordine in cui compaiono. */
export const canaliDelleEdizioni = (edizioni: readonly EdizioneTimeline[]): RiferimentoStoria[] => {
  const visti = new Map<string, RiferimentoStoria>();
  for (const edizione of edizioni) if (!visti.has(edizione.canale.id)) visti.set(edizione.canale.id, edizione.canale);
  return [...visti.values()];
};

export const annoEdizione = (edizione: Pick<EdizioneTimeline, "dal">): number => Number(edizione.dal.slice(0, 4));

/** Le edizioni dell'anno scelto, o tutte; nell'ordine della timeline (dal più vecchio). */
export const edizioniDelPeriodo = (edizioni: readonly EdizioneTimeline[], anno: number | null): EdizioneTimeline[] =>
  anno === null ? [...edizioni] : edizioni.filter(e => annoEdizione(e) === anno);

/**
 * Il volantino da mostrare nella scheda: quello richiesto se è nel periodo, altrimenti il più
 * recente del periodo. Null se il periodo non ne ha.
 */
export const edizioneScelta = (edizioni: readonly EdizioneTimeline[], richiesta: string | null): EdizioneTimeline | null =>
  edizioni.find(e => e.idKit === richiesta) ?? edizioni[edizioni.length - 1] ?? null;

/** Colonne della timeline: una per volantino, alta quanto le sue referenze, colorata per insegna. */
export const colonneTimeline = (edizioni: readonly EdizioneTimeline[]): ColonnaTimeline[] =>
  edizioni.map(edizione => ({
    id: edizione.idKit,
    data: edizione.dal,
    valore: edizione.numeroReferenze,
    gruppo: edizione.canale.id,
    titolo: edizione.promo.nome,
    sottotitolo: periodoValidita(edizione.dal, edizione.al),
    dettagli: [
      { etichetta: "Area", valore: edizione.area.nome },
      ...(edizione.attivo ? [{ etichetta: "Stato", valore: "attivo" }] : []),
    ],
  }));

/**
 * Fascia delle insegne: i tratti consecutivi di volantini con la stessa insegna e la stessa area,
 * dal primo giorno del primo all'ultimo giorno dell'ultimo.
 */
export const fasceInsegne = (edizioni: readonly EdizioneTimeline[]): FasciaTimeline[] => {
  const fasce: Array<FasciaTimeline & { volantini: number; area: string }> = [];
  for (const edizione of edizioni) {
    const ultima = fasce[fasce.length - 1];
    const fine = edizione.al && edizione.al > edizione.dal ? edizione.al : edizione.dal;
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
 * Unisce i periodi consecutivi con lo stesso valore. Un tratto è "diverso dall'anagrafica" se il
 * suo valore non è quello del recapito più recente uguale all'anagrafica; senza un recapito così
 * vale il segnale del server, che però riguarda indirizzo e telefono insieme.
 */
const tratti = (recapiti: readonly PeriodoRecapito[], valore: (r: PeriodoRecapito) => string | null): FasciaTempo[] => {
  const ordinati = [...recapiti].sort((a, b) => a.dal.localeCompare(b.dal));
  const comeOggi = [...ordinati].reverse().find(r => !r.diversoDallAttuale);
  const diverso = (r: PeriodoRecapito) => (comeOggi ? valore(r) !== valore(comeOggi) : r.diversoDallAttuale);
  const risultato: Array<FasciaTempo & { chiave: string; volantini: number }> = [];
  for (const recapito of ordinati) {
    const chiave = valore(recapito) ?? "";
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
      etichetta: chiave || "non stampato",
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
    { id: "indirizzo", etichetta: "Indirizzo", fasce: tratti(recapiti, indirizzo) },
    { id: "telefono", etichetta: "Telefono", fasce: tratti(recapiti, r => (r.telefono ? `tel. ${r.telefono}` : null)) },
  ].filter(riga => riga.fasce.some(f => f.etichetta !== "non stampato"));
};

/* ---------- Infografiche della scheda ---------- */

export type InfograficaScheda = "meccaniche" | "sconto" | "marche" | "prodotti" | "reparti";

/** Le infografiche nell'ordine della scheda, con il titolo del riquadro e perché manca il grafico. */
export const INFOGRAFICHE_SCHEDA: ReadonlyArray<{ id: InfograficaScheda; titolo: string; senzaDati: string }> = [
  { id: "meccaniche", titolo: "Come si promuove", senzaDati: "le referenze non dicono la meccanica" },
  { id: "sconto", titolo: "Sconto medio", senzaDati: "nessuna referenza ha il prezzo barrato" },
  { id: "marche", titolo: "Marche più presenti", senzaDati: "le referenze non hanno la marca" },
  { id: "prodotti", titolo: "Prodotti che tornano", senzaDati: "nessun prodotto compare in più di un volantino" },
  { id: "reparti", titolo: "Dove sta nel volantino", senzaDati: "il reparto non è arrivato da DB1 né da Istanta" },
];

/**
 * Quali infografiche hanno qualcosa da disegnare: quelle senza dati non diventano un riquadro con
 * lo stato vuoto, ma una riga della nota "senza grafico".
 */
export const infograficheConDati = (
  analisi: Pick<AnalisiPuntoVendita, "meccaniche" | "anni" | "scontoPerAnno" | "marche" | "prodottiRicorrenti" | "reparti">
): Record<InfograficaScheda, boolean> => ({
  meccaniche: analisi.meccaniche.length > 0 && analisi.anni.length > 0,
  sconto: analisi.scontoPerAnno.some(a => a.sconto !== null),
  marche: analisi.marche.length > 0,
  prodotti: analisi.prodottiRicorrenti.length > 0,
  reparti: analisi.reparti.some(a => a.reparti.length > 0),
});

/* ---------- Reparti ---------- */

export const ETICHETTA_ALTRI_REPARTI = "Altri reparti";

/**
 * Reparti per anno in barre al 100%: i reparti con più spazio (fino a MASSIMO_CATEGORIE - 1) hanno
 * il loro colore, ordinato per nome; gli altri finiscono in "Altri reparti".
 */
export const repartiImpilati = (reparti: ReadonlyArray<{ anno: number; reparti: ReadonlyArray<{ reparto: string; quota: number }> }>) => {
  const anni = [...reparti].filter(a => a.reparti.length > 0).sort((a, b) => b.anno - a.anno);
  const totali = new Map<string, number>();
  for (const anno of anni) for (const r of anno.reparti) totali.set(r.reparto, (totali.get(r.reparto) ?? 0) + r.quota);
  const perSpazio = [...totali].sort((a, b) => b[1] - a[1]).map(([nome]) => nome);
  const conColore = perSpazio.length > MASSIMO_CATEGORIE ? perSpazio.slice(0, MASSIMO_CATEGORIE - 1) : perSpazio;
  const nomi = [...conColore].sort((a, b) => a.localeCompare(b, "it"));
  const altri = perSpazio.length > conColore.length;
  const categorie = [
    ...nomi.map((nome, i) => ({ id: nome, etichetta: nome, tinta: tintaCategoria(i) })),
    ...(altri ? [{ id: ETICHETTA_ALTRI_REPARTI, etichetta: ETICHETTA_ALTRI_REPARTI, tinta: TINTA_NEUTRA }] : []),
  ];
  const valori = anni.map(anno => {
    const riga = nomi.map(nome => anno.reparti.find(r => r.reparto === nome)?.quota ?? 0);
    if (altri) riga.push(anno.reparti.filter(r => !nomi.includes(r.reparto)).reduce((s, r) => s + r.quota, 0));
    return riga;
  });
  return { righe: anni.map(a => ({ id: String(a.anno), etichetta: String(a.anno) })), categorie, valori };
};

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
};

export const ETICHETTA_FONTE: Readonly<Record<"db1" | "istanta" | "testo", string>> = {
  db1: "DB1",
  istanta: "Istanta",
  testo: "Testo stampato",
};

/** "Granarolo · conf. 100 g × 3": marca e formato, quelli che ci sono. */
export const marcaFormato = (referenza: { marca: string | null; formato: string | null }): string =>
  [referenza.marca, referenza.formato].filter(Boolean).join(" · ");
