import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import withSessionCheck from "@/components/SessionChecker";
import useParametriUrl from "@/hooks/useParametriUrl";
import { useCampiNonTradotti, useImpostazioniGdo } from "@/query/impostazioniGdo";
import clsx from "clsx";
import { type MouseEvent } from "react";
import SezioneAspettoSitoWeb from "./SezioneAspettoSitoWeb";
import SezioneCampiReferenze from "./SezioneCampiReferenze";
import SezioneIdentita from "./SezioneIdentita";
import SezioneInsightVolantino from "./SezioneInsightVolantino";
import SezioneLoghiInsegne from "./SezioneLoghiInsegne";
import SezioneMarchiDistributore from "./SezioneMarchiDistributore";
import SezioneMenabo from "./SezioneMenabo";
import SezioneReparti, { repartoDaNominare } from "./SezioneReparti";
import { GRUPPI_IMPOSTAZIONI_GDO, SEZIONI_IMPOSTAZIONI_GDO, type IdSezioneImpostazioniGdo } from "./sezioni";

/**
 * Impostazioni della GDO della sessione, una sezione alla volta: ognuna ha il suo pulsante e salva
 * solo sé stessa. A sinistra l'indice raggruppato (su schermi stretti una striscia orizzontale);
 * ?sezione= apre una sezione, anche da un'altra pagina; senza, o se non esiste, la prima.
 */
function ImpostazioniGdo() {
  const impostazioni = useImpostazioniGdo();
  const campiNonTradotti = useCampiNonTradotti();
  const [parametri, aggiornaParametri] = useParametriUrl();
  const sezioneScelta = parametri.get("sezione");
  const vaiA = (evento: MouseEvent<HTMLAnchorElement>, id: IdSezioneImpostazioniGdo) => {
    evento.preventDefault();
    aggiornaParametri({ sezione: id });
  };

  if (impostazioni.isPending) {
    return (
      <Pagina titolo="Impostazioni GDO">
        <div className="flex justify-center py-16">
          <Spinner size="lg" etichetta="Caricamento delle impostazioni della GDO…" />
        </div>
      </Pagina>
    );
  }

  if (impostazioni.isError) {
    return (
      <Pagina titolo="Impostazioni GDO">
        <PageError
          titolo="Impostazioni della GDO non caricate"
          motivo={impostazioni.error.message}
          onRiprova={() => impostazioni.refetch()}
        />
      </Pagina>
    );
  }

  const dati = impostazioni.data;
  const daNominare = dati.reparti.filter(repartoDaNominare).length;
  const daSincronizzare = (campiNonTradotti.data ?? []).filter((c) => c.referenze > 0).length;
  const contatori: Partial<Record<IdSezioneImpostazioniGdo, { tono: "warning" | "info"; etichetta: string }>> = {
    ...(daNominare > 0 && { reparti: { tono: "warning", etichetta: `${daNominare} da nominare` } }),
    ...(daSincronizzare > 0 && { "campi-referenze": { tono: "info", etichetta: `${daSincronizzare} da sincronizzare` } }),
  };
  const attiva: IdSezioneImpostazioniGdo = SEZIONI_IMPOSTAZIONI_GDO.some((voce) => voce.id === sezioneScelta)
    ? (sezioneScelta as IdSezioneImpostazioniGdo)
    : SEZIONI_IMPOSTAZIONI_GDO[0].id;

  return (
    <Pagina
      titolo="Impostazioni GDO"
      descrizione={`Identità, reparti, campi delle referenze, insight e menabò del volantino e sito web di ${dati.gdo.nome}. Ogni sezione si salva da sola.`}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-3">
          <Sezione as="div" compatta className="xl:sticky xl:top-24">
            <nav aria-label="Sezioni delle impostazioni" className="flex gap-4 overflow-x-auto xl:flex-col xl:gap-3 xl:overflow-visible">
              {GRUPPI_IMPOSTAZIONI_GDO.map((gruppo) => (
                <div key={gruppo.titolo} className="flex flex-none gap-1 xl:flex-col">
                  <p className="hidden px-3 pb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400 xl:block">{gruppo.titolo}</p>
                  {gruppo.sezioni.map((id) => {
                    const sezione = SEZIONI_IMPOSTAZIONI_GDO.find((voce) => voce.id === id)!;
                    const corrente = sezione.id === attiva;
                    const contatore = contatori[sezione.id];
                    return (
                      <a
                        key={sezione.id}
                        href={`?sezione=${sezione.id}`}
                        onClick={(evento) => vaiA(evento, sezione.id)}
                        aria-current={corrente ? "page" : undefined}
                        className={clsx(
                          "flex flex-none items-center gap-2 whitespace-nowrap rounded-control px-3 py-2 transition-colors hover:text-primary",
                          corrente ? "bg-theme-1/10 font-medium text-primary" : "text-slate-600"
                        )}
                      >
                        <Lucide icon={sezione.icona} aria-hidden="true" className="h-4 w-4 flex-none" />
                        <span>{sezione.etichetta}</span>
                        {contatore && <StatusBadge tono={contatore.tono} etichetta={contatore.etichetta} className="xl:ml-auto" />}
                      </a>
                    );
                  })}
                </div>
              ))}
            </nav>
          </Sezione>
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-6 xl:col-span-9">
          {attiva === "identita" && <SezioneIdentita gdo={dati.gdo} identita={dati.identita} />}
          {attiva === "loghi-insegne" && <SezioneLoghiInsegne loghi={dati.sitoWeb.logo_header ?? []} />}
          {attiva === "reparti" && <SezioneReparti reparti={dati.reparti} />}
          {attiva === "marchi-distributore" && <SezioneMarchiDistributore lineeDistributore={dati.lineeDistributore} />}
          {attiva === "campi-referenze" && <SezioneCampiReferenze campi={dati.campiReferenze ?? []} />}
          {attiva === "insight-volantino" && <SezioneInsightVolantino insight={dati.insightVolantino} />}
          {attiva === "menabo-volantino" && <SezioneMenabo regole={dati.regoleMenabo ?? []} />}
          {attiva === "aspetto-sito-web" && <SezioneAspettoSitoWeb sitoWeb={dati.sitoWeb} />}
        </div>
      </div>
    </Pagina>
  );
}

export default withSessionCheck(ImpostazioniGdo);
