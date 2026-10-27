import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";

interface SessionExpiredBannerProps {
  reason: string | null;
  onDismiss: () => void;
}

interface Avviso {
  variante: "soft-warning" | "soft-danger" | "soft-success";
  icona: string;
  titolo: string;
  messaggio: string;
  /** Se vero il messaggio arriva dal parametro "message" dell'URL, quando presente. */
  messaggioDaUrl?: boolean;
}

const AVVISI: Record<string, Avviso> = {
  session_expired: {
    variante: "soft-warning",
    icona: "CircleAlert",
    titolo: "Attenzione",
    messaggio: "La tua sessione è scaduta. Effettua nuovamente il login.",
  },
  oidc_error: {
    variante: "soft-danger",
    icona: "ShieldAlert",
    titolo: "Autenticazione fallita",
    messaggio: "Errore durante l'autenticazione esterna",
    messaggioDaUrl: true,
  },
  oidc_user_not_found: {
    variante: "soft-warning",
    icona: "UserX",
    titolo: "Account non trovato",
    messaggio: "Nessun account associato a questa email",
    messaggioDaUrl: true,
  },
  oidc_access_denied: {
    variante: "soft-danger",
    icona: "ShieldOff",
    titolo: "Accesso negato",
    messaggio: "Non hai i permessi per accedere",
    messaggioDaUrl: true,
  },
  oidc_service_unavailable: {
    variante: "soft-warning",
    icona: "CloudOff",
    titolo: "Servizio non disponibile",
    messaggio: "Servizio di autenticazione temporaneamente non disponibile",
    messaggioDaUrl: true,
  },
  oidc_rate_limited: {
    variante: "soft-warning",
    icona: "Timer",
    titolo: "Limite richieste raggiunto",
    messaggio: "Troppi tentativi di accesso. Riprova tra qualche minuto",
    messaggioDaUrl: true,
  },
  oidc_external_error: {
    variante: "soft-danger",
    icona: "ServerCrash",
    titolo: "Errore servizio esterno",
    messaggio: "Errore nel servizio di autenticazione esterno",
    messaggioDaUrl: true,
  },
  logout_success: {
    variante: "soft-success",
    icona: "CircleCheck",
    titolo: "Logout effettuato",
    messaggio: "Hai effettuato il logout con successo.",
  },
};

const SessionExpiredBanner: React.FC<SessionExpiredBannerProps> = ({ reason: reasonRicevuto, onDismiss }) => {
  if (!reasonRicevuto) return null;
  // Gli esiti dell'accesso SAML hanno gli stessi casi di quello OIDC
  const reason = reasonRicevuto.startsWith("saml_") ? `oidc_${reasonRicevuto.slice("saml_".length)}` : reasonRicevuto;

  if (reason === "istanta_required") {
    return (
      <Alert variant="soft-primary" icona="CircleAlert" titolo="Accesso tramite Istanta richiesto" className="mb-5 text-sm">
        <p>
          La tua sessione è scaduta. Per accedere, effettua il login dalla piattaforma <strong>Istanta</strong>.
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={() => {
            const istantaUrl = import.meta.env.VITE_ISTANTA_IP_ADDRESS;
            if (istantaUrl) window.open(istantaUrl, "_blank");
          }}
        >
          Vai su Istanta
        </Button>
      </Alert>
    );
  }

  const avviso = AVVISI[reason];
  if (!avviso) return null;

  const messaggio = avviso.messaggioDaUrl
    ? new URLSearchParams(window.location.search).get("message") || avviso.messaggio
    : avviso.messaggio;

  return (
    <Alert
      variant={avviso.variante}
      icona={avviso.icona}
      titolo={avviso.titolo}
      onChiudi={onDismiss}
      className="mb-5 text-sm"
    >
      {messaggio}
    </Alert>
  );
};

export default SessionExpiredBanner;
