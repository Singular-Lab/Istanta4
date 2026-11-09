import EmptyState from "@/components/EmptyState";
import { BarreOrizzontali, Colonne, SERIE_PRINCIPALE, type VoceBarra } from "@/components/Grafici";
import { coperturaParziale, formatEuro, formatPercentuale, marcaFormato } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { useId, useMemo, useState } from "react";
import type {
  BoxInsight,
  CoperturaDati,
  FasciaSconto,
  PrezziSconti as DatiPrezziSconti,
  ScontoPerGruppo,
} from "../../../../lib/insightVolantino/tipi";
import { BarraQuota, Blocco, MostraTutte, Nota, RIGHE_INIZIALI } from "./comuni";

/**
 * Scheda "Prezzi e sconti": come si distribuiscono gli sconti, quanto sconta ogni reparto e ogni
 * meccanica, i box in sottocosto e quelli con il prezzo al kg. Per ogni GDO e per i kit di Istanta e
 * dello storico: i dati arrivano dalla lettura generica delle referenze (EstensioneInsight.prezziSconti).
 */

export interface PrezziScontiProps {
  prezziSconti: DatiPrezziSconti;
  /** I box del volantino, per i nomi dei box in sottocosto. */
  box: readonly BoxInsight[];
  /** Copertura dei dati (sintesi.copertura): sotto la soglia la scheda dice che il dato e' parziale. */
  copertura?: CoperturaDati;
}

/** "10–20%", "≥ 50%". */
export const etichettaFascia = (fascia: Pick<FasciaSconto, "da" | "a">): string =>
  fascia.a === null ? `≥ ${formatNumero(fascia.da)}%` : `${formatNumero(fascia.da)}–${formatNumero(fascia.a)}%`;

/** Le voci delle barre dello sconto medio: solo i gruppi con lo sconto, dal piu' alto. */
export const vociScontoMedio = (gruppi: readonly ScontoPerGruppo[]): VoceBarra[] =>
  gruppi
    .filter((gruppo): gruppo is ScontoPerGruppo & { scontoMedio: number } => gruppo.scontoMedio !== null)
    .sort((a, b) => b.scontoMedio - a.scontoMedio || a.etichetta.localeCompare(b.etichetta, "it"))
    .map(gruppo => ({
      id: gruppo.chiave || gruppo.etichetta,
      etichetta: gruppo.etichetta,
      valore: gruppo.scontoMedio,
      dettagli: [{ etichetta: "Box", valore: formatNumero(gruppo.box) }],
    }));

function FasceSconto({ fasce }: { fasce: readonly FasciaSconto[] }) {
  const conSconto = fasce.reduce((somma, fascia) => somma + fascia.box, 0);
  if (conSconto === 0) {
    return (
      <EmptyState
        compatta
        icon="Percent"
        title="Nessuno sconto calcolabile"
        description="Nessun box di questo volantino ha un prezzo barrato o uno sconto stampato."
      />
    );
  }
  return (
    <Colonne
      voci={fasce.map(fascia => ({
        id: `fascia-${fascia.da}`,
        etichetta: etichettaFascia(fascia),
        titolo: `Sconto ${etichettaFascia(fascia)}`,
        valore: fascia.box,
        dettagli: [{ etichetta: "Quota dei box con sconto", valore: formatPercentuale((fascia.box / conSconto) * 100) }],
      }))}
      titolo="Box per fascia di sconto"
      descrizioneValore="Box"
      descrizioneVoce="Fascia di sconto"
      altezza={140}
    />
  );
}

function Sottocosto({ idBox, box }: { idBox: readonly string[]; box: readonly BoxInsight[] }) {
  const [tutti, setTutti] = useState(false);
  const idElenco = useId();
  const perId = useMemo(() => new Map(box.map(voce => [voce.id, voce])), [box]);
  const elenco = idBox.map(id => perId.get(id)).filter((voce): voce is BoxInsight => voce !== undefined);

  if (elenco.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nessun box in sottocosto.</p>;
  }
  const visibili = tutti ? elenco : elenco.slice(0, RIGHE_INIZIALI);
  return (
    <div className="space-y-2">
      <ul id={idElenco} className="divide-y divide-slate-100 dark:divide-darkmode-400">
        {visibili.map(voce => (
          <li key={voce.id} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
            <span className="min-w-0">
              <span className="block font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">{voce.nome}</span>
              {marcaFormato(voce) && <span className="block text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{marcaFormato(voce)}</span>}
            </span>
            <span className="flex-none text-right tabular-nums text-slate-600 dark:text-slate-300">
              <span className="block font-semibold text-slate-800 dark:text-slate-100">{formatEuro(voce.prezzo)}</span>
              {voce.pagina !== null && <span className="block text-slate-500 dark:text-slate-400">pagina {formatNumero(voce.pagina)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <MostraTutte totale={elenco.length} aperto={tutti} onCambia={setTutti} controlla={idElenco} />
    </div>
  );
}

function PrezzoAlKg({ conPrezzo, totale }: { conPrezzo: number; totale: number }) {
  const quota = totale > 0 ? (conPrezzo / totale) * 100 : null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        <b className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatNumero(conPrezzo)}</b> box su{" "}
        {formatNumero(totale)}
        {quota !== null && <span className="text-slate-500 dark:text-slate-400"> ({formatPercentuale(quota)})</span>}
      </p>
      {quota !== null && (
        <div className="flex items-center">
          <BarraQuota valore={quota} massimo={100} classe={SERIE_PRINCIPALE.sfondo} />
        </div>
      )}
    </div>
  );
}

export function PrezziSconti({ prezziSconti, box, copertura }: PrezziScontiProps) {
  const perReparto = useMemo(() => vociScontoMedio(prezziSconti.perReparto), [prezziSconti.perReparto]);
  const perMeccanica = useMemo(() => vociScontoMedio(prezziSconti.perMeccanica), [prezziSconti.perMeccanica]);
  const prezzoParziale = copertura !== undefined && box.length > 0 && coperturaParziale(copertura.prezzo);

  return (
    <div className="space-y-6 p-4">
      <Blocco titolo="Fasce di sconto" descrizione="Quanti box hanno lo sconto in ciascuna fascia.">
        <FasceSconto fasce={prezziSconti.fasce} />
      </Blocco>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Blocco titolo="Sconto medio per reparto" descrizione="Media degli sconti dei box del reparto che ne hanno uno.">
          <BarreOrizzontali
            voci={perReparto}
            titolo="Sconto medio per reparto"
            descrizioneValore="Sconto medio"
            formatta={valore => formatPercentuale(valore)}
            vuoto="Nessun reparto con uno sconto calcolabile."
          />
        </Blocco>
        <Blocco titolo="Sconto medio per meccanica" descrizione="Media degli sconti dei box di ogni meccanica.">
          <BarreOrizzontali
            voci={perMeccanica}
            titolo="Sconto medio per meccanica"
            descrizioneValore="Sconto medio"
            formatta={valore => formatPercentuale(valore)}
            vuoto="Nessuna meccanica con uno sconto calcolabile."
          />
        </Blocco>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Blocco
          titolo="Sottocosto"
          descrizione={`${formatNumero(prezziSconti.sottocosto.length)} ${prezziSconti.sottocosto.length === 1 ? "box venduto" : "box venduti"} sotto il costo.`}
        >
          <Sottocosto idBox={prezziSconti.sottocosto} box={box} />
        </Blocco>
        <Blocco titolo="Prezzo al kg o al litro" descrizione="Box con il prezzo al kg o al litro stampato o nei dati.">
          <PrezzoAlKg conPrezzo={prezziSconti.conPrezzoAlKg} totale={box.length} />
        </Blocco>
      </div>

      {prezzoParziale && copertura && (
        <Nota>
          Dato parziale: il prezzo c&apos;è nel {formatPercentuale(copertura.prezzo, 0)} dei box, quindi fasce e sconti medi valgono su quelli.
        </Nota>
      )}
    </div>
  );
}

export default PrezziSconti;
