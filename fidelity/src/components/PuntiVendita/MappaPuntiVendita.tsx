import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Spinner from "@/components/Base/Spinner";
import EmptyState from "@/components/EmptyState";
import { twMerge } from "@/utils/twMerge";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { canaleArea, indirizzoCompleto } from "../../utils/puntoVendita";
import { haCoordinate, type ElencoPuntiVendita, type PuntoVenditaInElenco } from "./elenco";

/** Inquadra i punti mostrati ogni volta che cambiano ricerca o filtri. */
function AdattaVista({ punti }: { punti: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (punti.length > 0) map.fitBounds(punti, { padding: [32, 32], maxZoom: 15 });
  }, [map, punti]);
  return null;
}

interface MappaProps<T extends PuntoVenditaInElenco> {
  puntiVendita: T[];
  coloreCanale: (pv: T) => string;
  onDettagli: (pv: T) => void;
  etichettaDettagli: string;
}

function Mappa<T extends PuntoVenditaInElenco>({ puntiVendita, coloreCanale, onDettagli, etichettaDettagli }: MappaProps<T>) {
  const posizionati = useMemo(() => puntiVendita.filter(haCoordinate), [puntiVendita]);
  const punti = useMemo(
    () => posizionati.map(pv => [pv.coordinate.lat, pv.coordinate.lon] as [number, number]),
    [posizionati]
  );

  return (
    <MapContainer
      center={[41.8719, 12.5674]} // Italia
      zoom={6}
      preferCanvas
      scrollWheelZoom={false}
      className="absolute inset-0"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <AdattaVista punti={punti} />
      {posizionati.map(pv => (
        <CircleMarker
          key={pv.id}
          center={[pv.coordinate.lat, pv.coordinate.lon]}
          radius={7}
          pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: coloreCanale(pv), fillOpacity: 0.9 }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{pv.nome}</div>
              <div>{indirizzoCompleto(pv)}</div>
              <div className="text-slate-500">{canaleArea(pv)}</div>
              <button type="button" className="mt-2 text-primary underline" onClick={() => onDettagli(pv)}>
                {etichettaDettagli}
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export interface MappaPuntiVenditaProps<T extends PuntoVenditaInElenco> {
  /** Tutti i punti vendita caricati, prima dei filtri. */
  tutti: T[];
  elenco: ElencoPuntiVendita<T>;
  caricamento: boolean;
  /** Messaggio dell'errore di caricamento, o null. */
  errore: string | null;
  onRiprova: () => void;
  onDettagli: (pv: T) => void;
  etichettaDettagli?: string;
  /** Cosa dire quando nessun punto vendita ha coordinate. */
  descrizioneSenzaPosizione: string;
  /** Classi del riquadro della mappa (altezza, bordi). */
  className?: string;
}

/**
 * Mappa dei punti vendita filtrati, colorati per canale, e sotto quanti punti vendita filtrati
 * non compaiono perché senza coordinate. Ricerca e filtri stanno sopra, nella barra dei risultati.
 */
export function MappaPuntiVendita<T extends PuntoVenditaInElenco>({
  tutti,
  elenco,
  caricamento,
  errore,
  onRiprova,
  onDettagli,
  etichettaDettagli = "Dettagli",
  descrizioneSenzaPosizione,
  className,
}: MappaPuntiVenditaProps<T>) {
  const conPosizione = tutti.some(haCoordinate);
  const { senzaCoordinate } = elenco;

  return (
    <>
      <div
        className={twMerge(
          "relative h-80 w-full overflow-hidden rounded-card border border-slate-200 bg-white sm:h-[440px] dark:border-darkmode-500 dark:bg-darkmode-600",
          className
        )}
      >
        {caricamento && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 px-6 backdrop-blur-sm dark:bg-darkmode-600/80">
            <Spinner size="lg" etichetta="Caricamento punti vendita" />
          </div>
        )}

        {errore !== null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <PageError
              compatta
              titolo="Punti vendita non caricati"
              motivo={errore}
              onRiprova={onRiprova}
              className="w-full max-w-lg bg-white"
            />
          </div>
        )}

        {!caricamento && conPosizione && (
          <Mappa
            puntiVendita={elenco.filtrati}
            coloreCanale={elenco.coloreCanale}
            onDettagli={onDettagli}
            etichettaDettagli={etichettaDettagli}
          />
        )}

        {!caricamento && errore === null && !conPosizione && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <EmptyState
              compatta
              icon="MapPin"
              title="Nessun punto vendita geolocalizzato"
              description={descrizioneSenzaPosizione}
            />
          </div>
        )}
      </div>
      {tutti.length > 0 && senzaCoordinate > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Lucide icon="MapPinOff" aria-hidden="true" className="h-3.5 w-3.5" />
          {senzaCoordinate === 1
            ? "1 punto vendita filtrato non ha coordinate e non compare sulla mappa."
            : `${senzaCoordinate} punti vendita filtrati non hanno coordinate e non compaiono sulla mappa.`}
        </div>
      )}
    </>
  );
}

export default MappaPuntiVendita;
