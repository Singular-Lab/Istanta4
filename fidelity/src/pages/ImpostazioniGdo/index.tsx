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
import { useEffect, useRef, type MouseEvent } from "react";
import SezioneAspettoSitoWeb from "./SezioneAspettoSitoWeb";
import SezioneCampiReferenze from "./SezioneCampiReferenze";
import SezioneIdentita from "./SezioneIdentita";
import SezioneInsightVolantino from "./SezioneInsightVolantino";
import SezioneLoghiInsegne from "./SezioneLoghiInsegne";
import SezioneMarchiDistributore from "./SezioneMarchiDistributore";
import SezioneReparti, { repartoDaNominare } from "./SezioneReparti";
import { SEZIONI_IMPOSTAZIONI_GDO, type IdSezioneImpostazioniGdo } from "./sezioni";

const scorriA = (id: string, comportamento: ScrollBehavior) =>
  document.getElementById(id)?.scrollIntoView?.({ behavior: comportamento, block: "start" });

/**
 * Impostazioni della GDO della sessione, in sezioni: ognuna ha il suo pulsante e salva solo sé
 * stessa. A sinistra l'indice delle sezioni (su schermi stretti una striscia orizzontale);
 * ?sezione= porta a una sezione, anche da un'altra pagina.
 */
function ImpostazioniGdo() {
  const impostazioni = useImpostazioniGdo();
  const campiNonTradotti = useCampiNonTradotti();
  const [parametri, aggiornaParametri] = useParametriUrl();
  const sezioneScelta = parametri.get("sezione");
  const pronta = !!impostazioni.data;
  const scorsa = useRef(false);

  // Arrivando con ?sezione= la pagina si apre su quella sezione, una volta caricati i dati
  useEffect(() => {
    if (!pronta || scorsa.current) return;
    scorsa.current = true;
    if (sezioneScelta) scorriA(sezioneScelta, "auto");
  }, [pronta, sezioneScelta]);

  const vaiA = (evento: MouseEvent<HTMLAnchorElement>, id: IdSezioneImpostazioniGdo) => {
    evento.preventDefault();
    aggiornaParametri({ sezione: id });
    scorriA(id, "smooth");
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
  const attiva = sezioneScelta ?? SEZIONI_IMPOSTAZIONI_GDO[0].id;

  return (
    <Pagina
      titolo="Impostazioni GDO"
      descrizione={`Identità, reparti, campi delle referenze, insight del volantino e sito web di ${dati.gdo.nome}. Ogni sezione si salva da sola.`}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-3">
          <Sezione as="div" compatta className="xl:sticky xl:top-24">
            <nav aria-label="Sezioni delle impostazioni" className="flex gap-1 overflow-x-auto xl:flex-col xl:overflow-visible">
              {SEZIONI_IMPOSTAZIONI_GDO.map((sezione) => {
                const corrente = sezione.id === attiva;
                const contatore = contatori[sezione.id];
                return (
                  <a
                    key={sezione.id}
                    href={`?sezione=${sezione.id}`}
                    onClick={(evento) => vaiA(evento, sezione.id)}
                    aria-current={corrente ? "location" : undefined}
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
            </nav>
          </Sezione>
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-6 xl:col-span-9">
          <SezioneIdentita gdo={dati.gdo} identita={dati.identita} />
          <SezioneLoghiInsegne loghi={dati.sitoWeb.logo_header ?? []} />
          <SezioneReparti reparti={dati.reparti} />
          <SezioneMarchiDistributore lineeDistributore={dati.lineeDistributore} />
          <SezioneCampiReferenze campi={dati.campiReferenze ?? []} />
          <SezioneInsightVolantino insight={dati.insightVolantino} />
          <SezioneAspettoSitoWeb sitoWeb={dati.sitoWeb} />
        </div>
      </div>
    </Pagina>
  );
}

export default withSessionCheck(ImpostazioniGdo);
