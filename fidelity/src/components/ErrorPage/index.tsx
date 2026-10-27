// ErrorPage.tsx
// src/components/ErrorPage/index.tsx
import PageError from '@/components/Base/PageError';
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
  <PageError motivo={motivo} onRiprova={() => window.location.reload()} />
);

export default ErrorPage;
