import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { caricaReportVolantino } from "@/query/flyerInsights";
import { useEffect, useRef, useState } from "react";
import { nomeFileReport } from "../../../../lib/insightVolantino/report";
import { ETICHETTA_IN_CORSO, inCorso, messaggioErrore, testoAvanzamento, type FaseReport, type StatoReport } from "./avanzamento";

/**
 * Bottone del report PDF di un volantino. Al click: dati e sezioni dal server, poi il generatore
 * (@react-pdf e il documento, caricati solo adesso: fuori dal codice della pagina e dal suo budget),
 * poi la miniatura della prima pagina per la copertina, l'impaginazione e il download.
 */

type ModuloReport = typeof import("./creaReportPdf");

let caricamento: Promise<ModuloReport> | undefined;

/**
 * Il modulo pesante del report, con una sola promessa per tutta la pagina (piu' bottoni, piu' click).
 * Se il caricamento fallisce (rete), la promessa si scarta e "Riprova" ci riprova.
 */
export function caricaModuloReport(): Promise<ModuloReport> {
  caricamento ??= import("./creaReportPdf").catch((errore: unknown) => {
    caricamento = undefined;
    throw errore;
  });
  return caricamento;
}

/** Salva il PDF con un link temporaneo, come il report dei tracciati. */
function salvaFile(blob: Blob, nome: string): void {
  const indirizzo = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = indirizzo;
  link.download = nome;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(indirizzo);
}

/** Errore di un passo della preparazione: porta il passo, per dire all'utente cosa non e' riuscito. */
class ErrorePasso extends Error {
  readonly fase: FaseReport;
  readonly causa: unknown;

  constructor(fase: FaseReport, causa: unknown) {
    super(fase);
    this.fase = fase;
    this.causa = causa;
  }
}

async function passo<T>(fase: FaseReport, azione: () => Promise<T>): Promise<T> {
  try {
    return await azione();
  } catch (errore) {
    throw new ErrorePasso(fase, errore);
  }
}

export interface ScaricaReportPdfProps {
  idKit: string;
  titolo: string;
  disabled?: boolean;
  /**
   * Il report è disattivato per questo motivo: il pulsante resta visibile, disattivato, e il motivo
   * compare passandoci sopra. Non genera né scarica nulla.
   */
  motivoDisattivato?: string;
}

export function ScaricaReportPdf({ idKit, titolo, disabled = false, motivoDisattivato }: ScaricaReportPdfProps) {
  const [stato, setStato] = useState<StatoReport>({ fase: "inattivo" });
  const montato = useRef(true);

  useEffect(() => {
    montato.current = true;
    return () => {
      montato.current = false;
    };
  }, []);

  const aggiorna = (nuovo: StatoReport) => {
    if (montato.current) setStato(nuovo);
  };

  const occupato = inCorso(stato);

  const genera = async () => {
    if (occupato || motivoDisattivato) return;
    try {
      aggiorna({ fase: "dati" });
      const report = await passo("dati", () => caricaReportVolantino(idKit));
      aggiorna({ fase: "generatore" });
      const modulo = await passo("generatore", caricaModuloReport);
      aggiorna({ fase: "copertina" });
      const immagini = await passo("copertina", () => modulo.preparaImmagini(report));
      aggiorna({ fase: "impaginazione" });
      const blob = await passo("impaginazione", () => modulo.creaBlobReport(report, immagini));
      salvaFile(blob, nomeFileReport(report.titolo || titolo, report.generatoIl));
      aggiorna({ fase: "inattivo" });
    } catch (errore) {
      const messaggio = errore instanceof ErrorePasso ? messaggioErrore(errore.fase, errore.causa) : messaggioErrore("impaginazione", errore);
      aggiorna({ fase: "errore", messaggio });
    }
  };

  const avanzamento = testoAvanzamento(stato);
  const inErrore = stato.fase === "errore";

  return (
    <div className="flex flex-col items-end" data-testid="scarica-report-pdf">
      <Button
        type="button"
        variant={inErrore ? "outline-danger" : "primary"}
        onClick={() => void genera()}
        disabled={disabled || Boolean(motivoDisattivato)}
        loading={occupato}
        title={motivoDisattivato ?? (inErrore ? undefined : `Scarica il report PDF di ${titolo}`)}
      >
        {!occupato &&
          (inErrore ? (
            <Lucide icon="RotateCcw" aria-hidden="true" className="mr-2 h-4 w-4" />
          ) : (
            <Lucide icon="FileDown" aria-hidden="true" className="mr-2 h-4 w-4" />
          ))}
        {occupato ? ETICHETTA_IN_CORSO : inErrore ? "Riprova" : "Report PDF"}
      </Button>
      <p aria-live="polite" className="mt-1 text-right text-xs tabular-nums text-slate-500 empty:mt-0 dark:text-slate-400">
        {avanzamento}
      </p>
      {inErrore && (
        <p role="alert" className="mt-1 flex max-w-xs items-start gap-1 text-right text-xs text-danger">
          <Lucide icon="CircleAlert" aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{stato.messaggio}</span>
        </p>
      )}
    </div>
  );
}

export default ScaricaReportPdf;
