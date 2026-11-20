import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import {
  assenzeNellElenco,
  contaAssenze,
  daConsultazione,
  passaFiltroAssenze,
  storiaNellElenco,
  useElencoPuntiVendita,
  type FiltroAssenze,
} from "@/components/PuntiVendita/elenco";
import { FiltriPuntiVendita, FiltroChip } from "@/components/PuntiVendita/FiltriPuntiVendita";
import { MappaPuntiVendita } from "@/components/PuntiVendita/MappaPuntiVendita";
import { RighePuntiVendita } from "@/components/PuntiVendita/RighePuntiVendita";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchPuntiVenditaConsultazione } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MESI_ASSENZE_IN_ELENCO } from "../../../lib/puntiVendita/analisi";
import { contaPer, filtraPuntiVendita } from "../../utils/puntoVendita";

const percorsoScheda = (pv: { id: string }) => `/punti-vendita/${pv.id}`;

/** Le scelte del filtro Assenze dopo "Tutti", nell'ordine in cui compaiono. */
const SCELTE_ASSENZE: Array<{ id: Exclude<FiltroAssenze, "">; nome: string }> = [
  { id: "conAssenze", nome: `Negli ultimi ${MESI_ASSENZE_IN_ELENCO} mesi` },
  { id: "nonNellUltimo", nome: "Non nell'ultimo volantino" },
];

const testoNonMostrati = (numero: number) =>
  numero === 1
    ? "1 punto vendita non è mostrato perché la sua insegna e la sua area non hanno volantini."
    : `${formatNumero(numero)} punti vendita non sono mostrati perché la loro insegna e la loro area non hanno volantini.`;

/**
 * Consultazione dei punti vendita della GDO (/punti-vendita, "gdo.visualizza"): l'elenco a sinistra
 * e la mappa a destra, con ricerca, area e insegna sopra entrambi; su schermo stretto la mappa sta
 * sopra l'elenco. Solo i punti vendita la cui combinazione canale/area ha volantini, nello storico
 * o in produzione, così insegne e aree dei filtri sono quelle dei volantini (spec
 * anagrafica-punti-vendita, "Elenco e mappa della consultazione secondo i volantini"). Il filtro
 * Assenze mostra, nell'elenco e sulla mappa, chi manca dai volantini della sua insegna e area
 * degli ultimi 12 mesi o dall'ultimo ("Assenze dei punti vendita nell'elenco"). Niente infografiche della rete. In sola lettura:
 * creazione, modifica e import stanno nella gestione, che mostra tutti i punti vendita.
 */
function PuntiVenditaConsultazione() {
  const navigate = useNavigate();
  const query = useFetchPuntiVenditaConsultazione();
  const puoGestire = usePermission(PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA);
  // Senza l'indicazione (combinazioni dei volantini non lette dal server) li mostra tutti
  const { tutti, nonMostrati } = useMemo(() => {
    const dati = query.data ?? [];
    const mostrati = dati.filter(pv => pv.combinazioneConVolantini !== false);
    return { tutti: mostrati.map(daConsultazione), nonMostrati: dati.length - mostrati.length };
  }, [query.data]);
  // Il filtro Assenze vale prima degli altri, per l'elenco e per la mappa
  const [filtroAssenze, setFiltroAssenze] = useState<FiltroAssenze>("");
  const filtro = useMemo(
    () =>
      filtroAssenze
        ? { chiave: filtroAssenze, test: (pv: (typeof tutti)[number]) => passaFiltroAssenze(pv, filtroAssenze), azzera: () => setFiltroAssenze("") }
        : null,
    [filtroAssenze]
  );
  // I colori delle insegne sono quelli di tutte le pagine dei punti vendita (tinteCanali sulla rete)
  const elenco = useElencoPuntiVendita(tutti, { filtro });
  const conStoria = useMemo(() => storiaNellElenco(tutti), [tutti]);
  const conAssenze = useMemo(() => assenzeNellElenco(tutti), [tutti]);
  // Ogni scelta conta i punti vendita che passano ricerca, insegna e area, come i chip delle insegne
  const perAssenze = useMemo(
    () =>
      contaAssenze(
        filtraPuntiVendita(tutti, {
          testo: elenco.ricercaApplicata,
          campo: elenco.campoRicerca || undefined,
          idCanale: elenco.filtroCanale,
          idArea: elenco.filtroArea,
        })
      ),
    [tutti, elenco.ricercaApplicata, elenco.campoRicerca, elenco.filtroCanale, elenco.filtroArea]
  );
  const errore = query.isError ? (query.error as Error)?.message || "Errore durante il recupero dei punti vendita" : null;

  const riepilogo = useMemo(() => {
    if (!query.data) return undefined;
    const insegne = contaPer(tutti, "canale").length;
    const aree = contaPer(tutti, "area").length;
    return [
      tutti.length === 1 ? "1 punto vendita" : `${formatNumero(tutti.length)} punti vendita`,
      insegne === 1 ? "1 insegna" : `${formatNumero(insegne)} insegne`,
      aree === 1 ? "1 area" : `${formatNumero(aree)} aree`,
    ].join(" · ");
  }, [query.data, tutti]);

  // Tutti nascosti: la GDO ha punti vendita, ma nessuna delle loro combinazioni ha volantini
  const vuoto =
    nonMostrati > 0
      ? {
          titolo: "Nessun punto vendita nei volantini",
          descrizione: "Le insegne e le aree dei punti vendita della GDO non hanno ancora volantini, né nello storico né in produzione.",
        }
      : { titolo: "Nessun punto vendita", descrizione: "La GDO non ha ancora punti vendita in anagrafica." };

  return (
    <Pagina
      titolo="Punti vendita"
      descrizione={riepilogo}
      azioni={
        puoGestire ? (
          <Button as={Link} to="/gestione-interna/punti-vendita" variant="outline-secondary">
            <Lucide icon="Settings" aria-hidden="true" className="mr-2 h-4 w-4" />
            Gestisci punti vendita
          </Button>
        ) : undefined
      }
    >
      <Sezione
        senzaPadding
        titolo="Elenco e mappa"
        descrizione={[
          "I punti vendita delle insegne e delle aree che hanno volantini, nello storico o in produzione. Ognuno apre la sua scheda.",
          nonMostrati > 0 ? testoNonMostrati(nonMostrati) : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <FiltriPuntiVendita
          elenco={elenco}
          aggiornamento={query.isFetching && !query.isLoading}
          placeholder="Nome, città, indirizzo, CAP o codice"
          sotto={
            conAssenze ? (
              // Il nome visibile: "Tutti" accanto alle insegne non direbbe di che cosa
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span aria-hidden="true" className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Lucide icon="CalendarX" className="h-3.5 w-3.5" />
                  Assenze dai volantini
                </span>
                <FiltroChip
                  etichetta="Assenze"
                  tutti="Tutti"
                  totaleTutti={perAssenze[""]}
                  voci={SCELTE_ASSENZE.map(scelta => ({ ...scelta, totale: perAssenze[scelta.id] }))}
                  attivo={filtroAssenze}
                  onScegli={id => setFiltroAssenze(id as FiltroAssenze)}
                  tono="assenza"
                />
              </div>
            ) : undefined
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="min-w-0 lg:border-r lg:border-dashed lg:border-slate-200 dark:lg:border-darkmode-400">
            <RighePuntiVendita
              elenco={elenco}
              caricamento={query.isLoading}
              errore={errore}
              onRiprova={() => query.refetch()}
              percorsoScheda={percorsoScheda}
              conStoria={conStoria}
              vuoto={vuoto}
            />
          </div>
          {/* Su schermo stretto sopra l'elenco; accanto, ferma mentre l'elenco scorre */}
          <div className="order-first border-b border-dashed border-slate-200 p-5 lg:order-none lg:border-b-0 dark:border-darkmode-400">
            <MappaPuntiVendita
              tutti={tutti}
              elenco={elenco}
              caricamento={query.isLoading}
              errore={errore}
              onRiprova={() => query.refetch()}
              onDettagli={pv => navigate(percorsoScheda(pv))}
              etichettaDettagli="Apri scheda"
              descrizioneSenzaPosizione="Nessuno dei punti vendita mostrati ha le coordinate in anagrafica."
              className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:max-h-[720px] lg:min-h-[420px]"
            />
          </div>
        </div>
      </Sezione>
    </Pagina>
  );
}

export default withSessionCheck(PuntiVenditaConsultazione);
