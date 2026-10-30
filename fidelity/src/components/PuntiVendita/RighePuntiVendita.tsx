import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Link } from "react-router-dom";
import { indirizzoCompleto } from "../../utils/puntoVendita";
import { codiciIdentificativi, DIMENSIONI_PAGINA_PUNTI_VENDITA, volantiniDi, type ConStoria, type ElencoPuntiVendita, type PuntoVenditaInElenco } from "./elenco";
import { periodiInsegna, StrisciaInsegne, testoPeriodiInsegna } from "./StrisciaInsegne";

export interface RighePuntiVenditaProps<T extends PuntoVenditaInElenco & ConStoria> {
  elenco: ElencoPuntiVendita<T>;
  caricamento: boolean;
  /** Messaggio dell'errore di caricamento, o null. */
  errore: string | null;
  onRiprova: () => void;
  percorsoScheda: (pv: T) => string;
  /** Anni della striscia delle insegne; vuoto se il server non manda la storia con l'elenco. */
  anni: number[];
  /** Stato vuoto senza ricerca né filtri. */
  vuoto: { titolo: string; descrizione: string };
}

const testoVolantini = (numero: number) => (numero === 1 ? "1 volantino" : `${formatNumero(numero)} volantini`);

/**
 * Le righe dell'elenco della consultazione: nome, indirizzo e, sotto, insegna, area e codici GDO;
 * l'insegna nei volantini anno per anno, quanti volantini e se ha cambiato insegna. Senza la
 * storia nell'elenco la riga ha solo la prima colonna. Tutta la riga apre la scheda del punto vendita.
 */
export function RighePuntiVendita<T extends PuntoVenditaInElenco & ConStoria>({
  elenco,
  caricamento,
  errore,
  onRiprova,
  percorsoScheda,
  anni,
  vuoto,
}: RighePuntiVenditaProps<T>) {
  const conStoria = anni.length > 0;

  if (caricamento) {
    return (
      <ul aria-busy="true" aria-label="Caricamento dei punti vendita" className="divide-y divide-slate-200 dark:divide-darkmode-400">
        {Array.from({ length: 6 }, (_, indice) => (
          <li key={indice} className="grid grid-cols-1 gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)_10rem] md:items-center">
            <div>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
              <Skeleton className="mt-1.5 h-3 w-1/3" />
            </div>
            <Skeleton className="h-3" />
            <Skeleton className="h-4 w-20 md:justify-self-end" />
          </li>
        ))}
      </ul>
    );
  }

  if (errore !== null) {
    return (
      <div className="p-5">
        <PageError compatta titolo="Punti vendita non caricati" motivo={errore} onRiprova={onRiprova} />
      </div>
    );
  }

  if (elenco.righe.length === 0) {
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

  return (
    <>
      <ul aria-label="Punti vendita" className="divide-y divide-slate-200 dark:divide-darkmode-400">
        {elenco.righe.map(pv => {
          const indirizzo = indirizzoCompleto(pv);
          const volantini = volantiniDi(pv);
          const cambio = Boolean(pv.storia?.cambioInsegna);
          const periodi = periodiInsegna(pv.storia?.insegnePerAnno ?? []);
          // Il nome del link per intero: la striscia è solo visiva, i suoi anni li dice il testo
          const etichetta = [
            pv.nome,
            indirizzo,
            pv.nome_canale,
            ...(conStoria
              ? [testoVolantini(volantini), periodi.length > 0 ? `nei volantini: ${testoPeriodiInsegna(periodi)}` : "mai nei volantini"]
              : []),
            ...(cambio ? ["ha cambiato insegna"] : []),
          ]
            .filter(Boolean)
            .join(", ");
          const codici = codiciIdentificativi(pv.meta);
          return (
            <li key={pv.id}>
              <Link
                to={percorsoScheda(pv)}
                aria-label={etichetta}
                className={twMerge(
                  // Su mobile la striscia e i volantini stanno affiancati sotto nome e indirizzo
                  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-2 px-5 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40 md:items-center dark:hover:bg-darkmode-400/40",
                  conStoria ? "md:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)_10rem]" : "md:grid-cols-[minmax(0,1fr)_auto]"
                )}
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <div className="truncate font-medium text-slate-800 dark:text-slate-200">{pv.nome}</div>
                  <div className="truncate text-xs text-slate-500">{indirizzo || "Indirizzo non impostato"}</div>
                  {/* Insegna e area accanto al nome, non in fondo alla riga: con i codici che la GDO usa */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: elenco.coloreCanale(pv) }} />
                      {[pv.nome_canale, pv.nome_area].filter(Boolean).join(" · ") || "-"}
                    </span>
                    {codici.map(c => (
                      <span key={c.etichetta} className="whitespace-nowrap tabular-nums">
                        {c.etichetta} <span className="text-slate-600 dark:text-slate-300">{c.valore}</span>
                      </span>
                    ))}
                  </div>
                </div>
                {conStoria && <StrisciaInsegne anni={anni} storia={pv.storia} coloreDelCanale={elenco.coloreDelCanale} />}
                {(conStoria || cambio) && (
                  <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
                    {conStoria && (
                      <span className="whitespace-nowrap tabular-nums">
                        <strong className="text-sm text-slate-800 dark:text-slate-200">{formatNumero(volantini)}</strong>{" "}
                        {volantini === 1 ? "volantino" : "volantini"}
                      </span>
                    )}
                    {cambio && <StatusBadge tono="info" icon="Repeat" etichetta="Ha cambiato insegna" />}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <PaginazioneTabella
        totale={elenco.filtrati.length}
        pagina={elenco.pagina}
        dimensionePagina={elenco.dimensionePagina}
        opzioniDimensione={DIMENSIONI_PAGINA_PUNTI_VENDITA}
        onCambiaPagina={elenco.setPagina}
        onCambiaDimensione={elenco.setDimensionePagina}
      />
    </>
  );
}

export default RighePuntiVendita;
