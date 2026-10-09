// ErrorPage.tsx
// src/components/ErrorPage/index.tsx
//@ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import NotFoundPage from '@/components/NotFoundPage';
import { t } from 'i18next';

import { lazy, Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { fetchSideMenu, selectSideMenuStartPage } from "../../stores/sideMenuSlice_istanta";
import type { AppDispatch } from "../../stores/store";

// Lazy come in AppErrorFallback: il router importa ErrorPage nel bundle iniziale
const DotLottieReact = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({ default: m.DotLottieReact }))
);

// Resa nell'Outlet di Echo, il menu resta visibile. La schermata di accesso negato
// vale solo per 401/403: un errore di caricamento dei dati mostra la pagina non caricata.
const ErrorPage = () => {
  const error = useRouteError() as any;
  // Risposta di rotta (throw404) oppure errore di ServerCall (AppError con httpStatus)
  const status: number | undefined = isRouteErrorResponse(error) ? error.status : error?.httpStatus;

  if (!error || status === 404) return <NotFoundPage />;
  if (status === 401 || status === 403) return <AccessoNegato />;

  const motivo = isRouteErrorResponse(error)
    ? t(`http.${error.status}`, { defaultValue: t("errors.generic") })
    : error instanceof Error ? error.message : t("errors.generic");

  return <PaginaNonCaricata motivo={motivo} />;
};

const PaginaNonCaricata = ({ motivo }: { motivo: string }) => (
  <div className="box box--stacked min-h-[calc(100vh-12rem)] flex items-center justify-center px-6">
    <div className="w-full max-w-lg text-center space-y-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-danger/10 text-danger">
        <Lucide icon="TriangleAlert" className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Impossibile caricare la pagina
        </h1>
        <p className="text-slate-500 leading-relaxed">{motivo}</p>
      </div>
      <Button
        type="button"
        variant="primary"
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 rounded-full"
      >
        <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
        Riprova
      </Button>
    </div>
  </div>
);

const AccessoNegato = () => {
  const dispatch: AppDispatch = useDispatch();
  const startPage = useSelector(selectSideMenuStartPage);

  useEffect(() => {
    if (!startPage) {
      dispatch(fetchSideMenu());
    }
  }, [dispatch, startPage]);

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-6 rounded-xl bg-[#03045e] bg-opacity-90">
      <div className="text-center flex flex-col items-center">
        <Lucide
          icon="TriangleAlert"
          className="w-20 h-20 text-warning animate-pulse"
        />
        <h1 className="mt-6 text-white text-2xl font-bold">
          Accesso negato
        </h1>
        <p className="mt-2 text-gray-300 text-sm max-w-sm">
          Non hai i permessi per accedere a questa pagina. Se pensi che questo sia un errore, contatta l'amministratore o effettua nuovamente il login.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            window.location.href = startPage || "/";
          }}
          className="mt-6 px-6 py-2 bg-white text-[#03045e] font-semibold rounded-full hover:bg-gray-100"
        >
          Torna al Login
        </Button>
        <div className="mt-10">
          <Suspense fallback={null}>
            <DotLottieReact
              autoplay
              loop
              src={lottieAnimation}
              style={{ height: '150px', width: '150px' }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
