import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchAnalisiPuntoVendita, useFetchPuntoVenditaConsultazione, useFetchStoriaPuntoVendita } from "@/query/query";
import { twMerge } from "@/utils/twMerge";
import "leaflet/dist/leaflet.css";
import { Children, useMemo, useState, type ReactNode } from "react";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";
import type { CustomError } from "../../../lib/server_call";
import { codiciGdo } from "../../utils/puntoVendita";
import { ImportStoricoVolantini } from "../PuntiVendita/ImportStoricoVolantini";
import { canaliDelleEdizioni, identificativiGdo, infograficheConDati, INFOGRAFICHE_SCHEDA, righeRecapiti, useTinteCanali, type InfograficaScheda } from "./analisi";
import { PuntoInsegna } from "./componenti";
import { ComeSiPromuove, DoveStaNelVolantino, GraficiSenzaDati, MarchePiuPresenti, NumeriScheda, ProdottiCheTornano, ScontoMedio } from "./Infografiche";
import { BoxStoria, EventiStoria, RecapitiStampati, TuttiIVolantini } from "./StoriaPuntoVendita";
import { VolantiniAttivi } from "./VolantiniAttivi";

const INDIETRO = { to: "/punti-vendita", etichetta: "Torna ai punti vendita" };

// Colonne di una fila di riquadri, secondo quanti ce ne sono: chi resta si allarga, senza buchi
const COLONNE_FILA: Readonly<Record<number, string>> = {
  2: "lg:grid-cols-2",
  3: "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]",
};

/** Una fila di riquadri affiancati; senza riquadri non c'è. */
function Fila({ children, className }: { children: ReactNode; className?: string }) {
  const riquadri = Children.toArray(children);
  if (riquadri.length === 0) return null;
  return <div className={twMerge("grid grid-cols-1 gap-6", COLONNE_FILA[riquadri.length], className)}>{riquadri}</div>;
}

/** Una riga dei dati: si mostra solo se c'è un valore, mai un segnaposto. */
function Dato({ icona, etichetta, children }: { icona: string; etichetta: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Lucide icon={icona} aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none stroke-[1.3] text-slate-500" />
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{etichetta}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}

const conCodice = (riferimento: { nome: string; codice: string | null }) =>
  riferimento.codice && riferimento.codice !== riferimento.nome ? `${riferimento.nome} (${riferimento.codice})` : riferimento.nome;

function DatiPuntoVendita({ pv }: { pv: PuntoVenditaConsultazione }) {
  const localita = [pv.cap, pv.citta, pv.provincia && `(${pv.provincia})`].filter(Boolean).join(" ");
  const codici = codiciGdo(pv.meta);

  return (
    <Sezione titolo="Dati">
      <dl className="flex flex-col gap-3.5">
        {pv.ragioneSociale && (
          <Dato icona="Briefcase" etichetta="Ragione sociale">{pv.ragioneSociale}</Dato>
        )}
        {(pv.indirizzo || localita || pv.regione) && (
          <Dato icona="MapPin" etichetta="Indirizzo">
            {pv.indirizzo && <div>{pv.indirizzo}</div>}
            {(localita || pv.regione) && <div>{[localita, pv.regione].filter(Boolean).join(", ")}</div>}
          </Dato>
        )}
        {pv.telefono && (
          <Dato icona="Phone" etichetta="Telefono">
            <a
              href={`tel:${pv.telefono}`}
              className="text-primary underline decoration-primary/30 decoration-dotted underline-offset-2"
            >
              {pv.telefono}
            </a>
          </Dato>
        )}
        {pv.canale && <Dato icona="Store" etichetta="Insegna (canale)">{conCodice(pv.canale)}</Dato>}
        {pv.area && <Dato icona="Globe" etichetta="Area">{conCodice(pv.area)}</Dato>}
        {codici.map(c => (
          <Dato key={c.etichetta} icona="Hash" etichetta={c.etichetta}>{c.valore}</Dato>
        ))}
      </dl>
    </Sezione>
  );
}

function MappaPuntoVendita({ pv }: { pv: PuntoVenditaConsultazione }) {
  const posizione: [number, number] | null = pv.coordinate ? [pv.coordinate.lat, pv.coordinate.lon] : null;

  return (
    <Sezione titolo="Mappa">
      {posizione ? (
        <div className="relative h-64 w-full overflow-hidden rounded-control" data-testid="mappa-punto-vendita">
          <MapContainer center={posizione} zoom={16} preferCanvas scrollWheelZoom={false} className="absolute inset-0">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <CircleMarker center={posizione} radius={8} pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#4E79A7", fillOpacity: 0.9 }} />
          </MapContainer>
        </div>
      ) : (
        <EmptyState
          compatta
          icon="MapPinOff"
          title="Coordinate non disponibili"
          description="L'anagrafica di questo punto vendita non ha latitudine e longitudine."
        />
      )}
    </Sezione>
  );
}

/**
 * Scheda di consultazione del punto vendita (/punti-vendita/:id), con "gdo.visualizza", costruita
 * sulla timeline dei suoi volantini: numeri, storia con il volantino scelto, infografiche
 * (meccaniche, sconto, marche, prodotti, reparti), recapiti stampati ed eventi, volantini attivi,
 * tutti i volantini, dati e mappa. La gestione (dispositivi, contesti display, modifica) resta
 * sotto /gestione-interna e si apre con "Gestisci" a chi ha il permesso.
 */
function SchedaPuntoVendita() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const query = useFetchPuntoVenditaConsultazione(id);
  const analisi = useFetchAnalisiPuntoVendita(id);
  const storia = useFetchStoriaPuntoVendita(id);
  const puoGestire = usePermission(PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA);
  const puoAprirePromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
  const [importAperto, setImportAperto] = useState(false);
  const pv = query.data;
  const timeline = analisi.data?.timeline;
  const canaleAttuale = pv?.canale;
  // Le insegne della pagina: quelle dei volantini e quella di oggi, per i colori
  const canali = useMemo(
    () => [...canaliDelleEdizioni(timeline ?? []), ...(canaleAttuale ? [{ id: canaleAttuale.id, nome: canaleAttuale.nome }] : [])],
    [timeline, canaleAttuale]
  );
  const tinta = useTinteCanali(canali);

  if (query.isLoading) {
    return (
      <Pagina titolo="Punto vendita" indietro={INDIETRO}>
        <Sezione>
          <div role="status" aria-label="Caricamento del punto vendita" className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton />
            <Skeleton />
          </div>
        </Sezione>
      </Pagina>
    );
  }

  if (query.isError || !pv) {
    const nonTrovato = (query.error as CustomError | null)?.httpStatus === 404;
    return (
      <Pagina titolo="Punto vendita" indietro={INDIETRO}>
        <Sezione>
          {nonTrovato ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Punto vendita non trovato"
              description="Il punto vendita non esiste o non è della tua GDO."
              buttonText="Torna ai punti vendita"
              buttonIcon="ArrowLeft"
              onButtonClick={() => navigate("/punti-vendita")}
            />
          ) : (
            <PageError
              compatta
              titolo="Punto vendita non caricato"
              motivo={(query.error as Error | null)?.message || "Errore durante il recupero del punto vendita"}
              onRiprova={() => query.refetch()}
            />
          )}
        </Sezione>
      </Pagina>
    );
  }

  const insegnaArea = [pv.canale?.nome, pv.area?.nome].filter(Boolean).join(" · ");
  const localita = [pv.cap, pv.citta, pv.provincia && `(${pv.provincia})`].filter(Boolean).join(" ");
  // Nella testata solo gli identificativi: l'insegna è già nel badge, gli altri meta stanno nei dati
  const testata = [
    [pv.indirizzo, localita].filter(Boolean).join(" · "),
    ...identificativiGdo(codiciGdo(pv.meta)).map(c => `${c.etichetta} ${c.valore}`),
  ].filter(Boolean);

  // Analisi arrivata e nessun volantino: la storia lo spiega una volta sola, i riquadri che ne
  // dipendono (numeri, grafici, recapiti, eventi) non si disegnano
  const senzaStoria = analisi.data !== undefined && analisi.data.timeline.length === 0;
  // In caricamento o in errore ogni grafico mostra il suo stato; arrivati i dati, solo quelli che ne hanno
  const conDati = analisi.data ? infograficheConDati(analisi.data) : null;
  const mostra = (infografica: InfograficaScheda) => !senzaStoria && (conDati === null || conDati[infografica]);
  const senzaGrafico = conDati && !senzaStoria ? INFOGRAFICHE_SCHEDA.filter(voce => !conDati[voce.id]).map(voce => voce.id) : [];
  const conRecapiti = !senzaStoria && (!storia.data || righeRecapiti(storia.data.recapiti).length > 0);
  const conEventi = !senzaStoria && (!storia.data || storia.data.eventi.length > 0 || Boolean(timeline?.[0]));

  return (
    <Pagina
      titolo={pv.nome}
      indietro={INDIETRO}
      descrizione={
        testata.length > 0 ? (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
            {testata.map(voce => (
              <span key={voce}>{voce}</span>
            ))}
          </span>
        ) : undefined
      }
      badges={
        <>
          {pv.canale && (
            <Badge variant="secondary" size="sm">
              <PuntoInsegna tinta={tinta(pv.canale.id)} />
              {pv.canale.nome}
            </Badge>
          )}
          {pv.area && (
            <Badge variant="secondary" size="sm">
              <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3" />
              {pv.area.nome}
            </Badge>
          )}
        </>
      }
      azioni={
        <>
          <Button as="a" href="#dati-e-mappa" variant="outline-secondary">
            <Lucide icon="MapPin" aria-hidden="true" className="mr-2 h-4 w-4" />
            Dati e mappa
          </Button>
          {puoGestire && (
            <Button as={Link} to={`/gestione-interna/punti-vendita/${pv.id}`} variant="outline-secondary">
              <Lucide icon="Settings" aria-hidden="true" className="mr-2 h-4 w-4" />
              Gestisci
            </Button>
          )}
        </>
      }
    >
      <NumeriScheda analisi={analisi} />
      <BoxStoria
        idPv={pv.id}
        analisi={analisi}
        storia={storia.data}
        tinta={tinta}
        onImporta={puoGestire ? () => setImportAperto(true) : undefined}
      />
      <Fila>
        {mostra("meccaniche") && <ComeSiPromuove analisi={analisi} />}
        {mostra("sconto") && <ScontoMedio analisi={analisi} />}
        {mostra("marche") && <MarchePiuPresenti analisi={analisi} />}
      </Fila>
      {/* La tabella dei prodotti è alta: il riquadro dei reparti accanto resta della sua altezza */}
      <Fila className="items-start">
        {mostra("prodotti") && <ProdottiCheTornano idPv={pv.id} analisi={analisi} />}
        {mostra("reparti") && <DoveStaNelVolantino analisi={analisi} />}
      </Fila>
      <GraficiSenzaDati assenti={senzaGrafico} />
      <Fila>
        {conRecapiti && <RecapitiStampati storia={storia} />}
        {conEventi && <EventiStoria storia={storia} primo={timeline?.[0] ?? null} />}
      </Fila>
      <VolantiniAttivi idPv={pv.id} canaleArea={insegnaArea} />
      {storia.data?.sintesi && <TuttiIVolantini idPv={pv.id} puoAprirePromo={puoAprirePromo} />}
      <div id="dati-e-mappa" className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-2">
        <DatiPuntoVendita pv={pv} />
        <MappaPuntoVendita pv={pv} />
      </div>
      {/* Il dialogo si monta solo aperto: l'import resta della gestione, qui si apre dalla storia vuota */}
      {importAperto && <ImportStoricoVolantini open onClose={() => setImportAperto(false)} />}
    </Pagina>
  );
}

export default withSessionCheck(SchedaPuntoVendita);
