// ErrorPage.tsx
// src/components/ErrorPage/index.tsx
//@ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
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

const ErrorPage = () => {
  const error = useRouteError() as any;
  const dispatch: AppDispatch = useDispatch();
  const startPage = useSelector(selectSideMenuStartPage);
  let errorMessage = t("errors.generic");

  if (!error) {
    errorMessage = t("errors.not_found");
  } else if (isRouteErrorResponse(error)) {
    errorMessage = t(`http.${error.status}`, {
      defaultValue: t("errors.generic")
    });
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  useEffect(() => {
    if (!startPage) {
      dispatch(fetchSideMenu());
    }
  }, [dispatch, startPage]);


  return (
    // Nel flusso della pagina (non overlay fisso): resa nell'Outlet di Echo, il menu resta visibile
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-6 rounded-xl bg-[#03045e] bg-opacity-90">
      <div className="text-center flex flex-col items-center">
        <Lucide
          icon="TriangleAlert"
          className="w-20 h-20 text-warning animate-pulse"
        />
        <h1 className="mt-6 text-white text-2xl font-bold">
          {errorMessage}
        </h1>
        {(process.env.NODE_ENV === "development" && error?.message == undefined) ? (
          <p className="mt-2 text-gray-300 text-sm max-w-sm">
            Non hai i permessi per accedere a questa pagina o la pagina non esiste. Se pensi che questo sia un errore, contatta l'amministratore o effettua nuovamente il login.
          </p>
        ) : (
          null
        )}
        {
          error?.message == undefined ? (
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
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                window.location.reload();
              }}
              className="mt-6 px-6 py-2 bg-white text-[#03045e] font-semibold rounded-full hover:bg-gray-100"
            >
              Ricarica la pagina
            </Button>
          )
        }
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
