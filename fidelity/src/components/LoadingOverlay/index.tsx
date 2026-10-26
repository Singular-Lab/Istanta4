import { lazy, Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom";
//@ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";

const DotLottieLoader = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({
    default: m.DotLottieReact,
  }))
);

const LoadingOverlay = ({
  hasError = false,
  title,
  isVisible = true,
}: {
  hasError?: boolean;
  title?: string;
  isVisible?: boolean;
}) => {
  const [animationError, setAnimationError] = useState(hasError);
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);

  useEffect(() => {
    setAnimationError(hasError);
  }, [hasError]);

  // Gestisce entrata/uscita con CSS transitions
  useEffect(() => {
    if (isVisible) {
      setExit(false);
      requestAnimationFrame(() => setShow(true));
    } else if (show) {
      setExit(true);
      const timer = setTimeout(() => {
        setShow(false);
        setExit(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!show && !isVisible) return null;

  return ReactDOM.createPortal(
    <div
      className="loading-overlay-backdrop"
      style={{ opacity: show && !exit ? 1 : 0 }}
    >
      <div
        className="loading-overlay-content"
        style={{
          opacity: show && !exit ? 1 : 0,
          transform: show && !exit ? "scale(1) translateY(0)" : "scale(0.8) translateY(20px)",
        }}
      >
        <div className="loading-overlay-icon">
          {!animationError ? (
            <Suspense fallback={<FallbackSpinner />}>
              <DotLottieLoader
                autoplay
                loop
                src={lottieAnimation}
                style={{ height: "150px", width: "150px" }}
                onError={() => setAnimationError(true)}
              />
            </Suspense>
          ) : (
            <FallbackSpinner />
          )}
        </div>

        <div className="loading-overlay-title">
          Caricamento in corso...
        </div>

        <div className="loading-overlay-subtitle">
          {title ? title : "Un momento, stiamo preparando tutto per te"}
        </div>
      </div>
    </div>,
    document.body
  );
};

function FallbackSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="loading-overlay-spinner" />
    </div>
  );
}

export default LoadingOverlay;
