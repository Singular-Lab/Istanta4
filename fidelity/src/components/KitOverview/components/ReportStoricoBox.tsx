import Alert from "@/components/Base/Alert";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import StatCard from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import EmptyState from "@/components/EmptyState";
import { formatDataOra } from "@/utils/format";
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
  <div className="flex flex-col gap-2 rounded-control border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
    <p className="text-sm font-medium text-slate-800 line-clamp-3">{referenza.descrizione || "N/D"}</p>
    <p className="text-3xs text-slate-500 font-mono">{referenza.codice || "senza codice"}</p>
    {referenza.campi.length > 0 && (
      <div className="mt-auto flex flex-wrap gap-1.5">
        {referenza.campi.map((campo) => (
          <span
            key={campo.label}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-3xs text-slate-600"
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
  <div className="overflow-hidden rounded-card border border-slate-200">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
      {box.pag != null && (
        <span className="inline-flex items-center rounded-full bg-slate-200/70 px-2 py-0.5 text-3xs font-bold text-slate-700">
          Pag. {box.pag}
        </span>
      )}
      <h3 className="title-card font-mono">Box {box.codiceBox || "senza codice"}</h3>
      <StatusBadge
        className="ml-auto"
        tono={box.ignorato ? "neutral" : "warning"}
        icon={box.ignorato ? "EyeOff" : "PencilLine"}
        etichetta={
          box.ignorato
            ? "Ignorato"
            : `Compilato a mano · ${box.referenze.length === 1 ? "1 referenza" : `${box.referenze.length} referenze`}`
        }
      />
    </div>
    <div className="p-4 space-y-3">
      {box.testoBox.length > 0 && (
        <div>
          <p className="title-eyebrow mb-1">Testo nel volantino</p>
          <p className="rounded-control border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-line">
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

const ReportVuoto: FC<{ titolo: string; messaggio: string; icon: "SearchX" | "ListChecks" }> = ({ titolo, messaggio, icon }) => (
  <EmptyState compatta icon={icon} title={titolo} description={messaggio} />
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

  const contatori: Array<{ icon: string; tono: TonoStato; label: string; value: number | undefined }> = [
    { icon: "LayoutGrid", tono: "neutral", label: "Box nel volantino", value: boxNelVolantino },
    { icon: "ListChecks", tono: "success", label: "Da listino", value: referenzeDaListino },
    { icon: "TriangleAlert", tono: "warning", label: "Non impaginate", value: nonImpaginate.length },
    { icon: "PencilLine", tono: "warning", label: "Box compilati", value: boxCompilati },
    { icon: "EyeOff", tono: "neutral", label: "Box ignorati", value: fuoriListinoIgnorati },
  ];
  const contatoriPresenti = contatori.filter((contatore) => contatore.value !== undefined);

  const tabs: Array<{ id: TabReport; label: string; icon: string; count: number }> = [
    { id: "nonImpaginate", label: "Non impaginate", icon: "TriangleAlert", count: nonImpaginate.length },
    { id: "fuoriListino", label: "Fuori listino", icon: "Ghost", count: boxFuoriListino.length },
  ];

  return (
    <Sezione
      icona="History"
      titolo="Report import da storico"
      descrizione={
        <span className="block truncate">
          Importato il {formatDataOra(importatoIl)}
          {nomeFile && ` · ${nomeFile}`}
        </span>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {contatoriPresenti.map((contatore) => (
          <StatCard
            key={contatore.label}
            densita="compatta"
            icona={contatore.icon}
            tono={contatore.tono}
            etichetta={contatore.label}
            valore={contatore.value}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmenti<TabReport>
          etichetta="Elenco del report"
          valore={tab}
          onChange={setTab}
          opzioni={tabs.map((voce) => ({ valore: voce.id, etichetta: voce.label, conteggio: voce.count }))}
        />
        <CampoRicerca
          etichetta="Cerca nel report"
          placeholder="Cerca referenza o box…"
          value={ricerca}
          onChange={setRicerca}
        />
      </div>

      {/* ================= CONTENUTO ================= */}
      <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
        {tab === "nonImpaginate" && (
          <>
            {lasciapassareNonImpaginate && nonImpaginate.length > 0 && (
              <Alert variant="soft-warning" icona="TriangleAlert" className="text-xs">
                Sono a listino ma nel volantino non hanno un box: l&apos;operatore ha proseguito lasciandole da impaginare.
              </Alert>
            )}
            {nonImpaginateFiltrate.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {nonImpaginateFiltrate.map((referenza, index) => (
                  <ReferenzaCard key={`${referenza.codice}-${index}`} referenza={referenza} />
                ))}
              </div>
            ) : testo ? (
              <ReportVuoto icon="SearchX" titolo="Nessun risultato" messaggio="Nessuna referenza non impaginata corrisponde alla ricerca" />
            ) : (
              <ReportVuoto icon="ListChecks" titolo="Nessuna referenza non impaginata" messaggio="Tutto il listino è nel volantino" />
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
              <ReportVuoto icon="SearchX" titolo="Nessun risultato" messaggio="Nessun box fuori listino corrisponde alla ricerca" />
            ) : ignoratiSenzaDettaglio <= 0 ? (
              <ReportVuoto icon="ListChecks" titolo="Nessun box fuori listino" messaggio="Ogni box del volantino è a listino" />
            ) : null}
          </>
        )}
      </div>
    </Sezione>
  );
};

export default ReportStoricoBox;
