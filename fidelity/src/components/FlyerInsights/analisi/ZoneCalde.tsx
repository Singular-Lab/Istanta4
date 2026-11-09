import EmptyState from "@/components/EmptyState";
import { SERIE_PRINCIPALE } from "@/components/Grafici";
import { coperturaParziale, formatPercentuale, marcaFormato } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { useMemo } from "react";
import {
  PESI_VISIBILITA,
  type BoxInsight,
  type CoperturaDati,
  type QuotaVisibilita,
  type ZoneCalde as DatiZoneCalde,
} from "../../../../lib/insightVolantino/tipi";
import { BarreAppaiate, type VoceAppaiata } from "./BarreAppaiate";
import { BarraQuota, Blocco, Nota } from "./comuni";

/**
 * Scheda "Zone calde": dove cade l'occhio di chi sfoglia. La visibilita' e' una stima con pesi fissi
 * (PESI_VISIBILITA in lib/insightVolantino/tipi.ts), uguali per tutte le GDO: la scheda la dichiara e
 * ne scrive i pesi leggendoli dai dati, cosi' testo e calcolo non possono divergere.
 */

export interface ZoneCaldeProps {
  zoneCalde: DatiZoneCalde;
  /** I box del volantino, per nome, marca e pagina dei piu' visibili. */
  box: readonly BoxInsight[];
  /** Copertura dei dati (sintesi.copertura): senza posizioni la visibilita' non si stima. */
  copertura?: CoperturaDati;
}

/** I pesi in testo: "1", "0,7". */
const peso = (valore: number): string => formatNumero(valore);

/** La spiegazione della stima, con i pesi usati dal server. */
export const spiegazioneVisibilita = (pesi: typeof PESI_VISIBILITA = PESI_VISIBILITA): string =>
  [
    "La visibilità è una stima: spazio del box × peso della pagina × peso della posizione, con pesi fissi uguali per tutti i volantini.",
    `Pagina: copertina ${peso(pesi.copertina)}, pagine 2 e 3 ${peso(pesi.primaDoppia)}, ultima pagina ${peso(pesi.ultima)}, altre ${peso(pesi.altre)}.`,
    `Posizione: in cima ${peso(pesi.alto)}, in fondo ${peso(pesi.basso)}, in mezzo in proporzione.`,
    "100 è il box più visibile di questo volantino.",
  ].join(" ");

/** Dalla quota di visibilita' piu' alta. */
export const vociVisibilita = (quote: readonly QuotaVisibilita[]): VoceAppaiata[] =>
  [...quote]
    .sort((a, b) => b.quotaVisibilita - a.quotaVisibilita || a.etichetta.localeCompare(b.etichetta, "it"))
    .map(quota => ({ id: quota.chiave || quota.etichetta, etichetta: quota.etichetta, principale: quota.quotaVisibilita, confronto: quota.quotaSpazio }));

function BoxPiuVisibili({ elenco }: { elenco: readonly BoxInsight[] }) {
  return (
    <ol className="divide-y divide-slate-100 dark:divide-darkmode-400">
      {elenco.map((voce, i) => (
        <li key={voce.id} className="flex items-center gap-3 py-2 text-xs">
          <span aria-hidden="true" className="w-5 flex-none text-right font-semibold tabular-nums text-slate-400 dark:text-slate-500">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">{voce.nome}</span>
            <span className="block text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
              {[marcaFormato(voce), voce.pagina !== null ? `pagina ${formatNumero(voce.pagina)}` : null].filter(Boolean).join(" · ") || "—"}
            </span>
          </span>
          <span className="flex w-28 flex-none items-center gap-2 sm:w-40">
            <BarraQuota valore={voce.visibilita} massimo={100} classe={SERIE_PRINCIPALE.sfondo} />
            <span className="w-8 flex-none text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              <span className="sr-only">Visibilità </span>
              {formatNumero(Math.round(voce.visibilita))}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ZoneCalde({ zoneCalde, box, copertura }: ZoneCaldeProps) {
  const perId = useMemo(() => new Map(box.map(voce => [voce.id, voce])), [box]);
  const piuVisibili = useMemo(
    () => zoneCalde.boxPiuVisibili.map(id => perId.get(id)).filter((voce): voce is BoxInsight => voce !== undefined),
    [zoneCalde.boxPiuVisibili, perId]
  );
  const perReparto = useMemo(() => vociVisibilita(zoneCalde.perReparto), [zoneCalde.perReparto]);
  const perMarca = useMemo(() => vociVisibilita(zoneCalde.perMarca), [zoneCalde.perMarca]);
  const spiegazione = spiegazioneVisibilita(zoneCalde.pesi ?? PESI_VISIBILITA);

  if (piuVisibili.length === 0 && perReparto.length === 0 && perMarca.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <EmptyState
          compatta
          icon="Eye"
          title="Visibilità non stimabile"
          description="Servono le posizioni dei box nella pagina: per questo volantino non ci sono."
        />
        <Nota>{spiegazione}</Nota>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <Nota icona="Eye" className="rounded-control border border-dashed border-slate-200 px-3 py-2 dark:border-darkmode-400">
        {spiegazione}
      </Nota>

      <Blocco titolo="I box più visibili" descrizione="Visibilità stimata, da 0 a 100.">
        {piuVisibili.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nessun box con la posizione nella pagina.</p>
        ) : (
          <BoxPiuVisibili elenco={piuVisibili} />
        )}
      </Blocco>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Blocco titolo="Visibilità e spazio per reparto" descrizione="Quota della visibilità stimata accanto alla quota dello spazio.">
          {perReparto.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Reparti non disponibili.</p>
          ) : (
            <BarreAppaiate
              voci={perReparto}
              titolo="Visibilità e spazio per reparto"
              nomePrincipale="Quota di visibilità"
              nomeConfronto="Quota di spazio"
              testoEvidenza="più visibilità che spazio"
            />
          )}
        </Blocco>
        <Blocco titolo="Visibilità e spazio per marca" descrizione="Quota della visibilità stimata accanto alla quota dello spazio.">
          {perMarca.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nessuna marca riconosciuta.</p>
          ) : (
            <BarreAppaiate
              voci={perMarca}
              titolo="Visibilità e spazio per marca"
              nomePrincipale="Quota di visibilità"
              nomeConfronto="Quota di spazio"
              testoEvidenza="più visibilità che spazio"
            />
          )}
        </Blocco>
      </div>

      {copertura && coperturaParziale(copertura.geometria) && (
        <Nota>
          Dato parziale: la posizione nella pagina è nota per il {formatPercentuale(copertura.geometria, 0)} dei box; gli altri non entrano
          nella stima.
        </Nota>
      )}
    </div>
  );
}

export default ZoneCalde;
