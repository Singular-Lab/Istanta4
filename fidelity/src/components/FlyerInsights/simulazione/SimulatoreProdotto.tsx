import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormField, FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import { useSimulazioneProdotto } from "@/query/flyerInsights";
import { formatData, formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { urlPaginaMateriale } from "@/utils/materiali";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { formattaValore } from "../../../../lib/insightVolantino/calore";
import type { CasoSimile, RichiestaSimulazione, SimulazioneProdotto } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight, PdfVolantino } from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";
import {
  ETICHETTE_AFFIDABILITA,
  ETICHETTE_TIPO_PREVISIONE,
  testoCasi,
  testoIndicePosizione,
  testoPrevisto,
  VARIANTE_AFFIDABILITA,
} from "../analisi/affidabilita";
import { Blocco, Nota } from "../analisi/comuni";
import { pagineDaSfogliare, proporzioneDelVolantino, proporzioneDellaPagina, riquadroBox } from "../volantino/geometria";
import {
  CAMPI_VUOTI,
  campiDelProdotto,
  centroBox,
  etichettaProdotto,
  filtraProdotti,
  leggiNumero,
  nomeZona,
  prodottiSimulabili,
  riquadroSimulato,
  stessaRichiesta,
  validaSimulazione,
  type CampiSimulazione,
  type ErroriSimulazione,
} from "./supporto";
import { ZonaPagina } from "./ZonaPagina";

export interface SimulatoreProdottoProps {
  idKit: string;
  /** I box del volantino: i prodotti simulabili e le loro posizioni attuali. */
  box: readonly BoxInsight[];
  pdf: PdfVolantino | null;
  totalePagine: number;
}

/** "12,5%": al decimo, come lo si scrive nel modulo. */
const percentuale = (valore: number): string => `${formatNumero(Math.round(valore * 10) / 10)}%`;

const testoSconto = (sconto: number | null): string => (sconto === null ? "senza sconto" : `sconto ${percentuale(sconto)}`);

const testoSpazio = (spazio: number | null): string => (spazio === null ? VALORE_ASSENTE : percentuale(spazio));

/** I casi passati più simili, con il collegamento al loro volantino. */
function CasiSimili({ casi, unita }: { casi: readonly CasoSimile[]; unita: SimulazioneProdotto["unita"] }) {
  if (casi.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nessun caso simile nello storico: la stima si basa sul solo modello.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Casi simili nello storico</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-2xs uppercase tracking-wide text-slate-500 dark:border-darkmode-400 dark:text-slate-400">
            <th scope="col" className="py-1.5 pl-1 pr-3 font-medium">
              Volantino
            </th>
            <th scope="col" className="px-2 py-1.5 font-medium">
              Data
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Pagina
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Sconto
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Spazio
            </th>
            <th scope="col" className="py-1.5 pl-2 pr-1 text-right font-medium">
              {unita === "pezzi" ? "Venduto" : "Visibilità"}
            </th>
          </tr>
        </thead>
        <tbody>
          {casi.map(caso => (
            <tr key={`${caso.idKit}-${caso.pagina ?? ""}`} className="border-b border-slate-100 last:border-0 dark:border-darkmode-400">
              <th scope="row" className="py-1.5 pl-1 pr-3 text-left font-medium">
                <Link
                  to={percorsoDettaglioVolantino(caso.idKit, caso.pagina)}
                  className="block max-w-56 truncate text-primary underline-offset-2 hover:underline dark:text-indigo-300"
                  title={caso.titolo}
                >
                  {caso.titolo}
                </Link>
              </th>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-600 dark:text-slate-300">{formatData(caso.data)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                {caso.pagina !== null ? formatNumero(caso.pagina) : VALORE_ASSENTE}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{caso.sconto === null ? "senza" : percentuale(caso.sconto)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{testoSpazio(caso.spazio)}</td>
              <td className="whitespace-nowrap py-1.5 pl-2 pr-1 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {caso.valore === null ? VALORE_ASSENTE : unita === "pezzi" ? formatNumero(Math.round(caso.valore)) : formattaValore(caso.valore, "indice")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Il risultato: valore stimato, indice della posizione, affidabilità, casi simili e come è stato calcolato. */
function Risultato({ simulazione, richiesta }: { simulazione: SimulazioneProdotto; richiesta: RichiestaSimulazione }) {
  return (
    <section aria-label="Risultato della simulazione" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="title-card dark:text-slate-200">Risultato</h3>
        <Badge variant={simulazione.tipo === "vendite" ? "info" : "warning"} size="sm">
          {ETICHETTE_TIPO_PREVISIONE[simulazione.tipo]}
        </Badge>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          pagina {formatNumero(richiesta.pagina)}, spazio {testoSpazio(richiesta.spazio)}, {testoSconto(richiesta.sconto)}
        </span>
      </div>
      <StatCardGrid className="sm:grid-cols-3">
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta={simulazione.unita === "pezzi" ? "Vendite stimate" : "Visibilità stimata"}
          valore={testoPrevisto(simulazione.valore, simulazione.unita)}
          icona="Gauge"
          sottotitolo={simulazione.tipo === "teorica" ? "stima teorica, senza vendite" : "nel periodo di una promo"}
        />
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta="Indice di posizione"
          valore={formattaValore(simulazione.indicePosizione, "indice")}
          icona="Crosshair"
          sottotitolo={`1 = media; ${testoIndicePosizione(simulazione.indicePosizione)}`}
        />
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta="Affidabilità"
          valore={
            <Badge variant={VARIANTE_AFFIDABILITA[simulazione.affidabilita]} size="md">
              {ETICHETTE_AFFIDABILITA[simulazione.affidabilita]}
            </Badge>
          }
          icona="Target"
          sottotitolo={testoCasi(simulazione.casiStorici)}
        />
      </StatCardGrid>
      <Nota icona={simulazione.tipo === "teorica" ? "TriangleAlert" : "Info"}>{simulazione.nota}</Nota>
      <Blocco titolo="Casi simili" descrizione="Lo stesso prodotto, o i più vicini, in posizioni simili delle edizioni passate.">
        <CasiSimili casi={simulazione.casiSimili} unita={simulazione.unita} />
      </Blocco>
    </section>
  );
}

/**
 * Simulatore di un prodotto: lo si sposta (pagina e zona), gli si dà uno spazio e uno sconto e si
 * vede quanto renderebbe secondo lo storico, o in teoria se le vendite non ci sono. Si parte dalla
 * posizione attuale del prodotto; la richiesta parte solo con "Simula", non a ogni tasto.
 */
export function SimulatoreProdotto({ idKit, box, pdf, totalePagine }: SimulatoreProdottoProps) {
  const prodotti = useMemo(() => prodottiSimulabili(box), [box]);
  const totale = pagineDaSfogliare(totalePagine, box);
  const proporzioneBase = useMemo(() => proporzioneDelVolantino(box), [box]);
  const [cerca, setCerca] = useState("");
  const [campi, setCampi] = useState<CampiSimulazione>(CAMPI_VUOTI);
  const [errori, setErrori] = useState<ErroriSimulazione>({});
  const [richiesta, setRichiesta] = useState<RichiestaSimulazione | null>(null);
  const simulazione = useSimulazioneProdotto(idKit, richiesta);

  const filtrati = useMemo(() => filtraProdotti(prodotti, cerca, campi.chiave), [prodotti, cerca, campi.chiave]);
  const prodotto = prodotti.find(voce => voce.chiave === campi.chiave) ?? null;
  const pagina = leggiNumero(campi.pagina);
  const paginaValida = pagina !== null && Number.isInteger(pagina) && pagina >= 1 && pagina <= totale ? pagina : 1;
  const proporzione = proporzioneDellaPagina(box, paginaValida, proporzioneBase);
  const immagine = pdf && pdf.idOlimpoCloud && (pdf.pagine <= 0 || paginaValida <= pdf.pagine) ? urlPaginaMateriale(pdf.idOlimpoCloud, paginaValida) : null;

  // La posizione attuale vale solo nella pagina dove il prodotto sta davvero
  const riquadroAttuale = prodotto && prodotto.box.pagina === paginaValida ? riquadroBox(prodotto.box.geometria) : null;
  const centroAttuale = prodotto && riquadroAttuale ? centroBox(prodotto.box) : null;
  const attuale = riquadroAttuale && centroAttuale ? { centro: centroAttuale, riquadro: riquadroAttuale } : null;
  const simulato = riquadroSimulato(campi.zona, leggiNumero(campi.spazio), proporzione);

  // Cambiati i campi dopo una simulazione, il risultato resta ma dice che è quello di prima
  const richiestaAttuale = validaSimulazione(campi, totale).richiesta;
  const superata = richiesta !== null && !stessaRichiesta(richiesta, richiestaAttuale);

  const aggiorna = (modifiche: Partial<CampiSimulazione>) => setCampi(attuali => ({ ...attuali, ...modifiche }));

  const scegliProdotto = (chiave: string) => {
    const scelto = prodotti.find(voce => voce.chiave === chiave);
    setCampi(scelto ? campiDelProdotto(scelto) : CAMPI_VUOTI);
    setErrori({});
  };

  const simula = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const esito = validaSimulazione(campi, totale);
    setErrori(esito.errori);
    if (esito.richiesta) setRichiesta(esito.richiesta);
  };

  if (prodotti.length === 0) {
    return <Nota>Nessun prodotto da simulare: i box del volantino non hanno un prodotto riconosciuto.</Nota>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={simula} noValidate aria-label="Simulazione di un prodotto" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <CampoRicerca etichetta="Cerca il prodotto" placeholder="Cerca per nome o marca…" value={cerca} onChange={setCerca} className="sm:w-full" />
            <FormField etichetta="Prodotto" obbligatorio errore={errori.chiave} aiuto={`${formatNumero(filtrati.length)} di ${formatNumero(prodotti.length)} prodotti del volantino`}>
              <FormSelect value={campi.chiave} onChange={evento => scegliProdotto(evento.target.value)}>
                <option value="">Scegli un prodotto…</option>
                {filtrati.map(voce => (
                  <option key={voce.chiave} value={voce.chiave}>
                    {etichettaProdotto(voce)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField etichetta="Pagina" errore={errori.pagina}>
              <FormSelect value={campi.pagina} onChange={evento => aggiorna({ pagina: evento.target.value })}>
                {Array.from({ length: totale }, (_, indice) => indice + 1).map(numero => (
                  <option key={numero} value={String(numero)}>
                    {numero === 1 ? "1 (copertina)" : numero === totale ? `${numero} (ultima)` : String(numero)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField
              etichetta="Spazio (% della pagina)"
              errore={errori.spazio}
              aiuto={prodotto && prodotto.box.spazio > 0 ? `Attuale: ${percentuale(prodotto.box.spazio)}` : undefined}
            >
              <FormInput type="number" inputMode="decimal" min={0.5} max={100} step={0.5} value={campi.spazio} onChange={evento => aggiorna({ spazio: evento.target.value })} />
            </FormField>
            <FormField
              etichetta="Sconto (%)"
              errore={errori.sconto}
              aiuto={
                prodotto && prodotto.box.sconto !== null
                  ? `Attuale: ${percentuale(prodotto.box.sconto)}; vuoto: senza sconto`
                  : "Vuoto: senza sconto"
              }
            >
              <FormInput type="number" inputMode="decimal" min={0} max={99} step={1} value={campi.sconto} onChange={evento => aggiorna({ sconto: evento.target.value })} />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="sm" loading={richiesta !== null && simulazione.isFetching}>
              <Lucide icon="FlaskConical" aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Simula
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Zona: <span className="font-medium text-slate-700 dark:text-slate-200">{nomeZona(campi.zona, attuale?.centro ?? null)}</span> della pagina{" "}
              {formatNumero(paginaValida)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Dove metterlo</p>
          <ZonaPagina
            pagina={paginaValida}
            proporzione={proporzione}
            immagine={immagine}
            zona={campi.zona}
            onCambia={zona => aggiorna({ zona })}
            attuale={attuale}
            simulato={simulato}
          />
          <p className="max-w-[15rem] text-2xs text-slate-500 dark:text-slate-400">
            Scegli una delle nove zone: il box simulato si centra lì, grande quanto lo spazio indicato. Il tratteggio è la posizione attuale.
          </p>
        </div>
      </form>

      <div aria-live="polite" className="border-t border-dashed border-slate-200 pt-5 dark:border-darkmode-400">
        {richiesta === null ? (
          <Nota icona="MousePointerClick">Scegli il prodotto, la pagina, la zona, lo spazio e lo sconto, poi premi Simula.</Nota>
        ) : simulazione.isError ? (
          <PageError
            compatta
            titolo="Simulazione non riuscita"
            motivo={simulazione.error?.message || "Non è stato possibile simulare il prodotto."}
            onRiprova={() => simulazione.refetch()}
          />
        ) : !simulazione.data ? (
          <div aria-busy="true" className="space-y-3">
            <span className="sr-only" role="status">
              Simulazione in corso…
            </span>
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="space-y-3">
            {superata && <Nota icona="RefreshCw">Hai cambiato i valori: premi Simula per aggiornare la stima. Sotto, il risultato precedente.</Nota>}
            <Risultato simulazione={simulazione.data} richiesta={richiesta} />
          </div>
        )}
      </div>
    </div>
  );
}

export default SimulatoreProdotto;
