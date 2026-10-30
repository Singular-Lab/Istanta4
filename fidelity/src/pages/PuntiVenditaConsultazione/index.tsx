import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Segmenti, { type OpzioneSegmento } from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import { daConsultazione, storiaNellElenco, useElencoPuntiVendita } from "@/components/PuntiVendita/elenco";
import { FiltriPuntiVendita } from "@/components/PuntiVendita/FiltriPuntiVendita";
import { InfograficheRete } from "@/components/PuntiVendita/InfograficheRete";
import { MappaPuntiVendita } from "@/components/PuntiVendita/MappaPuntiVendita";
import { RighePuntiVendita } from "@/components/PuntiVendita/RighePuntiVendita";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchPuntiVenditaConsultazione, useFetchReteInsegne } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { contaPer } from "../../utils/puntoVendita";

const percorsoScheda = (pv: { id: string }) => `/punti-vendita/${pv.id}`;

type Vista = "elenco" | "mappa";

const OPZIONI_VISTA: OpzioneSegmento<Vista>[] = [
  { valore: "elenco", etichetta: "Elenco" },
  { valore: "mappa", etichetta: "Elenco e mappa" },
];

/**
 * Consultazione dei punti vendita della GDO (/punti-vendita, "gdo.visualizza"): in testa la rete
 * per insegna (oggi e nei volantini di ogni anno), poi l'elenco con ricerca, area e insegna accanto
 * ai risultati e, a scelta, la mappa. Ogni riga dice l'insegna nei volantini anno per anno e apre
 * la scheda del punto vendita. In sola lettura: creazione, modifica e import stanno nella gestione.
 */
function PuntiVenditaConsultazione() {
  const navigate = useNavigate();
  const query = useFetchPuntiVenditaConsultazione();
  const rete = useFetchReteInsegne();
  const puoGestire = usePermission(PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA);
  const tutti = useMemo(() => (query.data ?? []).map(daConsultazione), [query.data]);
  // I colori delle insegne sono quelli di tutte le pagine dei punti vendita (tinteCanali sulla rete)
  const elenco = useElencoPuntiVendita(tutti);
  const [vista, setVista] = useState<Vista>("elenco");
  const errore = query.isError ? (query.error as Error)?.message || "Errore durante il recupero dei punti vendita" : null;

  // Gli anni della striscia delle insegne, uguali per tutte le righe: quelli della rete o, se non
  // arrivano, quelli della storia delle righe. Senza storia nell'elenco la striscia non c'è.
  const anni = useMemo(() => {
    if (!storiaNellElenco(tutti)) return [];
    const daRete = rete.data?.anni ?? [];
    const scelti = daRete.length > 0 ? daRete : tutti.flatMap(pv => pv.storia?.insegnePerAnno.map(v => v.anno) ?? []);
    return [...new Set(scelti)].sort((a, b) => a - b);
  }, [tutti, rete.data]);

  const riepilogo = useMemo(() => {
    if (!query.data) return undefined;
    const insegne = contaPer(tutti, "canale").length;
    const aree = contaPer(tutti, "area").length;
    return [
      tutti.length === 1 ? "1 punto vendita" : `${formatNumero(tutti.length)} punti vendita`,
      insegne === 1 ? "1 insegna" : `${formatNumero(insegne)} insegne`,
      aree === 1 ? "1 area" : `${formatNumero(aree)} aree`,
    ].join(" · ");
  }, [query.data, tutti]);

  return (
    <Pagina
      titolo="Punti vendita"
      descrizione={riepilogo}
      azioni={
        puoGestire ? (
          <Button as={Link} to="/gestione-interna/punti-vendita" variant="outline-secondary">
            <Lucide icon="Settings" aria-hidden="true" className="mr-2 h-4 w-4" />
            Gestisci punti vendita
          </Button>
        ) : undefined
      }
    >
      <InfograficheRete
        query={rete}
        tintaDelCanale={elenco.tintaDelCanale}
        filtroCanale={elenco.filtroCanale}
        onFiltroCanale={elenco.setFiltroCanale}
      />

      <Sezione
        senzaPadding
        titolo="Elenco"
        descrizione="Ogni punto vendita apre la sua scheda, con i volantini attivi e la storia nei volantini."
      >
        <FiltriPuntiVendita
          elenco={elenco}
          aggiornamento={query.isFetching && !query.isLoading}
          placeholder="Nome, città, indirizzo, CAP o codice"
          destra={<Segmenti etichetta="Vista" opzioni={OPZIONI_VISTA} valore={vista} onChange={setVista} />}
        />
        <div className={vista === "mappa" ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : undefined}>
          {vista === "mappa" && (
            <div className="border-b border-dashed border-slate-200 p-5 xl:order-2 xl:border-b-0 xl:border-l dark:border-darkmode-400">
              <MappaPuntiVendita
                tutti={tutti}
                elenco={elenco}
                caricamento={query.isLoading}
                errore={errore}
                onRiprova={() => query.refetch()}
                onDettagli={pv => navigate(percorsoScheda(pv))}
                etichettaDettagli="Apri scheda"
                descrizioneSenzaPosizione="Nessun punto vendita della GDO ha le coordinate in anagrafica."
                className="sm:h-[360px] xl:sticky xl:top-24 xl:h-[520px]"
              />
            </div>
          )}
          <div className="min-w-0">
            <RighePuntiVendita
              elenco={elenco}
              caricamento={query.isLoading}
              errore={errore}
              onRiprova={() => query.refetch()}
              percorsoScheda={percorsoScheda}
              anni={anni}
              vuoto={{ titolo: "Nessun punto vendita", descrizione: "La GDO non ha ancora punti vendita in anagrafica." }}
            />
          </div>
        </div>
      </Sezione>
    </Pagina>
  );
}

export default withSessionCheck(PuntiVenditaConsultazione);
