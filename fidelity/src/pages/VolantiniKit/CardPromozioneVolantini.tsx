import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { formatData, formatNumero } from "@/utils/format";
import { testoValidita, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import { Link } from "react-router-dom";
import { percorsoKit, percorsoPromo } from "../../../lib/materiali/periodi";
import type { PromozioneVolantini, VarianteVolantino } from "../../../lib/materiali/tipi";
import { GIORNI_SCADENZA_VICINA, giorniAllaScadenza, testoScadenza } from "./scadenza";

export interface CardPromozioneVolantiniProps {
  promozione: PromozioneVolantini;
  /** In Attivi la card dice quanto manca alla fine della validità. */
  conScadenza?: boolean;
  /** Senza il permesso di vedere le promozioni, promo e kit sono testo semplice. */
  conCollegamenti?: boolean;
  className?: string;
}

/** Varianti mostrate prima di "Mostra tutte": le altre restano a un clic. */
export const VARIANTI_VISIBILI = 6;

const testoFile = (numero: number) => (numero === 0 ? "Nessun file" : `${formatNumero(numero)} file`);

function Scadenza({ validitaAl }: { validitaAl: string | null }) {
  const giorni = giorniAllaScadenza(validitaAl);
  if (giorni === null) return null;
  const vicina = giorni >= 0 && giorni <= GIORNI_SCADENZA_VICINA;
  return (
    <span title={validitaAl ? `Valida fino al ${formatData(validitaAl)}` : undefined}>
      <StatusBadge tono={vicina ? "warning" : "neutral"} etichetta={testoScadenza(giorni)} icon="Clock" />
    </span>
  );
}

function Variante({ variante, collegamento }: { variante: VarianteVolantino; collegamento?: string }) {
  const contenuto = (
    <>
      <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <span className="truncate font-medium text-slate-700 group-hover/variante:text-theme-1">
          {variante.canale.nome} · {variante.area.nome}
        </span>
        {/* Il titolo del kit è un codice senza spazi: su mobile va a capo, da sm si tronca col title */}
        <span title={variante.titolo} className="break-all text-2xs text-slate-500 sm:truncate sm:break-normal">
          {variante.titolo}
        </span>
      </span>
      <span className="flex flex-none items-center gap-2 text-2xs tabular-nums text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Lucide icon="Files" aria-hidden="true" className="h-3 w-3" />
          {testoFile(variante.numeroFile)}
        </span>
        {/* 0 vuol dire che la lista dei punti vendita non è arrivata, non che il volantino non ne ha */}
        {variante.numeroPuntiVendita > 0 && (
          <span className="inline-flex items-center gap-1" title="Punti vendita stampati nel volantino">
            <Lucide icon="Store" aria-hidden="true" className="h-3 w-3" />
            {formatNumero(variante.numeroPuntiVendita)} PV
          </span>
        )}
      </span>
    </>
  );
  const classi = "flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm";
  // Il nome del link per intero: i pezzi della riga, letti uno dopo l'altro, non si separerebbero
  const etichetta = [
    `${variante.canale.nome} · ${variante.area.nome} – ${variante.titolo}`,
    testoFile(variante.numeroFile),
    ...(variante.numeroPuntiVendita > 0 ? [`${formatNumero(variante.numeroPuntiVendita)} punti vendita`] : []),
  ].join(", ");
  return collegamento ? (
    <Link to={collegamento} aria-label={etichetta} className={twMerge(classi, "group/variante")}>
      {contenuto}
    </Link>
  ) : (
    <div className={classi}>{contenuto}</div>
  );
}

/**
 * Una promozione con i suoi volantini pubblicati: copertina, validità, e i kit come varianti per
 * canale e area, ciascuno con i suoi file e i punti vendita stampati. Ogni variante apre il suo kit.
 */
function CardPromozioneVolantini({
  promozione,
  conScadenza = false,
  conCollegamenti = false,
  className,
}: CardPromozioneVolantiniProps) {
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);
  const [tutteVisibili, setTutteVisibili] = useState(false);
  const { promo, copertina, kit, numeroKit } = promozione;

  const anteprima = copertina ? urlAnteprimaMateriale(copertina.idOlimpoCloud) : "";
  const validita = testoValidita(promo.validitaDal, promo.validitaAl);
  const visibili = tutteVisibili ? kit : kit.slice(0, VARIANTI_VISIBILI);
  // Con i filtri la promo mostra solo una parte dei suoi kit: lo dice
  const testoKit =
    kit.length < numeroKit
      ? `${formatNumero(kit.length)} di ${formatNumero(numeroKit)} kit`
      : `${formatNumero(numeroKit)} kit`;

  return (
    <>
      <article aria-label={promo.nome} className={twMerge("rounded-card border border-slate-200 bg-white p-4", className)}>
        {/* Su mobile la copertina più piccola lascia spazio al nome della promo */}
        <div className="flex gap-3 sm:gap-4">
          <div className="shrink-0">
            {anteprima ? (
              <button
                type="button"
                aria-label={`Anteprima del volantino di ${promo.nome}`}
                className="group/anteprima relative h-20 w-16 overflow-hidden rounded-control border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 sm:h-24 sm:w-20"
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
            ) : (
              <div className="flex h-20 w-16 items-center justify-center rounded-control border border-dashed border-slate-300 bg-slate-50 sm:h-24 sm:w-20">
                <Lucide icon="Newspaper" aria-hidden="true" className="h-5 w-5 text-slate-400" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="title-card min-w-0 [overflow-wrap:anywhere]">
                {conCollegamenti ? (
                  <Link to={percorsoPromo(promo.id, promo.stato)} className="hover:text-theme-1">
                    {promo.nome}
                  </Link>
                ) : (
                  promo.nome
                )}
              </h3>
              {conScadenza && <Scadenza validitaAl={promo.validitaAl} />}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500">
              {validita && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Lucide icon="Calendar" aria-hidden="true" className="h-3 w-3" />
                  {validita}
                </span>
              )}
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Lucide icon="Layers" aria-hidden="true" className="h-3 w-3" />
                {testoKit}
              </span>
            </div>
          </div>
        </div>

        <ul
          aria-label={`Varianti di ${promo.nome}`}
          className="mt-3 divide-y divide-dashed divide-slate-200 border-t border-dashed border-slate-200"
        >
          {visibili.map((variante) => (
            <li key={variante.id}>
              <Variante
                variante={variante}
                collegamento={conCollegamenti ? percorsoKit(promo.id, promo.stato, variante.id) : undefined}
              />
            </li>
          ))}
        </ul>

        {kit.length > VARIANTI_VISIBILI && (
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              aria-expanded={tutteVisibili}
              onClick={() => setTutteVisibili((aperte) => !aperte)}
            >
              <Lucide icon={tutteVisibili ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              {tutteVisibili ? "Mostra meno" : `Mostra tutte le ${formatNumero(kit.length)} varianti`}
            </Button>
          </div>
        )}
      </article>

      {anteprimaAperta && anteprima && (
        <PreviewImmaginePdf
          imageUrl={anteprima}
          totalPages={copertina?.pagine ?? 1}
          onClose={() => setAnteprimaAperta(false)}
        />
      )}
    </>
  );
}

export default CardPromozioneVolantini;
