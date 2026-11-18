import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { Logo, testoSuColore } from "@/components/FlyerInsights/analisi/MarchiDistributore";
import { BarreOrizzontali, ForbicePrezzo, Legenda, SERIE_PRINCIPALE, StrisciaNumeri, StrisciaPresenze, TINTA_NEUTRA, TINTA_PRINCIPALE, type NumeroStriscia } from "@/components/Grafici";
import { formatData, formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ETICHETTA_MECCANICA, MECCANICHE, type AnalisiPuntoVendita } from "../../../lib/puntiVendita/analisi";
import {
  coperturaParziale,
  edizioniDelPeriodo,
  formatDifferenza,
  formatDifferenzaPunti,
  formatEuro,
  formatPercentuale,
  giorniCoperti,
  INFOGRAFICHE_SCHEDA,
  marcaFormato,
  notaDifferenza,
  percorsoReferenza,
  repartiInBarre,
  sintesiPeriodo,
  tintaMeccanica,
  type ContestoPeriodo,
  type InfograficaScheda,
} from "./analisi";
import { FotoReferenza, NotaDato, StatoBox, type QueryBox } from "./componenti";

/**
 * Le infografiche della scheda del punto vendita (contratto in lib/puntiVendita/analisi.ts), tutte
 * del periodo scelto (ContestoPeriodo): numeri, meccaniche e reparti col periodo prima, marche e
 * prodotti che tornano. Niente griglie colorate per intensità: le ha escluse l'utente. Meccaniche, reparti e sconto si calcolano qui dai
 * numeri di ogni volantino della timeline; marche, prodotti e copertura arrivano dal server per il
 * periodo. Ogni riquadro ha il suo caricamento e il suo errore e dice quando il dato è parziale.
 */

type Analisi = QueryBox<AnalisiPuntoVendita>;

/** I volantini del periodo e di quello prima, con le loro sintesi. */
const datiDelPeriodo = (dati: AnalisiPuntoVendita, contesto: ContestoPeriodo) => {
  const edizioni = edizioniDelPeriodo(dati.timeline, contesto.giorni);
  const prima = contesto.precedente ? edizioniDelPeriodo(dati.timeline, contesto.precedente) : [];
  return { edizioni, sintesi: sintesiPeriodo(edizioni), sintesiPrima: prima.length > 0 ? sintesiPeriodo(prima) : null };
};

/**
 * La striscia dei numeri del periodo in testa alla scheda. Senza volantini non c'è: la storia spiega
 * da dove arrivano; un numero che non si può calcolare (lo sconto senza prezzi barrati) non ha la
 * sua cella. Le differenze sono col periodo prima, quando ha volantini.
 */
export function NumeriScheda({ analisi, contesto }: { analisi: Analisi; contesto: ContestoPeriodo }) {
  if (analisi.isLoading || analisi.isError || !analisi.data) {
    // L'errore lo mostra il riquadro della storia, che dipende dagli stessi dati
    return analisi.isLoading ? <StrisciaNumeri titolo="Il punto vendita in numeri" voci={[]} loading vociAttese={5} /> : null;
  }
  const dati = analisi.data;
  const { edizioni, sintesi, sintesiPrima } = datiDelPeriodo(dati, contesto);
  if (edizioni.length === 0) return null;
  const assenti = edizioniDelPeriodo(dati.assenze, contesto.giorni).length;
  const attivi = edizioni.filter(e => e.attivo).length;
  const copertura = giorniCoperti(dati.timeline, contesto.giorni, contesto.oggi);
  const rispetto = contesto.confronto?.rispetto;
  const voci: NumeroStriscia[] = [
    {
      id: "volantini",
      valore: formatNumero(edizioni.length),
      etichetta: `volantini ${contesto.nome}`,
      dettaglio: [
        attivi > 0 ? `${formatNumero(attivi)} ${attivi === 1 ? "attivo" : "attivi"} adesso` : null,
        assenti > 0 ? `assente da ${formatNumero(assenti)} su ${formatNumero(edizioni.length + assenti)} della sua insegna e area` : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    },
    ...(copertura
      ? [
          {
            id: "giorni",
            valore: formatPercentuale(Math.round(copertura.quota)),
            etichetta: "dei giorni con un volantino valido",
            dettaglio: copertura.scoperti === 0 ? "nessun giorno senza volantino" : `${formatNumero(copertura.scoperti)} ${copertura.scoperti === 1 ? "giorno" : "giorni"} senza volantino`,
          },
        ]
      : []),
    {
      id: "referenze",
      valore: formatNumero(Math.round(sintesi.mediaReferenze ?? 0)),
      etichetta: "referenze per volantino",
      dettaglio:
        sintesiPrima?.mediaReferenze != null && rispetto
          ? `${formatDifferenza((sintesi.mediaReferenze ?? 0) - sintesiPrima.mediaReferenze)} ${rispetto}`
          : `${formatNumero(sintesi.referenze)} in tutto`,
    },
    ...(sintesi.scontoMedio !== null
      ? [
          {
            id: "sconto",
            valore: formatPercentuale(sintesi.scontoMedio),
            etichetta: "sconto medio",
            dettaglio: sintesiPrima?.scontoMedio != null && rispetto ? `${formatDifferenzaPunti(sintesi.scontoMedio - sintesiPrima.scontoMedio)} ${rispetto}` : undefined,
          },
        ]
      : []),
    {
      id: "prodotti",
      valore: formatNumero(dati.numeri.prodotti),
      etichetta: "prodotti diversi",
      dettaglio: dati.numeri.prodottiFrequenti > 0 ? `${formatNumero(dati.numeri.prodottiFrequenti)} presenti in più di 10 volantini` : undefined,
    },
  ];
  return <StrisciaNumeri titolo="Il punto vendita in numeri" voci={voci} />;
}

/**
 * Le infografiche che non hanno dati non diventano un riquadro vuoto per grafico: una riga sola
 * dice quali mancano e perché, e i riquadri con i dati si allargano senza lasciare buchi.
 */
export function GraficiSenzaDati({ assenti }: { assenti: readonly InfograficaScheda[] }) {
  const voci = INFOGRAFICHE_SCHEDA.filter(voce => assenti.includes(voce.id));
  if (voci.length === 0) return null;
  return (
    <aside
      aria-label="Grafici senza dati"
      className="flex gap-2 rounded-card border border-dashed border-slate-300 px-4 py-2.5 text-xs text-slate-600 dark:border-darkmode-400 dark:text-slate-300"
    >
      <Lucide icon="Info" aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none text-slate-500 dark:text-slate-400" />
      <p>
        <span className="font-medium">Senza grafico per mancanza di dati nei volantini del periodo:</span>{" "}
        {voci.map((voce, i) => (
          <Fragment key={voce.id}>
            {i > 0 && "; "}
            <b className="font-semibold text-slate-700 dark:text-slate-200">{voce.titolo}</b> ({voce.senzaDati})
          </Fragment>
        ))}
        .
      </p>
    </aside>
  );
}

const descrizioneConfronto = (contesto: ContestoPeriodo, conPrima: boolean) =>
  conPrima && contesto.confronto ? ` Il segno verticale è il valore ${contesto.confronto.nel}.` : "";

/** "Come si promuove": la quota delle referenze per meccanica nel periodo, col periodo prima. */
export function ComeSiPromuove({ analisi, contesto }: { analisi: Analisi; contesto: ContestoPeriodo }) {
  const conPrima = analisi.data ? datiDelPeriodo(analisi.data, contesto).sintesiPrima !== null : false;
  return (
    <Sezione titolo="Come si promuove" descrizione={`Quota delle referenze per meccanica ${contesto.nome}.${descrizioneConfronto(contesto, conPrima)}`}>
      <StatoBox
        query={analisi}
        titoloErrore="Meccaniche non caricate"
        vuoto={dati =>
          datiDelPeriodo(dati, contesto).sintesi.meccaniche.size === 0 ? (
            <EmptyState compatta icon="Tags" title="Meccaniche non riconosciute" description="Le referenze dei volantini non dicono con quale meccanica sono promosse." />
          ) : null
        }
      >
        {dati => {
          const { sintesi, sintesiPrima } = datiDelPeriodo(dati, contesto);
          const voci = MECCANICHE.filter(m => sintesi.meccaniche.has(m))
            .map(m => {
              const valore = sintesi.meccaniche.get(m) ?? 0;
              const prima = sintesiPrima ? (sintesiPrima.meccaniche.get(m) ?? 0) : null;
              return { id: m, etichetta: ETICHETTA_MECCANICA[m], valore, tinta: tintaMeccanica(m), riferimento: prima, nota: notaDifferenza(valore, prima) };
            })
            .sort((a, b) => b.valore - a.valore);
          return (
            <BarreOrizzontali
              voci={voci}
              titolo="Meccaniche del periodo"
              descrizioneValore="Quota delle referenze"
              formatta={v => formatPercentuale(v)}
              nomeRiferimento={contesto.confronto?.nel}
            />
          );
        }}
      </StatoBox>
    </Sezione>
  );
}

/** "Spazio per reparto": la quota dello spazio dei box per reparto nel periodo, col periodo prima. */
export function SpazioPerReparto({ analisi, contesto }: { analisi: Analisi; contesto: ContestoPeriodo }) {
  const conPrima = analisi.data ? datiDelPeriodo(analisi.data, contesto).sintesiPrima !== null : false;
  return (
    <Sezione titolo="Spazio per reparto" descrizione={`Superficie dei box per reparto, sul totale, ${contesto.nome}.${descrizioneConfronto(contesto, conPrima)}`}>
      <StatoBox
        query={analisi}
        titoloErrore="Reparti non caricati"
        vuoto={dati =>
          datiDelPeriodo(dati, contesto).sintesi.reparti.length === 0 ? (
            <EmptyState
              compatta
              icon="LayoutGrid"
              title="Reparti non disponibili"
              description="Il reparto arriva da DB1 o da Istanta con i dati della referenza: per i volantini di questo periodo non c'è."
            />
          ) : null
        }
      >
        {dati => {
          const { sintesi, sintesiPrima } = datiDelPeriodo(dati, contesto);
          // I più grandi e gli altri in una barra sola, neutra: una lista lunga non si legge
          const voci = repartiInBarre(sintesi.reparti, sintesiPrima?.reparti ?? null).map(({ reparto, quota, prima, altri }) => ({
            id: reparto,
            etichetta: reparto,
            valore: quota,
            riferimento: prima,
            nota: notaDifferenza(quota, prima),
            ...(altri ? { tinta: TINTA_NEUTRA } : {}),
          }));
          return (
            <>
              <BarreOrizzontali
                voci={voci}
                titolo="Spazio per reparto"
                descrizioneValore="Spazio dei box"
                formatta={v => formatPercentuale(v)}
                nomeRiferimento={contesto.confronto?.nel}
              />
              {coperturaParziale(dati.copertura.conReparto) && (
                <NotaDato>
                  <b className="font-semibold text-slate-600 dark:text-slate-300">Dato parziale.</b> Il reparto arriva da DB1, nei campi della
                  referenza, e c&apos;è solo per il {formatPercentuale(dati.copertura.conReparto, 0)} delle referenze del periodo: le quote valgono per quelle.
                </NotaDato>
              )}
            </>
          );
        }}
      </StatoBox>
    </Sezione>
  );
}

/** "in 18 su 26 volantini": i volantini del periodo in cui compare la marca. */
const testoVolantiniMarca = (volantini: number, delPeriodo: number): string =>
  `in ${formatNumero(volantini)} su ${formatNumero(delPeriodo)} ${delPeriodo === 1 ? "volantino" : "volantini"}`;

/** Le Private Labels (linee del distributore) contro le altre marche, in una barra sola, come negli insight del volantino. */
function QuotaLineeDistributore({ quota }: { quota: number }) {
  const linee = Math.max(0, Math.min(100, quota));
  const altre = Math.round((100 - linee) * 10) / 10;
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        <b className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatPercentuale(linee)}</b> delle referenze con marca sono
        delle Private Labels
      </p>
      <div
        role="img"
        aria-label={`Private Labels ${formatPercentuale(linee)} delle referenze con marca, altre marche ${formatPercentuale(altre)}`}
        className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400"
      >
        <div className={twMerge("h-full", SERIE_PRINCIPALE.sfondo)} style={{ width: `${linee}%` }} />
      </div>
      <Legenda
        voci={[
          { id: "linee", etichetta: `Private Labels ${formatPercentuale(linee)}`, forma: "quadrato", tinta: TINTA_PRINCIPALE },
          { id: "altre", etichetta: `Altre marche ${formatPercentuale(altre)}`, forma: "quadrato", tinta: TINTA_NEUTRA },
        ]}
      />
    </div>
  );
}

/**
 * Una marca come le linee negli insight del volantino: il logo della linea del distributore o le
 * iniziali (nel colore della linea, o neutre), il nome intero, la quota, i volantini e una barra
 * rispetto alla marca più presente, nel colore della linea.
 */
function SchedaMarca({ marca, massimo, volantiniDelPeriodo }: { marca: AnalisiPuntoVendita["marche"][number]; massimo: number; volantiniDelPeriodo: number }) {
  const larghezza = massimo > 0 ? Math.max(0, Math.min(100, (marca.quota / massimo) * 100)) : 0;
  const coloreLinea = marca.linea && testoSuColore(marca.linea.colore) !== null ? marca.linea.colore : null;
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-control border border-slate-200 bg-white p-3 dark:border-darkmode-400 dark:bg-darkmode-600">
      <Logo
        key={marca.linea?.logo ?? ""}
        url={marca.linea?.logo ?? null}
        nome={marca.linea?.nome ?? marca.marca}
        sigla=""
        colore={marca.linea?.colore}
        misura="grande"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{marca.marca}</p>
        {marca.linea && <p className="text-xs text-slate-500 dark:text-slate-400">Private Label {marca.linea.nome}</p>}
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          <b className="font-semibold text-slate-700 dark:text-slate-200">{formatPercentuale(marca.quota)}</b> delle referenze ·{" "}
          {testoVolantiniMarca(marca.volantini, volantiniDelPeriodo)}
        </p>
        {/* Rispetto alla marca più presente: le barre delle schede si confrontano fra loro */}
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
          <div
            className={twMerge("h-full rounded-full", !coloreLinea && SERIE_PRINCIPALE.sfondo)}
            style={{ width: `${larghezza}%`, ...(coloreLinea ? { backgroundColor: coloreLinea } : {}) }}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * "Marche più presenti": le 8 marche con più referenze nel periodo come schede, come le linee del
 * distributore negli insight del volantino; con le linee dichiarate dalla libreria agenzia, il loro
 * logo e colore e la quota delle linee del distributore su tutte le marche.
 */
export function MarchePiuPresenti({ analisi, contesto }: { analisi: Analisi; contesto: ContestoPeriodo }) {
  return (
    <Sezione titolo="Marche più presenti" descrizione={`Quota delle referenze con la marca ${contesto.nome}, dalla marca più presente.`}>
      <StatoBox
        query={analisi}
        titoloErrore="Marche non caricate"
        vuoto={dati =>
          dati.marche.length === 0 ? (
            <EmptyState compatta icon="Award" title="Nessuna marca riconosciuta" description="Le referenze di questi volantini non hanno la marca." />
          ) : null
        }
      >
        {dati => {
          const massimo = Math.max(0, ...dati.marche.map(marca => marca.quota));
          const volantiniDelPeriodo = edizioniDelPeriodo(dati.timeline, contesto.giorni).length;
          return (
            <div className="space-y-5">
              {dati.lineeDistributore && <QuotaLineeDistributore quota={dati.lineeDistributore.quota} />}
              <ul aria-label="Marche più presenti" className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
                {dati.marche.map(marca => (
                  <SchedaMarca key={marca.marca} marca={marca} massimo={massimo} volantiniDelPeriodo={volantiniDelPeriodo} />
                ))}
              </ul>
              {coperturaParziale(dati.copertura.conMarca) && (
                <NotaDato>Dato parziale: la marca è nota per il {formatPercentuale(dati.copertura.conMarca, 0)} delle referenze.</NotaDato>
              )}
            </div>
          );
        }}
      </StatoBox>
    </Sezione>
  );
}

/**
 * "Prodotti che tornano": i prodotti in almeno 2 volantini del periodo, con la loro presenza
 * volantino per volantino e la forbice del prezzo in offerta; ogni riga apre la referenza.
 */
export function ProdottiCheTornano({ idPv, analisi, contesto }: { idPv: string; analisi: Analisi; contesto: ContestoPeriodo }) {
  const navigate = useNavigate();
  const prodotti = analisi.data?.numeri.prodotti;
  return (
    <Sezione
      senzaPadding
      titolo="Prodotti che tornano"
      descrizione={`I prodotti in almeno 2 volantini ${contesto.nome}, dai più presenti${prodotti ? `, su ${formatNumero(prodotti)} prodotti diversi` : ""}. Ogni tacca è un volantino del periodo: piena se il prodotto c'era.`}
    >
      <div className="px-5 pb-5">
        <StatoBox
          query={analisi}
          titoloErrore="Prodotti non caricati"
          vuoto={dati =>
            dati.prodottiRicorrenti.length === 0 ? (
              <EmptyState compatta icon="PackageSearch" title="Nessun prodotto che torna" description="Nessun prodotto compare in almeno 2 volantini del periodo." />
            ) : null
          }
        >
          {dati => {
            const edizioni = edizioniDelPeriodo(dati.timeline, contesto.giorni);
            const volantini = edizioni.map(e => ({ id: e.idKit, etichetta: `${e.promo.nome} · ${formatData(e.dal)}` }));
            const inizio = new Map(dati.timeline.map(e => [e.idKit, e.dal]));
            return (
              <div className="-mx-5 overflow-x-auto">
                <Table sm>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th className="pl-5">Prodotto</Table.Th>
                      <Table.Th className="text-right">Volantini</Table.Th>
                      <Table.Th>Presenza nel periodo</Table.Th>
                      <Table.Th>Prezzo in offerta</Table.Th>
                      <Table.Th className="pr-5 text-right">Ultima volta</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dati.prodottiRicorrenti.map(prodotto => {
                      const percorso = percorsoReferenza(idPv, prodotto.chiave);
                      const ultimo = prodotto.kit.length > 0 ? inizio.get(prodotto.kit[prodotto.kit.length - 1]) : undefined;
                      const forbice =
                        prodotto.prezzoMinimo === null
                          ? "—"
                          : prodotto.prezzoMassimo === null || prodotto.prezzoMassimo === prodotto.prezzoMinimo
                            ? formatEuro(prodotto.prezzoMinimo)
                            : `${formatEuro(prodotto.prezzoMinimo)} – ${formatEuro(prodotto.prezzoMassimo)}`;
                      return (
                        <Table.Tr key={prodotto.chiave} className="cursor-pointer" onClick={() => navigate(percorso)}>
                          <Table.Td className="min-w-48 pl-5">
                            <div className="flex items-center gap-3">
                              <FotoReferenza foto={prodotto.foto} nome={prodotto.nome} className="h-9 w-9" />
                              <div className="min-w-0">
                                <Link
                                  to={percorso}
                                  onClick={evento => evento.stopPropagation()}
                                  className="font-medium text-slate-800 [overflow-wrap:anywhere] hover:text-primary hover:underline dark:text-slate-200"
                                >
                                  {prodotto.nome}
                                </Link>
                                {marcaFormato(prodotto) && <div className="text-xs text-slate-500 [overflow-wrap:anywhere]">{marcaFormato(prodotto)}</div>}
                              </div>
                            </div>
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap text-right tabular-nums dark:text-slate-200">
                            <b className="font-semibold">{formatNumero(prodotto.volantini)}</b>
                            <span className="text-xs text-slate-500"> su {formatNumero(edizioni.length)}</span>
                          </Table.Td>
                          <Table.Td>
                            <StrisciaPresenze volantini={volantini} presenti={new Set(prodotto.kit)} titolo={prodotto.nome} />
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap">
                            <div className="flex items-center gap-3 tabular-nums dark:text-slate-200">
                              <ForbicePrezzo minimo={prodotto.prezzoMinimo} massimo={prodotto.prezzoMassimo} ultimo={prodotto.prezzoUltimo} formatta={formatEuro} />
                              <span>{forbice}</span>
                            </div>
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap pr-5 text-right tabular-nums dark:text-slate-200">{ultimo ? formatData(ultimo) : "—"}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
                <NotaDato className="mx-5">Il punto pieno della forbice è il prezzo nell&apos;ultimo volantino che lo ha, fra il più basso e il più alto del periodo.</NotaDato>
              </div>
            );
          }}
        </StatoBox>
      </div>
    </Sezione>
  );
}
