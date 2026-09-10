import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import flyerCoverImg from "@/assets/images/cover/market_v17.jpg";
import flyerAltImgA from "@/assets/images/miscellaneous/mountain.jpg";
import flyerAltImgB from "@/assets/images/miscellaneous/robot.jpg";
import Button from "@/components/Base/Button";
import withSessionCheck from "@/components/SessionChecker";
import Chart from "@/components/Base/Chart";
import Dialog from "@/components/Base/Headless/Dialog";
import Lucide from "@/components/Base/Lucide";
import StatCard from "@/components/KitOverview/components/StatCard";
import { useFetchAreeCanaliECombinazioni } from "@/query/query";
import type { ChartOptions } from "chart.js/auto";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

dayjs.locale("it");

type PromoCard = {
  id: string;
  titolo: string;
  updatedAt: string;
  kits: number;
  durataOre: number;
  volantini: Array<{ nome: string; imageUrl: string }>;
  attivazioni: Array<{ area: string; canale: string }>;
  stato: "VALIDA" | "VALIDA_CON_ERRORI";
};

const promoInValidita: PromoCard[] = [
  {
    id: "7352d2da-9511-4f06-af06-5e249e38b5e1",
    titolo: "VOLANTINO_SCSI_VOL",
    updatedAt: "2026-01-27T12:56:00.000Z",
    kits: 6,
    durataOre: 64,
    volantini: [
      { nome: "VOL_SOTTOVUOTO_01", imageUrl: flyerCoverImg },
      { nome: "VOL_FRESCHI_02", imageUrl: flyerAltImgA },
      { nome: "VOL_MARKET_03", imageUrl: flyerAltImgB }
    ],
    attivazioni: [
      { area: "Lombardia", canale: "Punti vendita" },
      { area: "Lazio", canale: "Volantino digitale" },
      { area: "Piemonte", canale: "App mobile" }
    ],
    stato: "VALIDA"
  },
  {
    id: "a2d30ffa-7146-43ff-8927-5d8c87884fa0",
    titolo: "PROMO_FRESCHI_WEEKEND",
    updatedAt: "2026-01-30T08:22:00.000Z",
    kits: 4,
    durataOre: 51,
    volantini: [
      { nome: "WEEKEND_CARNI_01", imageUrl: flyerAltImgA },
      { nome: "WEEKEND_PESCE_02", imageUrl: flyerCoverImg }
    ],
    attivazioni: [
      { area: "Veneto", canale: "Punti vendita" },
      { area: "Emilia-Romagna", canale: "Sito web" },
      { area: "Toscana", canale: "Newsletter" }
    ],
    stato: "VALIDA_CON_ERRORI"
  },
  {
    id: "8d131b49-9f91-417d-89be-38e66f58eecc",
    titolo: "PROMO_CARNI_FEBBRAIO",
    updatedAt: "2026-02-02T15:10:00.000Z",
    kits: 8,
    durataOre: 73,
    volantini: [
      { nome: "CARNI_01", imageUrl: flyerAltImgB },
      { nome: "CARNI_02", imageUrl: flyerCoverImg },
      { nome: "CARNI_03", imageUrl: flyerAltImgA },
      { nome: "CARNI_04", imageUrl: flyerAltImgB }
    ],
    attivazioni: [
      { area: "Sicilia", canale: "Punti vendita" },
      { area: "Campania", canale: "App mobile" },
      { area: "Puglia", canale: "Social ADV" },
      { area: "Calabria", canale: "Volantino digitale" }
    ],
    stato: "VALIDA"
  }
];

const promoArchiviate = [
  { id: "a17f8f88-4a66-4429-89bb-d86165b8f5f2", titolo: "PROMO_NATALE_2025", closedAt: "2026-01-09T09:00:00.000Z" },
  { id: "cb510966-aa78-499d-8cee-2ef60326e275", titolo: "PROMO_BEFANA_2026", closedAt: "2026-01-15T18:45:00.000Z" }
];

// ─── Promozioni in lavorazione — tipi e mock ───────────────────────────────────

type StatoLogFile = "IN_ATTESA" | "IN_REVISIONE" | "ACCETTATO" | "ERRORE" | "PUBBLICATO";

type FileRuntimeLogMock = {
  id: string;
  nomeFile: string;
  stato: StatoLogFile;
  dataRegistrazione: string;
  versione: number;
  log?: string;
};

type PromoLavorazioneCard = {
  id: string;
  titolo: string;
  validitaDal: string;
  validitaAl: string;
  kits: number;
  giorniInProduzione: number;
  daysUntilExpiry: number | null;
  attivazioni: Array<{ area: string; canale: string }>;
  runtimeLogs: FileRuntimeLogMock[];
};

const promoInLavorazioneMock: PromoLavorazioneCard[] = [
  {
    id: "lav-001-estate-2026",
    titolo: "VOLANTINO_ESTATE_2026",
    validitaDal: "2026-03-10",
    validitaAl: "2026-03-24",
    kits: 8,
    giorniInProduzione: 11,
    daysUntilExpiry: 15,
    attivazioni: [
      { area: "NORD OVEST", canale: "IPER" },
      { area: "CENTRO", canale: "SUPER" },
    ],
    runtimeLogs: [
      { id: "rl-001-01", nomeFile: "VOL_EST_REPARTI_FRESCHI_01.pdf", stato: "PUBBLICATO", dataRegistrazione: "2026-02-20T09:15:00Z", versione: 3 },
      { id: "rl-001-02", nomeFile: "VOL_EST_CARNI_SALUMERIA_02.pdf", stato: "IN_REVISIONE", dataRegistrazione: "2026-02-21T14:30:00Z", versione: 2 },
      { id: "rl-001-03", nomeFile: "VOL_EST_MARE_PESCE_03.pdf", stato: "ERRORE", dataRegistrazione: "2026-02-22T08:00:00Z", versione: 1, log: "Formato pagina non conforme alla specifica A4. Richiesta correzione impaginazione." },
      { id: "rl-001-04", nomeFile: "VOL_EST_ORTOFRUTTA_04.pdf", stato: "IN_ATTESA", dataRegistrazione: "2026-02-22T16:45:00Z", versione: 1 },
      { id: "rl-001-05", nomeFile: "VOL_EST_PANE_PASTICCERIA_05.pdf", stato: "ACCETTATO", dataRegistrazione: "2026-02-19T11:00:00Z", versione: 2 },
    ],
  },
  {
    id: "lav-002-primavera-gdo",
    titolo: "PROMO_PRIMAVERA_GDO_NORD",
    validitaDal: "2026-03-01",
    validitaAl: "2026-03-15",
    kits: 5,
    giorniInProduzione: 7,
    daysUntilExpiry: 6,
    attivazioni: [
      { area: "NORD EST", canale: "SUPER" },
      { area: "NORD OVEST", canale: "PROXIMITY" },
    ],
    runtimeLogs: [
      { id: "rl-002-01", nomeFile: "PRIM_BAZAR_GARDEN_01.pdf", stato: "PUBBLICATO", dataRegistrazione: "2026-02-18T10:20:00Z", versione: 4 },
      { id: "rl-002-02", nomeFile: "PRIM_FERRAMENTA_UTENSILI_02.pdf", stato: "PUBBLICATO", dataRegistrazione: "2026-02-18T10:25:00Z", versione: 3 },
      { id: "rl-002-03", nomeFile: "PRIM_GIARDINO_OUTDOOR_03.pdf", stato: "IN_REVISIONE", dataRegistrazione: "2026-02-22T09:00:00Z", versione: 2 },
      { id: "rl-002-04", nomeFile: "PRIM_CURA_CASA_04.pdf", stato: "ERRORE", dataRegistrazione: "2026-02-23T07:30:00Z", versione: 1, log: "Risoluzione immagini insufficiente (72 dpi). Minimo richiesto: 300 dpi." },
    ],
  },
  {
    id: "lav-003-weekend-freschi",
    titolo: "WEEKEND_FRESCHI_SPECIALE",
    validitaDal: "2026-02-28",
    validitaAl: "2026-03-02",
    kits: 3,
    giorniInProduzione: 19,
    daysUntilExpiry: 3,
    attivazioni: [
      { area: "SUD", canale: "IPER" },
      { area: "ISOLE", canale: "SUPER" },
    ],
    runtimeLogs: [
      { id: "rl-003-01", nomeFile: "WKN_CARNI_GRILL_01.pdf", stato: "ACCETTATO", dataRegistrazione: "2026-02-15T08:00:00Z", versione: 2 },
      { id: "rl-003-02", nomeFile: "WKN_PESCE_AZZURRO_02.pdf", stato: "IN_ATTESA", dataRegistrazione: "2026-02-23T12:00:00Z", versione: 1 },
      { id: "rl-003-03", nomeFile: "WKN_VERDURE_ESTATE_03.pdf", stato: "ERRORE", dataRegistrazione: "2026-02-23T13:30:00Z", versione: 1, log: "File corrotto o non leggibile. Ricaricare il file originale." },
    ],
  },
];

const monthlyLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const promoAttiveMonthlySeries = [132, 141, 155, 149, 163, 171, 167, 159, 173, 182, 176, 188];
const promoConAnomalieMonthlySeries = [14, 18, 16, 13, 19, 21, 17, 12, 15, 20, 14, 16];

const trendChartOptions: ChartOptions = {
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true }
  },
  scales: {
    x: {
      ticks: { color: "#94a3b8", maxRotation: 0 },
      grid: { display: false },
      border: { display: false }
    },
    y: {
      ticks: { color: "#94a3b8" },
      grid: { color: "rgba(148,163,184,0.15)" },
      border: { display: false }
    }
  },
  elements: {
    line: { tension: 0.35, borderWidth: 2.4 },
    point: { radius: 0, hoverRadius: 3 }
  }
};

const fileCountChartOptions: ChartOptions = {
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true }
  },
  scales: {
    x: {
      ticks: { color: "#64748b", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      grid: { display: false },
      border: { display: false }
    },
    y: {
      ticks: { color: "#64748b", precision: 0 },
      grid: { color: "rgba(148,163,184,0.16)" },
      border: { display: false }
    }
  },
  elements: {
    point: { radius: 0, hoverRadius: 3 }
  }
};

const PROMO_SPOTLIGHT_LIMIT = 24;
const PROMO_DOTS_WINDOW = 7;
const YEAR_DAYS = 365;
const ARCHIVE_PREVIEW_LIMIT = 8;
const FALLBACK_AREE_REALI = ["NORD OVEST", "NORD EST", "CENTRO", "SUD", "ISOLE"];
const FALLBACK_CANALI_REALI = ["IPER", "SUPER", "PROXIMITY", "ONLINE", "DRIVE"];

// ─── File runtime log status config ───────────────────────────────────────────

const LOG_STATO_CONFIG: Record<StatoLogFile, { label: string; icon: string; color: string; bg: string }> = {
  IN_ATTESA: { label: "In attesa", icon: "Clock", color: "text-white/55", bg: "bg-white/10" },
  IN_REVISIONE: { label: "In revisione", icon: "Eye", color: "text-sky-200", bg: "bg-sky-400/20" },
  ACCETTATO: { label: "Accettato", icon: "CircleCheck", color: "text-emerald-200", bg: "bg-emerald-400/20" },
  ERRORE: { label: "Errore", icon: "CircleX", color: "text-red-300", bg: "bg-red-500/25" },
  PUBBLICATO: { label: "Pubblicato", icon: "Globe", color: "text-violet-200", bg: "bg-violet-400/20" },
};

const getWindowedIndexes = (total: number, current: number, maxVisible: number): number[] => {
  if (total <= 0) return [];
  if (total <= maxVisible) return Array.from({ length: total }, (_, idx) => idx);

  const half = Math.floor(maxVisible / 2);
  let start = Math.max(0, current - half);
  let end = start + maxVisible;

  if (end > total) {
    end = total;
    start = Math.max(0, end - maxVisible);
  }

  return Array.from({ length: end - start }, (_, idx) => start + idx);
};

const estimateMissingKits = (promo: PromoCard): number => {
  const idWeight = promo.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = Math.max(1, Math.round(promo.kits * 0.25));
  const variance = idWeight % Math.max(1, Math.floor(promo.kits * 0.4) + 1);
  return Math.min(promo.kits, Math.max(1, base + variance));
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getPromoAttivazioniMock = (promoId: string, aree: string[], canali: string[]): PromoCard["attivazioni"] => {
  const safeAree = aree.length > 0 ? aree : FALLBACK_AREE_REALI;
  const safeCanali = canali.length > 0 ? canali : FALLBACK_CANALI_REALI;
  const targetPairs = Math.min(4, Math.max(2, Math.floor((hashString(promoId) % 4) + 2)));
  const uniquePairs = new Set<string>();
  const attivazioni: PromoCard["attivazioni"] = [];
  let cursor = hashString(`${promoId}-seed`);

  while (attivazioni.length < targetPairs && uniquePairs.size < safeAree.length * safeCanali.length) {
    cursor = (cursor * 1664525 + 1013904223) % 4294967296;
    const area = safeAree[cursor % safeAree.length];
    cursor = (cursor * 1664525 + 1013904223) % 4294967296;
    const canale = safeCanali[cursor % safeCanali.length];
    const key = `${area}::${canale}`;

    if (uniquePairs.has(key)) continue;
    uniquePairs.add(key);
    attivazioni.push({ area, canale });
  }

  return attivazioni;
};

const applyAttivazioniToPromos = (promos: PromoCard[], aree: string[], canali: string[]): PromoCard[] =>
  promos.map((promo) => ({
    ...promo,
    attivazioni: getPromoAttivazioniMock(promo.id, aree, canali)
  }));

type PromoSpotlightCarouselProps = {
  promos: PromoCard[];
  totalePromo: number;
};

const PromoSpotlightCarousel = React.memo(({ promos, totalePromo }: PromoSpotlightCarouselProps) => {
  const FLYERS_PER_SLIDE = 3;
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [currentFlyerIndex, setCurrentFlyerIndex] = useState(0);
  const [flyerDirection, setFlyerDirection] = useState<1 | -1>(1);
  const [isHoldingLastFlyer, setIsHoldingLastFlyer] = useState(false);

  const promoCorrente = promos[currentPromoIndex] ?? promos[0];
  const useFlyerCarousel = (promoCorrente?.volantini.length ?? 0) > FLYERS_PER_SLIDE;
  const flyerGroupsCount = Math.ceil((promoCorrente?.volantini.length ?? 0) / FLYERS_PER_SLIDE);
  const currentFlyerGroup = Math.floor(currentFlyerIndex / FLYERS_PER_SLIDE);
  const visibleFlyers = promoCorrente?.volantini.slice(currentFlyerIndex, currentFlyerIndex + FLYERS_PER_SLIDE) ?? [];
  const visiblePromoIndexes = getWindowedIndexes(promos.length, currentPromoIndex, PROMO_DOTS_WINDOW);

  const goToPrevPromo = () => {
    if (promos.length <= 1) return;
    setSlideDirection(-1);
    setCurrentPromoIndex((prev) => (prev === 0 ? promos.length - 1 : prev - 1));
    setCurrentFlyerIndex(0);
    setIsHoldingLastFlyer(false);
  };

  const goToNextPromo = () => {
    if (promos.length <= 1) return;
    setSlideDirection(1);
    setCurrentPromoIndex((prev) => (prev === promos.length - 1 ? 0 : prev + 1));
    setCurrentFlyerIndex(0);
    setIsHoldingLastFlyer(false);
  };

  useEffect(() => {
    if (currentPromoIndex > Math.max(0, promos.length - 1)) {
      setCurrentPromoIndex(0);
    }
  }, [currentPromoIndex, promos.length]);

  useEffect(() => {
    if (!promoCorrente?.volantini?.length || promos.length <= 1) return;

    if (!useFlyerCarousel) {
      const holdDurationMs = (Math.ceil(promoCorrente.volantini.length / FLYERS_PER_SLIDE) + 1) * 2800;
      const intervalId = setInterval(() => {
        setSlideDirection(1);
        setCurrentPromoIndex((promoPrev) => (promoPrev + 1) % promos.length);
        setCurrentFlyerIndex(0);
        setIsHoldingLastFlyer(false);
      }, holdDurationMs);
      return () => clearInterval(intervalId);
    }

    const intervalId = setInterval(() => {
      setCurrentFlyerIndex((prev) => {
        const isLastFlyerGroup = prev + FLYERS_PER_SLIDE >= promoCorrente.volantini.length;

        if (isLastFlyerGroup) {
          if (!isHoldingLastFlyer) {
            setIsHoldingLastFlyer(true);
            return prev;
          }
          setSlideDirection(1);
          setCurrentPromoIndex((promoPrev) => (promoPrev + 1) % promos.length);
          setIsHoldingLastFlyer(false);
          return 0;
        }

        setFlyerDirection(1);
        setIsHoldingLastFlyer(false);
        return prev + FLYERS_PER_SLIDE;
      });
    }, 2800);

    return () => clearInterval(intervalId);
  }, [FLYERS_PER_SLIDE, isHoldingLastFlyer, promoCorrente?.id, promoCorrente?.volantini.length, promos.length, useFlyerCarousel]);

  if (!promoCorrente) {
    return (
      <div className="box box--stacked p-6">
        <p className="text-sm text-slate-600">Nessuna promozione disponibile.</p>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-success via-success/90 to-success/80">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_45%)]" />
      <div className="relative">
        <AnimatePresence initial={false} mode="wait" custom={slideDirection}>
          <motion.div
            key={promoCorrente.id}
            custom={slideDirection}
            initial={{ opacity: 0, x: slideDirection > 0 ? 32 : -32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection > 0 ? -32 : 32 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="flex flex-col justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Lucide icon="Megaphone" className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{promoCorrente.titolo}</h2>
                  <p className="text-white/80 text-sm">Overview promozione e volantini annessi</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                      <Lucide icon="Calendar" className="h-3 w-3" />
                      {dayjs(promoCorrente.updatedAt).format("DD MMMM YYYY, HH:mm")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                      <Lucide icon="Layers" className="h-3 w-3" />
                      {promoCorrente.kits} kit associati
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        promoCorrente.stato === "VALIDA_CON_ERRORI"
                          ? "bg-warning/90 text-slate-900"
                          : "bg-white/20 text-white"
                      )}
                    >
                      <Lucide icon={promoCorrente.stato === "VALIDA_CON_ERRORI" ? "TriangleAlert" : "CircleCheck"} className="h-3 w-3" />
                      {promoCorrente.stato.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                      Aree e canali attivi
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {promoCorrente.attivazioni.map((item) => (
                        <span key={`${item.area}-${item.canale}`} className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white">
                          {item.area} · {item.canale}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={goToPrevPromo} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white transition hover:bg-white/30" aria-label="Promo precedente">
                    <Lucide icon="ChevronLeft" className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={goToNextPromo} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white transition hover:bg-white/30" aria-label="Promo successiva">
                    <Lucide icon="ChevronRight" className="h-4 w-4" />
                  </button>
                  <div className="ml-1 flex items-center gap-1.5">
                    {visiblePromoIndexes[0] > 0 && <span className="text-xs text-white/70">...</span>}
                    {visiblePromoIndexes.map((idx) => (
                      <button
                        key={promos[idx]?.id ?? idx}
                        type="button"
                        onClick={() => {
                          setSlideDirection(idx > currentPromoIndex ? 1 : -1);
                          setCurrentPromoIndex(idx);
                          setCurrentFlyerIndex(0);
                          setIsHoldingLastFlyer(false);
                        }}
                        className={clsx("h-2.5 w-2.5 rounded-full transition", idx === currentPromoIndex ? "bg-white" : "bg-white/35 hover:bg-white/60")}
                        aria-label={`Vai alla promo spotlight ${idx + 1}`}
                      />
                    ))}
                    {visiblePromoIndexes[visiblePromoIndexes.length - 1] < promos.length - 1 && <span className="text-xs text-white/70">...</span>}
                  </div>
                </div>

                <Link to={`/promozioni/in-corso/dettagli/${promoCorrente.id}`}>
                  <Button variant="outline-secondary" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                    <Lucide icon="ArrowRight" className="mr-2 h-4 w-4" />
                    Vai ai dettagli
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-white/70">
                Spotlight {currentPromoIndex + 1}/{promos.length} su {totalePromo} promo totali
              </p>
            </div>

            <div className="relative min-h-[190px]">
              {useFlyerCarousel ? (
                <>
                  <div className="relative mx-auto w-full max-w-[560px]">
                    <AnimatePresence mode="wait" initial={false} custom={flyerDirection}>
                      <motion.div
                        key={`${promoCorrente.id}-group-${currentFlyerIndex}`}
                        custom={flyerDirection}
                        initial={{ opacity: 0, x: flyerDirection > 0 ? 24 : -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: flyerDirection > 0 ? -24 : 24 }}
                        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="grid grid-cols-3 gap-2"
                      >
                        {visibleFlyers.map((volantino) => (
                          <div key={volantino.nome} className="relative h-[210px] overflow-hidden rounded-[0.6rem] border border-white/40 bg-white/10 shadow-sm">
                            <img src={volantino.imageUrl} alt={volantino.nome} className="h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-1.5">
                              <p className="truncate text-[10px] font-medium text-white">{volantino.nome}</p>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {Array.from({ length: flyerGroupsCount }).map((_, idx) => (
                      <button
                        key={`flyer-group-${idx}`}
                        type="button"
                        onClick={() => {
                          setFlyerDirection(idx > currentFlyerGroup ? 1 : -1);
                          setCurrentFlyerIndex(idx * FLYERS_PER_SLIDE);
                          setIsHoldingLastFlyer(false);
                        }}
                        className={clsx("h-2.5 w-2.5 rounded-full transition", idx === currentFlyerGroup ? "bg-white" : "bg-white/35 hover:bg-white/60")}
                        aria-label={`Vai al gruppo volantini ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {promoCorrente.volantini.map((volantino) => (
                    <div key={volantino.nome} className="relative h-[210px] overflow-hidden rounded-[0.6rem] border border-white/40 bg-white/10 shadow-sm">
                      <img src={volantino.imageUrl} alt={volantino.nome} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-1.5">
                        <p className="truncate text-[10px] font-medium text-white">{volantino.nome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
});

type PromoCriticalCarouselProps = {
  promos: PromoCard[];
  onResolve: (promo: PromoCard) => void;
};

const PromoCriticalCarousel = React.memo(({ promos, onResolve }: PromoCriticalCarouselProps) => {
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const visiblePromoIndexes = getWindowedIndexes(promos.length, currentPromoIndex, PROMO_DOTS_WINDOW);
  const promoCritica = promos[currentPromoIndex] ?? promos[0];

  useEffect(() => {
    if (currentPromoIndex > Math.max(0, promos.length - 1)) {
      setCurrentPromoIndex(0);
    }
  }, [currentPromoIndex, promos.length]);

  useEffect(() => {
    if (promos.length <= 1) return;
    const intervalId = setInterval(() => {
      setSlideDirection(1);
      setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
    }, 6500);
    return () => clearInterval(intervalId);
  }, [promos.length]);

  if (!promoCritica) return null;

  const promoCriticaKitsMancanti = estimateMissingKits(promoCritica);
  const promoCriticaKitsPubblicati = Math.max(0, promoCritica.kits - promoCriticaKitsMancanti);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-danger p-6 shadow-lg">
      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <AnimatePresence initial={false} mode="wait" custom={slideDirection}>
          <motion.div
            key={promoCritica.id}
            custom={slideDirection}
            initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection > 0 ? -28 : 28 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="contents"
          >
            <div className="flex flex-col justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Lucide icon="TriangleAlert" className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Promo in validita con kit non pubblicati</h2>
                  <p className="text-sm text-white/85">
                    Una promo in questo stato e entrata in validita, ma non ha ancora pubblicato tutti i kit previsti.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
                      <Lucide icon="AlertCircle" className="h-3 w-3" />
                      {promos.length} promo da completare
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
                      <Lucide icon="Boxes" className="h-3 w-3" />
                      Kit mancanti stimati: {promoCriticaKitsMancanti}/{promoCritica.kits}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
                      <Lucide icon="CalendarClock" className="h-3 w-3" />
                      Update: {dayjs(promoCritica.updatedAt).format("DD/MM/YYYY HH:mm")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (promos.length <= 1) return;
                      setSlideDirection(-1);
                      setCurrentPromoIndex((prev) => (prev === 0 ? promos.length - 1 : prev - 1));
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white transition hover:bg-white/30"
                    aria-label="Promo critica precedente"
                  >
                    <Lucide icon="ChevronLeft" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (promos.length <= 1) return;
                      setSlideDirection(1);
                      setCurrentPromoIndex((prev) => (prev === promos.length - 1 ? 0 : prev + 1));
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white transition hover:bg-white/30"
                    aria-label="Promo critica successiva"
                  >
                    <Lucide icon="ChevronRight" className="h-4 w-4" />
                  </button>
                  <div className="ml-1 flex items-center gap-1.5">
                    {visiblePromoIndexes[0] > 0 && <span className="text-xs text-white/70">...</span>}
                    {visiblePromoIndexes.map((idx) => (
                      <button
                        key={promos[idx]?.id ?? idx}
                        type="button"
                        onClick={() => {
                          setSlideDirection(idx > currentPromoIndex ? 1 : -1);
                          setCurrentPromoIndex(idx);
                        }}
                        className={clsx(
                          "h-2.5 w-2.5 rounded-full transition",
                          idx === currentPromoIndex ? "bg-white" : "bg-white/35 hover:bg-white/60"
                        )}
                        aria-label={`Vai alla promo critica ${idx + 1}`}
                      />
                    ))}
                    {visiblePromoIndexes[visiblePromoIndexes.length - 1] < promos.length - 1 && (
                      <span className="text-xs text-white/70">...</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/promozioni/in-corso/dettagli/${promoCritica.id}`}>
                    <Button variant="outline-secondary" className="border-white/40 bg-white/15 text-white hover:bg-white/25">
                      <Lucide icon="ArrowRight" className="mr-2 h-4 w-4" />
                      Apri promo critica
                    </Button>
                  </Link>
                  <PermissionGate permission={PERMISSIONS.PROMO.MODIFICA} mode="disable">
                    <Button
                      variant="outline-secondary"
                      className="border-white/40 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => onResolve(promoCritica)}
                    >
                      <Lucide icon="CircleCheck" className="mr-2 h-4 w-4" />
                      Segna come valida
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/30 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Focus promo critica</p>
              <h3 className="mt-1 truncate text-lg font-bold text-white">{promoCritica.titolo}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-white/15 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/70">Kit previsti</p>
                  <p className="text-base font-semibold text-white">{promoCritica.kits}</p>
                </div>
                <div className="rounded-md bg-white/15 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/70">Kit pubblicati</p>
                  <p className="text-base font-semibold text-white">{promoCriticaKitsPubblicati}</p>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-white/25 bg-black/10 p-2">
                <p className="text-[11px] text-white/85">
                  Stato: in validita con pubblicazione incompleta. Intervento richiesto su kit mancanti.
                </p>
              </div>
              <p className="mt-3 text-xs text-white/70">
                Criticita {currentPromoIndex + 1}/{promos.length}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
});

// ─── PromoLavorazioneCarousel ──────────────────────────────────────────────────

type PromoLavorazioneCarouselProps = {
  promos: PromoLavorazioneCard[];
};

const PromoLavorazioneCarousel = React.memo(({ promos }: PromoLavorazioneCarouselProps) => {
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const visiblePromoIndexes = getWindowedIndexes(promos.length, currentPromoIndex, PROMO_DOTS_WINDOW);
  const promo = promos[currentPromoIndex] ?? promos[0];

  const goToPrev = () => {
    if (promos.length <= 1) return;
    setSlideDirection(-1);
    setCurrentPromoIndex((prev) => (prev === 0 ? promos.length - 1 : prev - 1));
  };
  const goToNext = () => {
    if (promos.length <= 1) return;
    setSlideDirection(1);
    setCurrentPromoIndex((prev) => (prev === promos.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (currentPromoIndex > Math.max(0, promos.length - 1)) setCurrentPromoIndex(0);
  }, [currentPromoIndex, promos.length]);

  useEffect(() => {
    if (promos.length <= 1) return;
    const id = setInterval(() => {
      setSlideDirection(1);
      setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
    }, 6500);
    return () => clearInterval(id);
  }, [promos.length]);

  if (!promo) return null;

  const erroriCount = promo.runtimeLogs.filter((l) => l.stato === "ERRORE").length;
  const pubblicatiCount = promo.runtimeLogs.filter((l) => l.stato === "PUBBLICATO").length;
  const inCorsoCount = promo.runtimeLogs.filter((l) => l.stato === "IN_REVISIONE" || l.stato === "IN_ATTESA").length;

  return (
    <section className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-warning via-warning/90 to-amber-600/80 shadow-lg">
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
      <div className="relative">
        <AnimatePresence initial={false} mode="wait" custom={slideDirection}>
          <motion.div
            key={promo.id}
            custom={slideDirection}
            initial={{ opacity: 0, x: slideDirection > 0 ? 32 : -32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection > 0 ? -32 : 32 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            {/* ── Left panel ── */}
            <div className="flex flex-col justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shrink-0">
                  <Lucide icon="Cog" className="h-8 w-8 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-white truncate">{promo.titolo}</h2>
                  <p className="text-white/80 text-sm">Promozione attualmente in lavorazione</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                      <Lucide icon="Layers" className="h-3 w-3" />
                      {promo.kits} kit collegati
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                      <Lucide icon="Timer" className="h-3 w-3" />
                      In produzione da {promo.giorniInProduzione}g
                    </span>
                    {promo.daysUntilExpiry !== null && promo.daysUntilExpiry <= 7 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 text-white text-xs font-semibold">
                        <Lucide icon="AlarmClock" className="h-3 w-3" />
                        Scade tra {promo.daysUntilExpiry}g
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 text-white text-xs font-medium">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      IN LAVORAZIONE
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                      Aree e canali attivi
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {promo.attivazioni.map((item) => (
                        <span key={`${item.area}-${item.canale}`} className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white">
                          {item.area} · {item.canale}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={goToPrev} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white transition hover:bg-white/30" aria-label="Lavorazione precedente">
                    <Lucide icon="ChevronLeft" className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={goToNext} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/20 text-white transition hover:bg-white/30" aria-label="Lavorazione successiva">
                    <Lucide icon="ChevronRight" className="h-4 w-4" />
                  </button>
                  <div className="ml-1 flex items-center gap-1.5">
                    {visiblePromoIndexes[0] > 0 && <span className="text-xs text-white/70">...</span>}
                    {visiblePromoIndexes.map((idx) => (
                      <button
                        key={promos[idx]?.id ?? idx}
                        type="button"
                        onClick={() => { setSlideDirection(idx > currentPromoIndex ? 1 : -1); setCurrentPromoIndex(idx); }}
                        className={clsx("h-2.5 w-2.5 rounded-full transition", idx === currentPromoIndex ? "bg-white" : "bg-white/35 hover:bg-white/60")}
                        aria-label={`Vai alla lavorazione ${idx + 1}`}
                      />
                    ))}
                    {visiblePromoIndexes[visiblePromoIndexes.length - 1] < promos.length - 1 && <span className="text-xs text-white/70">...</span>}
                  </div>
                </div>
                <Link to="/promozioni/in-corso">
                  <Button variant="outline-secondary" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                    <Lucide icon="ArrowRight" className="mr-2 h-4 w-4" />
                    Vai alle lavorazioni
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-white/70">
                Lavorazione {currentPromoIndex + 1}/{promos.length}
                {" · "}
                {dayjs(promo.validitaDal).format("DD/MM/YYYY")} → {dayjs(promo.validitaAl).format("DD/MM/YYYY")}
              </p>
            </div>

            {/* ── Right panel: file runtime logs ── */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-white/30 bg-white/10 p-4 backdrop-blur-sm flex-1">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">File runtime log</p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white">
                      <Lucide icon="Files" className="h-3 w-3" />
                      {promo.runtimeLogs.length} file
                    </span>
                    {erroriCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/30 px-2 py-0.5 text-[11px] text-red-200 font-semibold">
                        <Lucide icon="CircleX" className="h-3 w-3" />
                        {erroriCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[210px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.3)_transparent]">
                  {promo.runtimeLogs.map((logEntry) => {
                    const cfg = LOG_STATO_CONFIG[logEntry.stato];
                    return (
                      <div key={logEntry.id} className={clsx("rounded-lg px-2.5 py-2", cfg.bg)}>
                        <div className="flex items-center gap-2">
                          <Lucide icon={cfg.icon} className={clsx("h-3.5 w-3.5 shrink-0", cfg.color)} />
                          <p className="truncate text-[11px] font-mono font-medium text-white flex-1">{logEntry.nomeFile}</p>
                          <span className={clsx("shrink-0 text-[10px] font-semibold", cfg.color)}>v{logEntry.versione}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 pl-5">
                          <span className={clsx("text-[10px] font-semibold uppercase tracking-wide", cfg.color)}>{cfg.label}</span>
                          <span className="text-[10px] text-white/55">{dayjs(logEntry.dataRegistrazione).format("DD/MM HH:mm")}</span>
                        </div>
                        {logEntry.stato === "ERRORE" && logEntry.log && (
                          <p className="mt-1 pl-5 text-[10px] text-red-200/90 italic line-clamp-2">{logEntry.log}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mini stats bar */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/25 bg-white/10 p-2 text-center">
                  <p className="text-[10px] text-white/65 uppercase tracking-wide">Pubblicati</p>
                  <p className="text-sm font-bold text-violet-200">{pubblicatiCount}</p>
                </div>
                <div className="rounded-lg border border-white/25 bg-white/10 p-2 text-center">
                  <p className="text-[10px] text-white/65 uppercase tracking-wide">In corso</p>
                  <p className="text-sm font-bold text-white">{inCorsoCount}</p>
                </div>
                <div className={clsx(
                  "rounded-lg border p-2 text-center",
                  erroriCount > 0 ? "border-red-400/40 bg-red-500/20" : "border-white/25 bg-white/10"
                )}>
                  <p className="text-[10px] text-white/65 uppercase tracking-wide">Errori</p>
                  <p className={clsx("text-sm font-bold", erroriCount > 0 ? "text-red-200" : "text-white")}>{erroriCount}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
});

const Promozioni: React.FC = () => {
  const { data: areeCanaliData } = useFetchAreeCanaliECombinazioni();
  const areeReali = useMemo(() => {
    const fromApi = (areeCanaliData?.aree ?? [])
      .map((area) => area.nome)
      .filter((value): value is string => Boolean(value));
    return fromApi.length > 0 ? fromApi : FALLBACK_AREE_REALI;
  }, [areeCanaliData?.aree]);
  const canaliReali = useMemo(() => {
    const fromApi = (areeCanaliData?.canali ?? [])
      .map((canale) => canale.nome)
      .filter((value): value is string => Boolean(value));
    return fromApi.length > 0 ? fromApi : FALLBACK_CANALI_REALI;
  }, [areeCanaliData?.canali]);
  const [promosData, setPromosData] = useState<PromoCard[]>(() =>
    applyAttivazioniToPromos(promoInValidita, FALLBACK_AREE_REALI, FALLBACK_CANALI_REALI)
  );
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingPromo, setResolvingPromo] = useState<PromoCard | null>(null);

  useEffect(() => {
    setPromosData((prevPromos) => applyAttivazioniToPromos(prevPromos, areeReali, canaliReali));
  }, [areeReali, canaliReali]);

  const promoSortedByUpdate = useMemo(
    () =>
      [...promosData]
        .filter((promo) => promo.stato === "VALIDA" || promo.stato === "VALIDA_CON_ERRORI")
        .sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf()),
    [promosData]
  );
  const promoValideSortedByUpdate = useMemo(
    () => promoSortedByUpdate.filter((promo) => promo.stato === "VALIDA"),
    [promoSortedByUpdate]
  );
  const promoSpotlight = useMemo(
    () => promoValideSortedByUpdate.slice(0, PROMO_SPOTLIGHT_LIMIT),
    [promoValideSortedByUpdate]
  );
  const totalePromoValide = promoValideSortedByUpdate.length;
  const promoConErrori = useMemo(
    () => promoSortedByUpdate.filter((promo) => promo.stato === "VALIDA_CON_ERRORI"),
    [promoSortedByUpdate]
  );
  const promoValidePulite = useMemo(
    () => promoSortedByUpdate.filter((promo) => promo.stato === "VALIDA"),
    [promoSortedByUpdate]
  );
  const totalePromo = promoSortedByUpdate.length;

  const totaleKits = promosData.reduce((acc, promo) => acc + promo.kits, 0);
  const totaleVolantini = promosData.reduce((acc, promo) => acc + promo.volantini.length, 0);
  const durataMediaOre = Math.round(
    promosData.reduce((acc, promo) => acc + promo.durataOre, 0) / Math.max(promosData.length, 1)
  );
  const ultimaAttivita = promosData.reduce((latest, promo) => {
    return dayjs(promo.updatedAt).isAfter(latest) ? dayjs(promo.updatedAt) : latest;
  }, dayjs(promosData[0]?.updatedAt));
  const percentualeErrori = Math.round((promoConErrori.length / Math.max(promosData.length, 1)) * 100);
  const mediaPromoAttive = Math.round(
    promoAttiveMonthlySeries.reduce((acc, value) => acc + value, 0) / promoAttiveMonthlySeries.length
  );
  const mediaPromoConAnomalie = Math.round(
    promoConAnomalieMonthlySeries.reduce((acc, value) => acc + value, 0) / promoConAnomalieMonthlySeries.length
  );
  const tassoMedioAnomalie = Math.round(
    (mediaPromoConAnomalie / Math.max(mediaPromoAttive, 1)) * 100
  );
  const promoInScadenza = [...promoSortedByUpdate]
    .map((promo) => ({
      ...promo,
      scadenzaStimata: dayjs(promo.updatedAt).add(promo.durataOre, "hour")
    }))
    .sort((a, b) => a.scadenzaStimata.valueOf() - b.scadenzaStimata.valueOf())
    .slice(0, 3);
  const finestreUrgentiCount = promoInScadenza.filter((promo) => promo.scadenzaStimata.diff(dayjs(), "hour") <= 24).length;
  const archiviateUltimi7Giorni = promoArchiviate.filter((promo) => dayjs().diff(dayjs(promo.closedAt), "day") <= 7).length;
  const yearStart = useMemo(() => dayjs().startOf("year"), []);
  const daysToToday = useMemo(
    () => Math.min(YEAR_DAYS, Math.max(1, dayjs().diff(yearStart, "day") + 1)),
    [yearStart]
  );
  const annualDailyLabels = useMemo(
    () => Array.from({ length: YEAR_DAYS }, (_, dayIdx) => yearStart.add(dayIdx, "day").format("DD/MM")),
    [yearStart]
  );
  const annualFilesSeries = useMemo(() => {
    let seed = 137;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    return Array.from({ length: YEAR_DAYS }, (_, dayIdx) => {
      if (dayIdx >= daysToToday) return 0;

      const isWeekend = dayIdx % 7 === 0 || dayIdx % 7 === 6;
      const seasonality = 1 + Math.sin((dayIdx / YEAR_DAYS) * Math.PI * 2) * 0.35;
      const random = nextRand();
      const random2 = nextRand();

      const droughtWindow = dayIdx % 47 <= 2 || dayIdx % 61 === 0; // giorni quasi fermi
      const hardStopDay = random < 0.1; // giorni completamente a zero
      const bigBurstDay = random > 0.94; // picchi alti
      const mediumBurstDay = random > 0.82 && random <= 0.94;

      if (hardStopDay || droughtWindow) return 0;

      const weekdayBase = isWeekend ? 25 : 120;
      const oscillation = weekdayBase * seasonality;

      if (bigBurstDay) {
        return Math.min(1200, Math.round(850 + random2 * 350));
      }

      if (mediumBurstDay) {
        return Math.min(1200, Math.round(320 + random2 * 420));
      }

      const normal = Math.round(oscillation + random2 * 180 - 40);
      return Math.min(1200, Math.max(0, normal));
    });
  }, [daysToToday, promoSortedByUpdate]);
  const producedDaysSeries = annualFilesSeries.slice(0, daysToToday);
  const totalFiles = producedDaysSeries.reduce((acc, value) => acc + value, 0);
  const mediaFilesPerDay = Math.round(totalFiles / Math.max(producedDaysSeries.length, 1));
  const peakFilesPerDay = Math.max(...producedDaysSeries, 0);
  const promoArchiviatePreview = promoArchiviate.slice(0, ARCHIVE_PREVIEW_LIMIT);
  const resolvePromoAsValid = () => {
    if (!resolvingPromo) return;
    setPromosData((prev) =>
      prev.map((promo) =>
        promo.id === resolvingPromo.id ? { ...promo, stato: "VALIDA", updatedAt: dayjs().toISOString() } : promo
      )
    );
    setShowResolveModal(false);
    setResolvingPromo(null);
  };

  return (
    <div className="space-y-6">

      {/* ── 1. KPI Band — metriche in cima per visione immediata ─────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="Layers" iconColor="text-theme-1" iconBg="bg-theme-1/10" value={totaleKits} label="Kit in validita" sublabel={`${totalePromo} promozioni`} />
        <StatCard icon="Clock" iconColor="text-info" iconBg="bg-info/10" value={`${durataMediaOre}h`} label="Tempo medio produzione" sublabel="Ultimi cicli" />
        <StatCard icon="TriangleAlert" iconColor="text-warning" iconBg="bg-warning/10" value={`${percentualeErrori}%`} label="Promo con errori" sublabel={`${promoConErrori.length} promozioni`} />
        <StatCard icon="CalendarClock" iconColor="text-success" iconBg="bg-success/10" value={dayjs(ultimaAttivita).format("HH:mm")} label="Ultimo aggiornamento" sublabel={dayjs(ultimaAttivita).format("DD/MM/YYYY")} />
      </div>

      {/* ── 2. Hero + Sidebar — spotlight carousel con contesto a destra ──────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <PromoSpotlightCarousel promos={promoSpotlight} totalePromo={totalePromoValide} />

          {/* Carousels di allerta — sotto le promo in validità */}
          {promoConErrori.length > 0 && (
            <PromoCriticalCarousel
              promos={promoConErrori}
              onResolve={(promo) => {
                setResolvingPromo(promo);
                setShowResolveModal(true);
              }}
            />
          )}

          <PromoLavorazioneCarousel promos={promoInLavorazioneMock} />
        </div>

        <div className="flex flex-col gap-4">
          {/* Navigazione rapida — link verticali nella sidebar */}
          <div className="grid grid-cols-1 gap-3">
            <Link
              to="/promozioni/in-corso"
              className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Navigazione rapida</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-800">Promozioni in corso</h3>
                  <p className="mt-1 text-sm text-slate-500">Monitora tutte le promo attive e il loro stato operativo.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lucide icon="Activity" className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Apri sezione
                <Lucide icon="ArrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              to="/promozioni/storico"
              className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Navigazione rapida</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-800">Storico promozioni</h3>
                  <p className="mt-1 text-sm text-slate-500">Consulta le promozioni chiuse e l’evoluzione nel tempo.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Lucide icon="History" className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Apri sezione
                <Lucide icon="ArrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>

          {/* Scadenze stimate — accanto all’hero per contesto immediato */}
          <div className="box box--stacked p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Scadenze stimate</p>
                <h3 className="mt-1 text-base font-medium text-slate-800">Prossime finestre da presidiare</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Lucide icon="AlarmClock" className="h-3.5 w-3.5" />
                {finestreUrgentiCount} urgenti
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {promoInScadenza.map((promo) => {
                const oreResidue = promo.scadenzaStimata.diff(dayjs(), "hour");
                const isUrgente = oreResidue <= 24;

                return (
                  <div
                    key={promo.id}
                    className={clsx(
                      "rounded-xl border bg-white p-3 transition",
                      isUrgente ? "border-amber-300 shadow-sm shadow-amber-100/70" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{promo.titolo}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {promo.kits} kit
                          </span>
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              isUrgente ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {isUrgente ? "Intervento rapido" : "In controllo"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        <Lucide icon={isUrgente ? "BellRing" : "Clock3"} className="h-3.5 w-3.5" />
                        {promo.scadenzaStimata.fromNow()}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Lucide icon="CalendarClock" className="h-3.5 w-3.5" />
                      {promo.scadenzaStimata.format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Analytics — chart principale + colonna dati affiancata ─────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">

        {/* Volume file annuale — main, più respiro per leggere il grafico */}
        <section className="box box--stacked p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Volume file annuale (mock)</p>
              <h3 className="mt-1 text-base font-medium text-slate-800">File prodotti giorno per giorno per promo (orizzonte: 1 anno)</h3>
            </div>
            <div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              Totale annuo/promo: {totalFiles}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <Chart
              type="line"
              height={260}
              className="w-full"
              options={fileCountChartOptions}
              data={{
                labels: annualDailyLabels,
                datasets: [
                  {
                    label: "File prodotti per giorno (per promo)",
                    data: annualFilesSeries,
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56,189,248,0.18)",
                    fill: true
                  }
                ]
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Media file/giorno</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{mediaFilesPerDay}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Picco giornaliero</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{peakFilesPerDay}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Promo monitorate</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{totalePromo}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Promo con errori</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{promoConErrori.length}</p>
            </div>
          </div>
        </section>

        {/* Colonna destra — trend e archivio impilati */}
        <div className="flex flex-col gap-4">
          <div className="box box--stacked p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Trend operativo</p>
                <h3 className="mt-1 text-base font-medium text-slate-800">Andamento promozioni attive e con anomalie (ultimi 12 mesi)</h3>
              </div>
              <span
                className={clsx(
                  "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                  tassoMedioAnomalie <= 15
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-rose-300 bg-rose-50 text-rose-700"
                )}
              >
                <Lucide icon={tassoMedioAnomalie <= 15 ? "ShieldCheck" : "ShieldAlert"} className="mr-1 h-3.5 w-3.5" />
                Tasso medio anomalie: {tassoMedioAnomalie}%
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
              <Chart
                type="line"
                height={180}
                className="w-full"
                options={trendChartOptions}
                data={{
                  labels: monthlyLabels,
                  datasets: [
                    {
                      label: "Promozioni attive",
                      data: promoAttiveMonthlySeries,
                      borderColor: "#0ea5e9",
                      backgroundColor: "rgba(14,165,233,0.2)",
                      fill: true
                    },
                    {
                      label: "Promozioni con anomalie",
                      data: promoConAnomalieMonthlySeries,
                      borderColor: "#f59e0b",
                      backgroundColor: "rgba(245,158,11,0.12)",
                      fill: true
                    }
                  ]
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Media promo attive/mese</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{mediaPromoAttive}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Media promo con anomalie/mese</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-800">{mediaPromoConAnomalie}</p>
              </div>
            </div>
          </div>

          <div className="box box--stacked p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Archivio rapido</p>
                <h3 className="mt-1 text-base font-medium text-slate-800">Ultime promozioni archiviate</h3>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ultimi 7 giorni</p>
                <p className="text-sm font-bold text-slate-700">{archiviateUltimi7Giorni} archiviate</p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {promoArchiviatePreview.map((promo) => (
                <div key={promo.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{promo.titolo}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Lucide icon="CalendarCheck2" className="h-3.5 w-3.5" />
                        Chiusa il {dayjs(promo.closedAt).format("DD/MM/YYYY HH:mm")}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {dayjs(promo.closedAt).fromNow()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/promozioni/storico"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Apri storico completo
              <Lucide icon="ArrowRight" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
      <Dialog
        open={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          setResolvingPromo(null);
        }}
        centered
        size="md"
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="flex items-center gap-2 text-slate-800 ">
              <Lucide icon="TriangleAlert" className="h-5 w-5 text-warning" />
              Conferma modifica stato
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <p className="text-sm text-slate-700">
              Stai per impostare la promo
              <span className="mx-1 font-semibold text-slate-900">{resolvingPromo?.titolo}</span>
              come
              <span className="mx-1 font-semibold text-success">VALIDA</span>.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Procedi solo dopo aver verificato che tutti i kit previsti siano stati pubblicati correttamente.
            </p>
          </Dialog.Description>
          <Dialog.Footer className="flex items-center justify-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setShowResolveModal(false);
                setResolvingPromo(null);
              }}
            >
              Annulla
            </Button>
            <PermissionGate permission={PERMISSIONS.PROMO.MODIFICA} mode="disable">
              <Button variant="primary" onClick={resolvePromoAsValid}>
                Conferma e segna valida
              </Button>
            </PermissionGate>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

    </div>
  );
};

export default withSessionCheck(Promozioni);
