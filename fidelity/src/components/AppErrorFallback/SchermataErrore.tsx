//@ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";

import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { lazy, Suspense, type ReactNode } from "react";

const DotLottieReact = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({ default: m.DotLottieReact }))
);

interface SchermataErroreProps {
  /** Icona Lucide sopra il titolo. */
  icona?: string;
  /** Titolo fisso della schermata (h1). */
  titolo: string;
  /** Spiegazione o messaggio d'errore, sotto il titolo. */
  messaggio?: ReactNode;
  /** Unica azione per uscire dall'errore. */
  azione: { etichetta: string; onClick: () => void };
  /** Contenuto aggiuntivo tra il messaggio e l'azione (es. dettagli tecnici in sviluppo). */
  children?: ReactNode;
}

/**
 * Schermata d'errore a tutto schermo, fuori dal layout: autenticazione fallita e
 * errori non gestiti dell'applicazione.
 */
const SchermataErrore = ({ icona = "TriangleAlert", titolo, messaggio, azione, children }: SchermataErroreProps) => (
  <div
    role="alert"
    className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/90 px-6 backdrop-blur-md transition-opacity duration-300"
  >
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <Lucide icon={icona} aria-hidden="true" className="h-20 w-20 animate-pulse text-warning" />
      <h1 className="title-page mt-6 text-white">{titolo}</h1>
      {messaggio && <p className="mt-2 text-sm text-slate-300">{messaggio}</p>}
      {children}
      <Button
        type="button"
        variant="primary"
        rounded
        onClick={azione.onClick}
        className="mt-6 border-white bg-white px-6 py-2 font-semibold text-primary hover:bg-slate-100"
      >
        {azione.etichetta}
      </Button>
      <div className="mt-10" aria-hidden="true">
        <Suspense fallback={null}>
          <DotLottieReact autoplay loop src={lottieAnimation} style={{ height: "150px", width: "150px" }} />
        </Suspense>
      </div>
    </div>
  </div>
);

export default SchermataErrore;
