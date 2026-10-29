import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { formatData, formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import axios from "axios";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";

/** File principale del kit (il volantino), con i campi già normalizzati dalla pagina. */
export interface FileVolantino {
  nome?: string;
  /** Immagine di anteprima (url o miniatura). */
  anteprima?: string;
  idOlimpoCloud?: string;
  tipoExport?: string;
  mime?: string;
  pagine?: number;
}

export interface CardVolantinoProps {
  titolo: string;
  /** Stato di lavorazione del kit runtime, o NON_AVVIATO per un kit previsto ma senza runtime. */
  stato: string;
  nomeArea?: string;
  nomeCanale?: string;
  file?: FileVolantino;
  validitaDal?: string | Date;
  validitaAl?: string | Date;
  /** Rotta della scheda del kit; senza, il titolo è testo semplice. */
  collegamento?: string;
  /** Promo del kit, mostrata sotto il titolo (con link se indicato). */
  promo?: { nome: string; collegamento?: string };
  /** File del kit; se indicato la card mostra quanti sono ("Nessun file" con 0). */
  numeroFile?: number;
  className?: string;
}

const testoNumeroFile = (numero: number) =>
  numero === 0 ? "Nessun file" : `${formatNumero(numero)} file`;

const periodoValidita = (dal?: string | Date, al?: string | Date) => {
  if (dal && al) return `${formatData(dal)} – ${formatData(al)}`;
  if (al) return `fino al ${formatData(al)}`;
  if (dal) return `dal ${formatData(dal)}`;
  return null;
};

/** Volantino pubblicato di un kit: anteprima, dati del file e comandi Scarica e Anteprima. */
function CardVolantino({
  titolo,
  stato,
  nomeArea,
  nomeCanale,
  file,
  validitaDal,
  validitaAl,
  collegamento,
  promo,
  numeroFile,
  className,
}: CardVolantinoProps) {
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);
  const [scaricamento, setScaricamento] = useState(false);

  const anteprima = file?.anteprima ?? "";
  const conAnteprima = Boolean(anteprima);
  const scaricabile = Boolean(file?.idOlimpoCloud);
  const periodo = periodoValidita(validitaDal, validitaAl);

  const scarica = async () => {
    if (!file?.idOlimpoCloud || scaricamento) return;
    setScaricamento(true);
    try {
      const response = await axios.get(`${ServerCall.getUrl()}/getFileFromOlimpo?id=${file.idOlimpoCloud}`, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.nome || "volantino.pdf";
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Errore durante il download del file:", error);
    } finally {
      setScaricamento(false);
    }
  };

  return (
    <>
      <article className={twMerge("rounded-card border border-slate-200 bg-white p-4", className)}>
        <div className="flex gap-4">
          <div className="shrink-0">
            {conAnteprima ? (
              <button
                type="button"
                aria-label={`Anteprima di ${titolo}`}
                className="group/anteprima relative h-24 w-20 overflow-hidden rounded-control border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
                onClick={() => setAnteprimaAperta(true)}
              >
                <img src={anteprima} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-xs font-medium text-white opacity-0 transition-opacity group-hover/anteprima:opacity-100"
                >
                  <Lucide icon="Eye" className="mr-1 h-4 w-4" />
                  Anteprima
                </span>
              </button>
            ) : collegamento ? (
              // Senza copertina (kit non avviato o senza PDF) il segnaposto porta comunque alla scheda:
              // per le tecnologie assistive basta il link del titolo
              <Link
                to={collegamento}
                aria-hidden="true"
                tabIndex={-1}
                className="flex h-24 w-20 items-center justify-center rounded-control border border-dashed border-slate-300 bg-slate-50 hover:border-theme-1/40"
              >
                <Lucide icon="FileText" className="h-5 w-5 text-slate-400" />
              </Link>
            ) : (
              <div className="flex h-24 w-20 items-center justify-center rounded-control border border-dashed border-slate-300 bg-slate-50">
                <Lucide icon="FileText" aria-hidden="true" className="h-5 w-5 text-slate-400" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="title-card truncate">
                  {collegamento ? (
                    <Link to={collegamento} className="hover:text-theme-1">
                      {titolo}
                    </Link>
                  ) : (
                    titolo
                  )}
                </h3>
                {promo &&
                  (promo.collegamento ? (
                    <Link to={promo.collegamento} className="block truncate text-xs text-theme-1 hover:underline">
                      Promo: {promo.nome}
                    </Link>
                  ) : (
                    <p className="truncate text-xs text-slate-500">Promo: {promo.nome}</p>
                  ))}
                {(nomeArea || nomeCanale) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {nomeArea && (
                      <Badge variant="secondary" size="sm">
                        <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3" />
                        {nomeArea}
                      </Badge>
                    )}
                    {nomeCanale && (
                      <Badge variant="primary" size="sm">
                        <Lucide icon="Store" aria-hidden="true" className="h-3 w-3" />
                        {nomeCanale}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <StatusBadge dominio="kitRuntime" stato={stato} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-2xs text-slate-500">
              {numeroFile !== undefined && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Lucide icon="Files" aria-hidden="true" className="h-3 w-3" />
                  {testoNumeroFile(numeroFile)}
                </span>
              )}
              {periodo && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Lucide icon="Calendar" aria-hidden="true" className="h-3 w-3" />
                  {periodo}
                </span>
              )}
              {file?.tipoExport && (
                <span className="inline-flex items-center gap-1">
                  <Lucide icon="Layers" aria-hidden="true" className="h-3 w-3" />
                  {file.tipoExport}
                </span>
              )}
              {file?.mime && (
                <span className="inline-flex items-center gap-1">
                  <Lucide icon="File" aria-hidden="true" className="h-3 w-3" />
                  {file.mime}
                </span>
              )}
              {file?.pagine !== undefined && file.pagine > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Lucide icon="Book" aria-hidden="true" className="h-3 w-3" />
                  {file.pagine} pp
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                onClick={scarica}
                disabled={!scaricabile}
                loading={scaricamento}
              >
                {!scaricamento && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                {scaricamento ? "Download…" : "Scarica"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                onClick={() => setAnteprimaAperta(true)}
                disabled={!conAnteprima}
              >
                <Lucide icon="Focus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Anteprima
              </Button>
            </div>
          </div>
        </div>
      </article>

      {anteprimaAperta && conAnteprima && (
        <PreviewImmaginePdf
          imageUrl={anteprima}
          totalPages={file?.pagine ?? 1}
          onClose={() => setAnteprimaAperta(false)}
        />
      )}
    </>
  );
}

export default CardVolantino;
