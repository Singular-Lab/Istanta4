import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import type { AuthProviderAdminDTO, EsitoVerificaProvider } from "../../../../lib/types";
import { riepilogoVerifica } from "../utils";

interface VerificaDialogProps {
  provider: AuthProviderAdminDTO | null;
  esiti: EsitoVerificaProvider[] | null;
  onRipeti: () => void;
  onClose: () => void;
}

const STILE_ESITO: Record<EsitoVerificaProvider["esito"], { icona: string; tono: TonoStato; testo: string; iconaClasse: string }> = {
  ok: { icona: "CircleCheck", tono: "success", testo: "OK", iconaClasse: "text-success" },
  avviso: { icona: "TriangleAlert", tono: "warning", testo: "Avviso", iconaClasse: "text-warning" },
  errore: { icona: "CircleX", tono: "danger", testo: "Errore", iconaClasse: "text-danger" },
};

const VerificaDialog = ({ provider, esiti, onRipeti, onClose }: VerificaDialogProps) => {
  const riepilogo = esiti ? riepilogoVerifica(esiti) : null;

  return (
    <Dialog open={provider !== null} onClose={onClose} size="lg">
      <Dialog.Panel>
        <Dialog.Title>
          <Lucide icon="Stethoscope" aria-hidden="true" className="h-5 w-5 text-primary" />
          Prova di {provider?.nome}
        </Dialog.Title>

        <Dialog.Description className="space-y-4">
          <p className="text-sm text-slate-500">Configurazione e raggiungibilità, senza modificare nulla.</p>
          {!esiti || !riepilogo ? (
            <div role="status" className="p-10 flex items-center justify-center gap-3 text-slate-500">
              <Spinner decorativo />
              Verifica in corso...
            </div>
          ) : (
            <>
              <StatCardGrid className="grid-cols-3 lg:grid-cols-3">
                <StatCard densita="compatta" etichetta="OK" valore={riepilogo.ok} tono="success" evidenzia={riepilogo.ok > 0} />
                <StatCard densita="compatta" etichetta="Avvisi" valore={riepilogo.avviso} tono="warning" evidenzia={riepilogo.avviso > 0} />
                <StatCard densita="compatta" etichetta="Errori" valore={riepilogo.errore} tono="danger" evidenzia={riepilogo.errore > 0} />
              </StatCardGrid>

              <div className="space-y-2">
                {esiti.map((esito, indice) => {
                  const stile = STILE_ESITO[esito.esito];
                  return (
                    <div key={`${esito.controllo}-${indice}`} className="flex items-start gap-3 rounded-card border border-slate-200 bg-white px-4 py-3">
                      <Lucide icon={stile.icona} aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${stile.iconaClasse}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-700">{esito.controllo}</div>
                          <StatusBadge tono={stile.tono} etichetta={stile.testo} />
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 break-all">{esito.dettaglio}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Alert variant="soft-info" icona="Info" className="text-xs">
                La prova non sostituisce un accesso vero: dopo aver attivato il metodo, entra una volta per confermare.
              </Alert>
            </>
          )}
        </Dialog.Description>

        <Dialog.Footer>
          <Button variant="outline-secondary" type="button" onClick={onClose}>
            Chiudi
          </Button>
          <Button variant="primary" type="button" onClick={onRipeti} loading={!esiti}>
            {esiti && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
            Ripeti prova
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default VerificaDialog;
