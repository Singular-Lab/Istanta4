import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import withSessionCheck from "@/components/SessionChecker";
import clsx from "clsx";
import { Fragment } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

function Main() {
  const navigate = useNavigate();
  const location = useLocation();

  // Deriva il tab attivo dal pathname - gestisce anche route nidificate come /ricette/modifica
  const activeTab = location.pathname.includes("/approfondimento_vini")
    ? "approfondimento_vini"
    : "ricette";

  // Titolo dinamico basato sulla route corrente
  const getPageInfo = (): { title: string | null; description: string | null } => {
    const path = location.pathname;

    // Per le pagine di modifica, non mostriamo il PageHeader qui
    // Sarà gestito dai componenti figli
    if (path.includes("/ricette/modifica")) {
      return { title: null, description: null };
    }
    if (path.includes("/approfondimento_vini/modifica")) {
      return { title: null, description: null };
    }
    if (path.includes("/approfondimento_vini")) {
      return { title: "Gestione Approfondimenti Vini", description: "Elenco approfondimenti vini" };
    }
    // Default: ricette
    return { title: "Gestione Ricette", description: "Elenco ricette generate" };
  };

  const { title, description } = getPageInfo();

  return (
    <Fragment>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          {title && (
            <div className="flex flex-col mt-4 md:mt-0 md:h-10 gap-y-3 md:items-center md:flex-row mb-4">
              <div className="flex flex-col">
                <PageHeader
                  title={title}
                  description={description ?? undefined}
                />
              </div>
            </div>
          )}
          <div className="gap-5 flex flex-col sm:flex-row mt-3.5">
            <div className="relative">
              <div className="sticky top-[104px]">
                <div className="box sm:w-[102px] grid grid-cols-3 sm:grid-cols-1 px-3.5 py-4 gap-3.5 before:content-[''] before:z-[-1] box--stacked">
                  <button
                    onClick={() => {
                      navigate("/gestione-ai/ricette");
                    }}
                    className={clsx(
                      "relative h-14 rounded-lg flex items-center py-3",
                      "border border-slate-200/80 place-content-center",
                      "hover:text-primary",
                      "[&.active]:text-primary [&.active]:font-medium [&.active]:shadow-sm",
                      "[&.active]:bg-primary/10 [&.active]:border-primary/30",
                      { active: activeTab === "ricette" }
                    )}
                  >
                    <Lucide
                      icon="CookingPot"
                      className="stroke-[0.8] w-5 h-5 fill-theme-1/10"
                    />
                  </button>
                  <button
                    onClick={() => {
                      navigate("/gestione-ai/approfondimento_vini");
                    }}
                    className={clsx(
                      "relative h-14 rounded-lg flex items-center py-3",
                      "border border-slate-200/80 place-content-center",
                      "hover:text-primary",
                      "[&.active]:text-primary [&.active]:font-medium [&.active]:shadow-sm",
                      "[&.active]:bg-primary/10 [&.active]:border-primary/30",
                      { active: activeTab === "approfondimento_vini" }
                    )}
                  >
                    <Lucide
                      icon="Wine"
                      className="stroke-[0.8] w-5 h-5 fill-theme-1/10"
                    />
                  </button>
                </div>
              </div>
            </div>
            <Outlet />
          </div>
        </div>
      </div>
    </Fragment>
  );
}

export default withSessionCheck(Main);
