import Lucide from "@/components/Base/Lucide";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { nomeRegione, type CodiceRegione } from "../../../lib/consultazione/regioni";
import {
  ampiezzaScalaRegioni,
  CARTOGRAMMA,
  classiScalaRegioni,
  passoRegione,
  plurale,
  TINTE_REGIONI,
  type ConteggioRegioni,
} from "./analisi";

export interface CartogrammaProps {
  conteggio: ConteggioRegioni;
  /** Regione scelta per filtrare, o null. */
  regione: CodiceRegione | null;
  onRegione: (regione: CodiceRegione | null) => void;
}

const testoClasse = (da: number, a: number) => (da === a ? formatNumero(da) : `${formatNumero(da)}–${formatNumero(a)}`);

/**
 * Le 20 regioni come tessere disposte come la penisola, colorate dal chiaro allo scuro secondo i
 * punti vendita stampati. Una tessera con punti vendita filtra l'elenco, la mappa e le località
 * (di nuovo per togliere il filtro); le regioni senza punti vendita sono spente. Le righe senza
 * regione si contano sotto la legenda.
 */
export function Cartogramma({ conteggio, regione, onRegione }: CartogrammaProps) {
  const ampiezza = ampiezzaScalaRegioni(conteggio.massimo);
  const classi = classiScalaRegioni(conteggio.massimo);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Punti vendita per regione"
        className="grid w-max grid-cols-[repeat(6,2.5rem)] grid-rows-[repeat(8,2.5rem)] gap-1 sm:grid-cols-[repeat(6,2.875rem)] sm:grid-rows-[repeat(8,2.875rem)]"
      >
        {CARTOGRAMMA.map(({ codice, colonna, riga }) => {
          const puntiVendita = conteggio.perRegione.get(codice) ?? 0;
          const nome = nomeRegione(codice);
          const attiva = puntiVendita > 0;
          const scelta = regione === codice;
          const tinta = TINTE_REGIONI[passoRegione(puntiVendita, ampiezza)];
          const descrizione = `${nome}: ${plurale(puntiVendita, "punto vendita", "punti vendita")}`;
          return (
            <button
              key={codice}
              type="button"
              disabled={!attiva}
              aria-pressed={attiva ? scelta : undefined}
              aria-label={descrizione}
              title={attiva ? `${descrizione}${scelta ? " (clic per togliere il filtro)" : ""}` : descrizione}
              style={{ gridColumn: colonna + 1, gridRow: riga + 1 }}
              onClick={() => onRegione(scelta ? null : codice)}
              className={twMerge(
                "flex flex-col items-center justify-center rounded-md text-3xs font-extrabold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-darkmode-600",
                attiva && tinta
                  ? twMerge(tinta.sfondo, tinta.testo, "cursor-pointer hover:brightness-110 motion-safe:transition")
                  : "cursor-default bg-slate-100 text-slate-400 dark:bg-darkmode-500 dark:text-slate-500",
                // La regione scelta ha il bordo del cartellino, non solo un altro colore
                scelta && "outline outline-[3px] outline-offset-1 outline-amber-500 dark:outline-amber-300"
              )}
            >
              <span aria-hidden="true">{codice}</span>
              {attiva && (
                <span aria-hidden="true" className="text-2xs tabular-nums">
                  {formatNumero(puntiVendita)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {classi.length > 0 && (
        <ul aria-label="Scala dei punti vendita per regione" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-slate-500 dark:text-slate-400">
          {classi.map(classe => (
            <li key={classe.passo} className="inline-flex items-center gap-1 tabular-nums">
              <span aria-hidden="true" className={twMerge("inline-block h-2.5 w-5 rounded-sm", TINTE_REGIONI[classe.passo]?.sfondo)} />
              {testoClasse(classe.da, classe.a)}
            </li>
          ))}
          <li>punti vendita</li>
        </ul>
      )}

      {conteggio.senzaRegione > 0 && (
        <p className="flex max-w-[17.5rem] gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Lucide icon="CircleHelp" aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
          <span>
            {conteggio.senzaRegione === 1
              ? "1 riga ha la regione non indicata: non è nel cartogramma."
              : `${formatNumero(conteggio.senzaRegione)} righe hanno la regione non indicata: non sono nel cartogramma.`}
          </span>
        </p>
      )}
    </div>
  );
}

export default Cartogramma;
