import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchVolantiniRigaNonAbbinata } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import { Link } from "react-router-dom";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import type { RigaNonAbbinata } from "../../../lib/puntiVendita/analisi";

/**
 * In quali volantini compare una riga non abbinata (contratto in lib/puntiVendita/analisi.ts), dal
 * più recente: kit e promo, data, insegna e area, la riga com'era stampata in quel volantino, e il
 * volantino da aprire nella pagina degli insight del kit. Si chiede al server solo quando si mostra.
 */
export function VolantiniRiga({ chiave }: { chiave: string }) {
  const query = useFetchVolantiniRigaNonAbbinata(chiave);
  // Come nella Storia: il volantino si apre solo con il permesso di consultare i materiali
  const puoConsultareVolantini = usePermission(PERMISSIONS.MATERIALI.VISUALIZZA);

  if (query.isLoading) {
    return (
      <div aria-busy="true" aria-label="Caricamento dei volantini della riga" className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, indice) => (
          <Skeleton key={indice} className="h-4" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <PageError
        compatta
        titolo="Volantini non caricati"
        motivo={(query.error as Error | null)?.message || "Errore durante il recupero dei volantini"}
        onRiprova={() => query.refetch()}
      />
    );
  }
  const volantini = query.data?.volantini ?? [];
  if (volantini.length === 0) return <p className="text-xs text-slate-500">Nessun volantino.</p>;

  return (
    <ul aria-label="Volantini della riga" className="max-h-80 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
      {volantini.map(volantino => (
        <li key={volantino.idKit} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-800 dark:text-slate-100">{volantino.titoloKit || volantino.promo?.nome || "Volantino"}</div>
            <div className="text-xs text-slate-500">
              {[formatData(volantino.data), volantino.promo?.nome, [volantino.canale?.nome, volantino.area?.nome].filter(Boolean).join(" · ")]
                .filter(Boolean)
                .join(" — ")}
            </div>
            <div className="mt-1 break-words font-mono text-xs text-slate-600 dark:text-slate-400">
              <span className="sr-only">Riga stampata: </span>«{volantino.rigaStampata}»
            </div>
          </div>
          {puoConsultareVolantini && (
            <Button as={Link} to={percorsoDettaglioVolantino(volantino.idKit)} size="sm" variant="outline-secondary">
              <Lucide icon="BookOpen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Apri volantino
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Il dialogo con i volantini di una riga, aperto dal numero di volantini nell'elenco. */
export function VolantiniRigaDialog({ riga, onClose }: { riga: RigaNonAbbinata | null; onClose: () => void }) {
  return (
    <Dialog size="lg" open={riga !== null} onClose={onClose}>
      <Dialog.Panel>
        <Dialog.Title>Volantini con questa riga</Dialog.Title>
        {riga && (
          <Dialog.Description>
            <div className="flex flex-col gap-3">
              <div>
                <div className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{riga.riga}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {riga.volantini === 1 ? "1 volantino" : `${formatNumero(riga.volantini)} volantini`}, dal {formatData(riga.primoVolantino)} al{" "}
                  {formatData(riga.ultimoVolantino)}
                </div>
              </div>
              <VolantiniRiga chiave={riga.chiave} />
            </div>
          </Dialog.Description>
        )}
        <Dialog.Footer>
          <Button variant="outline-secondary" onClick={onClose}>
            Chiudi
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
}

export default VolantiniRigaDialog;
