import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";

interface SessionExpiredBannerProps {
  reason: string | null;
  onDismiss: () => void;
}

const SessionExpiredBanner: React.FC<SessionExpiredBannerProps> = ({ reason, onDismiss }) => {
  if (!reason) return null;

  if (reason === "session_expired") {
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-yellow-100/80 border border-yellow-400/50 text-yellow-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="CircleAlert" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Attenzione:</span>
          La tua sessione è scaduta. Effettua nuovamente il login.
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "oidc_error") {
    const queryParams = new URLSearchParams(window.location.search);
    const message = queryParams.get("message") || "Errore durante l'autenticazione esterna";
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-red-100/80 border border-red-400/50 text-red-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="ShieldAlert" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Autenticazione fallita:</span>
          {message}
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "oidc_user_not_found") {
    const queryParams = new URLSearchParams(window.location.search);
    const message = queryParams.get("message") || "Nessun account associato a questa email";
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-orange-100/80 border border-orange-400/50 text-orange-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="UserX" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Account non trovato:</span>
          {message}
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "oidc_access_denied") {
    const queryParams = new URLSearchParams(window.location.search);
    const message = queryParams.get("message") || "Non hai i permessi per accedere";
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-red-100/80 border border-red-400/50 text-red-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="ShieldOff" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Accesso negato:</span>
          {message}
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "oidc_service_unavailable") {
    const queryParams = new URLSearchParams(window.location.search);
    const message = queryParams.get("message") || "Servizio di autenticazione temporaneamente non disponibile";
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-yellow-100/80 border border-yellow-400/50 text-yellow-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="CloudOff" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Servizio non disponibile:</span>
          {message}
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "oidc_rate_limited") {
    const queryParams = new URLSearchParams(window.location.search);
    const message = queryParams.get("message") || "Troppi tentativi di accesso. Riprova tra qualche minuto";
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-yellow-100/80 border border-yellow-400/50 text-yellow-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="Timer" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Limite richieste raggiunto:</span>
          {message}
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "oidc_external_error") {
    const queryParams = new URLSearchParams(window.location.search);
    const message = queryParams.get("message") || "Errore nel servizio di autenticazione esterno";
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-red-100/80 border border-red-400/50 text-red-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="ServerCrash" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Errore servizio esterno:</span>
          {message}
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reason === "istanta_required") {
    return (
      <div className="flex flex-col items-center px-4 py-4 mb-5 bg-theme-1/10 border border-theme-1/30 text-theme-1 rounded-xl backdrop-blur-sm">
        <div className="flex items-center mb-2">
          <Lucide icon="CircleAlert" className="w-5 h-5 mr-2" />
          <span className="font-semibold text-sm">Accesso tramite Istanta richiesto</span>
        </div>
        <div className="text-center mb-2 text-xs sm:text-sm">
          La tua sessione è scaduta. Per accedere, effettua il login dalla piattaforma <strong>Istanta</strong>.
        </div>
        <Button
          variant="primary"
          rounded
          size="sm"
          className="mt-1 px-4 py-2 text-xs font-medium"
          onClick={() => {
            const istantaUrl = import.meta.env.VITE_ISTANTA_IP_ADDRESS;
            if (istantaUrl) window.open(istantaUrl, "_blank");
          }}
        >
          Vai su Istanta
        </Button>
      </div>
    );

  }
  if (reason === "logout_success") {
    return (
      <div className="flex items-center px-4 py-3 mb-5 bg-emerald-100/80 border border-emerald-400/50 text-emerald-700 rounded-xl backdrop-blur-sm">
        <Lucide icon="CircleCheck" className="w-5 h-5 mr-2 shrink-0" />
        <span className="text-sm">
          <span className="font-medium mr-1">Logout effettuato:</span>
          Hai effettuato il logout con successo.
        </span>
        <button onClick={onDismiss} className="ml-auto shrink-0" aria-label="Chiudi">
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
};

export default SessionExpiredBanner;
