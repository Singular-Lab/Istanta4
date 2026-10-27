import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import PageError from "@/components/Base/PageError";
import Spinner from "@/components/Base/Spinner";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import type { icons } from "lucide-react";
import type { ReactNode } from "react";

export interface PannelloElencoProps {
  /** Testo cercato e suo aggiornamento. */
  ricerca: string;
  onRicerca: (valore: string) => void;
  /** Nome accessibile del campo di ricerca. */
  etichettaRicerca: string;
  placeholderRicerca?: string;
  /** Filtri aggiuntivi accanto alla ricerca (FormSelect sm). */
  filtri?: ReactNode;
  caricamento: boolean;
  etichettaCaricamento: string;
  /** Dati non caricati: motivo e Riprova. */
  errore?: { titolo: string; motivo: string; onRiprova: () => void } | null;
  /** Numero di elementi prima dei filtri e dopo. */
  totale: number;
  filtrati: number;
  /** Stato vuoto quando non c'è ancora nessun elemento. */
  vuoto: { icona: keyof typeof icons; titolo: string; descrizione: string };
  /** Azzera ricerca e filtri, per lo stato "nessun risultato". */
  onAzzeraFiltri: () => void;
  /** Celle d'intestazione (Table.Th). */
  intestazione: ReactNode;
  /** Righe della tabella (Table.Tr). */
  children: ReactNode;
}

/**
 * Struttura comune dei pannelli a elenco delle impostazioni di produzione (formati, tipi di export,
 * naming convention): ricerca e filtri, stati di caricamento, errore e vuoto, tabella a filo.
 * Va dentro una Sezione senzaPadding.
 */
function PannelloElenco({
  ricerca,
  onRicerca,
  etichettaRicerca,
  placeholderRicerca,
  filtri,
  caricamento,
  etichettaCaricamento,
  errore,
  totale,
  filtrati,
  vuoto,
  onAzzeraFiltri,
  intestazione,
  children,
}: PannelloElencoProps) {
  let contenuto: ReactNode;
  if (caricamento) {
    contenuto = (
      <div className="flex justify-center p-12">
        <Spinner size="lg" etichetta={etichettaCaricamento} />
      </div>
    );
  } else if (errore) {
    contenuto = (
      <div className="p-5">
        <PageError compatta titolo={errore.titolo} motivo={errore.motivo} onRiprova={errore.onRiprova} />
      </div>
    );
  } else if (totale === 0) {
    contenuto = <EmptyState compatta icon={vuoto.icona} title={vuoto.titolo} description={vuoto.descrizione} />;
  } else if (filtrati === 0) {
    contenuto = (
      <EmptyState
        compatta
        icon="SearchX"
        title="Nessun risultato"
        description="Nessun elemento corrisponde alla ricerca o ai filtri scelti."
        buttonText="Azzera filtri"
        buttonIcon="X"
        onButtonClick={onAzzeraFiltri}
      />
    );
  } else {
    contenuto = (
      <div className="overflow-x-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>{intestazione}</Table.Tr>
          </Table.Thead>
          <Table.Tbody>{children}</Table.Tbody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <BarraFiltri>
        <CampoRicerca
          etichetta={etichettaRicerca}
          placeholder={placeholderRicerca}
          value={ricerca}
          onChange={onRicerca}
        />
        {filtri}
      </BarraFiltri>
      {contenuto}
    </>
  );
}

export default PannelloElenco;
