import { notifyManager, useQueryClient, type QueryKey, type QueryState } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { DettaglioReferenzaPv, DettaglioVolantinoPv } from "../../../lib/puntiVendita/analisi";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";
import type { PuntoVenditaResponseDTO } from "../../../server/core/dto";

/**
 * Nomi del breadcrumb per le pagine dei punti vendita: il nome del punto vendita al posto del suo
 * id, la promo del volantino e il nome della referenza. Il breadcrumb legge i dati che la pagina ha
 * già chiesto (stesse chiavi di query/query.tsx) e non fa richieste sue: si aggiorna quando
 * arrivano, e dopo una modifica del punto vendita mostra il nome nuovo.
 *
 * Rotte: /gestione-interna/punti-vendita/:id, /punti-vendita/:id,
 * /punti-vendita/:id/volantini/:idKit e /punti-vendita/:id/referenze/:chiave. I segmenti
 * "volantini" e "referenze" non sono pagine: il breadcrumb li salta.
 */

const CARICAMENTO = "Caricamento...";

const decodifica = (segmento: string) => {
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
};

interface Dettaglio {
  /** Posizione del segmento nel percorso. */
  indice: number;
  chiave: QueryKey;
  nome: (dato: unknown) => string | null | undefined;
}

/** Dove sta il punto vendita nel percorso, e la pagina figlia (volantino o referenza) se c'è. */
const dettagliDelPercorso = (segmenti: string[]): { puntoVendita: Dettaglio | null; figlio: Dettaglio | null; saltati: number[] } => {
  const [radice, sezione, id] = segmenti;
  if (radice === "gestione-interna" && sezione === "punti-vendita" && id && segmenti.length === 3) {
    return {
      // La gestione parte dal punto vendita del loader e lo rilegge dopo ogni modifica (useFetchPuntoVenditaGestione)
      puntoVendita: {
        indice: 2,
        chiave: ["dataPuntiVendita", "gestione", decodifica(id)],
        nome: dato => (dato as PuntoVenditaResponseDTO | undefined)?.nome_display || (dato as PuntoVenditaResponseDTO | undefined)?.nome,
      },
      figlio: null,
      saltati: [],
    };
  }
  if (radice !== "punti-vendita" || !sezione) return { puntoVendita: null, figlio: null, saltati: [] };

  const idPv = decodifica(sezione);
  const puntoVendita: Dettaglio = {
    indice: 1,
    chiave: ["puntiVendita", "consultazione", idPv],
    nome: dato => (dato as PuntoVenditaConsultazione | undefined)?.nome,
  };
  const [, , pagina, idFiglio] = segmenti;
  if (pagina === "volantini" && idFiglio && segmenti.length === 4) {
    return {
      puntoVendita,
      figlio: {
        indice: 3,
        chiave: ["puntiVendita", "volantino", idPv, decodifica(idFiglio)],
        nome: dato => (dato as DettaglioVolantinoPv | undefined)?.promo?.nome || (dato as DettaglioVolantinoPv | undefined)?.kit?.titolo,
      },
      saltati: [2],
    };
  }
  if (pagina === "referenze" && idFiglio && segmenti.length === 4) {
    return {
      puntoVendita,
      figlio: {
        indice: 3,
        chiave: ["puntiVendita", "referenza", idPv, decodifica(idFiglio)],
        nome: dato => (dato as DettaglioReferenzaPv | undefined)?.nome,
      },
      saltati: [2],
    };
  }
  return { puntoVendita, figlio: null, saltati: [] };
};

/** Lo stato della query della pagina, senza crearla: la crea e la chiede la pagina. */
function useStatoQuery(chiave: QueryKey | null): QueryState | undefined {
  const client = useQueryClient();
  // Gli avvisi della cache arrivano anche mentre la pagina crea la sua query, cioè durante il suo
  // render: come useQuery, li si rimanda a dopo, per non aggiornare il breadcrumb in quel momento
  const iscrivi = useCallback(
    (avvisa: () => void) => client.getQueryCache().subscribe(notifyManager.batchCalls(avvisa)),
    [client]
  );
  const leggi = () => (chiave ? client.getQueryState(chiave) : undefined);
  return useSyncExternalStore(iscrivi, leggi, leggi);
}

const etichetta = (dettaglio: Dettaglio | null, stato: QueryState | undefined) => {
  if (!dettaglio) return null;
  const nome = dettaglio.nome(stato?.data);
  if (nome) return nome;
  return stato?.status === "pending" && stato.fetchStatus === "fetching" ? CARICAMENTO : null;
};

export interface EtichettePercorsoPuntoVendita {
  /** Etichetta per posizione del segmento; senza, il breadcrumb usa la sua. */
  etichette: Map<number, string>;
  /** Segmenti da non mostrare, perché non sono pagine. */
  saltati: Set<number>;
}

export function useEtichettePercorsoPuntoVendita(segmenti: string[]): EtichettePercorsoPuntoVendita {
  const { puntoVendita, figlio, saltati } = dettagliDelPercorso(segmenti);
  const statoPuntoVendita = useStatoQuery(puntoVendita?.chiave ?? null);
  const statoFiglio = useStatoQuery(figlio?.chiave ?? null);

  const etichette = new Map<number, string>();
  const nomePuntoVendita = etichetta(puntoVendita, statoPuntoVendita);
  if (puntoVendita && nomePuntoVendita) etichette.set(puntoVendita.indice, nomePuntoVendita);
  const nomeFiglio = etichetta(figlio, statoFiglio);
  if (figlio && nomeFiglio) etichette.set(figlio.indice, nomeFiglio);
  return { etichette, saltati: new Set(saltati) };
}
