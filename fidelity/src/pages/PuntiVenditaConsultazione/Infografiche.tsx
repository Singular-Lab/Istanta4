import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { BarreOrizzontali, ForbicePrezzo, StrisciaNumeri, StrisciaPresenze, TINTA_NEUTRA, type NumeroStriscia } from "@/components/Grafici";
import { formatData, formatNumero } from "@/utils/format";
import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AnalisiPuntoVendita } from "../../../lib/puntiVendita/analisi";
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
  type ContestoPeriodo,
  type InfograficaScheda,
} from "./analisi";
import { FotoReferenza, NotaDato, StatoBox, type QueryBox } from "./componenti";

/**
 * Le infografiche della scheda del punto vendita (contratto in lib/puntiVendita/analisi.ts), tutte
 * del periodo scelto (ContestoPeriodo): numeri e reparti col periodo prima, e prodotti che tornano.
 * Niente griglie colorate per intensità, e niente meccaniche ("Come si promuove") né marche più
 * presenti: le ha escluse l'utente. Reparti e sconto si calcolano qui dai numeri di ogni volantino
 * della timeline; prodotti e copertura arrivano dal server per il periodo. Ogni riquadro ha il suo
 * caricamento e il suo errore e dice quando il dato è parziale.
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
