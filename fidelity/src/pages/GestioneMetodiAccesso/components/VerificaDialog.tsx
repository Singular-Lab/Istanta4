import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import type { AuthProviderAdminDTO, EsitoVerificaProvider } from "../../../../lib/types";
import { riepilogoVerifica } from "../utils";

interface VerificaDialogProps {
  provider: AuthProviderAdminDTO | null;
  esiti: EsitoVerificaProvider[] | null;
  onRipeti: () => void;
  onClose: () => void;
}

const STILE_ESITO: Record<EsitoVerificaProvider["esito"], { icona: string; pillola: string; testo: string; iconaClasse: string }> = {
  ok: { icona: "CircleCheck", pillola: "bg-emerald-50 border-emerald-200 text-emerald-700", testo: "OK", iconaClasse: "text-emerald-600" },
  avviso: { icona: "TriangleAlert", pillola: "bg-amber-50 border-amber-200 text-amber-700", testo: "Avviso", iconaClasse: "text-amber-600" },
  errore: { icona: "CircleX", pillola: "bg-danger/5 border-danger/20 text-danger", testo: "Errore", iconaClasse: "text-danger" },
};

const VerificaDialog = ({ provider, esiti, onRipeti, onClose }: VerificaDialogProps) => {
  const riepilogo = esiti ? riepilogoVerifica(esiti) : null;

  return (
    <Dialog open={provider !== null} onClose={onClose} size="lg">
      <Dialog.Panel>
        <Dialog.Title className="gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Lucide icon="Stethoscope" className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-800">Prova di {provider?.nome}</div>
              <div className="text-sm font-normal text-slate-500">Configurazione e raggiungibilità, senza modificare nulla</div>
            </div>
          </div>
        </Dialog.Title>

        <Dialog.Description className="space-y-4 bg-slate-50/50">
          {!esiti || !riepilogo ? (
            <div className="p-10 flex items-center justify-center gap-3 text-slate-500">
              <LoadingIcon icon="oval" className="w-5 h-5" />
              Verifica in corso...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4 rounded-md border border-slate-200/80 bg-white p-4 text-sm shadow-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-emerald-600 leading-none">{riepilogo.ok}</div>
                  <div className="text-xs text-slate-500 mt-0.5">ok</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <div className="text-xl font-bold text-amber-600 leading-none">{riepilogo.avviso}</div>
                  <div className="text-xs text-slate-500 mt-0.5">avvisi</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <div className="text-xl font-bold text-danger leading-none">{riepilogo.errore}</div>
                  <div className="text-xs text-slate-500 mt-0.5">errori</div>
                </div>
              </div>

              <div className="space-y-2">
                {esiti.map((esito, indice) => {
                  const stile = STILE_ESITO[esito.esito];
                  return (
                    <div key={`${esito.controllo}-${indice}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <Lucide icon={stile.icona} className={`mt-0.5 w-4 h-4 shrink-0 ${stile.iconaClasse}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-700">{esito.controllo}</div>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${stile.pillola}`}>
                            {stile.testo}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 break-all">{esito.dettaglio}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                La prova non sostituisce un accesso vero: dopo aver attivato il metodo, entra una volta per confermare.
              </div>
            </>
          )}
        </Dialog.Description>

        <Dialog.Footer className="flex flex-col-reverse gap-3 bg-white sm:flex-row sm:justify-end">
          <Button variant="outline-secondary" type="button" onClick={onClose} className="w-full sm:w-auto">
            Chiudi
          </Button>
          <Button variant="primary" type="button" onClick={onRipeti} loading={!esiti} className="w-full sm:w-auto">
            <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
            Ripeti prova
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default VerificaDialog;
