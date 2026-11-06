import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { usePromozioniPopConsultazione, useRiepilogoPopConsultazione } from "@/query/consultazione";
import { formatNumero } from "@/utils/format";
import { parametriMateriali, testoValidita } from "@/utils/materiali";
import { useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router-dom";
import {
  ETICHETTA_PERIODO_CONSULTAZIONE,
  isPeriodoConsultazione,
  type PeriodoConsultazione,
} from "../../../lib/consultazione/periodi";
import type { PromoPopConsultazione, RiepilogoPopConsultazione } from "../../../lib/consultazione/tipi";
import ElencoPromozioni from "./ElencoPromozioni";
import FileFormato from "./FileFormato";
import TabellaFormati from "./TabellaFormati";

export interface PopMaterialiLoaderData {
  periodo: PeriodoConsultazione;
}

/** Tessere dei totali più basse su mobile. */
const CLASSI_TESSERA = "px-3 py-2 sm:px-4 sm:py-3";

const DESCRIZIONE: Readonly<Record<PeriodoConsultazione, string>> = {
  attivi:
    "File POP pubblicati delle promozioni ancora valide, raggruppati per formato: scegli un formato per vederne e scaricarne i file.",
  prossimi:
    "File POP già pubblicati delle promozioni non ancora valide, raggruppati per formato: scegli un formato per vederne e scaricarne i file.",
  storico: "File POP pubblicati delle promozioni concluse, raggruppati per formato.",
};

const PERIODO_VUOTO: Readonly<Record<PeriodoConsultazione, { titolo: string; descrizione: string }>> = {
  attivi: {
    titolo: "Nessun file POP pubblicato nelle promozioni valide",
    descrizione: "I formati POP compaiono qui quando una promozione ancora valida ha almeno un kit POP pubblicato.",
  },
  prossimi: {
    titolo: "Nessun file POP pubblicato nelle prossime promozioni",
    descrizione:
      "I formati POP compaiono qui quando una promozione non ancora valida ha almeno un kit POP pubblicato. La lavorazione dei kit non si vede da questa pagina.",
  },
  storico: {
    titolo: "Nessun file POP nelle promozioni concluse",
    descrizione: "I formati POP compaiono qui quando una promozione con kit POP pubblicati viene archiviata.",
  },
};

function ColonnaInCaricamento() {
  return (
    <div aria-busy="true" aria-label="Caricamento della promozione" className="flex flex-col gap-6">
      <Sezione>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }, (_, indice) => (
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
  riepilogo: RiepilogoPopConsultazione;
  periodo: PeriodoConsultazione;
  idFormatoRichiesto: string;
  puoScaricare: boolean;
}

/**
 * Colonna principale: la promo scelta, i suoi totali, i formati e i file del formato scelto. Solo
 * file pubblicati: niente stati, versioni o conteggi della lavorazione.
 */
function DettaglioPromo({ riepilogo, periodo, idFormatoRichiesto, puoScaricare }: DettaglioPromoProps) {
  const { promo, totali, formati } = riepilogo;
  // Senza ?formato= si apre il primo formato che ha file
  const formato =
    formati.find((voce) => voce.id === idFormatoRichiesto) ?? formati.find((voce) => voce.numeroFile > 0) ?? formati[0];
  const validita = testoValidita(promo.validitaDal, promo.validitaAl);
  // Cresce a ogni formato scelto dalla tabella: i suoi file vengono in vista
  const [richiesteInVista, setRichiesteInVista] = useState(0);

  return (
    <>
      <Sezione
        titolo={promo.nome}
        descrizione={`POP · ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo]}${validita ? ` · validità ${validita}` : ""}`}
      >
        <StatCardGrid className="gap-2 sm:gap-3 lg:grid-cols-2">
          <StatCard densita="compatta" tono="brand" etichetta="File POP" valore={formatNumero(totali.file)} className={CLASSI_TESSERA} />
          <StatCard densita="compatta" tono="neutral" etichetta="Formati" valore={formatNumero(totali.formati)} className={CLASSI_TESSERA} />
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
            description={`La promozione non ha kit POP pubblicati nel periodo ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo].toLowerCase()}.`}
          />
        </Sezione>
      )}
    </>
  );
}

/** ?promo= di una promozione che non è fra quelle del periodo: si dice e si propone la prima. */
function PromoNonDisponibile({
  periodo,
  primaPromo,
}: {
  periodo: PeriodoConsultazione;
  primaPromo: PromoPopConsultazione | undefined;
}) {
  const navigate = useNavigate();
  return (
    <Sezione>
      <EmptyState
        compatta
        icon="SearchX"
        title="Promozione non disponibile"
        description={`La promozione indicata nell'indirizzo non ha kit POP pubblicati fra quelle del periodo ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo].toLowerCase()}, oppure non esiste più.`}
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

function ContenutoPop({ periodo }: { periodo: PeriodoConsultazione }) {
  const puoScaricare = usePermission(PERMISSIONS.MATERIALI.SCARICA);
  const [parametri] = useSearchParams();
  const promoRichiesta = parametri.get("promo") ?? "";
  const formatoRichiesto = parametri.get("formato") ?? "";

  const promozioni = usePromozioniPopConsultazione(periodo);
  const elenco = promozioni.data?.promozioni ?? [];
  // Una promo dell'indirizzo che non è nell'elenco del periodo non si apre
  const promoNonDisponibile =
    Boolean(promoRichiesta) && Boolean(promozioni.data) && !elenco.some((promo) => promo.id === promoRichiesta);
  // Senza ?promo= si apre la prima promozione del periodo
  const idPromo = promoNonDisponibile ? undefined : promoRichiesta || elenco[0]?.id;
  const riepilogo = useRiepilogoPopConsultazione(idPromo, periodo);

  const etichettaPeriodo = ETICHETTA_PERIODO_CONSULTAZIONE[periodo];

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
        <Sezione>
          <EmptyState compatta icon="Presentation" title={vuoto.titolo} description={vuoto.descrizione} />
        </Sezione>
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
        />
      );
    })();

    // Due colonne da desktop: le promozioni a sinistra, la promo scelta a destra; su mobile in colonna
    return (
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
    );
  })();

  return (
    <Pagina titolo={`POP ${etichettaPeriodo}`} descrizione={DESCRIZIONE[periodo]}>
      {corpo}
    </Pagina>
  );
}

/**
 * File POP pubblicati di un periodo (attivi, prossimi, storico), per promozione e formato: il
 * periodo arriva dal loader. Solo materiali pubblicati della GDO, dalle API di consultazione.
 */
function PopMateriali() {
  const letto = (useLoaderData() as Partial<PopMaterialiLoaderData> | undefined)?.periodo;
  const periodo = isPeriodoConsultazione(letto) ? letto : "attivi";
  // Cambiando periodo la pagina riparte da zero: stesso componente, rotte diverse
  return <ContenutoPop key={periodo} periodo={periodo} />;
}

export default withSessionCheck(PopMateriali);
