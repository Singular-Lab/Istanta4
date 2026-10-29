import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
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
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router-dom";
import {
  ETICHETTA_PERIODO,
  isPeriodoMateriali,
  percorsoVolantini,
  type PeriodoMateriali,
} from "../../../lib/materiali/periodi";
import type { AvvisoNonAvviati, RiepilogoPop } from "../../../lib/materiali/tipi";
import ElencoPromozioni from "./ElencoPromozioni";
import FileFormato from "./FileFormato";
import TabellaFormati from "./TabellaFormati";

export interface PopMaterialiLoaderData {
  periodo: PeriodoMateriali;
}

const DESCRIZIONE: Readonly<Record<PeriodoMateriali, string>> = {
  "in-corso":
    "Kit POP delle promozioni in corso, raggruppati per formato. Ogni formato si apre nel dettaglio kit, dove la lavorazione è la stessa dei volantini.",
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

function AvvisiNonAvviati({ avvisi }: { avvisi: AvvisoNonAvviati[] }) {
  if (avvisi.length === 0) return null;
  return (
    <Alert variant="soft-warning" icona="TriangleAlert" titolo="Riepilogo incompleto">
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
  const { promo, totali, formati, avvisi } = riepilogo;
  const formato = formati.find((voce) => voce.id === idFormatoRichiesto) ?? formati[0];
  const validita = testoValidita(promo.validitaDal, promo.validitaAl);

  return (
    <>
      <Sezione
        titolo={promo.nome}
        descrizione={`POP · ${ETICHETTA_PERIODO[periodo]}${validita ? ` · validità ${validita}` : ""}`}
        azioni={
          <Button as={Link} to={percorsoVolantini(periodo, promo.id)} variant="outline-secondary" size="sm">
            Vai ai volantini
            <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        }
      >
        <StatCardGrid className="lg:grid-cols-5">
          <StatCard densita="compatta" tono="brand" etichetta="File POP" valore={formatNumero(totali.file)} />
          <StatCard densita="compatta" tono="neutral" etichetta="Formati" valore={formatNumero(totali.formati)} />
          <StatCard densita="compatta" tono="success" etichetta="Pubblicati" valore={formatNumero(totali.pubblicati)} />
          <StatCard densita="compatta" tono="brand" etichetta="In revisione" valore={formatNumero(totali.inRevisione)} />
          <StatCard
            densita="compatta"
            tono="warning"
            etichetta="Con errori"
            valore={formatNumero(totali.conErrori)}
            evidenzia={totali.conErrori > 0}
          />
        </StatCardGrid>
      </Sezione>

      <AvvisiNonAvviati avvisi={avvisi} />

      {formato ? (
        <>
          <TabellaFormati
            promo={promo}
            periodo={periodo}
            formati={formati}
            idFormatoSelezionato={formato.id}
            percorsoFormato={(idFormato) => `?${parametriMateriali({ promo: promo.id, formato: idFormato })}`}
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
          />
        </>
      ) : (
        <Sezione>
          <EmptyState
            compatta
            icon="FolderOpen"
            title="Nessun file POP per questa promozione"
            description={`La promozione non ha kit POP con file nel periodo ${ETICHETTA_PERIODO[periodo].toLowerCase()}.`}
          />
        </Sezione>
      )}
    </>
  );
}

function ContenutoPop({ periodo }: { periodo: PeriodoMateriali }) {
  const navigate = useNavigate();
  const puoScaricare = usePermission(PERMISSIONS.FILE.DOWNLOAD);
  const puoAprirePromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
  const [parametri] = useSearchParams();
  const promoRichiesta = parametri.get("promo") ?? "";
  const formatoRichiesto = parametri.get("formato") ?? "";

  const promozioni = useFetchPromozioniPop(periodo);
  const elenco = promozioni.data?.promozioni ?? [];
  // Senza ?promo= si apre la prima promozione del periodo
  const idPromo = promoRichiesta || elenco[0]?.id;
  const riepilogo = useFetchRiepilogoPop(idPromo, periodo);

  const etichettaPeriodo = ETICHETTA_PERIODO[periodo];
  const promozioniDelPeriodo = PROMOZIONI_DEL_PERIODO[periodo];

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
      );
    }

    const colonnaPrincipale = (() => {
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {promozioni.data ? (
          <ElencoPromozioni
            promozioni={elenco}
            idSelezionata={idPromo ?? ""}
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
    <Pagina titolo={`POP · ${etichettaPeriodo}`} descrizione={DESCRIZIONE[periodo]}>
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
