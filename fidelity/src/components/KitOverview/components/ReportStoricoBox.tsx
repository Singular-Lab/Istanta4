import { FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import dayjs from "dayjs";
import { FC, useMemo, useState } from "react";
import type { BoxFuoriListino, OrigineStorico, ReferenzaStorico } from "../types";

type TabReport = "nonImpaginate" | "fuoriListino";

const testoReferenza = (referenza: ReferenzaStorico) =>
  [referenza.codice, referenza.descrizione, ...referenza.campi.map((campo) => campo.valore)]
    .filter(Boolean).join(" ").toLowerCase();

/**
 * Un record di listino: stessi dati per le non impaginate e per i box compilati a mano.
 * I campi arrivano gia scelti ed etichettati dall'agenzia lib del cliente.
 */
const ReferenzaCard: FC<{ referenza: ReferenzaStorico }> = ({ referenza }) => (
  <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all">
    <p className="text-sm font-medium text-slate-800 line-clamp-3">{referenza.descrizione || "N/D"}</p>
    <p className="text-[10px] text-slate-500 font-mono">{referenza.codice || "senza codice"}</p>
    {referenza.campi.length > 0 && (
      <div className="mt-auto flex flex-wrap gap-1.5">
        {referenza.campi.map((campo) => (
          <span
            key={campo.label}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600"
          >
            <span className="text-slate-400">{campo.label}</span>
            <span className="font-semibold text-slate-700">{campo.valore}</span>
          </span>
        ))}
      </div>
    )}
  </div>
);

/** Un box del volantino senza riscontro a listino, con la decisione presa dall'operatore. */
const BoxFuoriListinoCard: FC<{ box: BoxFuoriListino }> = ({ box }) => (
  <div className="border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
      {box.pag != null && (
        <span className="inline-flex items-center rounded px-2 py-1 text-[10px] font-bold bg-slate-200/70 text-slate-700">
          Pag. {box.pag}
        </span>
      )}
      <span className="text-sm font-semibold text-slate-800 font-mono">Box {box.codiceBox || "senza codice"}</span>
      <span
        className={clsx(
          "ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
          box.ignorato ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-warning/10 text-warning border-warning/20"
        )}
      >
        <Lucide icon={box.ignorato ? "EyeOff" : "PencilLine"} className="w-3 h-3" />
        {box.ignorato
          ? "Ignorato"
          : `Compilato a mano · ${box.referenze.length === 1 ? "1 referenza" : `${box.referenze.length} referenze`}`}
      </span>
    </div>
    <div className="p-4 space-y-3">
      {box.testoBox.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Testo nel volantino</p>
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-line">
            {box.testoBox.join("\n")}
          </p>
        </div>
      )}
      {box.ignorato ? (
        <p className="text-xs text-slate-500">Resta nel volantino senza referenza a sistema.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {box.referenze.map((referenza, index) => (
            <ReferenzaCard key={`${referenza.codice}-${index}`} referenza={referenza} />
          ))}
        </div>
      )}
    </div>
  </div>
);

const ReportVuoto: FC<{ messaggio: string; icon: string }> = ({ messaggio, icon }) => (
  <div className="p-6 text-center text-slate-500">
    <Lucide icon={icon} className="mx-auto h-8 w-8 mb-2 text-slate-400" />
    <p className="text-sm">{messaggio}</p>
  </div>
);

/**
 * Il report dell'import da storico: cosa c'era nel volantino rispetto al listino.
 * Le non impaginate sono a listino ma senza box, quindi a sistema non esistono;
 * i box fuori listino sono nel volantino ma non a listino, compilati o ignorati.
 */
const ReportStoricoBox: FC<{ origineStorico: OrigineStorico }> = ({ origineStorico }) => {
  const {
    importatoIl,
    nomeFile,
    boxNelVolantino,
    referenzeDaListino,
    nonImpaginate,
    lasciapassareNonImpaginate,
    fuoriListinoIgnorati,
    boxFuoriListino,
  } = origineStorico;

  const [tab, setTab] = useState<TabReport>(
    nonImpaginate.length === 0 && boxFuoriListino.length > 0 ? "fuoriListino" : "nonImpaginate"
  );
  const [ricerca, setRicerca] = useState("");

  const boxCompilati = boxFuoriListino.filter((box) => !box.ignorato).length;
  // Gli import precedenti salvavano solo il numero degli ignorati, non quali box.
  const ignoratiSenzaDettaglio = fuoriListinoIgnorati - boxFuoriListino.filter((box) => box.ignorato).length;

  const testo = ricerca.trim().toLowerCase();
  const nonImpaginateFiltrate = useMemo(
    () => (testo ? nonImpaginate.filter((referenza) => testoReferenza(referenza).includes(testo)) : nonImpaginate),
    [nonImpaginate, testo]
  );
  const boxFiltrati = useMemo(
    () => (testo
      ? boxFuoriListino.filter((box) =>
        [box.codiceBox, ...box.testoBox].join(" ").toLowerCase().includes(testo) ||
        box.referenze.some((referenza) => testoReferenza(referenza).includes(testo)))
      : boxFuoriListino),
    [boxFuoriListino, testo]
  );

  const contatori = [
    { icon: "LayoutGrid", tone: "text-slate-500", label: "Box nel volantino", value: boxNelVolantino },
    { icon: "ListChecks", tone: "text-success", label: "Da listino", value: referenzeDaListino },
    { icon: "TriangleAlert", tone: "text-warning", label: "Non impaginate", value: nonImpaginate.length },
    { icon: "PencilLine", tone: "text-warning", label: "Box compilati", value: boxCompilati },
    { icon: "EyeOff", tone: "text-slate-500", label: "Box ignorati", value: fuoriListinoIgnorati },
  ].filter((contatore) => contatore.value !== undefined);

  const tabs: Array<{ id: TabReport; label: string; icon: string; count: number }> = [
    { id: "nonImpaginate", label: "Non impaginate", icon: "TriangleAlert", count: nonImpaginate.length },
    { id: "fuoriListino", label: "Fuori listino", icon: "Ghost", count: boxFuoriListino.length },
  ];

  return (
    <div className="box box--stacked p-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
            <Lucide icon="History" className="h-5 w-5 text-info" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">Report import da storico</h3>
            <p className="text-xs text-slate-500 truncate">
              Importato il {dayjs(importatoIl).format("DD/MM/YYYY HH:mm")}
              {nomeFile && ` · ${nomeFile}`}
            </p>
          </div>
        </div>
        <div className="relative">
          <Lucide icon="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <FormInput
            type="text"
            placeholder="Cerca referenza o box..."
            className="pl-9 rounded-lg h-9"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>
      </div>

      {/* ================= CONTATORI ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        {contatori.map((contatore) => (
          <div key={contatore.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Lucide icon={contatore.icon} className={clsx("h-3.5 w-3.5 shrink-0", contatore.tone)} />
              <span className="truncate">{contatore.label}</span>
            </div>
            <p className="text-xl font-bold text-slate-800">{contatore.value}</p>
          </div>
        ))}
      </div>

      {/* ================= TABS ================= */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 mb-4">
        {tabs.map((voce) => (
          <button
            key={voce.id}
            type="button"
            onClick={() => setTab(voce.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition",
              tab === voce.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
            )}
          >
            <Lucide icon={voce.icon} className="h-3.5 w-3.5" />
            <span>{voce.label}</span>
            <span className="rounded-full bg-slate-200/70 px-1.5 text-[10px] font-semibold text-slate-600">{voce.count}</span>
          </button>
        ))}
      </div>

      {/* ================= CONTENUTO ================= */}
      <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
        {tab === "nonImpaginate" && (
          <>
            {lasciapassareNonImpaginate && nonImpaginate.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-slate-600">
                <Lucide icon="TriangleAlert" className="h-4 w-4 text-warning shrink-0" />
                Sono a listino ma nel volantino non hanno un box: l'operatore ha proseguito lasciandole da impaginare.
              </div>
            )}
            {nonImpaginateFiltrate.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {nonImpaginateFiltrate.map((referenza, index) => (
                  <ReferenzaCard key={`${referenza.codice}-${index}`} referenza={referenza} />
                ))}
              </div>
            ) : testo ? (
              <ReportVuoto icon="SearchX" messaggio="Nessuna referenza non impaginata corrisponde alla ricerca" />
            ) : (
              <ReportVuoto icon="ListChecks" messaggio="Nessuna referenza non impaginata: tutto il listino è nel volantino" />
            )}
          </>
        )}

        {tab === "fuoriListino" && (
          <>
            {ignoratiSenzaDettaglio > 0 && (
              <p className="text-xs text-slate-500">
                {ignoratiSenzaDettaglio === 1
                  ? "1 box ignorato in un import precedente: il dettaglio non è disponibile."
                  : `${ignoratiSenzaDettaglio} box ignorati in un import precedente: il dettaglio non è disponibile.`}
              </p>
            )}
            {boxFiltrati.length > 0 ? (
              boxFiltrati.map((box, index) => <BoxFuoriListinoCard key={`${box.codiceBox}-${index}`} box={box} />)
            ) : testo ? (
              <ReportVuoto icon="SearchX" messaggio="Nessun box fuori listino corrisponde alla ricerca" />
            ) : ignoratiSenzaDettaglio <= 0 ? (
              <ReportVuoto icon="ListChecks" messaggio="Nessun box fuori listino: ogni box del volantino è a listino" />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportStoricoBox;
