// ErrorPage.tsx
// src/components/ErrorPage/index.tsx
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import AccessoNegato from '@/components/AccessoNegato';
import NotFoundPage from '@/components/NotFoundPage';
import { t } from 'i18next';

import { isRouteErrorResponse, useRouteError } from "react-router-dom";

// Resa nell'Outlet di Echo, il menu resta visibile. La schermata di accesso negato
// vale solo per 401/403: un errore di caricamento dei dati mostra la pagina non caricata.
const ErrorPage = () => {
  const error = useRouteError() as any;
  // Risposta di rotta (throw404) oppure errore di ServerCall (AppError con httpStatus)
  const status: number | undefined = isRouteErrorResponse(error) ? error.status : error?.httpStatus;

  if (!error || status === 404) return <NotFoundPage />;
  if (status === 401 || status === 403) return <AccessoNegato aSchermoIntero={false} />;

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

export default ErrorPage;
