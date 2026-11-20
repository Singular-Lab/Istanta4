import Lucide from "@/components/Base/Lucide";
import { coperturaParziale, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import type { BoxInsight, CoperturaDati, LineeDistributore, SintesiVolantino } from "../../../../lib/insightVolantino/tipi";
import { Nota } from "./comuni";

/**
 * I numeri chiave del volantino per la Direzione, in una fascia di riquadri. Vale per ogni GDO e per
 * i kit di Istanta e dello storico: i numeri arrivano gia' calcolati dal server
 * (EstensioneInsight.sintesi e, se il cliente dichiara linee, lineeDistributore). Niente confronti
 * con altre edizioni: il dettaglio racconta solo questo volantino.
 */

export interface SintesiInsightProps {
  sintesi: SintesiVolantino;
  /** I box del volantino, per contare quelli con il Prezzo Fidelity; senza, si ricavano dalla quota. */
  box?: readonly Pick<BoxInsight, "meccanica">[];
  /** Le linee del distributore: aggiungono il riquadro delle Private Labels. */
  lineeDistributore?: LineeDistributore | null;
}

export interface NumeroSintesi {
  id: string;
  etichetta: string;
  icona: string;
  valore: string;
  sottotitolo?: string;
}

const contaBox = (numero: number): string => (numero === 1 ? "1 box" : `${formatNumero(numero)} box`);

/** "4,5 box a pagina": una cifra decimale, senza se la media e' intera. */
const boxAPagina = (box: number, pagine: number): string | undefined =>
  pagine > 0 ? `${formatNumero(Math.round((box / pagine) * 10) / 10)} box a pagina` : undefined;

/** I box con il Prezzo Fidelity: contati sui box se ci sono, altrimenti dalla quota della sintesi. */
const boxFidelity = (sintesi: SintesiVolantino, box?: readonly Pick<BoxInsight, "meccanica">[]): number =>
  box ? box.filter(voce => voce.meccanica === "fidelity").length : Math.round((sintesi.quotaFidelity / 100) * sintesi.box);

/**
 * I riquadri della fascia, nell'ordine in cui si leggono: quanto e' grande il volantino, quanto spinge
 * la carta e quanto spazio hanno le Private Labels. Sconto medio, sottocosto e numero di marche non ci
 * sono (spec insight-volantino, "Prezzi, sconti, spazio e marche del volantino").
 */
export const numeriSintesi = (
  sintesi: SintesiVolantino,
  box?: readonly Pick<BoxInsight, "meccanica">[],
  lineeDistributore?: LineeDistributore | null
): NumeroSintesi[] => {
  const numeri: NumeroSintesi[] = [
    { id: "referenze", etichetta: "Referenze", icona: "Package", valore: formatNumero(sintesi.referenze), sottotitolo: contaBox(sintesi.box) },
    { id: "pagine", etichetta: "Pagine", icona: "BookOpen", valore: formatNumero(sintesi.pagine), sottotitolo: boxAPagina(sintesi.box, sintesi.pagine) },
    {
      id: "fidelity",
      etichetta: "Prezzo Fidelity",
      icona: "Star",
      valore: formatPercentuale(sintesi.quotaFidelity),
      sottotitolo: contaBox(boxFidelity(sintesi, box)),
    },
  ];
  if (lineeDistributore) {
    numeri.push({
      id: "distributore",
      etichetta: "Private Labels",
      icona: "BadgeCheck",
      valore: formatPercentuale(lineeDistributore.quotaSpazio),
      sottotitolo: `dello spazio, ${contaBox(lineeDistributore.box)}`,
    });
  }
  return numeri;
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

/** Un riquadro della fascia, bianco come gli altri anche per le Private Labels: etichetta, valore grande e una riga di dettaglio. */
function Riquadro({ numero }: { numero: NumeroSintesi }) {
  return (
    <dl data-numero={numero.id} className="min-w-0 rounded-card border border-slate-200 bg-white px-4 py-3 shadow-card dark:border-darkmode-400 dark:bg-darkmode-600">
      <dt title={numero.etichetta} className="flex items-center gap-1.5 truncate text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Lucide icon={numero.icona} aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
        <span className="truncate">{numero.etichetta}</span>
      </dt>
      <dd className="mt-1 truncate text-2xl font-bold leading-tight tabular-nums text-slate-800 dark:text-slate-100">{numero.valore || VALORE_ASSENTE}</dd>
      {numero.sottotitolo && <dd className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{numero.sottotitolo}</dd>}
    </dl>
  );
}

export function SintesiInsight({ sintesi, box, lineeDistributore }: SintesiInsightProps) {
  const copertura = sintesi.box > 0 ? testoCoperturaParziale(sintesi.copertura) : null;
  const numeri = numeriSintesi(sintesi, box, lineeDistributore);
  return (
    <div className="space-y-2">
      {/* Una riga sola finché ci stanno, poi vanno a capo: almeno 9,5rem a riquadro */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
        {numeri.map(numero => (
          <Riquadro key={numero.id} numero={numero} />
        ))}
      </div>
      {copertura && (
        <Nota>
          Dati parziali: {copertura}. Sconti, marche, reparti e spazi valgono sui box che hanno il dato.
        </Nota>
      )}
    </div>
  );
}

export default SintesiInsight;
