import IstantaLogo from "@/assets/images/logo_ext.png";
import Badge from "@/components/Base/Badge";
import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
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
          <div className="rounded-card border border-slate-200 bg-white p-8 shadow-card">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 flex-none rounded-card" />
              <div className="w-48 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        ) : userInfo ? (
          <UserWelcome
            email={userInfo.email}
            tipoUtente={userInfo.tipo_utente}
            servicesCount={loadingServices ? undefined : services.length}
            photo={userInfo.photo}
            ruoloGDO={userInfo.ruolo_gdo_key}
          />
        ) : null}

        {/* ═══ Sezione In Evidenza ═══ */}
        {!loadingServices && featuredServices.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <Lucide icon="Star" aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <h2 className="title-section">
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
                <div className="mb-4 flex items-center gap-2">
                  <Lucide icon="LayoutGrid" aria-hidden="true" className="h-4 w-4 text-success" />
                  <h3 className="title-card">
                    Servizi attivi
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ServiceCardSkeleton key={`active-skeleton-${i}`} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Lucide icon="CircleOff" aria-hidden="true" className="h-4 w-4 text-slate-500" />
                  <h3 className="title-card">
                    Servizi non attivi
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <ServiceCardSkeleton key={`inactive-skeleton-${i}`} />
                  ))}
                </div>
              </div>
            </div>
          ) : regularServices.length > 0 ? (
            <div className="space-y-8">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Lucide icon="LayoutGrid" aria-hidden="true" className="h-4 w-4 text-success" />
                  <h3 className="title-card">
                    Servizi attivi
                  </h3>
                  <Badge variant="success" size="sm">
                    {activeRegularServices.length}
                  </Badge>
                </div>

                {activeRegularServices.length > 0 ? (
                  renderServiceGrid(activeRegularServices)
                ) : (
                  <EmptyState
                    compatta
                    icon="LayoutGrid"
                    title="Nessun servizio attivo in questa sezione"
                    description="I servizi disponibili compariranno qui non appena saranno abilitati."
                    className="border border-dashed border-slate-200"
                  />
                )}
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Lucide icon="CircleOff" aria-hidden="true" className="h-4 w-4 text-slate-500" />
                  <h3 className="title-card">
                    Servizi non attivi
                  </h3>
                  <Badge variant="secondary" size="sm">
                    {inactiveRegularServices.length}
                  </Badge>
                </div>

                {inactiveRegularServices.length > 0 ? (
                  renderServiceGrid(inactiveRegularServices)
                ) : (
                  <EmptyState
                    compatta
                    icon="CircleOff"
                    title="Nessun servizio non attivo al momento"
                    description="I servizi disattivati o in manutenzione verranno mostrati qui."
                    className="border border-dashed border-slate-200"
                  />
                )}
              </div>
            </div>
          ) : !featuredServices.length ? (
            <EmptyState
              icon="PackageOpen"
              title="Nessun servizio disponibile"
              description="Non ci sono servizi disponibili per il tuo ruolo."
              className="border border-slate-200 shadow-card"
            />
          ) : (
            <EmptyState
              compatta
              icon="Star"
              title="Tutti i servizi disponibili sono già presenti nella sezione In evidenza"
              description="Qui compariranno automaticamente eventuali altri servizi attivi o non disponibili."
              className="border border-dashed border-slate-200"
            />
          )}
        </section>
        {/* ═══ Sezione News ═══ */}
        {(loadingNews || news.length > 0) && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <Lucide icon="Newspaper" aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <h2 className="title-section">
                Novità e aggiornamenti
              </h2>
            </div>
            {loadingNews ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <NewsCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <div aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-control bg-gradient-to-br from-theme-1 to-theme-2">
                <span className="text-3xs font-bold leading-none text-white">SL</span>
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
