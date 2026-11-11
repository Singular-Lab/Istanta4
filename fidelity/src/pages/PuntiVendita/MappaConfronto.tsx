import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { PosizioneRiga } from "../../../lib/puntiVendita/analisi";
import { formattaDistanza } from "./ConfrontoPuntoVendita";

/** Un PV sulla mappa del confronto: quello collegato (o scelto) e gli altri, numerati come nell'elenco. */
export interface PuntoSullaMappa {
  id: string;
  nome: string;
  lat: number | null;
  lon: number | null;
  /** Il PV collegato oggi o quello scelto: unito alla posizione stampata da una linea. */
  principale?: boolean;
  /** Numero nell'elenco dei suggeriti o dei vicini. */
  numero?: number;
}

const COLORE_STAMPATA = "#EA580C";
const COLORE_PRINCIPALE = "#1D4ED8";
const COLORE_ALTRI = "#64748B";

function AdattaVista({ punti }: { punti: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (punti.length === 1) map.setView(punti[0], 16);
    else if (punti.length > 1) map.fitBounds(punti, { padding: [28, 28], maxZoom: 17 });
  }, [map, punti]);
  return null;
}

const coordinate = (punto: { lat?: number | null; lon?: number | null } | null | undefined): [number, number] | null =>
  punto && Number.isFinite(punto.lat) && Number.isFinite(punto.lon) ? [punto.lat as number, punto.lon as number] : null;

/**
 * La posizione stampata nei volantini (arancione) e i punti vendita (blu quello collegato o scelto,
 * grigi gli altri, col numero dell'elenco), con la linea fra la posizione stampata e il PV
 * principale. La mappa è di OpenStreetMap: per le vie nuove si controlla con Google Maps.
 */
export function MappaConfronto({ posizione, puntiVendita, distanzaPrincipale, etichetta }: {
  posizione: PosizioneRiga | null;
  puntiVendita: PuntoSullaMappa[];
  /** Metri fra la posizione stampata e il PV principale, se noti. */
  distanzaPrincipale?: number | null;
  etichetta: string;
}) {
  const latStampata = posizione?.lat ?? null;
  const lonStampata = posizione?.lon ?? null;
  const stampata = useMemo(() => coordinate({ lat: latStampata, lon: lonStampata }), [latStampata, lonStampata]);
  const posizionati = useMemo(() => puntiVendita.filter(punto => coordinate(punto) !== null), [puntiVendita]);
  const principale = posizionati.find(punto => punto.principale);
  // La vista si adatta solo quando cambiano i punti, non a ogni disegno
  const punti = useMemo(
    () => [...(stampata ? [stampata] : []), ...posizionati.map(punto => coordinate(punto) as [number, number])],
    [stampata, posizionati]
  );

  if (punti.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-darkmode-400">
        Né la riga né i punti vendita hanno una posizione da mostrare sulla mappa.
      </p>
    );
  }

  return (
    <figure className="flex flex-col gap-1">
      <div className="relative h-64 overflow-hidden rounded-md border border-slate-200 dark:border-darkmode-400" role="img" aria-label={etichetta}>
        <MapContainer center={punti[0]} zoom={15} scrollWheelZoom={false} className="absolute inset-0">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          <AdattaVista punti={punti} />
          {stampata && principale && (
            <Polyline positions={[stampata, coordinate(principale) as [number, number]]} pathOptions={{ color: COLORE_PRINCIPALE, weight: 2, dashArray: "6 6" }}>
              {distanzaPrincipale != null && <Tooltip sticky>{formattaDistanza(distanzaPrincipale)}</Tooltip>}
            </Polyline>
          )}
          {posizionati.map(punto => (
            <CircleMarker
              key={punto.id}
              center={coordinate(punto) as [number, number]}
              radius={punto.principale ? 9 : 7}
              pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: punto.principale ? COLORE_PRINCIPALE : COLORE_ALTRI, fillOpacity: 0.95 }}
            >
              <Tooltip>{punto.numero ? `${punto.numero}. ${punto.nome}` : punto.nome}</Tooltip>
            </CircleMarker>
          ))}
          {stampata && (
            <CircleMarker center={stampata} radius={9} pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: COLORE_STAMPATA, fillOpacity: 0.95 }}>
              <Tooltip>Come stampato nei volantini</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORE_STAMPATA }} />
          Stampato nei volantini{stampata ? "" : " (posizione non disponibile)"}
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORE_PRINCIPALE }} />
          Punto vendita collegato o scelto
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORE_ALTRI }} />
          Altri punti vendita
        </span>
      </figcaption>
    </figure>
  );
}

export default MappaConfronto;
