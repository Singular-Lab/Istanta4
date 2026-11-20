import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Spinner from "@/components/Base/Spinner";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { ReactNode } from "react";
import type { ElencoPuntiVendita, PuntoVenditaInElenco, VoceConteggio } from "./elenco";

interface FiltroChipProps {
  /** Nome del gruppo per le tecnologie assistive, per esempio "Insegna". */
  etichetta: string;
  tutti: string;
  voci: VoceConteggio[];
  attivo: string;
  onScegli: (id: string) => void;
  colore?: (id: string) => string;
  /** Il numero accanto a "tutti", quando le voci si sovrappongono e la somma non lo darebbe. */
  totaleTutti?: number;
  /** "assenza": la voce scelta in rosa, il colore delle assenze, invece che nel colore del tema. */
  tono?: "tema" | "assenza";
  className?: string;
}

/** Una riga di chip: "Tutte" e una voce per canale o area, ciascuna col numero di punti vendita. */
export function FiltroChip({ etichetta, tutti, voci, attivo, onScegli, colore, totaleTutti, tono = "tema", className }: FiltroChipProps) {
  const chip = (id: string, testo: string, totale: number) => (
    <button
      key={id || "tutti"}
      type="button"
      aria-pressed={attivo === id}
      onClick={() => onScegli(id)}
      className={twMerge(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
        attivo === id
          ? tono === "assenza" && id
            ? "border-rose-500 bg-rose-50 font-medium text-rose-700 dark:border-rose-400 dark:bg-rose-400/10 dark:text-rose-300"
            : "border-primary bg-primary/10 font-medium text-primary"
          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-darkmode-400 dark:text-slate-300 dark:hover:bg-darkmode-400"
      )}
    >
      {id && colore && <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: colore(id) }} />}
      {testo}
      <span className="tabular-nums text-slate-400">{formatNumero(totale)}</span>
    </button>
  );

  return (
    <div role="group" aria-label={etichetta} className={twMerge("flex flex-wrap items-center gap-1.5", className)}>
      {chip("", tutti, totaleTutti ?? voci.reduce((somma, v) => somma + v.totale, 0))}
      {voci.map(v => chip(v.id, v.nome, v.totale))}
    </div>
  );
}

export interface FiltriPuntiVenditaProps<T extends PuntoVenditaInElenco> {
  elenco: ElencoPuntiVendita<T>;
  /** Ricaricamento in corso con i dati già mostrati. */
  aggiornamento?: boolean;
  placeholder?: string;
  /** A destra della barra, per esempio la scelta fra tabella e mappa. */
  destra?: ReactNode;
  /** Un'altra riga di filtri sotto le insegne, per esempio le assenze della consultazione. */
  sotto?: ReactNode;
}

/**
 * Ricerca, area e insegna sopra i risultati, comuni alla consultazione e alla gestione: sulla
 * prima riga ricerca (con "Cerca in" quando la GDO ha codici, es. ID ANACAN) e area, con le
 * azioni della pagina allineate a destra e della stessa altezza; sotto le insegne, chip con il
 * colore della mappa. Su mobile tutto in colonna. Ogni voce conta i punti vendita rispettando gli
 * altri filtri.
 */
export function FiltriPuntiVendita<T extends PuntoVenditaInElenco>({
  elenco,
  aggiornamento = false,
  placeholder = "Nome, città, indirizzo o codice",
  destra,
  sotto,
}: FiltriPuntiVenditaProps<T>) {
  const campoScelto = elenco.campiRicerca.find(c => c.campo === elenco.campoRicerca);
  return (
    // Gli stessi spazi e bordi della BarraFiltri "sezione", su due righe
    <div className="flex flex-col gap-3 border-b border-dashed border-slate-200 p-5 dark:border-darkmode-400 [.sezione-intestazione+&]:pt-0">
      <BarraFiltri
        variante="libera"
        destra={
          aggiornamento || destra ? (
            <>
              {aggiornamento && <Spinner size="sm" etichetta="Ricerca in corso…" />}
              {destra}
            </>
          ) : undefined
        }
      >
        {elenco.campiRicerca.length > 0 && (
          // Su un codice la ricerca vuole il valore intero: il segnaposto lo dice
          <FormSelect
            aria-label="Cerca in"
            className="sm:w-48"
            value={elenco.campoRicerca}
            onChange={evento => elenco.setCampoRicerca(evento.target.value)}
          >
            <option value="">Tutti i campi</option>
            {elenco.campiRicerca.map(c => (
              <option key={c.campo} value={c.campo}>
                {c.etichetta}
              </option>
            ))}
          </FormSelect>
        )}
        <CampoRicerca
          etichetta="Cerca punto vendita"
          placeholder={campoScelto ? `${campoScelto.etichetta} esatto` : placeholder}
          value={elenco.ricerca}
          onChange={elenco.setRicerca}
        />
        {(elenco.perArea.length > 0 || elenco.filtroArea) && (
          // Dimensione normale: alta come la ricerca e come la scelta della vista
          <FormSelect
            aria-label="Area"
            className="sm:w-52"
            value={elenco.filtroArea}
            onChange={evento => elenco.setFiltroArea(evento.target.value)}
          >
            <option value="">Tutte le aree</option>
            {elenco.perArea.map(area => (
              <option key={area.id} value={area.id}>
                {area.nome} ({formatNumero(area.totale)})
              </option>
            ))}
          </FormSelect>
        )}
      </BarraFiltri>
      {elenco.perCanale.length > 0 && (
        <FiltroChip
          etichetta="Insegna"
          tutti="Tutte"
          voci={elenco.perCanale}
          attivo={elenco.filtroCanale}
          onScegli={elenco.setFiltroCanale}
          colore={elenco.coloreDelCanale}
        />
      )}
      {sotto}
    </div>
  );
}

export default FiltriPuntiVendita;
