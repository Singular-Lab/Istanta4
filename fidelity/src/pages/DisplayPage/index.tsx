import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDeviceSocket } from "@/hooks/useDeviceSocket";

/* ======================================================
 * TYPES
 * ====================================================== */

interface DisplayFile {
  url?: string;
  nome?: string;
  mime?: string;
  blob?: string;
  id?: string;
}

interface DisplayContext {
  endpoint_type: string;
  auto_scroll: boolean;
  scroll_speed: number;
  show_indicators: boolean;
  show_nav_buttons: boolean;
  render_type?: "carousel" | "grid";
  meta_options: Record<string, unknown>;
}

interface DisplayFilesResponse {
  device_id: string;
  display_context: DisplayContext;
  files: DisplayFile[];
  conteggio: number;
}

/* ======================================================
 * HELPERS
 * ====================================================== */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function fetchDisplayFiles(token: string): Promise<DisplayFilesResponse> {
  const res = await fetch(`${API_BASE}/display/files?t=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Errore ${res.status}`);
  }
  return res.json();
}

function isImage(file: DisplayFile): boolean {
  if (file.mime) return file.mime.startsWith("image/");
  if (file.url) return /\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?|$)/i.test(file.url);
  return false;
}

function isPdf(file: DisplayFile): boolean {
  if (file.mime) return file.mime === "application/pdf";
  if (file.url) return /\.pdf(\?|$)/i.test(file.url);
  return false;
}

function getFileUrl(file: DisplayFile): string {
  return file.url ?? file.blob ?? "";
}

/* ======================================================
 * COMPONENT
 * ====================================================== */

export default function DisplayPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") ?? "";

  const [data, setData] = useState<DisplayFilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket connection for real-time status
  const { isConnected, isAuthenticated, sendSlideChange } = useDeviceSocket({
    token: token || null,
    onAuthError: (message) => {
      console.warn('[DisplayPage] WebSocket auth error:', message);
    },
  });

  // Send slide change when currentIndex changes
  useEffect(() => {
    if (isAuthenticated && data?.files) {
      const currentFile = data.files[currentIndex];
      sendSlideChange(currentIndex, data.files.length, currentFile?.nome, currentFile?.url);
    }
  }, [currentIndex, isAuthenticated, data?.files, sendSlideChange]);

  /* ---- Fetch files ---- */
  const load = useCallback(async () => {
    if (!token) {
      setError("Token mancante. Aggiungi ?t=<token> all'URL.");
      setLoading(false);
      return;
    }
    try {
      const result = await fetchDisplayFiles(token);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load + periodic refresh (every 5 min to pick up new files + heartbeat)
  useEffect(() => {
    load();
    const refreshInterval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [load]);

  /* ---- Auto-scroll carousel ---- */
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const ctx = data?.display_context;
    const filesCount = data?.files?.length ?? 0;

    if (!ctx?.auto_scroll || filesCount <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filesCount);
    }, ctx.scroll_speed || 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data]);

  /* ---- Navigation ---- */
  const goTo = (index: number) => {
    const len = data?.files?.length ?? 0;
    if (len === 0) return;
    setCurrentIndex(((index % len) + len) % len);
  };

  /* ---- Render helpers ---- */
  const renderFile = (file: DisplayFile, style?: React.CSSProperties) => {
    const url = getFileUrl(file);
    if (!url) return <div style={{ ...fullScreenStyle, ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
      <p style={{ color: "#888" }}>File non disponibile</p>
    </div>;

    if (isImage(file)) {
      return (
        <img
          src={url}
          alt={file.nome ?? ""}
          style={{
            ...fullScreenStyle,
            ...style,
            objectFit: "contain",
            background: "#000",
          }}
        />
      );
    }

    if (isPdf(file)) {
      return (
        <iframe
          src={url}
          title={file.nome ?? "PDF"}
          style={{
            ...fullScreenStyle,
            ...style,
            border: "none",
            background: "#fff",
          }}
        />
      );
    }

    // Fallback: try rendering as image
    return (
      <img
        src={url}
        alt={file.nome ?? ""}
        style={{
          ...fullScreenStyle,
          ...style,
          objectFit: "contain",
          background: "#000",
        }}
      />
    );
  };

  /* ---- States: loading / error / empty ---- */
  if (loading) {
    return (
      <div style={centeredContainerStyle}>
        <style>{`@keyframes display-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={spinnerStyle} />
        <p style={{ color: "#aaa", marginTop: 16 }}>Caricamento display...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centeredContainerStyle}>
        <p style={{ color: "#ef4444", fontSize: 18 }}>{error}</p>
      </div>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <div style={centeredContainerStyle}>
        <p style={{ color: "#888", fontSize: 18 }}>Nessun contenuto da mostrare</p>
      </div>
    );
  }

  const ctx = data.display_context;
  const files = data.files;

  /* ---- Grid mode ---- */
  if (ctx.render_type === "grid") {
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "auto", background: "#000", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8, padding: 8 }}>
        {files.map((file, i) => (
          <div key={file.id ?? i} style={{ aspectRatio: "16/9", overflow: "hidden", borderRadius: 4 }}>
            {renderFile(file, { width: "100%", height: "100%", position: "relative" })}
          </div>
        ))}
      </div>
    );
  }

  /* ---- Carousel mode (default) ---- */
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000", position: "relative" }}>
      {renderFile(files[currentIndex])}

      {/* Navigation buttons */}
      {ctx.show_nav_buttons && files.length > 1 && (
        <>
          <button
            onClick={() => goTo(currentIndex - 1)}
            style={navButtonStyle("left")}
            aria-label="Precedente"
          >
            &#8249;
          </button>
          <button
            onClick={() => goTo(currentIndex + 1)}
            style={navButtonStyle("right")}
            aria-label="Successivo"
          >
            &#8250;
          </button>
        </>
      )}

      {/* Indicators */}
      {ctx.show_indicators && files.length > 1 && (
        <div style={indicatorsContainerStyle}>
          {files.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: i === currentIndex ? "#fff" : "rgba(255,255,255,0.4)",
                transition: "background 0.2s",
              }}
              aria-label={`Vai al file ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ======================================================
 * STYLES
 * ====================================================== */

const fullScreenStyle: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  position: "absolute",
  top: 0,
  left: 0,
};

const centeredContainerStyle: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#000",
};

const spinnerStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  border: "3px solid rgba(255,255,255,0.2)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  animation: "display-spin 0.8s linear infinite",
};

const indicatorsContainerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 8,
  zIndex: 10,
};

const navButtonStyle = (side: "left" | "right"): React.CSSProperties => ({
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  [side]: 16,
  zIndex: 10,
  background: "rgba(0,0,0,0.5)",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: 48,
  height: 48,
  fontSize: 28,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
});
