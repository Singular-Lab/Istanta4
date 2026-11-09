import { FormField, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Segmenti, { type OpzioneSegmento } from "@/components/Base/Segmenti";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { VolantinoSfogliabile } from "@/components/FlyerInsights/volantino";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { useDifferenzeVarianti } from "@/query/flyerInsights";
import type { FlyerInsights, FlyerInsightsConfig } from "@/types/flyerInsights";
import { formatNumero } from "@/utils/format";
import { useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PresenzaInVariante, VolantinoDiRiferimento } from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";
import { MostraTutti } from "./MostraTutti";
import {
  etichettaVariante,
  etichetteVarianti,
  filtraDifferenze,
  pagineVariante,
  STATI_DIFFERENZA,
  type FiltroDifferenze,
} from "./supporto";

export interface DifferenzeVariantiProps {
  idKit: string;
  /** Gli insight di questo volantino: pagine, box e PDF del lato sinistro. */
  insights: FlyerInsights;
  /** Le altre varianti area/canale della stessa promo (ConfrontiVolantino.varianti). */
  varianti: VolantinoDiRiferimento[];
  configurazione?: FlyerInsightsConfig;
  /** Le varianti sono ancora in caricamento. */
  caricamento?: boolean;
}

/** Fino a quante varianti la scelta resta a segmenti, sempre visibili; oltre diventa un elenco a discesa. */
const MASSIMO_SEGMENTI = 4;
/** Differenze mostrate prima di "Mostra tutte". */
const PRIME_DIFFERENZE = 25;

/** Dove sta il prodotto in una variante: prezzo, sconto e la pagina, che porta i due visualizzatori lì. */
function Presenza({
  presenza,
  dove,
  onVaiAPagina,
}: {
  presenza: PresenzaInVariante | null;
  dove: string;
  onVaiAPagina: (pagina: number) => void;
}) {
  if (!presenza) return <span className="text-slate-400">Assente</span>;
  const { pagina } = presenza;
  return (
    <div className="tabular-nums">
      <span className="text-slate-800 dark:text-slate-100">{formatEuro(presenza.prezzo)}</span>
      {presenza.sconto !== null && <span className="ml-1.5 text-xs text-slate-500">−{formatPercentuale(presenza.sconto)}</span>}
      {pagina !== null && (
        <button
          type="button"
          onClick={() => onVaiAPagina(pagina)}
          aria-label={`Mostra la pagina ${pagina} ${dove}`}
          className="block text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
        >
          Pagina {formatNumero(pagina)}
        </button>
      )}
    </div>
  );
}

/**
 * Le differenze fra questo volantino e un'altra variante area/canale della stessa promo: le due
 * edizioni affiancate sulla stessa pagina, con i box colorati per stato, e l'elenco dei prodotti
 * che cambiano, filtrabile per tipo di differenza.
 */
export function DifferenzeVarianti({ idKit, insights, varianti, configurazione, caricamento = false }: DifferenzeVariantiProps) {
  const [scelta, setScelta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDifferenze>("tutte");
  const [pagina, setPagina] = useState(1);
  const [tutte, setTutte] = useState(false);
  const idTitolo = useId();
  const idElenco = useId();
  const visualizzatori = useRef<HTMLDivElement>(null);

  // La variante scelta, se c'è ancora fra quelle arrivate; altrimenti la prima
  const idAltra = varianti.some(variante => variante.idKit === scelta) ? scelta : (varianti[0]?.idKit ?? null);
  const differenze = useDifferenzeVarianti(idKit, idAltra);
  const etichette = useMemo(() => etichetteVarianti(varianti), [varianti]);
  const dati = differenze.data;
  const elenco = useMemo(() => (dati ? filtraDifferenze(dati.differenze, filtro) : []), [dati, filtro]);

  const cambiaVariante = (id: string) => {
    setScelta(id);
    setTutte(false);
  };

  const cambiaFiltro = (valore: FiltroDifferenze) => {
    setFiltro(valore);
    setTutte(false);
  };

  // Dall'elenco si torna ai visualizzatori, che si spostano insieme sulla pagina del prodotto
  const vaiAPagina = (numero: number) => {
    setPagina(numero);
    visualizzatori.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const intestazione = (
    <>
      <h3 id={idTitolo} className="title-card mb-1">
        Differenze fra le varianti
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        La stessa promo nelle altre aree e negli altri canali: quali prodotti cambiano, pagina per pagina.
      </p>
    </>
  );

  if (caricamento) {
    return (
      <div role="group" aria-labelledby={idTitolo}>
        {intestazione}
        <div aria-busy="true" className="space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (varianti.length === 0 || !idAltra) {
    return (
      <div role="group" aria-labelledby={idTitolo}>
        {intestazione}
        <EmptyState
          compatta
          icon="Layers"
          title="Questa promo non ha altre varianti area/canale"
          description="Il confronto fra varianti compare quando la stessa promo ha volantini per altre aree o altri canali."
        />
      </div>
    );
  }

  const opzioniFiltro: OpzioneSegmento<FiltroDifferenze>[] = [
    { valore: "tutte", etichetta: "Tutte", conteggio: dati ? filtraDifferenze(dati.differenze, "tutte").length : undefined },
    ...(["solo-qui", "solo-altra", "prezzo-diverso"] as const).map(stato => ({
      valore: stato,
      etichetta: STATI_DIFFERENZA[stato].breve,
      conteggio: dati?.conteggi[stato],
    })),
  ];
  const visibili = tutte ? elenco : elenco.slice(0, PRIME_DIFFERENZE);
  const nomeAltra = etichette.get(idAltra) ?? "altra variante";

  return (
    <div role="group" aria-labelledby={idTitolo}>
      {intestazione}

      <div className="mb-4">
        {varianti.length <= MASSIMO_SEGMENTI ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-slate-500" aria-hidden="true">
              Variante da confrontare
            </span>
            <Segmenti
              etichetta="Variante da confrontare"
              opzioni={varianti.map(variante => ({ valore: variante.idKit, etichetta: etichette.get(variante.idKit) ?? etichettaVariante(variante) }))}
              valore={idAltra}
              onChange={cambiaVariante}
            />
          </div>
        ) : (
          <FormField etichetta="Variante da confrontare" className="max-w-sm">
            <FormSelect value={idAltra} onChange={evento => cambiaVariante(evento.target.value)}>
              {varianti.map(variante => (
                <option key={variante.idKit} value={variante.idKit}>
                  {etichette.get(variante.idKit) ?? etichettaVariante(variante)}
                </option>
              ))}
            </FormSelect>
          </FormField>
        )}
      </div>

      {differenze.isError ? (
        <PageError
          compatta
          titolo="Differenze non caricate"
          motivo={differenze.error?.message || "Non è stato possibile confrontare le due varianti."}
          onRiprova={() => differenze.refetch()}
        />
      ) : !dati ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Una pagina sola per i due lati: sfogliando uno, l'altro lo segue */}
          <div ref={visualizzatori} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <VolantinoSfogliabile
              idKit={idKit}
              pdf={insights.pdf}
              box={insights.box}
              // Le pagine contate come per l'altra variante (PDF o ultimo box), non il totale dei riepiloghi
              totalePagine={insights.sintesi?.pagine ?? insights.totalePagine}
              configurazione={configurazione}
              statoBox={dati.statoBoxQui}
              pagina={pagina}
              onCambiaPagina={setPagina}
              compatto
              titolo={`Questo volantino · ${etichettaVariante(dati.qui)}`}
            />
            <VolantinoSfogliabile
              idKit={dati.altra.idKit}
              pdf={dati.pdfAltra}
              box={dati.boxAltra}
              totalePagine={pagineVariante(dati.pdfAltra, dati.boxAltra)}
              configurazione={configurazione}
              statoBox={dati.statoBoxAltra}
              pagina={pagina}
              onCambiaPagina={setPagina}
              compatto
              titolo={etichettaVariante(dati.altra)}
            />
          </div>

          {/* La legenda dei colori è in ogni visualizzatore, con gli stati dei suoi box (STATI_DIFFERENZA) */}
          <Link
            to={percorsoDettaglioVolantino(dati.altra.idKit)}
            className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
          >
            Apri gli insight di {nomeAltra}
            <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>

          <div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Segmenti etichetta="Tipo di differenza" opzioni={opzioniFiltro} valore={filtro} onChange={cambiaFiltro} />
              <p className="text-sm text-slate-500">
                {dati.conteggi.uguale === 1
                  ? "1 prodotto uguale nelle due varianti"
                  : `${formatNumero(dati.conteggi.uguale)} prodotti uguali nelle due varianti`}
              </p>
            </div>

            {dati.differenze.length === 0 ? (
              <EmptyState
                compatta
                icon="Check"
                title="Nessuna differenza"
                description="Le due varianti hanno gli stessi prodotti agli stessi prezzi."
              />
            ) : elenco.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">Nessuna differenza di questo tipo.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table id={idElenco} sm hover={false}>
                    <caption className="sr-only">Prodotti diversi fra questo volantino e {nomeAltra}</caption>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Prodotto</Table.Th>
                        <Table.Th>Differenza</Table.Th>
                        <Table.Th>Questo volantino</Table.Th>
                        <Table.Th>{nomeAltra}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibili.map(voce => (
                        <Table.Tr key={voce.chiave}>
                          <Table.Td className="min-w-48">
                            <span className="font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{voce.nome}</span>
                            {voce.marca && <span className="block text-xs text-slate-500">{voce.marca}</span>}
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge tono={STATI_DIFFERENZA[voce.stato].tono} etichetta={STATI_DIFFERENZA[voce.stato].etichetta} />
                          </Table.Td>
                          <Table.Td>
                            <Presenza presenza={voce.qui} dove="in questo volantino" onVaiAPagina={vaiAPagina} />
                          </Table.Td>
                          <Table.Td>
                            <Presenza presenza={voce.altra} dove={`in ${nomeAltra}`} onVaiAPagina={vaiAPagina} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
                {elenco.length > PRIME_DIFFERENZE && (
                  <MostraTutti aperto={tutte} totale={elenco.length} onCambia={setTutte} controlla={idElenco} genere="tutte" />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DifferenzeVarianti;
