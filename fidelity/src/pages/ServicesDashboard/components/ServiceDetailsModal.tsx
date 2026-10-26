import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { HubServiceDocumentAsset, HubServiceDTO } from "../../../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceDetailsModalProps {
  open: boolean;
  service: HubServiceDTO | null;
  isOpening?: boolean;
  onClose: () => void;
  onOpenService: (service: HubServiceDTO) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isBase64Icon(icona: string): boolean {
  return typeof icona === "string" && icona.startsWith("data:");
}

function getDocumentIcon(doc: HubServiceDocumentAsset): { icon: string; colorClass: string } {
  const mime = doc.mime_type.toLowerCase();
  const ext = doc.extension?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf")
    return { icon: "FileText", colorClass: "text-slate-600" };
  if (mime.includes("spreadsheet") || mime.includes("excel") || ext === "xls" || ext === "xlsx")
    return { icon: "Table", colorClass: "text-green-600" };
  if (mime.includes("wordprocessing") || mime.includes("word") || mime.includes("msword") || ext === "doc" || ext === "docx")
    return { icon: "FileText", colorClass: "text-blue-600" };
  if (mime.includes("csv") || ext === "csv")
    return { icon: "Grid3x3", colorClass: "text-teal-600" };
  return { icon: "File", colorClass: "text-slate-500" };
}

interface ServiceMediaFallbackProps {
  service: HubServiceDTO;
  compact?: boolean;
  className?: string;
}

const ServiceMediaFallback: React.FC<ServiceMediaFallbackProps> = ({
  service,
  compact = false,
  className,
}) => (
  <div
    className={clsx(
      "flex items-center justify-center rounded-xl border border-white/10 bg-white/5",
      className
    )}
  >
    {isBase64Icon(service.icona) ? (
      <img
        src={service.icona}
        alt={service.nome}
        className={clsx(
          "object-contain rounded-2xl",
          compact ? "w-16 h-16 sm:w-20 sm:h-20" : "w-16 h-16"
        )}
      />
    ) : (
      <div
        className={clsx(
          "flex items-center justify-center rounded-2xl border border-white/10 bg-white/10",
          compact ? "w-20 h-20 sm:w-24 sm:h-24" : "w-16 h-16"
        )}
      >
        <Lucide
          icon={service.icona}
          className={clsx(
            "text-white/80",
            compact ? "w-10 h-10 sm:w-12 sm:h-12" : "w-8 h-8"
          )}
        />
      </div>
    )}
  </div>
);

// ── VideoPlayer (guide videos) ────────────────────────────────────────────────

interface VideoPlayerProps {
  videoKey: string;
  src: string;
  mimeType: string;
  autoPlay?: boolean;
  startMuted?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoKey,
  src,
  mimeType,
  autoPlay,
  startMuted,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(!!startMuted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync muted state directly to DOM element
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Track fullscreen for this specific container
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Cleanup hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const scheduleHide = () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setShowControls(false), 3000);
  };

  const handleMouseEnter = () => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    scheduleHide();
  };

  const handleMouseLeave = () => scheduleHide();

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => { });
    else v.pause();
  };

  const seek = (clientX: number) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = ratio * v.duration;
    if (isFinite(target)) {
      v.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    seek(e.clientX);
    const onMove = (ev: MouseEvent) => seek(ev.clientX);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement)
      containerRef.current?.requestFullscreen().catch(() => { });
    else
      document.exitFullscreen().catch(() => { });
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative bg-black select-none cursor-pointer",
        className,
        isFullscreen && "h-screen w-screen"
      )}
      onClick={togglePlay}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        key={videoKey}
        autoPlay={autoPlay}
        muted={startMuted}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onPlay={() => {
          setIsPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
          if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
        }}
        className="w-full h-full object-contain cursor-pointer"
      >
        <source src={src} type={mimeType} />
      </video>

      {/* Controls overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "absolute bottom-0 left-0 right-0 z-10",
          "bg-gradient-to-t from-black/80 via-black/20 to-transparent",
          "transition-opacity duration-300",
          showControls || !isPlaying
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        )}
      >
        {/* Seek bar */}
        <div className="px-4 pt-8 pb-2">
          <div
            ref={progressRef}
            className="group/bar relative h-1 hover:h-[5px] bg-white/25 rounded-full cursor-pointer transition-all duration-150"
            onMouseDown={handleProgressMouseDown}
          >
            <div
              className="h-full bg-white rounded-full relative transition-none"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150" />
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <button
            type="button"
            onClick={togglePlay}
            className="text-white/90 hover:text-white transition-colors focus:outline-none"
          >
            <Lucide icon={isPlaying ? "Pause" : "Play"} className="w-5 h-5" />
          </button>
          <span className="text-white/60 text-xs font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setIsMuted(m => !m)}
            className="text-white/90 hover:text-white transition-colors focus:outline-none"
          >
            <Lucide icon={isMuted ? "VolumeX" : "Volume2"} className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-white/90 hover:text-white transition-colors focus:outline-none"
          >
            <Lucide icon={isFullscreen ? "Minimize2" : "Maximize2"} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center play/pause flash on click */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Lucide icon="Play" className="w-7 h-7 text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};

// ── ServiceDetailsModal ───────────────────────────────────────────────────────

const ServiceDetailsModal = ({
  open,
  service,
  isOpening,
  onClose,
  onOpenService,
}: ServiceDetailsModalProps) => {
  // Active video IDs
  const [activeTrailerId, setActiveTrailerId] = useState<string | null>(null);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

  // Hero trailer player state
  const trailerRef = useRef<HTMLVideoElement>(null);
  const trailerContainerRef = useRef<HTMLDivElement>(null);
  const trailerProgressRef = useRef<HTMLDivElement>(null);
  const trailerHideTimerRef = useRef<number | null>(null);
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const [trailerMuted, setTrailerMuted] = useState(true);
  const [trailerTime, setTrailerTime] = useState(0);
  const [trailerDuration, setTrailerDuration] = useState(0);
  const [showTrailerControls, setShowTrailerControls] = useState(true);
  const [trailerFullscreen, setTrailerFullscreen] = useState(false);

  // Init active IDs when service changes
  useEffect(() => {
    const trailers = service?.videos.filter(v => v.kind === "trailer") ?? [];
    const guides = service?.videos.filter(v => v.kind === "guide") ?? [];
    setActiveTrailerId(trailers[0]?.id ?? null);
    setActiveGuideId(guides[0]?.id ?? null);
  }, [service]);

  // Reset trailer player state on trailer switch
  useEffect(() => {
    setTrailerMuted(true);
    setTrailerTime(0);
    setTrailerDuration(0);
    setTrailerPlaying(false);
    setShowTrailerControls(true);
    if (trailerHideTimerRef.current) window.clearTimeout(trailerHideTimerRef.current);
  }, [activeTrailerId]);

  // Fullscreen tracking for trailer container
  useEffect(() => {
    const handler = () =>
      setTrailerFullscreen(document.fullscreenElement === trailerContainerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Escape key — don't close while fullscreen
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Scroll-lock + cleanup on close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (trailerHideTimerRef.current) window.clearTimeout(trailerHideTimerRef.current);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    };
  }, [open]);

  // Trailer controls helpers
  const scheduleHideTrailerControls = () => {
    if (trailerHideTimerRef.current) window.clearTimeout(trailerHideTimerRef.current);
    trailerHideTimerRef.current = window.setTimeout(
      () => setShowTrailerControls(false),
      3000
    );
  };

  const toggleTrailerPlay = () => {
    const v = trailerRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => { });
    else v.pause();
  };

  const toggleTrailerMute = () => {
    const next = !trailerMuted;
    if (trailerRef.current) trailerRef.current.muted = next;
    setTrailerMuted(next);
  };

  const toggleTrailerFullscreen = () => {
    if (!document.fullscreenElement)
      trailerContainerRef.current?.requestFullscreen().catch(() => { });
    else
      document.exitFullscreen().catch(() => { });
  };

  const handleTrailerSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const doSeek = (clientX: number) => {
      const bar = trailerProgressRef.current;
      const v = trailerRef.current;
      if (!bar || !v) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const target = ratio * v.duration;
      if (isFinite(target)) {
        v.currentTime = target;
        setTrailerTime(target);
      }
    };
    doSeek(e.clientX);
    const onMove = (ev: MouseEvent) => doSeek(ev.clientX);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!open || !service) return null;

  const videos = service.videos ?? [];
  const documents = service.documents ?? [];
  const trailers = videos.filter(v => v.kind === "trailer");
  const guides = videos.filter(v => v.kind === "guide");
  const activeTrailer = trailers.find(v => v.id === activeTrailerId) ?? trailers[0] ?? null;
  const activeGuide = guides.find(v => v.id === activeGuideId) ?? guides[0] ?? null;
  const isUnavailable = !service.attivo || service.in_manutenzione;
  const hasContent = videos.length > 0 || documents.length > 0;
  const trailerProgress = trailerDuration > 0 ? (trailerTime / trailerDuration) * 100 : 0;
  const showTrailerThumbnailOverlay = !trailerPlaying && trailerTime <= 0.1;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] overflow-y-auto">
      <div className="min-h-full flex items-stretch">
        <div className="bg-white w-full animate-fade-in-up">

          {/* ─── HERO ─────────────────────────────────────────────────── */}
          <div
            ref={trailerContainerRef}
            className={clsx(
              "relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900",
              trailerFullscreen
                ? "h-screen bg-black"
                : activeTrailer
                  ? "min-h-[320px] lg:h-[55vh]"
                  : "min-h-[240px] lg:h-[42vh]"
            )}
          >
            {/* Sfondo decorativo sempre visibile */}
            {/* Cerchi filled */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-white/15 translate-y-1/2 -translate-x-1/3 pointer-events-none" />
            {/* SVG geometrico animato */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1440 560"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <radialGradient id="hg-a1" cx="80%" cy="15%" r="55%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.50" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hg-a2" cx="12%" cy="88%" r="45%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient>
                <pattern id="hg-dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="1.2" cy="1.2" r="1.2" fill="white" fillOpacity="0.14" />
                </pattern>
                <linearGradient id="hg-beam-g" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="44%" stopColor="white" stopOpacity="0" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.28" />
                  <stop offset="56%" stopColor="white" stopOpacity="0" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <style>{`
                  @keyframes hgA1 {
                    0%,100% { transform: translate(0px,0px) scale(1); }
                    35%      { transform: translate(55px,-35px) scale(1.12); }
                    68%      { transform: translate(-25px,22px) scale(0.93); }
                  }
                  @keyframes hgA2 {
                    0%,100% { transform: translate(0px,0px) scale(1); }
                    42%      { transform: translate(-65px,38px) scale(1.09); }
                    74%      { transform: translate(38px,-28px) scale(1.05); }
                  }
                  @keyframes hgGD {
                    0%,100% { transform: translate(0px,0px); }
                    50%      { transform: translate(-18px,-13px); }
                  }
                  @keyframes hgSc {
                    0%   { transform: translateX(-220px); opacity: 0; }
                    6%   { opacity: 1; }
                    94%  { opacity: 0.8; }
                    100% { transform: translateX(1660px); opacity: 0; }
                  }
                  @keyframes hgN1 { 0%,100% { opacity: .70; } 50% { opacity: 1.00; } }
                  @keyframes hgN2 { 0%,100% { opacity: .50; } 50% { opacity: .95;  } }
                  @keyframes hgN3 { 0%,100% { opacity: .35; } 50% { opacity: .80;  } }
                  @keyframes hgL1 {
                    0%   { stroke-dashoffset: 350; opacity: .40; }
                    50%  { opacity: .90; }
                    100% { stroke-dashoffset: 0;   opacity: .40; }
                  }
                  @keyframes hgL2 {
                    0%   { stroke-dashoffset: 0;   opacity: .30; }
                    50%  { opacity: .80; }
                    100% { stroke-dashoffset: 350; opacity: .30; }
                  }
                  @keyframes hgHx  { from { transform: rotate(0deg);   } to { transform: rotate( 360deg); } }
                  @keyframes hgHxR { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
                  .hg-a1  { animation: hgA1  23s ease-in-out        infinite; }
                  .hg-a2  { animation: hgA2  29s ease-in-out        infinite; }
                  .hg-gd  { animation: hgGD  34s ease-in-out        infinite; }
                  .hg-sc  { animation: hgSc  18s ease-in-out  5s    infinite; }
                  .hg-n1  { animation: hgN1  4.2s ease-in-out       infinite; }
                  .hg-n2  { animation: hgN2  5.8s ease-in-out 0.7s  infinite; }
                  .hg-n3  { animation: hgN3  3.9s ease-in-out 1.4s  infinite; }
                  .hg-n4  { animation: hgN1  6.5s ease-in-out 2.1s  infinite; }
                  .hg-n5  { animation: hgN2  4.7s ease-in-out 0.3s  infinite; }
                  .hg-n6  { animation: hgN3  5.2s ease-in-out 1.9s  infinite; }
                  .hg-n7  { animation: hgN1  3.6s ease-in-out 3.0s  infinite; }
                  .hg-n8  { animation: hgN2  4.4s ease-in-out 0.9s  infinite; }
                  .hg-l1  { stroke-dasharray: 14 10; animation: hgL1  7.0s linear        infinite; }
                  .hg-l2  { stroke-dasharray: 10 16; animation: hgL2  9.0s linear 1.2s   infinite; }
                  .hg-l3  { stroke-dasharray: 12 12; animation: hgL1 11.0s linear 3.0s   infinite; }
                  .hg-l4  { stroke-dasharray:  8 18; animation: hgL2  8.0s linear 2.0s   infinite; }
                  .hg-l5  { stroke-dasharray: 16  8; animation: hgL1  6.0s linear 0.5s   infinite; }
                  .hg-hx1 { transform-box: fill-box; transform-origin: center; animation: hgHx   72s linear infinite; }
                  .hg-hx2 { transform-box: fill-box; transform-origin: center; animation: hgHxR  52s linear infinite; }
                  .hg-hx3 { transform-box: fill-box; transform-origin: center; animation: hgHx   95s linear infinite; }
                  .hg-hx4 { transform-box: fill-box; transform-origin: center; animation: hgHxR  66s linear infinite; }
                `}</style>
              </defs>

              {/* Aurora blobs */}

              {/* Dot grid */}
              <rect className="hg-gd" x="-60" y="-50" width="1560" height="660" fill="url(#hg-dots)" />

              {/* Hexagons — top-right */}
              <g transform="translate(1400 -30)">
                <polygon className="hg-hx1" points="0,-115 99.6,-57.5 99.6,57.5 0,115 -99.6,57.5 -99.6,-57.5"
                  fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.22" />
                <polygon className="hg-hx2" points="0,-78 67.5,-39 67.5,39 0,78 -67.5,39 -67.5,-39"
                  fill="none" stroke="white" strokeWidth="1.0" strokeOpacity="0.16" />
                <polygon className="hg-hx3" points="0,-44 38,-22 38,22 0,44 -38,22 -38,-22"
                  fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.18" />
              </g>

              {/* Hexagons — bottom-left */}
              <g transform="translate(40 590)">
                <polygon className="hg-hx2" points="0,-100 86.6,-50 86.6,50 0,100 -86.6,50 -86.6,-50"
                  fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.18" />
                <polygon className="hg-hx4" points="0,-58 50.2,-29 50.2,29 0,58 -50.2,29 -50.2,-29"
                  fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.14" />
              </g>

              {/* Constellation lines */}
              <path className="hg-l1" d="M1100,90 C1165,72 1202,62 1240,48"
                fill="none" stroke="white" strokeWidth="1.4" strokeOpacity="0.35" />
              <path className="hg-l2" d="M1100,90 C1038,118 999,136 960,155"
                fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.28" />
              <path className="hg-l3" d="M1240,48 C1285,82 1318,106 1350,130"
                fill="none" stroke="white" strokeWidth="1.1" strokeOpacity="0.26" />
              <path className="hg-l4" d="M800,55 C895,66 995,76 1100,90"
                fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.30" />
              <path className="hg-l5" d="M960,155 C788,212 682,244 570,270"
                fill="none" stroke="white" strokeWidth="1.0" strokeOpacity="0.22" />
              <path className="hg-l2" d="M152,408 C102,448 77,472 52,496"
                fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.30" />
              <path className="hg-l3" d="M152,408 C220,430 255,441 290,452"
                fill="none" stroke="white" strokeWidth="1.1" strokeOpacity="0.26" />
              <path className="hg-l4" d="M105,340 C128,374 140,391 152,408"
                fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.28" />
              <path className="hg-l1" d="M400,170 C488,215 528,242 570,270"
                fill="none" stroke="white" strokeWidth="1.0" strokeOpacity="0.22" />
              <path className="hg-l5" d="M290,452 C370,390 462,336 570,270"
                fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.18" />

              {/* Ripple rings */}
              <circle cx="1100" cy="90" r="3" fill="none" stroke="white" strokeWidth="1.2">
                <animate attributeName="r" values="3;95" dur="7s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.70;0" dur="7s" repeatCount="indefinite" />
              </circle>
              <circle cx="52" cy="496" r="3" fill="none" stroke="white" strokeWidth="1.2">
                <animate attributeName="r" values="3;80" dur="8.5s" begin="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.60;0" dur="8.5s" begin="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="570" cy="270" r="3" fill="none" stroke="white" strokeWidth="1.0">
                <animate attributeName="r" values="3;60" dur="6s" begin="5.5s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.55;0" dur="6s" begin="5.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="1350" cy="130" r="2" fill="none" stroke="white" strokeWidth="0.9">
                <animate attributeName="r" values="2;48" dur="5.5s" begin="1.5s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.55;0" dur="5.5s" begin="1.5s" repeatCount="indefinite" />
              </circle>

              {/* Constellation nodes */}
              <circle className="hg-n1" cx="1100" cy="90" r="4" fill="white" />
              <circle className="hg-n2" cx="1240" cy="48" r="3" fill="white" />
              <circle className="hg-n3" cx="960" cy="155" r="3" fill="white" />
              <circle className="hg-n4" cx="1350" cy="130" r="3" fill="white" />
              <circle className="hg-n5" cx="800" cy="55" r="2.5" fill="white" />
              <circle className="hg-n6" cx="680" cy="40" r="2" fill="white" />
              <circle className="hg-n8" cx="152" cy="408" r="4" fill="white" />
              <circle className="hg-n7" cx="52" cy="496" r="3" fill="white" />
              <circle className="hg-n1" cx="290" cy="452" r="2.5" fill="white" />
              <circle className="hg-n3" cx="105" cy="340" r="3" fill="white" />
              <circle className="hg-n5" cx="570" cy="270" r="2.5" fill="white" />
              <circle className="hg-n2" cx="400" cy="170" r="2.5" fill="white" />

              {/* Sweep beam */}
            </svg>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className={clsx(
                "absolute top-4 right-4 z-20",
                "w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm",
                "flex items-center justify-center text-white",
                "hover:bg-black/60 transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-white/40"
              )}
            >
              <Lucide icon="X" className="w-4 h-4" />
            </button>

            {/* Layout responsive: info sopra su mobile, affiancate da desktop */}
            <div
              className={clsx(
                "relative z-10 flex h-full flex-col",
                trailerFullscreen ? "justify-center" : "justify-end lg:flex-row"
              )}
            >

              {/* Sinistra: nome servizio + bottone */}
              <div
                className={clsx(
                  "flex flex-1 flex-col justify-end px-5 pb-4 pt-16 sm:px-6 sm:pb-5 lg:px-8 lg:pb-8 lg:pt-0",
                  trailerFullscreen && "hidden"
                )}
              >
                {!activeTrailer && (
                  <ServiceMediaFallback
                    service={service}
                    compact
                    className="mb-4 h-16 w-16 self-start border-white/20 bg-white/10 sm:h-20 sm:w-20"
                  />
                )}
                <h1 className="font-space-grotesk text-2xl font-bold leading-tight text-white sm:text-3xl">
                  {service.nome}
                </h1>
                <button
                  type="button"
                  disabled={isUnavailable || isOpening}
                  onClick={(e) => { e.stopPropagation(); onOpenService(service); }}
                  className={clsx(
                    "mt-3 w-fit inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg",
                    "bg-white text-slate-900 text-xs font-semibold transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-white/60",
                    isUnavailable
                      ? "opacity-40 cursor-not-allowed"
                      : isOpening
                        ? "opacity-60 cursor-wait"
                        : "hover:bg-white/90 hover:shadow-lg cursor-pointer"
                  )}
                >
                  {isOpening ? (
                    <>
                      <Lucide icon="Loader2" className="w-4 h-4 animate-spin" />
                      Apertura...
                    </>
                  ) : isUnavailable ? (
                    <>
                      <Lucide icon={!service.attivo ? "CircleOff" : "Wrench"} className="w-4 h-4" />
                      {!service.attivo ? "Servizio disattivato" : "In manutenzione"}
                    </>
                  ) : (
                    <>
                      Accedi al servizio
                      <Lucide
                        icon={
                          service.tipo_url === "external" || service.tipo_url === "external_fico"
                            ? "ExternalLink"
                            : "ArrowRight"
                        }
                        className="w-4 h-4"
                      />
                    </>
                  )}
                </button>
              </div>

              {activeTrailer && (
                <div
                  className={clsx(
                    "flex w-full flex-col justify-center gap-3 ",
                    trailerFullscreen
                      ? "h-full flex-1 bg-black px-4 py-4 sm:px-6 sm:py-6 md:px-8 "
                      : "px-5 pb-5 sm:px-6 sm:pb-6 lg:w-2/4 lg:p-6 "
                  )}
                >
                  <>
                    {/* Video 16:9 */}
                    <div
                      className={clsx(
                        "relative overflow-hidden cursor-pointer rounded-xl",
                        trailerFullscreen
                          ? "flex-1 min-h-0 bg-black"
                          : "aspect-video max-h-full shadow-xl"
                      )}
                      onClick={toggleTrailerPlay}
                      onMouseMove={() => {
                        setShowTrailerControls(true);
                        scheduleHideTrailerControls();
                      }}
                      onMouseLeave={() => {
                        if (trailerPlaying) scheduleHideTrailerControls();
                      }}
                    >
                      <video
                        ref={trailerRef}
                        key={activeTrailer.id}
                        muted
                        onTimeUpdate={() => {
                          if (trailerRef.current) setTrailerTime(trailerRef.current.currentTime);
                        }}
                        onLoadedMetadata={() => {
                          if (trailerRef.current) setTrailerDuration(trailerRef.current.duration);
                        }}
                        onPlay={() => {
                          setTrailerPlaying(true);
                          scheduleHideTrailerControls();
                        }}
                        onPause={() => {
                          setTrailerPlaying(false);
                          setShowTrailerControls(true);
                          if (trailerHideTimerRef.current)
                            window.clearTimeout(trailerHideTimerRef.current);
                        }}
                        className={clsx(
                          "w-full h-full select-none",
                          trailerFullscreen ? "object-contain" : "object-cover"
                        )}
                      >
                        <source src={activeTrailer.url} type={activeTrailer.mime_type} />
                      </video>
                      {showTrailerThumbnailOverlay && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-800/45 to-slate-900/75" />
                          <div className="absolute inset-0 flex items-center justify-center p-6">
                            <ServiceMediaFallback
                              service={service}
                              compact
                              className="h-full w-full max-h-44 max-w-44 border-white/15 bg-white/10"
                            />
                          </div>
                        </div>
                      )}
                      {!trailerPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            <Lucide icon="Play" className="w-6 h-6 text-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Controlli sotto il video */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={clsx(
                        trailerFullscreen && "mx-auto w-full max-w-5xl",
                        "transition-opacity duration-300",
                        showTrailerControls || !trailerPlaying
                          ? "opacity-100"
                          : "opacity-0 pointer-events-none"
                      )}
                    >
                      <div
                        ref={trailerProgressRef}
                        className="group/tp relative h-[3px] hover:h-1.5 bg-white/25 rounded-full cursor-pointer mb-2 transition-all duration-150"
                        onMouseDown={handleTrailerSeekMouseDown}
                      >
                        <div
                          className="h-full bg-white rounded-full relative transition-none"
                          style={{ width: `${trailerProgress}%` }}
                        >
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/tp:opacity-100 transition-opacity duration-150" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 select-none">
                        <button
                          type="button"
                          onClick={toggleTrailerPlay}
                          className="text-white/90 hover:text-white transition-colors focus:outline-none"
                        >
                          <Lucide icon={trailerPlaying ? "Pause" : "Play"} className="w-4 h-4" />
                        </button>
                        <span className="text-white/60 text-xs font-mono tabular-nums">
                          {formatTime(trailerTime)} / {formatTime(trailerDuration)}
                        </span>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={toggleTrailerMute}
                          className="text-white/90 hover:text-white transition-colors focus:outline-none"
                        >
                          <Lucide icon={trailerMuted ? "VolumeX" : "Volume2"} className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={toggleTrailerFullscreen}
                          className="text-white/90 hover:text-white transition-colors focus:outline-none"
                        >
                          <Lucide
                            icon={trailerFullscreen ? "Minimize2" : "Maximize2"}
                            className="w-4 h-4"
                          />
                        </button>
                      </div>
                    </div>
                  </>
                </div>
              )}
            </div>
          </div>

          {/* ─── BODY ─────────────────────────────────────────────────── */}
          <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

            {/* Descrizione completa */}
            {service.descrizione && (
              <div className="border-b border-slate-100 pb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Lucide icon="AlignLeft" className="w-4 h-4 text-slate-400" />
                  <h2 className="font-space-grotesk text-base font-semibold text-slate-800">
                    Descrizione
                  </h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {service.descrizione}
                </p>
              </div>
            )}


            {/* Trailer thumbnails — solo se >1 */}
            {trailers.length > 1 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lucide icon="PlayCircle" className="w-4 h-4 text-slate-500" />
                  <h2 className="font-space-grotesk text-base font-semibold text-slate-800">
                    Trailer
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                    {trailers.length}
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {trailers.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActiveTrailerId(v.id)}
                      className={clsx(
                        "shrink-0 min-w-[200px] text-left rounded-xl border p-3 transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-slate-300",
                        v.id === activeTrailer?.id
                          ? "border-slate-800 bg-slate-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      )}
                    >
                      <p className="text-sm font-medium text-slate-800 truncate">{v.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatBytes(v.size)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Guide videos */}
            {guides.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <Lucide icon="BookOpen" className="w-4 h-4 text-slate-500" />
                  <h2 className="font-space-grotesk text-base font-semibold text-slate-800">
                    Video guida
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                    {guides.length}
                  </span>
                </div>

                <div className="flex gap-6 items-start">
                  {/* Lista guide — sinistra */}
                  <div className="flex-1 min-w-0 flex flex-col gap-3">
                    {guides.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setActiveGuideId(v.id)}
                        className={clsx(
                          "w-full text-left rounded-xl border p-3 transition-all duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-slate-300",
                          v.id === activeGuide?.id
                            ? "border-theme-1 bg-theme-1/5 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                        )}
                      >
                        <p className="text-sm font-medium text-slate-800 truncate">{v.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatBytes(v.size)}</p>
                      </button>
                    ))}
                  </div>

                  {/* Player 16:9 — destra */}
                  {activeGuide && (
                    <div className="w-[58%] shrink-0">
                      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-4">
                        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/3 pointer-events-none" />
                        <div className="relative aspect-video rounded-lg overflow-hidden shadow-lg">
                          <VideoPlayer
                            key={activeGuide.id}
                            videoKey={activeGuide.id}
                            src={activeGuide.url}
                            mimeType={activeGuide.mime_type}
                            className="w-full h-full"
                            startMuted
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Documentation — sempre visibile */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <h2 className="font-space-grotesk text-base font-semibold text-slate-800">
                  Documentazione
                </h2>
              </div>

              {documents.length === 0 ? (
                <div className="flex items-center gap-3 py-5 px-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Lucide icon="FileX" className="w-5 h-5 text-slate-300 shrink-0" />
                  <p className="text-sm text-slate-400">
                    Non è presente documentazione per questo servizio.
                  </p>
                </div>
              ) : (
                <div>
                  {documents.map((doc, index) => {
                    const { icon, colorClass } = getDocumentIcon(doc);
                    console.log(colorClass);
                    return (
                      <a
                        key={doc.id}
                        href={doc.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={clsx(
                          "group flex items-center gap-4 py-3",
                          "transition-colors duration-150 hover:text-slate-900",
                          "focus:outline-none",
                          index !== 0 && "border-t border-slate-100"
                        )}
                      >
                        <Lucide icon={icon} className={clsx("w-5 h-5 shrink-0", colorClass)} />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-600 truncate leading-snug group-hover:text-blue-800 group-hover:underline">
                            {doc.title}
                          </p>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 shrink-0">
                          {doc.pages != null && (
                            <span className="text-xs text-slate-400 tabular-nums">
                              {doc.pages} pag.
                            </span>
                          )}
                          <span className="text-xs text-slate-400 tabular-nums w-14 text-right">
                            {formatBytes(doc.size)}
                          </span>
                          {doc.extension && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded w-10 text-center">
                              {doc.extension}
                            </span>
                          )}
                        </div>

                        <Lucide
                          icon="ExternalLink"
                          className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors duration-150"
                        />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsModal;
