import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { twMerge } from "tailwind-merge";

interface PageErrorProps {
  /** Perché i dati non sono arrivati, come restituito dal servizio. */
  motivo: string;
  titolo?: string;
  /** Se presente, mostra "Riprova". */
  onRiprova?: () => void;
  /** Variante da usare dentro una card o una sezione, al posto dell'intera pagina. */
  compatta?: boolean;
  className?: string;
}

/**
 * Pagina o sezione non caricata: mostra il motivo e permette di riprovare.
 * Non va usata per l'accesso negato né per l'assenza di dati.
 */
function PageError({ motivo, titolo = "Impossibile caricare la pagina", onRiprova, compatta = false, className }: PageErrorProps) {
  if (compatta) {
    return (
      <div
        role="alert"
        className={twMerge("flex flex-wrap items-center gap-3 rounded-control border border-danger/20 bg-danger/5 px-4 py-3", className)}
      >
        <Lucide icon="TriangleAlert" aria-hidden="true" className="h-5 w-5 flex-none text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{titolo}</p>
          <p className="text-sm text-slate-500">{motivo}</p>
        </div>
        {onRiprova && (
          <Button type="button" variant="outline-secondary" size="sm" onClick={onRiprova}>
            <Lucide icon="RefreshCw" aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Riprova
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={twMerge("box box--stacked flex min-h-[calc(100vh-12rem)] items-center justify-center px-6", className)}
    >
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-danger/10 text-danger">
          <Lucide icon="TriangleAlert" aria-hidden="true" className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titolo}</h1>
          <p className="leading-relaxed text-slate-500">{motivo}</p>
        </div>
        {onRiprova && (
          <Button type="button" variant="primary" onClick={onRiprova} className="rounded-full px-5 py-2.5">
            <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />
            Riprova
          </Button>
        )}
      </div>
    </div>
  );
}

export default PageError;
