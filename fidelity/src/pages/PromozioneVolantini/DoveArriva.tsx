import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import { BarreOrizzontali, type Tinta } from "@/components/Grafici";
import { coloreSemantico } from "@/utils/chartTheme";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { nomeRegione, type CodiceRegione } from "../../../lib/consultazione/regioni";
import type { DettaglioPromozioneVolantiniConsultazione } from "../../../lib/consultazione/tipi";
import {
  contaPerRegione,
  filtraPuntiVendita,
  localitaConPiuPuntiVendita,
  puntiSullaMappa,
  puntiVenditaPerCanale,
} from "./analisi";
import { Cartogramma } from "./Cartogramma";
import { ElencoRighe } from "./ElencoRighe";
import { MappaPromozione } from "./MappaPromozione";

export interface DoveArrivaProps {
  dettaglio: DettaglioPromozioneVolantiniConsultazione;
  tinta: (idCanale: string) => Tinta;
  /** Con "gdo.visualizza" elenco e mappa portano alla scheda dei punti vendita riconosciuti. */
  conScheda: boolean;
}

const TITOLO = "Dove arriva";
const DESCRIZIONE =
  "I punti vendita stampati nelle liste dei volantini, per regione e insegna. Scegli una regione per vedere solo i suoi punti vendita.";

/** Il blocco di un grafico dentro la sezione: titolo h3 e contenuto. */
function Blocco({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="title-card dark:text-slate-200">{titolo}</h3>
      {children}
    </div>
  );
}

/**
 * "Dove arriva": il cartogramma delle regioni, i punti vendita per insegna e le località con più
 * punti vendita, la mappa dei riconosciuti con le coordinate e l'elenco di tutte le righe stampate.
 * La regione scelta sul cartogramma filtra località, mappa ed elenco; la ricerca solo l'elenco.
 */
export function DoveArriva({ dettaglio, tinta, conScheda }: DoveArrivaProps) {
  const { kit, puntiVendita } = dettaglio;
  const [regione, setRegione] = useState<CodiceRegione | null>(null);
  const [cerca, setCerca] = useState("");
  // Con migliaia di righe il filtro resta un passo dietro alla digitazione, senza bloccarla
  const cercaApplicata = useDeferredValue(cerca);

  const kitPerId = useMemo(() => new Map(kit.map(k => [k.id, k])), [kit]);
  const conteggio = useMemo(() => contaPerRegione(puntiVendita), [puntiVendita]);
  const perCanale = useMemo(() => puntiVenditaPerCanale(kit, puntiVendita), [kit, puntiVendita]);
  const localita = useMemo(() => localitaConPiuPuntiVendita(puntiVendita, regione), [puntiVendita, regione]);
  const nellaRegione = useMemo(() => filtraPuntiVendita(puntiVendita, { regione, cerca: "" }), [puntiVendita, regione]);
  const mappa = useMemo(() => puntiSullaMappa(nellaRegione), [nellaRegione]);
  const filtrate = useMemo(() => filtraPuntiVendita(nellaRegione, { regione: null, cerca: cercaApplicata }), [nellaRegione, cercaApplicata]);
  const coloreCanale = (idCanale: string) => tinta(idCanale).colore ?? coloreSemantico("neutro");

  if (puntiVendita.length === 0) {
    return (
      <Sezione titolo={TITOLO} descrizione={DESCRIZIONE}>
        <EmptyState
          compatta
          icon="Store"
          title="Nessun punto vendita nei volantini"
          description="Le liste dei punti vendita stampate nei volantini di questa promozione non sono state lette."
        />
      </Sezione>
    );
  }

  const nomeScelta = regione ? nomeRegione(regione) : null;

  return (
    <Sezione titolo={TITOLO} descrizione={DESCRIZIONE}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
        <Cartogramma conteggio={conteggio} regione={regione} onRegione={setRegione} />
        <div className="grid min-w-0 grid-cols-1 content-start gap-6 xl:grid-cols-2">
          <Blocco titolo="Punti vendita per insegna">
            <BarreOrizzontali
              voci={perCanale.map(({ canale, puntiVendita: numero }) => ({ id: canale.id, etichetta: canale.nome, valore: numero, tinta: tinta(canale.id) }))}
              titolo="Punti vendita per insegna"
              descrizioneValore="Punti vendita"
            />
          </Blocco>
          <Blocco titolo={nomeScelta ? `Località con più punti vendita in ${nomeScelta}` : "Località con più punti vendita"}>
            <BarreOrizzontali
              voci={localita.map(voce => ({ id: voce.chiave, etichetta: voce.nome, valore: voce.puntiVendita }))}
              titolo={nomeScelta ? `Località con più punti vendita in ${nomeScelta}` : "Località con più punti vendita"}
              descrizioneValore="Punti vendita"
              vuoto="Le righe non indicano la località."
            />
          </Blocco>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-dashed border-slate-200 pt-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] dark:border-darkmode-400">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="title-card dark:text-slate-200">Elenco dei punti vendita</h3>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {regione && nomeScelta && (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-theme-1/10 py-1 pl-3 pr-1 text-xs font-medium text-theme-1 dark:bg-indigo-300/15 dark:text-indigo-200">
                  <span className="truncate">Regione: {nomeScelta}</span>
                  <button
                    type="button"
                    aria-label="Togli il filtro sulla regione"
                    className="rounded-full p-0.5 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:bg-indigo-300/20"
                    onClick={() => setRegione(null)}
                  >
                    <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <CampoRicerca
                etichetta="Cerca nei punti vendita per località o indirizzo"
                placeholder="Località o indirizzo…"
                value={cerca}
                onChange={setCerca}
                className="sm:w-64"
              />
            </div>
          </div>
          <ElencoRighe
            // Cambiando regione o ricerca l'elenco riparte dalle prime righe
            key={`${regione ?? ""}\u0000${cercaApplicata}`}
            righe={filtrate}
            kitPerId={kitPerId}
            tinta={tinta}
            conScheda={conScheda}
            vuoto={cercaApplicata.trim() ? "Nessun punto vendita con questa ricerca." : "Nessun punto vendita in questa regione."}
          />
        </div>
        <div className="min-w-0 xl:pt-1">
          <h3 className="sr-only">Mappa dei punti vendita riconosciuti</h3>
          <MappaPromozione
            punti={mappa.punti}
            fuoriMappa={mappa.fuoriMappa}
            kitPerId={kitPerId}
            coloreCanale={coloreCanale}
            conScheda={conScheda}
            className="xl:sticky xl:top-24"
          />
        </div>
      </div>
    </Sezione>
  );
}

export default DoveArriva;
