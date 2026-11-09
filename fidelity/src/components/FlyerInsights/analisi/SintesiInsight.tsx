import Lucide from "@/components/Base/Lucide";
import StatCard, { StatCardGrid, type StatCardProps } from "@/components/Base/StatCard";
import { coperturaParziale, formatDifferenzaPunti, formatPercentuale, periodoValidita } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import type { ConfrontoEdizione, CoperturaDati, SintesiVolantino, Variazione } from "../../../../lib/insightVolantino/tipi";
// La stessa scrittura delle differenze della tabella del confronto ("+12", "−3", "stabile")
import { formatDifferenzaNumero } from "../confronti/supporto";
import { Nota } from "./comuni";

/**
 * I numeri chiave del volantino per la Direzione, con la variazione rispetto all'edizione precedente
 * della stessa area e canale quando c'e'. Vale per ogni GDO e per i kit di Istanta e dello storico:
 * i numeri arrivano gia' calcolati dal server (EstensioneInsight.sintesi).
 */

export interface SintesiInsightProps {
  sintesi: SintesiVolantino;
  /** Edizione precedente: undefined se non richiesta, null se questa e' la prima dell'area e del canale. */
  confronto?: ConfrontoEdizione | null;
  caricamentoConfronto?: boolean;
}

export type ChiaveNumero = keyof ConfrontoEdizione["sintesi"];

/** Verso buono di una variazione; "neutra" quando salire o scendere non e' di per se' un bene. */
export type Tendenza = "neutra" | "su" | "giu";

export interface NumeroSintesi {
  chiave: ChiaveNumero;
  etichetta: string;
  icona: string;
  formatta: (valore: number | null) => string;
  /** La differenza arrotondata come si mostra, e il suo testo. */
  differenza: (differenza: number) => { arrotondata: number; testo: string };
  tendenza: Tendenza;
  dettaglio?: (sintesi: SintesiVolantino) => string;
}

const differenzaConteggio = (differenza: number) => {
  const arrotondata = Math.round(differenza);
  return { arrotondata, testo: formatDifferenzaNumero(arrotondata) };
};

// Le quote si confrontano in punti percentuali, a un decimale come le mostra la pagina
const differenzaPunti = (differenza: number) => {
  const arrotondata = Math.round(differenza * 10) / 10;
  return { arrotondata, testo: formatDifferenzaPunti(arrotondata) };
};

const conteggio = (valore: number | null) => formatNumero(valore);

/**
 * I numeri della sintesi. Quasi tutti hanno tendenza neutra: piu' referenze, piu' pagine o uno sconto
 * medio piu' alto (piu' aggressivo) sono scelte commerciali, non miglioramenti. Fa eccezione la quota
 * di box con meccanica fidelity, che misura quanto il volantino spinge la carta fedelta'.
 */
export const NUMERI_SINTESI: readonly NumeroSintesi[] = [
  { chiave: "referenze", etichetta: "Referenze", icona: "Package", formatta: conteggio, differenza: differenzaConteggio, tendenza: "neutra" },
  { chiave: "box", etichetta: "Box", icona: "Boxes", formatta: conteggio, differenza: differenzaConteggio, tendenza: "neutra" },
  { chiave: "pagine", etichetta: "Pagine", icona: "BookOpen", formatta: conteggio, differenza: differenzaConteggio, tendenza: "neutra" },
  {
    chiave: "scontoMedio",
    etichetta: "Sconto medio",
    icona: "Percent",
    formatta: valore => formatPercentuale(valore),
    differenza: differenzaPunti,
    tendenza: "neutra",
    dettaglio: sintesi => `su ${formatNumero(sintesi.boxConSconto)} box`,
  },
  {
    chiave: "quotaFidelity",
    etichetta: "Quota fidelity",
    icona: "Star",
    formatta: valore => formatPercentuale(valore),
    differenza: differenzaPunti,
    tendenza: "su",
    dettaglio: () => "dei box",
  },
  { chiave: "sottocosto", etichetta: "Sottocosto", icona: "Tag", formatta: conteggio, differenza: differenzaConteggio, tendenza: "neutra", dettaglio: () => "box" },
  { chiave: "marche", etichetta: "Marche", icona: "Award", formatta: conteggio, differenza: differenzaConteggio, tendenza: "neutra" },
];

/**
 * StatCard colora la variazione come miglioramento (verde) o peggioramento (rosso) secondo positivoSe:
 * per i numeri a tendenza neutra la riporta al grigio, lasciando freccia e testo per le tecnologie assistive.
 */
export const CLASSE_VARIAZIONE_NEUTRA = "[&_[data-direzione]]:text-slate-500 dark:[&_[data-direzione]]:text-slate-400";

/** La variazione da mostrare nella StatCard; nessuna se manca uno dei due valori. */
export const variazioneNumero = (numero: NumeroSintesi, variazione: Variazione | undefined): StatCardProps["variazione"] => {
  if (!variazione || variazione.differenza === null || !Number.isFinite(variazione.differenza)) return undefined;
  const { arrotondata, testo } = numero.differenza(variazione.differenza);
  const direzione = arrotondata === 0 ? "stabile" : arrotondata > 0 ? "su" : "giu";
  return { valore: testo, direzione, positivoSe: numero.tendenza === "giu" ? "giu" : "su" };
};

const NOMI_COPERTURA: ReadonlyArray<{ chiave: keyof CoperturaDati; nome: string }> = [
  { chiave: "prezzo", nome: "il prezzo" },
  { chiave: "marca", nome: "la marca" },
  { chiave: "reparto", nome: "il reparto" },
  { chiave: "geometria", nome: "la posizione nella pagina" },
];

/** "il prezzo nel 42% dei box, la marca nel 30%": i dati sotto la soglia di copertura. */
export const testoCoperturaParziale = (copertura: CoperturaDati): string | null => {
  const parziali = NOMI_COPERTURA.filter(voce => coperturaParziale(copertura[voce.chiave]));
  if (parziali.length === 0) return null;
  return parziali
    .map((voce, i) => `${voce.nome} nel ${formatPercentuale(copertura[voce.chiave], 0)}${i === 0 ? " dei box" : ""}`)
    .join(", ");
};

function DidascaliaConfronto({ confronto, caricamento }: { confronto: ConfrontoEdizione | null | undefined; caricamento: boolean }) {
  if (caricamento) {
    return (
      <p aria-busy="true" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Lucide icon="LoaderCircle" aria-hidden="true" className="h-3.5 w-3.5 flex-none motion-safe:animate-spin" />
        Confronto con l&apos;edizione precedente in caricamento…
      </p>
    );
  }
  if (confronto === undefined) return null;
  if (confronto === null) {
    return <Nota>Nessuna edizione precedente per la stessa area e lo stesso canale: le variazioni non si calcolano.</Nota>;
  }
  const { edizione } = confronto;
  const periodo = periodoValidita(edizione.validitaDal, edizione.validitaAl);
  return (
    <Nota icona="History">
      Variazioni rispetto all&apos;edizione precedente della stessa area e canale:{" "}
      <b className="font-semibold text-slate-700 dark:text-slate-200">{edizione.titolo}</b>, {periodo}
      {edizione.storico ? " (dallo storico)" : ""}.
    </Nota>
  );
}

export function SintesiInsight({ sintesi, confronto, caricamentoConfronto = false }: SintesiInsightProps) {
  const copertura = sintesi.box > 0 ? testoCoperturaParziale(sintesi.copertura) : null;
  return (
    <div className="space-y-2">
      <StatCardGrid className="sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {NUMERI_SINTESI.map(numero => {
          const variazione = confronto ? confronto.sintesi[numero.chiave] : undefined;
          const precedente = variazione && variazione.precedente !== null ? `prima ${numero.formatta(variazione.precedente)}` : null;
          const sottotitolo = [numero.dettaglio?.(sintesi), precedente].filter(Boolean).join(" · ");
          return (
            <StatCard
              key={numero.chiave}
              densita="compatta"
              tono="neutral"
              etichetta={numero.etichetta}
              valore={numero.formatta(sintesi[numero.chiave])}
              icona={numero.icona}
              variazione={variazioneNumero(numero, variazione)}
              sottotitolo={sottotitolo || undefined}
              className={numero.tendenza === "neutra" ? CLASSE_VARIAZIONE_NEUTRA : undefined}
            />
          );
        })}
      </StatCardGrid>
      <DidascaliaConfronto confronto={confronto} caricamento={caricamentoConfronto} />
      {copertura && (
        <Nota>
          Dati parziali: {copertura}. Sconti, marche, reparti e spazi valgono sui box che hanno il dato.
        </Nota>
      )}
    </div>
  );
}

export default SintesiInsight;
