import IstantaLogo from "@/assets/images/logo_ext.png";
import Lucide from "@/components/Base/Lucide";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isHubServiceAbsoluteUrl,
  normalizeHubServiceRedirectPage,
} from "../../../lib/hubServiceRedirect";
import { ServerCall } from "../../../lib/server_call";
import type { HubNewsDTO, HubServiceDTO } from "../../../lib/types";
import FeaturedServiceCard from "./components/FeaturedServiceCard";
import NewsCard from "./components/NewsCard";
import NewsCardSkeleton from "./components/NewsCardSkeleton";
import ServiceCard from "./components/ServiceCard";
import ServiceCardSkeleton from "./components/ServiceCardSkeleton";
import ServiceDetailsModal from "./components/ServiceDetailsModal";
import UserWelcome from "./components/UserWelcome";

interface HubUserInfo {
  id: string;
  email: string;
  tipo_utente: string;
  ruolo_gdo_key?: string;
  photo?: string;
}

const ServicesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [openingServiceId, setOpeningServiceId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<HubServiceDTO | null>(null);
  const loadingResetTimerRef = useRef<number | null>(null);
  // Fetch user info
  const { data: userInfo, isLoading: loadingUser, isError: userError } = useQuery({
    queryKey: ['hubUserInfo'],
    queryFn: () => ServerCall.get<HubUserInfo>('/hub-user-info'),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Fetch services
  const { data: servicesResponse = [], isLoading: loadingServices } = useQuery({
    queryKey: ['hubServices'],
    queryFn: () => ServerCall.get<HubServiceDTO[]>('/hub-services'),
    staleTime: 1000 * 60 * 5,
    enabled: !!userInfo,
  });

  const services = useMemo(
    () => servicesResponse.map((service) => ({
      ...service,
      documents: service.documents ?? [],
      videos: service.videos ?? [],
    })),
    [servicesResponse]
  );

  // Fetch news
  const { data: news = [], isLoading: loadingNews } = useQuery({
    queryKey: ['hubNews'],
    queryFn: () => ServerCall.get<HubNewsDTO[]>('/hub-news'),
    staleTime: 1000 * 60 * 5,
    enabled: !!userInfo,
  });

  // Split servizi in evidenza / normali
  const featuredServices = useMemo(
    () => services.filter(s => s.in_evidenza),
    [services]
  );
  const regularServices = useMemo(
    () => services.filter(s => !s.in_evidenza),
    [services]
  );
  const activeRegularServices = useMemo(
    () => regularServices.filter((service) => service.attivo && !service.in_manutenzione),
    [regularServices]
  );
  const inactiveRegularServices = useMemo(
    () => regularServices.filter((service) => !service.attivo || service.in_manutenzione),
    [regularServices]
  );

  const scheduleLoadingReset = (serviceId: string, delayMs: number) => {
    if (loadingResetTimerRef.current) {
      window.clearTimeout(loadingResetTimerRef.current);
    }

    loadingResetTimerRef.current = window.setTimeout(() => {
      setOpeningServiceId((current) => (current === serviceId ? null : current));
      loadingResetTimerRef.current = null;
    }, delayMs);
  };

  const handleServiceClick = async (service: HubServiceDTO) => {
    if (!service.attivo || service.in_manutenzione || openingServiceId) return;

    setOpeningServiceId(service.id);
    // Garantisce almeno un frame di rendering del loading prima dell'apertura.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    let shouldResetInFinally = true;

    if (service.tipo_url === 'external_fico') {
      try {
        const urlServer = ServerCall.getUrl();
        const contextEndpoint = new URL(`${urlServer}/hub-services/fico-context`);
        const route = normalizeHubServiceRedirectPage(service.redirect_page);

        if (route) {
          contextEndpoint.searchParams.set('route', route);
        }

        const res = await fetch(contextEndpoint.toString(), { credentials: 'include' });
        const { context, base_url } = await res.json() as { context: string; base_url: string | null };
        const targetUrl = new URL(
          isHubServiceAbsoluteUrl(service.url) ? service.url : (base_url ?? service.url)
        );
        targetUrl.searchParams.set('context', context);
        window.open(targetUrl.toString(), '_blank');
      } catch {
        window.open(service.url, '_blank');
      } finally {
        if (shouldResetInFinally) {
          scheduleLoadingReset(service.id, 250);
        }
      }
    } else if (service.tipo_url === 'external') {
      window.open(service.url, '_blank');
      if (shouldResetInFinally) {
        scheduleLoadingReset(service.id, 250);
      }
    } else {
      shouldResetInFinally = false;
      navigate(service.url);
      // Fallback: se la navigazione non cambia pagina, evita loading bloccato.
      scheduleLoadingReset(service.id, 1500);
    }
  };

  useEffect(() => {
    window.dispatchEvent(new Event("app:ready"));
  }, []);

  useEffect(() => {
    if (userError) {
      window.location.href = '/login';
    }
  }, [userError]);

  useEffect(() => {
    return () => {
      if (loadingResetTimerRef.current) {
        window.clearTimeout(loadingResetTimerRef.current);
      }
    };
  }, []);

  const renderServiceGrid = (items: HubServiceDTO[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {items.map((service, index) => (
        <ServiceCard
          key={service.id}
          service={service}
          index={index}
          isLoading={openingServiceId === service.id}
          disableInteractions={Boolean(openingServiceId)}
          onClick={() => handleServiceClick(service)}
          onInfoClick={() => setSelectedService(service)}
        />
      ))}
    </div>
  );

  // Redirect se non autenticato
  if (userError) {
    return null;
  }

  return (
    <div className="relative min-h-screen">
      {/* Background moderno */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-slate-100" />
        <div className="absolute top-0 inset-x-0 h-[420px] bg-gradient-to-b from-theme-1/[0.12] to-transparent" />
        <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-theme-1/[0.15] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] bg-theme-2/[0.10] blur-[140px] rounded-full" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noise\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"2\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noise)\"/%3E%3C/svg%3E')",
          }}
        />
      </div>
      {/* Contenuto */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

        {/* Header con logo */}
        <div className="flex items-center justify-center mb-7">
          <img src={IstantaLogo} alt="Istanta 2 GDO Suite" className="h-20 sm:h-24" />
        </div>

        {/* Welcome banner */}
        {loadingUser ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 animate-pulse shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-100" />
              <div>
                <div className="h-7 bg-slate-200 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-32" />
              </div>
            </div>
          </div>
        ) : userInfo ? (
          <UserWelcome
            email={userInfo.email}
            tipoUtente={userInfo.tipo_utente}
            servicesCount={services.length}
            photo={userInfo.photo}
            ruoloGDO={userInfo.ruolo_gdo_key}
          />
        ) : null}

        {/* ═══ Sezione In Evidenza ═══ */}
        {!loadingServices && featuredServices.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Lucide icon="Star" className="w-4 h-4 text-slate-500" />
              <h2 className="font-urbanist text-xl font-semibold text-slate-800">
                In evidenza
              </h2>
            </div>
            <div className={`grid gap-5 ${featuredServices.length === 1
              ? 'grid-cols-1 max-w-xl'
              : 'grid-cols-1 md:grid-cols-2'
              }`}>
              {featuredServices.map((service, index) => (
                <FeaturedServiceCard
                  key={service.id}
                  service={service}
                  index={index}
                  isLoading={openingServiceId === service.id}
                  disableInteractions={Boolean(openingServiceId)}
                  onClick={() => handleServiceClick(service)}
                />
              ))}
            </div>
          </section>
        )}



        {/* ═══ Sezione Tutti i Servizi ═══ */}
        <section className="mt-10">
          {loadingServices ? (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lucide icon="LayoutGrid" className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-space-grotesk text-lg font-semibold text-slate-800">
                    Servizi attivi
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ServiceCardSkeleton key={`active-skeleton-${i}`} />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lucide icon="CircleOff" className="w-4 h-4 text-slate-500" />
                  <h3 className="font-space-grotesk text-lg font-semibold text-slate-800">
                    Servizi non attivi
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <ServiceCardSkeleton key={`inactive-skeleton-${i}`} />
                  ))}
                </div>
              </div>
            </div>
          ) : regularServices.length > 0 ? (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lucide icon="LayoutGrid" className="w-4 h-4 text-emerald-600" />
                  <div className="flex items-center gap-2">
                    <h3 className="font-space-grotesk text-lg font-semibold text-slate-800">
                      Servizi attivi
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                      {activeRegularServices.length}
                    </span>
                  </div>
                </div>

                {activeRegularServices.length > 0 ? (
                  renderServiceGrid(activeRegularServices)
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-6">
                    <p className="text-sm text-emerald-800 font-medium">
                      Nessun servizio attivo in questa sezione.
                    </p>
                    <p className="text-sm text-emerald-700/80 mt-1">
                      I servizi disponibili compariranno qui non appena saranno abilitati.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lucide icon="CircleOff" className="w-4 h-4 text-slate-500" />
                  <div className="flex items-center gap-2">
                    <h3 className="font-space-grotesk text-lg font-semibold text-slate-800">
                      Servizi non attivi
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                      {inactiveRegularServices.length}
                    </span>
                  </div>
                </div>

                {inactiveRegularServices.length > 0 ? (
                  renderServiceGrid(inactiveRegularServices)
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6">
                    <p className="text-sm text-slate-700 font-medium">
                      Nessun servizio non attivo al momento.
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      I servizi disattivati o in manutenzione verranno mostrati qui.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : !featuredServices.length ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Lucide icon="PackageOpen" className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-600 mb-1">
                Nessun servizio disponibile
              </h3>
              <p className="text-sm text-slate-400">
                Non ci sono servizi disponibili per il tuo ruolo.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-5 py-6">
              <p className="text-sm text-slate-700 font-medium">
                Tutti i servizi disponibili sono gi\u00e0 presenti nella sezione In evidenza.
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Qui compariranno automaticamente eventuali altri servizi attivi o non disponibili.
              </p>
            </div>
          )}
        </section>
        {/* ═══ Sezione News ═══ */}
        {(loadingNews || news.length > 0) && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Lucide icon="Newspaper" className="w-4 h-4 text-slate-500" />
              <h2 className="font-urbanist text-xl font-semibold text-slate-800">
                Novità e aggiornamenti
              </h2>
            </div>
            {loadingNews ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <NewsCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {news.slice(0, 6).map((item, index) => (
                  <NewsCard key={item.id} news={item} index={index} />
                ))}
              </div>
            )}
          </section>
        )}
        {/* Footer */}
        <footer className="mt-16 pb-6">
          {/* Divider gradient */}
          <div className="h-px bg-gradient-to-r from-transparent via-theme-1/20 to-transparent mb-8" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Branding */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-theme-1 to-theme-2 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white leading-none">SL</span>
              </div>
              <span className="text-sm font-medium text-slate-500">
                Powered by <span className="text-slate-700 font-semibold">Singular Lab</span>
              </span>
            </div>

            {/* Info */}
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Istanta &middot; Tutti i diritti riservati
            </p>
          </div>
        </footer>
      </div>

      <ServiceDetailsModal
        open={Boolean(selectedService)}
        service={selectedService!}
        isOpening={selectedService ? openingServiceId === selectedService.id : false}
        onClose={() => setSelectedService(null)}
        onOpenService={(service) => {
          setSelectedService(null);
          void handleServiceClick(service);
        }}
      />
    </div>
  );
};

export default ServicesDashboard;
