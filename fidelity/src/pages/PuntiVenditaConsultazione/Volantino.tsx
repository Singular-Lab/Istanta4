import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { BarreOrizzontali, Colonne, Legenda, MiniaturaPagina, PaginaVolantino, StrisciaNumeri, type BoxPagina, type Tinta } from "@/components/Grafici";
import withSessionCheck from "@/components/SessionChecker";
import { useFetchPuntoVenditaConsultazione, useFetchVolantinoPuntoVendita } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ETICHETTA_MECCANICA, type BoxVolantino, type DettaglioVolantinoPv, type PaginaVolantino as PaginaDelVolantino } from "../../../lib/puntiVendita/analisi";
import type { CustomError } from "../../../lib/server_call";
import { GIORNI_SCADENZA_VICINA, giorniAllaScadenza, testoScadenza } from "../VolantiniKit/scadenza";
import {
  coperturaParziale,
  etichettaBox,
  ETICHETTA_ABBINAMENTO,
  formatDifferenzaPunti,
  formatEuro,
  formatPercentuale,
  legendaPagina,
  marcaFormato,
  OPZIONI_COLORE_PAGINA,
  PARAMETRO_PAGINA,
  PARAMETRO_REFERENZA,
  PARAMETRO_VOLANTINO,
  percorsoReferenza,
  percorsoScheda,
  percorsoVolantino,
  periodoValidita,
  testoReferenze,
  tintaBox,
  tinteReparti,
  useTinteCanali,
  type ColorePagina,
} from "./analisi";
import { FotoReferenza, NotaDato, PuntoInsegna, RigaStampata } from "./componenti";
import { nomePdfVolantino, urlPdfVolantino } from "./storia";

const PROPORZIONE_A4 = 210 / 297;

const descrizioneColore: Record<ColorePagina, string> = {
  sconto: "colorati per sconto",
  meccanica: "colorati per meccanica",
  reparto: "colorati per reparto",
};

/** Il box nella pagina disegnata: colore, etichetta, nome accessibile e tooltip. */
const boxDisegnato = (box: BoxVolantino, modo: ColorePagina, reparti: Map<string, Tinta>): BoxPagina => {
  const pilota = box.referenze[0];
  const nome = pilota ? [pilota.nome, pilota.marca].filter(Boolean).join(" · ") : "Box senza referenze";
  const dettagli = [
    ...(pilota?.prezzo != null ? [{ etichetta: "Prezzo", valore: formatEuro(pilota.prezzo) }] : []),
    ...(box.sconto !== null ? [{ etichetta: "Sconto", valore: formatPercentuale(box.sconto) }] : []),
    ...(box.meccanica ? [{ etichetta: "Meccanica", valore: ETICHETTA_MECCANICA[box.meccanica] }] : []),
    ...(box.reparto ? [{ etichetta: "Reparto", valore: box.reparto }] : []),
    { etichetta: "Spazio", valore: `${formatPercentuale(box.spazio)} della pagina` },
    ...(box.referenze.length > 1 ? [{ etichetta: "Referenze nel box", valore: formatNumero(box.referenze.length) }] : []),
  ];
  return {
    id: box.id,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    tinta: tintaBox(box, modo, reparti),
    etichetta: etichettaBox(box, modo),
    descrizione: [nome, box.sconto !== null ? `sconto ${formatPercentuale(box.sconto)}` : null, `${formatPercentuale(box.spazio)} della pagina`].filter(Boolean).join(", "),
    tooltip: { titolo: pilota?.nome ?? "Box senza referenze", sottotitolo: pilota ? marcaFormato(pilota) || undefined : undefined, righe: dettagli },
    disattivato: !pilota,
  };
};

/** La striscia delle pagine: una miniatura per pagina, la pagina mostrata segnata. */
function StrisciaPagine({
  dati,
  numeroPagine,
  corrente,
  modo,
  reparti,
  onPagina,
}: {
  dati: DettaglioVolantinoPv;
  numeroPagine: number;
  corrente: number;
  modo: ColorePagina;
  reparti: Map<string, Tinta>;
  onPagina: (numero: number) => void;
}) {
  const proporzione = dati.pagine[0]?.proporzione ?? PROPORZIONE_A4;
  return (
    <nav aria-label="Pagine del volantino" className="box box--stacked p-2.5">
      <p className="title-eyebrow px-1 pb-2">Pagine</p>
      <ol className="flex gap-2 overflow-x-auto pb-1 xl:max-h-[46rem] xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden">
        {Array.from({ length: numeroPagine }, (_, i) => {
          const numero = i + 1;
          const pagina = dati.pagine.find(p => p.numero === numero);
          const referenze = pagina?.boxes.reduce((somma, box) => somma + box.referenze.length, 0) ?? 0;
          const attuale = numero === corrente;
          return (
            <li key={numero} className="w-20 flex-none xl:w-full">
              <button
                type="button"
                aria-current={attuale ? "page" : undefined}
                aria-label={`Pagina ${numero}, ${testoReferenze(referenze)}`}
                onClick={() => onPagina(numero)}
                className={twMerge(
                  "flex w-full flex-col gap-1 rounded-control border border-slate-200 bg-white p-1.5 text-left transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:border-darkmode-400 dark:bg-darkmode-600",
                  attuale && "border-theme-1 ring-1 ring-theme-1 dark:border-indigo-300 dark:ring-indigo-300"
                )}
              >
                <MiniaturaPagina
                  proporzione={pagina?.proporzione ?? proporzione}
                  boxes={(pagina?.boxes ?? []).map(box => ({ x: box.x, y: box.y, w: box.w, h: box.h, tinta: tintaBox(box, modo, reparti) }))}
                />
                <span className="flex justify-between text-2xs text-slate-500 dark:text-slate-400">
                  <b className="font-semibold text-slate-700 dark:text-slate-200">{numero}</b>
                  <span className="tabular-nums">{referenze > 0 ? `${formatNumero(referenze)} ref.` : "—"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Le referenze della pagina, dal box più grande al più piccolo: ognuna apre la sua scheda. */
function ReferenzeDellaPagina({ idPv, pagina, evidenziata }: { idPv: string; pagina: PaginaDelVolantino; evidenziata: string | null }) {
  const voci = [...pagina.boxes]
    .sort((a, b) => b.spazio - a.spazio)
    .flatMap(box => box.referenze.map(referenza => ({ box, referenza })));
  if (voci.length === 0) {
    return <EmptyState compatta icon="PackageSearch" title="Nessuna referenza" description="In questa pagina non ci sono box con referenze." />;
  }
  return (
    <ul aria-label="Referenze della pagina" className="-my-2 divide-y divide-slate-100 dark:divide-darkmode-400">
      {voci.map(({ box, referenza }) => (
        <li key={`${box.id}-${referenza.chiave}`}>
          <Link
            to={percorsoReferenza(idPv, referenza.chiave)}
            aria-current={referenza.chiave === evidenziata ? "true" : undefined}
            className="group grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5"
          >
            <FotoReferenza key={referenza.foto ?? ""} foto={referenza.foto} nome="" className="h-11 w-11" />
            <span className="min-w-0">
              {/* Nomi lunghi su due righe al massimo, interi nel title */}
              <span
                title={referenza.nome}
                className="line-clamp-2 text-sm font-semibold text-slate-800 [overflow-wrap:anywhere] group-hover:text-primary group-aria-[current=true]:text-primary dark:text-slate-100"
              >
                {referenza.nome}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {[marcaFormato(referenza), `${formatPercentuale(box.spazio, 0)} della pagina`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="text-right tabular-nums">
              {referenza.prezzo !== null && <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{formatEuro(referenza.prezzo)}</span>}
              {referenza.sconto !== null && <span className="block text-xs text-slate-500">−{formatPercentuale(referenza.sconto, 0)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Come il volantino stampa il punto vendita, fra le righe vicine della stessa provincia. */
function PuntoVenditaNelVolantino({ riga }: { riga: DettaglioVolantinoPv["rigaPuntoVendita"] }) {
  if (!riga) {
    return (
      <EmptyState
        compatta
        icon="ListX"
        title="Riga non trovata"
        description="Il punto vendita è nella storia di questo volantino, ma la sua riga della lista non è arrivata."
      />
    );
  }
  const luogo = [riga.regione, riga.provincia && `Provincia di ${riga.provincia}`].filter(Boolean).join(" · ");
  const vicine = riga.vicine.length > 0 ? riga.vicine : [{ riga: riga.riga, questo: true }];
  return (
    <div>
      {luogo && <p className="title-eyebrow mb-2">{luogo}</p>}
      <ul aria-label="Lista dei punti vendita stampata" className="flex flex-col gap-1.5">
        {vicine.map((voce, i) =>
          voce.questo ? (
            <li key={`${i}-${voce.riga}`} aria-current="true" className="flex flex-wrap items-center gap-2">
              <RigaStampata evidenziata>{voce.riga}</RigaStampata>
              <StatusBadge
                tono={riga.abbinamento === "probabile" ? "warning" : "success"}
                etichetta={`Questo punto vendita · ${ETICHETTA_ABBINAMENTO[riga.abbinamento]}`}
              />
            </li>
          ) : (
            <li key={`${i}-${voce.riga}`} className="break-words px-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
              {voce.riga}
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function Scadenza({ al }: { al: string | null }) {
  const giorni = giorniAllaScadenza(al);
  if (giorni === null) return null;
  const tono = giorni < 0 ? "neutral" : giorni <= GIORNI_SCADENZA_VICINA ? "warning" : "success";
  return <StatusBadge tono={tono} etichetta={testoScadenza(giorni)} icon="CalendarClock" />;
}

/**
 * Un volantino nella storia del punto vendita (/punti-vendita/:id/volantini/:idKit): numeri, pagine,
 * la pagina con i box al loro posto (colorati per sconto, meccanica o reparto), le referenze della
 * pagina, lo spazio per meccanica e la riga con cui il volantino stampa il punto vendita.
 * La pagina mostrata sta nell'indirizzo (?pagina=), come la referenza da evidenziare (?referenza=).
 */
function VolantinoPuntoVendita() {
  const { id = "", idKit = "" } = useParams();
  const navigate = useNavigate();
  const [parametri, setParametri] = useSearchParams();
  const [modo, setModo] = useState<ColorePagina>("sconto");
  const query = useFetchVolantinoPuntoVendita(id, idKit);
  // Il percorso sta nel breadcrumb della barra in alto, che prende il nome del punto vendita da questa query
  useFetchPuntoVenditaConsultazione(id);
  const dati = query.data;
  const canali = useMemo(() => (dati ? [dati.canale] : []), [dati]);
  const tinta = useTinteCanali(canali);
  const reparti = useMemo(() => tinteReparti(dati?.pagine.flatMap(p => p.boxes) ?? []), [dati]);

  // Tornando alla scheda il volantino resta quello scelto nella timeline
  const scheda = `${percorsoScheda(id)}?${new URLSearchParams({ [PARAMETRO_VOLANTINO]: idKit })}`;
  const indietro = { to: scheda, etichetta: "Torna al punto vendita" };

  if (query.isLoading) {
    return (
      <Pagina titolo="Volantino" indietro={indietro}>
        <StrisciaNumeri titolo="Il volantino in numeri" voci={[]} loading vociAttese={5} />
        <Sezione>
          <div role="status" aria-label="Caricamento del volantino" className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <Skeleton className="h-96" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        </Sezione>
      </Pagina>
    );
  }

  if (query.isError || !dati) {
    const nonTrovato = (query.error as CustomError | null)?.httpStatus === 404;
    return (
      <Pagina titolo="Volantino" indietro={indietro}>
        <Sezione>
          {nonTrovato ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Volantino non trovato"
              description="Il volantino non esiste, non è nella storia di questo punto vendita o non è della tua GDO."
              buttonText="Torna al punto vendita"
              buttonIcon="ArrowLeft"
              onButtonClick={() => navigate(scheda)}
            />
          ) : (
            <PageError
              compatta
              titolo="Volantino non caricato"
              motivo={(query.error as Error | null)?.message || "Errore durante il recupero del volantino"}
              onRiprova={() => query.refetch()}
            />
          )}
        </Sezione>
      </Pagina>
    );
  }

  // Volantini importati solo con la lista dei punti vendita (export senza le pagine): niente da disegnare
  const conPagine = dati.pagine.length > 0;
  const numeroPagine = Math.max(1, dati.numeri.pagine, ...dati.pagine.map(p => p.numero));
  const richiesta = Number(parametri.get(PARAMETRO_PAGINA));
  const primaConBox = dati.pagine.find(p => p.boxes.length > 0)?.numero ?? 1;
  const numeroPagina = Number.isInteger(richiesta) && richiesta >= 1 && richiesta <= numeroPagine ? richiesta : primaConBox;
  const pagina: PaginaDelVolantino = dati.pagine.find(p => p.numero === numeroPagina) ?? {
    numero: numeroPagina,
    proporzione: dati.pagine[0]?.proporzione ?? PROPORZIONE_A4,
    boxes: [],
  };
  const referenzaEvidenziata = parametri.get(PARAMETRO_REFERENZA);
  const boxEvidenziato = referenzaEvidenziata ? (pagina.boxes.find(b => b.referenze.some(r => r.chiave === referenzaEvidenziata))?.id ?? null) : null;
  const conAltriReparti = dati.pagine.some(p => p.boxes.some(b => b.reparto && !reparti.has(b.reparto)));

  const vaiAPagina = (numero: number) =>
    setParametri(
      attuali => {
        const nuovi = new URLSearchParams(attuali);
        nuovi.set(PARAMETRO_PAGINA, String(numero));
        nuovi.delete(PARAMETRO_REFERENZA);
        return nuovi;
      },
      { replace: true }
    );

  const { numeri } = dati;
  const titolo = dati.promo.nome;

  return (
    <Pagina
      titolo={titolo}
      indietro={indietro}
      descrizione={
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          <span className="tabular-nums">Validità: {periodoValidita(dati.promo.validitaDal, dati.promo.validitaAl)}</span>
          {dati.kit.titolo && dati.kit.titolo !== titolo && <span>{dati.kit.titolo}</span>}
        </span>
      }
      badges={
        <>
          <Badge variant="secondary" size="sm">
            <PuntoInsegna tinta={tinta(dati.canale.id)} />
            {dati.canale.nome}
          </Badge>
          <Badge variant="secondary" size="sm">
            <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3" />
            {dati.area.nome}
          </Badge>
          <Scadenza al={dati.promo.validitaAl} />
        </>
      }
      azioni={
        <>
          {dati.precedente ? (
            <Button as={Link} to={percorsoVolantino(id, dati.precedente.idKit)} variant="outline-secondary">
              <Lucide icon="ChevronLeft" aria-hidden="true" className="mr-1 h-4 w-4" />
              Precedente
            </Button>
          ) : (
            <Button type="button" variant="outline-secondary" disabled>
              <Lucide icon="ChevronLeft" aria-hidden="true" className="mr-1 h-4 w-4" />
              Precedente
            </Button>
          )}
          {dati.successivo ? (
            <Button as={Link} to={percorsoVolantino(id, dati.successivo.idKit)} variant="outline-secondary">
              Successivo
              <Lucide icon="ChevronRight" aria-hidden="true" className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" variant="outline-secondary" disabled>
              Successivo
              <Lucide icon="ChevronRight" aria-hidden="true" className="ml-1 h-4 w-4" />
            </Button>
          )}
          {dati.pdf && (
            <Button as="a" href={urlPdfVolantino(dati.pdf.idOlimpoCloud)} download={nomePdfVolantino(dati.pdf.nome, titolo)} variant="primary">
              <Lucide icon="Download" aria-hidden="true" className="mr-2 h-4 w-4" />
              Scarica PDF
            </Button>
          )}
        </>
      }
    >
      <StrisciaNumeri
        titolo="Il volantino in numeri"
        voci={[
          // Senza pagine importate "0 pagine" non direbbe niente: la cella non c'è
          ...(numeri.pagine > 0 ? [{ id: "pagine", valore: formatNumero(numeri.pagine), etichetta: "pagine" }] : []),
          {
            id: "referenze",
            valore: formatNumero(numeri.referenze),
            etichetta: "referenze",
            dettaglio:
              numeri.daListino === null
                ? undefined
                : !numeri.manuali
                  ? "tutte dal listino DB1"
                  : `${formatNumero(numeri.daListino)} dal listino DB1, ${formatNumero(numeri.manuali)} compilate a mano`,
          },
          {
            id: "sconto",
            valore: numeri.scontoMedio !== null ? formatPercentuale(numeri.scontoMedio) : null,
            etichetta: "sconto medio",
            dettaglio:
              numeri.scontoMedio !== null && numeri.scontoMedioPrecedente !== null
                ? `${formatDifferenzaPunti(numeri.scontoMedio - numeri.scontoMedioPrecedente)} sul precedente`
                : undefined,
          },
          { id: "fidelity", valore: formatNumero(numeri.fidelity), etichetta: "in Fidelity", dettaglio: "prezzo con la carta" },
          {
            id: "lista",
            valore: formatNumero(numeri.puntiVenditaInLista),
            etichetta: "punti vendita nella lista",
            dettaglio: `${formatNumero(numeri.puntiVenditaAbbinati)} riconosciuti in anagrafica`,
          },
        ]}
      />

      {!conPagine ? (
        // Arrivati la lista dei punti vendita e le referenze ma non le pagine: un riquadro solo lo
        // dice, al posto della pagina vuota, delle miniature e dei grafici per pagina
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Sezione titolo="Pagine del volantino">
            <EmptyState
              compatta
              icon="FileX"
              title="Pagine non disponibili"
              description="Di questo volantino sono arrivate le referenze e la lista dei punti vendita, ma non le pagine con la posizione dei box: la pagina disegnata e lo spazio per meccanica non si possono mostrare."
            />
          </Sezione>
          <Sezione titolo="Il punto vendita in questo volantino" descrizione="Com'è stampato nella lista dei punti vendita, fra quelli vicini.">
            <PuntoVenditaNelVolantino riga={dati.rigaPuntoVendita} />
          </Sezione>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[7.5rem_minmax(0,1fr)_22rem]">
            <StrisciaPagine dati={dati} numeroPagine={numeroPagine} corrente={numeroPagina} modo={modo} reparti={reparti} onPagina={vaiAPagina} />

            <Sezione
              titolo={`Pagina ${numeroPagina}`}
              descrizione={`I box sono al loro posto, ${descrizioneColore[modo]}. Passa sopra un box per la referenza; clicca per aprirla.`}
            >
              {/* Il colore dei box sopra la pagina, non accanto al titolo: nella colonna stretta schiaccerebbe la descrizione */}
              <Segmenti etichetta="Colore dei box" opzioni={OPZIONI_COLORE_PAGINA} valore={modo} onChange={setModo} className="mb-4" />
              <div className="mx-auto max-w-xl">
                <PaginaVolantino
                  proporzione={pagina.proporzione}
                  boxes={pagina.boxes.map(box => boxDisegnato(box, modo, reparti))}
                  selezionato={boxEvidenziato}
                  onSeleziona={idBox => {
                    const pilota = pagina.boxes.find(b => b.id === idBox)?.referenze[0];
                    if (pilota) navigate(percorsoReferenza(id, pilota.chiave));
                  }}
                  titolo={`Pagina ${numeroPagina} del volantino con i box`}
                  vuota="Nessun box in questa pagina"
                />
              </div>
              <Legenda
                titolo={modo === "sconto" ? "Sconto del box" : modo === "meccanica" ? "Meccanica" : "Reparto"}
                voci={legendaPagina(modo, reparti, conAltriReparti)}
                className="mt-4"
              />
              {modo === "reparto" && coperturaParziale(dati.copertura.conReparto) && (
                <NotaDato>Dato parziale: il reparto arriva da DB1 o da Istanta ed è noto per il {formatPercentuale(dati.copertura.conReparto, 0)} delle referenze.</NotaDato>
              )}
              {modo === "sconto" && coperturaParziale(dati.copertura.conPrezzo) && (
                <NotaDato>Dato parziale: lo sconto si calcola dal prezzo barrato, che c&apos;è per il {formatPercentuale(dati.copertura.conPrezzo, 0)} delle referenze.</NotaDato>
              )}
            </Sezione>

            <div className="flex min-w-0 flex-col gap-6">
              <Sezione compatta titolo="Referenze della pagina" descrizione="Dalla più grande alla più piccola.">
                <ReferenzeDellaPagina idPv={id} pagina={pagina} evidenziata={referenzaEvidenziata} />
              </Sezione>
              <Sezione compatta titolo="Referenze per pagina" descrizione={`Le ${formatNumero(numeroPagine)} pagine del volantino; clicca per aprirne una.`}>
                <Colonne
                  voci={Array.from({ length: numeroPagine }, (_, i) => {
                    const numero = i + 1;
                    const boxes = dati.pagine.find(p => p.numero === numero)?.boxes ?? [];
                    return { id: String(numero), etichetta: String(numero), titolo: `Pagina ${numero}`, valore: boxes.reduce((s, b) => s + b.referenze.length, 0) };
                  })}
                  titolo="Referenze per pagina"
                  descrizioneValore="Referenze"
                  descrizioneVoce="Pagina"
                  evidenziata={String(numeroPagina)}
                  onSeleziona={numero => vaiAPagina(Number(numero))}
                  altezza={90}
                />
              </Sezione>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Sezione titolo="Spazio per meccanica" descrizione="Quanta superficie dei box va a ogni meccanica.">
              {dati.meccaniche.length > 0 ? (
                <BarreOrizzontali
                  voci={[...dati.meccaniche].sort((a, b) => b.spazio - a.spazio).map(m => ({ id: m.meccanica, etichetta: ETICHETTA_MECCANICA[m.meccanica], valore: m.spazio }))}
                  titolo="Spazio per meccanica"
                  descrizioneValore="Spazio dei box"
                  formatta={v => formatPercentuale(v)}
                />
              ) : (
                <EmptyState compatta icon="Tags" title="Meccaniche non riconosciute" description="I box di questo volantino non dicono con quale meccanica sono promossi." />
              )}
            </Sezione>
            <Sezione titolo="Il punto vendita in questo volantino" descrizione="Com'è stampato nella lista dei punti vendita, fra quelli vicini.">
              <PuntoVenditaNelVolantino riga={dati.rigaPuntoVendita} />
            </Sezione>
          </div>
        </>
      )}
    </Pagina>
  );
}

export default withSessionCheck(VolantinoPuntoVendita);
