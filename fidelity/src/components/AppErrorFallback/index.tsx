// src/components/AppErrorFallback.tsx
//@ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";

import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { lazy, Suspense } from "react";

const DotLottieReact = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({ default: m.DotLottieReact }))
);


interface AppErrorFallbackProps {
    error?: Error;
}

const AppErrorFallback = ({ error }: AppErrorFallbackProps) => {
    const message =
        error?.message || "Si è verificato un errore imprevisto nell'applicazione.";

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#03045e] bg-opacity-90 backdrop-blur-md z-[100000] transition-opacity duration-300">
            <div className="text-center flex flex-col items-center">
                <Lucide
                    icon="TriangleAlert"
                    className="w-20 h-20 text-warning animate-pulse"
                />
                <h1 className="mt-6 text-white text-2xl font-bold">
                    {message}
                </h1>

                {process.env.NODE_ENV === "development" && error?.stack && (
                    <p className="mt-2 text-gray-300 text-xs max-w-sm whitespace-pre-wrap text-left">
                        {error.stack}
                    </p>
                )}

                <Button
                    type="button"
                    variant="primary"
                    onClick={() => window.location.reload()}
                    className="mt-6 px-6 py-2 bg-white text-[#03045e] font-semibold rounded-full hover:bg-gray-100"
                >
                    Ricarica la pagina
                </Button>

                <div className="mt-10">
                    <Suspense fallback={null}>
                        <DotLottieReact
                            autoplay
                            loop
                            src={lottieAnimation}
                            style={{ height: "150px", width: "150px" }}
                        />
                    </Suspense>
                </div>
            </div>
        </div>
    );
};

export default AppErrorFallback;
