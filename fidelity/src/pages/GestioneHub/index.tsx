import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermissionContext } from "@/context/PermissionContext";
import { useFetchHubNewsAdmin, useFetchHubServicesAdmin } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { useMemo } from "react";
import NewsTab from "./components/NewsTab";
import ServicesTab from "./components/ServicesTab";
import UnauthorizedState from "./components/UnauthorizedState";
import { groupHubServices } from "./utils";

const CLASSE_PULSANTE_TAB = "flex w-full items-center justify-center gap-2 whitespace-nowrap py-2";

function GestioneHub() {
  const { hasPermission, loading } = usePermissionContext();

  const canAccess = hasPermission(PERMISSIONS.SISTEMA.GESTISCI_HUB);

  const { data: groupedServices = {} } = useFetchHubServicesAdmin(canAccess);
  const { data: newsArchive = [] } = useFetchHubNewsAdmin(canAccess);

  const serviceCount = useMemo(() => groupHubServices(groupedServices).length, [groupedServices]);
  const newsCount = newsArchive.length;

  return (
    <Pagina
      titolo="Gestione Hub"
      descrizione="Configura servizi e news dell'Hub. I servizi sono assegnabili a tutti i tipi utente tranne Guest; il Superadmin vede sempre tutti i servizi."
    >
      {loading ? (
        <Sezione>
          <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
            <Spinner size="sm" etichetta="Verifica permessi in corso…" />
            <span aria-hidden="true">Verifica permessi in corso…</span>
          </div>
        </Sezione>
      ) : !canAccess ? (
        <UnauthorizedState />
      ) : (
        <Tab.Group className="flex flex-col gap-6">
          <Tab.List variant="boxed-tabs" className="bg-white shadow-card">
            <Tab>
              <Tab.Button as="button" className={CLASSE_PULSANTE_TAB}>
                <Lucide icon="Blocks" aria-hidden="true" className="h-4 w-4" />
                Servizi
                {serviceCount > 0 && <span className="tabular-nums text-slate-400">{formatNumero(serviceCount)}</span>}
              </Tab.Button>
            </Tab>
            <Tab>
              <Tab.Button as="button" className={CLASSE_PULSANTE_TAB}>
                <Lucide icon="Newspaper" aria-hidden="true" className="h-4 w-4" />
                News
                {newsCount > 0 && <span className="tabular-nums text-slate-400">{formatNumero(newsCount)}</span>}
              </Tab.Button>
            </Tab>
          </Tab.List>

          <Tab.Panels>
            <Tab.Panel>
              <ServicesTab />
            </Tab.Panel>
            <Tab.Panel>
              <NewsTab />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      )}
    </Pagina>
  );
}

export default withSessionCheck(GestioneHub);
