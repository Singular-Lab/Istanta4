import { FormInput, FormLabel, FormSwitch } from "@/components/Base/Form";
import { INGRESSO_SERVIZIO_GESTITO, type ServizioGestito } from "../../../../lib/hubServiziGestiti";
import type { HubServiceDTO } from "../../../../lib/types";

interface IndirizzoServizioGestitoProps {
  gestito: ServizioGestito;
  manuale: boolean;
  url: string;
  tipoUrl: HubServiceDTO["tipo_url"];
  /** L'indirizzo che Fidelity ricava dalla configurazione; null se l'installazione non lo configura. */
  urlCalcolato: string | null;
  onManualeChange: (manuale: boolean) => void;
  onUrlChange: (url: string) => void;
}

/** Le variabili di Fidelity da cui si calcola l'indirizzo di ciascun servizio gestito. */
const VARIABILI: Record<ServizioGestito, string> = {
  istanta: "FICO_BASE_URL o ISTANTA_IP_ADDRESS",
  correggo: "CORREGGO_IP_ADDRESS",
};

/**
 * L'indirizzo di un servizio gestito (Istanta, Correggo) nella gestione dell'hub: quello calcolato dalla
 * configurazione dell'installazione oppure uno scelto dal Superadmin, con il ritorno al calcolato.
 */
const IndirizzoServizioGestito = ({
  gestito,
  manuale,
  url,
  tipoUrl,
  urlCalcolato,
  onManualeChange,
  onUrlChange,
}: IndirizzoServizioGestitoProps) => {
  const ingresso = INGRESSO_SERVIZIO_GESTITO[gestito];
  // Senza l'ingresso giusto l'applicazione apre la sua pagina di login invece dell'accesso automatico.
  const senzaIngresso =
    manuale && tipoUrl === "external_fico" && url.trim() !== "" && !url.split("?")[0].replace(/\/+$/, "").endsWith(ingresso);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FormLabel htmlFor="service-url" className="mb-0">URL</FormLabel>
        <FormSwitch>
          <FormSwitch.Input
            id="service-indirizzo-manuale"
            type="checkbox"
            checked={manuale}
            onChange={(event) => onManualeChange(event.target.checked)}
          />
          <FormSwitch.Label htmlFor="service-indirizzo-manuale">Indirizzo manuale</FormSwitch.Label>
        </FormSwitch>
      </div>

      {manuale ? (
        <>
          {tipoUrl === "internal" ? (
            <div className="mt-2 rounded-control border border-info/20 bg-info/5 px-3 py-2 text-xs text-info">
              Con il tipo URL <strong>Interno</strong> l'apertura è automatica sulla start page dell'utente.
            </div>
          ) : (
            <FormInput
              id="service-url"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              className="mt-2"
              placeholder={`https://...${ingresso}`}
            />
          )}
          {senzaIngresso && (
            <div className="mt-1 text-xs text-warning">
              Per l'accesso automatico l'indirizzo di solito termina con <code>{ingresso}</code>.
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>
              Scelto dal Superadmin. Calcolato: {urlCalcolato ?? "non configurato"}.
            </span>
            <button
              type="button"
              onClick={() => onManualeChange(false)}
              className="font-medium text-primary hover:underline"
            >
              Torna all'indirizzo calcolato
            </button>
          </div>
        </>
      ) : (
        <>
          <FormInput id="service-url" value={urlCalcolato ?? ""} readOnly className="mt-2" />
          <div className="mt-1 text-xs text-slate-500">
            {urlCalcolato == null
              ? `Indirizzo non configurato: impostare ${VARIABILI[gestito]} di Fidelity, oppure scegliere un indirizzo manuale.`
              : "Calcolato da Fidelity dalla configurazione dell'installazione. Per cambiarlo scegli un indirizzo manuale."}
          </div>
        </>
      )}
    </div>
  );
};

export default IndirizzoServizioGestito;
