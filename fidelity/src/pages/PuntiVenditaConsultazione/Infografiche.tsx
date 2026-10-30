import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { BarreImpilate100, BarreOrizzontali, GraficoLinee, Heatmap, MiniBarre, StrisciaNumeri, type NumeroStriscia } from "@/components/Grafici";
import { formatNumero } from "@/utils/format";
import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ETICHETTA_MECCANICA, MECCANICHE, type AnalisiPuntoVendita } from "../../../lib/puntiVendita/analisi";
import {
  coperturaParziale,
  formatDifferenzaPunti,
  formatEuro,
  formatPercentuale,
  infograficheConDati,
  INFOGRAFICHE_SCHEDA,
  marcaFormato,
  meseAnnoBreve,
  percorsoReferenza,
  repartiImpilati,
  type InfograficaScheda,
} from "./analisi";
import { NotaDato, StatoBox, type QueryBox } from "./componenti";

/**
 * Le infografiche della scheda del punto vendita (contratto in lib/puntiVendita/analisi.ts):
 * numeri, meccaniche, sconto medio, marche, prodotti che tornano e reparti. Ogni riquadro ha il suo
 * caricamento, il suo errore e dice quando il dato è parziale.
 */

type Analisi = QueryBox<AnalisiPuntoVendita>;

const intervalloAnni = (anni: readonly number[]): string => {
  if (anni.length === 0) return "";
  const ordinati = [...anni].sort((a, b) => a - b);
  return ordinati[0] === ordinati[ordinati.length - 1] ? String(ordinati[0]) : `${ordinati[0]}–${ordinati[ordinati.length - 1]}`;
};

/**
 * La striscia dei numeri in testa alla scheda. Senza volantini non c'è: la storia spiega da dove
 * arrivano; un numero che non si può calcolare (lo sconto senza prezzi barrati) non ha la sua cella.
 */
export function NumeriScheda({ analisi }: { analisi: Analisi }) {
  if (analisi.isLoading || analisi.isError || !analisi.data) {
    // L'errore lo mostra il riquadro della storia, che dipende dagli stessi dati
    return analisi.isLoading ? <StrisciaNumeri titolo="Il punto vendita in numeri" voci={[]} loading vociAttese={5} /> : null;
  }
  const { numeri, timeline, scontoPerAnno } = analisi.data;
  if (timeline.length === 0) return null;
  const primo = timeline[0];
  const primoAnno = [...scontoPerAnno].sort((a, b) => a.anno - b.anno).find(a => a.sconto !== null);
  const voci: NumeroStriscia[] = [
    {
      id: "volantini",
      valore: formatNumero(numeri.volantini),
      etichetta: `volantini dal ${meseAnnoBreve(primo.dal)}`,
      dettaglio: numeri.volantiniAttivi === 0 ? "nessuno attivo adesso" : `${formatNumero(numeri.volantiniAttivi)} ${numeri.volantiniAttivi === 1 ? "attivo" : "attivi"} adesso`,
    },
    {
      id: "referenze",
      valore: formatNumero(numeri.referenze),
      etichetta: "referenze promosse",
      dettaglio: numeri.mediaReferenze !== null ? `${formatNumero(Math.round(numeri.mediaReferenze))} per volantino in media` : undefined,
    },
    {
      id: "prodotti",
      valore: formatNumero(numeri.prodotti),
      etichetta: "prodotti diversi",
      dettaglio: numeri.prodottiFrequenti > 0 ? `${formatNumero(numeri.prodottiFrequenti)} presenti in più di 10 volantini` : undefined,
    },
    ...(numeri.scontoMedio !== null
      ? [
          {
            id: "sconto",
            valore: formatPercentuale(numeri.scontoMedio),
            etichetta: "sconto medio",
            dettaglio:
              numeri.scontoMedioPrimoAnno !== null && primoAnno
                ? `${formatDifferenzaPunti(numeri.scontoMedio - numeri.scontoMedioPrimoAnno)} dal ${primoAnno.anno}`
                : undefined,
          },
        ]
      : []),
    ...(numeri.insegne.length > 0
      ? [
          {
            id: "insegne",
            valore: formatNumero(numeri.insegne.length),
            etichetta: numeri.insegne.length === 1 ? "insegna nel tempo" : "insegne nel tempo",
            dettaglio: numeri.insegne.map(i => i.nome).join(" → "),
          },
        ]
      : []),
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
        <span className="font-medium">Senza grafico per mancanza di dati nei volantini:</span>{" "}
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

/** "Come si promuove": quota delle referenze per meccanica, anno per anno. */
export function ComeSiPromuove({ analisi }: { analisi: Analisi }) {
  return (
    <Sezione titolo="Come si promuove" descrizione="Quota delle referenze per meccanica, anno per anno.">
      <StatoBox
        query={analisi}
        titoloErrore="Meccaniche non caricate"
        vuoto={dati =>
          !infograficheConDati(dati).meccaniche ? (
            <EmptyState compatta icon="Tags" title="Meccaniche non riconosciute" description="Le referenze dei volantini non dicono con quale meccanica sono promosse." />
          ) : null
        }
      >
        {dati => {
          const anni = [...dati.anni].sort((a, b) => a - b);
          const righe = MECCANICHE.map(m => dati.meccaniche.find(r => r.meccanica === m)).filter(r => r !== undefined);
          return (
            <Heatmap
              righe={righe.map(r => ({ id: r.meccanica, etichetta: ETICHETTA_MECCANICA[r.meccanica] }))}
              colonne={anni.map(a => ({ id: String(a), etichetta: String(a) }))}
              valori={righe.map(r => anni.map(a => r.anni.find(q => q.anno === a)?.quota ?? null))}
              titolo="Meccaniche per anno"
              descrizioneValore="Quota delle referenze"
              formatta={v => formatPercentuale(Math.round(v))}
            />
          );
        }}
      </StatoBox>
    </Sezione>
  );
}

/** "Sconto medio": una linea, anno per anno, sulle referenze con il prezzo barrato. */
export function ScontoMedio({ analisi }: { analisi: Analisi }) {
  return (
    <Sezione titolo="Sconto medio" descrizione="Sulle referenze con il prezzo barrato, anno per anno.">
      <StatoBox
        query={analisi}
        titoloErrore="Sconto medio non caricato"
        vuoto={dati =>
          !infograficheConDati(dati).sconto ? (
            <EmptyState compatta icon="Percent" title="Nessuno sconto calcolabile" description="Nessuna referenza di questi volantini ha il prezzo barrato." />
          ) : null
        }
      >
        {dati => (
          <>
            <GraficoLinee
              serie={[{ id: "sconto", nome: "Sconto medio", punti: [...dati.scontoPerAnno].sort((a, b) => a.anno - b.anno).map(a => ({ x: a.anno, y: a.sconto })) }]}
              titolo="Sconto medio per anno"
              descrizioneX="Anno"
              formattaX={String}
              formattaY={v => formatPercentuale(v)}
              area
              altezza={170}
            />
            {coperturaParziale(dati.copertura.conPrezzo) && (
              <NotaDato>
                Dato parziale: solo il {formatPercentuale(dati.copertura.conPrezzo, 0)} delle referenze ha il prezzo, quindi lo sconto si calcola su quelle.
              </NotaDato>
            )}
          </>
        )}
      </StatoBox>
    </Sezione>
  );
}

/** "Marche più presenti": le 8 marche con più referenze. */
export function MarchePiuPresenti({ analisi }: { analisi: Analisi }) {
  // Senza anni (dati in arrivo o nessun volantino) la frase si chiude senza il periodo
  const periodo = intervalloAnni(analisi.data?.anni ?? []);
  return (
    <Sezione titolo="Marche più presenti" descrizione={`Quota delle referenze con la marca${periodo ? `, ${periodo}` : ""}.`}>
      <StatoBox
        query={analisi}
        titoloErrore="Marche non caricate"
        vuoto={dati =>
          !infograficheConDati(dati).marche ? (
            <EmptyState compatta icon="Award" title="Nessuna marca riconosciuta" description="Le referenze di questi volantini non hanno la marca." />
          ) : null
        }
      >
        {dati => (
          <>
            <BarreOrizzontali
              voci={dati.marche.map(m => ({ id: m.marca, etichetta: m.marca, valore: m.quota }))}
              titolo="Marche più presenti"
              descrizioneValore="Quota delle referenze"
              formatta={v => formatPercentuale(v)}
            />
            {coperturaParziale(dati.copertura.conMarca) && (
              <NotaDato>Dato parziale: la marca è nota per il {formatPercentuale(dati.copertura.conMarca, 0)} delle referenze.</NotaDato>
            )}
          </>
        )}
      </StatoBox>
    </Sezione>
  );
}

/** "Prodotti che tornano": i prodotti più presenti, con la presenza anno per anno; ogni riga apre la referenza. */
export function ProdottiCheTornano({ idPv, analisi }: { idPv: string; analisi: Analisi }) {
  const navigate = useNavigate();
  return (
    <Sezione
      senzaPadding
      titolo="Prodotti che tornano"
      descrizione={`I più presenti nei volantini del punto vendita${analisi.data?.numeri.prodotti ? `, su ${formatNumero(analisi.data.numeri.prodotti)} prodotti diversi` : ""}.`}
    >
      <div className="px-5 pb-5">
        <StatoBox
          query={analisi}
          titoloErrore="Prodotti non caricati"
          vuoto={dati =>
            !infograficheConDati(dati).prodotti ? (
              <EmptyState compatta icon="PackageSearch" title="Nessun prodotto ricorrente" description="Nessun prodotto compare in più di un volantino di questo punto vendita." />
            ) : null
          }
        >
          {dati => {
            const anni = [...dati.anni].sort((a, b) => a - b);
            const massimo = Math.max(1, ...dati.prodottiRicorrenti.flatMap(p => p.perAnno.map(a => a.volantini)));
            // Le barre per anno larghe quanto servono: con due anni la colonna resta stretta e il nome ha spazio
            const larghezzaBarre = Math.max(40, Math.min(132, anni.length * 18 + 4));
            return (
              <div className="-mx-5 overflow-x-auto">
                <Table sm>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th className="pl-5">Prodotto</Table.Th>
                      <Table.Th className="text-right">Volantini</Table.Th>
                      <Table.Th>{intervalloAnni(anni).replace("–", " → ")}</Table.Th>
                      <Table.Th className="pr-5 text-right">In offerta</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dati.prodottiRicorrenti.map(prodotto => {
                      const percorso = percorsoReferenza(idPv, prodotto.chiave);
                      const conMassimo = prodotto.prezzoMassimo !== null && prodotto.prezzoMassimo !== prodotto.prezzoMinimo;
                      return (
                        <Table.Tr key={prodotto.chiave} className="cursor-pointer" onClick={() => navigate(percorso)}>
                          <Table.Td className="min-w-40 pl-5">
                            <Link
                              to={percorso}
                              onClick={evento => evento.stopPropagation()}
                              className="font-medium text-slate-800 [overflow-wrap:anywhere] hover:text-primary hover:underline dark:text-slate-200"
                            >
                              {prodotto.nome}
                            </Link>
                            {marcaFormato(prodotto) && <div className="text-xs text-slate-500 [overflow-wrap:anywhere]">{marcaFormato(prodotto)}</div>}
                          </Table.Td>
                          <Table.Td className="text-right font-semibold tabular-nums dark:text-slate-200">{formatNumero(prodotto.volantini)}</Table.Td>
                          <Table.Td>
                            <MiniBarre
                              valori={anni.map(a => ({ etichetta: String(a), valore: prodotto.perAnno.find(p => p.anno === a)?.volantini ?? 0 }))}
                              massimo={massimo}
                              descrizioneValore="Volantini per anno"
                              larghezza={larghezzaBarre}
                            />
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap pr-5 text-right tabular-nums dark:text-slate-200">
                            {prodotto.prezzoMinimo === null ? (
                              "—"
                            ) : (
                              <>
                                <span className="block font-medium">{formatEuro(prodotto.prezzoMinimo)}</span>
                                {conMassimo && <span className="block text-xs text-slate-500">fino a {formatEuro(prodotto.prezzoMassimo)}</span>}
                              </>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>
            );
          }}
        </StatoBox>
      </div>
    </Sezione>
  );
}

/** "Dove sta nel volantino": lo spazio di pagina per reparto, anno per anno. */
export function DoveStaNelVolantino({ analisi }: { analisi: Analisi }) {
  return (
    <Sezione titolo="Dove sta nel volantino" descrizione="Spazio di pagina per reparto, in percentuale della superficie dei box.">
      <StatoBox
        query={analisi}
        titoloErrore="Reparti non caricati"
        vuoto={dati =>
          !infograficheConDati(dati).reparti ? (
            <EmptyState
              compatta
              icon="LayoutGrid"
              title="Reparti non disponibili"
              description="Il reparto arriva da DB1 o da Istanta con i dati della referenza: per i volantini di questo punto vendita non c'è."
            />
          ) : null
        }
      >
        {dati => {
          const { righe, categorie, valori } = repartiImpilati(dati.reparti);
          return (
            <>
              <BarreImpilate100
                righe={righe}
                categorie={categorie}
                valori={valori}
                titolo="Spazio di pagina per reparto"
                descrizioneValore="Spazio di pagina"
              />
              {coperturaParziale(dati.copertura.conReparto) && (
                <NotaDato>
                  <b className="font-semibold text-slate-600 dark:text-slate-300">Dato parziale.</b> Il reparto arriva da DB1, nei campi della
                  referenza, e c&apos;è solo per il {formatPercentuale(dati.copertura.conReparto, 0)} delle referenze: le quote valgono per quelle.
                </NotaDato>
              )}
            </>
          );
        }}
      </StatoBox>
    </Sezione>
  );
}
