import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import { useCorreggiPosizioneRiga } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { useId, useState } from "react";
import type {
  CombinazioneRiga,
  ConfrontoConPuntoVendita,
  ConfrontoDato,
  PosizioneRiga,
  PrecisionePosizione,
} from "../../../lib/puntiVendita/analisi";
import { coordinateDaTesto } from "../../utils/importPuntiVendita";

/**
 * I pezzi comuni al collegamento di una riga e alla verifica dei collegamenti: link a Google Maps
 * e Street View (la mappa di OpenStreetMap può non avere le vie e i civici più recenti), il
 * confronto fra quello che è stampato e l'anagrafica, la distanza, la precisione della posizione e
 * la sua correzione con le coordinate di Google Maps.
 */

/** "450 m", "1,2 km", "95 km". */
export function formattaDistanza(metri: number): string {
  if (metri < 1000) return `${formatNumero(Math.round(metri))} m`;
  const km = metri / 1000;
  return `${km.toLocaleString("it-IT", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

export const ETICHETTA_PRECISIONE: Readonly<Record<PrecisionePosizione, string>> = {
  civico: "al civico",
  via: "solo la via",
  comune: "solo il comune",
  non_trovata: "non trovata",
};

/** "Conad City · Liguria". */
export const nomeCombinazione = (combinazione: CombinazioneRiga): string =>
  [combinazione.canale?.nome || "Canale sconosciuto", combinazione.area?.nome || "area sconosciuta"].join(" · ");

/** Google Maps su un indirizzo o su un punto: si apre in una scheda nuova, fuori da Fidelity. */
export const linkGoogleMaps = (dove: string | { lat: number; lon: number }): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(typeof dove === "string" ? dove : `${dove.lat},${dove.lon}`)}`;

/** Street View su un punto. */
export const linkStreetView = (punto: { lat: number; lon: number }): string =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${punto.lat},${punto.lon}`)}`;

const coordinateDi = (punto: { lat?: number | null; lon?: number | null } | null | undefined) =>
  punto && Number.isFinite(punto.lat) && Number.isFinite(punto.lon) ? { lat: punto.lat as number, lon: punto.lon as number } : null;

const CLASSE_LINK =
  "inline-flex items-center gap-1 rounded text-xs text-theme-1 underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40";

/**
 * Apri in Google Maps l'indirizzo (meglio del punto: Google lo trova anche se OpenStreetMap no) e,
 * con le coordinate, in Street View.
 */
export function LinkMappe({ indirizzo, punto, cosa }: { indirizzo?: string | null; punto?: { lat?: number | null; lon?: number | null } | null; cosa: string }) {
  const coordinate = coordinateDi(punto);
  const dove = indirizzo?.trim() || coordinate;
  if (!dove) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href={linkGoogleMaps(dove)} target="_blank" rel="noopener noreferrer" className={CLASSE_LINK} aria-label={`Apri ${cosa} in Google Maps`}>
        <Lucide icon="MapPinned" aria-hidden="true" className="h-3.5 w-3.5" />
        Google Maps
      </a>
      {coordinate && (
        <a href={linkStreetView(coordinate)} target="_blank" rel="noopener noreferrer" className={CLASSE_LINK} aria-label={`Apri ${cosa} in Street View`}>
          <Lucide icon="PersonStanding" aria-hidden="true" className="h-3.5 w-3.5" />
          Street View
        </a>
      )}
    </span>
  );
}

const ICONA_CONFRONTO: Readonly<Record<ConfrontoDato, { icona: string; tono: "success" | "warning" | "danger" | "neutral"; testo: string }>> = {
  uguale: { icona: "Check", tono: "success", testo: "uguale" },
  simile: { icona: "Equal", tono: "warning", testo: "simile" },
  diverso: { icona: "X", tono: "danger", testo: "diverso" },
  assente: { icona: "Minus", tono: "neutral", testo: "non confrontabile" },
};

/** Il confronto di un dato: icona e testo per i lettori di schermo. */
export function EsitoDato({ esito, dato }: { esito: ConfrontoDato; dato: string }) {
  const { icona, tono, testo } = ICONA_CONFRONTO[esito];
  return <StatusBadge tono={tono} icon={icona} etichetta={`${dato} ${testo}`} />;
}

/** Il confronto in breve: i dati che coincidono o no, la combinazione e la distanza. */
export function BadgeConfronto({ confronto }: { confronto: ConfrontoConPuntoVendita }) {
  const dati: Array<[string, ConfrontoDato]> = [
    ["Telefono", confronto.telefono],
    ["Indirizzo", confronto.indirizzo],
    ["Località", confronto.localita],
  ];
  return (
    <span className="flex flex-wrap items-center gap-1">
      {!confronto.stessaCombinazione && <StatusBadge tono="danger" icon="TriangleAlert" etichetta="Altra insegna o area" />}
      {dati.filter(([, esito]) => esito !== "assente").map(([dato, esito]) => (
        <EsitoDato key={dato} dato={dato} esito={esito} />
      ))}
      {confronto.distanzaMetri !== null && <BadgeDistanza metri={confronto.distanzaMetri} />}
    </span>
  );
}

/** La distanza fra la posizione stampata e il PV, colorata con le soglie della verifica. */
export function BadgeDistanza({ metri }: { metri: number }) {
  const tono = metri <= 300 ? "success" : metri <= 2000 ? "warning" : "danger";
  return <StatusBadge tono={tono} icon="Ruler" etichetta={`a ${formattaDistanza(metri)}`} />;
}

/** Da dove viene la posizione della riga e quanto è precisa. */
export function DescrizionePosizione({ posizione }: { posizione: PosizioneRiga | null }) {
  if (!posizione) return <span className="text-xs text-slate-500">Posizione non ancora cercata</span>;
  if (posizione.fonte === "manuale") return <span className="text-xs text-slate-600 dark:text-slate-300">Posizione corretta a mano</span>;
  if (posizione.precisione === "non_trovata") {
    return (
      <span className="text-xs text-slate-500">
        OpenStreetMap non l'ha trovata{posizione.errore ? ` (${posizione.errore})` : ""}
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-600 dark:text-slate-300">
      Posizione da OpenStreetMap: {ETICHETTA_PRECISIONE[posizione.precisione]}
    </span>
  );
}

/**
 * Corregge la posizione della riga incollando le coordinate copiate da Google Maps, come
 * "latitudine, longitudine" o come link che le contiene. Vale al posto di quella di OpenStreetMap.
 */
export function CorreggiPosizione({ chiave }: { chiave: string }) {
  const correggi = useCorreggiPosizioneRiga();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const idCampo = useId();

  if (!aperto) {
    return (
      <Button size="sm" variant="outline-secondary" onClick={() => setAperto(true)}>
        <Lucide icon="Crosshair" aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
        Correggi la posizione
      </Button>
    );
  }

  const salva = () => {
    const coordinate = coordinateDaTesto(testo);
    if (!coordinate) {
      setErrore("Coordinate non riconosciute: incolla \"latitudine, longitudine\" o il link di Google Maps");
      return;
    }
    setErrore(null);
    correggi.mutate({ chiave, ...coordinate }, {
      onSuccess: () => {
        setAperto(false);
        setTesto("");
      },
    });
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={idCampo} className="text-xs text-slate-600 dark:text-slate-300">
        Coordinate o link di Google Maps (tasto destro sul punto, poi clic sulle coordinate per copiarle)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={idCampo}
          type="text"
          value={testo}
          onChange={evento => setTesto(evento.target.value)}
          placeholder="44.4280, 8.7900"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-darkmode-400 dark:bg-darkmode-800"
        />
        <Button size="sm" variant="primary" onClick={salva} disabled={testo.trim() === "" || correggi.isPending} loading={correggi.isPending}>
          Salva la posizione
        </Button>
        <Button size="sm" variant="outline-secondary" onClick={() => setAperto(false)} disabled={correggi.isPending}>
          Annulla
        </Button>
      </div>
      {(errore || correggi.isError) && (
        <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-xs" role="alert">
          {errore ?? ((correggi.error as Error)?.message || "Posizione non salvata")}
        </Alert>
      )}
    </div>
  );
}
