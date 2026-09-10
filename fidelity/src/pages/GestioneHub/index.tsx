import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermissionContext } from "@/context/PermissionContext";
import { useUser } from "@/context/UserContext";
import { useFetchHubNewsAdmin, useFetchHubServicesAdmin } from "@/query/query";
import { useMemo } from "react";
import { TIPO_UTENTI } from "../../../lib/enums";
import NewsTab from "./components/NewsTab";
import ServicesTab from "./components/ServicesTab";
import UnauthorizedState from "./components/UnauthorizedState";
import { groupHubServices } from "./utils";

const tabClassName =
  "first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-semibold [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.05] [&[aria-selected='true']_button]:border-primary/[0.2]";

function GestioneHub() {
  const { user } = useUser();
  const { hasPermission, loading } = usePermissionContext();

  const isSuperadmin = user?.tipo === TIPO_UTENTI.SUPERADMIN;
  const canAccess = Boolean(isSuperadmin && (user?.is_admin || hasPermission(PERMISSIONS.PAGINA.GESTIONE_HUB)));

  const { data: groupedServices = {} } = useFetchHubServicesAdmin(canAccess);
  const { data: newsArchive = [] } = useFetchHubNewsAdmin(canAccess);

  const serviceCount = useMemo(() => groupHubServices(groupedServices).length, [groupedServices]);
  const newsCount = newsArchive.length;

  return (
    <>
      <PageHeader
        title="Gestione Hub"
        description="Configura servizi e news dell'Hub. I servizi sono assegnabili a tutti i tipi utente (esclusi Superadmin e Guest)."
      />

      {loading ? (
        <div className="box box--stacked mt-6 p-8 flex items-center gap-3 text-slate-500">
          <Lucide icon="Loader2" className="w-5 h-5 animate-spin" />
          Verifica permessi in corso...
        </div>
      ) : !canAccess ? (
        <UnauthorizedState />
      ) : (
        <div className="mt-3.5">
          <Tab.Group className="flex flex-col gap-y-5">
            <div className="flex flex-col p-2 box box--stacked">
              <Tab.List variant="boxed-tabs" className="bg-transparent border-transparent">
                <Tab className={tabClassName}>
                  <Tab.Button
                    className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2.5 justify-center"
                    as="button"
                  >
                    <Lucide icon="Blocks" className="w-4 h-4 stroke-[1.4]" />
                    Servizi
                    {serviceCount > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 min-w-[1.4rem]">
                        {serviceCount}
                      </span>
                    )}
                  </Tab.Button>
                </Tab>
                <Tab className={tabClassName}>
                  <Tab.Button
                    className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2.5 justify-center"
                    as="button"
                  >
                    <Lucide icon="Newspaper" className="w-4 h-4 stroke-[1.4]" />
                    News
                    {newsCount > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 min-w-[1.4rem]">
                        {newsCount}
                      </span>
                    )}
                  </Tab.Button>
                </Tab>
              </Tab.List>
            </div>

            <Tab.Panels>
              <Tab.Panel>
                <ServicesTab />
              </Tab.Panel>
              <Tab.Panel>
                <NewsTab />
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
      )}
    </>
  );
}

export default withSessionCheck(GestioneHub);
