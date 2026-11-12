import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import type { Indietro } from "@/components/Base/PageHeader";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import { FlyerInsights as FlyerInsightsComponent } from "@/components/FlyerInsights";
import { DistribuzionePagine, MarchiDistributore, SintesiInsight } from "@/components/FlyerInsights/analisi";
import { sezioneAttiva } from "@/components/FlyerInsights/configurazione";
import { ScaricaReportPdf } from "@/components/FlyerInsights/report";
import { ReferenzeVolantino } from "@/components/FlyerInsights/referenze";
import { VolantinoSfogliabile } from "@/components/FlyerInsights/volantino";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { periodoValidita } from "@/pages/PuntiVenditaConsultazione/analisi";
import { useFetchFlyerInsights, useFetchFlyerInsightsConfig } from "@/query/query";
import { useVolantinoConsultazione } from "@/query/consultazione";
import { useScaricaFileConsultazione } from "@/utils/scaricaFileConsultazione";
import { useCallback, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { percorsoPromozioneVolantini, percorsoVolantini } from "../../../lib/consultazione/periodi";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";
import type { BoxInsight } from "../../../lib/insightVolantino/tipi";
import { ScaricaVolantino } from "./ScaricaVolantino";
import { statoValidita } from "./validita";

const VOLANTINI_ATTIVI: Indietro = { to: percorsoVolantini("attivi"), etichetta: "Torna ai volantini attivi" };

/**
 * Il ritorno dal volantino (spec insight-volantino, "Ritorno dagli insight del volantino"): alla pagina
 * da cui è stato aperto (Volantini, dettaglio della promo, Storico volantini, punto vendita, dashboard),
 * con la sua query, qualunque sia il periodo della promo. Senza una pagina di Fidelity prima (segnalibro,
 * nuova scheda: la prima voce del router ha la chiave "default") porta al dettaglio della promozione del
 * volantino; se la promozione non si sa ancora, ai volantini attivi.
 */
function useIndietro(idPromo: string | undefined): Indietro {
  const navigate = useNavigate();
  const { key } = useLocation();
  if (key !== "default") return { onClick: () => navigate(-1), etichetta: "Torna indietro" };
  if (idPromo) return { to: percorsoPromozioneVolantini(idPromo), etichetta: "Torna alla promozione" };
  return VOLANTINI_ATTIVI;
}

/** Il report PDF del volantino è disattivato per tutti: il pulsante resta, disattivato, con questo motivo. */
export const REPORT_DISATTIVATO = "Il report PDF è disattivato";

const numeroPagina = (valore: string | null): number | undefined => {
  const numero = Number(valore);
  return Number.isInteger(numero) && numero > 0 ? numero : undefined;
};

const normalizza = (testo: string): string => testo.trim().replace(/\s+/g, " ").toLocaleLowerCase("it");

/**
 * Il box da aprire all'avvio per il parametro ?referenza: è l'id di una referenza, oppure, dai
 * collegamenti della scheda del punto vendita, il nome stampato del prodotto (che vale per il pilota del box).
 */
const boxDellaReferenza = (box: readonly BoxInsight[], referenza: string): BoxInsight | null => {
  const cercata = referenza.trim();
  if (!cercata) return null;
  const perId = box.find(voce => voce.idReferenze.includes(cercata));
  if (perId) return perId;
  const nome = normalizza(cercata);
  return box.find(voce => normalizza(voce.nome) === nome) ?? null;
};

/** Porta in vista il volantino sfogliabile, dopo che la distribuzione o la tabella l'hanno mosso. */
const mostraVolantino = (id: string) => {
  const elemento = document.getElementById(id);
  // jsdom e i browser vecchi non hanno scrollIntoView con le opzioni
  if (elemento && typeof elemento.scrollIntoView === "function") elemento.scrollIntoView({ behavior: "smooth", block: "start" });
};

/**
 * Dettaglio di sola consultazione del volantino, dall'alto: intestazione compatta (canale, area,
 * periodo, stato e "Scarica il volantino"), i numeri chiave, il volantino sfogliabile in grande, la
 * distribuzione nelle pagine, i marchi del distributore, le analisi per reparto, meccanica e marca e
 * la tabella delle referenze. Il report PDF resta visibile ma disattivato per tutti; niente confronti con altre edizioni o
 * varianti. Il kit è nella chiave: aprendo un altro volantino pagina, scelte e filtri ripartono da capo.
 */
const TuttiIVolantini: React.FC = () => {
  const [parametri] = useSearchParams();
  const idKit = parametri.get("kit") ?? "";
  return <DettaglioVolantino key={idKit} idKit={idKit} />;
};

function DettaglioVolantino({ idKit }: { idKit: string }) {
  const [parametri] = useSearchParams();
  const pagina = numeroPagina(parametri.get("pagina"));
  const referenza = parametri.get("referenza") ?? "";
  const puoScaricare = usePermission(PERMISSIONS.MATERIALI.SCARICA);
  const insights = useFetchFlyerInsights(idKit);
  const configurazione = useFetchFlyerInsightsConfig();
  // File pubblicati del kit dalla consultazione: solo se è pubblicato e della GDO dell'utente
  const file = useVolantinoConsultazione(idKit, puoScaricare);
  const { inCorso, scarica } = useScaricaFileConsultazione();
  // Pagina del visualizzatore: finché l'utente non sfoglia vale quella dell'indirizzo, o quella del box cercato
  const [paginaSfogliata, setPaginaSfogliata] = useState<number | null>(null);
  // Il box chiesto dalla tabella delle referenze: `volta` cresce a ogni richiesta, anche dello stesso box
  const [boxDaAprire, setBoxDaAprire] = useState<{ id: string; volta: number } | null>(null);
  const idVolantino = useId();

  const dati = insights.data;
  const indietro = useIndietro(dati?.contesto?.idPromo);
  const boxVolantino = dati?.box;

  const boxIniziale = useMemo(() => (boxVolantino ? boxDellaReferenza(boxVolantino, referenza) : null), [boxVolantino, referenza]);
  const paginaVolantino = paginaSfogliata ?? pagina ?? boxIniziale?.pagina ?? 1;

  const vaiAllaPagina = useCallback(
    (numero: number) => {
      setPaginaSfogliata(numero);
      mostraVolantino(idVolantino);
    },
    [idVolantino]
  );
  const apriBox = useCallback(
    (voce: BoxInsight) => {
      setBoxDaAprire(attuale => ({ id: voce.id, volta: (attuale?.volta ?? 0) + 1 }));
      mostraVolantino(idVolantino);
    },
    [idVolantino]
  );

  if (!idKit) {
    return (
      <Pagina compatta titolo="Dettaglio volantino" indietro={indietro}>
        <PageError compatta titolo="Volantino non indicato" motivo="L'indirizzo non contiene il volantino da consultare." />
      </Pagina>
    );
  }

  if (insights.isError) {
    return (
      <Pagina compatta titolo="Dettaglio volantino" indietro={indietro}>
        <PageError
          compatta
          titolo="Insight non caricati"
          motivo={insights.error?.message || "Non è stato possibile caricare il volantino."}
          onRiprova={() => insights.refetch()}
        />
      </Pagina>
    );
  }

  const contesto = dati?.contesto;
  const titolo = contesto?.titolo || "Dettaglio volantino";
  // Le date della promo arrivano con gli insight; senza (server non aggiornato o promo senza date) niente periodo né stato
  const periodo = contesto?.validitaDal || contesto?.validitaAl ? periodoValidita(contesto.validitaDal, contesto.validitaAl) : null;
  const stato = contesto ? statoValidita(contesto.validitaDal, contesto.validitaAl) : null;
  const box = dati?.box ?? [];
  const conPagine = Boolean(dati && (dati.pdf || box.length > 0));
  // Le pagine della sintesi (PDF in Olimpo, o fino all'ultimo box): le stesse del volantino e della distribuzione
  const totalePagine = dati?.sintesi?.pagine ?? dati?.totalePagine ?? 0;
  const conDistribuzione = box.length > 0 && sezioneAttiva(configurazione.data, "pagine");

  const meta =
    contesto?.nomeCanale || contesto?.nomeArea || periodo || stato ? (
      <>
        {contesto?.nomeCanale && <StatusBadge tono="neutral" icon="Store" etichetta={contesto.nomeCanale} />}
        {contesto?.nomeArea && <StatusBadge tono="neutral" icon="MapPin" etichetta={contesto.nomeArea} />}
        {periodo && <StatusBadge tono="neutral" icon="CalendarDays" etichetta={periodo} />}
        {stato && <StatusBadge tono={stato.tono} icon={stato.icona} etichetta={stato.testo} />}
      </>
    ) : undefined;

  return (
    <Pagina
      compatta
      titolo={titolo}
      meta={meta}
      indietro={indietro}
      azioni={
        // Il report PDF è disattivato per tutti ma resta visibile; accanto si scarica il PDF del volantino
        <div className="flex flex-wrap items-start justify-end gap-2">
          <ScaricaReportPdf idKit={idKit} titolo={titolo} motivoDisattivato={REPORT_DISATTIVATO} />
          <ScaricaVolantino
            puoScaricare={puoScaricare}
            file={file.data?.file}
            caricamento={puoScaricare && file.isLoading}
            errore={file.isError ? file.error?.message || "I file del volantino non sono stati caricati." : null}
            inCorso={inCorso}
            onScarica={(idFile, nome) => void scarica(idFile, nome)}
          />
        </div>
      }
    >
      {insights.isLoading ? (
        <div aria-busy="true" className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        dati && (
          <>
            {dati.sintesi && (
              <section aria-label="Numeri del volantino">
                <SintesiInsight sintesi={dati.sintesi} box={dati.box} lineeDistributore={dati.lineeDistributore} />
              </section>
            )}

            {conPagine && (
              <Sezione
                id={idVolantino}
                className="scroll-mt-4"
                titolo="Il volantino"
                descrizione="Sfoglia il volantino come quello stampato, con i box nelle posizioni reali: seleziona un box per la sua scheda e il viaggio del prodotto, oppure interroga i box per EAN, reparto, meccanica, prezzo e altri dati."
              >
                <VolantinoSfogliabile
                  idKit={idKit}
                  pdf={dati.pdf ?? null}
                  box={box}
                  totalePagine={totalePagine}
                  configurazione={configurazione.data}
                  pagina={paginaVolantino}
                  onCambiaPagina={setPaginaSfogliata}
                  idBoxIniziale={boxIniziale?.id ?? null}
                  apriBox={boxDaAprire}
                />
              </Sezione>
            )}

            {conDistribuzione && (
              <Sezione
                titolo="Distribuzione nelle pagine"
                descrizione="Le referenze di ogni pagina per reparto e quanto della pagina coprono i box: scegli una pagina per aprirla nel volantino."
              >
                <DistribuzionePagine
                  box={box}
                  totalePagine={totalePagine}
                  configurazione={configurazione.data}
                  paginaCorrente={paginaVolantino}
                  onVaiAllaPagina={vaiAllaPagina}
                />
              </Sezione>
            )}

            {dati.lineeDistributore && (
              <Sezione titolo="Marchi del distributore" descrizione="Lo spazio delle linee di marca del distributore, linea per linea, e i bolli stampati sui box.">
                <MarchiDistributore linee={dati.lineeDistributore} />
              </Sezione>
            )}
          </>
        )
      )}

      <FlyerInsightsComponent insights={dati ?? null} isLoading={insights.isLoading} exportCodes={[EXPORT_DI_SISTEMA.VOL]} />

      {dati && box.length > 0 && (
        <ReferenzeVolantino
          box={box}
          referenze={dati.referenze}
          lineeDistributore={dati.lineeDistributore}
          totaleReferenze={dati.sintesi?.referenze ?? dati.totaleReferenze}
          ricercaIniziale={referenza}
          onApriBox={apriBox}
        />
      )}
    </Pagina>
  );
}

export default withSessionCheck(TuttiIVolantini);
