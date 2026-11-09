import Lucide from "@/components/Base/Lucide";
import EmptyState from "@/components/EmptyState";
import { percorsoScheda } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import type { KitPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { nomeKit, type PuntoSullaMappa } from "./analisi";

/** Inquadra i punti mostrati ogni volta che cambiano (per esempio scegliendo una regione). */
function AdattaVista({ punti }: { punti: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (punti.length > 0) map.fitBounds(punti, { padding: [32, 32], maxZoom: 13 });
  }, [map, punti]);
  return null;
}

export interface MappaPromozioneProps {
  punti: PuntoSullaMappa[];
  /** Punti vendita stampati che non sono sulla mappa: non riconosciuti nell'anagrafica o senza coordinate. */
  fuoriMappa: number;
  kitPerId: ReadonlyMap<string, KitPromozioneConsultazione>;
  /** Colore CSS del pallino del canale (Leaflet lo riceve come opzione di disegno). */
  coloreCanale: (idCanale: string) => string;
  /** Con "gdo.visualizza" il fumetto porta alla scheda del punto vendita. */
  conScheda: boolean;
  className?: string;
}

/**
 * Mappa dei punti vendita riconosciuti con le coordinate, con gli stessi tile e pallini colorati per
 * canale della mappa dei punti vendita; sotto, quante righe non ci sono. Un punto vendita stampato
 * da più volantini compare una volta, con il colore del primo.
 */
export function MappaPromozione({ punti, fuoriMappa, kitPerId, coloreCanale, conScheda, className }: MappaPromozioneProps) {
  const coordinate = useMemo(() => punti.map(punto => [punto.lat, punto.lon] as [number, number]), [punti]);

  return (
    <div className={twMerge("flex flex-col gap-3", className)}>
      {punti.length === 0 ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-card border border-dashed border-slate-200 px-4 dark:border-darkmode-400">
          <EmptyState
            compatta
            icon="MapPinOff"
            title="Nessun punto vendita sulla mappa"
            description="Nessuna riga è abbinata a un punto vendita dell'anagrafica con le coordinate."
          />
        </div>
      ) : (
        // isolate: i livelli di Leaflet restano sotto la barra in alto e i menu della pagina
        <div
          data-testid="mappa-promozione"
          className="relative isolate h-80 w-full overflow-hidden rounded-card border border-slate-200 bg-white sm:h-[420px] dark:border-darkmode-500 dark:bg-darkmode-600"
        >
          <MapContainer center={[41.8719, 12.5674]} zoom={6} preferCanvas scrollWheelZoom={false} className="absolute inset-0">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <AdattaVista punti={coordinate} />
            {punti.map(punto => {
              const kit = punto.idKit.map(id => kitPerId.get(id)).filter((k): k is KitPromozioneConsultazione => k !== undefined);
              return (
                <CircleMarker
                  key={punto.id}
                  center={[punto.lat, punto.lon]}
                  radius={7}
                  pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: coloreCanale(kit[0]?.canale.id ?? ""), fillOpacity: 0.9 }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{punto.nome}</div>
                      {kit.map(k => (
                        <div key={k.id} className="text-slate-500">
                          {nomeKit(k)}
                        </div>
                      ))}
                      {conScheda && (
                        <Link to={percorsoScheda(punto.id)} className="mt-2 inline-block text-primary underline">
                          Apri la scheda
                        </Link>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      )}
      {fuoriMappa > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Lucide icon="MapPinOff" aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
          {fuoriMappa === 1
            ? "1 punto vendita non è sulla mappa: non è riconosciuto nell'anagrafica o non ha le coordinate."
            : `${formatNumero(fuoriMappa)} punti vendita non sono sulla mappa: non sono riconosciuti nell'anagrafica o non hanno le coordinate.`}
        </p>
      )}
    </div>
  );
}

export default MappaPromozione;
