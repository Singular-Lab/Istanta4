import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";

interface UserWelcomeProps {
  email: string;
  tipoUtente: string;
  servicesCount?: number;
  photo?: string;
  ruoloGDO?: string;
}

const roleLabels: Record<string, string> = {
  Superadmin: "Amministratore di Sistema",
  Agenzia: "Agenzia",
  GDO: "GDO",
  PuntoVendita: "Punto Vendita",
  Guest: "Guest",
  Category: "Category",
};

const coreRuoloUtente: Record<string, string> = {
  "DEVELOPER": "Sviluppatore",
  "BUSINESS_CATEGORY": "Business Category",
  "ADMIN": "Amministratore"
}
function getGreeting(t: TFunction<"translation", undefined>): string {
  const hour = new Date().getHours();
  if (hour < 13) return t("Buongiorno");
  if (hour < 18) return t("Buon pomeriggio");
  return t("Buonasera");
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const UserWelcome: React.FC<UserWelcomeProps> = ({ email, tipoUtente, servicesCount, photo, ruoloGDO }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clearHubQueries = async () => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ["hubUserInfo"] }),
      queryClient.cancelQueries({ queryKey: ["hubServices"] }),
      queryClient.cancelQueries({ queryKey: ["hubNews"] }),
    ]);
    queryClient.removeQueries({ queryKey: ["hubUserInfo"] });
    queryClient.removeQueries({ queryKey: ["hubServices"] });
    queryClient.removeQueries({ queryKey: ["hubNews"] });
  };

  const handleLogout = async () => {
    try {
      await ServerCall.get("/logout-user");
      await clearHubQueries();
      navigate("/login?reason=logout_success&message=Login+effettuato+con+successo");
    } catch {
      // ignora errori logout
      await clearHubQueries();
      navigate("/login");
    }
  };
  const { t } = useTranslation("translation", { useSuspense: false });
  const greeting = getGreeting(t);
  const formattedDate = getFormattedDate();

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-theme-1 via-theme-1 to-theme-2 text-white rounded-xl p-6 sm:p-8 shadow-xl animate-fade-in-up">
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
              {photo ? (
                <img
                  src={`data:image/jpeg;base64,${photo}`}
                  alt="User"
                  className="w-full h-full object-cover rounded-xl"
                  draggable={false}
                />
              ) : (
                <Lucide icon="User" className="w-7 h-7" />
              )}
            </div>
            <div>
              <h2 className="font-urbanist text-xl sm:text-3xl font-bold">
                {greeting}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-white/80 text-sm">{email}</span>
                <span className="inline-block px-2.5 py-0.5 text-xs bg-white/20 backdrop-blur-sm rounded-full font-semibold">
                  {roleLabels[tipoUtente] || tipoUtente}
                </span>
                {ruoloGDO != undefined && (
                  <span className="inline-block px-2.5 py-0.5 text-xs bg-white/20 backdrop-blur-sm rounded-full font-semibold">
                    {coreRuoloUtente[ruoloGDO?.split("_")[1] ?? ""]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="outline-secondary"
            rounded
            size="sm"
            className="border-white/30 text-white hover:bg-white/10 shrink-0 self-start sm:self-center"
            onClick={handleLogout}
          >
            <Lucide icon="LogOut" className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>

        {/* Info bar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-white/70">
          <div className="flex items-center gap-1.5">
            <Lucide icon="Calendar" className="w-3.5 h-3.5" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          {servicesCount !== undefined && (
            <div className="flex items-center gap-1.5">
              <Lucide icon="LayoutGrid" className="w-3.5 h-3.5" />
              <span>{servicesCount} {servicesCount === 1 ? 'servizio disponibile' : 'servizi disponibili'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserWelcome;
