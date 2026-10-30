import FormSelect from "@/components/Base/Form/FormSelect";
import Lucide from "@/components/Base/Lucide";
import Pagination from "@/components/Base/Pagination";
import { formatNumero } from "@/utils/format";
import { useId, type KeyboardEvent, type MouseEvent } from "react";
import { twMerge } from "@/utils/twMerge";

export interface PaginazioneTabellaProps {
  /** Numero totale di righe; con 0 il componente non mostra nulla. */
  totale: number;
  /** Pagina corrente, da 1. */
  pagina: number;
  dimensionePagina: number;
  onCambiaPagina: (pagina: number) => void;
  /** Se presente mostra la scelta delle righe per pagina; dopo il cambio si torna alla pagina 1. */
  onCambiaDimensione?: (dimensione: number) => void;
  opzioniDimensione?: number[];
  /** Cosa sono le righe, scritto dopo il totale: "Mostrati 1–100 di 1.842 file". */
  unita?: string;
  className?: string;
}

const OPZIONI_PREDEFINITE = [10, 25, 50, 100];

type Voce = number | "salto-prima" | "salto-dopo";

// Prima e ultima pagina sempre, la corrente con le vicine; i salti diventano "…"
const pagineVisibili = (corrente: number, totali: number): Voce[] => {
  if (totali <= 7) {
    return Array.from({ length: totali }, (_, indice) => indice + 1);
  }
  const scelte = [...new Set([1, corrente - 1, corrente, corrente + 1, totali])]
    .filter((numero) => numero >= 1 && numero <= totali)
    .sort((a, b) => a - b);
  const voci: Voce[] = [];
  let precedente = 0;
  for (const numero of scelte) {
    if (numero - precedente === 2) {
      voci.push(precedente + 1);
    } else if (numero - precedente > 2) {
      voci.push(numero <= corrente ? "salto-prima" : "salto-dopo");
    }
    voci.push(numero);
    precedente = numero;
  }
  return voci;
};

const CLASSI_DISATTIVO = "cursor-not-allowed opacity-50";

/** Piè di tabella: "Mostrati X–Y di Z", righe per pagina e navigazione fra le pagine. */
function PaginazioneTabella({
  totale,
  pagina,
  dimensionePagina,
  onCambiaPagina,
  onCambiaDimensione,
  opzioniDimensione = OPZIONI_PREDEFINITE,
  unita,
  className,
}: PaginazioneTabellaProps) {
  const idDimensione = useId();
  const righe = Number.isFinite(totale) ? Math.max(0, Math.trunc(totale)) : 0;
  if (righe === 0) {
    return null;
  }

  const dimensione = Math.max(1, Math.trunc(dimensionePagina) || 1);
  const totalePagine = Math.max(1, Math.ceil(righe / dimensione));
  const corrente = Math.min(Math.max(1, Math.trunc(pagina) || 1), totalePagine);
  const da = (corrente - 1) * dimensione + 1;
  const a = Math.min(corrente * dimensione, righe);
  const opzioni = opzioniDimensione.includes(dimensione)
    ? opzioniDimensione
    : [...opzioniDimensione, dimensione].sort((x, y) => x - y);

  // Link della Pagination usati come pulsanti: attivabili da tastiera con Invio e Spazio
  const comando = (destinazione: number, disattivo: boolean) => {
    const vai = () => {
      if (!disattivo && destinazione !== corrente) onCambiaPagina(destinazione);
    };
    return {
      role: "button",
      tabIndex: disattivo ? -1 : 0,
      "aria-disabled": disattivo || undefined,
      onClick: (evento: MouseEvent<HTMLAnchorElement>) => {
        evento.preventDefault();
        vai();
      },
      onKeyDown: (evento: KeyboardEvent<HTMLAnchorElement>) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          vai();
        }
      },
    };
  };

  const primaPagina = corrente === 1;
  const ultimaPagina = corrente === totalePagine;

  return (
    <div
      className={twMerge(
        "flex flex-col gap-3 px-5 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p aria-live="polite" className="tabular-nums">
        Mostrati {formatNumero(da)}–{formatNumero(a)} di {formatNumero(righe)}
        {unita ? ` ${unita}` : ""}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {onCambiaDimensione && (
          <div className="flex items-center gap-2">
            <label htmlFor={idDimensione} className="whitespace-nowrap">
              Righe per pagina
            </label>
            <FormSelect
              id={idDimensione}
              formSelectSize="sm"
              className="w-20"
              value={dimensione}
              onChange={(evento) => {
                onCambiaDimensione(Number(evento.target.value));
                if (corrente !== 1) onCambiaPagina(1);
              }}
            >
              {opzioni.map((opzione) => (
                <option key={opzione} value={opzione}>
                  {opzione}
                </option>
              ))}
            </FormSelect>
          </div>
        )}
        {totalePagine > 1 && (
          <Pagination aria-label="Paginazione">
            <Pagination.Link
              {...comando(1, primaPagina)}
              aria-label="Prima pagina"
              className={twMerge(primaPagina && CLASSI_DISATTIVO)}
            >
              <Lucide icon="ChevronsLeft" aria-hidden="true" className="h-4 w-4" />
            </Pagination.Link>
            <Pagination.Link
              {...comando(corrente - 1, primaPagina)}
              aria-label="Pagina precedente"
              className={twMerge(primaPagina && CLASSI_DISATTIVO)}
            >
              <Lucide icon="ChevronLeft" aria-hidden="true" className="h-4 w-4" />
            </Pagination.Link>
            {pagineVisibili(corrente, totalePagine).map((voce) =>
              typeof voce === "number" ? (
                <Pagination.Link
                  key={voce}
                  {...comando(voce, false)}
                  active={voce === corrente}
                  aria-label={`Pagina ${voce}`}
                  className="tabular-nums"
                >
                  {voce}
                </Pagination.Link>
              ) : (
                <li key={voce} aria-hidden="true" className="flex flex-1 items-center justify-center px-1 text-slate-400 sm:mr-2 sm:flex-initial sm:px-2">
                  …
                </li>
              )
            )}
            <Pagination.Link
              {...comando(corrente + 1, ultimaPagina)}
              aria-label="Pagina successiva"
              className={twMerge(ultimaPagina && CLASSI_DISATTIVO)}
            >
              <Lucide icon="ChevronRight" aria-hidden="true" className="h-4 w-4" />
            </Pagination.Link>
            <Pagination.Link
              {...comando(totalePagine, ultimaPagina)}
              aria-label="Ultima pagina"
              className={twMerge("sm:mr-0", ultimaPagina && CLASSI_DISATTIVO)}
            >
              <Lucide icon="ChevronsRight" aria-hidden="true" className="h-4 w-4" />
            </Pagination.Link>
          </Pagination>
        )}
      </div>
    </div>
  );
}

export default PaginazioneTabella;
