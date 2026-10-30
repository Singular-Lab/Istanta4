import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { codiciIdentificativi, DIMENSIONI_PAGINA_PUNTI_VENDITA, type ElencoPuntiVendita, type PuntoVenditaInElenco } from "./elenco";
import { useSchermoStretto } from "./useSchermoStretto";

export interface TabellaPuntiVenditaProps<T extends PuntoVenditaInElenco> {
  elenco: ElencoPuntiVendita<T>;
  caricamento: boolean;
  /** Messaggio dell'errore di caricamento, o null. */
  errore: string | null;
  onRiprova: () => void;
  /** Pagina del punto vendita: con questa il nome diventa un link. */
  percorso?: (pv: T) => string;
  /** Badge sullo stato dei dati (coordinate, codici, storia), in una colonna "Dati". */
  statoDati?: (pv: T) => ReactNode;
  /** Comandi di riga, in un'ultima colonna senza titolo visibile. */
  azioni?: (pv: T) => ReactNode;
  /** Stato vuoto senza ricerca né filtri. */
  vuoto: { titolo: string; descrizione: string };
}

const RIGHE_IN_CARICAMENTO = 5;

const localitaDi = (pv: PuntoVenditaInElenco) => [pv.cap, pv.citta, pv.provincia && `(${pv.provincia})`].filter(Boolean).join(" ");

/** Via e, sotto, CAP, città e provincia: due righe al massimo, il resto nel title. */
function Indirizzo({ pv }: { pv: PuntoVenditaInElenco }) {
  const localita = localitaDi(pv);
  return (
    <div className="max-w-44">
      <div className="truncate" title={pv.indirizzo || undefined}>
        {pv.indirizzo || "-"}
      </div>
      {localita && (
        <div className="truncate text-xs text-slate-500" title={localita}>
          {localita}
        </div>
      )}
    </div>
  );
}

function NomePuntoVendita<T extends PuntoVenditaInElenco>({ pv, percorso }: { pv: T; percorso?: (pv: T) => string }) {
  return percorso ? (
    <Link to={percorso(pv)} className="font-medium text-slate-800 hover:text-primary hover:underline dark:text-slate-200">
      {pv.nome}
    </Link>
  ) : (
    <span className="font-medium text-slate-800 dark:text-slate-200">{pv.nome}</span>
  );
}

function InsegnaArea<T extends PuntoVenditaInElenco>({ pv, elenco }: { pv: T; elenco: ElencoPuntiVendita<T> }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: elenco.coloreCanale(pv) }} />
      <span className="truncate">{[pv.nome_canale, pv.nome_area].filter(Boolean).join(" · ") || "-"}</span>
    </span>
  );
}

/**
 * Tabella e paginazione dei punti vendita della gestione, dentro una Sezione senzaPadding sotto
 * FiltriPuntiVendita: punto vendita con ragione sociale, indirizzo su due righe, insegna e area,
 * codici GDO (solo quelli che identificano il punto vendita, per le GDO che li hanno), stato dei
 * dati e comandi di riga compatti. Sotto sm ogni punto vendita è una scheda, senza colonne
 * tagliate. Errore e stato vuoto stanno fuori dalla tabella, a tutta larghezza.
 */
export function TabellaPuntiVendita<T extends PuntoVenditaInElenco>({
  elenco,
  caricamento,
  errore,
  onRiprova,
  percorso,
  statoDati,
  azioni,
  vuoto,
}: TabellaPuntiVenditaProps<T>) {
  const stretto = useSchermoStretto();
  const { righe, mostraCodiciGdo } = elenco;
  // Colonne: punto vendita, indirizzo, insegna · area, (codici), (dati), (azioni)
  const numeroColonne = 3 + (mostraCodiciGdo ? 1 : 0) + (statoDati ? 1 : 0) + (azioni ? 1 : 0);

  if (errore !== null) {
    return (
      <div className="p-5">
        <PageError compatta titolo="Punti vendita non caricati" motivo={errore} onRiprova={onRiprova} />
      </div>
    );
  }

  if (!caricamento && righe.length === 0) {
    return elenco.conFiltri ? (
      <EmptyState
        compatta
        icon="SearchX"
        title="Nessun risultato"
        description="Nessun punto vendita corrisponde alla ricerca o ai filtri."
        buttonText="Azzera filtri"
        buttonIcon="X"
        onButtonClick={elenco.azzeraFiltri}
      />
    ) : (
      <EmptyState compatta icon="Store" title={vuoto.titolo} description={vuoto.descrizione} />
    );
  }

  const paginazione = (
    <PaginazioneTabella
      totale={elenco.filtrati.length}
      pagina={elenco.pagina}
      dimensionePagina={elenco.dimensionePagina}
      opzioniDimensione={DIMENSIONI_PAGINA_PUNTI_VENDITA}
      onCambiaPagina={elenco.setPagina}
      onCambiaDimensione={elenco.setDimensionePagina}
    />
  );

  if (stretto) {
    return (
      <>
        <ul
          aria-label={caricamento ? "Caricamento dei punti vendita" : "Punti vendita"}
          aria-busy={caricamento || undefined}
          className="divide-y divide-slate-200 border-b border-slate-200 text-slate-700 dark:divide-darkmode-400 dark:border-darkmode-400 dark:text-slate-300"
        >
          {caricamento
            ? Array.from({ length: RIGHE_IN_CARICAMENTO }, (_, indice) => (
              <li key={indice} className="px-5 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
                <Skeleton className="mt-1.5 h-3 w-1/3" />
              </li>
            ))
            : righe.map(pv => {
              const localita = localitaDi(pv);
              const codici = codiciIdentificativi(pv.meta);
              return (
                <li key={pv.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <NomePuntoVendita pv={pv} percorso={percorso} />
                    {pv.ragionesociale && <div className="truncate text-xs text-slate-500">{pv.ragionesociale}</div>}
                    <div className="mt-0.5 text-xs text-slate-500">
                      {[pv.indirizzo, localita].filter(Boolean).join(" - ") || "Indirizzo non impostato"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <InsegnaArea pv={pv} elenco={elenco} />
                      {codici.map(c => (
                        <span key={c.etichetta} className="tabular-nums text-slate-500">
                          {c.etichetta} <span className="text-slate-700 dark:text-slate-300">{c.valore}</span>
                        </span>
                      ))}
                    </div>
                    {statoDati && <div className="mt-1.5 flex flex-wrap gap-1">{statoDati(pv)}</div>}
                  </div>
                  {azioni && <div className="flex-none">{azioni(pv)}</div>}
                </li>
              );
            })}
        </ul>
        {paginazione}
      </>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table sm>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="pl-5">Punto vendita</Table.Th>
              <Table.Th>Indirizzo</Table.Th>
              <Table.Th>Insegna · area</Table.Th>
              {mostraCodiciGdo && <Table.Th>Codici</Table.Th>}
              {statoDati && <Table.Th>Dati</Table.Th>}
              {azioni && <Table.Th className="pr-5 text-right"><span className="sr-only">Azioni</span></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody aria-busy={caricamento || undefined} className="text-slate-700 dark:text-slate-300">
            {caricamento
              ? Array.from({ length: RIGHE_IN_CARICAMENTO }, (_, indice) => (
                <Table.Tr key={indice}>
                  {Array.from({ length: numeroColonne }, (_, colonna) => (
                    <Table.Td key={colonna} className={colonna === 0 ? "pl-5" : undefined}>
                      <Skeleton className="h-4 w-3/4" />
                      {colonna < 2 && <Skeleton className="mt-1.5 h-3 w-1/2" />}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
              : righe.map(pv => (
                <Table.Tr key={pv.id}>
                  <Table.Td className="min-w-36 pl-5">
                    <NomePuntoVendita pv={pv} percorso={percorso} />
                    {pv.ragionesociale && (
                      <div className="max-w-56 truncate text-xs text-slate-500" title={pv.ragionesociale}>
                        {pv.ragionesociale}
                      </div>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Indirizzo pv={pv} />
                  </Table.Td>
                  <Table.Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: elenco.coloreCanale(pv) }} />
                      {pv.nome_canale || "-"}
                    </span>
                    {pv.nome_area && <div className="text-xs text-slate-500">{pv.nome_area}</div>}
                  </Table.Td>
                  {mostraCodiciGdo && (
                    <Table.Td className="whitespace-nowrap text-xs tabular-nums">
                      {codiciIdentificativi(pv.meta).map(c => (
                        <div key={c.etichetta}>
                          <span className="text-slate-500">{c.etichetta}</span> {c.valore}
                        </div>
                      ))}
                    </Table.Td>
                  )}
                  {statoDati && (
                    <Table.Td>
                      <div className="flex flex-wrap gap-1">{statoDati(pv)}</div>
                    </Table.Td>
                  )}
                  {azioni && <Table.Td className="whitespace-nowrap pr-5 text-right">{azioni(pv)}</Table.Td>}
                </Table.Tr>
              ))}
          </Table.Tbody>
        </Table>
      </div>
      {paginazione}
    </>
  );
}

export default TabellaPuntiVendita;
