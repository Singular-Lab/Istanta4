import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { descrizioneStandard, variantiDei } from "../../../../lib/insightVolantino/descrizione";
import {
  DATI_PRODOTTO_PREDEFINITI,
  DATI_PRODOTTO_SCHEDA,
  DATI_TECNICI_PREDEFINITI,
  type DatoProdottoScheda,
  type DatoTecnicoScheda,
} from "../../../../lib/insightVolantino/scheda";
import type { BoxInsight, GeometriaPagina, ParteDescrizione, ProdottoInsight } from "../../../../lib/insightVolantino/tipi";
import { UNITA_ETTO } from "../../../../lib/insightVolantino/unita";
import { ETICHETTA_MECCANICA } from "../../../../lib/puntiVendita/analisi";
import { marcaFormato, NOTA_PREZZO_CALCOLATO, testoReparto } from "./box";
import { paginaNellImmagine, proporzioneRitaglio, riquadroBox, stileImmagine, stileRitaglio, type PaginaNellImmagine } from "./geometria";

/** Quante foto del prodotto si mostrano al massimo: la prima in grande, le altre da scegliere. */
const MASSIMO_FOTO = 8;
/** Altezza massima del box ritagliato, in rem: più alto accanto alle foto, ancora di più da solo. */
const ALTEZZA_RITAGLIO = 18;
const ALTEZZA_RITAGLIO_DA_SOLO = 24;

/** Una riga dell'elenco dei dati: etichetta tenue, valore in evidenza. */
function Dato({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-slate-400">{etichetta}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{children}</dd>
    </>
  );
}

/** Un gruppo di dati con il suo titolo: il box, dove sta nel volantino. */
function Gruppo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titolo}</h3>
      <dl aria-label={titolo} className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm tabular-nums">
        {children}
      </dl>
    </div>
  );
}

interface GalleriaProps {
  foto: readonly string[];
  nome: string;
  onRotta: (url: string) => void;
}

/** Le foto del prodotto: la scelta in grande e intera, sotto le miniature per sceglierne un'altra. */
function Galleria({ foto, nome, onRotta }: GalleriaProps) {
  const [scelta, setScelta] = useState<string | null>(null);
  const mostrata = scelta !== null && foto.includes(scelta) ? scelta : foto[0];
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <img
        key={mostrata}
        src={mostrata}
        alt={`Foto di ${nome}`}
        onError={() => onRotta(mostrata)}
        className="h-64 w-full rounded-control border border-slate-200 bg-white object-contain p-2 sm:h-72 dark:border-darkmode-400"
      />
      {foto.length > 1 && (
        <div role="group" aria-label="Foto del prodotto" className="flex flex-wrap gap-1.5">
          {foto.map((url, posto) => {
            const attiva = url === mostrata;
            return (
              <button
                key={url}
                type="button"
                aria-label={`Foto ${formatNumero(posto + 1)} di ${formatNumero(foto.length)}`}
                aria-pressed={attiva}
                onClick={() => setScelta(url)}
                className={twMerge(
                  "rounded-control border bg-white p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-darkmode-700",
                  attiva ? "border-primary ring-1 ring-primary" : "border-slate-200 hover:border-slate-400 dark:border-darkmode-400"
                )}
              >
                <img src={url} alt="" loading="lazy" onError={() => onRotta(url)} className="h-12 w-12 object-contain" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BoxStampatoProps {
  nome: string;
  /** L'immagine della pagina del box, la stessa del lettore. */
  immagine: string;
  riquadro: GeometriaPagina;
  /** Larghezza/altezza del box com'è stampato. */
  rapporto: number;
  proporzionePagina: number;
  /** Senza foto del prodotto il box ritagliato prende il loro posto, più grande. */
  daSolo: boolean;
}

type EsitoPagina = { url: string; pagina: PaginaNellImmagine | null };

/**
 * Il box com'è stampato: ritagliato dall'immagine della pagina, con le sue misure, compensando
 * l'abbondanza come il lettore. Se l'immagine non arriva, o Olimpo risponde con il segnaposto, lo
 * dice.
 */
function BoxStampato({ nome, immagine, riquadro, rapporto, proporzionePagina, daSolo }: BoxStampatoProps) {
  const [esito, setEsito] = useState<EsitoPagina | null>(null);
  const allineamento = esito && esito.url === immagine ? esito.pagina : null;
  const stato = !esito || esito.url !== immagine ? "caricamento" : allineamento ? "pronto" : "assente";
  const caricata = (evento: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = evento.currentTarget;
    setEsito({ url: immagine, pagina: paginaNellImmagine(naturalWidth, naturalHeight, proporzionePagina) });
  };
  const altezzaMassima = daSolo ? ALTEZZA_RITAGLIO_DA_SOLO : ALTEZZA_RITAGLIO;

  if (stato === "assente") {
    return (
      <p className="flex items-center gap-2 rounded-control border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-darkmode-400 dark:text-slate-400">
        <Lucide icon="ImageOff" aria-hidden="true" className="h-4 w-4 flex-none" />
        L'immagine della pagina non è disponibile: il box non si può mostrare com'è stampato.
      </p>
    );
  }
  return (
    <figure className="flex min-w-0 flex-col items-center gap-1.5">
      <div
        data-testid="box-stampato"
        data-stato={stato}
        className="relative max-w-full overflow-hidden rounded-control border border-slate-200 bg-white shadow-sm dark:border-darkmode-400"
        style={{ aspectRatio: String(Number(rapporto.toFixed(4))), width: `min(100%, ${Number((altezzaMassima * rapporto).toFixed(2))}rem)` }}
      >
        {stato === "caricamento" && <span aria-hidden="true" className="absolute inset-0 bg-slate-100 motion-safe:animate-pulse dark:bg-darkmode-600" />}
        {/* La pagina rifilata, più grande del ritaglio e spostata: nel ritaglio resta solo il box */}
        <div className="absolute" style={stileRitaglio(riquadro)}>
          <img
            key={immagine}
            src={immagine}
            alt={allineamento ? `${nome} com'è stampato nel volantino` : ""}
            aria-hidden={allineamento ? undefined : true}
            decoding="async"
            draggable={false}
            onLoad={caricata}
            onError={() => setEsito({ url: immagine, pagina: null })}
            className={twMerge("pointer-events-none absolute max-w-none select-none", !allineamento && "invisible")}
            style={allineamento ? stileImmagine(allineamento) : { left: 0, top: 0, width: "100%", height: "100%" }}
          />
        </div>
      </div>
      <figcaption className="text-xs text-slate-500 dark:text-slate-400">Il box com'è stampato nel volantino</figcaption>
    </figure>
  );
}

/** Prezzo in offerta grande (con "all'etto" quando è stampato all'etto), barrato, sconto, prezzo al kg e punti come stampati. */
function Prezzi({ box }: { box: BoxInsight }) {
  if (box.prezzo === null && box.barrato === null && !box.punti) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Prezzo non stampato nel box.</p>;
  }
  return (
    <div aria-label="Prezzi" className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 tabular-nums">
      {box.prezzo !== null && (
        <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100">
          {formatEuro(box.prezzo)}
          {box.prezzoAllEtto && <span className="text-base font-semibold text-slate-600 dark:text-slate-300">{` ${UNITA_ETTO}`}</span>}
        </span>
      )}
      {box.barrato !== null && (
        <span className="text-base text-slate-500">
          <span className="sr-only">invece di </span>
          <s>{formatEuro(box.barrato)}</s>
        </span>
      )}
      {box.sconto !== null && (
        <Badge variant="info" size="sm">
          −{formatPercentuale(Math.round(box.sconto))}
        </Badge>
      )}
      {box.sottocosto && (
        <Badge variant="warning" size="sm">
          Sottocosto
        </Badge>
      )}
      {box.prezzoCalcolato && <span className="basis-full text-xs text-slate-500">{NOTA_PREZZO_CALCOLATO}</span>}
      {box.prezzoAlKg && <span className="basis-full text-xs text-slate-500">{box.prezzoAlKg}</span>}
      {box.punti && <span className="basis-full text-xs text-slate-500">Punti: {box.punti}</span>}
    </div>
  );
}

/** Un EAN con il comando per copiarlo, dove il browser lo permette. */
function Ean({ codice }: { codice: string }) {
  const [copiato, setCopiato] = useState(false);
  useEffect(() => {
    if (!copiato) return;
    const attesa = setTimeout(() => setCopiato(false), 1500);
    return () => clearTimeout(attesa);
  }, [copiato]);
  const appunti = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  const copia = () => {
    appunti?.writeText(codice).then(
      () => setCopiato(true),
      () => setCopiato(false)
    );
  };
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {codice}
      {appunti && (
        <button
          type="button"
          aria-label={copiato ? `EAN ${codice} copiato` : `Copia l'EAN ${codice}`}
          title={copiato ? "Copiato" : "Copia"}
          onClick={copia}
          className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-darkmode-600 dark:hover:text-slate-200"
        >
          <Lucide icon={copiato ? "Check" : "Copy"} aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

/** Due prezzi uguali al centesimo. */
const stessoPrezzo = (a: number | null, b: number | null): boolean => a !== null && b !== null && Math.round(a * 100) === Math.round(b * 100);

/** La descrizione completa del box: quella composta dal server, o quella standard con i server non aggiornati. */
const descrizioneDel = (box: BoxInsight): ParteDescrizione[] =>
  box.descrizione ??
  descrizioneStandard({
    nome: box.nome || null,
    marca: box.marca,
    formato: box.formato,
    varianti: variantiDei(box.dettaglioProdotti ?? []),
  });

/**
 * Il cartellino del box, come sul volantino: la descrizione completa (la marca in evidenza) e
 * accanto i prezzi come stampati. Stretto, la descrizione sta sopra i prezzi.
 */
function Cartellino({ box, compatta }: { box: BoxInsight; compatta: boolean }) {
  const parti = descrizioneDel(box);
  return (
    <section
      aria-label="Descrizione e prezzo"
      className={twMerge(
        "flex gap-x-6 gap-y-3 rounded-control border border-slate-200 bg-slate-50 p-4 dark:border-darkmode-400 dark:bg-darkmode-700",
        compatta ? "flex-col" : "flex-col sm:flex-row sm:items-start sm:justify-between"
      )}
    >
      {parti.length > 0 && (
        <p data-testid="descrizione-completa" className="min-w-0 flex-1 text-lg leading-snug text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
          {parti.map((parte, posto) => (
            <span key={`${posto}-${parte.testo}`}>
              {posto > 0 && " "}
              {parte.evidenza ? (
                <strong data-testid="marca-scheda" className="font-bold uppercase tracking-wide text-primary dark:text-indigo-300">
                  {parte.testo}
                </strong>
              ) : (
                parte.testo
              )}
            </span>
          ))}
        </p>
      )}
      <div className={twMerge("min-w-0", !compatta && "sm:max-w-[55%] sm:flex-none")}>
        <Prezzi box={box} />
      </div>
    </section>
  );
}

/** Etichette dei dati della scheda, nell'ordine delle liste della configurazione. */
const ETICHETTA_DATO: Readonly<Record<DatoTecnicoScheda, string>> = {
  codice: "Codice",
  ean: "EAN",
  settore: "Settore",
  segmento: "Segmento",
  tema: "Tema",
  ruolo: "Ruolo",
  meccanicaFonte: "Meccanica nella fonte",
  origine: "Origine",
  codiceBox: "Codice box",
};

/** Il valore di un dato del prodotto, già pronto da mostrare; null se la fonte non lo fornisce. */
function valoreProdotto(prodotto: ProdottoInsight, dato: DatoProdottoScheda): ReactNode | null {
  switch (dato) {
    case "codice":
      return prodotto.codice ? <span className="font-mono text-xs">{prodotto.codice}</span> : null;
    case "ean":
      return prodotto.ean.length > 0 ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {prodotto.ean.map(codice => (
            <Ean key={codice} codice={codice} />
          ))}
        </span>
      ) : null;
    default:
      return prodotto[dato] || null;
  }
}

const datoDelProdotto = (dato: DatoTecnicoScheda): dato is DatoProdottoScheda => (DATI_PRODOTTO_SCHEDA as readonly string[]).includes(dato);

/** Cosa dice la scheda di un prodotto: nome e marca se aggiungono qualcosa, e i dati in vista. */
interface ContenutoProdotto {
  nome: string;
  marca: string;
  voci: Array<[string, ReactNode]>;
}

/**
 * I dati di un prodotto che la GDO vuole in vista (configurazione, di serie tutti): solo quelli
 * presenti, niente righe vuote, e niente di ciò che la scheda dice già (il prezzo uguale a quello del
 * box; nome e marca del prodotto unico uguali a quelli del box).
 */
function contenutoProdotto(prodotto: ProdottoInsight, box: BoxInsight, unico: boolean, dati: readonly DatoProdottoScheda[]): ContenutoProdotto {
  // Il key delle voci è l'etichetta: ognuna compare una volta sola
  const voci: Array<[string, ReactNode]> = [];
  for (const dato of dati) {
    const valore = valoreProdotto(prodotto, dato);
    if (valore !== null) voci.push([ETICHETTA_DATO[dato], valore]);
  }
  if (prodotto.prezzo !== null && !stessoPrezzo(prodotto.prezzo, box.prezzo)) voci.push(["Prezzo del prodotto", formatEuro(prodotto.prezzo)]);
  const sottotitolo = [prodotto.marca, prodotto.formato, prodotto.gusto].filter(Boolean).join(" · ");
  return {
    nome: unico && prodotto.nome === box.nome ? "" : prodotto.nome,
    marca: unico && sottotitolo === marcaFormato(box) ? "" : sottotitolo,
    voci,
  };
}

function DatiProdotto({ nome, marca, voci }: ContenutoProdotto) {
  return (
    <li className="flex flex-col gap-2 rounded-control border border-slate-200 p-3 dark:border-darkmode-400">
      {(nome || marca) && (
        <div className="min-w-0">
          {nome && <p className="text-sm font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{nome}</p>}
          {marca && <p className="text-xs text-slate-500 dark:text-slate-400">{marca}</p>}
        </div>
      )}
      {voci.length > 0 ? (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm tabular-nums">
          {voci.map(([etichetta, valore]) => (
            <Dato key={etichetta} etichetta={etichetta}>
              {valore}
            </Dato>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">La fonte non fornisce altri dati del prodotto.</p>
      )}
    </li>
  );
}

/**
 * I prodotti del box, pilota per primo, con i dati che la GDO vuole in vista. Un prodotto solo di cui
 * il cartellino ha già detto tutto non ha la sezione.
 */
function ProdottiDelBox({ box, prodotti, dati }: { box: BoxInsight; prodotti: readonly ProdottoInsight[]; dati: readonly DatoProdottoScheda[] }) {
  const unico = prodotti.length === 1;
  const contenuti = prodotti.map(prodotto => ({ chiave: prodotto.chiave, ...contenutoProdotto(prodotto, box, unico, dati) }));
  if (contenuti.length === 0 || (unico && !contenuti[0].nome && !contenuti[0].marca && contenuti[0].voci.length === 0)) return null;
  return (
    <section aria-label="Prodotti del box" className="flex flex-col gap-2">
      <h3 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {unico ? "Il prodotto" : `I ${formatNumero(prodotti.length)} prodotti del box`}
      </h3>
      <ul className="flex flex-col gap-2">
        {contenuti.map(({ chiave, ...contenuto }) => (
          <DatiProdotto key={chiave} {...contenuto} />
        ))}
      </ul>
    </section>
  );
}

const ORIGINE: Readonly<Record<NonNullable<BoxInsight["origine"]>, string>> = {
  listino: "Dal listino",
  fuori_listino: "Fuori listino",
};

/** Il valore di un codice del box per i dettagli tecnici; null se il box non l'ha. */
function valoreBox(box: BoxInsight, dato: Exclude<DatoTecnicoScheda, DatoProdottoScheda>): string | null {
  switch (dato) {
    case "meccanicaFonte":
      return box.meccanicaOriginale || null;
    case "origine":
      return box.origine ? ORIGINE[box.origine] : null;
    case "codiceBox":
      return box.codiceBox || null;
  }
}

/**
 * I codici che la GDO mette nei dettagli tecnici (configurazione, di serie quelli della fonte:
 * meccanica come la scrive la fonte, origine e codice box): a chi guarda il volantino non dicono
 * nulla, quindi stanno chiusi e si aprono se servono. Niente da mostrare: niente sezione.
 */
function DettagliTecnici({ box, dati }: { box: BoxInsight; dati: readonly DatoTecnicoScheda[] }) {
  const delBox: Array<[string, string]> = [];
  for (const dato of dati) {
    if (datoDelProdotto(dato)) continue;
    const valore = valoreBox(box, dato);
    if (valore) delBox.push([ETICHETTA_DATO[dato], valore]);
  }
  const datiProdotti = dati.filter(datoDelProdotto);
  const prodotti = (box.dettaglioProdotti ?? [])
    .map(prodotto => ({ prodotto, voci: datiProdotti.flatMap(dato => {
      const valore = valoreProdotto(prodotto, dato);
      return valore === null ? [] : [[ETICHETTA_DATO[dato], valore] as [string, ReactNode]];
    }) }))
    .filter(({ voci }) => voci.length > 0);
  if (delBox.length === 0 && prodotti.length === 0) return null;
  const piuProdotti = (box.dettaglioProdotti?.length ?? 0) > 1;
  return (
    <details data-testid="dettagli-tecnici" className="group/dettagli rounded-control border border-slate-200 dark:border-darkmode-400">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 [&::-webkit-details-marker]:hidden">
        <Lucide icon="ChevronRight" aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open/dettagli:rotate-90" />
        Dettagli tecnici
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-2 dark:border-darkmode-400">
        {delBox.length > 0 && (
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
            {delBox.map(([etichetta, valore]) => (
              <Dato key={etichetta} etichetta={etichetta}>
                {valore}
              </Dato>
            ))}
          </dl>
        )}
        {prodotti.map(({ prodotto, voci }) => (
          <div key={prodotto.chiave} className="flex flex-col gap-1">
            {piuProdotti && <p className="text-xs font-semibold text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">{prodotto.nome}</p>}
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
              {voci.map(([etichetta, valore]) => (
                <Dato key={etichetta} etichetta={etichetta}>
                  {valore}
                </Dato>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </details>
  );
}

export interface SchedaBoxProps {
  box: BoxInsight;
  totalePagine: number;
  /** L'immagine della pagina del box da Olimpo, la stessa del lettore; null senza PDF. */
  immaginePagina?: string | null;
  /** Larghezza/altezza della pagina rifilata del box. */
  proporzionePagina?: number;
  /** In uno spazio stretto (la colonna della lettura a schermo pieno): tutto in una colonna sola. */
  compatta?: boolean;
  /** I dati dei prodotti in vista, dalla configurazione della GDO; di serie tutti. */
  datiProdotto?: readonly DatoProdottoScheda[];
  /** I codici nei dettagli tecnici, dalla configurazione della GDO; di serie quelli della fonte. */
  dettagliTecnici?: readonly DatoTecnicoScheda[];
  /** Apre il viaggio del prodotto pilota nei volantini della GDO. */
  onViaggio: () => void;
}

/**
 * La scheda di un box del volantino. In alto le foto del prodotto, grandi e intere, e accanto il box
 * com'è stampato, ritagliato dalla pagina: senza foto il box ritagliato prende il loro posto. Sotto
 * il cartellino con la descrizione completa (composta dalla libreria agenzia del cliente) e i prezzi
 * come stampati, poi i dati in gruppi senza ripetizioni (il box, dove sta nel volantino, i prodotti
 * con i dati che la GDO vuole in vista), i dettagli tecnici chiusi e il pulsante del viaggio del
 * prodotto. In cima alla scheda solo il nome del box e la pagina.
 */
export function SchedaBox({
  box,
  totalePagine,
  immaginePagina = null,
  proporzionePagina = 0,
  compatta = false,
  datiProdotto = DATI_PRODOTTO_PREDEFINITI,
  dettagliTecnici = DATI_TECNICI_PREDEFINITI,
  onViaggio,
}: SchedaBoxProps) {
  const [rotte, setRotte] = useState<ReadonlySet<string>>(new Set());
  const reparto = testoReparto(box.reparto);
  const foto = box.foto.filter(url => !rotte.has(url)).slice(0, MASSIMO_FOTO);
  const riquadro = riquadroBox(box.geometria);
  const rapporto = proporzioneRitaglio(box.geometria, proporzionePagina);
  const conFoto = foto.length > 0;
  const conRitaglio = immaginePagina !== null && riquadro !== null && rapporto !== null;
  const rotta = (url: string) => setRotte(attuali => new Set(attuali).add(url));
  // Un dato nei dettagli tecnici non sta anche in vista
  const inVista = datiProdotto.filter(dato => !dettagliTecnici.includes(dato));

  return (
    <div className="flex flex-col gap-5">
      <div className={twMerge("grid items-start gap-4", conFoto && conRitaglio && !compatta && "sm:grid-cols-2")}>
        {conFoto && <Galleria foto={foto} nome={box.nome} onRotta={rotta} />}
        {conRitaglio && (
          <BoxStampato nome={box.nome} immagine={immaginePagina} riquadro={riquadro} rapporto={rapporto} proporzionePagina={proporzionePagina} daSolo={!conFoto} />
        )}
        {!conFoto && !conRitaglio && (
          <p className="flex items-center gap-2 rounded-control border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-darkmode-400 dark:text-slate-400">
            <Lucide icon="ImageOff" aria-hidden="true" className="h-4 w-4 flex-none" />
            Per questo box non ci sono foto del prodotto né l'immagine della pagina del volantino.
          </p>
        )}
      </div>

      <Cartellino box={box} compatta={compatta} />

      <section aria-label="Dati del box" className={twMerge("grid gap-4", !compatta && "sm:grid-cols-2")}>
        <Gruppo titolo="Il box">
          <Dato etichetta="Meccanica">{box.meccanica ? ETICHETTA_MECCANICA[box.meccanica] : VALORE_ASSENTE}</Dato>
          <Dato etichetta="Reparto">{reparto ?? VALORE_ASSENTE}</Dato>
          {/* La linea del distributore c'è solo se il cliente dichiara linee e il prodotto ne fa parte */}
          {box.linea && <Dato etichetta="Linea">{box.linea.nome || box.linea.sigla}</Dato>}
          <Dato etichetta="Prodotti nel box">{formatNumero(box.prodotti)}</Dato>
        </Gruppo>
        <Gruppo titolo="Nel volantino">
          <Dato etichetta="Pagina">{box.pagina !== null ? `${formatNumero(box.pagina)} di ${formatNumero(totalePagine)}` : VALORE_ASSENTE}</Dato>
          <Dato etichetta="Spazio nella pagina">{box.geometria ? `${formatPercentuale(box.spazio)} della pagina` : VALORE_ASSENTE}</Dato>
        </Gruppo>
      </section>

      {box.dettaglioProdotti && <ProdottiDelBox box={box} prodotti={box.dettaglioProdotti} dati={inVista} />}

      <DettagliTecnici box={box} dati={dettagliTecnici} />

      <div className="flex flex-col gap-2 border-t border-dashed border-slate-200 pt-4 dark:border-darkmode-400">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Dove compare il prodotto nei volantini della stessa GDO, con il prezzo di ogni edizione.
        </p>
        <div>
          <Button type="button" variant="primary" size="sm" onClick={onViaggio} disabled={!box.chiave}>
            <Lucide icon="Route" aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Viaggio del prodotto
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SchedaBox;
