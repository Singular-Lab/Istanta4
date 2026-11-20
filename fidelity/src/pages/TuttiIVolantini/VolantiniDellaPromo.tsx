import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { Copertina } from "@/pages/PromozioneVolantini/Copertina";
import { tinteCanaliPromozione } from "@/pages/PromozioneVolantini/analisi";
import { LoghiInsegneContext, LogoInsegna } from "@/pages/PromozioneVolantini/LogoInsegna";
import { useVolantiniPromozione } from "@/query/consultazione";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { VarianteConsultazione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";

/**
 * Nello stato della voce della cronologia: il volantino è stato aperto senza una pagina di Fidelity
 * prima (segnalibro, nuova scheda). Passando a un altro volantino dalla tendina la voce si sostituisce,
 * e "Torna indietro" deve continuare a sapere che prima non c'era nulla.
 */
export interface StatoVolantino {
  primaPagina?: boolean;
}

/** Vero se prima di questo volantino non c'era una pagina di Fidelity: la prima voce, o un volantino che l'ha sostituita. */
export const senzaPaginaPrima = (key: string, state: unknown): boolean =>
  key === "default" || (state as StatoVolantino | null)?.primaPagina === true;

export interface VolantiniDellaPromoProps {
  /** Il volantino aperto: segnato nella tendina. */
  idKit: string;
  /** La promozione del volantino, dagli insight; senza (server non aggiornato) non c'è nulla da mostrare. */
  idPromo: string | null | undefined;
  /** Il nome della promozione dagli insight: c'è subito, anche prima della tendina. */
  nomePromo: string | null | undefined;
}

/** I volantini divisi per insegna, nell'ordine in cui arrivano (canale, area, titolo). */
export const perInsegna = (volantini: readonly VarianteConsultazione[]): Array<{ insegna: VarianteConsultazione["canale"]; volantini: VarianteConsultazione[] }> => {
  const gruppi = new Map<string, { insegna: VarianteConsultazione["canale"]; volantini: VarianteConsultazione[] }>();
  for (const volantino of volantini) {
    const chiave = volantino.canale.id.toLowerCase();
    const gruppo = gruppi.get(chiave) ?? { insegna: volantino.canale, volantini: [] };
    gruppo.volantini.push(volantino);
    gruppi.set(chiave, gruppo);
  }
  return [...gruppi.values()];
};

const CLASSI_COPERTINA = "aspect-[5/7] w-full rounded-sm bg-white shadow-sm ring-1 ring-black/10";

/**
 * La promozione del volantino, sempre indicata in grande in una barra sola, e tutta la barra apre la
 * tendina dei volantini pubblicati della stessa promozione, con copertina, insegna e area (spec
 * insight-volantino, "Promozione del volantino e passaggio agli altri volantini"): si cambia volantino
 * da qui, senza tornare alla promozione. Il volantino scelto prende il posto di questo nella
 * cronologia, così "Torna indietro" riporta alla pagina da cui l'utente era partito. Niente pagine
 * affiancate né differenze. Senza altri volantini pubblicati, o se la promozione non è consultabile, la
 * barra indica la promozione senza tendina.
 */
export function VolantiniDellaPromo({ idKit, idPromo, nomePromo }: VolantiniDellaPromoProps) {
  const navigate = useNavigate();
  const { key, state } = useLocation();
  const query = useVolantiniPromozione(idPromo ?? undefined);
  const dati = query.data;
  const volantini = useMemo(() => dati?.volantini ?? [], [dati]);
  const gruppi = useMemo(() => perInsegna(volantini), [volantini]);
  const tinta = useMemo(() => tinteCanaliPromozione(volantini.map(volantino => volantino.canale)), [volantini]);
  const nome = nomePromo || dati?.promo.nome;
  if (!nome) return null;

  const corrente = (id: string) => id.toLowerCase() === idKit.toLowerCase();
  const aperto = volantini.find(volantino => corrente(volantino.id));
  const conAltri = volantini.some(volantino => !corrente(volantino.id));
  const apri = (id: string) => {
    if (corrente(id)) return;
    const stato: StatoVolantino = { primaPagina: senzaPaginaPrima(key, state) };
    navigate(percorsoDettaglioVolantino(id), { replace: true, state: stato });
  };
  const numeroAree = new Set(volantini.map(volantino => volantino.area.id.toLowerCase())).size;
  const occhiello = conAltri
    ? `Promozione · ${formatNumero(volantini.length)} volantini in ${formatNumero(gruppi.length)} ${gruppi.length === 1 ? "insegna" : "insegne"}`
    : "Promozione";
  const classiNome = "text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white";

  // La copertina del volantino aperto, o il segno della promozione finché non si sa quale
  const segno = aperto ? (
    <span className="block w-12 flex-none">
      <Copertina kit={aperto} conNome={false} className={CLASSI_COPERTINA} />
    </span>
  ) : (
    <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-theme-1/10 text-theme-1 dark:bg-indigo-300/15 dark:text-indigo-200">
      <Lucide icon="Megaphone" className="h-6 w-6" />
    </span>
  );
  const sottotitolo = aperto ? (
    <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <Lucide icon="Eye" aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
      <span className="truncate">
        Stai guardando <strong className="font-semibold text-slate-700 dark:text-slate-200">{aperto.canale.nome} · {aperto.area.nome}</strong>
      </span>
    </span>
  ) : null;

  // Il contenuto della barra, uguale con e senza tendina: copertina, occhiello, nome e volantino aperto
  const contenuto = (
    <>
      {segno}
      <span className="min-w-0 flex-1">
        <span className="block text-2xs font-semibold uppercase tracking-wide text-theme-1 dark:text-indigo-200">{occhiello}</span>
        <span className={twMerge("block truncate", classiNome)}>{nome}</span>
        {sottotitolo}
      </span>
    </>
  );

  return (
    // Una barra sola, su fondo bianco: leggibile con qualunque tema dell'intestazione. Niente overflow
    // nascosto: la tendina deve uscire dalla barra
    <section
      aria-label="Promozione del volantino"
      className="rounded-card border border-slate-200 bg-white shadow-card dark:border-darkmode-400 dark:bg-darkmode-600"
    >
      {conAltri && dati ? (
        <LoghiInsegneContext.Provider value={dati.loghiInsegne ?? {}}>
          <Menu className="w-full">
            {/* Tutta la barra apre la tendina */}
            <Menu.Button
              as="button"
              type="button"
              aria-label={`${nome}: cambia volantino della promozione`}
              className="group flex w-full items-center gap-3 rounded-card px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-500"
            >
              {contenuto}
              <span className="flex flex-none items-center gap-2 text-sm font-semibold text-theme-1 dark:text-indigo-200">
                <span className="hidden sm:inline">Cambia volantino</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-theme-1/10 transition-colors group-hover:bg-theme-1 group-hover:text-white dark:bg-indigo-300/15">
                  <Lucide icon="ChevronDown" aria-hidden="true" className="h-5 w-5" />
                </span>
              </span>
            </Menu.Button>
            <Menu.Items
              placement="bottom-start"
              aria-label="Volantini della promozione"
              className="max-h-[70vh] w-[34rem] max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
            >
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cambia volantino</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatNumero(volantini.length)} volantini · {formatNumero(numeroAree)} {numeroAree === 1 ? "area" : "aree"}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {gruppi.map(gruppo => (
                  <div key={gruppo.insegna.id} className="rounded-lg bg-slate-50 p-2 dark:bg-darkmode-500">
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <LogoInsegna idCanale={gruppo.insegna.id} nome={gruppo.insegna.nome} tinta={tinta(gruppo.insegna.id)} />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{gruppo.insegna.nome}</span>
                      <span className="ml-auto text-2xs text-slate-500 dark:text-slate-400">
                        {gruppo.volantini.length === 1 ? "1 volantino" : `${formatNumero(gruppo.volantini.length)} volantini`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {gruppo.volantini.map(volantino => {
                        const questo = corrente(volantino.id);
                        return (
                          <Menu.Item
                            key={volantino.id}
                            onClick={() => apri(volantino.id)}
                            aria-current={questo ? "page" : undefined}
                            aria-label={`${volantino.canale.nome} · ${volantino.area.nome}${questo ? ", stai guardando" : ""}`}
                            className={twMerge(
                              "relative flex-col items-stretch gap-1 rounded-md p-1.5 hover:bg-white dark:hover:bg-darkmode-400",
                              questo && "bg-white ring-2 ring-theme-1 dark:bg-darkmode-400 dark:ring-indigo-300"
                            )}
                          >
                            <Copertina kit={volantino} conNome={false} className={CLASSI_COPERTINA} />
                            <span className="truncate text-center text-xs font-medium text-slate-700 dark:text-slate-200">{volantino.area.nome}</span>
                            {questo && (
                              <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-theme-1 px-1.5 py-0.5 text-3xs font-semibold text-white shadow-sm dark:bg-indigo-300 dark:text-slate-900">
                                Qui
                              </span>
                            )}
                          </Menu.Item>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Menu.Items>
          </Menu>
        </LoghiInsegneContext.Provider>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{contenuto}</div>
      )}
    </section>
  );
}

export default VolantiniDellaPromo;
