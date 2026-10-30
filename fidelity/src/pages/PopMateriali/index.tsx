import Alert from "@/components/Base/Alert";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchPromozioniPop, useFetchRiepilogoPop } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { parametriMateriali, PROMOZIONI_DEL_PERIODO, testoValidita } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router-dom";
import {
  ETICHETTA_PERIODO,
  isPeriodoMateriali,
  soloKitPubblicati,
  type PeriodoMateriali,
} from "../../../lib/materiali/periodi";
import type { AvvisoNonAvviati, PromoPop, RiepilogoPop } from "../../../lib/materiali/tipi";
import SchedePeriodo from "../shared/SchedePeriodo";
import ElencoPromozioni from "./ElencoPromozioni";
import FileFormato from "./FileFormato";
import TabellaFormati from "./TabellaFormati";

export interface PopMaterialiLoaderData {
  periodo: PeriodoMateriali;
}

/** Tessere dei totali più basse su mobile, dove sono in due colonne. */
const CLASSI_TESSERA = "px-3 py-2 sm:px-4 sm:py-3";

const DESCRIZIONE: Readonly<Record<PeriodoMateriali, string>> = {
  "in-corso":
    "Kit POP delle promozioni in corso, avviati e non ancora avviati, raggruppati per formato: scegli un formato per vederne e scaricarne i file.",
  attivi: "Kit POP pubblicati delle promozioni ancora valide, raggruppati per formato.",
  storico: "Kit POP pubblicati delle promozioni concluse, raggruppati per formato.",
};

const PERIODO_VUOTO: Readonly<Record<PeriodoMateriali, { titolo: string; descrizione: string }>> = {
  "in-corso": {
    titolo: "Nessun kit POP nelle promozioni in corso",
    descrizione:
      "I formati POP compaiono qui quando una promozione in corso crea almeno un kit di tipo POP. Puoi crearli dal dettaglio della promozione.",
  },
  attivi: {
    titolo: "Nessun kit POP pubblicato nelle promozioni valide",
    descrizione: "I formati POP compaiono qui quando una promozione ancora valida ha almeno un kit POP pubblicato.",
  },
  storico: {
    titolo: "Nessun kit POP nelle promozioni concluse",
    descrizione: "I formati POP compaiono qui quando una promozione con kit POP pubblicati viene archiviata.",
  },
};

/** Avvisi dell'elenco e del riepilogo della promo scelta, una volta per promo. */
const avvisiUnici = (...elenchi: Array<AvvisoNonAvviati[] | undefined>): AvvisoNonAvviati[] => {
  const perPromo = new Map<string, AvvisoNonAvviati>();
  for (const avviso of elenchi.flatMap((elenco) => elenco ?? [])) {
    if (!perPromo.has(avviso.promo.id)) perPromo.set(avviso.promo.id, avviso);
  }
  return [...perPromo.values()];
};

function AvvisiNonAvviati({ avvisi }: { avvisi: AvvisoNonAvviati[] }) {
  if (avvisi.length === 0) return null;
  return (
    <Alert variant="soft-warning" icona="TriangleAlert" titolo="Elenco incompleto">
      <ul className="space-y-0.5 text-sm">
        {avvisi.map((avviso) => (
          <li key={avviso.promo.id}>
            I kit POP non ancora avviati di <span className="font-medium">{avviso.promo.nome}</span> non sono
            disponibili: {avviso.motivo}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function ColonnaInCaricamento() {
  return (
    <div aria-busy="true" aria-label="Caricamento della promozione" className="flex flex-col gap-6">
      <Sezione>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, indice) => (
            <Skeleton key={indice} className="h-16 rounded-control" />
          ))}
        </div>
      </Sezione>
      <Sezione>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, indice) => (
            <Skeleton key={indice} className="h-8" />
          ))}
        </div>
      </Sezione>
    </div>
  );
}

function ElencoInCaricamento() {
  return (
    <Sezione as="aside" compatta aria-label="Promozioni" aria-busy="true" className="lg:col-span-4 xl:col-span-3">
      <Skeleton className="h-9 rounded-control" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }, (_, indice) => (
          <Skeleton key={indice} className="h-10 rounded-control" />
        ))}
      </div>
    </Sezione>
  );
}

interface DettaglioPromoProps {
  riepilogo: RiepilogoPop;
  periodo: PeriodoMateriali;
  idFormatoRichiesto: string;
  puoScaricare: boolean;
  puoAprireKit: boolean;
}

/** Colonna principale: la promo scelta, i suoi totali, i formati e i file del formato scelto. */
function DettaglioPromo({ riepilogo, periodo, idFormatoRichiesto, puoScaricare, puoAprireKit }: DettaglioPromoProps) {
  const { promo, totali, formati } = riepilogo;
  // Senza ?formato= si apre il primo formato che ha file: uno di soli kit non avviati non mostrerebbe niente
  const formato =
    formati.find((voce) => voce.id === idFormatoRichiesto) ?? formati.find((voce) => voce.numeroFile > 0) ?? formati[0];
  const validita = testoValidita(promo.validitaDal, promo.validitaAl);
  // In Attivi e Storico i kit sono tutti pubblicati: in revisione e con errori varrebbero sempre 0
  const conLavorazione = !soloKitPubblicati(periodo);
  // Cresce a ogni formato scelto dalla tabella: i suoi file vengono in vista
  const [richiesteInVista, setRichiesteInVista] = useState(0);

  return (
    <>
      <Sezione
        titolo={promo.nome}
        descrizione={`POP · ${ETICHETTA_PERIODO[periodo]}${validita ? ` · validità ${validita}` : ""}`}
      >
        {/* Su mobile tessere basse in due colonne, la prima (i file) su tutta la riga: le tessere
            sono 5 o 3 e così non resta un buco; da lg tutte in una riga */}
        <StatCardGrid className={twMerge("gap-2 sm:gap-3", conLavorazione ? "lg:grid-cols-5" : "lg:grid-cols-3")}>
          <StatCard
            densita="compatta"
            tono="brand"
            etichetta="File POP"
            valore={formatNumero(totali.file)}
            className={twMerge(CLASSI_TESSERA, "col-span-2 lg:col-span-1")}
          />
          <StatCard densita="compatta" tono="neutral" etichetta="Formati" valore={formatNumero(totali.formati)} className={CLASSI_TESSERA} />
          <StatCard densita="compatta" tono="success" etichetta="Pubblicati" valore={formatNumero(totali.pubblicati)} className={CLASSI_TESSERA} />
          {conLavorazione && (
            <>
              <StatCard
                densita="compatta"
                tono="brand"
                etichetta="In revisione"
                valore={formatNumero(totali.inRevisione)}
                className={CLASSI_TESSERA}
              />
              <StatCard
                densita="compatta"
                tono="warning"
                etichetta="Con errori"
                valore={formatNumero(totali.conErrori)}
                evidenzia={totali.conErrori > 0}
                className={CLASSI_TESSERA}
              />
            </>
          )}
        </StatCardGrid>
      </Sezione>

      {formato ? (
        <>
          <TabellaFormati
            promo={promo}
            periodo={periodo}
            formati={formati}
            idFormatoSelezionato={formato.id}
            percorsoFormato={(idFormato) => `?${parametriMateriali({ promo: promo.id, formato: idFormato })}`}
            onSceltaFormato={() => setRichiesteInVista((numero) => numero + 1)}
            puoScaricare={puoScaricare}
            puoAprireKit={puoAprireKit}
          />
          {/* Cambiando promo o formato filtri, pagina e selezione ripartono da zero */}
          <FileFormato
            key={`${promo.id}-${formato.id}`}
            promo={promo}
            periodo={periodo}
            formato={formato}
            puoScaricare={puoScaricare}
            richiesteInVista={richiesteInVista}
          />
        </>
      ) : (
        <Sezione>
          <EmptyState
            compatta
            icon="FolderOpen"
            title="Nessun kit POP per questa promozione"
            description={`La promozione non ha kit POP nel periodo ${ETICHETTA_PERIODO[periodo].toLowerCase()}.`}
          />
        </Sezione>
      )}
    </>
  );
}

/** ?promo= di una promozione che non è fra quelle del periodo: si dice e si propone la prima. */
function PromoNonDisponibile({ periodo, primaPromo }: { periodo: PeriodoMateriali; primaPromo: PromoPop | undefined }) {
  const navigate = useNavigate();
  return (
    <Sezione>
      <EmptyState
        compatta
        icon="SearchX"
        title="Promozione non disponibile"
        description={`La promozione indicata nell'indirizzo non ha kit POP fra quelle del periodo ${ETICHETTA_PERIODO[periodo].toLowerCase()}, oppure non esiste più.`}
        buttonText={primaPromo ? "Apri la prima promozione" : undefined}
        buttonIcon="ArrowRight"
        onButtonClick={() => {
          if (primaPromo) navigate(`?${parametriMateriali({ promo: primaPromo.id })}`, { replace: true });
        }}
      />
    </Sezione>
  );
}

/** Errore con stato HTTP, come lo lancia ServerCall. */
const statoHttp = (errore: unknown): number | undefined => (errore as { httpStatus?: number } | null)?.httpStatus;

function ContenutoPop({ periodo }: { periodo: PeriodoMateriali }) {
  const navigate = useNavigate();
  const puoScaricare = usePermission(PERMISSIONS.FILE.DOWNLOAD);
  const puoAprirePromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
  const [parametri] = useSearchParams();
  const promoRichiesta = parametri.get("promo") ?? "";
  const formatoRichiesto = parametri.get("formato") ?? "";

  const promozioni = useFetchPromozioniPop(periodo);
  const elenco = promozioni.data?.promozioni ?? [];
  // Una promo dell'indirizzo che non è nell'elenco del periodo non si apre
  const promoNonDisponibile =
    Boolean(promoRichiesta) && Boolean(promozioni.data) && !elenco.some((promo) => promo.id === promoRichiesta);
  // Senza ?promo= si apre la prima promozione del periodo
  const idPromo = promoNonDisponibile ? undefined : promoRichiesta || elenco[0]?.id;
  const riepilogo = useFetchRiepilogoPop(idPromo, periodo);

  const etichettaPeriodo = ETICHETTA_PERIODO[periodo];
  const promozioniDelPeriodo = PROMOZIONI_DEL_PERIODO[periodo];
  const avvisi = avvisiUnici(promozioni.data?.avvisi, idPromo ? riepilogo.data?.avvisi : undefined);

  const corpo = (() => {
    if (promozioni.isError) {
      return (
        <PageError
          compatta
          titolo="Promozioni non caricate"
          motivo={promozioni.error?.message || "Il servizio non ha restituito le promozioni con file POP."}
          onRiprova={() => promozioni.refetch()}
        />
      );
    }
    if (promozioni.data && elenco.length === 0) {
      const vuoto = PERIODO_VUOTO[periodo];
      return (
        <>
          <AvvisiNonAvviati avvisi={avvisi} />
          <Sezione>
            <EmptyState
              compatta
              icon="Presentation"
              title={vuoto.titolo}
              description={vuoto.descrizione}
              buttonText={puoAprirePromo ? promozioniDelPeriodo.etichetta : undefined}
              buttonIcon="ArrowRight"
              onButtonClick={() => navigate(promozioniDelPeriodo.percorso)}
            />
          </Sezione>
        </>
      );
    }

    const colonnaPrincipale = (() => {
      // Anche un 404 del riepilogo: la promo è uscita dal periodo dopo che l'elenco è arrivato
      if (promoNonDisponibile || (riepilogo.isError && statoHttp(riepilogo.error) === 404)) {
        return <PromoNonDisponibile periodo={periodo} primaPromo={elenco[0]} />;
      }
      if (riepilogo.isError) {
        return (
          <PageError
            compatta
            titolo="Promozione non caricata"
            motivo={riepilogo.error?.message || "Il servizio non ha restituito i formati POP della promozione."}
            onRiprova={() => riepilogo.refetch()}
          />
        );
      }
      if (!riepilogo.data) return <ColonnaInCaricamento />;
      return (
        <DettaglioPromo
          // Cambiando promo la tabella dei formati riparte chiusa e i file non scorrono in vista
          key={riepilogo.data.promo.id}
          riepilogo={riepilogo.data}
          periodo={periodo}
          idFormatoRichiesto={formatoRichiesto}
          puoScaricare={puoScaricare}
          puoAprireKit={puoAprirePromo}
        />
      );
    })();

    // Due colonne da desktop: le promozioni a sinistra, la promo scelta a destra; su mobile in colonna
    return (
      <>
        <AvvisiNonAvviati avvisi={avvisi} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {promozioni.data ? (
            <ElencoPromozioni
              promozioni={elenco}
              idSelezionata={promoRichiesta || idPromo || ""}
              className="lg:col-span-4 lg:self-start xl:col-span-3"
            />
          ) : (
            <ElencoInCaricamento />
          )}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-8 xl:col-span-9">{colonnaPrincipale}</div>
        </div>
      </>
    );
  })();

  return (
    <Pagina titolo={`POP · ${etichettaPeriodo}`} descrizione={DESCRIZIONE[periodo]}>
      {/* Solo i periodi del POP: i volantini hanno la loro pagina con le loro schede */}
      <SchedePeriodo vista="pop" periodo={periodo} className="self-start" />
      {corpo}
    </Pagina>
  );
}

/** File POP di un periodo (in corso, attivi, storico), per promozione e formato: il periodo arriva dal loader. */
function PopMateriali() {
  const letto = (useLoaderData() as Partial<PopMaterialiLoaderData> | undefined)?.periodo;
  const periodo = isPeriodoMateriali(letto) ? letto : "in-corso";
  // Cambiando periodo la pagina riparte da zero: stesso componente, rotte diverse
  return <ContenutoPop key={periodo} periodo={periodo} />;
}

export default withSessionCheck(PopMateriali);
