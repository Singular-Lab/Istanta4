import Badge from "@/components/Base/Badge";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { annoDi, dataBreve, GraficoLinee, inizioAnno, MiniaturaPagina, msData, StrisciaNumeri, taccheTempo, type NumeroStriscia } from "@/components/Grafici";
import withSessionCheck from "@/components/SessionChecker";
import { useFetchPuntoVenditaConsultazione, useFetchReferenzaPuntoVendita } from "@/query/query";
import { formatNumero } from "@/utils/format";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ETICHETTA_MECCANICA, type DettaglioReferenzaPv } from "../../../lib/puntiVendita/analisi";
import type { CustomError } from "../../../lib/server_call";
import {
  ETICHETTA_FONTE,
  formatEuro,
  formatPercentuale,
  meseAnnoBreve,
  percorsoScheda,
  percorsoVolantino,
  periodoValidita,
  testoReferenze,
} from "./analisi";
import { FotoReferenza, NotaDato } from "./componenti";

/** Una riga di un elenco di dati: si mostra solo se c'è il valore. */
function Dato({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-slate-400">{etichetta}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{children}</dd>
    </>
  );
}

/** Prezzo in offerta grande, prezzo barrato, sconto e prezzo al kg come stampati. */
function Prezzi({ referenza }: { referenza: DettaglioReferenzaPv }) {
  if (referenza.prezzo === null && referenza.barrato === null) {
    return <p className="text-sm text-slate-500">Prezzo non stampato nell&apos;ultimo volantino.</p>;
  }
  return (
    <div aria-label="Prezzi" className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 tabular-nums">
      {referenza.prezzo !== null && <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100">{formatEuro(referenza.prezzo)}</span>}
      {referenza.barrato !== null && (
        <span className="text-base text-slate-500">
          <span className="sr-only">invece di </span>
          <s>{formatEuro(referenza.barrato)}</s>
        </span>
      )}
      {referenza.sconto !== null && (
        <Badge variant="info" size="sm">
          −{formatPercentuale(referenza.sconto)}
        </Badge>
      )}
      {referenza.prezzoAlKg && <span className="basis-full text-xs text-slate-500">{referenza.prezzoAlKg}</span>}
    </div>
  );
}

/** Dove sta la referenza nell'ultimo volantino che la contiene: miniatura della pagina e numeri. */
function NelVolantino({ idPv, referenza }: { idPv: string; referenza: DettaglioReferenzaPv }) {
  const { posizione } = referenza;
  if (!posizione) return null;
  return (
    <div>
      <p className="title-eyebrow mb-2">Nel volantino</p>
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
        <MiniaturaPagina
          titolo={`Posizione del box nella pagina ${posizione.pagina}`}
          proporzione={posizione.proporzione}
          boxes={[...posizione.altriBox.map(box => ({ ...box })), { ...posizione.box, evidenziato: true }]}
        />
        <div className="min-w-0">
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm tabular-nums">
            <Dato etichetta="Pagina">
              {formatNumero(posizione.pagina)} di {formatNumero(posizione.pagine)}
            </Dato>
            <Dato etichetta="Spazio">{formatPercentuale(posizione.spazio)} della pagina</Dato>
            <Dato etichetta="Box">con {testoReferenze(posizione.referenzeNelBox)}</Dato>
          </dl>
          <Link
            to={percorsoVolantino(idPv, posizione.idKit, posizione.pagina, referenza.chiave)}
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
          >
            Apri la pagina
            <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Codice, EAN, reparto e gli altri dati, con la fonte: DB1, Istanta o solo il testo stampato. */
function DatiReferenza({ referenza }: { referenza: DettaglioReferenzaPv }) {
  const { dati } = referenza;
  const voci: Array<[string, string | null]> = [
    ["EAN", dati.ean],
    ["Reparto", dati.reparto],
    ["Settore", dati.settore],
    ["Segmento", dati.segmento],
    ["Ruolo", dati.ruolo],
    ["Tema", dati.tema],
  ];
  return (
    <div>
      <p className="title-eyebrow mb-2 flex items-center gap-2">
        Dati della referenza
        <span
          data-fonte={dati.fonte}
          className="rounded-full border border-slate-200 px-1.5 text-2xs font-semibold normal-case tracking-normal text-slate-600 dark:border-darkmode-400 dark:text-slate-300"
        >
          <span className="sr-only">Fonte: </span>
          {ETICHETTA_FONTE[dati.fonte]}
        </span>
      </p>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm tabular-nums">
        <Dato etichetta="Codice">{dati.codice ?? "—"}</Dato>
        {voci.map(([etichetta, valore]) => valore && <Dato key={etichetta} etichetta={etichetta}>{valore}</Dato>)}
      </dl>
      {dati.fonte === "testo" && (
        <NotaDato>
          Riconosciuta dal testo stampato (nome, marca e formato): DB1 e Istanta non hanno mandato codice e reparto, quindi le presenze
          possono unire referenze simili.
        </NotaDato>
      )}
    </div>
  );
}

/** "Prezzo nel tempo": prezzo in offerta e prezzo barrato in ogni volantino, su un solo asse in euro. */
function PrezzoNelTempo({ referenza }: { referenza: DettaglioReferenzaPv }) {
  const presenze = [...referenza.presenze].filter(p => p.prezzo !== null || p.barrato !== null).sort((a, b) => a.dal.localeCompare(b.dal));
  if (presenze.length === 0) {
    return <EmptyState compatta icon="Euro" title="Nessun prezzo" description="Nei volantini di questo punto vendita la referenza non ha un prezzo stampato." />;
  }
  const date = presenze.map(p => msData(p.dal));
  const t0 = inizioAnno(annoDi(Math.min(...date)));
  const t1 = inizioAnno(annoDi(Math.max(...date)) + 1);
  return (
    <GraficoLinee
      serie={[
        {
          id: "offerta",
          nome: "Prezzo in offerta",
          tono: "principale",
          punti: presenze.map(p => ({
            x: msData(p.dal),
            y: p.prezzo,
            segnalato: p.sottocosto,
            dettagli: [
              { etichetta: "Volantino", valore: p.promo.nome },
              ...(p.prezzo !== null && p.barrato !== null && p.barrato > 0 ? [{ etichetta: "Sconto", valore: formatPercentuale(Math.round((1 - p.prezzo / p.barrato) * 100)) }] : []),
            ],
          })),
        },
        { id: "barrato", nome: "Prezzo barrato", tono: "secondaria", punti: presenze.map(p => ({ x: msData(p.dal), y: p.barrato })) },
      ]}
      titolo="Prezzo della referenza nel tempo"
      descrizioneX="Volantino"
      formattaX={dataBreve}
      formattaY={formatEuro}
      dominioX={[t0, t1]}
      taccheX={taccheTempo(t0, t1).map(t => ({ x: t.centro, etichetta: t.etichetta }))}
      etichettaSegnalati="Sottocosto"
      altezza={220}
    />
  );
}

/** "In quali volantini": le presenze, dalla più recente; ognuna apre il volantino alla pagina della referenza. */
function Presenze({ idPv, referenza }: { idPv: string; referenza: DettaglioReferenzaPv }) {
  const navigate = useNavigate();
  if (referenza.presenze.length === 0) {
    return <EmptyState compatta icon="FileSearch" title="Nessuna presenza" description="La referenza non compare nei volantini di questo punto vendita." />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Volantino</Table.Th>
            <Table.Th className="text-right">Pagina</Table.Th>
            <Table.Th className="text-right">Spazio</Table.Th>
            <Table.Th>Meccanica</Table.Th>
            <Table.Th className="text-right">Prezzo</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {referenza.presenze.map(presenza => {
            const percorso = percorsoVolantino(idPv, presenza.idKit, presenza.pagina, referenza.chiave);
            return (
              <Table.Tr key={`${presenza.idKit}-${presenza.pagina ?? ""}`} className="cursor-pointer" onClick={() => navigate(percorso)}>
                {/* Larga quanto un nome di promo come A2623_SC_30-10-26_SOS, che così sta su una riga */}
                <Table.Td className="min-w-56">
                  <Link
                    to={percorso}
                    onClick={evento => evento.stopPropagation()}
                    className="font-medium text-slate-800 [overflow-wrap:anywhere] hover:text-primary hover:underline dark:text-slate-200"
                  >
                    {presenza.promo.nome}
                  </Link>
                  <div className="text-xs text-slate-500">
                    <span className="block tabular-nums">{periodoValidita(presenza.dal, presenza.al)}</span>
                    {/* Le varianti per area della stessa promo hanno nome e periodo uguali: le distingue l'area */}
                    <span className="block">
                      {presenza.canale.nome} · {presenza.area.nome}
                    </span>
                  </div>
                </Table.Td>
                <Table.Td className="text-right tabular-nums">{presenza.pagina ?? "—"}</Table.Td>
                <Table.Td className="text-right tabular-nums">{presenza.spazio !== null ? formatPercentuale(presenza.spazio, 0) : "—"}</Table.Td>
                <Table.Td>
                  {presenza.meccanica ? ETICHETTA_MECCANICA[presenza.meccanica] : "—"}
                  {presenza.sottocosto && <div className="text-xs text-slate-500">sottocosto</div>}
                </Table.Td>
                <Table.Td className="whitespace-nowrap text-right tabular-nums">
                  {presenza.prezzo !== null ? <b className="font-bold">{formatEuro(presenza.prezzo)}</b> : "—"}
                  {presenza.barrato !== null && (
                    <s className="ml-1.5 text-xs text-slate-500">
                      <span className="sr-only">invece di </span>
                      {formatEuro(presenza.barrato)}
                    </s>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
}

/**
 * Una referenza nei volantini del punto vendita (/punti-vendita/:id/referenze/:chiave): foto,
 * prezzi dell'ultimo volantino, meccanica, posizione nella pagina, dati con la loro fonte, numeri,
 * prezzo nel tempo e presenze, ognuna apre il volantino alla sua pagina.
 */
function ReferenzaPuntoVendita() {
  const { id = "", chiave = "" } = useParams();
  const navigate = useNavigate();
  const query = useFetchReferenzaPuntoVendita(id, chiave);
  // Il percorso sta nel breadcrumb della barra in alto, che prende il nome del punto vendita da questa query
  useFetchPuntoVenditaConsultazione(id);
  const referenza = query.data;
  const indietro = { to: percorsoScheda(id), etichetta: "Torna al punto vendita" };

  if (query.isLoading) {
    return (
      <Pagina titolo="Referenza" indietro={indietro}>
        <div role="status" aria-label="Caricamento della referenza" className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <div className="flex flex-col gap-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </Pagina>
    );
  }

  if (query.isError || !referenza) {
    const nonTrovata = (query.error as CustomError | null)?.httpStatus === 404;
    return (
      <Pagina titolo="Referenza" indietro={indietro}>
        <Sezione>
          {nonTrovata ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Referenza non trovata"
              description="La referenza non compare nei volantini di questo punto vendita, o il punto vendita non è della tua GDO."
              buttonText="Torna al punto vendita"
              buttonIcon="ArrowLeft"
              onButtonClick={() => navigate(percorsoScheda(id))}
            />
          ) : (
            <PageError
              compatta
              titolo="Referenza non caricata"
              motivo={(query.error as Error | null)?.message || "Errore durante il recupero della referenza"}
              onRiprova={() => query.refetch()}
            />
          )}
        </Sezione>
      </Pagina>
    );
  }

  const { numeri } = referenza;
  const sopraIlMinimo = numeri.prezzoAttuale !== null && numeri.prezzoMinimo ? numeri.prezzoAttuale - numeri.prezzoMinimo.prezzo : null;
  // Solo i numeri che ci sono: senza prezzi stampati o con una presenza sola niente celle "N/D"
  const vociNumeri: NumeroStriscia[] = [
    {
      id: "volantini",
      valore: formatNumero(numeri.volantini),
      etichetta: "volantini di questo punto vendita",
      dettaglio: numeri.primoVolantino ? `dal ${meseAnnoBreve(numeri.primoVolantino)}` : undefined,
    },
    ...(numeri.prezzoMinimo
      ? [
          {
            id: "minimo",
            valore: formatEuro(numeri.prezzoMinimo.prezzo),
            etichetta: "prezzo più basso",
            dettaglio: `${meseAnnoBreve(numeri.prezzoMinimo.dal)}${numeri.prezzoMinimo.sottocosto ? ", sottocosto" : ""}`,
          },
        ]
      : []),
    ...(numeri.prezzoAttuale !== null
      ? [
          {
            id: "adesso",
            valore: formatEuro(numeri.prezzoAttuale),
            etichetta: "adesso",
            dettaglio: sopraIlMinimo === null ? undefined : sopraIlMinimo <= 0.005 ? "al prezzo più basso" : `${formatEuro(sopraIlMinimo)} sopra il minimo`,
          },
        ]
      : []),
    ...(numeri.giorniFraPresenze !== null
      ? [
          {
            id: "giorni",
            valore: `${formatNumero(Math.round(numeri.giorniFraPresenze))} gg`,
            etichetta: "fra due presenze",
            dettaglio: "in media",
          },
        ]
      : []),
  ];
  // Con un numero solo la striscia sarebbe un riquadro largo e quasi vuoto: il numero sta in una riga
  // sottile sotto i prezzi, nel riquadro della referenza; da due in su la striscia come nella scheda
  const numeriInRiga = vociNumeri.length < 2;

  return (
    <Pagina
      titolo={referenza.nome}
      indietro={indietro}
      descrizione={[referenza.marca, referenza.formato, referenza.tipo].filter(Boolean).join(" · ") || undefined}
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Sezione aria-label="La referenza">
          <div className="flex flex-col gap-5">
            <FotoReferenza key={referenza.foto[0] ?? ""} foto={referenza.foto[0]} nome={`Foto di ${referenza.nome}`} className="aspect-square w-full" />
            <Prezzi referenza={referenza} />
            {numeriInRiga && <StrisciaNumeri inRiga titolo="La referenza in numeri" voci={vociNumeri} />}
            {(referenza.meccanica || referenza.punti) && (
              <div className="flex flex-wrap gap-1.5">
                {referenza.meccanica && (
                  <Badge variant="secondary" size="sm">
                    <Lucide icon="Tag" aria-hidden="true" className="h-3 w-3" />
                    {ETICHETTA_MECCANICA[referenza.meccanica]}
                  </Badge>
                )}
                {referenza.punti && (
                  <Badge variant="secondary" size="sm">
                    <Lucide icon="Stamp" aria-hidden="true" className="h-3 w-3" />
                    {referenza.punti}
                  </Badge>
                )}
              </div>
            )}
            <NelVolantino idPv={id} referenza={referenza} />
            <DatiReferenza referenza={referenza} />
          </div>
        </Sezione>

        <div className="flex min-w-0 flex-col gap-6">
          {!numeriInRiga && <StrisciaNumeri titolo="La referenza in numeri" voci={vociNumeri} />}
          <Sezione titolo="Prezzo nel tempo" descrizione="Prezzo in offerta e prezzo barrato in ogni volantino del punto vendita.">
            <PrezzoNelTempo referenza={referenza} />
          </Sezione>
          <Sezione senzaPadding titolo="In quali volantini" descrizione="Dalla presenza più recente; ognuna apre il volantino alla pagina della referenza.">
            <Presenze idPv={id} referenza={referenza} />
          </Sezione>
        </div>
      </div>
    </Pagina>
  );
}

export default withSessionCheck(ReferenzaPuntoVendita);
