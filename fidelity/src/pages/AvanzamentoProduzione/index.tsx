import Button from "@/components/Base/Button";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import type { TonoStato } from "@/constants/stati";
import { usePermission } from "@/context/PermissionContext";
import { useFetchAvanzamentoProduzione } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import type { PromoAvanzamento } from "../../../lib/produzione/avanzamento";
import { COLONNE_PROMO, RigaPromo } from "./ElencoPromo";
import {
  chiaveRiferimento,
  ELEMENTI_DA_GUARDARE,
  FILTRI_VUOTI,
  kitVisibili,
  opzioniFiltri,
  promoVisibili,
  type FiltriAvanzamento,
  type FiltroTipo,
  type IdElemento,
} from "./modello";

/** Pallino del tono, come in StatusBadge. */
const PALLINO: Readonly<Record<TonoStato, string>> = {
  neutral: "bg-slate-400",
  info: "bg-sky-500",
  brand: "bg-theme-1",
  success: "bg-teal-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

interface TesseraProps {
  numero: number;
  etichetta: string;
  descrizione: string;
  tono: TonoStato;
  scelta: boolean;
  onScegli: () => void;
}

/** Un elemento da guardare: il numero è anche il filtro dell'elenco. */
function Tessera({ numero, etichetta, descrizione, tono, scelta, onScegli }: TesseraProps) {
  return (
    <button
      type="button"
      aria-pressed={scelta}
      onClick={onScegli}
      className={twMerge(
        "flex h-full w-full flex-col items-start gap-1 rounded-control border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 motion-reduce:transition-none dark:border-darkmode-400 dark:bg-darkmode-600 dark:hover:bg-darkmode-400/40",
        scelta && "border-theme-1/50 bg-theme-1/5 ring-1 ring-theme-1/30 hover:border-theme-1/50 hover:bg-theme-1/5 dark:bg-darkmode-400/60"
      )}
    >
      <span
        className={twMerge(
          "text-2xl font-semibold leading-tight tabular-nums text-slate-800 dark:text-slate-100",
          numero === 0 && "text-slate-400 dark:text-slate-500"
        )}
      >
        {formatNumero(numero)}
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span aria-hidden="true" className={twMerge("h-2 w-2 flex-none rounded-full", PALLINO[tono])} />
        {etichetta}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{descrizione}</span>
    </button>
  );
}

function InCaricamento() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Caricamento dell'avanzamento della produzione…</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, indice) => (
          <Skeleton key={indice} className={twMerge("h-24 rounded-control", indice === 4 && "col-span-2 lg:col-span-1")} />
        ))}
      </div>
      <Sezione>
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, indice) => (
            <Skeleton key={indice} className="h-12" />
          ))}
        </div>
      </Sezione>
    </div>
  );
}

interface FiltriProps {
  promozioni: PromoAvanzamento[];
  filtri: FiltriAvanzamento;
  onChange: (filtri: FiltriAvanzamento) => void;
}

function Filtri({ promozioni, filtri, onChange }: FiltriProps) {
  const { aree, canali } = useMemo(() => opzioniFiltri(promozioni), [promozioni]);
  const conta = (tipo: FiltroTipo) =>
    promozioni.reduce((totale, promo) => totale + kitVisibili(promo, { ...filtri, tipo }).length, 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmenti
        etichetta="Tipo di kit"
        valore={filtri.tipo}
        onChange={(tipo) => onChange({ ...filtri, tipo })}
        opzioni={[
          { valore: "tutti", etichetta: "Tutti", conteggio: conta("tutti") },
          { valore: "VOL", etichetta: "Volantini", conteggio: conta("VOL") },
          { valore: "POP", etichetta: "POP", conteggio: conta("POP") },
        ]}
      />
      <FormSelect
        formSelectSize="sm"
        aria-label="Area"
        className="w-auto min-w-36"
        value={filtri.area}
        onChange={(evento) => onChange({ ...filtri, area: evento.target.value })}
      >
        <option value="">Tutte le aree</option>
        {aree.map((area) => (
          <option key={chiaveRiferimento(area)} value={chiaveRiferimento(area)}>
            {area.nome}
          </option>
        ))}
      </FormSelect>
      <FormSelect
        formSelectSize="sm"
        aria-label="Canale"
        className="w-auto min-w-36"
        value={filtri.canale}
        onChange={(evento) => onChange({ ...filtri, canale: evento.target.value })}
      >
        <option value="">Tutti i canali</option>
        {canali.map((canale) => (
          <option key={chiaveRiferimento(canale)} value={chiaveRiferimento(canale)}>
            {canale.nome}
          </option>
        ))}
      </FormSelect>
    </div>
  );
}

const DESCRIZIONE = "Le promozioni in corso della tua GDO, dalla scadenza della lavorazione più vicina, con lo stato di ogni kit volantino e POP.";

/**
 * Avanzamento della produzione: le promo in corso della GDO ordinate per scadenza della
 * lavorazione, gli elementi da guardare in testa (sono anche filtri) e, per promo, i suoi kit.
 */
function AvanzamentoProduzione() {
  const avanzamento = useFetchAvanzamentoProduzione();
  // Il dettaglio del kit sta sotto la promo: senza il permesso sulle promo non si apre
  const puoAprireKit = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
  const [filtri, setFiltri] = useState<FiltriAvanzamento>(FILTRI_VUOTI);
  const [elemento, setElemento] = useState<IdElemento | null>(null);
  const [aperte, setAperte] = useState<ReadonlySet<string>>(new Set());

  const promozioni = useMemo(() => avanzamento.data?.promozioni ?? [], [avanzamento.data]);
  const visibili = useMemo(() => promoVisibili(promozioni, filtri), [promozioni, filtri]);
  const scelto = ELEMENTI_DA_GUARDARE.find((voce) => voce.id === elemento) ?? null;
  const elenco = scelto ? visibili.filter((promo) => scelto.riguarda(promo, filtri)) : visibili;

  const alterna = (idPromo: string) =>
    setAperte((attuali) => {
      const prossime = new Set(attuali);
      if (prossime.has(idPromo)) prossime.delete(idPromo);
      else prossime.add(idPromo);
      return prossime;
    });
  const azzera = () => {
    setFiltri(FILTRI_VUOTI);
    setElemento(null);
  };

  const aggiornato = avanzamento.dataUpdatedAt ? ` Aggiornato alle ${dayjs(avanzamento.dataUpdatedAt).format("HH:mm")}.` : "";

  const corpo = (() => {
    if (avanzamento.isPending) return <InCaricamento />;
    if (avanzamento.isError) {
      return (
        <PageError
          titolo="Avanzamento non caricato"
          motivo={avanzamento.error?.message || "Il servizio non ha restituito le promozioni in corso."}
          onRiprova={avanzamento.isFetching ? undefined : () => avanzamento.refetch()}
        />
      );
    }
    if (promozioni.length === 0) {
      return (
        <Sezione>
          <EmptyState
            icon="Gauge"
            title="Nessuna promozione in corso"
            description="Le promozioni compaiono qui da quando sono pianificate fino alla validità."
          />
        </Sezione>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div role="group" aria-label="Da guardare" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {ELEMENTI_DA_GUARDARE.map((voce, indice) => (
            <div key={voce.id} className={twMerge(indice === ELEMENTI_DA_GUARDARE.length - 1 && "col-span-2 lg:col-span-1")}>
              <Tessera
                numero={voce.conta(visibili, filtri)}
                etichetta={voce.etichetta}
                descrizione={voce.descrizione}
                tono={voce.tono}
                scelta={elemento === voce.id}
                onScegli={() => setElemento((attuale) => (attuale === voce.id ? null : voce.id))}
              />
            </div>
          ))}
        </div>

        <Sezione
          senzaPadding
          titolo={
            <>
              Promozioni in corso <span className="font-normal tabular-nums text-slate-500">{formatNumero(elenco.length)}</span>
            </>
          }
          descrizione={scelto ? `Solo le promozioni con: ${scelto.etichetta.toLowerCase()}.` : "Apri una promozione per vederne i kit."}
          azioni={
            scelto && (
              <Button size="sm" variant="outline-secondary" onClick={() => setElemento(null)}>
                <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Mostra tutte
              </Button>
            )
          }
        >
          {elenco.length === 0 ? (
            <div className="border-t border-dashed border-slate-200 p-5 dark:border-darkmode-400">
              <EmptyState
                compatta
                icon="SearchX"
                title="Nessuna promozione con questi filtri"
                description="Cambia o azzera i filtri per vedere le altre promozioni in corso."
                buttonText="Azzera filtri"
                buttonIcon="X"
                onButtonClick={azzera}
              />
            </div>
          ) : (
            <>
              <div
                aria-hidden="true"
                className={twMerge(
                  "hidden border-y border-dashed border-slate-200 px-5 py-2 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:border-darkmode-400",
                  COLONNE_PROMO
                )}
              >
                <span>Promozione</span>
                <span>Kit per stato</span>
                <span>Scadenza</span>
                <span />
              </div>
              <ul aria-label="Promozioni in corso" className="border-t border-dashed border-slate-200 md:border-t-0 dark:border-darkmode-400">
                {elenco.map((promo) => (
                  <RigaPromo
                    key={promo.id}
                    promo={promo}
                    kit={kitVisibili(promo, filtri)}
                    aperta={aperte.has(promo.id)}
                    onAlterna={() => alterna(promo.id)}
                    puoAprireKit={puoAprireKit}
                  />
                ))}
              </ul>
            </>
          )}
        </Sezione>
      </div>
    );
  })();

  return (
    <Pagina
      titolo="Avanzamento produzione"
      descrizione={`${DESCRIZIONE}${aggiornato}`}
      azioni={
        promozioni.length > 0 && (
          <Filtri promozioni={promozioni} filtri={filtri} onChange={setFiltri} />
        )
      }
    >
      {corpo}
    </Pagina>
  );
}

export default withSessionCheck(AvanzamentoProduzione);
