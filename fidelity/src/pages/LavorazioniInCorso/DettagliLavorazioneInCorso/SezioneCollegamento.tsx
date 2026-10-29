import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import type { ReactNode } from "react";

interface SezioneCollegamentoProps {
  icona: string;
  titolo: string;
  descrizione: string;
  azione: ReactNode;
  className?: string;
}

/** Riquadro che porta a un'altra pagina della promo: titolo, descrizione e comandi a destra. */
function SezioneCollegamento({ icona, titolo, descrizione, azione, className }: SezioneCollegamentoProps) {
  return (
    <Sezione aria-label={titolo} className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Lucide icon={icona} aria-hidden="true" className="mt-1 h-5 w-5 flex-none text-slate-500" />
          <div className="min-w-0">
            <h2 className="title-section">{titolo}</h2>
            <p className="text-sm text-slate-500">{descrizione}</p>
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">{azione}</div>
      </div>
    </Sezione>
  );
}

export default SezioneCollegamento;
